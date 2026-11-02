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

  // Ensure 3 multi-stores exist
  await ensureStoresForBusiness(businessId);
  const primaryStore = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]);

  let user = await db.queryOne('SELECT id, business_id, name, email, role FROM users WHERE email = ?', ['admin@bussinex.com']);
  if (!user) {
    console.log('👤 Seeding default admin user (admin@bussinex.com)...');
    const passwordHash = await bcrypt.hash('admin123', 10);
    const uRes = await db.execute(
      'INSERT INTO users (business_id, store_id, name, email, phone, password_hash, role, email_verified, terms_accepted_at, terms_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
      [businessId, primaryStore?.id || 1, 'Demo Administrator', 'admin@bussinex.com', '+91 98765 43210', passwordHash, 'admin', 1, '1.0']
    );
    user = { id: Number(uRes.lastInsertId || 1), business_id: businessId, name: 'Demo Administrator', email: 'admin@bussinex.com', role: 'admin' };
    await seedDatabaseForBusiness(businessId, true);
    console.log('✅ Default business enterprise ready: admin@bussinex.com / admin123');
  } else {
    // Ensure email_verified = 1 and store_id linked for demo admin
    await db.execute('UPDATE users SET email_verified = 1, store_id = ? WHERE id = ?', [primaryStore?.id || 1, user.id]);

    // Check if corrupted or test employees are present (e.g. bussinex-test.com)
    const testEmp = await db.queryOne("SELECT id FROM employees WHERE business_id = ? AND email LIKE '%bussinex-test.com%' LIMIT 1", [businessId]);
    if (testEmp) {
      console.log('🔄 Test artifacts detected in employee directory. Upgrading to rich enterprise dataset...');
      await seedDatabaseForBusiness(businessId, true);
    }
  }

  const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [businessId]);
  return { user, business };
}

export async function ensureStoresForBusiness(businessId: number) {
  const existingStores: any[] = await db.query('SELECT id, code FROM stores WHERE business_id = ?', [businessId]);
  const hasStore1 = existingStores.some(s => s.code === 'BLR-01');
  const hasStore2 = existingStores.some(s => s.code === 'BOM-02');
  const hasStore3 = existingStores.some(s => s.code === 'DEL-03');

  if (!hasStore1) {
    await db.execute(`
      INSERT INTO stores (business_id, name, code, contact_email, contact_phone, address, city, state, pincode, is_primary, status)
      VALUES (?, 'Apex Flagship Tech Hub (Bengaluru)', 'BLR-01', 'bengaluru@apex-enterprises.in', '+91 80 4123 4567', 'Ground Floor, Silicon Tech Park, Whitefield', 'Bengaluru', 'Karnataka', '560066', 1, 'active')
    `, [businessId]);
  } else {
    // Ensure primary name is clean
    await db.execute(`
      UPDATE stores SET name = 'Apex Flagship Tech Hub (Bengaluru)', is_primary = 1 WHERE business_id = ? AND code = 'BLR-01'
    `, [businessId]);
  }

  if (!hasStore2) {
    await db.execute(`
      INSERT INTO stores (business_id, name, code, contact_email, contact_phone, address, city, state, pincode, is_primary, status)
      VALUES (?, 'Apex Commercial Centre (Mumbai - BKC)', 'BOM-02', 'mumbai@apex-enterprises.in', '+91 22 6123 8900', 'Level 4, Trade Centre, Bandra Kurla Complex', 'Mumbai', 'Maharashtra', '400051', 0, 'active')
    `, [businessId]);
  }

  if (!hasStore3) {
    await db.execute(`
      INSERT INTO stores (business_id, name, code, contact_email, contact_phone, address, city, state, pincode, is_primary, status)
      VALUES (?, 'Apex Digital Solutions (Delhi NCR)', 'DEL-03', 'delhi@apex-enterprises.in', '+91 11 4123 9988', 'Tower B, Cyber Greens, DLF CyberCity', 'Gurugram', 'Haryana', '122002', 0, 'active')
    `, [businessId]);
  }
}

