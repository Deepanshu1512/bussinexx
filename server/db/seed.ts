import { db } from './database.ts';
import bcrypt from 'bcryptjs';

export async function ensureDefaultUserAndBusiness() {
  const existingBiz = await db.queryOne('SELECT count(*) as cnt FROM businesses');
  const count = Number(existingBiz?.cnt || 0);

  if (count === 0) {
    console.log('🏢 Initializing default business enterprise and admin account...');

    // 1. Create Default Business
    const bRes = await db.execute(
      'INSERT INTO businesses (name, currency_symbol, tax_rate, contact_email, address) VALUES (?, ?, ?, ?, ?)',
      ['Apex Innovations Ltd', '$', 8.5, 'finance@apex-innovations.com', '742 Evergreen Terrace, Tech District, CA']
    );
    const businessId = Number(bRes.lastInsertId || 1);

    // 2. Create Default Admin User
    const passwordHash = await bcrypt.hash('admin123', 10);
    await db.execute(
      'INSERT INTO users (business_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [businessId, 'Demo Administrator', 'admin@bussinex.com', passwordHash, 'admin']
    );

    // 3. Seed Realistic Business Records
    await seedDatabaseForBusiness(businessId);
    console.log('✅ Default business enterprise ready: admin@bussinex.com / admin123');
  }

  const user = await db.queryOne('SELECT id, business_id, name, email, role FROM users WHERE email = ?', ['admin@bussinex.com']);
  const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [user ? user.business_id : 1]);

  return { user, business };
}

