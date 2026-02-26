import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import customersRoutes from './routes/customers.js';
import combosRoutes from './routes/combos.js';
import authRoutes from './routes/auth.js';
import shiftsRoutes from './routes/shifts.js';
import tablesRoutes from './routes/tables.js';
import smsRoutes from './routes/sms.js';
import templatesRoutes from './routes/templates.js';
import logsRoutes from './routes/logs.js';
import chatbotRoutes from './routes/chatbot.js';
import sheetsRoutes from './routes/sheets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // Allow localhost on any port for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    callback(null, true); // Allow all origins in development
  },
  credentials: true
}));
app.use(express.json());

// Session middleware
app.use(session({
  name: 'pos_session',
  secret: process.env.SESSION_SECRET || 'restaurant-pos-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/combos', combosRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/sheets', sheetsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Something went wrong!' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`Port ${PORT} in use — killing old process and retrying...`);
    try {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id \\$_ -Force -ErrorAction SilentlyContinue }"`,
        { stdio: 'ignore' }
      );
    } catch { /* ignore */ }
    setTimeout(() => server.listen(PORT), 1000);
  } else {
    console.error('HTTP server error:', err);
  }
});

