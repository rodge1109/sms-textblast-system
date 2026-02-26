import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// GET all customers (with credit info)
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT id, name, email, phone, address, city, barangay,
              credit_balance, credit_limit, created_at
       FROM customers ORDER BY name ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ success: true, customers: result.rows });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
});

// POST register new customer
router.post('/register', async (req, res) => {
  try {
    const { name, phone, pin, email, address, city, barangay } = req.body;

    // Validate required fields
    if (!name || !phone || !pin) {
      return res.status(400).json({ success: false, error: 'Name, phone, and PIN are required' });
    }

    // Validate PIN (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ success: false, error: 'PIN must be 4-6 digits' });
    }

    // Check if phone already exists
    const existing = await pool.query(
      'SELECT id FROM customers WHERE phone = $1',
      [phone]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Phone number already registered' });
    }

    const result = await pool.query(
      `INSERT INTO customers (name, phone, pin, email, address, city, barangay)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, phone, email, credit_balance, credit_limit`,
      [name, phone, pin, email || null, address || null, city || null, barangay || null]
    );

    res.status(201).json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error registering customer:', error);
    res.status(500).json({ success: false, error: 'Failed to register customer' });
  }
});

// POST login customer
router.post('/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ success: false, error: 'Phone and PIN are required' });
    }

    const result = await pool.query(
      `SELECT id, name, phone, email, address, city, barangay, credit_balance, credit_limit
       FROM customers WHERE phone = $1 AND pin = $2`,
      [phone, pin]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid phone or PIN' });
    }

    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error logging in customer:', error);
    res.status(500).json({ success: false, error: 'Failed to login' });
  }
});

// GET customer by phone (for POS lookup)
router.get('/phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    const result = await pool.query(
      `SELECT id, name, phone, email, credit_balance, credit_limit
       FROM customers WHERE phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customer' });
  }
});

// GET single customer with order history and ledger
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const customerResult = await pool.query(
      `SELECT id, name, phone, email, address, city, barangay, credit_balance, credit_limit, created_at
       FROM customers WHERE id = $1`,
      [id]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, customer: customerResult.rows[0] });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customer' });
  }
});

// GET customer order history
router.get('/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const ordersResult = await pool.query(
      `SELECT o.*,
              json_agg(json_build_object(
                'product_name', oi.product_name,
                'size_name', oi.size_name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'subtotal', oi.subtotal
              )) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.customer_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({ success: true, orders: ordersResult.rows });
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// GET customer ledger (credit transactions)
router.get('/:id/ledger', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const ledgerResult = await pool.query(
      `SELECT cl.*, o.order_number
       FROM customer_ledger cl
       LEFT JOIN orders o ON cl.order_id = o.id
       WHERE cl.customer_id = $1
       ORDER BY cl.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({ success: true, ledger: ledgerResult.rows });
  } catch (error) {
    console.error('Error fetching customer ledger:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ledger' });
  }
});

// POST add payment to customer account
router.post('/:id/payment', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { amount, notes, created_by } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }

    await client.query('BEGIN');

    // Get current balance
    const customerResult = await client.query(
      'SELECT credit_balance FROM customers WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (customerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const currentBalance = parseFloat(customerResult.rows[0].credit_balance);
    const newBalance = currentBalance - amount;

    // Update customer balance
    await client.query(
      'UPDATE customers SET credit_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newBalance, id]
    );

    // Record in ledger
    await client.query(
      `INSERT INTO customer_ledger (customer_id, transaction_type, amount, balance_after, notes, created_by)
       VALUES ($1, 'payment', $2, $3, $4, $5)`,
      [id, -amount, newBalance, notes || 'Payment received', created_by || 'POS']
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Payment recorded',
      new_balance: newBalance
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, error: 'Failed to record payment' });
  } finally {
    client.release();
  }
});

// POST add credit adjustment
router.post('/:id/adjustment', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { amount, notes, created_by } = req.body;

    if (amount === undefined || amount === null) {
      return res.status(400).json({ success: false, error: 'Amount is required' });
    }

    await client.query('BEGIN');

    // Get current balance
    const customerResult = await client.query(
      'SELECT credit_balance FROM customers WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (customerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const currentBalance = parseFloat(customerResult.rows[0].credit_balance);
    const newBalance = currentBalance + parseFloat(amount);

    // Update customer balance
    await client.query(
      'UPDATE customers SET credit_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newBalance, id]
    );

    // Record in ledger
    await client.query(
      `INSERT INTO customer_ledger (customer_id, transaction_type, amount, balance_after, notes, created_by)
       VALUES ($1, 'adjustment', $2, $3, $4, $5)`,
      [id, amount, newBalance, notes || 'Balance adjustment', created_by || 'Admin']
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Adjustment recorded',
      new_balance: newBalance
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording adjustment:', error);
    res.status(500).json({ success: false, error: 'Failed to record adjustment' });
  } finally {
    client.release();
  }
});

// POST create customer (legacy, now uses register)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, pin, address, city, barangay, player_id } = req.body;

    // Check if customer already exists by phone
    if (phone) {
      const existing = await pool.query(
        'SELECT * FROM customers WHERE phone = $1',
        [phone]
      );

      if (existing.rows.length > 0) {
        // Update existing customer
        const result = await pool.query(
          `UPDATE customers SET name = $1, email = $2, address = $3, city = $4, barangay = $5,
           player_id = $6, updated_at = CURRENT_TIMESTAMP
           WHERE phone = $7 RETURNING id, name, phone, email, credit_balance, credit_limit`,
          [name, email, address, city, barangay, player_id, phone]
        );
        return res.json({ success: true, customer: result.rows[0], updated: true });
      }
    }

    const result = await pool.query(
      `INSERT INTO customers (name, email, phone, pin, address, city, barangay, player_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, phone, email, credit_balance, credit_limit`,
      [name, email, phone, pin || '0000', address, city, barangay, player_id]
    );

    res.status(201).json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, error: 'Failed to create customer' });
  }
});

// PUT update customer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, city, barangay, credit_limit, player_id } = req.body;

    const result = await pool.query(
      `UPDATE customers SET name = $1, email = $2, phone = $3, address = $4, city = $5,
       barangay = $6, credit_limit = $7, player_id = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING id, name, phone, email, credit_balance, credit_limit`,
      [name, email, phone, address, city, barangay, credit_limit, player_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ success: false, error: 'Failed to update customer' });
  }
});

// PUT update customer PIN
router.put('/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    const { old_pin, new_pin } = req.body;

    if (!/^\d{4,6}$/.test(new_pin)) {
      return res.status(400).json({ success: false, error: 'PIN must be 4-6 digits' });
    }

    // Verify old PIN
    const customer = await pool.query(
      'SELECT pin FROM customers WHERE id = $1',
      [id]
    );

    if (customer.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    if (customer.rows[0].pin !== old_pin) {
      return res.status(401).json({ success: false, error: 'Incorrect current PIN' });
    }

    await pool.query(
      'UPDATE customers SET pin = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [new_pin, id]
    );

    res.json({ success: true, message: 'PIN updated successfully' });
  } catch (error) {
    console.error('Error updating PIN:', error);
    res.status(500).json({ success: false, error: 'Failed to update PIN' });
  }
});

export default router;
