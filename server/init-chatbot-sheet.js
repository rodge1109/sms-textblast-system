import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SHEET_ID = '1_H-OIoLXyxbGsr7gezxc2AbpnUEaVidb-WRjTGFXRfQ';
const TAB_NAME = 'KeywordsDM';
const HEADERS = ['keywords', 'replies', 'followup1', 'followup2', 'followup3'];

const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const auth = new google.auth.GoogleAuth({
  credentials: key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

await sheets.spreadsheets.values.update({
  spreadsheetId: SHEET_ID,
  range: `${TAB_NAME}!A1`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [HEADERS] },
});

console.log('Headers set:', HEADERS.join(', '));
