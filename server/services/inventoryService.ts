import { db } from '../db/database.ts';
import { auditService } from './auditService.ts';

export interface ProductInput {
  sku: string;
  barcode?: string;
  name: string;
  category_id?: number | null;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  min_stock_threshold: number;
  status?: string;
  description?: string;
  store_id?: number | null;
}

export const inventoryService = {
  /**
   * Fetches products with optional store-level stock isolation
   */
  async getProducts(businessId: number, filters: { 
    search?: string; 
    category_id?: number; 
    status?: string; 
    low_stock?: boolean;
    store_id?: number;
  } = {}) {
    let query: string;
    const params: any[] = [];

    if (filters.store_id) {
      // Store-specific stock lookup
      query = `
        SELECT 
          p.id, p.business_id, p.sku, p.barcode, p.name, p.category_id, 
          p.cost_price, p.selling_price, p.min_stock_threshold, p.status, p.description,
          p.created_at, p.updated_at,
          c.name as category_name,
          COALESCE(si.stock_quantity, 0) as current_stock,
          COALESCE(si.stock_quantity, 0) as store_stock,
          ? as store_id
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        LEFT JOIN store_inventory si ON si.product_id = p.id AND si.store_id = ?
        WHERE p.business_id = ?
      `;
      params.push(filters.store_id, filters.store_id, businessId);
    } else {
      // Consolidated multi-store stock lookup
      query = `
        SELECT 
          p.*, 
          c.name as category_name,
          COALESCE((SELECT SUM(stock_quantity) FROM store_inventory si WHERE si.product_id = p.id), p.current_stock) as current_stock
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.business_id = ?
      `;
      params.push(businessId);
    }

    if (filters.search) {
      query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.description LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
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
      if (filters.store_id) {
        query += ` AND COALESCE(si.stock_quantity, 0) <= p.min_stock_threshold`;
      } else {
        query += ` AND p.current_stock <= p.min_stock_threshold`;
      }
    }

    query += ` ORDER BY p.id DESC`;
    const rows = await db.query(query, params);

    return rows.map(r => ({
      ...r,
      cost_price: Number(r.cost_price || 0),
      selling_price: Number(r.selling_price || 0),
      current_stock: Number(r.current_stock || 0),
      min_stock_threshold: Number(r.min_stock_threshold || 5)
    }));
  },

  async getProductById(businessId: number, id: number, storeId?: number) {
    if (storeId) {
      const row = await db.queryOne(`
        SELECT 
          p.id, p.business_id, p.sku, p.barcode, p.name, p.category_id, 
          p.cost_price, p.selling_price, p.min_stock_threshold, p.status, p.description,
          p.created_at, p.updated_at,
          c.name as category_name,
          COALESCE(si.stock_quantity, 0) as current_stock,
          ? as store_id
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        LEFT JOIN store_inventory si ON si.product_id = p.id AND si.store_id = ?
        WHERE p.business_id = ? AND p.id = ?
      `, [storeId, storeId, businessId, id]);

      if (!row) return null;
      return {
        ...row,
        cost_price: Number(row.cost_price || 0),
        selling_price: Number(row.selling_price || 0),
        current_stock: Number(row.current_stock || 0),
        min_stock_threshold: Number(row.min_stock_threshold || 5)
      };
    }

    const row = await db.queryOne(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.business_id = ? AND p.id = ?
    `, [businessId, id]);

    if (!row) return null;
    return {
      ...row,
      cost_price: Number(row.cost_price || 0),
      selling_price: Number(row.selling_price || 0),
      current_stock: Number(row.current_stock || 0),
      min_stock_threshold: Number(row.min_stock_threshold || 5)
    };
  },

  async createProduct(businessId: number, data: ProductInput) {
    if (!data.name || !data.sku) {
      throw new Error('Product name and SKU are required.');
    }

    const cleanSku = data.sku.trim();
    const existing = await db.queryOne(
      'SELECT id FROM products WHERE business_id = ? AND sku = ?',
      [businessId, cleanSku]
    );
    if (existing) {
      throw new Error(`Product with SKU '${cleanSku}' already exists in your inventory.`);
    }

    const stock = Math.max(0, Number(data.current_stock) || 0);
    const minThreshold = Math.max(0, Number(data.min_stock_threshold) || 5);
    const costPrice = Math.max(0, Number(data.cost_price) || 0);
    const sellingPrice = Math.max(0, Number(data.selling_price) || 0);

    const result = await db.execute(`
      INSERT INTO products (
        business_id, sku, barcode, name, category_id, cost_price, selling_price, 
        current_stock, min_stock_threshold, status, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      cleanSku,
      data.barcode ? data.barcode.trim() : null,
      data.name.trim(),
      data.category_id || null,
      costPrice,
      sellingPrice,
      stock,
      minThreshold,
      data.status || 'active',
      data.description || ''
    ]);

    const newId = Number(result.lastInsertId);

    // Link to store inventory
    let targetStoreId = data.store_id;
    if (!targetStoreId) {
      const primaryStore = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]);
      targetStoreId = primaryStore ? primaryStore.id : 1;
    }

    // Populate store_inventory
    await db.execute(`
      INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity, min_stock_threshold)
      VALUES (?, ?, ?, ?, ?)
    `, [businessId, targetStoreId, newId, stock, minThreshold]);

    // Initial stock audit log
    if (stock > 0) {
      await db.execute(`
        INSERT INTO stock_logs (business_id, store_id, product_id, change_qty, previous_stock, new_stock, reason)
        VALUES (?, ?, ?, ?, 0, ?, 'Initial Product Setup')
      `, [businessId, targetStoreId, newId, stock, stock]);
    }

    await auditService.log({
      businessId,
      storeId: targetStoreId,
      action: 'PRODUCT_CREATED',
      entityType: 'product',
      entityId: newId,
      details: { name: data.name, sku: cleanSku, stock }
    });

    return this.getProductById(businessId, newId, targetStoreId || undefined);
  },

  async updateProduct(businessId: number, id: number, data: Partial<ProductInput>) {
    const current = await db.queryOne('SELECT * FROM products WHERE business_id = ? AND id = ?', [businessId, id]);
    if (!current) {
      throw new Error(`Product with ID ${id} not found.`);
    }

    if (data.sku && data.sku.trim() !== current.sku) {
      const existing = await db.queryOne(
        'SELECT id FROM products WHERE business_id = ? AND sku = ? AND id != ?',
        [businessId, data.sku.trim(), id]
      );
      if (existing) {
        throw new Error(`Product with SKU '${data.sku}' already exists.`);
      }
    }

    const updatedSku = data.sku ? data.sku.trim() : current.sku;
    const updatedName = data.name ? data.name.trim() : current.name;
    const updatedBarcode = data.barcode !== undefined ? (data.barcode ? data.barcode.trim() : null) : current.barcode;
    const updatedCost = data.cost_price !== undefined ? Number(data.cost_price) : current.cost_price;
    const updatedPrice = data.selling_price !== undefined ? Number(data.selling_price) : current.selling_price;
    const updatedThreshold = data.min_stock_threshold !== undefined ? Number(data.min_stock_threshold) : current.min_stock_threshold;
    const updatedStatus = data.status ?? current.status;
    const updatedDesc = data.description ?? current.description;

    await db.execute(`
      UPDATE products 
      SET sku = ?, barcode = ?, name = ?, category_id = ?, cost_price = ?, selling_price = ?, 
          min_stock_threshold = ?, status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE business_id = ? AND id = ?
    `, [
      updatedSku,
      updatedBarcode,
      updatedName,
      data.category_id !== undefined ? data.category_id : current.category_id,
      updatedCost,
      updatedPrice,
      updatedThreshold,
      updatedStatus,
      updatedDesc,
      businessId,
      id
    ]);

    // Handle stock quantity updates
    if (data.current_stock !== undefined && data.current_stock !== current.current_stock) {
      const newStock = Math.max(0, Number(data.current_stock));
      const diff = newStock - Number(current.current_stock);
      const targetStoreId = data.store_id || (await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]))?.id || 1;

      await db.execute(
        'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
        [newStock, businessId, id]
      );

      // Upsert store_inventory
      const existingStoreInv = await db.queryOne(
        'SELECT id FROM store_inventory WHERE store_id = ? AND product_id = ?',
        [targetStoreId, id]
      );

      if (existingStoreInv) {
        await db.execute(
          'UPDATE store_inventory SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ? AND product_id = ?',
          [newStock, targetStoreId, id]
        );
      } else {
        await db.execute(`
          INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity, min_stock_threshold)
          VALUES (?, ?, ?, ?, ?)
        `, [businessId, targetStoreId, id, newStock, updatedThreshold]);
      }

      await db.execute(`
        INSERT INTO stock_logs (business_id, store_id, product_id, change_qty, previous_stock, new_stock, reason)
        VALUES (?, ?, ?, ?, ?, ?, 'Manual Stock Adjustment')
      `, [businessId, targetStoreId, id, diff, current.current_stock, newStock]);
    }

    await auditService.log({
      businessId,
      action: 'PRODUCT_UPDATED',
      entityType: 'product',
      entityId: id,
      details: { name: updatedName, sku: updatedSku }
    });

    return this.getProductById(businessId, id, data.store_id || undefined);
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
      return { success: true, message: 'Product has active transaction history; safely archived to protect audit trails.' };
    }

    await db.execute('DELETE FROM store_inventory WHERE product_id = ?', [id]);
    await db.execute('DELETE FROM products WHERE business_id = ? AND id = ?', [businessId, id]);

    await auditService.log({
      businessId,
      action: 'PRODUCT_DELETED',
      entityType: 'product',
      entityId: id
    });

    return { success: true, message: 'Product deleted permanently.' };
  },

  /**
   * Adjusts stock safely with store tracking and validation
   */
  async adjustStock(businessId: number, productId: number, changeQty: number, reason: string, storeId?: number, referenceId?: string) {
    const product = await db.queryOne('SELECT * FROM products WHERE business_id = ? AND id = ?', [businessId, productId]);
    if (!product) {
      throw new Error('Product not found.');
    }

    let targetStoreId = storeId;
    if (!targetStoreId) {
      const primaryStore = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]);
      targetStoreId = primaryStore ? Number(primaryStore.id) : 1;
    }

    let storeInv = await db.queryOne(
      'SELECT stock_quantity FROM store_inventory WHERE store_id = ? AND product_id = ?',
      [targetStoreId, productId]
    );

    const prevStoreStock = storeInv ? Number(storeInv.stock_quantity) : 0;
    const newStoreStock = prevStoreStock + changeQty;

    if (newStoreStock < 0) {
      throw new Error(`Insufficient stock for '${product.name}'. Available in this store: ${prevStoreStock}, Requested deduction: ${Math.abs(changeQty)}`);
    }

    if (storeInv) {
      await db.execute(
        'UPDATE store_inventory SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ? AND product_id = ?',
        [newStoreStock, targetStoreId, productId]
      );
    } else {
      await db.execute(
        'INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity, min_stock_threshold) VALUES (?, ?, ?, ?, ?)',
        [businessId, targetStoreId, productId, newStoreStock, Number(product.min_stock_threshold || 5)]
      );
    }

    // Update aggregate product current_stock
    const agg = await db.queryOne(
      'SELECT COALESCE(SUM(stock_quantity), 0) as total FROM store_inventory WHERE product_id = ?',
      [productId]
    );
    const totalStock = Number(agg?.total || 0);

    await db.execute(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
      [totalStock, businessId, productId]
    );

    await db.execute(`
      INSERT INTO stock_logs (business_id, store_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [businessId, targetStoreId, productId, changeQty, prevStoreStock, newStoreStock, reason, referenceId || null]);

    await auditService.log({
      businessId,
      storeId: targetStoreId,
      action: 'STOCK_ADJUSTED',
      entityType: 'product',
      entityId: productId,
      details: { changeQty, prevStock: prevStoreStock, newStock: newStoreStock, reason }
    });

    return { 
      success: true, 
      productId, 
      previousStock: prevStoreStock, 
      newStock: newStoreStock,
      totalBusinessStock: totalStock 
    };
  },

  /**
   * Fetches stock movement audit history
   */
  async getStockLogs(businessId: number, options: { productId?: number; product_id?: number; storeId?: number; store_id?: number; limit?: number; offset?: number } = {}) {
    let query = `
      SELECT 
        sl.*,
        p.name as product_name,
        p.sku as product_sku,
        s.name as store_name
      FROM stock_logs sl
      JOIN products p ON sl.product_id = p.id
      LEFT JOIN stores s ON sl.store_id = s.id
      WHERE sl.business_id = ?
    `;
    const params: any[] = [businessId];

    const prodId = options.productId || options.product_id;
    if (prodId) {
      query += ' AND sl.product_id = ?';
      params.push(prodId);
    }

    const storeId = options.storeId || options.store_id;
    if (storeId) {
      query += ' AND sl.store_id = ?';
      params.push(storeId);
    }

    query += ' ORDER BY sl.id DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);

    return db.query(query, params);
  },

  /**
   * Generates CSV export for catalog
   */
  async exportProductsCSV(businessId: number, storeId?: number): Promise<string> {
    const products = await this.getProducts(businessId, { store_id: storeId });
    const headers = ['SKU', 'Barcode', 'Name', 'Category', 'Cost Price (INR)', 'Selling Price (INR)', 'Current Stock', 'Min Threshold', 'Status', 'Description'];
    
    const rows = products.map(p => [
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.barcode || '').replace(/"/g, '""')}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.category_name || '').replace(/"/g, '""')}"`,
      p.cost_price.toFixed(2),
      p.selling_price.toFixed(2),
      p.current_stock,
      p.min_stock_threshold,
      p.status,
      `"${(p.description || '').replace(/"/g, '""')}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  },

  /**
   * Imports products from CSV
   */
  async importProductsCSV(businessId: number, csvContent: string, storeId?: number): Promise<{ importedCount: number; errors: string[] }> {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file must contain a header row and at least one data row.');
    }

    const errors: string[] = [];
    let importedCount = 0;

    let targetStoreId = storeId;
    if (!targetStoreId) {
      const primary = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]);
      targetStoreId = primary ? Number(primary.id) : 1;
    }

    // Process rows (skipping header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV token parser handling quotes
      const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
      const values: string[] = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        let val = match[1] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        values.push(val.trim());
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }

      if (values.length < 3) continue;

      const sku = values[0];
      const barcode = values[1] || undefined;
      const name = values[2];
      const costPrice = parseFloat(values[4]) || 0;
      const sellingPrice = parseFloat(values[5]) || 0;
      const stock = parseInt(values[6], 10) || 0;
      const minThreshold = parseInt(values[7], 10) || 5;
      const status = values[8] || 'active';
      const description = values[9] || '';

      if (!sku || !name) {
        errors.push(`Row ${i + 1}: SKU and Name are required.`);
        continue;
      }

      try {
        const existing = await db.queryOne('SELECT id FROM products WHERE business_id = ? AND sku = ?', [businessId, sku]);
        if (existing) {
          await this.updateProduct(businessId, existing.id, {
            barcode,
            name,
            cost_price: costPrice,
            selling_price: sellingPrice,
            current_stock: stock,
            min_stock_threshold: minThreshold,
            status,
            description,
            store_id: targetStoreId
          });
        } else {
          await this.createProduct(businessId, {
            sku,
            barcode,
            name,
            cost_price: costPrice,
            selling_price: sellingPrice,
            current_stock: stock,
            min_stock_threshold: minThreshold,
            status,
            description,
            store_id: targetStoreId
          });
        }
        importedCount++;
      } catch (err: any) {
        errors.push(`Row ${i + 1} (${sku}): ${err.message}`);
      }
    }

    return { importedCount, errors };
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

  async getInventoryHealthStats(businessId: number, storeId?: number) {
    let products: any[];
    if (storeId) {
      products = await db.query(`
        SELECT COALESCE(si.stock_quantity, 0) as current_stock, p.min_stock_threshold, p.cost_price, p.selling_price 
        FROM products p
        JOIN store_inventory si ON si.product_id = p.id AND si.store_id = ?
        WHERE p.business_id = ? AND p.status = 'active'
      `, [storeId, businessId]);
    } else {
      products = await db.query(
        "SELECT current_stock, min_stock_threshold, cost_price, selling_price FROM products WHERE business_id = ? AND status = 'active'",
        [businessId]
      );
    }

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
