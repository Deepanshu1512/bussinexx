import { db } from '../db/database.ts';
import { auditService } from './auditService.ts';

export interface SupplierInput {
  name: string;
  code?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  payment_terms?: string;
  lead_time_days?: number;
  status?: string;
}

export interface PurchaseOrderItemInput {
  product_id: number;
  quantity: number;
  unit_cost: number;
}

export interface CreatePurchaseOrderInput {
  supplier_id: number;
  store_id?: number | null;
  expected_delivery?: string;
  items: PurchaseOrderItemInput[];
  notes?: string;
}

export const supplierService = {
  /**
   * List suppliers
   */
  async getSuppliers(businessId: number, search?: string) {
    let query = `
      SELECT 
        s.*,
        COUNT(DISTINCT po.id) as total_purchase_orders,
        COALESCE(SUM(po.total_amount), 0) as total_purchased_amount,
        COALESCE(SUM(po.total_amount - po.paid_amount), 0) as total_pending_payment
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.status != 'cancelled'
      WHERE s.business_id = ?
    `;
    const params: any[] = [businessId];

    if (search) {
      query += ' AND (s.name LIKE ? OR s.code LIKE ? OR s.contact_person LIKE ? OR s.gstin LIKE ? OR s.phone LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    query += ' GROUP BY s.id ORDER BY s.name ASC';

    const rows = await db.query(query, params);
    return rows.map(r => ({
      ...r,
      total_purchase_orders: Number(r.total_purchase_orders || 0),
      total_purchased_amount: Number(r.total_purchased_amount || 0),
      outstanding_balance: Number(r.total_pending_payment || 0)
    }));
  },

  /**
   * Get single supplier with purchase history
   */
  async getSupplierById(businessId: number, id: number) {
    const supplier = await db.queryOne(`
      SELECT 
        s.*,
        COUNT(DISTINCT po.id) as total_purchase_orders,
        COALESCE(SUM(po.total_amount), 0) as total_purchased_amount,
        COALESCE(SUM(po.total_amount - po.paid_amount), 0) as total_pending_payment
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.status != 'cancelled'
      WHERE s.business_id = ? AND s.id = ?
      GROUP BY s.id
    `, [businessId, id]);

    if (!supplier) return null;

    const purchaseOrders = await db.query(`
      SELECT po.*, st.name as store_name
      FROM purchase_orders po
      LEFT JOIN stores st ON po.store_id = st.id
      WHERE po.business_id = ? AND po.supplier_id = ?
      ORDER BY po.order_date DESC
    `, [businessId, id]);

    return {
      ...supplier,
      total_purchase_orders: Number(supplier.total_purchase_orders || 0),
      total_purchased_amount: Number(supplier.total_purchased_amount || 0),
      outstanding_balance: Number(supplier.total_pending_payment || 0),
      purchaseOrders: purchaseOrders.map((po: any) => ({
        ...po,
        total_amount: Number(po.total_amount || 0),
        paid_amount: Number(po.paid_amount || 0),
        pending_amount: Number((po.total_amount - po.paid_amount) || 0)
      }))
    };
  },

  /**
   * Create new supplier
   */
  async createSupplier(businessId: number, data: SupplierInput) {
    if (!data.name || !data.name.trim()) throw new Error('Supplier name is required.');

    const countRes = await db.queryOne('SELECT count(*) as cnt FROM suppliers WHERE business_id = ?', [businessId]);
    const nextSeq = Number(countRes?.cnt || 0) + 1;
    const code = data.code ? data.code.trim().toUpperCase() : `SUP-${String(nextSeq).padStart(3, '0')}`;

    const res = await db.execute(`
      INSERT INTO suppliers (
        business_id, name, code, contact_person, email, phone, gstin, address, city, state, pincode, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      data.name.trim(),
      code,
      data.contact_person?.trim() || null,
      data.email?.trim().toLowerCase() || null,
      data.phone?.trim() || null,
      data.gstin?.trim().toUpperCase() || null,
      data.address?.trim() || null,
      data.city?.trim() || null,
      data.state?.trim() || null,
      data.pincode?.trim() || null,
      data.status || 'active'
    ]);

    return this.getSupplierById(businessId, Number(res.lastInsertId));
  },

  /**
   * Update supplier
   */
  async updateSupplier(businessId: number, id: number, data: Partial<SupplierInput>) {
    const current = await db.queryOne('SELECT * FROM suppliers WHERE business_id = ? AND id = ?', [businessId, id]);
    if (!current) throw new Error('Supplier not found.');

    await db.execute(`
      UPDATE suppliers SET
        name = ?,
        code = ?,
        contact_person = ?,
        email = ?,
        phone = ?,
        gstin = ?,
        address = ?,
        city = ?,
        state = ?,
        pincode = ?,
        status = ?
      WHERE business_id = ? AND id = ?
    `, [
      data.name ? data.name.trim() : current.name,
      data.code ? data.code.trim().toUpperCase() : current.code,
      data.contact_person !== undefined ? data.contact_person?.trim() || null : current.contact_person,
      data.email !== undefined ? data.email?.trim().toLowerCase() || null : current.email,
      data.phone !== undefined ? data.phone?.trim() || null : current.phone,
      data.gstin !== undefined ? data.gstin?.trim().toUpperCase() || null : current.gstin,
      data.address !== undefined ? data.address?.trim() || null : current.address,
      data.city !== undefined ? data.city?.trim() || null : current.city,
      data.state !== undefined ? data.state?.trim() || null : current.state,
      data.pincode !== undefined ? data.pincode?.trim() || null : current.pincode,
      data.status || current.status,
      businessId,
      id
    ]);

    return this.getSupplierById(businessId, id);
  },

  /**
   * Delete supplier
   */
  async deleteSupplier(businessId: number, id: number) {
    const poCount = await db.queryOne('SELECT count(*) as cnt FROM purchase_orders WHERE supplier_id = ?', [id]);
    if (Number(poCount?.cnt || 0) > 0) {
      throw new Error('Cannot delete a supplier with existing purchase orders. Mark status as inactive instead.');
    }

    await db.execute('DELETE FROM suppliers WHERE business_id = ? AND id = ?', [businessId, id]);
    return { success: true, message: 'Supplier deleted successfully.' };
  },

  /**
   * List purchase orders
   */
  async getPurchaseOrders(businessId: number, filters: {
    supplier_id?: number;
    store_id?: number;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    let query = `
      SELECT 
        po.*,
        s.name as supplier_name,
        s.code as supplier_code,
        st.name as store_name,
        st.code as store_code,
        (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) as item_count
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN stores st ON po.store_id = st.id
      WHERE po.business_id = ?
    `;
    const params: any[] = [businessId];

    if (filters.supplier_id) {
      query += ' AND po.supplier_id = ?';
      params.push(filters.supplier_id);
    }

    if (filters.store_id) {
      query += ' AND po.store_id = ?';
      params.push(filters.store_id);
    }

    if (filters.status) {
      query += ' AND po.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY po.order_date DESC, po.id DESC';

    if (filters.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(filters.limit, filters.offset || 0);
    }

    const rows = await db.query(query, params);
    return rows.map(r => ({
      ...r,
      subtotal: Number(r.subtotal || 0),
      tax_amount: Number(r.tax_amount || 0),
      total_amount: Number(r.total_amount || 0),
      paid_amount: Number(r.paid_amount || 0),
      pending_amount: Number((r.total_amount - r.paid_amount) || 0),
      item_count: Number(r.item_count || 0)
    }));
  },

  /**
   * Get single purchase order with items
   */
  async getPurchaseOrderById(businessId: number, id: number) {
    const po = await db.queryOne(`
      SELECT 
        po.*,
        s.name as supplier_name,
        s.code as supplier_code,
        s.contact_person,
        s.phone as supplier_phone,
        s.email as supplier_email,
        s.gstin as supplier_gstin,
        st.name as store_name,
        st.code as store_code,
        st.address as store_address
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN stores st ON po.store_id = st.id
      WHERE po.business_id = ? AND po.id = ?
    `, [businessId, id]);

    if (!po) return null;

    const items = await db.query(`
      SELECT poi.*, p.barcode
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      WHERE poi.purchase_order_id = ?
    `, [id]);

    return {
      ...po,
      subtotal: Number(po.subtotal || 0),
      tax_amount: Number(po.tax_amount || 0),
      total_amount: Number(po.total_amount || 0),
      paid_amount: Number(po.paid_amount || 0),
      pending_amount: Number((po.total_amount - po.paid_amount) || 0),
      payment_status: Number(po.paid_amount || 0) >= Number(po.total_amount || 0) ? 'paid' : (Number(po.paid_amount || 0) > 0 ? 'partially_paid' : 'unpaid'),
      items: items.map((it: any) => ({
        ...it,
        quantity: Number(it.quantity || 0),
        quantity_ordered: Number(it.quantity || 0),
        unit_cost: Number(it.unit_cost || 0),
        received_quantity: Number(it.received_quantity || 0),
        quantity_received: Number(it.received_quantity || 0),
        line_total: Number(it.line_total || 0)
      }))
    };
  },

  async getPO(businessId: number, id: number) {
    return this.getPurchaseOrderById(businessId, id);
  },

  async createPO(businessId: number, data: any) {
    const supplier_id = data.supplier_id || data.supplierId;
    const store_id = data.store_id || data.storeId;
    const expected_delivery = data.expected_delivery || data.expectedDeliveryDate;
    const items = (data.items || []).map((i: any) => ({
      product_id: i.product_id || i.productId,
      quantity: Number(i.quantity),
      unit_cost: Number(i.unit_cost !== undefined ? i.unit_cost : i.unitCost)
    }));

    return this.createPurchaseOrder(businessId, {
      supplier_id,
      store_id,
      expected_delivery,
      items,
      notes: data.notes
    });
  },

  async receiveStock(businessId: number, poId: number, data: any) {
    let itemsToReceive: { product_id: number; quantity: number }[] = [];

    if (Array.isArray(data)) {
      itemsToReceive = data;
    } else if (data && data.receivedItems) {
      // Map itemId to product_id if needed
      for (const rec of data.receivedItems) {
        if (rec.product_id) {
          itemsToReceive.push({ product_id: rec.product_id, quantity: rec.quantity || rec.quantityReceived });
        } else if (rec.itemId) {
          const poItem = await db.queryOne('SELECT product_id FROM purchase_order_items WHERE id = ?', [rec.itemId]);
          if (poItem) {
            itemsToReceive.push({ product_id: poItem.product_id, quantity: rec.quantityReceived || rec.quantity || 0 });
          }
        }
      }
    }

    return this.receivePurchaseOrder(businessId, poId, itemsToReceive);
  },

  /**
   * Create Purchase Order
   */
  async createPurchaseOrder(businessId: number, data: CreatePurchaseOrderInput) {
    const { supplier_id, store_id, items, expected_delivery, notes } = data;
    if (!supplier_id || !items || items.length === 0) {
      throw new Error('Supplier and at least one line item are required.');
    }

    const supplier = await db.queryOne('SELECT id, name FROM suppliers WHERE business_id = ? AND id = ?', [businessId, supplier_id]);
    if (!supplier) throw new Error('Supplier not found.');

    let targetStoreId = store_id;
    if (!targetStoreId) {
      const primaryStore = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]);
      targetStoreId = primaryStore ? primaryStore.id : null;
    }

    // Generate unique PO number: PO-2026-B1-0001
    const countRes = await db.queryOne('SELECT count(*) as cnt FROM purchase_orders WHERE business_id = ?', [businessId]);
    const nextSeq = Number(countRes?.cnt || 0) + 1;
    const year = new Date().getFullYear();
    const poNumber = `PO-${year}-B${businessId}-${String(nextSeq).padStart(4, '0')}`;

    let subtotal = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const product = await db.queryOne('SELECT id, name, sku, cost_price FROM products WHERE business_id = ? AND id = ?', [businessId, item.product_id]);
      if (!product) throw new Error(`Product with ID ${item.product_id} not found.`);

      const unitCost = Number(item.unit_cost !== undefined ? item.unit_cost : product.cost_price || 0);
      const lineTotal = Number((unitCost * item.quantity).toFixed(2));
      subtotal += lineTotal;

      validatedItems.push({
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unit_cost: unitCost,
        line_total: lineTotal
      });
    }

    // Standard 18% GST estimate
    const taxAmount = Number((subtotal * 0.18).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    const poRes = await db.execute(`
      INSERT INTO purchase_orders (
        business_id, store_id, supplier_id, po_number, order_date, expected_delivery,
        subtotal, tax_amount, total_amount, paid_amount, status, notes
      ) VALUES (?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, 0.0, 'ordered', ?)
    `, [
      businessId,
      targetStoreId,
      supplier_id,
      poNumber,
      expected_delivery || null,
      subtotal,
      taxAmount,
      totalAmount,
      notes || null
    ]);

    const poId = Number(poRes.lastInsertId);

    for (const it of validatedItems) {
      await db.execute(`
        INSERT INTO purchase_order_items (
          purchase_order_id, product_id, product_name, product_sku, quantity, unit_cost, received_quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `, [
        poId,
        it.product_id,
        it.name,
        it.sku,
        it.quantity,
        it.unit_cost,
        it.line_total
      ]);
    }

    await auditService.log({
      businessId,
      storeId: targetStoreId || undefined,
      action: 'PURCHASE_ORDER_CREATED',
      entityType: 'purchase_order',
      entityId: poId,
      details: { poNumber, supplier: supplier.name, totalAmount }
    });

    return this.getPurchaseOrderById(businessId, poId);
  },

  /**
   * Receive Purchase Order items & automatically update store inventory
   */
  async receivePurchaseOrder(businessId: number, poId: number, receivedItems: { product_id: number; quantity: number }[]) {
    const po = await db.queryOne('SELECT * FROM purchase_orders WHERE business_id = ? AND id = ?', [businessId, poId]);
    if (!po) throw new Error('Purchase order not found.');

    if (po.status === 'received') {
      throw new Error('This purchase order has already been fully received.');
    }

    const storeId = po.store_id || 1;
    let allReceived = true;

    for (const rec of receivedItems) {
      const poItem = await db.queryOne(
        'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ?',
        [poId, rec.product_id]
      );
      if (!poItem) continue;

      const newReceivedTotal = Number(poItem.received_quantity || 0) + Number(rec.quantity);
      await db.execute(
        'UPDATE purchase_order_items SET received_quantity = ? WHERE id = ?',
        [newReceivedTotal, poItem.id]
      );

      if (newReceivedTotal < Number(poItem.quantity)) {
        allReceived = false;
      }

      // Add to store_inventory
      const storeInv = await db.queryOne(
        'SELECT id, stock_quantity FROM store_inventory WHERE store_id = ? AND product_id = ?',
        [storeId, rec.product_id]
      );

      const prevStock = storeInv ? Number(storeInv.stock_quantity || 0) : 0;
      const newStock = prevStock + Number(rec.quantity);

      if (storeInv) {
        await db.execute(
          'UPDATE store_inventory SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStock, storeInv.id]
        );
      } else {
        await db.execute(
          'INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity) VALUES (?, ?, ?, ?)',
          [businessId, storeId, rec.product_id, newStock]
        );
      }

      // Update aggregate product current_stock
      const agg = await db.queryOne('SELECT COALESCE(SUM(stock_quantity), 0) as total FROM store_inventory WHERE product_id = ?', [rec.product_id]);
      await db.execute('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [Number(agg?.total || newStock), rec.product_id]);

      // Log stock addition
      await db.execute(`
        INSERT INTO stock_logs (business_id, store_id, product_id, change_qty, previous_stock, new_stock, reason, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        businessId,
        storeId,
        rec.product_id,
        rec.quantity,
        prevStock,
        newStock,
        `PO Restock #${po.po_number}`,
        String(poId)
      ]);
    }

    const newStatus = allReceived ? 'received' : 'partial';
    await db.execute(`
      UPDATE purchase_orders SET status = ?, received_date = CURRENT_DATE WHERE id = ?
    `, [newStatus, poId]);

    await auditService.log({
      businessId,
      storeId,
      action: 'PURCHASE_ORDER_RECEIVED',
      entityType: 'purchase_order',
      entityId: poId,
      details: { poNumber: po.po_number, status: newStatus }
    });

    return this.getPurchaseOrderById(businessId, poId);
  },

  /**
   * Record payment against purchase order, updating supplier balance & financial expense
   */
  async recordPayment(businessId: number, poId: number, payment: {
    amount: number;
    payment_method?: string;
    notes?: string;
  }) {
    const po = await db.queryOne('SELECT * FROM purchase_orders WHERE business_id = ? AND id = ?', [businessId, poId]);
    if (!po) throw new Error('Purchase order not found.');

    const payAmount = Math.max(0, Number(payment.amount));
    if (payAmount <= 0) throw new Error('Payment amount must be greater than zero.');

    const newPaidAmount = Number((Number(po.paid_amount || 0) + payAmount).toFixed(2));
    await db.execute(
      'UPDATE purchase_orders SET paid_amount = ? WHERE id = ?',
      [newPaidAmount, poId]
    );

    // Synchronize to Expenses table (so financial P&L reflects supplier payments)
    const category = await db.queryOne("SELECT id FROM expense_categories WHERE business_id = ? AND name LIKE '%Supplier%'", [businessId]);
    const categoryId = category ? category.id : null;

    await db.execute(`
      INSERT INTO expenses (
        business_id, store_id, category_id, title, amount, date, payment_method, payment_status,
        reference_type, reference_id, notes
      ) VALUES (?, ?, ?, ?, ?, CURRENT_DATE, ?, 'paid', 'purchase_order', ?, ?)
    `, [
      businessId,
      po.store_id || null,
      categoryId,
      `Supplier Invoice — PO #${po.po_number}`,
      payAmount,
      payment.payment_method || 'bank_transfer',
      String(poId),
      payment.notes || `Disbursed supplier payment for PO #${po.po_number}`
    ]);

    await auditService.log({
      businessId,
      storeId: po.store_id,
      action: 'SUPPLIER_PAYMENT_RECORDED',
      entityType: 'purchase_order',
      entityId: poId,
      details: { poNumber: po.po_number, paidAmount: payAmount, totalPaid: newPaidAmount }
    });

    return this.getPurchaseOrderById(businessId, poId);
  }
};
