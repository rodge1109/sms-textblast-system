import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

async function resolveCompanyId(req) {
  const explicit =
    req.headers['x-company-id'] ??
    req.query.company_id ??
    req.body?.company_id ??
    process.env.DEFAULT_COMPANY_ID ??
    null;

  if (explicit !== null && explicit !== undefined && String(explicit).trim()) {
    return String(explicit).trim();
  }

  const fallback = await pool.query(
    'SELECT id::text AS id FROM companies ORDER BY id LIMIT 1'
  );
  return fallback.rows[0]?.id || null;
}

// GET categories for current company
router.get('/', async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Valid company_id is required' });
    }

    const all = req.query.all === 'true';
    const result = await pool.query(
      `
      SELECT id, name, company_id
      FROM categories
      WHERE company_id = $1
      ORDER BY name ASC
      `,
      [companyId]
    );

    res.json({ success: true, categories: result.rows, all });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// POST create category for current company
router.post('/', async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Valid company_id is required' });
    }

    const name = (req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const dup = await pool.query(
      `
      SELECT id
      FROM categories
      WHERE company_id = $1 AND LOWER(name) = LOWER($2)
      LIMIT 1
      `,
      [companyId, name]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Category already exists for this company' });
    }

    const result = await pool.query(
      `
      INSERT INTO categories (name, company_id)
      VALUES ($1, $2)
      RETURNING id, name, company_id
      `,
      [name, companyId]
    );

    res.status(201).json({ success: true, category: result.rows[0] });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

export default router;