export async function seedDatabaseForBusiness(businessId: number) {
  // 1. Insert Default Settings
  const defaultSettings: [string, string][] = [
    ['business_name', 'Apex Innovations Ltd'],
    ['currency_symbol', '$'],
    ['tax_rate', '8.5'],
    ['contact_email', 'finance@apex-innovations.com'],
    ['business_address', '742 Evergreen Terrace, Tech District, CA'],
    ['ai_provider', process.env.AI_PROVIDER || 'gemini'],
    ['ai_model', process.env.AI_MODEL || 'gemini-2.5-flash'],
    ['ai_temperature', '0.2'],
  ];

  for (const [key, val] of defaultSettings) {
    const existing = await db.queryOne('SELECT id FROM settings WHERE business_id = ? AND key = ?', [businessId, key]);
    if (!existing) {
      await db.execute('INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)', [businessId, key, val]);
    }
  }

  // Check if products already exist for this business
  const existingProds = await db.queryOne('SELECT count(*) as cnt FROM products WHERE business_id = ?', [businessId]);
  if (Number(existingProds?.cnt || 0) > 0) {
    return { success: true, message: 'Business already contains operational records.' };
  }

  // 2. Insert Categories
  const categoriesData = [
    { name: 'Hardware & Devices', description: 'Enterprise-grade computing devices and peripherals' },
    { name: 'Ergonomic Furniture', description: 'Modern ergonomic office chairs, standing desks, and accessories' },
    { name: 'Audio & Visual', description: 'Studio microphones, 4K webcams, and conference gear' },
    { name: 'Power & Cables', description: 'USB-C docks, surge protectors, and GaN chargers' },
    { name: 'Office Supplies', description: 'Premium notebooks, desk mats, and organizers' },
  ];

  const catMap = new Map<number, number>(); // index -> categoryId
  for (let i = 0; i < categoriesData.length; i++) {
    const cat = categoriesData[i];
    const res = await db.execute(
      'INSERT INTO categories (business_id, name, description) VALUES (?, ?, ?)',
      [businessId, cat.name, cat.description]
    );
    catMap.set(i + 1, Number(res.lastInsertId));
  }

  // 3. Insert Products
  const productsData = [
    { sku: 'HW-MBP-16', name: 'MacBook Pro M3 Max 16"', catIdx: 1, cost: 2450.00, price: 3199.00, stock: 14, minStock: 5, status: 'active', desc: '16-inch Liquid Retina XDR, 36GB RAM, 1TB SSD' },
    { sku: 'HW-DELL-U27', name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor', catIdx: 1, cost: 380.00, price: 549.99, stock: 22, minStock: 8, status: 'active', desc: 'IPS Black technology, 98% DCI-P3 color coverage' },
    { sku: 'HW-LOGI-MXM', name: 'Logitech MX Master 3S Wireless Mouse', catIdx: 1, cost: 62.00, price: 99.99, stock: 45, minStock: 15, status: 'active', desc: 'Quiet clicks, 8K DPI any-surface tracking' },
    { sku: 'HW-KEY-Q3P', name: 'Keychron Q3 Pro Custom Mechanical Keyboard', catIdx: 1, cost: 130.00, price: 219.00, stock: 4, minStock: 10, status: 'active', desc: 'QMK/VIA wireless custom mechanical keyboard (Low Stock)' },

    { sku: 'FN-HM-AER', name: 'Herman Miller Aeron Ergonomic Chair (Size B)', catIdx: 2, cost: 920.00, price: 1495.00, stock: 8, minStock: 4, status: 'active', desc: 'Pellicle suspension, PostureFit SL adjustable support' },
    { sku: 'FN-UP-DSK', name: 'Uplift V2 Commercial Standing Desk (60x30")', catIdx: 2, cost: 480.00, price: 799.00, stock: 11, minStock: 5, status: 'active', desc: 'Dual motor, solid bamboo desktop with cable management' },
    { sku: 'FN-MNT-DUO', name: 'Ergotron LX Dual Stacking Arm Mount', catIdx: 2, cost: 185.00, price: 299.99, stock: 3, minStock: 6, status: 'active', desc: 'Heavy-duty polished aluminum dual monitor arm (Low Stock)' },
    { sku: 'FN-FT-RST', name: 'Contour Ergonomic Active Footrest', catIdx: 2, cost: 35.00, price: 69.95, stock: 28, minStock: 10, status: 'active', desc: 'Rocking motion foot platform for improved posture' },

    { sku: 'AV-SHR-SM7', name: 'Shure SM7B Vocal Studio Dynamic Microphone', catIdx: 3, cost: 260.00, price: 399.00, stock: 16, minStock: 5, status: 'active', desc: 'Smooth, flat, wide-range frequency response' },
    { sku: 'AV-OBS-BOT', name: 'OBSBOT Tiny 2 4K PTZ AI Auto-Tracking Webcam', catIdx: 3, cost: 195.00, price: 329.00, stock: 2, minStock: 5, status: 'active', desc: '1/1.5" sensor, voice control, AI tracking (Critically Low)' },
    { sku: 'AV-RODE-CA', name: 'Rode Caster Pro II Integrated Audio Production Studio', catIdx: 3, cost: 450.00, price: 699.00, stock: 7, minStock: 3, status: 'active', desc: 'Revolution Preamps, SMART pads, dual USB-C' },
    { sku: 'AV-ELG-LP', name: 'Elgato Wave Mic Arm LP Low Profile', catIdx: 3, cost: 58.00, price: 99.99, stock: 31, minStock: 10, status: 'active', desc: 'All-metal, anti-torsion construction, cable channels' },

    { sku: 'PW-CAL-TS4', name: 'CalDigit TS4 Thunderbolt 4 18-Port Dock', catIdx: 4, cost: 260.00, price: 399.95, stock: 19, minStock: 8, status: 'active', desc: '98W charging, 2.5GbE, 8K display support' },
    { sku: 'PW-ANK-GAN', name: 'Anker Prime 240W 4-Port GaN Desktop Charger', catIdx: 4, cost: 110.00, price: 199.99, stock: 36, minStock: 12, status: 'active', desc: 'Ultra-fast charging for laptops and multi-devices' },
    { sku: 'PW-APC-150', name: 'APC Back-UPS Pro 1500VA SineWave UPS', catIdx: 4, cost: 175.00, price: 279.99, stock: 9, minStock: 4, status: 'active', desc: 'Battery backup & surge protector with LCD interface' },

    { sku: 'OS-DESK-PAD', name: 'Orbitkey Top-Grain Leather Desk Mat (Large)', catIdx: 5, cost: 42.00, price: 89.00, stock: 40, minStock: 15, status: 'active', desc: 'Water-repellent vegan leather with magnetic toolbar' },
    { sku: 'OS-NOT-PREM', name: 'Baron Fig Master Bullet Journal Hardcover', catIdx: 5, cost: 12.00, price: 28.00, stock: 65, minStock: 20, status: 'active', desc: 'Acid-free 100gsm paper, dot grid layout' },
    { sku: 'OS-PEN-ROTR', name: 'Rotring 800 Retractable Mechanical Pencil 0.5mm', catIdx: 5, cost: 28.00, price: 54.00, stock: 1, minStock: 10, status: 'active', desc: 'Full metal body with twist and click mechanism (Almost Out)' },
  ];

  const prodIdMap = new Map<number, any>();
  for (let i = 0; i < productsData.length; i++) {
    const p = productsData[i];
    const catId = catMap.get(p.catIdx) || null;
    const res = await db.execute(
      `INSERT INTO products (business_id, sku, name, category_id, cost_price, selling_price, current_stock, min_stock_threshold, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [businessId, p.sku, p.name, catId, p.cost, p.price, p.stock, p.minStock, p.status, p.desc]
    );
    const prodId = Number(res.lastInsertId);
    prodIdMap.set(i + 1, { id: prodId, ...p });
  }

  // 4. Insert Customers
  const customersData = [
    { name: 'Sarah Jenkins', email: 's.jenkins@acmecorp.io', phone: '+1 (555) 234-8901', company: 'Acme Technologies', tier: 'vip', address: '100 Innovation Way, Suite 400, San Francisco, CA' },
    { name: 'Marcus Vance', email: 'mvance@nexusdesign.co', phone: '+1 (555) 345-6712', company: 'Nexus Creative Studio', tier: 'vip', address: '450 Bauhaus Boulevard, Austin, TX' },
    { name: 'Elena Rostova', email: 'elena@hyperionlabs.tech', phone: '+1 (555) 789-0123', company: 'Hyperion AI Labs', tier: 'wholesale', address: '88 Quantum Drive, Cambridge, MA' },
    { name: 'Devon Wright', email: 'devon@wrightpartners.law', phone: '+1 (555) 890-1234', company: 'Wright & Partners LLP', tier: 'regular', address: '1200 Wall Street, New York, NY' },
    { name: 'Liam O\'Connor', email: 'liam@vertexmedia.org', phone: '+1 (555) 432-5678', company: 'Vertex Media Group', tier: 'regular', address: '350 Sunset Blvd, Los Angeles, CA' },
    { name: 'Amina Patel', email: 'amina@catalysthealth.care', phone: '+1 (555) 678-9012', company: 'Catalyst Health Systems', tier: 'wholesale', address: '710 Medical Center Way, Chicago, IL' },
    { name: 'Jordan Rivera', email: 'jrivera@cloudscale.net', phone: '+1 (555) 123-4567', company: 'CloudScale Infrastructure', tier: 'regular', address: '202 Data Park Dr, Seattle, WA' },
    { name: 'Chloe Dubois', email: 'chloe@atelierdubois.design', phone: '+1 (555) 987-6543', company: 'Atelier Dubois Arch', tier: 'vip', address: '640 Broadway, Soho, New York, NY' },
    { name: 'Kenji Takahashi', email: 'kenji@zenithfintech.jp', phone: '+1 (555) 876-5432', company: 'Zenith FinTech Corp', tier: 'wholesale', address: '50 California Street, San Francisco, CA' },
    { name: 'Rachel Green', email: 'rachel@coastalventures.vc', phone: '+1 (555) 210-9876', company: 'Coastal Ventures', tier: 'new', address: '180 Sand Hill Road, Menlo Park, CA' },
    { name: 'Samuel Miller', email: 'smiller@frontierbuild.com', phone: '+1 (555) 321-7654', company: 'Frontier Buildworks', tier: 'regular', address: '900 Industrial Parkway, Denver, CO' },
    { name: 'Zoe Chen', email: 'zoe@syntheticaudio.fm', phone: '+1 (555) 654-3210', company: 'Synthetic Audio Labs', tier: 'regular', address: '44 Music Row, Nashville, TN' },
  ];

  const custIdMap = new Map<number, number>();
  for (let i = 0; i < customersData.length; i++) {
    const c = customersData[i];
    const res = await db.execute(
      `INSERT INTO customers (business_id, name, email, phone, company, tier, address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [businessId, c.name, c.email, c.phone, c.company, c.tier, c.address]
    );
    custIdMap.set(i + 1, Number(res.lastInsertId));
  }

  // 5. Generate Historical Orders
  const now = new Date();
  const getPastDateISO = (daysAgo: number) => {
    const d = new Date(now.getTime() - (daysAgo * 86400000));
    return d.toISOString();
  };

  const orderPlans = [
    { daysAgo: 85, custIdx: 1, items: [{ pIdx: 1, qty: 2 }, { pIdx: 2, qty: 2 }, { pIdx: 13, qty: 2 }], discount: 150 },
    { daysAgo: 82, custIdx: 3, items: [{ pIdx: 3, qty: 5 }, { pIdx: 14, qty: 5 }, { pIdx: 16, qty: 5 }], discount: 50 },
    { daysAgo: 79, custIdx: 2, items: [{ pIdx: 9, qty: 2 }, { pIdx: 11, qty: 1 }, { pIdx: 12, qty: 2 }], discount: 0 },
    { daysAgo: 75, custIdx: 4, items: [{ pIdx: 5, qty: 1 }, { pIdx: 6, qty: 1 }, { pIdx: 13, qty: 1 }], discount: 100 },
    { daysAgo: 71, custIdx: 5, items: [{ pIdx: 9, qty: 1 }, { pIdx: 10, qty: 1 }, { pIdx: 12, qty: 1 }], discount: 20 },
    { daysAgo: 68, custIdx: 6, items: [{ pIdx: 2, qty: 4 }, { pIdx: 3, qty: 4 }, { pIdx: 14, qty: 4 }], discount: 80 },
    { daysAgo: 64, custIdx: 8, items: [{ pIdx: 5, qty: 3 }, { pIdx: 7, qty: 2 }], discount: 200 },
    { daysAgo: 60, custIdx: 9, items: [{ pIdx: 1, qty: 3 }, { pIdx: 2, qty: 3 }, { pIdx: 13, qty: 3 }], discount: 300 },
    { daysAgo: 50, custIdx: 12, items: [{ pIdx: 9, qty: 2 }, { pIdx: 11, qty: 1 }], discount: 50 },
    { daysAgo: 47, custIdx: 1, items: [{ pIdx: 5, qty: 2 }, { pIdx: 6, qty: 2 }, { pIdx: 13, qty: 2 }], discount: 250 },
    { daysAgo: 43, custIdx: 2, items: [{ pIdx: 1, qty: 1 }, { pIdx: 2, qty: 2 }, { pIdx: 3, qty: 2 }], discount: 100 },
    { daysAgo: 40, custIdx: 3, items: [{ pIdx: 1, qty: 4 }, { pIdx: 13, qty: 4 }], discount: 400 },
    { daysAgo: 32, custIdx: 6, items: [{ pIdx: 2, qty: 3 }, { pIdx: 14, qty: 3 }], discount: 50 },
    { daysAgo: 26, custIdx: 8, items: [{ pIdx: 5, qty: 2 }, { pIdx: 6, qty: 2 }], discount: 150 },
    { daysAgo: 20, custIdx: 5, items: [{ pIdx: 10, qty: 2 }, { pIdx: 12, qty: 2 }], discount: 30 },
    { daysAgo: 14, custIdx: 1, items: [{ pIdx: 1, qty: 2 }, { pIdx: 5, qty: 1 }], discount: 200 },
    { daysAgo: 8, custIdx: 3, items: [{ pIdx: 1, qty: 2 }, { pIdx: 4, qty: 4 }], discount: 180 },
    { daysAgo: 4, custIdx: 6, items: [{ pIdx: 6, qty: 2 }, { pIdx: 7, qty: 1 }], discount: 80 },
    { daysAgo: 1, custIdx: 12, items: [{ pIdx: 10, qty: 1 }, { pIdx: 12, qty: 1 }], discount: 0 },
  ];

  let orderSeq = 1001;
  for (const plan of orderPlans) {
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of plan.items) {
      const prod = prodIdMap.get(item.pIdx);
      if (!prod) continue;
      const lineTotal = prod.price * item.qty;
      subtotal += lineTotal;
      orderItems.push({
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        cost: prod.cost,
        price: prod.price,
        qty: item.qty,
        lineTotal
      });
    }

    const discount = Math.min(plan.discount, subtotal * 0.2);
    const taxable = Math.max(0, subtotal - discount);
    const tax = Number((taxable * 0.085).toFixed(2));
    const total = Number((taxable + tax).toFixed(2));
    const orderNum = `ORD-${now.getFullYear()}-${orderSeq++}`;
    const custId = custIdMap.get(plan.custIdx) || null;
    const createdAt = getPastDateISO(plan.daysAgo);

    const oRes = await db.execute(
      `INSERT INTO orders (business_id, order_number, customer_id, status, payment_method, payment_status, subtotal, discount_amount, tax_amount, total_amount, created_at)
       VALUES (?, ?, ?, 'completed', 'card', 'paid', ?, ?, ?, ?, ?)`,
      [businessId, orderNum, custId, subtotal, discount, tax, total, createdAt]
    );

    const orderId = Number(oRes.lastInsertId);
    for (const oi of orderItems) {
      await db.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, product_sku, unit_cost, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, oi.productId, oi.name, oi.sku, oi.cost, oi.price, oi.qty, oi.lineTotal]
      );
    }
  }

  return { success: true, message: 'Sample business data populated successfully!' };
}
