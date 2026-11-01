import pg from 'pg';
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
export const isPostgres = Boolean(DATABASE_URL && DATABASE_URL.trim().length > 0);

let pgPool: pg.Pool | null = null;
let sqliteDb: any = null;
let sqliteDbPromise: Promise<any> | null = null;

function getPgPool(): pg.Pool {
  if (!pgPool) {
    console.log('🐘 Initializing PostgreSQL Client Pool...');
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: process.env.VERCEL ? 3 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pgPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client pool:', err);
    });
  }
  return pgPool;
}

async function getSqliteDb() {
  if (sqliteDb) return sqliteDb;
  if (!sqliteDbPromise) {
    sqliteDbPromise = (async () => {
      console.log('📦 Initializing SQLite Storage (Provide DATABASE_URL to connect PostgreSQL)...');
      try {
        const { DatabaseSync } = await import('node:sqlite');
        const isVercel = Boolean(process.env.VERCEL);
        // On Vercel / serverless lambda, process.cwd() is read-only; use /tmp
        const dbDir = isVercel ? '/tmp' : path.resolve(process.cwd(), 'data');
        if (!fs.existsSync(dbDir)) {
          try {
            fs.mkdirSync(dbDir, { recursive: true });
          } catch (e) {
            console.warn('Could not create directory:', dbDir, e);
          }
        }
        const dbPath = process.env.SQLITE_PATH || path.join(dbDir, 'bussinex.db');
        const instance = new DatabaseSync(dbPath);
        instance.exec('PRAGMA foreign_keys = ON;');
        instance.exec('PRAGMA journal_mode = WAL;');
        sqliteDb = instance;
        return instance;
      } catch (err: any) {
        console.error('Failed to initialize SQLite storage:', err);
        throw new Error(
          `SQLite storage is unavailable on this runtime (${err.message}). Set DATABASE_URL in Vercel environment variables to use PostgreSQL.`
        );
      }
    })();
  }
  return sqliteDbPromise;
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
    if (isPostgres) {
      const pool = getPgPool();
      const pSql = normalizeSql(sql, true);
      const res = await pool.query(pSql, params);
      return res.rows as T[];
    } else {
      const sDb = await getSqliteDb();
      const sSql = normalizeSql(sql, false);
      const stmt = sDb.prepare(sSql);
      return stmt.all(...params) as T[];
    }
  },

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  },

  async execute(sql: string, params: any[] = []): Promise<{ lastInsertId?: number | string; rowCount?: number }> {
    if (isPostgres) {
      const pool = getPgPool();
      let pSql = normalizeSql(sql, true);
      const isInsert = pSql.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !pSql.toUpperCase().includes('RETURNING')) {
        pSql += ' RETURNING id';
      }
      const res = await pool.query(pSql, params);
      const lastInsertId = res.rows.length > 0 ? res.rows[0].id : undefined;
      return { lastInsertId, rowCount: res.rowCount ?? undefined };
    } else {
      const sDb = await getSqliteDb();
      const sSql = normalizeSql(sql, false);
      const stmt = sDb.prepare(sSql);
      const res = stmt.run(...params);
      return {
        lastInsertId: res.lastInsertRowid ? Number(res.lastInsertRowid) : undefined,
        rowCount: res.changes,
      };
    }
  },

  async exec(sql: string): Promise<void> {
    if (isPostgres) {
      const pool = getPgPool();
      await pool.query(sql);
    } else {
      const sDb = await getSqliteDb();
      sDb.exec(sql);
    }
  },
};

/**
 * Initializes database schema across PostgreSQL or SQLite
 */
