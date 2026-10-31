import { db } from '../db/database.ts';

export interface CustomerInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  tier?: 'vip' | 'regular' | 'wholesale' | 'new';
  address?: string;
  notes?: string;
}

export const customerService = {
  getCustomers(search?: string, tier?: string) {
    let query = `
      SELECT 
        c.*,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_spent,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id AND o.status != 'cancelled'
      WHERE 1=1
    `;
    const params: any[] = [];

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
    return db.prepare(query).all(...params);
  },

  getCustomerById(id: number) {
    const customer = db.prepare(`
      SELECT 
        c.*,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_spent,
        COALESCE(AVG(o.total_amount), 0) as avg_order_value,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id AND o.status != 'cancelled'
      WHERE c.id = ?
      GROUP BY c.id
    `).get(id) as any;

    if (!customer) return null;

    // Fetch order history
    const orders = db.prepare(`
      SELECT id, order_number, status, payment_method, total_amount, created_at
      FROM orders
      WHERE customer_id = ?
      ORDER BY created_at DESC
    `).all(id);

    return {
      ...customer,
      orders
    };
  },

  createCustomer(data: CustomerInput) {
    if (data.email) {
      const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(data.email);
      if (existing) {
        throw new Error(`Customer with email '${data.email}' already exists.`);
      }
    }

    const stmt = db.prepare(`
      INSERT INTO customers (name, email, phone, company, tier, address, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.name.trim(),
      data.email?.trim() || null,
      data.phone?.trim() || null,
      data.company?.trim() || null,
      data.tier || 'new',
      data.address?.trim() || null,
      data.notes?.trim() || null
    );

    return this.getCustomerById(Number(result.lastInsertRowid));
  },

  updateCustomer(id: number, data: Partial<CustomerInput>) {
    const current = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
    if (!current) {
      throw new Error(`Customer with ID ${id} not found.`);
    }

    if (data.email && data.email !== current.email) {
      const existing = db.prepare('SELECT id FROM customers WHERE email = ? AND id != ?').get(data.email, id);
      if (existing) {
        throw new Error(`Customer with email '${data.email}' already exists.`);
      }
    }

    const stmt = db.prepare(`
      UPDATE customers 
      SET name = ?, email = ?, phone = ?, company = ?, tier = ?, address = ?, notes = ?
      WHERE id = ?
    `);

    stmt.run(
      data.name ?? current.name,
      data.email !== undefined ? (data.email?.trim() || null) : current.email,
      data.phone !== undefined ? (data.phone?.trim() || null) : current.phone,
      data.company !== undefined ? (data.company?.trim() || null) : current.company,
      data.tier ?? current.tier,
      data.address !== undefined ? (data.address?.trim() || null) : current.address,
      data.notes !== undefined ? (data.notes?.trim() || null) : current.notes,
      id
    );

    return this.getCustomerById(id);
  },

  deleteCustomer(id: number) {
    // Foreign key is ON DELETE SET NULL on orders, so orders keep financial record while customer profile is deleted
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    return { success: true, message: 'Customer record deleted.' };
  }
};
