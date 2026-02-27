import express from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_FILE = path.resolve(__dirname, '../sms-logs.json');

function writeActivityLog(user, action) {
  try {
    const logs = fs.existsSync(LOGS_FILE)
      ? JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'))
      : [];
    logs.unshift({ type: 'activity', user, logCode: action, created: new Date().toISOString(), sent: null, failed: null });
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch { /* non-critical */ }
}

// POST /api/auth/login - Employee login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt for:', username);

    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    // Find employee by username
    const result = await pool.query(
      'SELECT * FROM employees WHERE username = $1 AND active = true',
      [username.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const employee = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, employee.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    // Store employee in session (exclude password hash)
    req.session.employee = {
      id: employee.id,
      username: employee.username,
      name: employee.name,
      role: employee.role
    };

    // Force session save before responding so it's in DB for next request
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ success: false, error: 'Session save failed: ' + err.message });
      }
      writeActivityLog(employee.name, 'Login');
      res.json({ success: true, employee: req.session.employee });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// POST /api/auth/logout - Employee logout
router.post('/logout', (req, res) => {
  const name = req.session?.employee?.name || 'Unknown';
  writeActivityLog(name, 'Logout');
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.clearCookie('pos_session');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// GET /api/auth/me - Get current logged in employee
router.get('/me', (req, res) => {
  if (!req.session || !req.session.employee) {
    return res.status(401).json({ success: false, error: 'Not logged in' });
  }

  res.json({
    success: true,
    employee: req.session.employee
  });
});

// POST /api/auth/change-password - Change password
router.post('/change-password', async (req, res) => {
  try {
    if (!req.session || !req.session.employee) {
      return res.status(401).json({ success: false, error: 'Not logged in' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    // Get current employee
    const result = await pool.query(
      'SELECT * FROM employees WHERE id = $1',
      [req.session.employee.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const employee = result.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, employee.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query(
      'UPDATE employees SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, req.session.employee.id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

// GET /api/auth/employees - Get all employees (admin only)
router.get('/employees', async (req, res) => {
  try {
    if (!req.session || !req.session.employee) {
      return res.status(401).json({ success: false, error: 'Not logged in' });
    }

    if (req.session.employee.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const result = await pool.query(
      'SELECT id, username, name, email, role, active, created_at FROM employees ORDER BY name'
    );

    res.json({ success: true, employees: result.rows });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employees' });
  }
});

// POST /api/auth/employees - Create new employee (admin only)
router.post('/employees', async (req, res) => {
  try {
    if (!req.session || !req.session.employee) {
      return res.status(401).json({ success: false, error: 'Not logged in' });
    }

    if (req.session.employee.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { username, password, name, email, role } = req.body;

    if (!username || !password || !name || !role) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    if (!['admin', 'manager', 'cashier'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    // Check if username exists
    const existingUser = await pool.query(
      'SELECT id FROM employees WHERE username = $1',
      [username.toLowerCase().trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO employees (username, password_hash, name, email, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, name, email, role, active, created_at`,
      [username.toLowerCase().trim(), passwordHash, name, email || null, role]
    );

    res.status(201).json({ success: true, employee: result.rows[0] });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ success: false, error: 'Failed to create employee' });
  }
});

// PUT /api/auth/employees/:id - Update employee (admin only)
router.put('/employees/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.employee) {
      return res.status(401).json({ success: false, error: 'Not logged in' });
    }

    if (req.session.employee.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;
    const { name, email, role, active, password } = req.body;

    let query = 'UPDATE employees SET name = $1, email = $2, role = $3, active = $4, updated_at = CURRENT_TIMESTAMP';
    let params = [name, email || null, role, active];

    // If password provided, update it too
    if (password) {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      query += ', password_hash = $5 WHERE id = $6 RETURNING id, username, name, email, role, active';
      params.push(passwordHash, id);
    } else {
      query += ' WHERE id = $5 RETURNING id, username, name, email, role, active';
      params.push(id);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    res.json({ success: true, employee: result.rows[0] });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ success: false, error: 'Failed to update employee' });
  }
});

export default router;
