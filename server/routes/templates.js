import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_FILE = path.resolve(__dirname, '../sms-templates.json');

// GET /api/templates
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(TEMPLATES_FILE)) return res.json({});
    const data = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to read templates.' });
  }
});

// POST /api/templates
router.post('/', (req, res) => {
  try {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save templates.' });
  }
});

export default router;
