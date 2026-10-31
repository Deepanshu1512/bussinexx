import { db } from '../db/database.ts';

export interface OrderItemInput {
  product_id: number;
  quantity: number;
  unit_price?: number;
}

export interface CreateOrderInput {
  customer_id?: number | null;
  items: OrderItemInput[];
  payment_method?: string;
  payment_status?: string;
  status?: string;
  discount_amount?: number;
  notes?: string;
}

export const orderService = {
  async getOrders(businessId: number, filters: { search?: string; status?: string; customer_id?: number; limit?: number; offset?: number } = {}) {
    let query = `
      SELECT 
        o.*,
        c.name as customer_name,
        c.email as customer_email,
        c.company as customer_company,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
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

    query += ` ORDER BY o.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(filters.limit, filters.offset || 0);
    }

    return db.query(query, params);
  },

  async getOrderById(businessId: number, id: number) {
    const order = await db.queryOne(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company as customer_company,
        c.address as customer_address
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
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
      items
    };
  },

  async createOrder(businessId: number, data: CreateOrderInput) {
    if (!data.items || data.items.length === 0) {
      throw new Error('An order must contain at least one item.');
    }

    // Get tax rate from settings
    const taxSetting = await db.queryOne("SELECT value FROM settings WHERE business_id = ? AND key = 'tax_rate'", [businessId]);
    const taxRatePercent = taxSetting ? parseFloat(taxSetting.value) : 8.5;
    const taxMultiplier = taxRatePercent / 100;

    // 1. Fetch products and validate availability
    let subtotal = 0;
    const preparedItems: any[] = [];

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

      const deductStock = data.status !== 'cancelled' && data.status !== 'pending';
      const stock = Number(product.current_stock);
      if (deductStock && stock < item.quantity) {
        throw new Error(`Insufficient stock for '${product.name}'. Current stock: ${stock}, Requested: ${item.quantity}`);
      }

      const unitCost = Number(product.cost_price);
      const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : Number(product.selling_price);
      const lineTotal = Number((unitPrice * item.quantity).toFixed(2));
      subtotal += lineTotal;

      preparedItems.push({
        product,
        unitCost,
        unitPrice,
        quantity: item.quantity,
        lineTotal
      });
    }

    const discount = Math.max(0, Number(data.discount_amount) || 0);
    const taxableAmount = Math.max(0, subtotal - discount);
    const taxAmount = Number((taxableAmount * taxMultiplier).toFixed(2));
    const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));

    const countRes = await db.queryOne('SELECT count(*) as cnt FROM orders WHERE business_id = ?', [businessId]);
    const nextSeq = Number(countRes?.cnt || 0) + 1001;
    const orderNumber = `ORD-${new Date().getFullYear()}-${nextSeq}`;

    const initialStatus = data.status || 'completed';
    const initialPayStatus = data.payment_status || (initialStatus === 'completed' ? 'paid' : 'pending');

    const orderResult = await db.execute(`
      INSERT INTO orders (
        business_id, order_number, customer_id, status, payment_method, payment_status,
        subtotal, discount_amount, tax_amount, total_amount, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
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
        const newStock = Number(item.product.current_stock) - item.quantity;
        await db.execute(
          'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
          [newStock, businessId, item.product.id]
        );

        await db.execute(`
          INSERT INTO stock_logs (business_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          businessId,
          item.product.id,
          -item.quantity,
          Number(item.product.current_stock),
          newStock,
          `Order ${orderNumber}`,
          String(orderId)
        ]);
      }
    }

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

    // Restore stock if cancelling
    if (newStatus === 'cancelled' && (order.status === 'completed' || order.status === 'processing')) {
      for (const it of items) {
        const prod = await db.queryOne('SELECT current_stock FROM products WHERE business_id = ? AND id = ?', [businessId, it.product_id]);
        if (prod) {
          const restoredStock = Number(prod.current_stock) + Number(it.quantity);
          await db.execute(
            'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
            [restoredStock, businessId, it.product_id]
          );

          await db.execute(`
            INSERT INTO stock_logs (business_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [businessId, it.product_id, it.quantity, Number(prod.current_stock), restoredStock, `Cancelled Order ${order.order_number}`, String(orderId)]);
        }
      }
    }

    // Deduct stock if transitioning to completed
    if ((newStatus === 'completed' || newStatus === 'processing') && (order.status === 'cancelled' || order.status === 'pending')) {
      for (const it of items) {
        const prod = await db.queryOne('SELECT current_stock, name FROM products WHERE business_id = ? AND id = ?', [businessId, it.product_id]);
        if (prod) {
          const current = Number(prod.current_stock);
          if (current < it.quantity) {
            throw new Error(`Cannot fulfill order. Product '${prod.name}' has only ${current} in stock (requires ${it.quantity}).`);
          }
          const deductedStock = current - Number(it.quantity);
          await db.execute(
            'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
            [deductedStock, businessId, it.product_id]
          );

          await db.execute(`
            INSERT INTO stock_logs (business_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [businessId, it.product_id, -it.quantity, current, deductedStock, `Fulfilled Order ${order.order_number}`, String(orderId)]);
        }
      }
    }

    const newPayStatus = newStatus === 'completed' ? 'paid' : (newStatus === 'cancelled' ? 'refunded' : order.payment_status);

    await db.execute(
      'UPDATE orders SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND id = ?',
      [newStatus, newPayStatus, businessId, orderId]
    );

    return this.getOrderById(businessId, orderId);
  }
};