export async function initDatabase() {
  if (isPostgres) {
    // PostgreSQL DDL
    await db.exec(`
      -- 1. Businesses / Tenants Table
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        currency_symbol VARCHAR(10) DEFAULT '₹',
        currency_code VARCHAR(10) DEFAULT 'INR',
        tax_rate NUMERIC(5,2) DEFAULT 18.00,
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(20),
        country VARCHAR(100) DEFAULT 'India',
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Stores Table (Multi-Store Support)
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(20),
        is_primary BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_business_store_code UNIQUE (business_id, code)
      );

      -- 3. Users Table with Authentication & Verification
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        email_verified BOOLEAN DEFAULT FALSE,
        terms_accepted_at TIMESTAMPTZ,
        terms_version VARCHAR(50) DEFAULT '1.0',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 4. Email Verifications (OTP & Secure Tokens)
      CREATE TABLE IF NOT EXISTS email_verifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 5. Password Resets
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 6. Settings Table
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_business_setting UNIQUE (business_id, key)
      );

      -- 7. Categories Table
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_business_category UNIQUE (business_id, name)
      );

      -- 8. Products Catalog
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        sku VARCHAR(100) NOT NULL,
        barcode VARCHAR(100),
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

      -- 9. Store-Level Inventory (Multi-Store Isolation)
      CREATE TABLE IF NOT EXISTS store_inventory (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        min_stock_threshold INTEGER NOT NULL DEFAULT 5,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_store_product UNIQUE (store_id, product_id)
      );

      -- 10. Stock Transfers Between Stores
      CREATE TABLE IF NOT EXISTS stock_transfers (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        from_store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        to_store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'completed',
        notes TEXT,
        transferred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 11. Stock Audit Logs
      CREATE TABLE IF NOT EXISTS stock_logs (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        change_qty INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        reason VARCHAR(255) NOT NULL,
        reference_id VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 12. Customers CRM
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(100),
        company VARCHAR(255),
        tier VARCHAR(50) NOT NULL DEFAULT 'regular',
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(20),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 13. Orders
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
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

      -- 14. Order Line Items
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

      -- 15. Audit Logs for Security
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER,
        user_id INTEGER,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100),
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 16. Terms Acceptances
      CREATE TABLE IF NOT EXISTS terms_acceptances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        terms_version VARCHAR(50) NOT NULL,
        ip_address VARCHAR(100),
        user_agent TEXT,
        accepted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 17. Business Brain Conversations
      CREATE TABLE IF NOT EXISTS brain_conversations (
        id VARCHAR(100) PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- 18. Business Brain Messages
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
    // SQLite DDL (matching schema with multi-tenant & multi-store architecture)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        currency_symbol TEXT DEFAULT '₹',
        currency_code TEXT DEFAULT 'INR',
        tax_rate REAL DEFAULT 18.0,
        address TEXT,
        city TEXT,
        state TEXT,
        pincode TEXT,
        country TEXT DEFAULT 'India',
        contact_email TEXT,
        contact_phone TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        contact_email TEXT,
        contact_phone TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        pincode TEXT,
        is_primary INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (business_id, code)
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        email_verified INTEGER DEFAULT 0,
        terms_accepted_at TEXT,
        terms_version TEXT DEFAULT '1.0',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        otp TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        verified_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        otp TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
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
        barcode TEXT,
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

      CREATE TABLE IF NOT EXISTS store_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        min_stock_threshold INTEGER NOT NULL DEFAULT 5,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (store_id, product_id)
      );

      CREATE TABLE IF NOT EXISTS stock_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        from_store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        to_store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        notes TEXT,
        transferred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stock_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
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
        store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company TEXT,
        tier TEXT NOT NULL DEFAULT 'regular',
        address TEXT,
        city TEXT,
        state TEXT,
        pincode TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
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

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        store_id INTEGER,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS terms_acceptances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        terms_version TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        accepted_at TEXT DEFAULT CURRENT_TIMESTAMP
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

  // Safe schema migrations: Ensure all columns exist on legacy tables without data loss
  await runSafeColumnMigrations();
  await ensurePrimaryStoresAndInventory();
}

/**
 * Migration helper to alter tables and add new columns safely
 */
async function runSafeColumnMigrations() {
  const migrations: { table: string; column: string; pgType: string; sqliteType: string }[] = [
    { table: 'businesses', column: 'currency_code', pgType: "VARCHAR(10) DEFAULT 'INR'", sqliteType: "TEXT DEFAULT 'INR'" },
    { table: 'businesses', column: 'contact_phone', pgType: 'VARCHAR(50)', sqliteType: 'TEXT' },
    { table: 'businesses', column: 'city', pgType: 'VARCHAR(100)', sqliteType: 'TEXT' },
    { table: 'businesses', column: 'state', pgType: 'VARCHAR(100)', sqliteType: 'TEXT' },
    { table: 'businesses', column: 'pincode', pgType: 'VARCHAR(20)', sqliteType: 'TEXT' },
    { table: 'businesses', column: 'country', pgType: "VARCHAR(100) DEFAULT 'India'", sqliteType: "TEXT DEFAULT 'India'" },
    { table: 'users', column: 'store_id', pgType: 'INTEGER', sqliteType: 'INTEGER' },
    { table: 'users', column: 'phone', pgType: 'VARCHAR(50)', sqliteType: 'TEXT' },
    { table: 'users', column: 'email_verified', pgType: 'BOOLEAN DEFAULT FALSE', sqliteType: 'INTEGER DEFAULT 0' },
    { table: 'users', column: 'terms_accepted_at', pgType: 'TIMESTAMPTZ', sqliteType: 'TEXT' },
    { table: 'users', column: 'terms_version', pgType: "VARCHAR(50) DEFAULT '1.0'", sqliteType: "TEXT DEFAULT '1.0'" },
    { table: 'products', column: 'barcode', pgType: 'VARCHAR(100)', sqliteType: 'TEXT' },
    { table: 'orders', column: 'store_id', pgType: 'INTEGER', sqliteType: 'INTEGER' },
    { table: 'customers', column: 'store_id', pgType: 'INTEGER', sqliteType: 'INTEGER' },
    { table: 'customers', column: 'city', pgType: 'VARCHAR(100)', sqliteType: 'TEXT' },
    { table: 'customers', column: 'state', pgType: 'VARCHAR(100)', sqliteType: 'TEXT' },
    { table: 'customers', column: 'pincode', pgType: 'VARCHAR(20)', sqliteType: 'TEXT' },
    { table: 'stock_logs', column: 'store_id', pgType: 'INTEGER', sqliteType: 'INTEGER' },
  ];

  for (const m of migrations) {
    try {
      if (isPostgres) {
        const check = await db.queryOne(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        `, [m.table, m.column]);
        if (!check) {
          await db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.pgType};`);
        }
      } else {
        const cols: any[] = await db.query(`PRAGMA table_info(${m.table})`);
        const colNames = cols.map((c) => c.name);
        if (cols.length > 0 && !colNames.includes(m.column)) {
          await db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.sqliteType};`);
        }
      }
    } catch (err) {
      // Column may already exist or table created with it
    }
  }

  // Ensure default demo admin is marked as email_verified for development
  try {
    await db.execute("UPDATE users SET email_verified = 1 WHERE email = 'admin@bussinex.com' AND email_verified = 0");
  } catch (err) {
    // Ignore if user not seeded yet
  }
}

