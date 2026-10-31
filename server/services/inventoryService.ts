import { db } from '../db/database.ts';

export interface ProductInput {
  sku: string;
  name: string;
  category_id?: number | null;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  min_stock_threshold: number;
  status?: 'active' | 'draft' | 'archived';
  description?: string;
}

export const inventoryService = {
  getProducts(filters: { search?: string; category_id?: number; status?: string; low_stock?: boolean } = {}) {
    let query = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.search) {
      query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    if (filters.category_id) {
      query += ` AND p.category_id = ?`;
      params.push(filters.category_id);
    }

    if (filters.status) {
      query += ` AND p.status = ?`;
      params.push(filters.status);
    }

    if (filters.low_stock) {
      query += ` AND p.current_stock <= p.min_stock_threshold`;
    }

    query += ` ORDER BY p.id DESC`;
    return db.prepare(query).all(...params);
  },

  getProductById(id: number) {
    return db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?
    `).get(id);
  },

  createProduct(data: ProductInput) {
    const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(data.sku);
    if (existing) {
      throw new Error(`Product with SKU '${data.sku}' already exists.`);
    }

    const stmt = db.prepare(`
      INSERT INTO products (sku, name, category_id, cost_price, selling_price, current_stock, min_stock_threshold, status, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.sku.trim(),
      data.name.trim(),
      data.category_id || null,
      Number(data.cost_price) || 0,
      Number(data.selling_price) || 0,
      Number(data.current_stock) || 0,
      Number(data.min_stock_threshold) || 10,
      data.status || 'active',
      data.description || ''
    );

    const newId = Number(result.lastInsertRowid);

    // Record initial stock log
    if (data.current_stock > 0) {
      db.prepare(`
        INSERT INTO stock_logs (product_id, change_qty, previous_stock, new_stock, reason)
        VALUES (?, ?, 0, ?, 'Initial Inventory Setup')
      `).run(newId, data.current_stock, data.current_stock);
    }

    return this.getProductById(newId);
  },

  updateProduct(id: number, data: Partial<ProductInput>) {
    const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!current) {
      throw new Error(`Product with ID ${id} not found.`);
    }

    if (data.sku && data.sku !== current.sku) {
      const existing = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(data.sku, id);
      if (existing) {
        throw new Error(`Product with SKU '${data.sku}' already exists.`);
      }
    }

    const stmt = db.prepare(`
      UPDATE products 
      SET sku = ?, name = ?, category_id = ?, cost_price = ?, selling_price = ?, 
          current_stock = ?, min_stock_threshold = ?, status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      data.sku ?? current.sku,
      data.name ?? current.name,
      data.category_id !== undefined ? data.category_id : current.category_id,
      data.cost_price !== undefined ? Number(data.cost_price) : current.cost_price,
      data.selling_price !== undefined ? Number(data.selling_price) : current.selling_price,
      data.current_stock !== undefined ? Number(data.current_stock) : current.current_stock,
      data.min_stock_threshold !== undefined ? Number(data.min_stock_threshold) : current.min_stock_threshold,
      data.status ?? current.status,
      data.description ?? current.description,
      id
    );

    // If stock changed manually via update, record audit log
    if (data.current_stock !== undefined && data.current_stock !== current.current_stock) {
      const diff = data.current_stock - current.current_stock;
      db.prepare(`
        INSERT INTO stock_logs (product_id, change_qty, previous_stock, new_stock, reason)
        VALUES (?, ?, ?, ?, 'Manual Stock Adjustment')
      `).run(id, diff, current.current_stock, data.current_stock);
    }

    return this.getProductById(id);
  },

  deleteProduct(id: number) {
    // Check if product is in any orders
    const inOrders = db.prepare('SELECT count(*) as cnt FROM order_items WHERE product_id = ?').get(id) as { cnt: number };
    if (inOrders && inOrders.cnt > 0) {
      // Soft-archive to preserve financial and historical integrity
      db.prepare(`UPDATE products SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
      return { success: true, message: 'Product has order history; archived safely to protect financial records.' };
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return { success: true, message: 'Product deleted permanently.' };
  },

  adjustStock(productId: number, changeQty: number, reason: string, referenceId?: string) {
    db.exec('BEGIN TRANSACTION;');
    try {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
      if (!product) {
        throw new Error('Product not found.');
      }

      const previousStock = product.current_stock;
      const newStock = previousStock + changeQty;

      if (newStock < 0) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${previousStock}, Requested deduction: ${Math.abs(changeQty)}`);
      }

      db.prepare(`UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newStock, productId);

      db.prepare(`
        INSERT INTO stock_logs (product_id, change_qty, previous_stock, new_stock, reason, reference_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(productId, changeQty, previousStock, newStock, reason, referenceId || null);

      db.exec('COMMIT;');
      return { success: true, productId, previousStock, newStock };
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  getCategories() {
    return db.prepare(`
      SELECT c.*, count(p.id) as product_count 
      FROM categories c 
      LEFT JOIN products p ON c.id = p.category_id 
      GROUP BY c.id 
      ORDER BY c.name ASC
    `).all();
  },

  createCategory(name: string, description: string = '') {
    const stmt = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    const res = stmt.run(name.trim(), description.trim());
    return { id: Number(res.lastInsertRowid), name, description };
  },

  getInventoryHealthStats() {
    const products = db.prepare("SELECT current_stock, min_stock_threshold, cost_price, selling_price FROM products WHERE status = 'active'").all() as any[];
    
    let totalStockValueCost = 0;
    let totalStockValueRetail = 0;
    let optimalCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      totalStockValueCost += (p.current_stock * p.cost_price);
      totalStockValueRetail += (p.current_stock * p.selling_price);

      if (p.current_stock === 0) {
        outOfStockCount++;
      } else if (p.current_stock <= p.min_stock_threshold) {
        lowStockCount++;
      } else {
        optimalCount++;
      }
    }

    return {
      totalProducts: products.length,
      optimalCount,
      lowStockCount,
      outOfStockCount,
      totalStockValueCost: Number(totalStockValueCost.toFixed(2)),
      totalStockValueRetail: Number(totalStockValueRetail.toFixed(2)),
      potentialProfit: Number((totalStockValueRetail - totalStockValueCost).toFixed(2))
    };
  }
};
