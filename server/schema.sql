-- Restaurant Ordering System Database Schema
-- Run this file to create all required tables

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10,2),
  description TEXT,
  image VARCHAR(500),
  popular BOOLEAN DEFAULT false,
  barcode VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for barcode lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Product Sizes Table (for items like Pizza with Small/Medium/Large)
CREATE TABLE IF NOT EXISTS product_sizes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  size_name VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50) UNIQUE NOT NULL,
  pin VARCHAR(6) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  barangay VARCHAR(100),
  credit_balance DECIMAL(10,2) DEFAULT 0,
  credit_limit DECIMAL(10,2) DEFAULT 1000,
  player_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Ledger Table (tracks all credit transactions)
CREATE TABLE IF NOT EXISTS customer_ledger (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id),
  transaction_type VARCHAR(50) NOT NULL, -- 'credit_purchase', 'payment', 'adjustment'
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_by VARCHAR(100), -- staff name or 'self'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for customer lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_id ON customer_ledger(customer_id);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_reference VARCHAR(255),
  payment_status VARCHAR(50) DEFAULT 'pending',
  order_status VARCHAR(50) DEFAULT 'received',
  order_type VARCHAR(50) DEFAULT 'online',
  parent_order_id INTEGER REFERENCES orders(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  combo_id INTEGER REFERENCES combos(id),
  is_combo BOOLEAN DEFAULT false,
  product_name VARCHAR(255) NOT NULL,
  size_name VARCHAR(50),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active'
);

-- Combos Table (meal deals / combo items)
CREATE TABLE IF NOT EXISTS combos (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image VARCHAR(500),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Combo Items Table (products included in each combo)
CREATE TABLE IF NOT EXISTS combo_items (
  id SERIAL PRIMARY KEY,
  combo_id INTEGER REFERENCES combos(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  size_name VARCHAR(50)
);

-- Order Item Adjustments Table (void/comp tracking)
CREATE TABLE IF NOT EXISTS order_item_adjustments (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  original_amount DECIMAL(10,2) NOT NULL,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Payments Table (split payment tracking)
CREATE TABLE IF NOT EXISTS order_payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  payment_method VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_combo_items_combo_id ON combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Insert sample products (matching the existing fallback data)
INSERT INTO products (name, category, price, description, image, popular) VALUES
  ('Margherita Pizza', 'Pizza', NULL, 'Classic tomato sauce, mozzarella, fresh basil', 'assets/images/food/pepperoni.png', true),
  ('Pepperoni Pizza', 'Pizza', NULL, 'Loaded with pepperoni and mozzarella', 'assets/images/food/burgerpizza.png', true),
  ('BBQ Chicken Pizza', 'Pizza', NULL, 'BBQ sauce, grilled chicken, red onions', 'assets/images/food/pepperoni.png', false),
  ('Veggie Supreme', 'Pizza', NULL, 'Mushrooms, peppers, olives, onions', 'assets/images/food/pepperoni.png', false),
  ('Classic Burger', 'Burgers', 9.99, 'Beef patty, lettuce, tomato, cheese', 'assets/images/food/pepperoni.png', true),
  ('Bacon Cheeseburger', 'Burgers', 11.99, 'Double beef, bacon, cheddar cheese', 'assets/images/food/pepperoni.png', true),
  ('Veggie Burger', 'Burgers', 10.99, 'Plant-based patty, avocado, sprouts', 'assets/images/food/pepperoni.png', false),
  ('Chicken Burger', 'Burgers', 10.49, 'Grilled chicken breast, mayo, lettuce', 'assets/images/food/pepperoni.png', false),
  ('Spaghetti Carbonara', 'Pasta', 13.99, 'Creamy sauce, bacon, parmesan', 'assets/images/food/pepperoni.png', true),
  ('Penne Arrabiata', 'Pasta', 12.49, 'Spicy tomato sauce, garlic, herbs', 'assets/images/food/pepperoni.png', false),
  ('Fettuccine Alfredo', 'Pasta', 13.49, 'Rich cream sauce, parmesan cheese', 'assets/images/food/pepperoni.png', true),
  ('Lasagna', 'Pasta', 14.99, 'Layered pasta, beef, ricotta, mozzarella', 'assets/images/food/pepperoni.png', false),
  ('Caesar Salad', 'Salads', 8.99, 'Romaine, croutons, parmesan, caesar dressing', 'assets/images/food/pepperoni.png', true),
  ('Greek Salad', 'Salads', 9.49, 'Feta, olives, cucumber, tomatoes', 'assets/images/food/pepperoni.png', false),
  ('Caprese Salad', 'Salads', 10.99, 'Fresh mozzarella, tomatoes, basil', 'assets/images/food/pepperoni.png', false),
  ('Coca Cola', 'Drinks', 2.99, 'Classic cola, 500ml', 'assets/images/food/pepperoni.png', true),
  ('Fresh Lemonade', 'Drinks', 3.49, 'Freshly squeezed lemon juice', 'assets/images/food/pepperoni.png', true),
  ('Iced Tea', 'Drinks', 2.99, 'Peach iced tea', 'assets/images/food/pepperoni.png', false),
  ('Chocolate Cake', 'Desserts', 6.99, 'Rich chocolate layer cake', 'assets/images/food/pepperoni.png', true),
  ('Tiramisu', 'Desserts', 7.49, 'Italian coffee-flavored dessert', 'assets/images/food/pepperoni.png', true)
ON CONFLICT DO NOTHING;

-- Insert pizza sizes
INSERT INTO product_sizes (product_id, size_name, price) VALUES
  (1, 'Small', 10.99), (1, 'Medium', 12.99), (1, 'Large', 15.99),
  (2, 'Small', 12.99), (2, 'Medium', 14.99), (2, 'Large', 17.99),
  (3, 'Small', 13.99), (3, 'Medium', 15.99), (3, 'Large', 18.99),
  (4, 'Small', 11.99), (4, 'Medium', 13.99), (4, 'Large', 16.99)
ON CONFLICT DO NOTHING;
