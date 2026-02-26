import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Generate order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

// GET all orders
router.get('/', async (req, res) => {
  try {
    const { order_type, status, include_adjustments, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT o.*, c.name as customer_name, c.phone as customer_phone,
        (SELECT COUNT(*) FROM order_item_adjustments WHERE order_id = o.id) as adjustment_count
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (order_type) {
      params.push(order_type);
      query += ` AND o.order_type = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND o.order_status = $${params.length}`;
    }

    if (include_adjustments === 'true') {
      query += ` AND (o.order_status IN ('refunded', 'voided') OR EXISTS (SELECT 1 FROM order_item_adjustments WHERE order_id = o.id))`;
    }

    query += ` ORDER BY o.created_at DESC`;

    params.push(limit);
    query += ` LIMIT $${params.length}`;

    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    res.json({ success: true, orders: result.rows });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// GET kitchen orders (with items, for KDS)
router.get('/kitchen', async (req, res) => {
  try {
    const ordersResult = await pool.query(`
      SELECT o.*, c.name as customer_name, c.phone as customer_phone,
             t.table_number
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.order_status IN ('received', 'preparing', 'open')
      ORDER BY
        CASE o.order_status WHEN 'received' THEN 1 WHEN 'open' THEN 2 WHEN 'preparing' THEN 3 END,
        o.created_at ASC
    `);

    // Fetch items for all these orders in one query
    const orderIds = ordersResult.rows.map(o => o.id);
    let itemsMap = {};
    if (orderIds.length > 0) {
      const itemsResult = await pool.query(
        `SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id`,
        [orderIds]
      );
      for (const item of itemsResult.rows) {
        if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
        itemsMap[item.order_id].push(item);
      }
    }

    const orders = ordersResult.rows.map(order => ({
      ...order,
      items: itemsMap[order.id] || []
    }));

    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching kitchen orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch kitchen orders' });
  }
});

// GET single order with items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      `SELECT o.*, c.name as customer_name, c.email as customer_email,
              c.phone as customer_phone, c.address as customer_address,
              c.city as customer_city, c.barangay as customer_barangay
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id]
    );

    res.json({
      success: true,
      order: {
        ...orderResult.rows[0],
        items: itemsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// POST create order
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      customer,
      customer_id,
      items,
      subtotal,
      delivery_fee = 0,
      tax_amount,
      total_amount,
      payment_method,
      payment_reference,
      payment_status,
      order_type = 'online',
      service_type = 'dine-in',
      shift_id: providedShiftId
    } = req.body;

    await client.query('BEGIN');

    // For POS orders, auto-detect active shift if not provided
    let shiftId = providedShiftId || null;
    if (order_type === 'pos' && !shiftId && req.session && req.session.employee) {
      const shiftResult = await client.query(
        'SELECT id FROM shifts WHERE employee_id = $1 AND status = $2',
        [req.session.employee.id, 'active']
      );
      if (shiftResult.rows.length > 0) {
        shiftId = shiftResult.rows[0].id;
      }
    }

    // Use customer_id if provided directly (from POS), otherwise create/find from customer object
    let customerId = customer_id || null;

    // Create or find customer (for online orders)
    if (!customerId && customer && customer.name) {
      // Check if customer exists by email or phone
      let existingCustomer = null;
      if (customer.email) {
        const result = await client.query(
          'SELECT id FROM customers WHERE email = $1',
          [customer.email]
        );
        if (result.rows.length > 0) {
          existingCustomer = result.rows[0];
        }
      }
      if (!existingCustomer && customer.phone) {
        const result = await client.query(
          'SELECT id FROM customers WHERE phone = $1',
          [customer.phone]
        );
        if (result.rows.length > 0) {
          existingCustomer = result.rows[0];
        }
      }

      if (existingCustomer) {
        // Update existing customer
        await client.query(
          `UPDATE customers SET name = $1, phone = $2, address = $3, city = $4, barangay = $5, player_id = $6
           WHERE id = $7`,
          [customer.name, customer.phone, customer.address, customer.city, customer.barangay, customer.player_id, existingCustomer.id]
        );
        customerId = existingCustomer.id;
      } else {
        // Create new customer
        const customerResult = await client.query(
          `INSERT INTO customers (name, email, phone, address, city, barangay, player_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [customer.name, customer.email, customer.phone, customer.address, customer.city, customer.barangay, customer.player_id]
        );
        customerId = customerResult.rows[0].id;
      }
    }

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, customer_id, subtotal, delivery_fee, tax_amount, total_amount, payment_method, payment_reference, payment_status, order_status, order_type, service_type, shift_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        orderNumber,
        customerId,
        subtotal,
        delivery_fee,
        tax_amount,
        total_amount,
        payment_method,
        payment_reference || null,
        payment_status || (payment_method === 'cash' ? 'pending' : 'paid'),
        'received',
        order_type,
        service_type,
        shiftId
      ]
    );

    const order = orderResult.rows[0];

    // Insert order items and deduct stock
    for (const item of items) {
      const isCombo = item.isCombo || (typeof item.id === 'string' && item.id.startsWith('combo-'));
      let productId = null;
      let comboId = null;

      if (isCombo) {
        // Extract numeric combo ID from "combo-1" format or use direct ID
        comboId = typeof item.id === 'string' && item.id.startsWith('combo-')
          ? parseInt(item.id.replace('combo-', ''))
          : item.id;

        // Deduct stock for each product in the combo
        const comboItemsResult = await client.query(
          'SELECT product_id, quantity FROM combo_items WHERE combo_id = $1',
          [comboId]
        );
        for (const comboItem of comboItemsResult.rows) {
          await client.query(
            `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - $1) WHERE id = $2`,
            [comboItem.quantity * item.quantity, comboItem.product_id]
          );
        }
      } else {
        productId = item.product_id || item.id;

        // Deduct stock for the product
        await client.query(
          `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - $1) WHERE id = $2`,
          [item.quantity, productId]
        );
      }

      await client.query(
        `INSERT INTO order_items (order_id, product_id, combo_id, is_combo, product_name, size_name, quantity, unit_price, subtotal, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          order.id,
          productId,
          comboId,
          isCombo,
          item.name || item.product_name,
          item.selectedSize || item.size_name || null,
          item.quantity,
          item.price || item.unit_price,
          (item.price || item.unit_price) * item.quantity,
          item.notes || null
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      orderNumber: order.order_number,
      order
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// PUT update order status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { order_status, payment_status } = req.body;

    const updates = [];
    const params = [];

    if (order_status) {
      params.push(order_status);
      updates.push(`order_status = $${params.length}`);
    }

    if (payment_status) {
      params.push(payment_status);
      updates.push(`payment_status = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const updatedOrder = result.rows[0];

    // Send push notification to customer when order is ready
    if (order_status === 'completed' && updatedOrder.customer_id) {
      try {
        const customerResult = await pool.query(
          'SELECT player_id, name FROM customers WHERE id = $1',
          [updatedOrder.customer_id]
        );
        const customer = customerResult.rows[0];
        if (customer && customer.player_id) {
          const notifResponse = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`
            },
            body: JSON.stringify({
              app_id: process.env.ONESIGNAL_APP_ID,
              include_player_ids: [customer.player_id],
              headings: { en: 'Your order is ready!' },
              contents: { en: `Order ${updatedOrder.order_number} is ready for ${updatedOrder.service_type === 'pick-up' ? 'pickup' : 'serving'}. Thank you!` }
            })
          });
          const notifResult = await notifResponse.json();
          console.log('Push notification sent:', notifResult.id || 'sent');
        }
      } catch (notifError) {
        console.error('Error sending push notification:', notifError.message);
      }
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, error: 'Failed to update order' });
  }
});