/**
 * Ensures each business has at least one primary store and links initial inventory
 */
async function ensurePrimaryStoresAndInventory() {
  try {
    const businesses = await db.query('SELECT id, name FROM businesses');
    for (const b of businesses) {
      const stores = await db.query('SELECT id FROM stores WHERE business_id = ?', [b.id]);
      let primaryStoreId: number;

      if (stores.length === 0) {
        const storeRes = await db.execute(`
          INSERT INTO stores (business_id, name, code, is_primary, status)
          VALUES (?, ?, 'STORE-01', 1, 'active')
        `, [b.id, `${b.name} (Main Store)`]);
        primaryStoreId = Number(storeRes.lastInsertId);
      } else {
        primaryStoreId = Number(stores[0].id);
      }

      // Link any products missing in store_inventory
      const products = await db.query('SELECT id, current_stock, min_stock_threshold FROM products WHERE business_id = ?', [b.id]);
      for (const p of products) {
        const exists = await db.queryOne(
          'SELECT id FROM store_inventory WHERE store_id = ? AND product_id = ?',
          [primaryStoreId, p.id]
        );
        if (!exists) {
          await db.execute(`
            INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity, min_stock_threshold)
            VALUES (?, ?, ?, ?, ?)
          `, [b.id, primaryStoreId, p.id, Number(p.current_stock || 0), Number(p.min_stock_threshold || 5)]);
        }
      }

      // Backfill orders store_id if missing
      await db.execute('UPDATE orders SET store_id = ? WHERE business_id = ? AND store_id IS NULL', [primaryStoreId, b.id]);
    }
  } catch (err) {
    console.warn('Primary store backfill note:', err);
  }
}
