import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config/env.js';
import { errorHandler } from './middlewares/error.middleware.js';

// Route imports
import authRoutes from './api/auth.routes.js';
import profileRoutes from './api/profile.routes.js';
import incomeRoutes from './api/income.routes.js';
import taxInputRoutes from './api/taxInput.routes.js';
import expenseRoutes from './api/expense.routes.js';
import assetsRoutes from './api/assets.routes.js';
import insuranceRoutes from './api/insurance.routes.js';
import liabilitiesRoutes from './api/liabilities.routes.js';
import goalsRoutes from './api/goals.routes.js';
import mfRoutes from './api/mf.routes.js';
import analysisRoutes from './api/analysis.routes.js';
import reportRoutes from './api/report.routes.js';
import documentsRoutes from './api/documents.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allows vanilla JS ES modules and local styling
}));

app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

app.use(cookieParser(config.cookieSecret));
app.use(express.json({ limit: '1mb' }));

// Assign unique request ID
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Rate limiting for auth and analysis endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' }
  }
});

const analysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many analysis requests. Please slow down.' }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    data: {
      status: 'healthy',
      engineVersion: config.engineVersion,
      environment: config.env,
      timestamp: new Date().toISOString()
    },
    error: null,
    meta: { requestId: req.id }
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/tax-inputs', taxInputRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/liabilities', liabilitiesRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/mf', mfRoutes);
app.use('/api/analysis', analysisLimiter, analysisRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/documents', documentsRoutes);

// Static frontend delivery
const frontendPublic = path.resolve(__dirname, '../../frontend/public');
const frontendAssets = path.resolve(__dirname, '../../frontend/assets');

app.use('/assets', express.static(frontendAssets));
app.use(express.static(frontendPublic));

// Fallback to index.html for unknown HTML navigations
app.get('*', (req, res, next) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(frontendPublic, 'index.html'));
  } else {
    res.status(404).json({
      data: null,
      error: { code: 'NOT_FOUND', message: 'The requested API route was not found.' },
      meta: { requestId: req.id }
    });
  }
});

// Centralized error handler
app.use(errorHandler);

export default app;
