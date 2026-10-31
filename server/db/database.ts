import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, 'bussinex.db');

export const db = new DatabaseSync(DB_PATH);

// Enable Foreign Keys & WAL mode for high performance & integrity
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function initDatabase() {
  db.exec(`
    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      cost_price REAL NOT NULL DEFAULT 0.0,
      selling_price REAL NOT NULL DEFAULT 0.0,
      current_stock INTEGER NOT NULL DEFAULT 0,
      min_stock_threshold INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived')),
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Stock Audit Logs
    CREATE TABLE IF NOT EXISTS stock_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      change_qty INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reason TEXT NOT NULL,
      reference_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      company TEXT,
      tier TEXT NOT NULL DEFAULT 'regular' CHECK(tier IN ('vip', 'regular', 'wholesale', 'new')),
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending', 'processing', 'completed', 'cancelled')),
      payment_method TEXT NOT NULL DEFAULT 'card' CHECK(payment_method IN ('card', 'bank_transfer', 'cash', 'invoice', 'credit')),
      payment_status TEXT NOT NULL DEFAULT 'paid' CHECK(payment_status IN ('paid', 'pending', 'refunded')),
      subtotal REAL NOT NULL DEFAULT 0.0,
      discount_amount REAL NOT NULL DEFAULT 0.0,
      tax_amount REAL NOT NULL DEFAULT 0.0,
      total_amount REAL NOT NULL DEFAULT 0.0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Order Line Items
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      product_sku TEXT NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0.0,
      unit_price REAL NOT NULL DEFAULT 0.0,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      line_total REAL NOT NULL DEFAULT 0.0
    );

    -- Business Brain Conversations
    CREATE TABLE IF NOT EXISTS brain_conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Business Brain Messages
    CREATE TABLE IF NOT EXISTS brain_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES brain_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      metrics_context TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Initialize default business settings if absent
  const existingSettings = db.prepare('SELECT count(*) as cnt FROM settings').get() as { cnt: number };
  if (existingSettings.cnt === 0) {
    const defaultSettings: Record<string, string> = {
      business_name: 'Apex Innovations Ltd',
      currency_symbol: '$',
      tax_rate: '8.5',
      contact_email: 'finance@apex-innovations.com',
      business_address: '742 Evergreen Terrace, Tech District, CA',
      ai_provider: process.env.AI_PROVIDER || 'gemini',
      ai_model: process.env.AI_MODEL || 'gemini-2.5-flash',
      ai_api_key: process.env.GEMINI_API_KEY || '',
      ai_temperature: '0.2',
    };

    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [key, val] of Object.entries(defaultSettings)) {
      insertSetting.run(key, val);
    }
  }
}
