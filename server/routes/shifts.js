import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// POST /api/shifts/start - Start a new shift
router.post('/start', async (req, res) => {
  try {
    if (!req.session || !req.session.employee) {
      return res.status(401).json({ success: false, error: 'Not logged in' });
    }

    const { opening_cash, notes } = req.body;
    const employeeId = req.session.employee.id;

    // Check if employee already has an active shift
    const existingShift = await pool.query(
      'SELECT * FROM shifts WHERE employee_id = $1 AND status = $2',
      [employeeId, 'active']
    );

    if (existingShift.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active shift',
        shift: existingShift.rows[0]
      });
    }

    // Create new shift
    const result = await pool.query(
      `INSERT INTO shifts (employee_id, opening_cash, notes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [employeeId, opening_cash || 0, notes || null]
    );

    const shift = result.rows[0];

    res.status(201).json({
      success: true,
      shift: {
        ...shift,
        employee_name: req.session.employee.name
      }
    });
  } catch (error) {
    console.error('Error starting shift:', error);
    res.status(500).json({ success: false, error: 'Failed to start shift' });
  }
});

// POST /api/shifts/end - End current shift
router.post('/end', async (req, res) => {
  try {
    if (!req.session || !req.session.employee) {
      return res.status(401).json({ success: false, error: 'Not logged in' });
    }

    const { closing_cash, notes } = req.body;
    const employeeId = req.session.employee.id;

    // Get active shift
    const shiftResult = await pool.query(
      'SELECT * FROM shifts WHERE employee_id = $1 AND status = $2',
      [employeeId, 'active']
    );

    if (shiftResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No active shift found' });
    }

    const shift = shiftResult.rows[0];

    // Calculate expected cash (opening + cash sales during shift)
    const salesResult = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as order_count
       FROM orders
       WHERE shift_id = $1`,
      [shift.id]
    );

    const { cash_sales, total_sales, order_count } = salesResult.rows[0];
    const expectedCash = parseFloat(shift.opening_cash) + parseFloat(cash_sales);
    const cashVariance = parseFloat(closing_cash || 0) - expectedCash;

    // Update shift
    const updateResult = await pool.query(
      `UPDATE shifts
       SET end_time = CURRENT_TIMESTAMP,
           closing_cash = $1,
           expected_cash = $2,
           cash_variance = $3,
           status = 'closed',
           notes = COALESCE($4, notes)
       WHERE id = $5
       RETURNING *`,
      [closing_cash || 0, expectedCash, cashVariance, notes, shift.id]
    );

    // Get sales breakdown by payment method
    const breakdownResult = await pool.query(
      `SELECT
        payment_method,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total
       FROM orders
       WHERE shift_id = $1
       GROUP BY payment_method`,
      [shift.id]
    );

    const salesBreakdown = {};
    breakdownResult.rows.forEach(row => {
      salesBreakdown[row.payment_method] = {
        count: parseInt(row.order_count),
        total: parseFloat(row.total)
      };
    });

    res.json({
      success: true,
      shift: updateResult.rows[0],
      report: {
        employee_name: req.session.employee.name,
        start_time: shift.start_time,
        end_time: updateResult.rows[0].end_time,
        opening_cash: parseFloat(shift.opening_cash),
        closing_cash: parseFloat(closing_cash || 0),
        expected_cash: expectedCash,
        cash_variance: cashVariance,
        total_sales: parseFloat(total_sales),
        order_count: parseInt(order_count),
        sales_by_method: salesBreakdown
      }
    });
  } catch (error) {
    console.error('Error ending shift:', error);
    res.status(500).json({ success: false, error: 'Failed to end shift' });
  }
});

