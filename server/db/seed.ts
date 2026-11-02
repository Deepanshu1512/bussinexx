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
    await seedDatabaseForBusiness(businessId);
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

  const primaryStore = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND is_primary = 1', [businessId]);
  const storeId = primaryStore ? Number(primaryStore.id) : 1;

  // Check if products already exist for this business
  const existingProds = await db.queryOne('SELECT count(*) as cnt FROM products WHERE business_id = ?', [businessId]);
  if (Number(existingProds?.cnt || 0) === 0) {
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
  }

  // 6. Seed Departments & Shifts (if empty)
  const deptCount = await db.queryOne('SELECT count(*) as cnt FROM departments WHERE business_id = ?', [businessId]);
  if (Number(deptCount?.cnt || 0) === 0) {
    const depts = [
      { name: 'Engineering & IT', description: 'Enterprise infrastructure, devops and software solutions' },
      { name: 'Sales & Client Accounts', description: 'B2B enterprise client acquisitions and account management' },
      { name: 'Warehouse & Logistics', description: 'Inventory management, fulfillment, and supplier operations' },
      { name: 'Finance & Accounts', description: 'Treasury, payroll processing, and statutory compliance' },
    ];
    for (const d of depts) {
      await db.execute('INSERT INTO departments (business_id, name, description) VALUES (?, ?, ?)', [businessId, d.name, d.description]);
    }
  }

  const shiftCount = await db.queryOne('SELECT count(*) as cnt FROM shifts WHERE business_id = ?', [businessId]);
  if (Number(shiftCount?.cnt || 0) === 0) {
    const shifts = [
      { name: 'General Shift', start: '09:30', end: '18:30', grace: 15, hours: 9.0 },
      { name: 'Morning Shift', start: '08:00', end: '17:00', grace: 15, hours: 9.0 },
      { name: 'Evening Shift', start: '13:00', end: '22:00', grace: 15, hours: 9.0 },
    ];
    for (const s of shifts) {
      await db.execute(
        'INSERT INTO shifts (business_id, name, start_time, end_time, grace_period_mins, working_hours) VALUES (?, ?, ?, ?, ?, ?)',
        [businessId, s.name, s.start, s.end, s.grace, s.hours]
      );
    }
  }

  // 7. Seed Employees, Leave Balances, Leaves, and Attendance (if empty)
  const empCount = await db.queryOne('SELECT count(*) as cnt FROM employees WHERE business_id = ?', [businessId]);
  if (Number(empCount?.cnt || 0) === 0) {
    const deptRows: any[] = await db.query('SELECT id, name FROM departments WHERE business_id = ?', [businessId]);
    const shiftRows: any[] = await db.query('SELECT id, name FROM shifts WHERE business_id = ?', [businessId]);
    const itDept = deptRows.find(d => d.name.includes('Engineering'))?.id || deptRows[0]?.id;
    const salesDept = deptRows.find(d => d.name.includes('Sales'))?.id || deptRows[0]?.id;
    const logDept = deptRows.find(d => d.name.includes('Logistics'))?.id || deptRows[0]?.id;
    const finDept = deptRows.find(d => d.name.includes('Finance'))?.id || deptRows[0]?.id;

    const genShift = shiftRows.find(s => s.name.includes('General'))?.id || shiftRows[0]?.id;
    const mornShift = shiftRows.find(s => s.name.includes('Morning'))?.id || shiftRows[0]?.id;
    const eveShift = shiftRows.find(s => s.name.includes('Evening'))?.id || shiftRows[0]?.id;

    const employees = [
      { code: 'EMP-2026-001', name: 'Vikram Malhotra', email: 'vikram.m@apex-enterprises.in', phone: '+91 98201 11223', designation: 'Lead Systems Architect', dept: itDept, shift: genShift, basic: 145000, hra: 45000, allowances: 20000, deductions: 12000, rating: 4.9, status: 'active', contactName: 'Anjali Malhotra', contactPhone: '+91 98201 99887', relation: 'Spouse' },
      { code: 'EMP-2026-002', name: 'Neha Sharma', email: 'neha.s@apex-enterprises.in', phone: '+91 98450 22334', designation: 'Enterprise Sales Lead', dept: salesDept, shift: genShift, basic: 120000, hra: 40000, allowances: 25000, deductions: 10000, rating: 4.8, status: 'active', contactName: 'Ramesh Sharma', contactPhone: '+91 98450 88776', relation: 'Father' },
      { code: 'EMP-2026-003', name: 'Rajesh Verma', email: 'rajesh.v@apex-enterprises.in', phone: '+91 98110 33445', designation: 'Warehouse Operations Manager', dept: logDept, shift: mornShift, basic: 75000, hra: 25000, allowances: 10000, deductions: 6000, rating: 4.6, status: 'active', contactName: 'Sunita Verma', contactPhone: '+91 98110 77665', relation: 'Spouse' },
      { code: 'EMP-2026-004', name: 'Pooja Patel', email: 'pooja.p@apex-enterprises.in', phone: '+91 98900 44556', designation: 'Senior Accounts Officer', dept: finDept, shift: genShift, basic: 95000, hra: 30000, allowances: 15000, deductions: 8000, rating: 4.7, status: 'active', contactName: 'Kirit Patel', contactPhone: '+91 98900 66554', relation: 'Father' },
      { code: 'EMP-2026-005', name: 'Amit Deshmukh', email: 'amit.d@apex-enterprises.in', phone: '+91 98100 55667', designation: 'Technical Support Specialist', dept: itDept, shift: eveShift, basic: 55000, hra: 18000, allowances: 7000, deductions: 4500, rating: 4.4, status: 'active', contactName: 'Savita Deshmukh', contactPhone: '+91 98100 55443', relation: 'Mother' },
      { code: 'EMP-2026-006', name: 'Priya Nair', email: 'priya.n@apex-enterprises.in', phone: '+91 98490 66778', designation: 'Procurement Coordinator', dept: logDept, shift: genShift, basic: 48000, hra: 16000, allowances: 6000, deductions: 4000, rating: 4.5, status: 'active', contactName: 'Mohan Nair', contactPhone: '+91 98490 44332', relation: 'Brother' },
    ];

    const empIdList: number[] = [];
    for (const e of employees) {
      const eRes = await db.execute(`
        INSERT INTO employees (
          business_id, store_id, department_id, shift_id, employee_code, name, email, phone,
          designation, employment_status, basic_salary, hra, allowances, deductions,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation, performance_rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        businessId, storeId, e.dept, e.shift, e.code, e.name, e.email, e.phone,
        e.designation, e.status, e.basic, e.hra, e.allowances, e.deductions,
        e.contactName, e.contactPhone, e.relation, e.rating
      ]);
      const empId = Number(eRes.lastInsertId);
      empIdList.push(empId);

      // Leave Balances
      await db.execute(`
        INSERT INTO leave_balances (business_id, employee_id, year, casual_total, casual_used, sick_total, sick_used, paid_total, paid_used, unpaid_used)
        VALUES (?, ?, 2026, 12.0, 1.0, 12.0, 0.5, 15.0, 2.0, 0.0)
      `, [businessId, empId]);
    }

    // Leave Applications
    if (empIdList.length >= 2) {
      await db.execute(`
        INSERT INTO leaves (business_id, employee_id, leave_type, start_date, end_date, days_count, reason, status, reviewed_at, review_notes)
        VALUES (?, ?, 'casual', '2026-10-15', '2026-10-16', 2.0, 'Family wedding ceremony', 'approved', '2026-10-14 11:30:00', 'Approved by Operations Head')
      `, [businessId, empIdList[0]]);

      await db.execute(`
        INSERT INTO leaves (business_id, employee_id, leave_type, start_date, end_date, days_count, reason, status)
        VALUES (?, ?, 'sick', '2026-11-03', '2026-11-04', 2.0, 'Viral fever recovery & rest', 'pending')
      `, [businessId, empIdList[4]]);
    }

    // Seed 7 days of attendance
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (isWeekend) continue;

      for (let j = 0; j < empIdList.length; j++) {
        const empId = empIdList[j];
        const late = j === 4 && i === 1 ? 25 : 0;
        const checkIn = late ? '09:55:00' : '09:25:00';
        const checkOut = j === 0 && i === 2 ? '20:00:00' : '18:35:00';
        const ot = j === 0 && i === 2 ? 1.5 : 0.0;
        const status = late ? 'late' : 'present';
        const workHrs = 9.0 + ot;

        await db.execute(`
          INSERT INTO attendance (business_id, store_id, employee_id, date, check_in, check_out, working_hours, overtime_hours, status, late_mins)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [businessId, storeId, empId, dateStr, checkIn, checkOut, workHrs, ot, status, late]);
      }
    }
  }

  // 8. Seed Suppliers & Purchase Orders (if empty)
  const supCount = await db.queryOne('SELECT count(*) as cnt FROM suppliers WHERE business_id = ?', [businessId]);
  if (Number(supCount?.cnt || 0) === 0) {
    const suppliers = [
      { name: 'Apex Tech Hardware Distributors', code: 'SUP-001', person: 'Gaurav Singhania', email: 'orders@apexhardware.in', phone: '+91 80 4123 4567', gstin: '29AABCA1234F1Z1', city: 'Bengaluru', state: 'Karnataka' },
      { name: 'ErgoComfort Commercial Seating Ltd', code: 'SUP-002', person: 'Vandana Kulkarni', email: 'b2b@ergocomfort.co.in', phone: '+91 20 2567 8901', gstin: '27AABCE5678G2Z2', city: 'Pune', state: 'Maharashtra' },
      { name: 'AudioPro Acoustic Solutions', code: 'SUP-003', person: 'Manish Bhatia', email: 'sales@audioproindia.com', phone: '+91 11 4321 0987', gstin: '07AABCJ9012K3Z3', city: 'New Delhi', state: 'Delhi' },
      { name: 'GreenLine Power & Cabling Corp', code: 'SUP-004', person: 'Sundar Raman', email: 'corp@greenlinepower.in', phone: '+91 44 2890 1234', gstin: '33AABCP3456L4Z4', city: 'Chennai', state: 'Tamil Nadu' },
    ];

    const supIds: number[] = [];
    for (const s of suppliers) {
      const res = await db.execute(`
        INSERT INTO suppliers (business_id, name, code, contact_person, email, phone, gstin, city, state, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, [businessId, s.name, s.code, s.person, s.email, s.phone, s.gstin, s.city, s.state]);
      supIds.push(Number(res.lastInsertId));
    }

    // Purchase Orders
    const prods: any[] = await db.query('SELECT id, name, sku, cost_price FROM products WHERE business_id = ? LIMIT 5', [businessId]);
    if (prods.length >= 2 && supIds.length >= 2) {
      const po1Res = await db.execute(`
        INSERT INTO purchase_orders (business_id, store_id, supplier_id, po_number, order_date, received_date, subtotal, tax_amount, total_amount, paid_amount, status)
        VALUES (?, ?, ?, 'PO-2026-001', '2026-10-10', '2026-10-16', 250000.0, 45000.0, 295000.0, 295000.0, 'received')
      `, [businessId, storeId, supIds[0]]);
      const po1Id = Number(po1Res.lastInsertId);
      await db.execute(`
        INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_sku, quantity, unit_cost, received_quantity, line_total)
        VALUES (?, ?, ?, ?, 2, ?, 2, ?)
      `, [po1Id, prods[0].id, prods[0].name, prods[0].sku, prods[0].cost_price, prods[0].cost_price * 2]);

      const po2Res = await db.execute(`
        INSERT INTO purchase_orders (business_id, store_id, supplier_id, po_number, order_date, expected_delivery, subtotal, tax_amount, total_amount, paid_amount, status)
        VALUES (?, ?, ?, 'PO-2026-002', '2026-10-28', '2026-11-08', 140000.0, 25200.0, 165200.0, 50000.0, 'ordered')
      `, [businessId, storeId, supIds[1]]);
      const po2Id = Number(po2Res.lastInsertId);
      await db.execute(`
        INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_sku, quantity, unit_cost, received_quantity, line_total)
        VALUES (?, ?, ?, ?, 4, ?, 0, ?)
      `, [po2Id, prods[1].id, prods[1].name, prods[1].sku, prods[1].cost_price, prods[1].cost_price * 4]);
    }
  }

  // 9. Seed Operating Expenses (if empty)
  const expCount = await db.queryOne('SELECT count(*) as cnt FROM expenses WHERE business_id = ?', [businessId]);
  if (Number(expCount?.cnt || 0) === 0) {
    const rentCat = await db.queryOne('SELECT id FROM expense_categories WHERE business_id = ? AND name LIKE ?', [businessId, '%Rent%']);
    const utilCat = await db.queryOne('SELECT id FROM expense_categories WHERE business_id = ? AND name LIKE ?', [businessId, '%Utilities%']);
    const mktCat = await db.queryOne('SELECT id FROM expense_categories WHERE business_id = ? AND name LIKE ?', [businessId, '%Marketing%']);
    const eqCat = await db.queryOne('SELECT id FROM expense_categories WHERE business_id = ? AND name LIKE ?', [businessId, '%Equipment%']);

    const expenses = [
      { title: 'Commercial Office Lease - Whitefield Tech Zone', amount: 65000.0, date: '2026-10-01', catId: rentCat?.id, method: 'bank_transfer' },
      { title: 'Commercial Electricity & Dedicated Leased Line Internet', amount: 18450.0, date: '2026-10-05', catId: utilCat?.id, method: 'upi' },
      { title: 'B2B Enterprise Growth & Google Ads Campaign', amount: 32000.0, date: '2026-10-12', catId: mktCat?.id, method: 'credit_card' },
      { title: 'Annual Server Rack Maintenance & Power UPS Inspection', amount: 14200.0, date: '2026-10-18', catId: eqCat?.id, method: 'bank_transfer' },
      { title: 'Warehouse Packing Materials & Thermal Barcode Roll Stock', amount: 8900.0, date: '2026-10-24', catId: utilCat?.id, method: 'upi' },
    ];

    for (const exp of expenses) {
      await db.execute(`
        INSERT INTO expenses (business_id, store_id, category_id, title, amount, date, payment_method, payment_status, reference_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', 'direct')
      `, [businessId, storeId, exp.catId, exp.title, exp.amount, exp.date, exp.method]);
    }
  }

  // 10. Seed Payroll Run (if empty)
  const payrollCount = await db.queryOne('SELECT count(*) as cnt FROM payrolls WHERE business_id = ?', [businessId]);
  if (Number(payrollCount?.cnt || 0) === 0) {
    const empRows: any[] = await db.query('SELECT id, basic_salary, hra, allowances, deductions FROM employees WHERE business_id = ?', [businessId]);
    if (empRows.length > 0) {
      let totalAmount = 0;
      for (const e of empRows) {
        totalAmount += (Number(e.basic_salary) + Number(e.hra) + Number(e.allowances) - Number(e.deductions));
      }

      const pRes = await db.execute(`
        INSERT INTO payrolls (business_id, store_id, month, year, total_amount, total_employees, status, paid_at, payment_method, notes)
        VALUES (?, ?, 10, 2026, ?, ?, 'paid', '2026-10-31 17:30:00', 'bank_transfer', 'Disbursed via Corporate HDFC NetBanking')
      `, [businessId, storeId, totalAmount, empRows.length]);
      const payrollId = Number(pRes.lastInsertId);

      let idx = 1;
      for (const e of empRows) {
        const net = Number(e.basic_salary) + Number(e.hra) + Number(e.allowances) - Number(e.deductions);
        const slip = `SLIP-2026-10-${String(idx++).padStart(3, '0')}`;
        await db.execute(`
          INSERT INTO payroll_items (payroll_id, employee_id, basic_salary, hra, allowances, deductions, net_salary, working_days, present_days, status, payment_method, paid_at, slip_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, 30.0, 30.0, 'paid', 'bank_transfer', '2026-10-31 17:30:00', ?)
        `, [payrollId, e.id, e.basic_salary, e.hra, e.allowances, e.deductions, net, slip]);
      }
    }
  }

  // 11. Seed Notifications (if empty)
  const notifCount = await db.queryOne('SELECT count(*) as cnt FROM notifications WHERE business_id = ?', [businessId]);
  if (Number(notifCount?.cnt || 0) === 0) {
    const alerts = [
      { type: 'warning', title: 'Low Stock Alert', message: 'Keychron Q3 Pro Custom Mechanical Keyboard is at 4 units (Threshold: 10). Reorder recommended.', link: '/inventory' },
      { type: 'info', title: 'Pending Leave Application', message: 'Amit Deshmukh submitted a 2-day sick leave request awaiting manager approval.', link: '/leaves' },
      { type: 'success', title: 'Monthly Payroll Disbursed', message: 'October 2026 payroll successfully disbursed to 6 employees via corporate bank transfer.', link: '/payroll' },
      { type: 'info', title: 'Purchase Order In Transit', message: 'PO-2026-002 with ErgoComfort Manufacturing expected by Nov 08, 2026.', link: '/suppliers' },
    ];
    for (const a of alerts) {
      await db.execute(`
        INSERT INTO notifications (business_id, type, title, message, link, is_read)
        VALUES (?, ?, ?, ?, ?, 0)
      `, [businessId, a.type, a.title, a.message, a.link]);
    }
  }

  return { success: true, message: 'Sample business data populated successfully!' };
}
