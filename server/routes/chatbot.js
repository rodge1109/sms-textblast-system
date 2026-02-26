import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

const SHEET_ID = '1_H-OIoLXyxbGsr7gezxc2AbpnUEaVidb-WRjTGFXRfQ';
const TAB_NAME = 'KeywordsDM';

// Auth for writes — needs GOOGLE_SERVICE_ACCOUNT_JSON in .env
function getWriteSheets() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set in .env — required for add/edit/delete.');
  const key = JSON.parse(credentials);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// Auth for reads — uses API key (sheet must be publicly readable)
function getReadSheets() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) {
    return google.sheets({ version: 'v4', auth: apiKey });
  }
  // Fall back to service account if no API key
  return getWriteSheets();
}

// GET /api/chatbot — fetch all rows
router.get('/', async (req, res) => {
  try {
    const sheets = getReadSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: TAB_NAME,
    });
    const [headers = [], ...rows] = response.data.values || [];
    const data = rows.map((row, i) => {
      const obj = { _row: i + 2 };
      headers.forEach((h, j) => { obj[h] = row[j] ?? ''; });
      return obj;
    });
    res.json({ success: true, headers, data });
  } catch (err) {
    console.error('Chatbot GET error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/chatbot — append a row
router.post('/', async (req, res) => {
  try {
    const { values } = req.body;
    const sheets = getWriteSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: TAB_NAME,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Chatbot POST error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/chatbot/:row — update a row
router.put('/:row', async (req, res) => {
  try {
    const { row } = req.params;
    const { values } = req.body;
    const sheets = getWriteSheets();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB_NAME}!A${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Chatbot PUT error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/chatbot/:row — delete a row
router.delete('/:row', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.row, 10) - 1;
    const sheets = getWriteSheets();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheet = meta.data.sheets.find(s => s.properties.title === TAB_NAME);
    const sheetId = sheet.properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        }],
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Chatbot DELETE error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