// GET /api/shifts/current - Get current active shift
router.get('/current', async (req, res) => {
  try {
    if (!req.session || !req.session.employee) {
      return res.status(401).json({ success: false, error: 'Not logged in' });
    }

    const employeeId = req.session.employee.id;

    const result = await pool.query(
      `SELECT s.*, e.name as employee_name
       FROM shifts s
       JOIN employees e ON s.employee_id = e.id
       WHERE s.employee_id = $1 AND s.status = $2`,
      [employeeId, 'active']
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, shift: null });
    }

    // Get running totals for the shift
    const salesResult = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as order_count
       FROM orders
       WHERE shift_id = $1`,
      [result.rows[0].id]
    );

    res.json({
      success: true,
      shift: {
        ...result.rows[0],
        running_total: parseFloat(salesResult.rows[0].total_sales),
        cash_sales: parseFloat(salesResult.rows[0].cash_sales),
        order_count: parseInt(salesResult.rows[0].order_count)
      }
    });
  } catch (error) {
    console.error('Error fetching current shift:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch current shift' });
  }
});

// GET /api/shifts/:id/report - Get comprehensive shift report
router.get('/:id/report', async (req, res) => {
  try {
    if (!req.session || !req.session.employee) {
      return res.status(401).json({ success: false, error: 'Not logged in' });
    }

    const { id } = req.params;
    const employee = req.session.employee;

    // Get shift
    const shiftResult = await pool.query(
      `SELECT s.*, e.name as employee_name
       FROM shifts s
       JOIN employees e ON s.employee_id = e.id
       WHERE s.id = $1`,
      [id]
    );

    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shift not found' });
    }

    const shift = shiftResult.rows[0];

    // Check access - own shift or manager/admin
    if (shift.employee_id !== employee.id && !['admin', 'manager'].includes(employee.role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get sales breakdown by payment method
    const methodResult = await pool.query(
      `SELECT
        payment_method,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total
       FROM orders
       WHERE shift_id = $1
       GROUP BY payment_method`,
      [id]
    );

    // Get sales breakdown by service type
    const serviceResult = await pool.query(
      `SELECT
        service_type,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total
       FROM orders
       WHERE shift_id = $1
       GROUP BY service_type`,
      [id]
    );

    // Get top selling items
    const itemsResult = await pool.query(
      `SELECT
        oi.product_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.subtotal) as total_revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.shift_id = $1
       GROUP BY oi.product_name
       ORDER BY total_quantity DESC
       LIMIT 10`,
      [id]
    );

    // Get all orders for the shift
    const ordersResult = await pool.query(
      `SELECT id, order_number, total_amount, payment_method, service_type, created_at
       FROM orders
       WHERE shift_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    const salesByMethod = {};
    let totalSales = 0;
    let totalOrders = 0;
    methodResult.rows.forEach(row => {
      salesByMethod[row.payment_method] = {
        count: parseInt(row.order_count),
        total: parseFloat(row.total)
      };
      totalSales += parseFloat(row.total);
      totalOrders += parseInt(row.order_count);
    });

    const salesByService = {};
    serviceResult.rows.forEach(row => {
      salesByService[row.service_type || 'dine-in'] = {
        count: parseInt(row.order_count),
        total: parseFloat(row.total)
      };
    });

    res.json({
      success: true,
      report: {
        shift: {
          id: shift.id,
          employee_name: shift.employee_name,
          start_time: shift.start_time,
          end_time: shift.end_time,
          status: shift.status
        },
        cash_drawer: {
          opening_cash: parseFloat(shift.opening_cash),
          closing_cash: shift.closing_cash ? parseFloat(shift.closing_cash) : null,
          expected_cash: shift.expected_cash ? parseFloat(shift.expected_cash) : null,
          variance: shift.cash_variance ? parseFloat(shift.cash_variance) : null
        },
        sales: {
          total: totalSales,
          order_count: totalOrders,
          by_payment_method: salesByMethod,
          by_service_type: salesByService
        },
        top_items: itemsResult.rows.map(item => ({
          name: item.product_name,
          quantity: parseInt(item.total_quantity),
          revenue: parseFloat(item.total_revenue)
        })),
        orders: ordersResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching shift report:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch shift report' });
  }
});

// GET /api/shifts - List shifts (with filters)
router.get('/', async (req, res) => {
  try {
    if (!req.session || !req.session.employee) {
      return res.status(401).json({ success: false, error: 'Not logged in' });
    }

    const employee = req.session.employee;
    const { employee_id, status, start_date, end_date, limit = 50 } = req.query;

    let query = `
      SELECT s.*, e.name as employee_name,
        (SELECT COUNT(*) FROM orders WHERE shift_id = s.id) as order_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE shift_id = s.id) as total_sales
      FROM shifts s
      JOIN employees e ON s.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    // Non-admin/manager can only see their own shifts
    if (!['admin', 'manager'].includes(employee.role)) {
      params.push(employee.id);
      query += ` AND s.employee_id = $${params.length}`;
    } else if (employee_id) {
      params.push(employee_id);
      query += ` AND s.employee_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND s.start_time >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND s.start_time <= $${params.length}`;
    }

    query += ` ORDER BY s.start_time DESC`;

    params.push(limit);
    query += ` LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      shifts: result.rows.map(shift => ({
        ...shift,
        order_count: parseInt(shift.order_count),
        total_sales: parseFloat(shift.total_sales)
      }))
    });
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch shifts' });
  }
});

export default router;
