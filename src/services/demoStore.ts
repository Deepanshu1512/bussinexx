import {
  Product,
  Category,
  Customer,
  Order,
  ExecutiveSummary,
  RevenuePoint,
  TopProduct,
  CategoryStat,
  TopCustomer,
  InventoryHealth,
  AppSettings,
} from '../types';

const INITIAL_CATEGORIES: Category[] = [
  { id: 1, name: 'Hardware & Devices', description: 'Enterprise-grade computing devices and peripherals', product_count: 5 },
  { id: 2, name: 'Ergonomic Furniture', description: 'Modern ergonomic office chairs, standing desks, and accessories', product_count: 4 },
  { id: 3, name: 'Displays & Visuals', description: 'Ultra-HD monitors, color-accurate panels, and mounting hardware', product_count: 3 },
  { id: 4, name: 'Audio & Acoustics', description: 'Noise-canceling headsets, conference microphones, and soundbars', product_count: 3 },
  { id: 5, name: 'Premium Peripherals', description: 'Mechanical keyboards, precision mice, and docking stations', product_count: 3 },
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 1,
    category_id: 1,
    sku: 'HW-MBP-16',
    name: 'MacBook Pro 16" M3 Max (64GB/2TB)',
    description: 'Workstation laptop for engineering, CAD, and creative production.',
    cost_price: 2899,
    selling_price: 3899,
    current_stock: 14,
    min_stock_threshold: 5,
    status: 'active',
    category_name: 'Hardware & Devices',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    category_id: 1,
    sku: 'HW-DELL-XPS15',
    name: 'Dell XPS 15 OLED (32GB/1TB)',
    description: 'Thin and light corporate laptop with 3.5K OLED touch display.',
    cost_price: 1650,
    selling_price: 2299,
    current_stock: 4,
    min_stock_threshold: 6,
    status: 'active',
    category_name: 'Hardware & Devices',
    created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 3,
    category_id: 2,
    sku: 'FURN-HM-AERON',
    name: 'Herman Miller Aeron Ergonomic Chair',
    description: 'Pioneering ergonomic mesh chair with PostureFit SL lumbar support.',
    cost_price: 850,
    selling_price: 1495,
    current_stock: 18,
    min_stock_threshold: 8,
    status: 'active',
    category_name: 'Ergonomic Furniture',
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 4,
    category_id: 2,
    sku: 'FURN-DESK-PRO',
    name: 'Apex Dual-Motor Electric Standing Desk (72x30")',
    description: 'Solid walnut butcher-block desktop with memory presets and anti-collision.',
    cost_price: 480,
    selling_price: 899,
    current_stock: 3,
    min_stock_threshold: 5,
    status: 'active',
    category_name: 'Ergonomic Furniture',
    created_at: new Date(Date.now() - 22 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 5,
    category_id: 3,
    sku: 'DISP-DELL-U32',
    name: 'Dell UltraSharp 32" 4K Thunderbolt Hub Monitor',
    description: 'IPS Black technology panel with 90W USB-C power delivery and daisy chaining.',
    cost_price: 620,
    selling_price: 989,
    current_stock: 9,
    min_stock_threshold: 4,
    status: 'active',
    category_name: 'Displays & Visuals',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 6,
    category_id: 3,
    sku: 'DISP-APPL-STUDIO',
    name: 'Apple Studio Display (5K Nano-Texture)',
    description: '27-inch 5K Retina display with 12MP Ultra Wide camera and Center Stage.',
    cost_price: 1350,
    selling_price: 1899,
    current_stock: 7,
    min_stock_threshold: 3,
    status: 'active',
    category_name: 'Displays & Visuals',
    created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 7,
    category_id: 4,
    sku: 'AUD-SONY-XM5',
    name: 'Sony WH-1000XM5 Wireless ANC Headphones',
    description: 'Industry-leading noise cancellation with auto NC optimizer and speak-to-chat.',
    cost_price: 240,
    selling_price: 399,
    current_stock: 22,
    min_stock_threshold: 10,
    status: 'active',
    category_name: 'Audio & Acoustics',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 8,
    category_id: 5,
    sku: 'PERIPH-KEY-Q1',
    name: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
    description: 'QMK/VIA wireless mechanical keyboard with CNC aluminum chassis and hot-swap.',
    cost_price: 120,
    selling_price: 219,
    current_stock: 2,
    min_stock_threshold: 5,
    status: 'active',
    category_name: 'Premium Peripherals',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 9,
    category_id: 5,
    sku: 'PERIPH-LOGI-MX3S',
    name: 'Logitech MX Master 3S Performance Wireless Mouse',
    description: 'Quiet clicks and 8K DPI track-on-glass sensor with MagSpeed electromagnetic wheel.',
    cost_price: 65,
    selling_price: 109,
    current_stock: 35,
    min_stock_threshold: 12,
    status: 'active',
    category_name: 'Premium Peripherals',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 1, name: 'Elena Rostova', company: 'Apex BioTech Dynamics', email: 'e.rostova@apexbio.io', phone: '+1 (555) 019-2831', tier: 'enterprise', total_spent: 24890, orders_count: 5, created_at: new Date(Date.now() - 60 * 86400000).toISOString() },
  { id: 2, name: 'Marcus Sterling', company: 'Sterling Capital Partners', email: 'm.sterling@sterlingcap.com', phone: '+1 (555) 014-9922', tier: 'enterprise', total_spent: 18450, orders_count: 4, created_at: new Date(Date.now() - 50 * 86400000).toISOString() },
  { id: 3, name: 'Aria Chen', company: 'Nova Design Collective', email: 'aria@novadesign.co', phone: '+1 (555) 018-4412', tier: 'regular', total_spent: 9820, orders_count: 3, created_at: new Date(Date.now() - 40 * 86400000).toISOString() },
  { id: 4, name: 'David Vance', company: 'Vance Architecture Studio', email: 'dvance@vancestudio.design', phone: '+1 (555) 012-3844', tier: 'vip', total_spent: 14200, orders_count: 3, created_at: new Date(Date.now() - 35 * 86400000).toISOString() },
  { id: 5, name: 'Kavita Patel', company: 'Synthetix Quantum Labs', email: 'k.patel@synthetixql.com', phone: '+1 (555) 017-6623', tier: 'enterprise', total_spent: 22100, orders_count: 4, created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 1,
    order_number: 'ORD-2026-1001',
    customer_id: 1,
    customer_name: 'Elena Rostova',
    customer_company: 'Apex BioTech Dynamics',
    subtotal: 7798,
    discount_amount: 200,
    tax_amount: 645.83,
    total_amount: 8243.83,
    status: 'completed',
    payment_method: 'credit_card',
    payment_status: 'paid',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    items: [
      { id: 1, order_id: 1, product_id: 1, product_name: 'MacBook Pro 16" M3 Max (64GB/2TB)', product_sku: 'HW-MBP-16', quantity: 2, unit_cost: 2899, unit_price: 3899, line_total: 7798 },
    ],
  },
  {
    id: 2,
    order_number: 'ORD-2026-1002',
    customer_id: 2,
    customer_name: 'Marcus Sterling',
    customer_company: 'Sterling Capital Partners',
    subtotal: 4485,
    discount_amount: 150,
    tax_amount: 368.48,
    total_amount: 4703.48,
    status: 'completed',
    payment_method: 'bank_transfer',
    payment_status: 'paid',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    items: [
      { id: 2, order_id: 2, product_id: 3, product_name: 'Herman Miller Aeron Ergonomic Chair', product_sku: 'FURN-HM-AERON', quantity: 3, unit_cost: 850, unit_price: 1495, line_total: 4485 },
    ],
  },
  {
    id: 3,
    order_number: 'ORD-2026-1003',
    customer_id: 3,
    customer_name: 'Aria Chen',
    customer_company: 'Nova Design Collective',
    subtotal: 2697,
    discount_amount: 0,
    tax_amount: 229.25,
    total_amount: 2926.25,
    status: 'processing',
    payment_method: 'credit_card',
    payment_status: 'paid',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    items: [
      { id: 3, order_id: 3, product_id: 4, product_name: 'Apex Dual-Motor Electric Standing Desk (72x30")', product_sku: 'FURN-DESK-PRO', quantity: 3, unit_cost: 480, unit_price: 899, line_total: 2697 },
    ],
  },
  {
    id: 4,
    order_number: 'ORD-2026-1004',
    customer_id: 5,
    customer_name: 'Kavita Patel',
    customer_company: 'Synthetix Quantum Labs',
    subtotal: 5934,
    discount_amount: 300,
    tax_amount: 478.89,
    total_amount: 6112.89,
    status: 'completed',
    payment_method: 'bank_transfer',
    payment_status: 'paid',
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    items: [
      { id: 4, order_id: 4, product_id: 5, product_name: 'Dell UltraSharp 32" 4K Thunderbolt Hub Monitor', product_sku: 'DISP-DELL-U32', quantity: 6, unit_cost: 620, unit_price: 989, line_total: 5934 },
    ],
  },
];

