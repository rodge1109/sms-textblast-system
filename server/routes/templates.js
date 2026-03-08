import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// GET /api/templates
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM sms_templates');
    const data = {};
    result.rows.forEach(row => { data[row.key] = row.value; });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read templates.' });
  }
});

// POST /api/templates
router.post('/', async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO sms_templates (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save templates.' });
  }
});

export default router;
