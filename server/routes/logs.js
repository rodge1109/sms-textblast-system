import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_FILE = path.resolve(__dirname, '../sms-logs.json');

function readLogs() {
  if (!fs.existsSync(LOGS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8')); } catch { return []; }
}

// GET /api/logs
router.get('/', (req, res) => {
  res.json(readLogs());
});

// POST /api/logs  — add a log entry
router.post('/', (req, res) => {
  try {
    const logs = readLogs();
    const entry = {
      user:    req.body.user    || 'System',
      logCode: req.body.logCode || '',
      created: new Date().toISOString(),
      sent:    req.body.sent    ?? null,
      failed:  req.body.failed  ?? null,
    };
    logs.unshift(entry); // newest first
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to write log.' });
  }
});

export default router;
