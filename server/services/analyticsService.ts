import { db } from '../db/database.ts';

export const analyticsService = {
  async getExecutiveSummary(businessId: number) {
    // 1. Revenue & Orders
    const revenueStats = await db.queryOne(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as gross_revenue,
        COALESCE(SUM(subtotal), 0) as total_subtotal,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(SUM(tax_amount), 0) as total_tax,
        COUNT(id) as total_orders,
        COALESCE(AVG(total_amount), 0) as avg_order_value
      FROM orders
      WHERE business_id = ? AND status != 'cancelled'
    `, [businessId]) || {};

    // 2. Cost of Goods Sold (COGS) & Profit
    const profitStats = await db.queryOne(`
      SELECT 
        COALESCE(SUM(oi.quantity * oi.unit_cost), 0) as cogs,
        COALESCE(SUM(oi.line_total), 0) as revenue_from_items
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.business_id = ? AND o.status != 'cancelled'
    `, [businessId]) || {};

    const grossRevenue = Number(Number(revenueStats.gross_revenue || 0).toFixed(2));
    const cogs = Number(Number(profitStats.cogs || 0).toFixed(2));
    const netProfit = Number((grossRevenue - cogs).toFixed(2));
    const profitMargin = grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;

    // 3. Customer Metrics
    const customerStats = await db.queryOne(`
      SELECT 
        COUNT(id) as total_customers,
        (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE business_id = ? AND status != 'cancelled' AND customer_id IS NOT NULL) as active_customers
      FROM customers
      WHERE business_id = ?
    `, [businessId, businessId]) || {};

    // 4. Inventory Metrics
    const invStats = await db.queryOne(`
      SELECT 
        COUNT(id) as total_products,
        COALESCE(SUM(current_stock), 0) as total_units_in_stock,
        COALESCE(SUM(current_stock * cost_price), 0) as total_inventory_cost_value,
        COALESCE(SUM(current_stock * selling_price), 0) as total_inventory_retail_value,
        COALESCE(SUM(CASE WHEN current_stock <= min_stock_threshold THEN 1 ELSE 0 END), 0) as low_stock_count,
        COALESCE(SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END), 0) as out_of_stock_count
      FROM products
      WHERE business_id = ? AND status = 'active'
    `, [businessId]) || {};

    return {
      grossRevenue,
      cogs,
      netProfit,
      profitMargin,
      totalOrders: Number(revenueStats.total_orders || 0),
      avgOrderValue: Number(Number(revenueStats.avg_order_value || 0).toFixed(2)),
      totalDiscounts: Number(Number(revenueStats.total_discounts || 0).toFixed(2)),
      totalTax: Number(Number(revenueStats.total_tax || 0).toFixed(2)),
      totalCustomers: Number(customerStats.total_customers || 0),
      activeCustomers: Number(customerStats.active_customers || 0),
      totalProducts: Number(invStats.total_products || 0),
      totalUnitsInStock: Number(invStats.total_units_in_stock || 0),
      inventoryCostValue: Number(Number(invStats.total_inventory_cost_value || 0).toFixed(2)),
      inventoryRetailValue: Number(Number(invStats.total_inventory_retail_value || 0).toFixed(2)),
      lowStockCount: Number(invStats.low_stock_count || 0),
      outOfStockCount: Number(invStats.out_of_stock_count || 0)
    };
  },

  async getRevenueTimeline(businessId: number, days: number = 30) {
    const isPg = db.isPostgres;
    const dateSql = isPg
      ? `SELECT 
           to_char(created_at, 'YYYY-MM-DD') as date,
           COALESCE(SUM(total_amount), 0) as revenue,
           COUNT(id) as orders_count
         FROM orders
         WHERE business_id = $1 AND status != 'cancelled'
           AND created_at >= NOW() - ($2 || ' days')::INTERVAL
         GROUP BY to_char(created_at, 'YYYY-MM-DD')
         ORDER BY date ASC`
      : `SELECT 
           substr(created_at, 1, 10) as date,
           COALESCE(SUM(total_amount), 0) as revenue,
           COUNT(id) as orders_count
         FROM orders
         WHERE business_id = ? AND status != 'cancelled'
           AND created_at >= datetime('now', '-' || ? || ' days')
         GROUP BY substr(created_at, 1, 10)
         ORDER BY date ASC`;

    const rows = await db.query(dateSql, [businessId, days]);

    return rows.map(r => ({
      date: r.date,
      revenue: Number(Number(r.revenue).toFixed(2)),
      orders: Number(r.orders_count)
    }));
  },

  async getTopSellingProducts(businessId: number, limit: number = 8) {
    const rows = await db.query(`
      SELECT 
        oi.product_id,
        oi.product_name,
        oi.product_sku,
        SUM(oi.quantity) as units_sold,
        SUM(oi.line_total) as total_revenue,
        SUM(oi.quantity * (oi.unit_price - oi.unit_cost)) as gross_profit,
        p.current_stock,
        p.min_stock_threshold,
        c.name as category_name
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.business_id = ? AND o.status != 'cancelled'
      GROUP BY oi.product_id, oi.product_name, oi.product_sku, p.current_stock, p.min_stock_threshold, c.name
      ORDER BY total_revenue DESC
      LIMIT ?
    `, [businessId, limit]);

    return rows.map((p: any) => ({
      ...p,
      units_sold: Number(p.units_sold),
      total_revenue: Number(Number(p.total_revenue).toFixed(2)),
      gross_profit: Number(Number(p.gross_profit).toFixed(2))
    }));
  },

  async getCategoryPerformance(businessId: number) {
    const rows = await db.query(`
      SELECT 
        c.id,
        c.name,
        COUNT(DISTINCT p.id) as product_count,
        COALESCE(SUM(oi.quantity), 0) as units_sold,
        COALESCE(SUM(oi.line_total), 0) as total_revenue
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.business_id = c.business_id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status != 'cancelled'
      WHERE c.business_id = ?
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC
    `, [businessId]);

    return rows.map((cat: any) => ({
      ...cat,
      product_count: Number(cat.product_count),
      units_sold: Number(cat.units_sold),
      total_revenue: Number(Number(cat.total_revenue).toFixed(2))
    }));
  },

  async getTopCustomers(businessId: number, limit: number = 6) {
    const rows = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.company,
        c.tier,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as lifetime_value,
        MAX(o.created_at) as last_order
      FROM customers c
      JOIN orders o ON c.id = o.customer_id AND o.business_id = c.business_id
      WHERE c.business_id = ? AND o.status != 'cancelled'
      GROUP BY c.id, c.name, c.company, c.tier
      ORDER BY lifetime_value DESC
      LIMIT ?
    `, [businessId, limit]);

    return rows.map((cust: any) => ({
      ...cust,
      total_orders: Number(cust.total_orders),
      lifetime_value: Number(Number(cust.lifetime_value).toFixed(2)),
      last_order: cust.last_order ? String(cust.last_order) : ''
    }));
  },

  async generateExecutiveReport(businessId: number) {
    const summary = await this.getExecutiveSummary(businessId);
    const topProducts = await this.getTopSellingProducts(businessId, 5);
    const categoryStats = await this.getCategoryPerformance(businessId);
    const topCustomers = await this.getTopCustomers(businessId, 5);

    const lowStockAlerts = await db.query(`
      SELECT id, sku, name, current_stock, min_stock_threshold, cost_price, selling_price
      FROM products
      WHERE business_id = ? AND status = 'active' AND current_stock <= min_stock_threshold
      ORDER BY current_stock ASC
    `, [businessId]);

    const observations = [];
    if (summary.profitMargin > 40) {
      observations.push({ type: 'positive', text: `Strong gross profit margin at ${summary.profitMargin}%, exceeding industry benchmark of 35%.` });
    } else {
      observations.push({ type: 'warning', text: `Gross profit margin is at ${summary.profitMargin}%. Review product pricing and vendor cost structures.` });
    }

    if (lowStockAlerts.length > 0) {
      observations.push({ type: 'urgent', text: `${lowStockAlerts.length} product(s) are below safety stock thresholds, posing fulfillment risk.` });
    } else {
      observations.push({ type: 'positive', text: 'All product inventory levels are currently above minimum safety thresholds.' });
    }

    if (summary.activeCustomers > 0 && summary.totalOrders > 0) {
      const ordersPerCustomer = Number((summary.totalOrders / summary.activeCustomers).toFixed(1));
      observations.push({ type: 'insight', text: `Repeat purchase frequency is healthy at ${ordersPerCustomer} orders per active customer.` });
    }

    return {
      generatedAt: new Date().toISOString(),
      summary,
      topProducts,
      categoryStats,
      topCustomers,
      lowStockAlerts,
      observations
    };
  }
};
