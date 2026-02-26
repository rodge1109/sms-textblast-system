import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

const DEFAULT_SHEET_ID = '1_H-OIoLXyxbGsr7gezxc2AbpnUEaVidb-WRjTGFXRfQ';
const DEFAULT_TAB_NAME = 'LatestBill';

function getWriteSheets() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set in .env');
  }

  const key = JSON.parse(credentials);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// GET /api/sheets/latest-bill
// Returns { success, headers, rows } from the LatestBill tab
router.get('/latest-bill', async (req, res) => {
  try {
    const targetSheetId = process.env.GOOGLE_LATEST_BILL_SHEET_ID || DEFAULT_SHEET_ID;
    const targetTabName = process.env.GOOGLE_LATEST_BILL_TAB || DEFAULT_TAB_NAME;

    const sheets = getWriteSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSheetId,
      range: targetTabName,
    });

    const values = response.data.values || [];
    if (values.length === 0) {
      return res.json({ success: true, headers: [], rows: [] });
    }

    const [headers, ...rows] = values;
    return res.json({ success: true, headers, rows });
  } catch (err) {
    console.error('LatestBill read error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sheets/latest-bill/replace
// Body: { headers: string[], rows: string[][], spreadsheetId?: string, tabName?: string }
router.post('/latest-bill/replace', async (req, res) => {
  try {
    const { headers, rows, spreadsheetId, tabName } = req.body || {};

    if (!Array.isArray(headers) || headers.length === 0) {
      return res.status(400).json({ success: false, error: 'headers must be a non-empty array.' });
    }
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, error: 'rows must be an array.' });
    }

    const targetSheetId = spreadsheetId || process.env.GOOGLE_LATEST_BILL_SHEET_ID || DEFAULT_SHEET_ID;
    const targetTabName = tabName || process.env.GOOGLE_LATEST_BILL_TAB || DEFAULT_TAB_NAME;

    const normalizedHeaders = headers.map((h) => (h == null ? '' : String(h)));
    const normalizedRows = rows.map((row) => {
      if (!Array.isArray(row)) return normalizedHeaders.map(() => '');
      return normalizedHeaders.map((_, idx) => (row[idx] == null ? '' : String(row[idx])));
    });

    const values = [normalizedHeaders, ...normalizedRows];

    const sheets = getWriteSheets();

    // Full replace: clear tab, then write headers + latest rows from A1.
    await sheets.spreadsheets.values.clear({
      spreadsheetId: targetSheetId,
      range: targetTabName,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSheetId,
      range: `${targetTabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return res.json({
      success: true,
      sheetId: targetSheetId,
      tabName: targetTabName,
      rowsWritten: normalizedRows.length,
    });
  } catch (err) {
    console.error('LatestBill replace error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
