import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export interface DBClient {
  isPostgres: boolean;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ lastInsertId?: number | string; rowCount?: number }>;
  exec(sql: string): Promise<void>;
}

// Check for PostgreSQL connection URL
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pgPool: pg.Pool | null = null;
let sqliteDb: DatabaseSync | null = null;
const isPostgres = Boolean(DATABASE_URL && DATABASE_URL.trim().length > 0);

if (isPostgres) {
  console.log('🐘 Initializing PostgreSQL Client Pool...');
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
} else {
  console.log('📦 Using Local SQLite Storage (Provide DATABASE_URL to connect PostgreSQL)...');
  const DB_DIR = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const DB_PATH = process.env.SQLITE_PATH || path.join(DB_DIR, 'bussinex.db');
  sqliteDb = new DatabaseSync(DB_PATH);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
}

/**
 * Normalizes SQL queries across PostgreSQL ($1, $2) and SQLite (?, ?)
 */
function normalizeSql(sql: string, toPostgres: boolean): string {
  if (toPostgres) {
    // Convert ? to $1, $2, ...
    let paramIndex = 1;
    return sql.replace(/\?/g, () => `$${paramIndex++}`);
  } else {
    // Convert $1, $2, ... to ?
    return sql.replace(/\$\d+/g, '?');
  }
}

export const db: DBClient = {
  isPostgres,

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (isPostgres && pgPool) {
      const pSql = normalizeSql(sql, true);
      const res = await pgPool.query(pSql, params);
      return res.rows as T[];
    } else if (sqliteDb) {
      const sSql = normalizeSql(sql, false);
      const stmt = sqliteDb.prepare(sSql);
      return stmt.all(...params) as T[];
    }
    return [];
  },

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  },

  async execute(sql: string, params: any[] = []): Promise<{ lastInsertId?: number | string; rowCount?: number }> {
    if (isPostgres && pgPool) {
      // In PostgreSQL, append RETURNING id if an INSERT lacks it and needs lastInsertId
      let pSql = normalizeSql(sql, true);
      const isInsert = pSql.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !pSql.toUpperCase().includes('RETURNING')) {
        pSql += ' RETURNING id';
      }
      const res = await pgPool.query(pSql, params);
      const lastInsertId = res.rows.length > 0 ? res.rows[0].id : undefined;
      return { lastInsertId, rowCount: res.rowCount ?? undefined };
    } else if (sqliteDb) {
      const sSql = normalizeSql(sql, false);
      const stmt = sqliteDb.prepare(sSql);
      const res = stmt.run(...params);
      return {
        lastInsertId: res.lastInsertRowid ? Number(res.lastInsertRowid) : undefined,
        rowCount: res.changes,
      };
    }
    return {};
  },

  async exec(sql: string): Promise<void> {
    if (isPostgres && pgPool) {
      await pgPool.query(sql);
    } else if (sqliteDb) {
      sqliteDb.exec(sql);
    }
  },
};

/**
 * Initializes database schema across PostgreSQL or SQLite
 */
export async function initDatabase() {
  if (isPostgres && pgPool) {
    // PostgreSQL DDL
    await db.exec(`
      -- 1. Businesses / Tenants Table
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        currency_symbol VARCHAR(10) DEFAULT '$',
        tax_rate NUMERIC(5,2) DEFAULT 8.50,
        address TEXT,
        contact_email VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Users Table with Authentication
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 3. Settings Table
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_business_setting UNIQUE (business_id, key)
      );

      -- 4. Categories Table
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_business_category UNIQUE (business_id, name)
      );

      -- 5. Products Catalog
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        sku VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        cost_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        current_stock INTEGER NOT NULL DEFAULT 0,
        min_stock_threshold INTEGER NOT NULL DEFAULT 10,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_business_product_sku UNIQUE (business_id, sku)
      );

      -- 6. Stock Audit Logs
      CREATE TABLE IF NOT EXISTS stock_logs (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        change_qty INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        reason VARCHAR(255) NOT NULL,
        reference_id VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 7. Customers CRM
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(100),
        company VARCHAR(255),
        tier VARCHAR(50) NOT NULL DEFAULT 'regular',
        address TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 8. Orders
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        order_number VARCHAR(100) NOT NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'completed',
        payment_method VARCHAR(50) NOT NULL DEFAULT 'card',
        payment_status VARCHAR(50) NOT NULL DEFAULT 'paid',
        subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_business_order_number UNIQUE (business_id, order_number)
      );

      -- 9. Order Line Items
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name VARCHAR(255) NOT NULL,
        product_sku VARCHAR(100) NOT NULL,
        unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        quantity INTEGER NOT NULL,
        line_total NUMERIC(12,2) NOT NULL DEFAULT 0.00
      );

      -- 10. Business Brain Conversations
      CREATE TABLE IF NOT EXISTS brain_conversations (
        id VARCHAR(100) PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 11. Business Brain Messages
      CREATE TABLE IF NOT EXISTS brain_messages (
        id SERIAL PRIMARY KEY,
        conversation_id VARCHAR(100) NOT NULL REFERENCES brain_conversations(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        metrics_context TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    // SQLite DDL (matching schema with business_id multi-tenancy)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        currency_symbol TEXT DEFAULT '$',
        tax_rate REAL DEFAULT 8.5,
        address TEXT,
        contact_email TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (business_id, key)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (business_id, name)
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        cost_price REAL NOT NULL DEFAULT 0.0,
        selling_price REAL NOT NULL DEFAULT 0.0,
        current_stock INTEGER NOT NULL DEFAULT 0,
        min_stock_threshold INTEGER NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'active',
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (business_id, sku)
      );

      CREATE TABLE IF NOT EXISTS stock_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        change_qty INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        reason TEXT NOT NULL,
        reference_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company TEXT,
        tier TEXT NOT NULL DEFAULT 'regular',
        address TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        order_number TEXT NOT NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        payment_method TEXT NOT NULL DEFAULT 'card',
        payment_status TEXT NOT NULL DEFAULT 'paid',
        subtotal REAL NOT NULL DEFAULT 0.0,
        discount_amount REAL NOT NULL DEFAULT 0.0,
        tax_amount REAL NOT NULL DEFAULT 0.0,
        total_amount REAL NOT NULL DEFAULT 0.0,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (business_id, order_number)
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        product_sku TEXT NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0.0,
        unit_price REAL NOT NULL DEFAULT 0.0,
        quantity INTEGER NOT NULL,
        line_total REAL NOT NULL DEFAULT 0.0
      );

      CREATE TABLE IF NOT EXISTS brain_conversations (
        id TEXT PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS brain_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL REFERENCES brain_conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metrics_context TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}
