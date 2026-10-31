import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase } from './db/database.ts';
import { ensureDefaultUserAndBusiness } from './db/seed.ts';

import authRoutes from './routes/auth.ts';
import dashboardRoutes from './routes/dashboard.ts';
import inventoryRoutes from './routes/inventory.ts';
import orderRoutes from './routes/orders.ts';
import customerRoutes from './routes/customers.ts';
import analyticsRoutes from './routes/analytics.ts';
import brainRoutes from './routes/brain.ts';
import settingsRoutes from './routes/settings.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS setup supporting both local and production cross-origin headers
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize Database & Default Multi-Tenant Business
let dbInitialized = false;
async function initialize() {
  if (!dbInitialized) {
    await initDatabase();
    await ensureDefaultUserAndBusiness();
    dbInitialized = true;
  }
}

// Middleware to ensure database is initialized on serverless invocations
app.use(async (req, res, next) => {
  try {
    await initialize();
    next();
  } catch (err: any) {
    console.error('Database initialization error:', err);
    res.status(500).json({ error: 'Database service initialization failed: ' + err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Bussinex Business Management Engine',
    serverless: Boolean(process.env.VERCEL),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/brain', brainRoutes);
app.use('/api/settings', settingsRoutes);

// Serve frontend production build when available (Standalone mode)
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start standalone server when not running in Vercel serverless environment
if (!process.env.VERCEL) {
  initialize().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Bussinex API Server active on http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default app;
