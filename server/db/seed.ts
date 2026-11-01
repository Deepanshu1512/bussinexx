import { db } from './database.ts';
import bcrypt from 'bcryptjs';

export async function ensureDefaultUserAndBusiness() {
  let existingBiz = await db.queryOne('SELECT id, name FROM businesses ORDER BY id ASC LIMIT 1');
  let businessId = existingBiz ? Number(existingBiz.id) : 1;

  if (!existingBiz) {
    console.log('🏢 Initializing default business enterprise...');
    const bRes = await db.execute(
      'INSERT INTO businesses (name, currency_symbol, currency_code, tax_rate, contact_email, contact_phone, address, city, state, pincode, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Apex Enterprises Pvt Ltd', '₹', 'INR', 18.0, 'finance@apex-enterprises.in', '+91 98765 43210', 'Plot 42, Silicon Valley Tech Zone, Whitefield', 'Bengaluru', 'Karnataka', '560066', 'India']
    );
    businessId = Number(bRes.lastInsertId || 1);
  }

  // Ensure primary store exists
  let primaryStore = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]);
  if (!primaryStore) {
    const sRes = await db.execute(`
      INSERT INTO stores (business_id, name, code, contact_email, contact_phone, address, city, state, pincode, is_primary, status)
      VALUES (?, ?, 'BLR-01', 'bengaluru@apex-enterprises.in', '+91 98765 43210', 'Ground Floor, Tech Park, Whitefield', 'Bengaluru', 'Karnataka', '560066', 1, 'active')
    `, [businessId, 'Apex Enterprises (Bengaluru Flagship)']);
    primaryStore = { id: Number(sRes.lastInsertId || 1) };
  }

  let user = await db.queryOne('SELECT id, business_id, name, email, role FROM users WHERE email = ?', ['admin@bussinex.com']);
  if (!user) {
    console.log('👤 Seeding default admin user (admin@bussinex.com)...');
    const passwordHash = await bcrypt.hash('admin123', 10);
    const uRes = await db.execute(
      'INSERT INTO users (business_id, store_id, name, email, phone, password_hash, role, email_verified, terms_accepted_at, terms_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
      [businessId, primaryStore.id, 'Demo Administrator', 'admin@bussinex.com', '+91 98765 43210', passwordHash, 'admin', 1, '1.0']
    );
    user = { id: Number(uRes.lastInsertId || 1), business_id: businessId, name: 'Demo Administrator', email: 'admin@bussinex.com', role: 'admin' };
    await seedDatabaseForBusiness(businessId);
    console.log('✅ Default business enterprise ready: admin@bussinex.com / admin123');
  } else {
    // Ensure email_verified = 1 and store_id linked for demo admin
    await db.execute('UPDATE users SET email_verified = 1, store_id = ? WHERE id = ?', [primaryStore.id, user.id]);
  }

  const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [businessId]);
  return { user, business };
}

