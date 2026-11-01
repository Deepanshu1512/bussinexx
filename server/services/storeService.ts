import { db } from '../db/database.ts';
import { auditService } from './auditService.ts';

export interface StoreInput {
  name: string;
  code?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  is_primary?: boolean;
}

export interface StockTransferInput {
  fromStoreId: number;
  toStoreId: number;
  productId: number;
  quantity: number;
  transferredBy?: number;
  notes?: string;
}

export const storeService = {
  /**
   * Retrieves all stores for a business with summary counts
   */
  async getStores(businessId: number) {
    const stores = await db.query(`
      SELECT 
        s.*,
        (SELECT COUNT(DISTINCT si.product_id) FROM store_inventory si WHERE si.store_id = s.id AND si.stock_quantity > 0) as unique_products_count,
        (SELECT COALESCE(SUM(si.stock_quantity), 0) FROM store_inventory si WHERE si.store_id = s.id) as total_units_in_stock,
        (SELECT COUNT(o.id) FROM orders o WHERE o.store_id = s.id) as orders_count,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.store_id = s.id AND o.status != 'cancelled') as gross_revenue
      FROM stores s
      WHERE s.business_id = ?
      ORDER BY s.is_primary DESC, s.id ASC
    `, [businessId]);

    return stores.map(s => ({
      ...s,
      is_primary: Boolean(s.is_primary),
      unique_products_count: Number(s.unique_products_count || 0),
      total_units_in_stock: Number(s.total_units_in_stock || 0),
      orders_count: Number(s.orders_count || 0),
      gross_revenue: Number(s.gross_revenue || 0)
    }));
  },

  /**
   * Retrieves a single store by ID
   */
  async getStoreById(businessId: number, storeId: number) {
    const store = await db.queryOne(`
      SELECT 
        s.*,
        (SELECT COUNT(DISTINCT si.product_id) FROM store_inventory si WHERE si.store_id = s.id) as unique_products_count,
        (SELECT COALESCE(SUM(si.stock_quantity), 0) FROM store_inventory si WHERE si.store_id = s.id) as total_units_in_stock,
        (SELECT COUNT(o.id) FROM orders o WHERE o.store_id = s.id) as orders_count
      FROM stores s
      WHERE s.business_id = ? AND s.id = ?
    `, [businessId, storeId]);

    if (!store) return null;
    return {
      ...store,
      is_primary: Boolean(store.is_primary),
      unique_products_count: Number(store.unique_products_count || 0),
      total_units_in_stock: Number(store.total_units_in_stock || 0),
      orders_count: Number(store.orders_count || 0)
    };
  },

  /**
   * Creates a new store under a business
   */
  async createStore(businessId: number, data: StoreInput) {
    if (!data.name || !data.name.trim()) {
      throw new Error('Store name is required.');
    }

    const countRes = await db.queryOne('SELECT count(*) as cnt FROM stores WHERE business_id = ?', [businessId]);
    const storeCount = Number(countRes?.cnt || 0);
    const code = data.code ? data.code.trim().toUpperCase() : `STR-0${storeCount + 1}`;

    const existingCode = await db.queryOne(
      'SELECT id FROM stores WHERE business_id = ? AND code = ?',
      [businessId, code]
    );
    if (existingCode) {
      throw new Error(`A store with code '${code}' already exists in your business.`);
    }

    const isPrimary = storeCount === 0 || Boolean(data.is_primary);

    // If setting as primary, demote other stores
    if (isPrimary && storeCount > 0) {
      await db.execute('UPDATE stores SET is_primary = 0 WHERE business_id = ?', [businessId]);
    }

    const res = await db.execute(`
      INSERT INTO stores (
        business_id, name, code, contact_email, contact_phone, address, city, state, pincode, is_primary, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      businessId,
      data.name.trim(),
      code,
      data.contact_email?.trim() || null,
      data.contact_phone?.trim() || null,
      data.address?.trim() || null,
      data.city?.trim() || null,
      data.state?.trim() || null,
      data.pincode?.trim() || null,
      isPrimary ? 1 : 0
    ]);

    const newStoreId = Number(res.lastInsertId);

    // Initialize store_inventory records with 0 stock for existing catalog products
    const products = await db.query('SELECT id, min_stock_threshold FROM products WHERE business_id = ?', [businessId]);
    for (const p of products) {
      await db.execute(`
        INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity, min_stock_threshold)
        VALUES (?, ?, ?, 0, ?)
      `, [businessId, newStoreId, p.id, Number(p.min_stock_threshold || 5)]);
    }

    await auditService.log({
      businessId,
      storeId: newStoreId,
      action: 'STORE_CREATED',
      entityType: 'store',
      entityId: newStoreId,
      details: { name: data.name, code }
    });

    return this.getStoreById(businessId, newStoreId);
  },

  /**
   * Updates store details
   */
  async updateStore(businessId: number, storeId: number, data: Partial<StoreInput>) {
    const current = await db.queryOne('SELECT * FROM stores WHERE business_id = ? AND id = ?', [businessId, storeId]);
    if (!current) {
      throw new Error('Store not found.');
    }

    if (data.code && data.code.trim().toUpperCase() !== current.code) {
      const existing = await db.queryOne(
        'SELECT id FROM stores WHERE business_id = ? AND code = ? AND id != ?',
        [businessId, data.code.trim().toUpperCase(), storeId]
      );
      if (existing) {
        throw new Error(`Store code '${data.code}' is already assigned to another store.`);
      }
    }

    if (data.is_primary) {
      await db.execute('UPDATE stores SET is_primary = 0 WHERE business_id = ?', [businessId]);
    }

    await db.execute(`
      UPDATE stores SET
        name = ?,
        code = ?,
        contact_email = ?,
        contact_phone = ?,
        address = ?,
        city = ?,
        state = ?,
        pincode = ?,
        is_primary = ?
      WHERE business_id = ? AND id = ?
    `, [
      data.name ? data.name.trim() : current.name,
      data.code ? data.code.trim().toUpperCase() : current.code,
      data.contact_email !== undefined ? data.contact_email?.trim() || null : current.contact_email,
      data.contact_phone !== undefined ? data.contact_phone?.trim() || null : current.contact_phone,
      data.address !== undefined ? data.address?.trim() || null : current.address,
      data.city !== undefined ? data.city?.trim() || null : current.city,
      data.state !== undefined ? data.state?.trim() || null : current.state,
      data.pincode !== undefined ? data.pincode?.trim() || null : current.pincode,
      data.is_primary !== undefined ? (data.is_primary ? 1 : 0) : current.is_primary,
      businessId,
      storeId
    ]);

    await auditService.log({
      businessId,
      storeId,
      action: 'STORE_UPDATED',
      entityType: 'store',
      entityId: storeId,
      details: data
    });

    return this.getStoreById(businessId, storeId);
  },

  /**
   * Deletes a store (requires that no active orders or stock remain)
   */
  async deleteStore(businessId: number, storeId: number) {
    const store = await db.queryOne('SELECT * FROM stores WHERE business_id = ? AND id = ?', [businessId, storeId]);
    if (!store) {
      throw new Error('Store not found.');
    }

    if (store.is_primary) {
      throw new Error('Cannot delete the primary flagship store. Please assign another store as primary first.');
    }

    const orderCount = await db.queryOne('SELECT count(*) as cnt FROM orders WHERE store_id = ?', [storeId]);
    if (orderCount && Number(orderCount.cnt) > 0) {
      // Deactivate instead of hard deleting to preserve financial integrity
      await db.execute("UPDATE stores SET status = 'inactive' WHERE business_id = ? AND id = ?", [businessId, storeId]);
      return { success: true, message: 'Store has order history; archived safely to protect financial and audit records.' };
    }

    await db.execute('DELETE FROM store_inventory WHERE store_id = ?', [storeId]);
    await db.execute('DELETE FROM stores WHERE business_id = ? AND id = ?', [businessId, storeId]);

    await auditService.log({
      businessId,
      storeId,
      action: 'STORE_DELETED',
      entityType: 'store',
      entityId: storeId,
      details: { name: store.name, code: store.code }
    });

    return { success: true, message: 'Store deleted successfully.' };
  },

  /**
   * Retrieves current stock quantity for a product at a specific store
   */
  async getStoreStock(storeId: number, productId: number): Promise<number> {
    const inv = await db.queryOne(
      'SELECT stock_quantity FROM store_inventory WHERE store_id = ? AND product_id = ?',
      [storeId, productId]
    );
    return inv ? Number(inv.stock_quantity) : 0;
  },

  /**
   * Stock Transfer between stores
   */
  async transferStock(businessId: number, data: StockTransferInput) {
    const { fromStoreId, toStoreId, productId, quantity, transferredBy, notes } = data;

    if (fromStoreId === toStoreId) {
      throw new Error('Source and destination stores must be different.');
    }

    if (quantity <= 0) {
      throw new Error('Transfer quantity must be greater than zero.');
    }

    // 1. Verify source store & destination store belong to this business
    const [fromStore, toStore, product] = await Promise.all([
      db.queryOne('SELECT id, name FROM stores WHERE business_id = ? AND id = ?', [businessId, fromStoreId]),
      db.queryOne('SELECT id, name FROM stores WHERE business_id = ? AND id = ?', [businessId, toStoreId]),
      db.queryOne('SELECT id, name, sku FROM products WHERE business_id = ? AND id = ?', [businessId, productId])
    ]);

    if (!fromStore) throw new Error('Source store not found.');
    if (!toStore) throw new Error('Destination store not found.');
    if (!product) throw new Error('Product not found.');

    // 2. Check source inventory
    let sourceInv = await db.queryOne(
      'SELECT stock_quantity FROM store_inventory WHERE store_id = ? AND product_id = ?',
      [fromStoreId, productId]
    );

    const sourceStock = sourceInv ? Number(sourceInv.stock_quantity) : 0;
    if (sourceStock < quantity) {
      throw new Error(`Insufficient stock in ${fromStore.name} for '${product.name}'. Available: ${sourceStock}, Requested: ${quantity}`);
    }

    // 3. Check destination inventory
    let destInv = await db.queryOne(
      'SELECT stock_quantity FROM store_inventory WHERE store_id = ? AND product_id = ?',
      [toStoreId, productId]
    );
    const destStock = destInv ? Number(destInv.stock_quantity) : 0;

    // 4. Perform atomic stock movement
    const newSourceStock = sourceStock - quantity;
    const newDestStock = destStock + quantity;

    await db.execute(
      'UPDATE store_inventory SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ? AND product_id = ?',
      [newSourceStock, fromStoreId, productId]
    );

    if (destInv) {
      await db.execute(
        'UPDATE store_inventory SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ? AND product_id = ?',
        [newDestStock, toStoreId, productId]
      );
    } else {
      await db.execute(
        'INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity, min_stock_threshold) VALUES (?, ?, ?, ?, 5)',
        [businessId, toStoreId, productId, newDestStock]
      );
    }

    // 5. Record Transfer and Audit Logs
    const transferRes = await db.execute(`
      INSERT INTO stock_transfers (
        business_id, from_store_id, to_store_id, product_id, quantity, status, notes, transferred_by
      ) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)
    `, [
      businessId,
      fromStoreId,
      toStoreId,
      productId,
      quantity,
      notes || `Stock transfer of ${quantity} units from ${fromStore.name} to ${toStore.name}`,
      transferredBy || null
    ]);

    const transferId = Number(transferRes.lastInsertId);

    // Record stock_logs for both stores
    await db.execute(`
      INSERT INTO stock_logs (business_id, store_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      fromStoreId,
      productId,
      -quantity,
      sourceStock,
      newSourceStock,
      `Transfer Out to ${toStore.name}`,
      `XFER-${transferId}`
    ]);

    await db.execute(`
      INSERT INTO stock_logs (business_id, store_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      toStoreId,
      productId,
      quantity,
      destStock,
      newDestStock,
      `Transfer In from ${fromStore.name}`,
      `XFER-${transferId}`
    ]);

    await auditService.log({
      businessId,
      storeId: fromStoreId,
      action: 'STOCK_TRANSFERRED',
      entityType: 'stock_transfer',
      entityId: transferId,
      details: {
        from: fromStore.name,
        to: toStore.name,
        product: product.name,
        quantity
      }
    });

    return {
      success: true,
      transferId,
      fromStore: fromStore.name,
      toStore: toStore.name,
      productName: product.name,
      quantity,
      newSourceStock,
      newDestStock
    };
  },

  /**
   * Retrieves stock transfer history
   */
  async getTransfers(businessId: number, options: { storeId?: number; limit?: number; offset?: number } = {}) {
    let query = `
      SELECT 
        st.*,
        p.name as product_name,
        p.sku as product_sku,
        s1.name as from_store_name,
        s2.name as to_store_name,
        u.name as transferred_by_name
      FROM stock_transfers st
      JOIN products p ON st.product_id = p.id
      JOIN stores s1 ON st.from_store_id = s1.id
      JOIN stores s2 ON st.to_store_id = s2.id
      LEFT JOIN users u ON st.transferred_by = u.id
      WHERE st.business_id = ?
    `;
    const params: any[] = [businessId];

    if (options.storeId) {
      query += ' AND (st.from_store_id = ? OR st.to_store_id = ?)';
      params.push(options.storeId, options.storeId);
    }

    query += ' ORDER BY st.created_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);

    return db.query(query, params);
  }
};
