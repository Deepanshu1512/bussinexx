import { db } from '../db/database.ts';
import { auditService } from './auditService.ts';

export interface ExpenseInput {
  store_id?: number | null;
  category_id?: number | null;
  title: string;
  amount: number;
  date?: string;
  expense_date?: string;
  vendor_name?: string;
  payment_method?: string;
  payment_status?: 'paid' | 'pending';
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  attachment_url?: string;
}

export const expenseService = {
  /**
   * List expense categories
   */
  async getCategories(businessId: number) {
    return db.query(`
      SELECT ec.*, COUNT(e.id) as expense_count, COALESCE(SUM(e.amount), 0) as total_spent
      FROM expense_categories ec
      LEFT JOIN expenses e ON e.category_id = ec.id AND e.business_id = ec.business_id
      WHERE ec.business_id = ?
      GROUP BY ec.id
      ORDER BY ec.name ASC
    `, [businessId]);
  },

  /**
   * Create custom expense category
   */
  async createCategory(businessId: number, name: string) {
    if (!name || !name.trim()) throw new Error('Category name is required.');
    const clean = name.trim();

    const existing = await db.queryOne(
      'SELECT id FROM expense_categories WHERE business_id = ? AND name = ?',
      [businessId, clean]
    );
    if (existing) throw new Error(`Category '${clean}' already exists.`);

    const res = await db.execute(
      'INSERT INTO expense_categories (business_id, name, is_system) VALUES (?, ?, 0)',
      [businessId, clean]
    );
    return { id: Number(res.lastInsertId), name: clean, is_system: 0 };
  },

  /**
   * List expenses with filters
   */
  async getExpenses(businessId: number, filters: {
    store_id?: number;
    category_id?: number;
    start_date?: string;
    end_date?: string;
    payment_status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    let query = `
      SELECT 
        e.*,
        ec.name as category_name,
        s.name as store_name,
        s.code as store_code
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE e.business_id = ?
    `;
    const params: any[] = [businessId];

    if (filters.store_id) {
      query += ' AND e.store_id = ?';
      params.push(filters.store_id);
    }

    if (filters.category_id) {
      query += ' AND e.category_id = ?';
      params.push(filters.category_id);
    }

    if (filters.payment_status) {
      query += ' AND e.payment_status = ?';
      params.push(filters.payment_status);
    }

    if (filters.start_date && filters.end_date) {
      query += ' AND e.date BETWEEN ? AND ?';
      params.push(filters.start_date, filters.end_date);
    } else if (filters.start_date) {
      query += ' AND e.date >= ?';
      params.push(filters.start_date);
    }

    if (filters.search) {
      query += ' AND (e.title LIKE ? OR e.notes LIKE ? OR ec.name LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY e.date DESC, e.id DESC';

    if (filters.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(filters.limit, filters.offset || 0);
    }

    const rows = await db.query(query, params);
    return rows.map(r => ({
      ...r,
      amount: Number(r.amount || 0)
    }));
  },

  /**
   * Create an expense entry
   */
  async createExpense(businessId: number, data: ExpenseInput) {
    if (!data.title || data.amount === undefined) {
      throw new Error('Expense title and amount are required.');
    }

    const amount = Math.max(0, Number(data.amount));
    if (amount <= 0) throw new Error('Expense amount must be greater than zero.');

    let targetStoreId = data.store_id;
    if (!targetStoreId) {
      const primaryStore = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]);
      targetStoreId = primaryStore ? primaryStore.id : null;
    }

    const res = await db.execute(`
      INSERT INTO expenses (
        business_id, store_id, category_id, title, amount, date, payment_method, payment_status,
        reference_type, reference_id, notes, attachment_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      targetStoreId,
      data.category_id || null,
      data.title.trim(),
      amount,
      data.date || new Date().toISOString().slice(0, 10),
      data.payment_method || 'bank_transfer',
      data.payment_status || 'paid',
      data.reference_type || 'direct',
      data.reference_id || null,
      data.notes?.trim() || null,
      data.attachment_url || null
    ]);

    const newId = Number(res.lastInsertId);

    await auditService.log({
      businessId,
      storeId: targetStoreId || undefined,
      action: 'EXPENSE_RECORDED',
      entityType: 'expense',
      entityId: newId,
      details: { title: data.title, amount, date: data.date }
    });

    return db.queryOne('SELECT * FROM expenses WHERE id = ?', [newId]);
  },

  /**
   * Delete an expense entry
   */
  async deleteExpense(businessId: number, id: number) {
    const expense = await db.queryOne('SELECT * FROM expenses WHERE business_id = ? AND id = ?', [businessId, id]);
    if (!expense) throw new Error('Expense record not found.');

    await db.execute('DELETE FROM expenses WHERE business_id = ? AND id = ?', [businessId, id]);

    await auditService.log({
      businessId,
      storeId: expense.store_id,
      action: 'EXPENSE_DELETED',
      entityType: 'expense',
      entityId: id,
      details: { title: expense.title, amount: expense.amount }
    });

    return { success: true, message: 'Expense deleted successfully.' };
  },

  /**
   * Financial Profit & Loss (P&L), Cash Flow, and Balance Overview
   */
  async getFinancialOverview(businessId: number, filters: { store_id?: number; start_date?: string; end_date?: string } = {}) {
    let orderWhere = "WHERE o.business_id = ? AND o.status = 'completed'";
    let expenseWhere = "WHERE e.business_id = ? AND e.payment_status = 'paid'";
    let receivableWhere = "WHERE o.business_id = ? AND o.status != 'cancelled' AND o.payment_status != 'paid'";

    const orderParams: any[] = [businessId];
    const expenseParams: any[] = [businessId];
    const recParams: any[] = [businessId];

    if (filters.store_id) {
      orderWhere += ' AND o.store_id = ?';
      expenseWhere += ' AND e.store_id = ?';
      receivableWhere += ' AND o.store_id = ?';
      orderParams.push(filters.store_id);
      expenseParams.push(filters.store_id);
      recParams.push(filters.store_id);
    }

    if (filters.start_date && filters.end_date) {
      orderWhere += ' AND o.created_at BETWEEN ? AND ?';
      expenseWhere += ' AND e.date BETWEEN ? AND ?';
      orderParams.push(filters.start_date, filters.end_date);
      expenseParams.push(filters.start_date, filters.end_date);
    }

    // 1. Revenue
    const revRes = await db.queryOne(`
      SELECT 
        COALESCE(SUM(o.total_amount), 0) as gross_revenue,
        COALESCE(SUM(o.tax_amount), 0) as total_tax_collected,
        COUNT(o.id) as total_orders
      FROM orders o ${orderWhere}
    `, orderParams);

    const grossRevenue = Number(revRes?.gross_revenue || 0);
    const taxCollected = Number(revRes?.total_tax_collected || 0);

    // 2. Cost of Goods Sold (COGS)
    const cogsRes = await db.queryOne(`
      SELECT COALESCE(SUM(oi.quantity * oi.unit_cost), 0) as total_cogs
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      ${orderWhere}
    `, orderParams);

    const cogs = Number(cogsRes?.total_cogs || 0);
    const grossProfit = Number((grossRevenue - cogs).toFixed(2));
    const grossMarginPercent = grossRevenue > 0 ? Number(((grossProfit / grossRevenue) * 100).toFixed(1)) : 0;

    // 3. Operating Expenses
    const expRes = await db.queryOne(`
      SELECT COALESCE(SUM(e.amount), 0) as total_operating_expenses
      FROM expenses e ${expenseWhere}
    `, expenseParams);

    const totalOperatingExpenses = Number(expRes?.total_operating_expenses || 0);
    const netProfit = Number((grossProfit - totalOperatingExpenses).toFixed(2));
    const netMarginPercent = grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;

    // 4. Accounts Receivable (Money customers owe the business)
    const recRes = await db.queryOne(`
      SELECT COALESCE(SUM(o.total_amount), 0) as total_receivable
      FROM orders o ${receivableWhere}
    `, recParams);
    const accountsReceivable = Number(recRes?.total_receivable || 0);

    // 5. Accounts Payable (Money business owes to suppliers & pending payroll)
    let poWhere = "WHERE business_id = ? AND status != 'cancelled'";
    const poParams: any[] = [businessId];
    if (filters.store_id) {
      poWhere += ' AND store_id = ?';
      poParams.push(filters.store_id);
    }
    const payRes = await db.queryOne(`
      SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total_payable
      FROM purchase_orders ${poWhere}
    `, poParams);

    let payrWhere = "WHERE business_id = ? AND status != 'paid'";
    const payrParams: any[] = [businessId];
    if (filters.store_id) {
      payrWhere += ' AND store_id = ?';
      payrParams.push(filters.store_id);
    }
    const pendingPayrollRes = await db.queryOne(`
      SELECT COALESCE(SUM(total_amount), 0) as pending_salaries
      FROM payrolls ${payrWhere}
    `, payrParams);

    const accountsPayable = Number(payRes?.total_payable || 0) + Number(pendingPayrollRes?.pending_salaries || 0);

    // 6. Expense Breakdown by Category
    const categoryBreakdown = await db.query(`
      SELECT ec.name, COALESCE(SUM(e.amount), 0) as amount
      FROM expense_categories ec
      JOIN expenses e ON e.category_id = ec.id
      ${expenseWhere.replace('WHERE e.', 'WHERE ec.business_id = ' + businessId + ' AND e.')}
      GROUP BY ec.id, ec.name
      ORDER BY amount DESC
    `, expenseParams);

    return {
      revenue: grossRevenue,
      cogs,
      gross_profit: grossProfit,
      operating_expenses: totalOperatingExpenses,
      net_profit: netProfit,
      profit_margin_pct: grossMarginPercent,
      accounts_payable: accountsPayable,
      accounts_receivable: accountsReceivable,
      cash_flow: {
        total_inflows: grossRevenue,
        total_outflows: totalOperatingExpenses,
        net_cash_flow: Number((grossRevenue - totalOperatingExpenses).toFixed(2)),
        inflows: grossRevenue,
        outflows: totalOperatingExpenses,
        netCashFlow: Number((grossRevenue - totalOperatingExpenses).toFixed(2))
      },
      workingCapital: {
        accountsReceivable,
        accountsPayable,
        netWorkingLiability: Number((accountsPayable - accountsReceivable).toFixed(2))
      },
      revenue_details: {
        grossRevenue,
        cogs,
        grossProfit,
        grossMarginPercent,
        taxCollected,
        completedOrders: Number(revRes?.total_orders || 0)
      },
      expenses_details: {
        totalOperatingExpenses,
        categoryBreakdown: categoryBreakdown.map(c => ({ name: c.name, amount: Number(c.amount) }))
      },
      netProfit,
      netMarginPercent,
      cashFlow: {
        inflows: grossRevenue,
        outflows: totalOperatingExpenses,
        netCashFlow: Number((grossRevenue - totalOperatingExpenses).toFixed(2))
      }
    };
  }
};