export async function seedDatabaseForBusiness(businessId: number, forceClean: boolean = false) {
  // Ensure the 3 stores exist
  await ensureStoresForBusiness(businessId);
  const storeRows: any[] = await db.query('SELECT id, code, name FROM stores WHERE business_id = ? ORDER BY id ASC', [businessId]);
  const store1Id = storeRows.find(s => s.code === 'BLR-01')?.id || storeRows[0]?.id || 1;
  const store2Id = storeRows.find(s => s.code === 'BOM-02')?.id || storeRows[1]?.id || store1Id;
  const store3Id = storeRows.find(s => s.code === 'DEL-03')?.id || storeRows[2]?.id || store1Id;

  if (forceClean) {
    console.log(`🧹 Cleaning existing sample data for business ${businessId}...`);
    await db.execute('DELETE FROM notifications WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM expenses WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE business_id = ?)', [businessId]);
    await db.execute('DELETE FROM purchase_orders WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM suppliers WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM payroll_items WHERE payroll_id IN (SELECT id FROM payrolls WHERE business_id = ?)', [businessId]);
    await db.execute('DELETE FROM payrolls WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM leave_balances WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM leaves WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM attendance WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM employees WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id = ?)', [businessId]);
    await db.execute('DELETE FROM orders WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM stock_transfers WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM store_inventory WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM stock_logs WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM products WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM categories WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM customers WHERE business_id = ?', [businessId]);
  }

  // 1. Settings
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

  // 2. Categories
  const existingCats = await db.queryOne('SELECT count(*) as cnt FROM categories WHERE business_id = ?', [businessId]);
  const catMap = new Map<number, number>();
  if (Number(existingCats?.cnt || 0) === 0) {
    const categoriesData = [
      { name: 'Hardware & Computing', description: 'Enterprise workstation laptops, server devices and displays' },
      { name: 'Ergonomic Furniture', description: 'Commercial standing desks, ergonomic mesh chairs, and monitor mounts' },
      { name: 'Audio & Studio Gear', description: 'Broadcast microphones, 4K PTZ webcams, and acoustic panels' },
      { name: 'Power & Infrastructure', description: 'Thunderbolt 4 docks, industrial UPS backup, and GaN power stations' },
      { name: 'Office Supplies & Stationery', description: 'Hardcover journals, architectural pencils, and desk accessories' },
    ];

    for (let i = 0; i < categoriesData.length; i++) {
      const cat = categoriesData[i];
      const res = await db.execute(
        'INSERT INTO categories (business_id, name, description) VALUES (?, ?, ?)',
        [businessId, cat.name, cat.description]
      );
      catMap.set(i + 1, Number(res.lastInsertId));
    }
  } else {
    const rows: any[] = await db.query('SELECT id FROM categories WHERE business_id = ? ORDER BY id ASC', [businessId]);
    rows.forEach((r, idx) => catMap.set(idx + 1, Number(r.id)));
  }

  // 3. Products Catalog
  const existingProds = await db.queryOne('SELECT count(*) as cnt FROM products WHERE business_id = ?', [businessId]);
  const prodIdMap = new Map<number, any>();
  if (Number(existingProds?.cnt || 0) === 0) {
    const productsData = [
      { sku: 'HW-MBP-16', barcode: '8901234567890', name: 'MacBook Pro 16" M3 Max (36GB/1TB)', catIdx: 1, cost: 215000.00, price: 279900.00, stock: 14, minStock: 5, status: 'active', desc: '16-inch Liquid Retina XDR, Apple M3 Max, Space Black' },
      { sku: 'HW-DELL-U27', barcode: '8901234567891', name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor', catIdx: 1, cost: 38000.00, price: 54999.00, stock: 22, minStock: 8, status: 'active', desc: 'IPS Black technology, 98% DCI-P3 color coverage, 90W PD' },
      { sku: 'HW-LOGI-MXM', barcode: '8901234567892', name: 'Logitech MX Master 3S Wireless Mouse', catIdx: 1, cost: 6200.00, price: 9995.00, stock: 45, minStock: 15, status: 'active', desc: 'Quiet clicks, 8K DPI any-surface laser tracking' },
      { sku: 'HW-KEY-Q3P', barcode: '8901234567893', name: 'Keychron Q3 Pro Custom Mechanical Keyboard', catIdx: 1, cost: 13500.00, price: 18999.00, stock: 4, minStock: 10, status: 'active', desc: 'Wireless QMK/VIA custom mechanical keyboard (Low Stock Alert)' },
      { sku: 'HW-THNK-P1', barcode: '8901234567894', name: 'Lenovo ThinkPad P1 Gen 6 Mobile Workstation', catIdx: 1, cost: 185000.00, price: 239900.00, stock: 8, minStock: 3, status: 'active', desc: 'Intel Core i9, 32GB DDR5, RTX 4080 Ada' },

      { sku: 'FN-HM-AER', barcode: '8901234567895', name: 'Herman Miller Aeron Ergonomic Chair (Size B)', catIdx: 2, cost: 85000.00, price: 125000.00, stock: 12, minStock: 5, status: 'active', desc: 'Pellicle suspension mesh, PostureFit SL adjustable support' },
      { sku: 'FN-UP-DSK', barcode: '8901234567896', name: 'Dual-Motor Commercial Standing Desk (60x30")', catIdx: 2, cost: 35000.00, price: 54999.00, stock: 11, minStock: 5, status: 'active', desc: 'Heavy-duty steel frame, solid bamboo desktop with cable tray' },
      { sku: 'FN-MNT-DUO', barcode: '8901234567897', name: 'Ergotron LX Dual Stacking Monitor Arm', catIdx: 2, cost: 16500.00, price: 24999.00, stock: 3, minStock: 6, status: 'active', desc: 'Polished aluminum gas-spring dual articulating arm (Low Stock)' },
      { sku: 'FN-STEEL-L', barcode: '8901234567898', name: 'Steelcase Gesture High-Back Task Chair', catIdx: 2, cost: 72000.00, price: 108000.00, stock: 9, minStock: 4, status: 'active', desc: 'Core Equalizer technology with 360-degree rotating arms' },

      { sku: 'AV-SHR-SM7', barcode: '8901234567899', name: 'Shure SM7B Studio Vocal Microphone', catIdx: 3, cost: 28000.00, price: 39990.00, stock: 16, minStock: 5, status: 'active', desc: 'Smooth, flat, wide-range frequency response for broadcasting' },
      { sku: 'AV-OBS-BOT', barcode: '8901234567800', name: 'OBSBOT Tiny 2 4K PTZ AI Auto-Tracking Webcam', catIdx: 3, cost: 22000.00, price: 32900.00, stock: 2, minStock: 5, status: 'active', desc: '1/1.5" CMOS sensor, voice control, AI subject tracking (Low Stock)' },
      { sku: 'AV-RODE-CA', barcode: '8901234567801', name: 'Rode Caster Pro II Integrated Production Studio', catIdx: 3, cost: 42000.00, price: 59900.00, stock: 7, minStock: 3, status: 'active', desc: 'Revolution Preamps, SMART pads, dual USB-C audio interfaces' },
      { sku: 'AV-ELG-LP', barcode: '8901234567802', name: 'Elgato Wave Mic Arm LP Low Profile', catIdx: 3, cost: 6500.00, price: 9999.00, stock: 31, minStock: 10, status: 'active', desc: 'All-metal construction, cable routing channels, 360 rotation' },

      { sku: 'PW-CAL-TS4', barcode: '8901234567803', name: 'CalDigit TS4 Thunderbolt 4 18-Port Hub', catIdx: 4, cost: 28000.00, price: 39995.00, stock: 19, minStock: 8, status: 'active', desc: '98W host charging, 2.5GbE Ethernet, 8K single or 6K dual display' },
      { sku: 'PW-ANK-GAN', barcode: '8901234567804', name: 'Anker Prime 240W 4-Port GaN Desktop Charger', catIdx: 4, cost: 11500.00, price: 16999.00, stock: 36, minStock: 12, status: 'active', desc: 'PowerIQ 4.0 ultra-fast multi-device power delivery' },
      { sku: 'PW-APC-150', barcode: '8901234567805', name: 'APC Back-UPS Pro 1500VA SineWave Tower UPS', catIdx: 4, cost: 18000.00, price: 26999.00, stock: 9, minStock: 4, status: 'active', desc: 'Battery backup & surge protector with LCD diagnostic display' },

      { sku: 'OS-DESK-PAD', barcode: '8901234567806', name: 'Orbitkey Top-Grain Leather Desk Mat (Large)', catIdx: 5, cost: 3800.00, price: 6999.00, stock: 40, minStock: 15, status: 'active', desc: 'Water-repellent top-grain leather with magnetic cable toolbar' },
      { sku: 'OS-NOT-PREM', barcode: '8901234567807', name: 'Baron Fig Master Bullet Journal Hardcover', catIdx: 5, cost: 1200.00, price: 2499.00, stock: 65, minStock: 20, status: 'active', desc: 'Acid-free 100gsm archival paper, dot grid layout, lay-flat spine' },
      { sku: 'OS-PEN-ROTR', barcode: '8901234567808', name: 'Rotring 800 Retractable Mechanical Pencil 0.5mm', catIdx: 5, cost: 2800.00, price: 4999.00, stock: 18, minStock: 8, status: 'active', desc: 'Full metal hexagonal brass body with twist-and-click mechanism' },
      { sku: 'OS-ORG-ALUM', barcode: '8901234567809', name: 'Grovemade Anodized Aluminum Desk Tray', catIdx: 5, cost: 4500.00, price: 7999.00, stock: 24, minStock: 8, status: 'active', desc: 'Precision-machined matte black aluminum organizational tray' },
    ];

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

      // Allocate stock across the 3 multi-stores
      const stock1 = Math.round(p.stock * 0.5);
      const stock2 = Math.round(p.stock * 0.3);
      const stock3 = p.stock - stock1 - stock2;

      await db.execute(
        `INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity, min_stock_threshold) VALUES (?, ?, ?, ?, ?)`,
        [businessId, store1Id, prodId, stock1, Math.round(p.minStock * 0.5)]
      );
      await db.execute(
        `INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity, min_stock_threshold) VALUES (?, ?, ?, ?, ?)`,
        [businessId, store2Id, prodId, stock2, Math.round(p.minStock * 0.3)]
      );
      await db.execute(
        `INSERT INTO store_inventory (business_id, store_id, product_id, stock_quantity, min_stock_threshold) VALUES (?, ?, ?, ?, ?)`,
        [businessId, store3Id, prodId, stock3, Math.max(1, p.minStock - Math.round(p.minStock * 0.5) - Math.round(p.minStock * 0.3))]
      );
    }

    // Inter-store stock transfer
    const firstProd = prodIdMap.get(1);
    if (firstProd) {
      await db.execute(`
        INSERT INTO stock_transfers (business_id, from_store_id, to_store_id, product_id, quantity, status, notes)
        VALUES (?, ?, ?, ?, 2, 'completed', 'Inter-branch rebalance from Bengaluru Tech Hub to Mumbai BKC')
      `, [businessId, store1Id, store2Id, firstProd.id]);
    }
  } else {
    const rows: any[] = await db.query('SELECT id, name, sku, cost_price, selling_price FROM products WHERE business_id = ? ORDER BY id ASC', [businessId]);
    rows.forEach((r, idx) => prodIdMap.set(idx + 1, { id: Number(r.id), name: r.name, sku: r.sku, cost: Number(r.cost_price), price: Number(r.selling_price) }));
  }

  // 4. Customers CRM
  const existingCusts = await db.queryOne('SELECT count(*) as cnt FROM customers WHERE business_id = ?', [businessId]);
  const custIdMap = new Map<number, number>();
  if (Number(existingCusts?.cnt || 0) === 0) {
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

    for (let i = 0; i < customersData.length; i++) {
      const c = customersData[i];
      const targetStore = i % 3 === 0 ? store1Id : (i % 3 === 1 ? store2Id : store3Id);
      const res = await db.execute(
        `INSERT INTO customers (business_id, store_id, name, email, phone, company, tier, address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [businessId, targetStore, c.name, c.email, c.phone, c.company, c.tier, c.address]
      );
      custIdMap.set(i + 1, Number(res.lastInsertId));
    }
  } else {
    const rows: any[] = await db.query('SELECT id FROM customers WHERE business_id = ? ORDER BY id ASC', [businessId]);
    rows.forEach((r, idx) => custIdMap.set(idx + 1, Number(r.id)));
  }

  // 5. Orders & Order Items
  const existingOrders = await db.queryOne('SELECT count(*) as cnt FROM orders WHERE business_id = ?', [businessId]);
  if (Number(existingOrders?.cnt || 0) === 0) {
    const now = new Date();
    const getPastDateISO = (daysAgo: number) => {
      const d = new Date(now.getTime() - (daysAgo * 86400000));
      return d.toISOString();
    };

    const orderPlans = [
      { daysAgo: 85, storeId: store1Id, custIdx: 1, items: [{ pIdx: 1, qty: 2 }, { pIdx: 2, qty: 2 }, { pIdx: 14, qty: 2 }], discount: 2500, payMethod: 'bank_transfer', status: 'completed' },
      { daysAgo: 81, storeId: store2Id, custIdx: 3, items: [{ pIdx: 6, qty: 3 }, { pIdx: 7, qty: 2 }, { pIdx: 17, qty: 4 }], discount: 1500, payMethod: 'card', status: 'completed' },
      { daysAgo: 77, storeId: store1Id, custIdx: 2, items: [{ pIdx: 10, qty: 2 }, { pIdx: 12, qty: 1 }, { pIdx: 13, qty: 2 }], discount: 800, payMethod: 'card', status: 'completed' },
      { daysAgo: 73, storeId: store3Id, custIdx: 5, items: [{ pIdx: 5, qty: 1 }, { pIdx: 2, qty: 1 }, { pIdx: 14, qty: 1 }], discount: 1000, payMethod: 'invoice', status: 'completed' },
      { daysAgo: 69, storeId: store2Id, custIdx: 6, items: [{ pIdx: 6, qty: 2 }, { pIdx: 9, qty: 2 }], discount: 2000, payMethod: 'bank_transfer', status: 'completed' },
      { daysAgo: 65, storeId: store1Id, custIdx: 8, items: [{ pIdx: 1, qty: 1 }, { pIdx: 3, qty: 4 }, { pIdx: 18, qty: 5 }], discount: 1200, payMethod: 'card', status: 'completed' },
      { daysAgo: 60, storeId: store3Id, custIdx: 9, items: [{ pIdx: 5, qty: 2 }, { pIdx: 14, qty: 2 }, { pIdx: 15, qty: 3 }], discount: 1800, payMethod: 'bank_transfer', status: 'completed' },
      { daysAgo: 54, storeId: store1Id, custIdx: 1, items: [{ pIdx: 2, qty: 3 }, { pIdx: 4, qty: 2 }], discount: 900, payMethod: 'cash', status: 'completed' },
      { daysAgo: 48, storeId: store2Id, custIdx: 4, items: [{ pIdx: 7, qty: 2 }, { pIdx: 8, qty: 1 }], discount: 500, payMethod: 'card', status: 'completed' },
      { daysAgo: 42, storeId: store1Id, custIdx: 2, items: [{ pIdx: 10, qty: 1 }, { pIdx: 11, qty: 1 }, { pIdx: 12, qty: 1 }], discount: 0, payMethod: 'invoice', status: 'completed' },
      { daysAgo: 38, storeId: store3Id, custIdx: 12, items: [{ pIdx: 14, qty: 2 }, { pIdx: 16, qty: 1 }], discount: 400, payMethod: 'cash', status: 'completed' },
      { daysAgo: 33, storeId: store1Id, custIdx: 3, items: [{ pIdx: 1, qty: 2 }, { pIdx: 6, qty: 2 }], discount: 3000, payMethod: 'bank_transfer', status: 'completed' },
      { daysAgo: 28, storeId: store2Id, custIdx: 7, items: [{ pIdx: 2, qty: 2 }, { pIdx: 3, qty: 2 }], discount: 600, payMethod: 'card', status: 'completed' },
      { daysAgo: 24, storeId: store1Id, custIdx: 11, items: [{ pIdx: 15, qty: 4 }, { pIdx: 18, qty: 10 }], discount: 350, payMethod: 'cash', status: 'completed' },
      { daysAgo: 20, storeId: store3Id, custIdx: 8, items: [{ pIdx: 1, qty: 1 }, { pIdx: 14, qty: 1 }], discount: 800, payMethod: 'invoice', status: 'completed' },
      { daysAgo: 16, storeId: store1Id, custIdx: 1, items: [{ pIdx: 6, qty: 3 }, { pIdx: 7, qty: 2 }], discount: 1500, payMethod: 'bank_transfer', status: 'completed' },
      { daysAgo: 12, storeId: store2Id, custIdx: 5, items: [{ pIdx: 10, qty: 2 }, { pIdx: 13, qty: 2 }], discount: 500, payMethod: 'card', status: 'completed' },
      { daysAgo: 8, storeId: store1Id, custIdx: 2, items: [{ pIdx: 2, qty: 2 }, { pIdx: 3, qty: 3 }], discount: 450, payMethod: 'cash', status: 'completed' },
      { daysAgo: 5, storeId: store3Id, custIdx: 9, items: [{ pIdx: 1, qty: 1 }, { pIdx: 14, qty: 1 }], discount: 0, payMethod: 'invoice', status: 'processing' },
      { daysAgo: 3, storeId: store2Id, custIdx: 6, items: [{ pIdx: 17, qty: 3 }, { pIdx: 19, qty: 2 }], discount: 200, payMethod: 'cash', status: 'completed' },
      { daysAgo: 1, storeId: store1Id, custIdx: 10, items: [{ pIdx: 3, qty: 2 }, { pIdx: 15, qty: 2 }], discount: 0, payMethod: 'card', status: 'pending' },
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

      const discount = Math.min(plan.discount, subtotal * 0.15);
      const taxable = Math.max(0, subtotal - discount);
      const tax = Number((taxable * 0.18).toFixed(2));
      const total = Number((taxable + tax).toFixed(2));
      const orderNum = `ORD-2026-${orderSeq++}`;
      const custId = custIdMap.get(plan.custIdx) || null;
      const createdAt = getPastDateISO(plan.daysAgo);
      const payStatus = plan.status === 'completed' ? 'paid' : (plan.status === 'processing' ? 'paid' : 'pending');

      const oRes = await db.execute(
        `INSERT INTO orders (business_id, store_id, order_number, customer_id, status, payment_method, payment_status, subtotal, discount_amount, tax_amount, total_amount, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [businessId, plan.storeId, orderNum, custId, plan.status, plan.payMethod, payStatus, subtotal, discount, tax, total, createdAt, createdAt]
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
  }

  // 6. Departments & Shifts
  const existingDepts = await db.queryOne('SELECT count(*) as cnt FROM departments WHERE business_id = ?', [businessId]);
  const deptMap = new Map<string, number>();
  if (Number(existingDepts?.cnt || 0) === 0) {
    const depts = [
      { name: 'Engineering & IT', description: 'Enterprise infrastructure, cloud devops and systems architecture' },
      { name: 'Enterprise Sales', description: 'Corporate B2B client accounts, contracts, and revenue operations' },
      { name: 'Warehouse & Logistics', description: 'Inventory management, store transfers, fulfillment, and shipping' },
      { name: 'Finance & HR', description: 'Treasury, payroll processing, statutory compliance, and talent' },
    ];
    for (const d of depts) {
      const res = await db.execute('INSERT INTO departments (business_id, name, description) VALUES (?, ?, ?)', [businessId, d.name, d.description]);
      deptMap.set(d.name, Number(res.lastInsertId));
    }
  } else {
    const rows: any[] = await db.query('SELECT id, name FROM departments WHERE business_id = ?', [businessId]);
    rows.forEach(r => deptMap.set(r.name, Number(r.id)));
  }

  const existingShifts = await db.queryOne('SELECT count(*) as cnt FROM shifts WHERE business_id = ?', [businessId]);
  const shiftMap = new Map<string, number>();
  if (Number(existingShifts?.cnt || 0) === 0) {
    const shifts = [
      { name: 'General Shift', start: '09:30', end: '18:30', grace: 15, hours: 9.0 },
      { name: 'Morning Shift', start: '08:00', end: '17:00', grace: 15, hours: 9.0 },
      { name: 'Evening Shift', start: '13:00', end: '22:00', grace: 15, hours: 9.0 },
    ];
    for (const s of shifts) {
      const res = await db.execute(
        'INSERT INTO shifts (business_id, name, start_time, end_time, grace_period_mins, working_hours) VALUES (?, ?, ?, ?, ?, ?)',
        [businessId, s.name, s.start, s.end, s.grace, s.hours]
      );
      shiftMap.set(s.name, Number(res.lastInsertId));
    }
  } else {
    const rows: any[] = await db.query('SELECT id, name FROM shifts WHERE business_id = ?', [businessId]);
    rows.forEach(r => shiftMap.set(r.name, Number(r.id)));
  }

  // 7. Employees, Leaves & Attendance
  const existingEmps = await db.queryOne('SELECT count(*) as cnt FROM employees WHERE business_id = ?', [businessId]);
  const empIdList: { id: number; storeId: number }[] = [];
  if (Number(existingEmps?.cnt || 0) === 0) {
    const itDeptId = deptMap.get('Engineering & IT') || 1;
    const salesDeptId = deptMap.get('Enterprise Sales') || 1;
    const logDeptId = deptMap.get('Warehouse & Logistics') || 1;
    const finDeptId = deptMap.get('Finance & HR') || 1;

    const genShiftId = shiftMap.get('General Shift') || 1;
    const mornShiftId = shiftMap.get('Morning Shift') || 1;
    const eveShiftId = shiftMap.get('Evening Shift') || 1;

    const employees = [
      { code: 'EMP-2026-001', name: 'Vikram Malhotra', email: 'vikram.m@apex-enterprises.in', phone: '+91 98201 11223', designation: 'Lead Systems Architect', dept: itDeptId, shift: genShiftId, store: store1Id, basic: 145000, hra: 45000, allowances: 20000, deductions: 12000, rating: 4.9, status: 'active', contactName: 'Anjali Malhotra', contactPhone: '+91 98201 99887', relation: 'Spouse', joinDate: '2023-04-15' },
      { code: 'EMP-2026-002', name: 'Neha Sharma', email: 'neha.s@apex-enterprises.in', phone: '+91 98450 22334', designation: 'VP Enterprise Sales', dept: salesDeptId, shift: genShiftId, store: store2Id, basic: 125000, hra: 40000, allowances: 25000, deductions: 10000, rating: 4.8, status: 'active', contactName: 'Ramesh Sharma', contactPhone: '+91 98450 88776', relation: 'Father', joinDate: '2023-08-01' },
      { code: 'EMP-2026-003', name: 'Rajesh Verma', email: 'rajesh.v@apex-enterprises.in', phone: '+91 98110 33445', designation: 'Warehouse Operations Lead', dept: logDeptId, shift: mornShiftId, store: store1Id, basic: 75000, hra: 25000, allowances: 10000, deductions: 6000, rating: 4.6, status: 'active', contactName: 'Sunita Verma', contactPhone: '+91 98110 77665', relation: 'Spouse', joinDate: '2024-01-10' },
      { code: 'EMP-2026-004', name: 'Pooja Patel', email: 'pooja.p@apex-enterprises.in', phone: '+91 98900 44556', designation: 'Senior Financial Controller', dept: finDeptId, shift: genShiftId, store: store2Id, basic: 95000, hra: 30000, allowances: 15000, deductions: 8000, rating: 4.7, status: 'active', contactName: 'Kirit Patel', contactPhone: '+91 98900 66554', relation: 'Father', joinDate: '2023-11-20' },
      { code: 'EMP-2026-005', name: 'Amit Deshmukh', email: 'amit.d@apex-enterprises.in', phone: '+91 98100 55667', designation: 'Cloud Infrastructure Engineer', dept: itDeptId, shift: eveShiftId, store: store1Id, basic: 68000, hra: 22000, allowances: 10000, deductions: 5500, rating: 4.5, status: 'active', contactName: 'Savita Deshmukh', contactPhone: '+91 98100 55443', relation: 'Mother', joinDate: '2024-06-01' },
      { code: 'EMP-2026-006', name: 'Priya Nair', email: 'priya.n@apex-enterprises.in', phone: '+91 98490 66778', designation: 'Procurement Coordinator', dept: logDeptId, shift: genShiftId, store: store1Id, basic: 48000, hra: 16000, allowances: 6000, deductions: 4000, rating: 4.5, status: 'active', contactName: 'Mohan Nair', contactPhone: '+91 98490 44332', relation: 'Brother', joinDate: '2024-09-15' },
      { code: 'EMP-2026-007', name: 'Siddharth Roy', email: 'siddharth.r@apex-enterprises.in', phone: '+91 98300 77889', designation: 'Corporate Account Executive', dept: salesDeptId, shift: genShiftId, store: store3Id, basic: 82000, hra: 26000, allowances: 14000, deductions: 7000, rating: 4.6, status: 'active', contactName: 'Manojit Roy', contactPhone: '+91 98300 22110', relation: 'Father', joinDate: '2024-03-01' },
      { code: 'EMP-2026-008', name: 'Kavita Reddy', email: 'kavita.r@apex-enterprises.in', phone: '+91 98490 88990', designation: 'HR & Talent Operations Lead', dept: finDeptId, shift: genShiftId, store: store1Id, basic: 70000, hra: 24000, allowances: 8000, deductions: 5000, rating: 4.7, status: 'active', contactName: 'Suresh Reddy', contactPhone: '+91 98490 11223', relation: 'Spouse', joinDate: '2024-02-15' },
      { code: 'EMP-2026-009', name: 'Arjun Singhania', email: 'arjun.s@apex-enterprises.in', phone: '+91 98100 99001', designation: 'Technical Support Specialist', dept: itDeptId, shift: mornShiftId, store: store3Id, basic: 58000, hra: 18000, allowances: 7000, deductions: 4500, rating: 4.4, status: 'active', contactName: 'Deepak Singhania', contactPhone: '+91 98100 88776', relation: 'Father', joinDate: '2024-10-01' },
      { code: 'EMP-2026-010', name: 'Meera Iyer', email: 'meera.i@apex-enterprises.in', phone: '+91 98400 11335', designation: 'Inventory Specialist', dept: logDeptId, shift: mornShiftId, store: store2Id, basic: 42000, hra: 14000, allowances: 5000, deductions: 3500, rating: 4.3, status: 'active', contactName: 'Karthik Iyer', contactPhone: '+91 98400 33445', relation: 'Spouse', joinDate: '2025-01-05' },
    ];

    for (const e of employees) {
      const eRes = await db.execute(`
        INSERT INTO employees (
          business_id, store_id, department_id, shift_id, employee_code, name, email, phone,
          designation, joining_date, employment_status, basic_salary, hra, allowances, deductions,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation, performance_rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        businessId, e.store, e.dept, e.shift, e.code, e.name, e.email, e.phone,
        e.designation, e.joinDate, e.status, e.basic, e.hra, e.allowances, e.deductions,
        e.contactName, e.contactPhone, e.relation, e.rating
      ]);
      const empId = Number(eRes.lastInsertId);
      empIdList.push({ id: empId, storeId: e.store });

      // Initialize leave balances for 2026
      await db.execute(`
        INSERT INTO leave_balances (business_id, employee_id, year, casual_total, casual_used, sick_total, sick_used, paid_total, paid_used, unpaid_used)
        VALUES (?, ?, 2026, 12.0, 1.0, 12.0, 0.5, 15.0, 2.0, 0.0)
      `, [businessId, empId]);
    }

    // Leave Applications
    if (empIdList.length >= 4) {
      await db.execute(`
        INSERT INTO leaves (business_id, employee_id, leave_type, start_date, end_date, days_count, reason, status, reviewed_at, review_notes)
        VALUES (?, ?, 'casual', '2026-10-15', '2026-10-16', 2.0, 'Attending family wedding ceremony', 'approved', '2026-10-14 11:30:00', 'Approved by Operations Head')
      `, [businessId, empIdList[0].id]);

      await db.execute(`
        INSERT INTO leaves (business_id, employee_id, leave_type, start_date, end_date, days_count, reason, status)
        VALUES (?, ?, 'sick', '2026-11-04', '2026-11-05', 2.0, 'Seasonal viral infection & medical rest', 'pending')
      `, [businessId, empIdList[4].id]);

      await db.execute(`
        INSERT INTO leaves (business_id, employee_id, leave_type, start_date, end_date, days_count, reason, status, reviewed_at, review_notes)
        VALUES (?, ?, 'paid', '2026-10-22', '2026-10-24', 3.0, 'Annual personal leave for family retreat', 'approved', '2026-10-20 14:00:00', 'Approved by HR Lead')
      `, [businessId, empIdList[3].id]);

      await db.execute(`
        INSERT INTO leaves (business_id, employee_id, leave_type, start_date, end_date, days_count, reason, status, reviewed_at, review_notes)
        VALUES (?, ?, 'casual', '2026-09-18', '2026-09-18', 1.0, 'Personal relocation duties', 'rejected', '2026-09-17 16:30:00', 'Critical project release date')
      `, [businessId, empIdList[8].id]);
    }

    // 14 Days Attendance history
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (isWeekend) continue;

      for (let j = 0; j < empIdList.length; j++) {
        const emp = empIdList[j];
        const isLate = (j === 4 && i === 1) || (j === 8 && i === 3);
        const lateMins = isLate ? 25 : 0;
        const checkIn = isLate ? '09:55:00' : '09:25:00';
        const hasOt = (j === 0 && i === 2) || (j === 2 && i === 4);
        const checkOut = hasOt ? '20:15:00' : '18:35:00';
        const otHours = hasOt ? 1.5 : 0.0;
        const status = isLate ? 'late' : 'present';
        const workHours = 9.0 + otHours;
        const isCorrected = (j === 4 && i === 1);

        await db.execute(`
          INSERT INTO attendance (business_id, store_id, employee_id, date, check_in, check_out, working_hours, overtime_hours, status, late_mins, is_corrected, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          businessId, emp.storeId, emp.id, dateStr,
          `${dateStr} ${checkIn}`, `${dateStr} ${checkOut}`,
          workHours, otHours, status, lateMins,
          isCorrected ? 1 : 0,
          isCorrected ? 'Manager correction: Verified travel delay due to heavy rain' : null
        ]);
      }
    }
  } else {
    const rows: any[] = await db.query('SELECT id, store_id FROM employees WHERE business_id = ?', [businessId]);
    rows.forEach(r => empIdList.push({ id: Number(r.id), storeId: Number(r.store_id || 1) }));
  }

  // 8. Payroll & Slips
  const existingPayrolls = await db.queryOne('SELECT count(*) as cnt FROM payrolls WHERE business_id = ?', [businessId]);
  if (Number(existingPayrolls?.cnt || 0) === 0 && empIdList.length > 0) {
    const empRows: any[] = await db.query('SELECT id, store_id, basic_salary, hra, allowances, deductions FROM employees WHERE business_id = ?', [businessId]);
    let totalPayrollAmount = 0;
    for (const e of empRows) {
      totalPayrollAmount += (Number(e.basic_salary) + Number(e.hra) + Number(e.allowances) - Number(e.deductions));
    }

    const pRes = await db.execute(`
      INSERT INTO payrolls (business_id, store_id, month, year, total_amount, total_employees, status, paid_at, payment_method, notes)
      VALUES (?, ?, 10, 2026, ?, ?, 'paid', '2026-10-31 17:30:00', 'bank_transfer', 'Disbursed via Corporate HDFC NetBanking batch payout')
    `, [businessId, store1Id, totalPayrollAmount, empRows.length]);
    const payrollId = Number(pRes.lastInsertId);

    let slipIdx = 1;
    for (const e of empRows) {
      const net = Number(e.basic_salary) + Number(e.hra) + Number(e.allowances) - Number(e.deductions);
      const slipNumber = `SLIP-2026-10-${String(slipIdx++).padStart(3, '0')}`;
      await db.execute(`
        INSERT INTO payroll_items (payroll_id, employee_id, basic_salary, hra, allowances, deductions, net_salary, working_days, present_days, status, payment_method, paid_at, slip_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, 30.0, 30.0, 'paid', 'bank_transfer', '2026-10-31 17:30:00', ?)
      `, [payrollId, e.id, e.basic_salary, e.hra, e.allowances, e.deductions, net, slipNumber]);
    }
  }

  // 9. Suppliers & Purchase Orders
  const existingSuppliers = await db.queryOne('SELECT count(*) as cnt FROM suppliers WHERE business_id = ?', [businessId]);
  const supIdList: number[] = [];
  if (Number(existingSuppliers?.cnt || 0) === 0) {
    const suppliers = [
      { name: 'Apex Tech Hardware Distributors', code: 'SUP-001', person: 'Gaurav Singhania', email: 'orders@apexhardware.in', phone: '+91 80 4123 4567', gstin: '29AABCA1234F1Z1', city: 'Bengaluru', state: 'Karnataka', balance: 0 },
      { name: 'ErgoComfort Commercial Seating Ltd', code: 'SUP-002', person: 'Vandana Kulkarni', email: 'b2b@ergocomfort.co.in', phone: '+91 20 2567 8901', gstin: '27AABCE5678G2Z2', city: 'Pune', state: 'Maharashtra', balance: 35000 },
      { name: 'AudioPro Acoustic Solutions', code: 'SUP-003', person: 'Manish Bhatia', email: 'sales@audioproindia.com', phone: '+91 11 4321 0987', gstin: '07AABCJ9012K3Z3', city: 'New Delhi', state: 'Delhi', balance: 0 },
      { name: 'GreenLine Power & Cabling Corp', code: 'SUP-004', person: 'Sundar Raman', email: 'corp@greenlinepower.in', phone: '+91 44 2890 1234', gstin: '33AABCP3456L4Z4', city: 'Chennai', state: 'Tamil Nadu', balance: 0 },
      { name: 'Orient Office & Packaging Supplies', code: 'SUP-005', person: 'Meenal Jain', email: 'supplies@orientpackaging.in', phone: '+91 80 2234 5678', gstin: '29AABCO7890M5Z5', city: 'Bengaluru', state: 'Karnataka', balance: 8500 },
    ];

    for (const s of suppliers) {
      const res = await db.execute(`
        INSERT INTO suppliers (business_id, name, code, contact_person, email, phone, gstin, city, state, status, outstanding_balance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `, [businessId, s.name, s.code, s.person, s.email, s.phone, s.gstin, s.city, s.state, s.balance]);
      supIdList.push(Number(res.lastInsertId));
    }

    // Purchase Orders
    const prods: any[] = await db.query('SELECT id, name, sku, cost_price FROM products WHERE business_id = ? ORDER BY id ASC LIMIT 5', [businessId]);
    if (prods.length >= 2 && supIdList.length >= 2) {
      // PO 1: Received & Paid
      const po1Res = await db.execute(`
        INSERT INTO purchase_orders (business_id, store_id, supplier_id, po_number, order_date, received_date, subtotal, tax_amount, total_amount, paid_amount, status)
        VALUES (?, ?, ?, 'PO-2026-001', '2026-10-10', '2026-10-16', 250000.0, 45000.0, 295000.0, 295000.0, 'received')
      `, [businessId, store1Id, supIdList[0]]);
      const po1Id = Number(po1Res.lastInsertId);
      await db.execute(`
        INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_sku, quantity, unit_cost, received_quantity, line_total)
        VALUES (?, ?, ?, ?, 2, ?, 2, ?)
      `, [po1Id, prods[0].id, prods[0].name, prods[0].sku, prods[0].cost_price, prods[0].cost_price * 2]);

      // PO 2: In-Transit / Ordered
      const po2Res = await db.execute(`
        INSERT INTO purchase_orders (business_id, store_id, supplier_id, po_number, order_date, expected_delivery, subtotal, tax_amount, total_amount, paid_amount, status)
        VALUES (?, ?, ?, 'PO-2026-002', '2026-10-28', '2026-11-08', 140000.0, 25200.0, 165200.0, 50000.0, 'ordered')
      `, [businessId, store1Id, supIdList[1]]);
      const po2Id = Number(po2Res.lastInsertId);
      await db.execute(`
        INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_sku, quantity, unit_cost, received_quantity, line_total)
        VALUES (?, ?, ?, ?, 4, ?, 0, ?)
      `, [po2Id, prods[1].id, prods[1].name, prods[1].sku, prods[1].cost_price, prods[1].cost_price * 4]);

      // PO 3: Partially Received (Mumbai branch)
      const po3Res = await db.execute(`
        INSERT INTO purchase_orders (business_id, store_id, supplier_id, po_number, order_date, expected_delivery, received_date, subtotal, tax_amount, total_amount, paid_amount, status)
        VALUES (?, ?, ?, 'PO-2026-003', '2026-10-20', '2026-10-27', '2026-10-26', 75000.0, 13500.0, 88500.0, 53500.0, 'partially_received')
      `, [businessId, store2Id, supIdList[1]]);
      const po3Id = Number(po3Res.lastInsertId);
      await db.execute(`
        INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_sku, quantity, unit_cost, received_quantity, line_total)
        VALUES (?, ?, ?, ?, 3, 25000.0, 2, 75000.0)
      `, [po3Id, prods[1].id, prods[1].name, prods[1].sku]);
    }
  }

  // 10. Expenses & Categories
  const existingExpCats = await db.queryOne('SELECT count(*) as cnt FROM expense_categories WHERE business_id = ?', [businessId]);
  const expCatMap = new Map<string, number>();
  if (Number(existingExpCats?.cnt || 0) === 0) {
    const catNames = [
      'Rent & Facility Lease',
      'Electricity, Power & Utilities',
      'Broadband & Cloud Infrastructure',
      'Salaries & Employee Wages',
      'Marketing & B2B Client Acquisition',
      'Supplier Invoices & Freight',
      'Hardware Maintenance & Repair'
    ];
    for (const name of catNames) {
      const res = await db.execute('INSERT INTO expense_categories (business_id, name, is_system) VALUES (?, ?, 1)', [businessId, name]);
      expCatMap.set(name, Number(res.lastInsertId));
    }
  } else {
    const rows: any[] = await db.query('SELECT id, name FROM expense_categories WHERE business_id = ?', [businessId]);
    rows.forEach(r => expCatMap.set(r.name, Number(r.id)));
  }

  const existingExpenses = await db.queryOne('SELECT count(*) as cnt FROM expenses WHERE business_id = ?', [businessId]);
  if (Number(existingExpenses?.cnt || 0) === 0) {
    const rentCat = expCatMap.get('Rent & Facility Lease') || 1;
    const utilCat = expCatMap.get('Electricity, Power & Utilities') || 1;
    const netCat = expCatMap.get('Broadband & Cloud Infrastructure') || 1;
    const mktCat = expCatMap.get('Marketing & B2B Client Acquisition') || 1;
    const maintCat = expCatMap.get('Hardware Maintenance & Repair') || 1;

    const expenses = [
      { title: 'Commercial Office Lease - Bengaluru Whitefield Tech Zone', amount: 85000.0, date: '2026-10-01', catId: rentCat, storeId: store1Id, method: 'bank_transfer' },
      { title: 'Commercial Office Lease - Mumbai BKC Commercial Centre', amount: 65000.0, date: '2026-10-01', catId: rentCat, storeId: store2Id, method: 'bank_transfer' },
      { title: 'Dedicated Leased Line Internet & AWS Cloud Ingress', amount: 16800.0, date: '2026-10-04', catId: netCat, storeId: store1Id, method: 'bank_transfer' },
      { title: 'Commercial Electricity & Air Conditioning - Bengaluru Hub', amount: 24500.0, date: '2026-10-08', catId: utilCat, storeId: store1Id, method: 'upi' },
      { title: 'B2B Enterprise Lead Gen Google Ads & LinkedIn Campaign', amount: 45000.0, date: '2026-10-12', catId: mktCat, storeId: store1Id, method: 'card' },
      { title: 'Server Rack UPS Battery Diagnostic & Power Filter Replacement', amount: 12500.0, date: '2026-10-17', catId: maintCat, storeId: store1Id, method: 'bank_transfer' },
      { title: 'Commercial Electricity - Mumbai BKC Centre', amount: 18200.0, date: '2026-10-19', catId: utilCat, storeId: store2Id, method: 'upi' },
      { title: 'Warehouse Thermal Shipping Roll Stock & Heavy Duty Packing Materials', amount: 9500.0, date: '2026-10-24', catId: maintCat, storeId: store1Id, method: 'upi' },
      { title: 'Commercial Facility Lease - Delhi NCR CyberCity', amount: 48000.0, date: '2026-10-02', catId: rentCat, storeId: store3Id, method: 'bank_transfer' },
      { title: 'Airtel Enterprise Fiber Connectivity - Delhi NCR Branch', amount: 8500.0, date: '2026-10-06', catId: netCat, storeId: store3Id, method: 'upi' },
    ];

    for (const exp of expenses) {
      await db.execute(`
        INSERT INTO expenses (business_id, store_id, category_id, title, amount, date, payment_method, payment_status, reference_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', 'direct')
      `, [businessId, exp.storeId, exp.catId, exp.title, exp.amount, exp.date, exp.method]);
    }
  }

  // 11. Notifications
  const existingNotifs = await db.queryOne('SELECT count(*) as cnt FROM notifications WHERE business_id = ?', [businessId]);
  if (Number(existingNotifs?.cnt || 0) === 0) {
    const alerts = [
      { type: 'warning', title: 'Low Stock Threshold Alert', message: 'Keychron Q3 Pro Custom Mechanical Keyboard is at 4 units (Threshold: 10). Restock recommended.', link: '/inventory' },
      { type: 'info', title: 'Pending Leave Approval', message: 'Amit Deshmukh submitted a 2-day sick leave request awaiting manager review.', link: '/leaves' },
      { type: 'success', title: 'October Payroll Disbursed', message: 'Monthly payroll for October 2026 disbursed to 10 staff members via corporate bank transfer.', link: '/payroll' },
      { type: 'info', title: 'Purchase Order In Transit', message: 'PO-2026-002 with ErgoComfort Seating Ltd expected by Nov 08, 2026.', link: '/suppliers' },
    ];
    for (const a of alerts) {
      await db.execute(`
        INSERT INTO notifications (business_id, type, title, message, link, is_read)
        VALUES (?, ?, ?, ?, ?, 0)
      `, [businessId, a.type, a.title, a.message, a.link]);
    }
  }

  return {
    success: true,
    message: 'Complete enterprise demo dataset (Multi-Store, Inventory, Staff, Attendance, Leaves, Payroll, Suppliers, Expenses & CRM) populated successfully!'
  };
}
