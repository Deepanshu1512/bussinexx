import { db } from '../db/database.ts';

export interface CustomerInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  tier?: string;
  address?: string;
  notes?: string;
}

export const customerService = {
  async getCustomers(businessId: number, search?: string, tier?: string) {
    let query = `
      SELECT 
        c.*,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_spent,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id AND o.status != 'cancelled' AND o.business_id = c.business_id
      WHERE c.business_id = ?
    `;
    const params: any[] = [businessId];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (tier) {
      query += ` AND c.tier = ?`;
      params.push(tier);
    }

    query += ` GROUP BY c.id ORDER BY total_spent DESC`;
    return db.query(query, params);
  },

  async getCustomerById(businessId: number, id: number) {
    const customer = await db.queryOne(`
      SELECT 
        c.*,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_spent,
        COALESCE(AVG(o.total_amount), 0) as avg_order_value,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id AND o.status != 'cancelled' AND o.business_id = c.business_id
      WHERE c.business_id = ? AND c.id = ?
      GROUP BY c.id
    `, [businessId, id]);

    if (!customer) return null;

    const orders = await db.query(`
      SELECT id, order_number, status, payment_method, total_amount, created_at
      FROM orders
      WHERE business_id = ? AND customer_id = ?
      ORDER BY created_at DESC
    `, [businessId, id]);

    return {
      ...customer,
      orders
    };
  },

  async createCustomer(businessId: number, data: CustomerInput) {
    if (data.email) {
      const existing = await db.queryOne(
        'SELECT id FROM customers WHERE business_id = ? AND email = ?',
        [businessId, data.email]
      );
      if (existing) {
        throw new Error(`Customer with email '${data.email}' already exists.`);
      }
    }

    const result = await db.execute(`
      INSERT INTO customers (business_id, name, email, phone, company, tier, address, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      data.name.trim(),
      data.email?.trim() || null,
      data.phone?.trim() || null,
      data.company?.trim() || null,
      data.tier || 'new',
      data.address?.trim() || null,
      data.notes?.trim() || null
    ]);

    return this.getCustomerById(businessId, Number(result.lastInsertId));
  },

  async updateCustomer(businessId: number, id: number, data: Partial<CustomerInput>) {
    const current = await db.queryOne('SELECT * FROM customers WHERE business_id = ? AND id = ?', [businessId, id]);
    if (!current) {
      throw new Error(`Customer with ID ${id} not found.`);
    }

    if (data.email && data.email !== current.email) {
      const existing = await db.queryOne(
        'SELECT id FROM customers WHERE business_id = ? AND email = ? AND id != ?',
        [businessId, data.email, id]
      );
      if (existing) {
        throw new Error(`Customer with email '${data.email}' already exists.`);
      }
    }

    await db.execute(`
      UPDATE customers 
      SET name = ?, email = ?, phone = ?, company = ?, tier = ?, address = ?, notes = ?
      WHERE business_id = ? AND id = ?
    `, [
      data.name ?? current.name,
      data.email !== undefined ? (data.email?.trim() || null) : current.email,
      data.phone !== undefined ? (data.phone?.trim() || null) : current.phone,
      data.company !== undefined ? (data.company?.trim() || null) : current.company,
      data.tier ?? current.tier,
      data.address !== undefined ? (data.address?.trim() || null) : current.address,
      data.notes !== undefined ? (data.notes?.trim() || null) : current.notes,
      businessId,
      id
    ]);

    return this.getCustomerById(businessId, id);
  },

  async deleteCustomer(businessId: number, id: number) {
    await db.execute('DELETE FROM customers WHERE business_id = ? AND id = ?', [businessId, id]);
    return { success: true, message: 'Customer record deleted.' };
  }
};
