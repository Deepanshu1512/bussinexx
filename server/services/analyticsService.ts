import { db } from '../db/database.ts';

export const analyticsService = {
  getExecutiveSummary() {
    // 1. Overall Revenue & Orders
    const revenueStats = db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as gross_revenue,
        COALESCE(SUM(subtotal), 0) as total_subtotal,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(SUM(tax_amount), 0) as total_tax,
        COUNT(id) as total_orders,
        COALESCE(AVG(total_amount), 0) as avg_order_value
      FROM orders
      WHERE status != 'cancelled'
    `).get() as any;

    // 2. Cost of Goods Sold (COGS) & Profit
    const profitStats = db.prepare(`
      SELECT 
        COALESCE(SUM(oi.quantity * oi.unit_cost), 0) as cogs,
        COALESCE(SUM(oi.line_total), 0) as revenue_from_items
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
    `).get() as any;

    const grossRevenue = Number(revenueStats.gross_revenue.toFixed(2));
    const cogs = Number(profitStats.cogs.toFixed(2));
    const netProfit = Number((grossRevenue - cogs).toFixed(2));
    const profitMargin = grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;

    // 3. Customer Metrics
    const customerStats = db.prepare(`
      SELECT 
        COUNT(id) as total_customers,
        (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE status != 'cancelled' AND customer_id IS NOT NULL) as active_customers
      FROM customers
    `).get() as any;

    // 4. Inventory Metrics
    const invStats = db.prepare(`
      SELECT 
        COUNT(id) as total_products,
        COALESCE(SUM(current_stock), 0) as total_units_in_stock,
        COALESCE(SUM(current_stock * cost_price), 0) as total_inventory_cost_value,
        COALESCE(SUM(current_stock * selling_price), 0) as total_inventory_retail_value,
        COALESCE(SUM(CASE WHEN current_stock <= min_stock_threshold THEN 1 ELSE 0 END), 0) as low_stock_count,
        COALESCE(SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END), 0) as out_of_stock_count
      FROM products
      WHERE status = 'active'
    `).get() as any;

    return {
      grossRevenue,
      cogs,
      netProfit,
      profitMargin,
      totalOrders: revenueStats.total_orders,
      avgOrderValue: Number(revenueStats.avg_order_value.toFixed(2)),
      totalDiscounts: Number(revenueStats.total_discounts.toFixed(2)),
      totalTax: Number(revenueStats.total_tax.toFixed(2)),
      totalCustomers: customerStats.total_customers,
      activeCustomers: customerStats.active_customers,
      totalProducts: invStats.total_products,
      totalUnitsInStock: invStats.total_units_in_stock,
      inventoryCostValue: Number(invStats.total_inventory_cost_value.toFixed(2)),
      inventoryRetailValue: Number(invStats.total_inventory_retail_value.toFixed(2)),
      lowStockCount: invStats.low_stock_count,
      outOfStockCount: invStats.outOfStockCount
    };
  },

  getRevenueTimeline(days: number = 30) {
    // Generate dates timeline
    const rows = db.prepare(`
      SELECT 
        substr(created_at, 1, 10) as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(id) as orders_count
      FROM orders
      WHERE status != 'cancelled'
        AND created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date ASC
    `).all(days) as any[];

    return rows.map(r => ({
      date: r.date,
      revenue: Number(r.revenue.toFixed(2)),
      orders: r.orders_count
    }));
  },

  getTopSellingProducts(limit: number = 8) {
    return db.prepare(`
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
      WHERE o.status != 'cancelled'
      GROUP BY oi.product_id
      ORDER BY total_revenue DESC
      LIMIT ?
    `).all(limit).map((p: any) => ({
      ...p,
      total_revenue: Number(p.total_revenue.toFixed(2)),
      gross_profit: Number(p.gross_profit.toFixed(2))
    }));
  },

  getCategoryPerformance() {
    return db.prepare(`
      SELECT 
        c.id,
        c.name,
        COUNT(DISTINCT p.id) as product_count,
        COALESCE(SUM(oi.quantity), 0) as units_sold,
        COALESCE(SUM(oi.line_total), 0) as total_revenue
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status != 'cancelled'
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `).all().map((cat: any) => ({
      ...cat,
      total_revenue: Number(cat.total_revenue.toFixed(2))
    }));
  },

  getTopCustomers(limit: number = 6) {
    return db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.company,
        c.tier,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as lifetime_value,
        MAX(o.created_at) as last_order
      FROM customers c
      JOIN orders o ON c.id = o.customer_id
      WHERE o.status != 'cancelled'
      GROUP BY c.id
      ORDER BY lifetime_value DESC
      LIMIT ?
    `).all(limit).map((cust: any) => ({
      ...cust,
      lifetime_value: Number(cust.lifetime_value.toFixed(2))
    }));
  },

  generateExecutiveReport() {
    const summary = this.getExecutiveSummary();
    const topProducts = this.getTopSellingProducts(5);
    const categoryStats = this.getCategoryPerformance();
    const topCustomers = this.getTopCustomers(5);

    // Get low-stock items needing immediate reorder
    const lowStockAlerts = db.prepare(`
      SELECT id, sku, name, current_stock, min_stock_threshold, cost_price, selling_price
      FROM products
      WHERE status = 'active' AND current_stock <= min_stock_threshold
      ORDER BY current_stock ASC
    `).all() as any[];

    // Calculate critical business observations
    const observations = [];
    if (summary.profitMargin > 40) {
      observations.push({ type: 'positive', text: `Strong gross profit margin at ${summary.profitMargin}%, exceeding industry benchmark of 35%.` });
    } else {
      observations.push({ type: 'warning', text: `Gross profit margin is at ${summary.profitMargin}%. Review product pricing and vendor cost structures.` });
    }

    if (lowStockAlerts.length > 0) {
      observations.push({ type: 'urgent', text: `${lowStockAlerts.length} product(s) are below safety stock thresholds, posing imminent fulfillment risks.` });
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
