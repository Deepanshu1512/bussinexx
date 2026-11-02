import { db } from '../db/database.ts';

export interface CustomerInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  tier?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  notes?: string;
}

export const customerService = {
  /**
   * Retrieve customers with real-time calculated spending, order counts, outstanding balance and loyalty points
   */
  async getCustomers(businessId: number, search?: string, tier?: string) {
    let query = `
      SELECT 
        c.*,
        COUNT(CASE WHEN o.status != 'cancelled' THEN o.id ELSE NULL END) as total_orders,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0) as total_spent,
        COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.payment_status != 'paid' THEN o.total_amount ELSE 0 END), 0) as outstanding_balance,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id AND o.business_id = c.business_id
      WHERE c.business_id = ?
    `;
    const params: any[] = [businessId];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (tier) {
      query += ` AND c.tier = ?`;
      params.push(tier);
    }

    query += ` GROUP BY c.id ORDER BY total_spent DESC`;
    const rows = await db.query(query, params);

    return rows.map(r => {
      const spent = Number(r.total_spent || 0);
      const calculatedPoints = Math.floor(spent / 100); // 1 point per ₹100 spent
      const derivedTier = spent >= 50000 ? 'vip' : spent >= 10000 ? 'regular' : 'new';

      return {
        ...r,
        total_orders: Number(r.total_orders || 0),
        total_spent: spent,
        outstanding_balance: Number(r.outstanding_balance || 0),
        loyalty_points: Number(r.loyalty_points || calculatedPoints),
        tier: r.tier && r.tier !== 'regular' ? r.tier : derivedTier
      };
    });
  },

  /**
   * Customer details with order history and loyalty points
   */
  async getCustomerById(businessId: number, id: number) {
    const customer = await db.queryOne(`
      SELECT 
        c.*,
        COUNT(CASE WHEN o.status != 'cancelled' THEN o.id ELSE NULL END) as total_orders,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0) as total_spent,
        COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.payment_status != 'paid' THEN o.total_amount ELSE 0 END), 0) as outstanding_balance,
        COALESCE(AVG(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE NULL END), 0) as avg_order_value,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id AND o.business_id = c.business_id
      WHERE c.business_id = ? AND c.id = ?
      GROUP BY c.id
    `, [businessId, id]);

    if (!customer) return null;

    const orders = await db.query(`
      SELECT id, order_number, status, payment_method, payment_status, total_amount, created_at
      FROM orders
      WHERE business_id = ? AND customer_id = ?
      ORDER BY created_at DESC
    `, [businessId, id]);

    const spent = Number(customer.total_spent || 0);
    const calculatedPoints = Math.floor(spent / 100);
    const derivedTier = spent >= 50000 ? 'vip' : spent >= 10000 ? 'regular' : 'new';

    return {
      ...customer,
      total_orders: Number(customer.total_orders || 0),
      total_spent: spent,
      outstanding_balance: Number(customer.outstanding_balance || 0),
      loyalty_points: Number(customer.loyalty_points || calculatedPoints),
      tier: customer.tier && customer.tier !== 'regular' ? customer.tier : derivedTier,
      avg_order_value: Number(customer.avg_order_value || 0),
      orders: orders.map((o: any) => ({
        ...o,
        total_amount: Number(o.total_amount || 0)
      }))
    };
  },

  async createCustomer(businessId: number, data: CustomerInput) {
    if (!data.name || !data.name.trim()) throw new Error('Customer name is required.');

    const res = await db.execute(`
      INSERT INTO customers (business_id, name, email, phone, company, tier, address, city, state, pincode, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      data.name.trim(),
      data.email?.trim().toLowerCase() || null,
      data.phone?.trim() || null,
      data.company?.trim() || null,
      data.tier || 'regular',
      data.address?.trim() || null,
      data.city?.trim() || null,
      data.state?.trim() || null,
      data.pincode?.trim() || null,
      data.notes?.trim() || null
    ]);

    return this.getCustomerById(businessId, Number(res.lastInsertId));
  },

  async updateCustomer(businessId: number, id: number, data: Partial<CustomerInput>) {
    const current = await db.queryOne('SELECT * FROM customers WHERE business_id = ? AND id = ?', [businessId, id]);
    if (!current) throw new Error('Customer not found.');

    await db.execute(`
      UPDATE customers SET
        name = ?,
        email = ?,
        phone = ?,
        company = ?,
        tier = ?,
        address = ?,
        city = ?,
        state = ?,
        pincode = ?,
        notes = ?
      WHERE business_id = ? AND id = ?
    `, [
      data.name ? data.name.trim() : current.name,
      data.email !== undefined ? data.email?.trim().toLowerCase() || null : current.email,
      data.phone !== undefined ? data.phone?.trim() || null : current.phone,
      data.company !== undefined ? data.company?.trim() || null : current.company,
      data.tier || current.tier,
      data.address !== undefined ? data.address?.trim() || null : current.address,
      data.city !== undefined ? data.city?.trim() || null : current.city,
      data.state !== undefined ? data.state?.trim() || null : current.state,
      data.pincode !== undefined ? data.pincode?.trim() || null : current.pincode,
      data.notes !== undefined ? data.notes?.trim() || null : current.notes,
      businessId,
      id
    ]);

    return this.getCustomerById(businessId, id);
  },

  async deleteCustomer(businessId: number, id: number) {
    const current = await db.queryOne('SELECT * FROM customers WHERE business_id = ? AND id = ?', [businessId, id]);
    if (!current) throw new Error('Customer not found.');

    const orderCount = await db.queryOne('SELECT count(*) as cnt FROM orders WHERE customer_id = ?', [id]);
    if (Number(orderCount?.cnt || 0) > 0) {
      throw new Error('Cannot delete a customer with existing order history. You can mark their notes or tier as inactive.');
    }

    await db.execute('DELETE FROM customers WHERE business_id = ? AND id = ?', [businessId, id]);
    return { success: true, message: 'Customer deleted successfully.' };
  }
};