export async function seedDatabaseForBusiness(businessId: number) {
  // 1. Insert Default Settings
  const defaultSettings: [string, string][] = [
    ['business_name', 'Apex Enterprises Pvt Ltd'],
    ['currency_symbol', '₹'],
    ['currency_code', 'INR'],
    ['tax_rate', '18.0'],
    ['contact_email', 'finance@apex-enterprises.in'],
    ['contact_phone', '+91 98765 43210'],
    ['business_address', 'Plot 42, Silicon Valley Tech Zone, Whitefield, Bengaluru, Karnataka, 560066'],
    ['ai_provider', process.env.AI_PROVIDER || 'gemini'],
    ['ai_model', process.env.AI_MODEL || 'gemini-2.5-flash'],
    ['ai_temperature', '0.2'],
  ];

  for (const [key, val] of defaultSettings) {
    const existing = await db.queryOne('SELECT key FROM settings WHERE business_id = ? AND key = ?', [businessId, key]);
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
  const primaryStore = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]);
  const storeId = primaryStore ? Number(primaryStore.id) : 1;

  const productsData = [
    { sku: 'HW-MBP-16', barcode: '8901234567890', name: 'MacBook Pro M3 Max 16"', catIdx: 1, cost: 215000.00, price: 279900.00, stock: 14, minStock: 5, status: 'active', desc: '16-inch Liquid Retina XDR, 36GB RAM, 1TB SSD' },
    { sku: 'HW-DELL-U27', barcode: '8901234567891', name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor', catIdx: 1, cost: 38000.00, price: 54999.00, stock: 22, minStock: 8, status: 'active', desc: 'IPS Black technology, 98% DCI-P3 color coverage' },
    { sku: 'HW-LOGI-MXM', barcode: '8901234567892', name: 'Logitech MX Master 3S Wireless Mouse', catIdx: 1, cost: 6200.00, price: 9995.00, stock: 45, minStock: 15, status: 'active', desc: 'Quiet clicks, 8K DPI any-surface tracking' },
    { sku: 'HW-KEY-Q3P', barcode: '8901234567893', name: 'Keychron Q3 Pro Custom Mechanical Keyboard', catIdx: 1, cost: 13500.00, price: 18999.00, stock: 4, minStock: 10, status: 'active', desc: 'QMK/VIA wireless custom mechanical keyboard (Low Stock)' },

    { sku: 'FN-HM-AER', barcode: '8901234567894', name: 'Herman Miller Aeron Ergonomic Chair (Size B)', catIdx: 2, cost: 85000.00, price: 125000.00, stock: 8, minStock: 4, status: 'active', desc: 'Pellicle suspension, PostureFit SL adjustable support' },
    { sku: 'FN-UP-DSK', barcode: '8901234567895', name: 'Dual-Motor Commercial Standing Desk (60x30")', catIdx: 2, cost: 35000.00, price: 54999.00, stock: 11, minStock: 5, status: 'active', desc: 'Dual motor, solid bamboo desktop with cable management' },
    { sku: 'FN-MNT-DUO', barcode: '8901234567896', name: 'Ergotron LX Dual Stacking Arm Mount', catIdx: 2, cost: 16500.00, price: 24999.00, stock: 3, minStock: 6, status: 'active', desc: 'Heavy-duty polished aluminum dual monitor arm (Low Stock)' },
    { sku: 'FN-FT-RST', barcode: '8901234567897', name: 'Ergonomic Active Posture Footrest', catIdx: 2, cost: 2800.00, price: 4999.00, stock: 28, minStock: 10, status: 'active', desc: 'Rocking motion foot platform for improved posture' },

    { sku: 'AV-SHR-SM7', barcode: '8901234567898', name: 'Shure SM7B Vocal Studio Dynamic Microphone', catIdx: 3, cost: 28000.00, price: 39990.00, stock: 16, minStock: 5, status: 'active', desc: 'Smooth, flat, wide-range frequency response' },
    { sku: 'AV-OBS-BOT', barcode: '8901234567899', name: 'OBSBOT Tiny 2 4K PTZ AI Auto-Tracking Webcam', catIdx: 3, cost: 22000.00, price: 32900.00, stock: 2, minStock: 5, status: 'active', desc: '1/1.5" sensor, voice control, AI tracking (Critically Low)' },
    { sku: 'AV-RODE-CA', barcode: '8901234567800', name: 'Rode Caster Pro II Integrated Audio Production Studio', catIdx: 3, cost: 42000.00, price: 59900.00, stock: 7, minStock: 3, status: 'active', desc: 'Revolution Preamps, SMART pads, dual USB-C' },
    { sku: 'AV-ELG-LP', barcode: '8901234567801', name: 'Elgato Wave Mic Arm LP Low Profile', catIdx: 3, cost: 6500.00, price: 9999.00, stock: 31, minStock: 10, status: 'active', desc: 'All-metal, anti-torsion construction, cable channels' },

    { sku: 'PW-CAL-TS4', barcode: '8901234567802', name: 'CalDigit TS4 Thunderbolt 4 18-Port Dock', catIdx: 4, cost: 28000.00, price: 39995.00, stock: 19, minStock: 8, status: 'active', desc: '98W charging, 2.5GbE, 8K display support' },
    { sku: 'PW-ANK-GAN', barcode: '8901234567803', name: 'Anker Prime 240W 4-Port GaN Desktop Charger', catIdx: 4, cost: 11500.00, price: 16999.00, stock: 36, minStock: 12, status: 'active', desc: 'Ultra-fast charging for laptops and multi-devices' },
    { sku: 'PW-APC-150', barcode: '8901234567804', name: 'APC Back-UPS Pro 1500VA SineWave UPS', catIdx: 4, cost: 18000.00, price: 26999.00, stock: 9, minStock: 4, status: 'active', desc: 'Battery backup & surge protector with LCD interface' },

    { sku: 'OS-DESK-PAD', barcode: '8901234567805', name: 'Orbitkey Top-Grain Leather Desk Mat (Large)', catIdx: 5, cost: 3800.00, price: 6999.00, stock: 40, minStock: 15, status: 'active', desc: 'Water-repellent vegan leather with magnetic toolbar' },
    { sku: 'OS-NOT-PREM', barcode: '8901234567806', name: 'Baron Fig Master Bullet Journal Hardcover', catIdx: 5, cost: 1200.00, price: 2499.00, stock: 65, minStock: 20, status: 'active', desc: 'Acid-free 100gsm paper, dot grid layout' },
    { sku: 'OS-PEN-ROTR', barcode: '8901234567807', name: 'Rotring 800 Retractable Mechanical Pencil 0.5mm', catIdx: 5, cost: 2800.00, price: 4999.00, stock: 1, minStock: 10, status: 'active', desc: 'Full metal body with twist and click mechanism (Almost Out)' },
  ];

  const prodIdMap = new Map<number, any>();
  for (let i = 0; i < productsData.length; i++) {
    const p = productsData[i];
    const catId = catMap.get(p.catIdx) || null;
    const res = await db.execute(
      `INSERT INTO products (business_id, sku, barcode, name, category_id, cost_price, selling_price, current_stock, min_stock_threshold, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [businessId, p.sku, p.barcode, p.name, catId, p.cost, p.price, p.stock, p.minStock, p.status, p.desc]
    );
    const prodId = Number(res.lastInsertId);
    prodIdMap.set(i + 1, { id: prodId, ...p });

    // Link to store inventory
    await db.execute(
      `INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity, min_stock_threshold)
       VALUES (?, ?, ?, ?, ?)`,
      [businessId, storeId, prodId, p.stock, p.minStock]
    );
  }

  // 4. Insert Customers (Neutral Indian Business Accounts)
  const customersData = [
    { name: 'Rajesh Sharma', email: 'r.sharma@tatanex.in', phone: '+91 98201 23456', company: 'Tata NexTech Solutions', tier: 'vip', address: 'Bandra Kurla Complex, G Block, Bandra East, Mumbai, Maharashtra 400051' },
    { name: 'Priya Sundaram', email: 'priya@infosyspartner.com', phone: '+91 98450 34567', company: 'Sundaram Systems Pvt Ltd', tier: 'vip', address: 'Plot 44, Electronic City Phase 1, Hosur Road, Bengaluru, Karnataka 560100' },
    { name: 'Vikramaditya Mehta', email: 'vmehta@reliancedigital.co.in', phone: '+91 98110 45678', company: 'Mehta Enterprise Hub', tier: 'wholesale', address: 'Maker Chambers IV, Nariman Point, Mumbai, Maharashtra 400021' },
    { name: 'Ananya Deshmukh', email: 'ananya@puneinnovations.org', phone: '+91 98900 56789', company: 'Deccan Tech Labs LLP', tier: 'regular', address: 'Hinjewadi IT Park, Phase 1, Pune, Maharashtra 411057' },
    { name: 'Arjun Singhania', email: 'arjun@delhiventures.in', phone: '+91 98100 67890', company: 'Singhania Global Trading', tier: 'regular', address: 'Barakhamba Road, Connaught Place, New Delhi, Delhi 110001' },
    { name: 'Kavita Reddy', email: 'kavita@hyderabadcloud.io', phone: '+91 98490 78901', company: 'Reddy Info Corp', tier: 'wholesale', address: 'Madhapur, Hitec City, Hyderabad, Telangana 500081' },
    { name: 'Siddharth Roy', email: 'siddharth@kolkatatech.in', phone: '+91 98300 89012', company: 'Bengal IT Services', tier: 'regular', address: 'Salt Lake Sector V, Bidhannagar, Kolkata, West Bengal 700091' },
    { name: 'Meera Iyer', email: 'meera@chennaiscribe.com', phone: '+91 98400 90123', company: 'Iyer Logistics & Freight', tier: 'vip', address: 'Old Mahabalipuram Road (OMR), Thoraipakkam, Chennai, Tamil Nadu 600097' },
    { name: 'Karan Malhotra', email: 'karan@gurgaonfin.tech', phone: '+91 99100 01234', company: 'Malhotra Financial Advisory', tier: 'wholesale', address: 'DLF Cyber City, Building 10, Gurugram, Haryana 122002' },
    { name: 'Neha Joshi', email: 'neha@ahmedabadretail.in', phone: '+91 98250 12345', company: 'Joshi Retail Network', tier: 'new', address: 'Sarkhej - Gandhinagar Highway, Bodakdev, Ahmedabad, Gujarat 380054' },
    { name: 'Aditya Varma', email: 'aditya@keralatech.org', phone: '+91 98470 23456', company: 'Varma Digital Ventures', tier: 'regular', address: 'Infopark Phase 2, Kakkanad, Kochi, Kerala 682042' },
    { name: 'Rohan Gupta', email: 'rohan@jaipurtextiles.co.in', phone: '+91 98290 34567', company: 'Gupta Enterprise Group', tier: 'regular', address: 'MI Road, C Scheme, Ashok Nagar, Jaipur, Rajasthan 302001' },
  ];

  const custIdMap = new Map<number, number>();
  for (let i = 0; i < customersData.length; i++) {
    const c = customersData[i];
    const res = await db.execute(
      `INSERT INTO customers (business_id, store_id, name, email, phone, company, tier, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [businessId, storeId, c.name, c.email, c.phone, c.company, c.tier, c.address]
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
      `INSERT INTO orders (business_id, store_id, order_number, customer_id, status, payment_method, payment_status, subtotal, discount_amount, tax_amount, total_amount, created_at)
       VALUES (?, ?, ?, ?, 'completed', 'card', 'paid', ?, ?, ?, ?, ?)`,
      [businessId, storeId, orderNum, custId, subtotal, discount, tax, total, createdAt]
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
