import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// GET all products with sizes
// Use ?all=true to include inactive products (for management)
router.get('/', async (req, res) => {
  try {
    const { all } = req.query;

    // Get products (filter by active unless ?all=true)
    const productsResult = await pool.query(
      all === 'true'
        ? 'SELECT * FROM products ORDER BY category, name'
        : 'SELECT * FROM products WHERE active = true ORDER BY category, name'
    );

    // Get all sizes
    const sizesResult = await pool.query(
      'SELECT * FROM product_sizes ORDER BY product_id, price'
    );

    // Map sizes to products
    const products = productsResult.rows.map(product => {
      const sizes = sizesResult.rows
        .filter(size => size.product_id === product.id)
        .map(size => ({
          name: size.size_name,
          price: parseFloat(size.price)
        }));

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price ? parseFloat(product.price) : null,
        sizes: sizes.length > 0 ? sizes : null,
        description: product.description,
        image: product.image,
        popular: product.popular,
        barcode: product.barcode,
        active: product.active,
        stock_quantity: product.stock_quantity || 0,
        low_stock_threshold: product.low_stock_threshold || 10
      };
    });

    // Count low stock items
    const lowStockCount = products.filter(p => p.stock_quantity <= p.low_stock_threshold).length;

    res.json({ success: true, products, lowStockCount });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// GET product by barcode
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;

    const productResult = await pool.query(
      'SELECT * FROM products WHERE barcode = $1',
      [barcode]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const product = productResult.rows[0];
    const sizesResult = await pool.query(
      'SELECT * FROM product_sizes WHERE product_id = $1 ORDER BY price',
      [product.id]
    );

    const sizes = sizesResult.rows.map(size => ({
      name: size.size_name,
      price: parseFloat(size.price)
    }));

    res.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price ? parseFloat(product.price) : null,
        sizes: sizes.length > 0 ? sizes : null,
        description: product.description,
        image: product.image,
        popular: product.popular,
        barcode: product.barcode
      }
    });
  } catch (error) {
    console.error('Error fetching product by barcode:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const productResult = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const sizesResult = await pool.query(
      'SELECT * FROM product_sizes WHERE product_id = $1 ORDER BY price',
      [id]
    );

    const product = productResult.rows[0];
    const sizes = sizesResult.rows.map(size => ({
      name: size.size_name,
      price: parseFloat(size.price)
    }));

    res.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price ? parseFloat(product.price) : null,
        sizes: sizes.length > 0 ? sizes : null,
        description: product.description,
        image: product.image,
        popular: product.popular
      }
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

// POST create product
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, category, price, sizes, description, image, popular, barcode, active, stock_quantity, low_stock_threshold } = req.body;

    await client.query('BEGIN');

    const productResult = await client.query(
      `INSERT INTO products (name, category, price, description, image, popular, barcode, active, stock_quantity, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [name, category, price || null, description, image, popular || false, barcode || null, active !== false, stock_quantity || 0, low_stock_threshold || 10]
    );

    const product = productResult.rows[0];

    // Insert sizes if provided
    if (sizes && sizes.length > 0) {
      for (const size of sizes) {
        await client.query(
          'INSERT INTO product_sizes (product_id, size_name, price) VALUES ($1, $2, $3)',
          [product.id, size.name, size.price]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({ success: true, product });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, error: 'Failed to create product' });
  } finally {
    client.release();
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, category, price, sizes, description, image, popular, barcode, active, stock_quantity, low_stock_threshold } = req.body;

    await client.query('BEGIN');

    const productResult = await client.query(
      `UPDATE products
       SET name = $1, category = $2, price = $3, description = $4, image = $5, popular = $6, barcode = $7, active = $8, stock_quantity = $9, low_stock_threshold = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 RETURNING *`,
      [name, category, price || null, description, image, popular || false, barcode || null, active !== false, stock_quantity || 0, low_stock_threshold || 10, id]
    );

    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Delete existing sizes and insert new ones
    await client.query('DELETE FROM product_sizes WHERE product_id = $1', [id]);

    if (sizes && sizes.length > 0) {
      for (const size of sizes) {
        await client.query(
          'INSERT INTO product_sizes (product_id, size_name, price) VALUES ($1, $2, $3)',
          [id, size.name, size.price]
        );
      }
    }

    await client.query('COMMIT');

    res.json({ success: true, product: productResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: 'Failed to update product' });
  } finally {
    client.release();
  }
});

// DELETE product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

// GET low stock products
router.get('/inventory/low-stock', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE stock_quantity <= low_stock_threshold AND active = true ORDER BY stock_quantity ASC'
    );

    const products = result.rows.map(product => ({
      id: product.id,
      name: product.name,
      category: product.category,
      stock_quantity: product.stock_quantity || 0,
      low_stock_threshold: product.low_stock_threshold || 10
    }));

    res.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch low stock products' });
  }
});

// POST adjust stock (add or subtract)
router.post('/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    const result = await pool.query(
      `UPDATE products
       SET stock_quantity = GREATEST(0, stock_quantity + $1), updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [adjustment, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const product = result.rows[0];
    const isLowStock = product.stock_quantity <= product.low_stock_threshold;

    res.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        stock_quantity: product.stock_quantity,
        low_stock_threshold: product.low_stock_threshold,
        isLowStock
      }
    });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(500).json({ success: false, error: 'Failed to adjust stock' });
  }
});

export default router;