// POST void or comp an order item
router.post('/:orderId/items/:itemId/adjust', async (req, res) => {
  const client = await pool.connect();
  try {
    const { orderId, itemId } = req.params;
    const { type, reason, created_by } = req.body;

    if (!['void', 'comp'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be void or comp' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Reason is required' });
    }

    await client.query('BEGIN');

    // Get the order item
    const itemResult = await client.query(
      'SELECT * FROM order_items WHERE id = $1 AND order_id = $2',
      [itemId, orderId]
    );
    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Order item not found' });
    }
    const item = itemResult.rows[0];
    if (item.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: `Item is already ${item.status}` });
    }

    // Update item status
    const newStatus = type === 'void' ? 'voided' : 'comped';
    await client.query(
      'UPDATE order_items SET status = $1 WHERE id = $2',
      [newStatus, itemId]
    );

    // Record the adjustment
    await client.query(
      `INSERT INTO order_item_adjustments (order_item_id, order_id, adjustment_type, reason, original_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [itemId, orderId, type, reason.trim(), item.subtotal, created_by || 'POS']
    );

    // Restore stock if voiding
    if (type === 'void' && item.product_id) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Recalculate order totals (exclude voided items, comped items count as $0)
    const totalsResult = await client.query(
      `SELECT COALESCE(SUM(CASE WHEN status = 'active' THEN subtotal ELSE 0 END), 0) as subtotal
       FROM order_items WHERE order_id = $1 AND status != 'voided'`,
      [orderId]
    );
    const newSubtotal = parseFloat(totalsResult.rows[0].subtotal);
    const newTax = newSubtotal * 0.08;
    const newTotal = newSubtotal + newTax;

    await client.query(
      'UPDATE orders SET subtotal = $1, tax_amount = $2, total_amount = $3 WHERE id = $4',
      [newSubtotal, newTax, newTotal, orderId]
    );

    await client.query('COMMIT');

    // Return updated order with items
    const updatedOrder = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const orderItems = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);

    res.json({
      success: true,
      order: { ...updatedOrder.rows[0], items: orderItems.rows }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adjusting order item:', error);
    res.status(500).json({ success: false, error: 'Failed to adjust order item' });
  } finally {
    client.release();
  }
});

// GET adjustments for an order (audit trail)
router.get('/:id/adjustments', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT a.*, oi.product_name, oi.size_name, oi.quantity, oi.unit_price
       FROM order_item_adjustments a
       JOIN order_items oi ON a.order_item_id = oi.id
       WHERE a.order_id = $1
       ORDER BY a.created_at DESC`,
      [id]
    );
    res.json({ success: true, adjustments: result.rows });
  } catch (error) {
    console.error('Error fetching adjustments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch adjustments' });
  }
});

export default router;