class DemoStore {
  private productsKey = 'bussinex_guest_products';
  private categoriesKey = 'bussinex_guest_categories';
  private customersKey = 'bussinex_guest_customers';
  private ordersKey = 'bussinex_guest_orders';

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(this.productsKey)) {
      localStorage.setItem(this.productsKey, JSON.stringify(INITIAL_PRODUCTS));
    }
    if (!localStorage.getItem(this.categoriesKey)) {
      localStorage.setItem(this.categoriesKey, JSON.stringify(INITIAL_CATEGORIES));
    }
    if (!localStorage.getItem(this.customersKey)) {
      localStorage.setItem(this.customersKey, JSON.stringify(INITIAL_CUSTOMERS));
    }
    if (!localStorage.getItem(this.ordersKey)) {
      localStorage.setItem(this.ordersKey, JSON.stringify(INITIAL_ORDERS));
    }
  }

  getProducts(filters: { search?: string; category_id?: number; status?: string; low_stock?: boolean } = {}): Product[] {
    this.ensureInitialized();
    const raw = localStorage.getItem(this.productsKey);
    let list: Product[] = raw ? JSON.parse(raw) : INITIAL_PRODUCTS;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (filters.category_id) {
      list = list.filter((p) => Number(p.category_id) === Number(filters.category_id));
    }
    if (filters.status) {
      list = list.filter((p) => p.status === filters.status);
    }
    if (filters.low_stock) {
      list = list.filter((p) => p.current_stock <= p.min_stock_threshold);
    }
    return list;
  }

  createProduct(data: Partial<Product>): Product {
    this.ensureInitialized();
    const list = this.getProducts();
    const categories = this.getCategories();
    const cat = categories.find((c) => c.id === Number(data.category_id));

    const newProd: Product = {
      id: Date.now(),
      category_id: data.category_id ? Number(data.category_id) : null,
      sku: data.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: data.name || 'Untitled Product',
      description: data.description || '',
      cost_price: Number(data.cost_price) || 0,
      selling_price: Number(data.selling_price) || 0,
      current_stock: Number(data.current_stock) || 0,
      min_stock_threshold: Number(data.min_stock_threshold) || 5,
      status: data.status || 'active',
      category_name: cat ? cat.name : 'General',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    list.unshift(newProd);
    localStorage.setItem(this.productsKey, JSON.stringify(list));
    return newProd;
  }

  updateProduct(id: number, data: Partial<Product>): Product {
    this.ensureInitialized();
    const list = this.getProducts();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found in demo workspace');

    const categories = this.getCategories();
    const catId = data.category_id !== undefined ? Number(data.category_id) : list[idx].category_id;
    const cat = categories.find((c) => c.id === catId);

    list[idx] = {
      ...list[idx],
      ...data,
      category_id: catId,
      category_name: cat ? cat.name : list[idx].category_name,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(this.productsKey, JSON.stringify(list));
    return list[idx];
  }

  deleteProduct(id: number): { success: boolean; message: string } {
    this.ensureInitialized();
    const list = this.getProducts().filter((p) => p.id !== id);
    localStorage.setItem(this.productsKey, JSON.stringify(list));
    return { success: true, message: 'Product removed from demo inventory.' };
  }

  adjustStock(productId: number, changeQty: number, reason: string) {
    this.ensureInitialized();
    const list = this.getProducts();
    const p = list.find((item) => item.id === productId);
    if (!p) throw new Error('Product not found');
    const prev = p.current_stock;
    p.current_stock = Math.max(0, p.current_stock + changeQty);
    p.updated_at = new Date().toISOString();
    localStorage.setItem(this.productsKey, JSON.stringify(list));
    return { success: true, productId, previousStock: prev, newStock: p.current_stock, reason };
  }

  getCategories(): Category[] {
    this.ensureInitialized();
    const raw = localStorage.getItem(this.categoriesKey);
    return raw ? JSON.parse(raw) : INITIAL_CATEGORIES;
  }

  createCategory(name: string, description: string = ''): Category {
    this.ensureInitialized();
    const list = this.getCategories();
    const newCat: Category = {
      id: Date.now(),
      name,
      description,
      product_count: 0,
    };
    list.push(newCat);
    localStorage.setItem(this.categoriesKey, JSON.stringify(list));
    return newCat;
  }

  getCustomers(search?: string, tier?: string): Customer[] {
    this.ensureInitialized();
    const raw = localStorage.getItem(this.customersKey);
    let list: Customer[] = raw ? JSON.parse(raw) : INITIAL_CUSTOMERS;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.company && c.company.toLowerCase().includes(q)));
    }
    if (tier) {
      list = list.filter((c) => c.tier === tier);
    }
    return list;
  }

  createCustomer(data: Partial<Customer>): Customer {
    this.ensureInitialized();
    const list = this.getCustomers();
    const newCust: Customer = {
      id: Date.now(),
      name: data.name || 'New Client',
      company: data.company || '',
      email: data.email || `client_${Date.now()}@domain.com`,
      phone: data.phone || '+1 (555) 000-0000',
      tier: (data.tier as any) || 'regular',
      total_spent: 0,
      orders_count: 0,
      created_at: new Date().toISOString(),
    };
    list.unshift(newCust);
    localStorage.setItem(this.customersKey, JSON.stringify(list));
    return newCust;
  }

  getOrders(filters: { search?: string; status?: string; customer_id?: number } = {}): Order[] {
    this.ensureInitialized();
    const raw = localStorage.getItem(this.ordersKey);
    let list: Order[] = raw ? JSON.parse(raw) : INITIAL_ORDERS;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((o) => o.order_number.toLowerCase().includes(q) || (o.customer_name && o.customer_name.toLowerCase().includes(q)));
    }
    if (filters.status) {
      list = list.filter((o) => o.status === filters.status);
    }
    if (filters.customer_id) {
      list = list.filter((o) => o.customer_id === filters.customer_id);
    }
    return list;
  }

  createOrder(data: {
    customer_id?: number | null;
    items: { product_id: number; quantity: number; unit_price?: number }[];
    payment_method?: string;
    status?: string;
    discount_amount?: number;
    notes?: string;
  }): Order {
    this.ensureInitialized();
    const products = this.getProducts();
    const customers = this.getCustomers();
    const customer = customers.find((c) => c.id === data.customer_id);

    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of data.items) {
      const p = products.find((prod) => prod.id === item.product_id);
      if (!p) continue;
      const unitPrice = item.unit_price ?? p.selling_price;
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      // Deduct stock
      p.current_stock = Math.max(0, p.current_stock - item.quantity);

      orderItems.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku,
        quantity: item.quantity,
        unit_cost: p.cost_price,
        unit_price: unitPrice,
        line_total: lineTotal,
      });
    }

    localStorage.setItem(this.productsKey, JSON.stringify(products));

    const discount = data.discount_amount || 0;
    const tax = Number(((subtotal - discount) * 0.085).toFixed(2));
    const totalAmount = Number((subtotal - discount + tax).toFixed(2));

    const newOrder: Order = {
      id: Date.now(),
      order_number: `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_id: data.customer_id || null,
      customer_name: customer?.name || 'Walk-in Client',
      customer_company: customer?.company,
      subtotal,
      discount_amount: discount,
      tax_amount: tax,
      total_amount: totalAmount,
      status: (data.status as any) || 'completed',
      payment_method: (data.payment_method as any) || 'credit_card',
      payment_status: 'paid',
      notes: data.notes,
      created_at: new Date().toISOString(),
      items: orderItems,
    };

    const orders = this.getOrders();
    orders.unshift(newOrder);
    localStorage.setItem(this.ordersKey, JSON.stringify(orders));

    return newOrder;
  }

  getDashboardData() {
    const products = this.getProducts();
    const orders = this.getOrders();
    const customers = this.getCustomers();
    const categories = this.getCategories();

    let grossRevenue = 0;
    let cogs = 0;
    for (const o of orders) {
      if (o.status !== 'cancelled') {
        grossRevenue += Number(o.total_amount);
        if (o.items) {
          for (const it of o.items) {
            cogs += (Number(it.unit_cost) || 0) * Number(it.quantity);
          }
        }
      }
    }

    const netProfit = Number((grossRevenue - cogs).toFixed(2));
    const profitMargin = grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;
    const avgOrderValue = orders.length > 0 ? Number((grossRevenue / orders.length).toFixed(2)) : 0;

    let totalStockCost = 0;
    let totalStockRetail = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      totalStockCost += p.current_stock * p.cost_price;
      totalStockRetail += p.current_stock * p.selling_price;
      if (p.current_stock === 0) outOfStockCount++;
      else if (p.current_stock <= p.min_stock_threshold) lowStockCount++;
    }

    const summary: ExecutiveSummary = {
      grossRevenue: Number(grossRevenue.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      netProfit,
      profitMargin,
      totalOrders: orders.length,
      avgOrderValue,
      totalDiscounts: 450,
      totalTax: Number((grossRevenue * 0.085).toFixed(2)),
      totalCustomers: customers.length,
      activeCustomers: customers.length,
      totalProducts: products.length,
      totalUnitsInStock: products.reduce((acc, p) => acc + p.current_stock, 0),
      inventoryCostValue: Number(totalStockCost.toFixed(2)),
      inventoryRetailValue: Number(totalStockRetail.toFixed(2)),
      lowStockCount,
      outOfStockCount,
    };

    const revenueTimeline: RevenuePoint[] = [
      { date: '2026-10-20', revenue: 4200, orders: 1 },
      { date: '2026-10-22', revenue: 6800, orders: 2 },
      { date: '2026-10-25', revenue: 8243.83, orders: 1 },
      { date: '2026-10-27', revenue: 4703.48, orders: 1 },
      { date: '2026-10-29', revenue: 2926.25, orders: 1 },
      { date: '2026-10-31', revenue: 6112.89, orders: 1 },
    ];

    const categoryStats: CategoryStat[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      product_count: products.filter((p) => p.category_id === c.id).length,
      units_sold: 5,
      total_revenue: 8500,
    }));

    const inventoryHealth: InventoryHealth = {
      totalProducts: products.length,
      optimalCount: products.length - lowStockCount - outOfStockCount,
      lowStockCount,
      outOfStockCount,
      totalStockValueCost: Number(totalStockCost.toFixed(2)),
      totalStockValueRetail: Number(totalStockRetail.toFixed(2)),
      potentialProfit: Number((totalStockRetail - totalStockCost).toFixed(2)),
    };

    return {
      summary,
      revenueTimeline,
      topProducts: products.slice(0, 5).map((p) => ({
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku,
        units_sold: 8,
        total_revenue: p.selling_price * 8,
        gross_profit: (p.selling_price - p.cost_price) * 8,
        current_stock: p.current_stock,
        min_stock_threshold: p.min_stock_threshold,
        category_name: p.category_name,
      })),
      categoryStats,
      recentOrders: orders.slice(0, 6),
      inventoryHealth,
    };
  }

  askBusinessBrain(prompt: string) {
    const products = this.getProducts();
    const orders = this.getOrders();
    const lowStock = products.filter((p) => p.current_stock <= p.min_stock_threshold);
    const revenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

    let answer = `### 📊 Business Intelligence Analysis\n\n`;
    answer += `Based on current live records for **Apex Innovations Ltd**:\n\n`;
    answer += `* **Total Gross Revenue:** $${revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    answer += `* **Processed Orders:** ${orders.length} orders\n`;
    answer += `* **Active Catalog:** ${products.length} registered SKUs\n\n`;

    if (prompt.toLowerCase().includes('restock') || prompt.toLowerCase().includes('inventory')) {
      answer += `### 📦 Restock Priorities\n\n`;
      if (lowStock.length > 0) {
        answer += `The following **${lowStock.length} items** are at or below their safety stock levels:\n\n`;
        for (const p of lowStock) {
          answer += `* ⚠️ **${p.name}** (SKU: \`${p.sku}\`) — Current Stock: **${p.current_stock}** units (Min Threshold: ${p.min_stock_threshold})\n`;
        }
      } else {
        answer += `All products are currently at optimal inventory levels.\n`;
      }
    } else {
      answer += `### 💡 Strategic Recommendations\n\n`;
      answer += `1. **Stock Optimization:** Re-order low stock inventory items to maintain high fulfillment speed.\n`;
      answer += `2. **Customer Velocity:** Target repeat orders for high-spending enterprise clients like Apex BioTech and Sterling Capital.\n`;
      answer += `3. **Profit Margins:** Prioritize high-margin hardware bundles and ergonomic suites.\n`;
    }

    return {
      conversationId: `conv_${Date.now()}`,
      response: answer,
      metrics: { totalRevenue: revenue, totalOrders: orders.length, lowStockCount: lowStock.length },
      providerUsed: 'Bussinex Intelligence Engine (Guest Demo)',
    };
  }

  getSettings(): AppSettings {
    return {
      business_name: 'Apex Innovations Ltd',
      currency_symbol: '$',
      tax_rate: 8.5,
      contact_email: 'finance@apex-innovations.com',
      business_address: '742 Evergreen Terrace, Tech District, CA',
      ai_provider: 'gemini',
      ai_model: 'gemini-2.5-flash',
      ai_temperature: 0.2,
      has_custom_api_key: false,
    };
  }
}

export const demoStore = new DemoStore();
