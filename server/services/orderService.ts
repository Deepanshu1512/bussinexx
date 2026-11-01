import { db } from '../db/database.ts';
import { auditService } from './auditService.ts';

export interface OrderItemInput {
  product_id: number;
  quantity: number;
  unit_price?: number;
}

export interface CreateOrderInput {
  customer_id?: number | null;
  store_id?: number | null;
  items: OrderItemInput[];
  payment_method?: string;
  payment_status?: string;
  status?: string;
  discount_amount?: number;
  notes?: string;
}

export const orderService = {
  async getOrders(businessId: number, filters: { 
    search?: string; 
    status?: string; 
    customer_id?: number; 
    store_id?: number;
    limit?: number; 
    offset?: number 
  } = {}) {
    let query = `
      SELECT 
        o.*,
        c.name as customer_name,
        c.email as customer_email,
        c.company as customer_company,
        s.name as store_name,
        s.code as store_code,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.business_id = ?
    `;
    const params: any[] = [businessId];

    if (filters.search) {
      query += ` AND (o.order_number LIKE ? OR c.name LIKE ? OR c.company LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    if (filters.status) {
      query += ` AND o.status = ?`;
      params.push(filters.status);
    }

    if (filters.customer_id) {
      query += ` AND o.customer_id = ?`;
      params.push(filters.customer_id);
    }

    if (filters.store_id) {
      query += ` AND o.store_id = ?`;
      params.push(filters.store_id);
    }

    query += ` ORDER BY o.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(filters.limit, filters.offset || 0);
    }

    const rows = await db.query(query, params);
    return rows.map(r => ({
      ...r,
      subtotal: Number(r.subtotal || 0),
      discount_amount: Number(r.discount_amount || 0),
      tax_amount: Number(r.tax_amount || 0),
      total_amount: Number(r.total_amount || 0),
      item_count: Number(r.item_count || 0)
    }));
  },

  async getOrderById(businessId: number, id: number) {
    const order = await db.queryOne(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company as customer_company,
        c.address as customer_address,
        s.name as store_name,
        s.code as store_code
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE o.business_id = ? AND o.id = ?
    `, [businessId, id]);

    if (!order) return null;

    const items = await db.query(`
      SELECT oi.*, p.sku as current_sku, p.current_stock
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [id]);

    return {
      ...order,
      subtotal: Number(order.subtotal || 0),
      discount_amount: Number(order.discount_amount || 0),
      tax_amount: Number(order.tax_amount || 0),
      total_amount: Number(order.total_amount || 0),
      items: items.map((it: any) => ({
        ...it,
        unit_cost: Number(it.unit_cost || 0),
        unit_price: Number(it.unit_price || 0),
        quantity: Number(it.quantity || 0),
        line_total: Number(it.line_total || 0)
      }))
    };
  },

  async createOrder(businessId: number, data: CreateOrderInput) {
    if (!data.items || data.items.length === 0) {
      throw new Error('An order must contain at least one item.');
    }

    // Determine target store
    let targetStoreId = data.store_id;
    if (!targetStoreId) {
      const primaryStore = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]);
      targetStoreId = primaryStore ? Number(primaryStore.id) : 1;
    }

    // Verify store belongs to this business
    const store = await db.queryOne('SELECT id, name FROM stores WHERE business_id = ? AND id = ?', [businessId, targetStoreId]);
    if (!store) {
      throw new Error('The specified store was not found in your business.');
    }

    // Get tax rate from settings (Default 18% GST in India)
    const taxSetting = await db.queryOne("SELECT value FROM settings WHERE business_id = ? AND key = 'tax_rate'", [businessId]);
    const taxRatePercent = taxSetting ? parseFloat(taxSetting.value) : 18.0;
    const taxMultiplier = taxRatePercent / 100;

    // 1. Fetch products and validate store availability
    let subtotal = 0;
    const preparedItems: any[] = [];
    const deductStock = data.status !== 'cancelled' && data.status !== 'pending';

    for (const item of data.items) {
      if (!item.product_id || item.quantity <= 0) {
        throw new Error('Each order item must have a valid product ID and quantity greater than 0.');
      }

      const product = await db.queryOne('SELECT * FROM products WHERE business_id = ? AND id = ?', [businessId, item.product_id]);
      if (!product) {
        throw new Error(`Product with ID ${item.product_id} not found.`);
      }

      if (product.status === 'archived') {
        throw new Error(`Product '${product.name}' is archived and cannot be ordered.`);
      }

      // Check store-specific stock
      const storeInv = await db.queryOne(
        'SELECT stock_quantity FROM store_inventory WHERE store_id = ? AND product_id = ?',
        [targetStoreId, item.product_id]
      );
      const availableStoreStock = storeInv ? Number(storeInv.stock_quantity) : 0;

      if (deductStock && availableStoreStock < item.quantity) {
        throw new Error(`Insufficient stock for '${product.name}' in ${store.name}. Available: ${availableStoreStock}, Requested: ${item.quantity}`);
      }

      const unitCost = Number(product.cost_price || 0);
      const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : Number(product.selling_price || 0);
      const lineTotal = Number((unitPrice * item.quantity).toFixed(2));
      subtotal += lineTotal;

      preparedItems.push({
        product,
        unitCost,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
        prevStoreStock: availableStoreStock
      });
    }

    const discount = Math.max(0, Number(data.discount_amount) || 0);
    const taxableAmount = Math.max(0, subtotal - discount);
    const taxAmount = Number((taxableAmount * taxMultiplier).toFixed(2));
    const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));

    const countRes = await db.queryOne('SELECT count(*) as cnt FROM orders WHERE business_id = ?', [businessId]);
    const nextSeq = Number(countRes?.cnt || 0) + 1;
    const orderNumber = `ORD-${new Date().getFullYear()}-B${businessId}-${String(nextSeq).padStart(4, '0')}`;

    const initialStatus = data.status || 'completed';
    const initialPayStatus = data.payment_status || (initialStatus === 'completed' ? 'paid' : 'pending');

    const orderResult = await db.execute(`
      INSERT INTO orders (
        business_id, store_id, order_number, customer_id, status, payment_method, payment_status,
        subtotal, discount_amount, tax_amount, total_amount, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      targetStoreId,
      orderNumber,
      data.customer_id || null,
      initialStatus,
      data.payment_method || 'card',
      initialPayStatus,
      subtotal,
      discount,
      taxAmount,
      totalAmount,
      data.notes || ''
    ]);

    const orderId = Number(orderResult.lastInsertId);

    for (const item of preparedItems) {
      await db.execute(`
        INSERT INTO order_items (
          order_id, product_id, product_name, product_sku,
          unit_cost, unit_price, quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        item.product.id,
        item.product.name,
        item.product.sku,
        item.unitCost,
        item.unitPrice,
        item.quantity,
        item.lineTotal
      ]);

      if (initialStatus === 'completed' || initialStatus === 'processing') {
        const newStoreStock = item.prevStoreStock - item.quantity;
        
        // Update store_inventory
        await db.execute(
          'UPDATE store_inventory SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ? AND product_id = ?',
          [newStoreStock, targetStoreId, item.product.id]
        );

        // Update overall product aggregate stock
        const agg = await db.queryOne(
          'SELECT COALESCE(SUM(stock_quantity), 0) as total FROM store_inventory WHERE product_id = ?',
          [item.product.id]
        );
        const totalAggStock = Number(agg?.total || 0);

        await db.execute(
          'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
          [totalAggStock, businessId, item.product.id]
        );

        await db.execute(`
          INSERT INTO stock_logs (business_id, store_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          businessId,
          targetStoreId,
          item.product.id,
          -item.quantity,
          item.prevStoreStock,
          newStoreStock,
          `Order ${orderNumber} (${store.name})`,
          String(orderId)
        ]);
      }
    }

    await auditService.log({
      businessId,
      storeId: targetStoreId,
      action: 'ORDER_CREATED',
      entityType: 'order',
      entityId: orderId,
      details: { orderNumber, totalAmount, status: initialStatus }
    });

    return this.getOrderById(businessId, orderId);
  },

  async updateOrderStatus(businessId: number, orderId: number, newStatus: string) {
    const order = await db.queryOne('SELECT * FROM orders WHERE business_id = ? AND id = ?', [businessId, orderId]);
    if (!order) {
      throw new Error('Order not found.');
    }

    if (order.status === newStatus) {
      return this.getOrderById(businessId, orderId);
    }

    const items = await db.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    const storeId = order.store_id || (await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]))?.id || 1;

    // 1. Restore stock if cancelling a fulfilled order
    if (newStatus === 'cancelled' && (order.status === 'completed' || order.status === 'processing')) {
      for (const it of items) {
        const storeInv = await db.queryOne(
          'SELECT stock_quantity FROM store_inventory WHERE store_id = ? AND product_id = ?',
          [storeId, it.product_id]
        );
        const prevStock = storeInv ? Number(storeInv.stock_quantity) : 0;
        const restoredStock = prevStock + Number(it.quantity);

        await db.execute(
          'UPDATE store_inventory SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ? AND product_id = ?',
          [restoredStock, storeId, it.product_id]
        );

        const agg = await db.queryOne(
          'SELECT COALESCE(SUM(stock_quantity), 0) as total FROM store_inventory WHERE product_id = ?',
          [it.product_id]
        );
        await db.execute(
          'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
          [Number(agg?.total || 0), businessId, it.product_id]
        );

        await db.execute(`
          INSERT INTO stock_logs (business_id, store_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          businessId,
          storeId,
          it.product_id,
          it.quantity,
          prevStock,
          restoredStock,
          `Cancelled Order ${order.order_number}`,
          String(orderId)
        ]);
      }
    }

    // 2. Deduct stock if transitioning from cancelled/pending to completed
    if ((newStatus === 'completed' || newStatus === 'processing') && (order.status === 'cancelled' || order.status === 'pending')) {
      for (const it of items) {
        const storeInv = await db.queryOne(
          'SELECT stock_quantity FROM store_inventory WHERE store_id = ? AND product_id = ?',
          [storeId, it.product_id]
        );
        const current = storeInv ? Number(storeInv.stock_quantity) : 0;
        if (current < it.quantity) {
          throw new Error(`Cannot fulfill order. Product '${it.product_name}' has only ${current} in stock (requires ${it.quantity}).`);
        }
        const deductedStock = current - Number(it.quantity);

        await db.execute(
          'UPDATE store_inventory SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ? AND product_id = ?',
          [deductedStock, storeId, it.product_id]
        );

        const agg = await db.queryOne(
          'SELECT COALESCE(SUM(stock_quantity), 0) as total FROM store_inventory WHERE product_id = ?',
          [it.product_id]
        );
        await db.execute(
          'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
          [Number(agg?.total || 0), businessId, it.product_id]
        );

        await db.execute(`
          INSERT INTO stock_logs (business_id, store_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          businessId,
          storeId,
          it.product_id,
          -it.quantity,
          current,
          deductedStock,
          `Fulfilled Order ${order.order_number}`,
          String(orderId)
        ]);
      }
    }

    const newPayStatus = newStatus === 'completed' ? 'paid' : (newStatus === 'cancelled' ? 'refunded' : order.payment_status);

    await db.execute(
      'UPDATE orders SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
      [newStatus, newPayStatus, businessId, orderId]
    );

    await auditService.log({
      businessId,
      storeId,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'order',
      entityId: orderId,
      details: { previousStatus: order.status, newStatus, orderNumber: order.order_number }
    });

    return this.getOrderById(businessId, orderId);
  }
};
