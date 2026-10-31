import { db } from '../db/database.ts';

export interface ProductInput {
  sku: string;
  name: string;
  category_id?: number | null;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  min_stock_threshold: number;
  status?: string;
  description?: string;
}

export const inventoryService = {
  async getProducts(businessId: number, filters: { search?: string; category_id?: number; status?: string; low_stock?: boolean } = {}) {
    let query = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.business_id = ?
    `;
    const params: any[] = [businessId];

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
    return db.query(query, params);
  },

  async getProductById(businessId: number, id: number) {
    return db.queryOne(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.business_id = ? AND p.id = ?
    `, [businessId, id]);
  },

  async createProduct(businessId: number, data: ProductInput) {
    const existing = await db.queryOne(
      'SELECT id FROM products WHERE business_id = ? AND sku = ?',
      [businessId, data.sku]
    );
    if (existing) {
      throw new Error(`Product with SKU '${data.sku}' already exists in your inventory.`);
    }

    const result = await db.execute(`
      INSERT INTO products (business_id, sku, name, category_id, cost_price, selling_price, current_stock, min_stock_threshold, status, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      data.sku.trim(),
      data.name.trim(),
      data.category_id || null,
      Number(data.cost_price) || 0,
      Number(data.selling_price) || 0,
      Number(data.current_stock) || 0,
      Number(data.min_stock_threshold) || 10,
      data.status || 'active',
      data.description || ''
    ]);

    const newId = Number(result.lastInsertId);

    // Initial stock log
    if (data.current_stock > 0) {
      await db.execute(`
        INSERT INTO stock_logs (business_id, product_id, change_qty, previous_stock, new_stock, reason)
        VALUES (?, ?, ?, 0, ?, 'Initial Inventory Setup')
      `, [businessId, newId, data.current_stock, data.current_stock]);
    }

    return this.getProductById(businessId, newId);
  },

  async updateProduct(businessId: number, id: number, data: Partial<ProductInput>) {
    const current = await db.queryOne('SELECT * FROM products WHERE business_id = ? AND id = ?', [businessId, id]);
    if (!current) {
      throw new Error(`Product with ID ${id} not found.`);
    }

    if (data.sku && data.sku !== current.sku) {
      const existing = await db.queryOne(
        'SELECT id FROM products WHERE business_id = ? AND sku = ? AND id != ?',
        [businessId, data.sku, id]
      );
      if (existing) {
        throw new Error(`Product with SKU '${data.sku}' already exists.`);
      }
    }

    await db.execute(`
      UPDATE products 
      SET sku = ?, name = ?, category_id = ?, cost_price = ?, selling_price = ?, 
          current_stock = ?, min_stock_threshold = ?, status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE business_id = ? AND id = ?
    `, [
      data.sku ?? current.sku,
      data.name ?? current.name,
      data.category_id !== undefined ? data.category_id : current.category_id,
      data.cost_price !== undefined ? Number(data.cost_price) : current.cost_price,
      data.selling_price !== undefined ? Number(data.selling_price) : current.selling_price,
      data.current_stock !== undefined ? Number(data.current_stock) : current.current_stock,
      data.min_stock_threshold !== undefined ? Number(data.min_stock_threshold) : current.min_stock_threshold,
      data.status ?? current.status,
      data.description ?? current.description,
      businessId,
      id
    ]);

    if (data.current_stock !== undefined && data.current_stock !== current.current_stock) {
      const diff = data.current_stock - current.current_stock;
      await db.execute(`
        INSERT INTO stock_logs (business_id, product_id, change_qty, previous_stock, new_stock, reason)
        VALUES (?, ?, ?, ?, ?, 'Manual Stock Adjustment')
      `, [businessId, id, diff, current.current_stock, data.current_stock]);
    }

    return this.getProductById(businessId, id);
  },

  async deleteProduct(businessId: number, id: number) {
    const inOrders = await db.queryOne(
      'SELECT count(*) as cnt FROM order_items WHERE product_id = ?',
      [id]
    );

    if (inOrders && Number(inOrders.cnt) > 0) {
      await db.execute(
        "UPDATE products SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?",
        [businessId, id]
      );
      return { success: true, message: 'Product has order history; archived safely to protect financial records.' };
    }

    await db.execute('DELETE FROM products WHERE business_id = ? AND id = ?', [businessId, id]);
    return { success: true, message: 'Product deleted permanently.' };
  },

  async adjustStock(businessId: number, productId: number, changeQty: number, reason: string, referenceId?: string) {
    const product = await db.queryOne('SELECT * FROM products WHERE business_id = ? AND id = ?', [businessId, productId]);
    if (!product) {
      throw new Error('Product not found.');
    }

    const previousStock = Number(product.current_stock);
    const newStock = previousStock + changeQty;

    if (newStock < 0) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${previousStock}, Requested deduction: ${Math.abs(changeQty)}`);
    }

    await db.execute(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
      [newStock, businessId, productId]
    );

    await db.execute(`
      INSERT INTO stock_logs (business_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [businessId, productId, changeQty, previousStock, newStock, reason, referenceId || null]);

    return { success: true, productId, previousStock, newStock };
  },

  async getCategories(businessId: number) {
    return db.query(`
      SELECT c.*, count(p.id) as product_count 
      FROM categories c 
      LEFT JOIN products p ON c.id = p.category_id AND p.business_id = c.business_id
      WHERE c.business_id = ?
      GROUP BY c.id 
      ORDER BY c.name ASC
    `, [businessId]);
  },

  async createCategory(businessId: number, name: string, description: string = '') {
    const res = await db.execute(
      'INSERT INTO categories (business_id, name, description) VALUES (?, ?, ?)',
      [businessId, name.trim(), description.trim()]
    );
    return { id: Number(res.lastInsertId), name, description };
  },

  async getInventoryHealthStats(businessId: number) {
    const products = await db.query(
      "SELECT current_stock, min_stock_threshold, cost_price, selling_price FROM products WHERE business_id = ? AND status = 'active'",
      [businessId]
    );

    let totalStockValueCost = 0;
    let totalStockValueRetail = 0;
    let optimalCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      const stock = Number(p.current_stock);
      const cost = Number(p.cost_price);
      const price = Number(p.selling_price);
      const threshold = Number(p.min_stock_threshold);

      totalStockValueCost += (stock * cost);
      totalStockValueRetail += (stock * price);

      if (stock === 0) {
        outOfStockCount++;
      } else if (stock <= threshold) {
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
