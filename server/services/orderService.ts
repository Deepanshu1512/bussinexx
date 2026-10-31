import { db } from '../db/database.ts';

export interface OrderItemInput {
  product_id: number;
  quantity: number;
  unit_price?: number; // optional override, defaults to current product price
}

export interface CreateOrderInput {
  customer_id?: number | null;
  items: OrderItemInput[];
  payment_method?: 'card' | 'bank_transfer' | 'cash' | 'invoice' | 'credit';
  payment_status?: 'paid' | 'pending' | 'refunded';
  status?: 'pending' | 'processing' | 'completed' | 'cancelled';
  discount_amount?: number;
  notes?: string;
}

export const orderService = {
  getOrders(filters: { search?: string; status?: string; customer_id?: number; limit?: number; offset?: number } = {}) {
    let query = `
      SELECT 
        o.*,
        c.name as customer_name,
        c.email as customer_email,
        c.company as customer_company,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

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

    return db.prepare(query).all(...params);
  },

  getOrderById(id: number) {
    const order = db.prepare(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company as customer_company,
        c.address as customer_address
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(id) as any;

    if (!order) return null;

    const items = db.prepare(`
      SELECT oi.*, p.sku as current_sku, p.current_stock
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(id);

    return {
      ...order,
      items
    };
  },

  createOrder(data: CreateOrderInput) {
    if (!data.items || data.items.length === 0) {
      throw new Error('An order must contain at least one item.');
    }

    // Get current tax rate from settings
    const taxSetting = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get() as { value: string } | undefined;
    const taxRatePercent = taxSetting ? parseFloat(taxSetting.value) : 8.5;
    const taxMultiplier = taxRatePercent / 100;

    db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Fetch products and validate availability
      let subtotal = 0;
      const preparedItems: any[] = [];

      for (const item of data.items) {
        if (!item.product_id || item.quantity <= 0) {
          throw new Error('Each order item must have a valid product ID and quantity greater than 0.');
        }

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as any;
        if (!product) {
          throw new Error(`Product with ID ${item.product_id} not found.`);
        }

        if (product.status === 'archived') {
          throw new Error(`Product '${product.name}' is archived and cannot be ordered.`);
        }

        // Deduct inventory if status is completed or processing
        const deductStock = data.status !== 'cancelled' && data.status !== 'pending';
        if (deductStock && product.current_stock < item.quantity) {
          throw new Error(`Insufficient stock for '${product.name}'. Current stock: ${product.current_stock}, Requested: ${item.quantity}`);
        }

        const unitCost = product.cost_price;
        const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : product.selling_price;
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

      // Generate human-friendly order number
      const countRes = db.prepare('SELECT count(*) as cnt FROM orders').get() as { cnt: number };
      const nextSeq = countRes.cnt + 1001;
      const orderNumber = `ORD-${new Date().getFullYear()}-${nextSeq}`;

      const initialStatus = data.status || 'completed';
      const initialPayStatus = data.payment_status || (initialStatus === 'completed' ? 'paid' : 'pending');

      const orderStmt = db.prepare(`
        INSERT INTO orders (
          order_number, customer_id, status, payment_method, payment_status,
          subtotal, discount_amount, tax_amount, total_amount, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const orderResult = orderStmt.run(
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
      );

      const orderId = Number(orderResult.lastInsertRowid);

      // Insert line items & deduct stock
      const itemStmt = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, product_sku,
          unit_cost, unit_price, quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of preparedItems) {
        itemStmt.run(
          orderId,
          item.product.id,
          item.product.name,
          item.product.sku,
          item.unitCost,
          item.unitPrice,
          item.quantity,
          item.lineTotal
        );

        // Deduct stock if order is active
        if (initialStatus === 'completed' || initialStatus === 'processing') {
          const newStock = item.product.current_stock - item.quantity;
          db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newStock, item.product.id);

          db.prepare(`
            INSERT INTO stock_logs (product_id, change_qty, previous_stock, new_stock, reason, reference_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            item.product.id,
            -item.quantity,
            item.product.current_stock,
            newStock,
            `Order ${orderNumber}`,
            String(orderId)
          );
        }
      }

      db.exec('COMMIT;');
      return this.getOrderById(orderId);
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  updateOrderStatus(orderId: number, newStatus: 'pending' | 'processing' | 'completed' | 'cancelled') {
    db.exec('BEGIN TRANSACTION;');
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      if (!order) {
        throw new Error('Order not found.');
      }

      if (order.status === newStatus) {
        db.exec('COMMIT;');
        return this.getOrderById(orderId);
      }

      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];

      // If cancelling an order that was completed/processing, restore inventory
      if (newStatus === 'cancelled' && (order.status === 'completed' || order.status === 'processing')) {
        for (const it of items) {
          const prod = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(it.product_id) as any;
          if (prod) {
            const restoredStock = prod.current_stock + it.quantity;
            db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(restoredStock, it.product_id);

            db.prepare(`
              INSERT INTO stock_logs (product_id, change_qty, previous_stock, new_stock, reason, reference_id)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(it.product_id, it.quantity, prod.current_stock, restoredStock, `Cancelled Order ${order.order_number}`, String(orderId));
          }
        }
      }

      // If re-activating a cancelled or pending order to completed/processing, deduct inventory
      if ((newStatus === 'completed' || newStatus === 'processing') && (order.status === 'cancelled' || order.status === 'pending')) {
        for (const it of items) {
          const prod = db.prepare('SELECT current_stock, name FROM products WHERE id = ?').get(it.product_id) as any;
          if (prod) {
            if (prod.current_stock < it.quantity) {
              throw new Error(`Cannot complete order. Product '${prod.name}' has only ${prod.current_stock} in stock (requires ${it.quantity}).`);
            }
            const deductedStock = prod.current_stock - it.quantity;
            db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(deductedStock, it.product_id);

            db.prepare(`
              INSERT INTO stock_logs (product_id, change_qty, previous_stock, new_stock, reason, reference_id)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(it.product_id, -it.quantity, prod.current_stock, deductedStock, `Fulfilled Order ${order.order_number}`, String(orderId));
          }
        }
      }

      const newPayStatus = newStatus === 'completed' ? 'paid' : (newStatus === 'cancelled' ? 'refunded' : order.payment_status);

      db.prepare(`
        UPDATE orders 
        SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newStatus, newPayStatus, orderId);

      db.exec('COMMIT;');
      return this.getOrderById(orderId);
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
};
