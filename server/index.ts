import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase, db } from './db/database.ts';
import { seedDatabase } from './db/seed.ts';

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

// Initialize database schema
initDatabase();

// Auto-seed if database has 0 products on initial launch
const prodCount = db.prepare('SELECT count(*) as cnt FROM products').get() as { cnt: number };
if (prodCount.cnt === 0) {
  console.log('📦 First launch detected: Seeding realistic business dataset...');
  try {
    seedDatabase();
    console.log('✅ Initial database seed complete!');
  } catch (err) {
    console.error('Failed to seed initial data:', err);
  }
}

app.use(cors());
app.use(express.json());

// API Endpoints
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/brain', brainRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Bussinex Business Management Engine',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend production build when available
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Bussinex API Server active on http://localhost:${PORT}`);
});
