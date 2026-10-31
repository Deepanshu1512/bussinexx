import { db } from './database.ts';

export function seedDatabase() {
  // Clear existing operational data safely within a transaction
  db.exec('BEGIN TRANSACTION;');
  try {
    db.exec(`
      DELETE FROM brain_messages;
      DELETE FROM brain_conversations;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM stock_logs;
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM customers;
    `);

    // Reset sequences
    db.exec(`
      DELETE FROM sqlite_sequence WHERE name IN ('categories', 'products', 'stock_logs', 'customers', 'orders', 'order_items', 'brain_messages');
    `);

    // 1. Insert Categories
    const categoriesData = [
      { name: 'Hardware & Devices', description: 'Enterprise-grade computing devices and peripherals' },
      { name: 'Ergonomic Furniture', description: 'Modern ergonomic office chairs, standing desks, and accessories' },
      { name: 'Audio & Visual', description: 'Studio microphones, 4K webcams, and conference gear' },
      { name: 'Power & Cables', description: 'USB-C docks, surge protectors, and GaN chargers' },
      { name: 'Office Supplies', description: 'Premium notebooks, desk mats, and organizers' },
    ];

    const insertCategory = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    for (const cat of categoriesData) {
      insertCategory.run(cat.name, cat.description);
    }

    // 2. Insert Products
    const productsData = [
      { sku: 'HW-MBP-16', name: 'MacBook Pro M3 Max 16"', categoryId: 1, cost: 2450.00, price: 3199.00, stock: 14, minStock: 5, status: 'active', desc: '16-inch Liquid Retina XDR, 36GB RAM, 1TB SSD' },
      { sku: 'HW-DELL-U27', name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor', categoryId: 1, cost: 380.00, price: 549.99, stock: 22, minStock: 8, status: 'active', desc: 'IPS Black technology, 98% DCI-P3 color coverage' },
      { sku: 'HW-LOGI-MXM', name: 'Logitech MX Master 3S Wireless Mouse', categoryId: 1, cost: 62.00, price: 99.99, stock: 45, minStock: 15, status: 'active', desc: 'Quiet clicks, 8K DPI any-surface tracking' },
      { sku: 'HW-KEY-Q3P', name: 'Keychron Q3 Pro Custom Mechanical Keyboard', categoryId: 1, cost: 130.00, price: 219.00, stock: 4, minStock: 10, status: 'active', desc: 'QMK/VIA wireless custom mechanical keyboard (Low Stock)' },
      
      { sku: 'FN-HM-AER', name: 'Herman Miller Aeron Ergonomic Chair (Size B)', categoryId: 2, cost: 920.00, price: 1495.00, stock: 8, minStock: 4, status: 'active', desc: 'Pellicle suspension, PostureFit SL adjustable support' },
      { sku: 'FN-UP-DSK', name: 'Uplift V2 Commercial Standing Desk (60x30")', categoryId: 2, cost: 480.00, price: 799.00, stock: 11, minStock: 5, status: 'active', desc: 'Dual motor, solid bamboo desktop with cable management' },
      { sku: 'FN-MNT-DUO', name: 'Ergotron LX Dual Stacking Arm Mount', categoryId: 2, cost: 185.00, price: 299.99, stock: 3, minStock: 6, status: 'active', desc: 'Heavy-duty polished aluminum dual monitor arm (Low Stock)' },
      { sku: 'FN-FT-RST', name: 'Contour Ergonomic Active Footrest', categoryId: 2, cost: 35.00, price: 69.95, stock: 28, minStock: 10, status: 'active', desc: 'Rocking motion foot platform for improved posture' },

      { sku: 'AV-SHR-SM7', name: 'Shure SM7B Vocal Studio Dynamic Microphone', categoryId: 3, cost: 260.00, price: 399.00, stock: 16, minStock: 5, status: 'active', desc: 'Smooth, flat, wide-range frequency response' },
      { sku: 'AV-OBS-BOT', name: 'OBSBOT Tiny 2 4K PTZ AI Auto-Tracking Webcam', categoryId: 3, cost: 195.00, price: 329.00, stock: 2, minStock: 5, status: 'active', desc: '1/1.5" sensor, voice control, AI tracking (Critically Low)' },
      { sku: 'AV-RODE-CA', name: 'Rode Caster Pro II Integrated Audio Production Studio', categoryId: 3, cost: 450.00, price: 699.00, stock: 7, minStock: 3, status: 'active', desc: 'Revolution Preamps, SMART pads, dual USB-C' },
      { sku: 'AV-ELG-LP', name: 'Elgato Wave Mic Arm LP Low Profile', categoryId: 3, cost: 58.00, price: 99.99, stock: 31, minStock: 10, status: 'active', desc: 'All-metal, anti-torsion construction, cable channels' },

      { sku: 'PW-CAL-TS4', name: 'CalDigit TS4 Thunderbolt 4 18-Port Dock', categoryId: 4, cost: 260.00, price: 399.95, stock: 19, minStock: 8, status: 'active', desc: '98W charging, 2.5GbE, 8K display support' },
      { sku: 'PW-ANK-GAN', name: 'Anker Prime 240W 4-Port GaN Desktop Charger', categoryId: 4, cost: 110.00, price: 199.99, stock: 36, minStock: 12, status: 'active', desc: 'Ultra-fast charging for laptops and multi-devices' },
      { sku: 'PW-APC-150', name: 'APC Back-UPS Pro 1500VA SineWave UPS', categoryId: 4, cost: 175.00, price: 279.99, stock: 9, minStock: 4, status: 'active', desc: 'Battery backup & surge protector with LCD interface' },

      { sku: 'OS-DESK-PAD', name: 'Orbitkey Top-Grain Leather Desk Mat (Large)', categoryId: 5, cost: 42.00, price: 89.00, stock: 40, minStock: 15, status: 'active', desc: 'Water-repellent vegan leather with magnetic toolbar' },
      { sku: 'OS-NOT-PREM', name: 'Baron Fig Master Bullet Journal Hardcover', categoryId: 5, cost: 12.00, price: 28.00, stock: 65, minStock: 20, status: 'active', desc: 'Acid-free 100gsm paper, dot grid layout' },
      { sku: 'OS-PEN-ROTR', name: 'Rotring 800 Retractable Mechanical Pencil 0.5mm', categoryId: 5, cost: 28.00, price: 54.00, stock: 1, minStock: 10, status: 'active', desc: 'Full metal body with twist and click mechanism (Almost Out)' },
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (sku, name, category_id, cost_price, selling_price, current_stock, min_stock_threshold, status, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of productsData) {
      insertProduct.run(p.sku, p.name, p.categoryId, p.cost, p.price, p.stock, p.minStock, p.status, p.desc);
    }

    // 3. Insert Customers
    const customersData = [
      { name: 'Sarah Jenkins', email: 's.jenkins@acmecorp.io', phone: '+1 (555) 234-8901', company: 'Acme Technologies', tier: 'vip', address: '100 Innovation Way, Suite 400, San Francisco, CA', notes: 'Key enterprise account. Orders quarterly hardware batches.' },
      { name: 'Marcus Vance', email: 'mvance@nexusdesign.co', phone: '+1 (555) 345-6712', company: 'Nexus Creative Studio', tier: 'vip', address: '450 Bauhaus Boulevard, Austin, TX', notes: 'Design firm. Buys top-tier color-accurate monitors and audio rigs.' },
      { name: 'Elena Rostova', email: 'elena@hyperionlabs.tech', phone: '+1 (555) 789-0123', company: 'Hyperion AI Labs', tier: 'wholesale', address: '88 Quantum Drive, Cambridge, MA', notes: 'Bulk buyer for engineer workstations.' },
      { name: 'Devon Wright', email: 'devon@wrightpartners.law', phone: '+1 (555) 890-1234', company: 'Wright & Partners LLP', tier: 'regular', address: '1200 Wall Street, New York, NY', notes: 'Law practice, orders ergonomic furniture and executive docks.' },
      { name: 'Liam O\'Connor', email: 'liam@vertexmedia.org', phone: '+1 (555) 432-5678', company: 'Vertex Media Group', tier: 'regular', address: '350 Sunset Blvd, Los Angeles, CA', notes: 'Podcast and broadcast production.' },
      { name: 'Amina Patel', email: 'amina@catalysthealth.care', phone: '+1 (555) 678-9012', company: 'Catalyst Health Systems', tier: 'wholesale', address: '710 Medical Center Way, Chicago, IL', notes: 'Equipping administrative regional offices.' },
      { name: 'Jordan Rivera', email: 'jrivera@cloudscale.net', phone: '+1 (555) 123-4567', company: 'CloudScale Infrastructure', tier: 'regular', address: '202 Data Park Dr, Seattle, WA', notes: 'Frequent buyer of high-speed chargers and cables.' },
      { name: 'Chloe Dubois', email: 'chloe@atelierdubois.design', phone: '+1 (555) 987-6543', company: 'Atelier Dubois Arch', tier: 'vip', address: '640 Broadway, Soho, New York, NY', notes: 'Architectural studio with recurring furniture procurement.' },
      { name: 'Kenji Takahashi', email: 'kenji@zenithfintech.jp', phone: '+1 (555) 876-5432', company: 'Zenith FinTech Corp', tier: 'wholesale', address: '50 California Street, San Francisco, CA', notes: 'Trading floor equipment setups.' },
      { name: 'Rachel Green', email: 'rachel@coastalventures.vc', phone: '+1 (555) 210-9876', company: 'Coastal Ventures', tier: 'new', address: '180 Sand Hill Road, Menlo Park, CA', notes: 'New partner onboarding kits.' },
      { name: 'Samuel Miller', email: 'smiller@frontierbuild.com', phone: '+1 (555) 321-7654', company: 'Frontier Buildworks', tier: 'regular', address: '900 Industrial Parkway, Denver, CO', notes: 'Engineering team equipment.' },
      { name: 'Zoe Chen', email: 'zoe@syntheticaudio.fm', phone: '+1 (555) 654-3210', company: 'Synthetic Audio Labs', tier: 'regular', address: '44 Music Row, Nashville, TN', notes: 'High-end audio creator.' },
    ];

    const insertCustomer = db.prepare(`
      INSERT INTO customers (name, email, phone, company, tier, address, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of customersData) {
      insertCustomer.run(c.name, c.email, c.phone, c.company, c.tier, c.address, c.notes);
    }

    // 4. Generate Realistic Historical Orders spanning the last 90 days
    const insertOrder = db.prepare(`
      INSERT INTO orders (order_number, customer_id, status, payment_method, payment_status, subtotal, discount_amount, tax_amount, total_amount, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, product_sku, unit_cost, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    let orderSeq = 1001;

    // Helper to generate past dates
    const getPastDateISO = (daysAgo: number, hoursOffset: number = 0) => {
      const d = new Date(now.getTime() - (daysAgo * 86400000) + (hoursOffset * 3600000));
      return d.toISOString().replace('T', ' ').substring(0, 19);
    };

    // Pre-scripted high fidelity order batches for rich, realistic analytics
    const orderPlans = [
      { daysAgo: 85, customerId: 1, items: [{ pId: 1, qty: 2 }, { pId: 2, qty: 2 }, { pId: 13, qty: 2 }], discount: 150, payMethod: 'invoice', status: 'completed' },
      { daysAgo: 82, customerId: 3, items: [{ pId: 3, qty: 5 }, { pId: 14, qty: 5 }, { pId: 16, qty: 5 }], discount: 50, payMethod: 'bank_transfer', status: 'completed' },
      { daysAgo: 79, customerId: 2, items: [{ pId: 9, qty: 2 }, { pId: 11, qty: 1 }, { pId: 12, qty: 2 }], discount: 0, payMethod: 'card', status: 'completed' },
      { daysAgo: 75, customerId: 4, items: [{ pId: 5, qty: 1 }, { pId: 6, qty: 1 }, { pId: 13, qty: 1 }], discount: 100, payMethod: 'card', status: 'completed' },
      { daysAgo: 71, customerId: 5, items: [{ pId: 9, qty: 1 }, { pId: 10, qty: 1 }, { pId: 12, qty: 1 }], discount: 20, payMethod: 'card', status: 'completed' },
      { daysAgo: 68, customerId: 6, items: [{ pId: 2, qty: 4 }, { pId: 3, qty: 4 }, { pId: 14, qty: 4 }], discount: 80, payMethod: 'invoice', status: 'completed' },
      { daysAgo: 64, customerId: 8, items: [{ pId: 5, qty: 3 }, { pId: 7, qty: 2 }], discount: 200, payMethod: 'bank_transfer', status: 'completed' },
      { daysAgo: 60, customerId: 9, items: [{ pId: 1, qty: 3 }, { pId: 2, qty: 3 }, { pId: 13, qty: 3 }], discount: 300, payMethod: 'invoice', status: 'completed' },
      { daysAgo: 57, customerId: 7, items: [{ pId: 14, qty: 2 }, { pId: 15, qty: 1 }], discount: 0, payMethod: 'card', status: 'completed' },
      { daysAgo: 54, customerId: 11, items: [{ pId: 4, qty: 2 }, { pId: 3, qty: 2 }, { pId: 16, qty: 2 }], discount: 0, payMethod: 'card', status: 'completed' },
      { daysAgo: 50, customerId: 12, items: [{ pId: 9, qty: 2 }, { pId: 11, qty: 1 }], discount: 50, payMethod: 'card', status: 'completed' },
      { daysAgo: 47, customerId: 1, items: [{ pId: 5, qty: 2 }, { pId: 6, qty: 2 }, { pId: 13, qty: 2 }], discount: 250, payMethod: 'invoice', status: 'completed' },
      { daysAgo: 43, customerId: 2, items: [{ pId: 1, qty: 1 }, { pId: 2, qty: 2 }, { pId: 3, qty: 2 }], discount: 100, payMethod: 'card', status: 'completed' },
      { daysAgo: 40, customerId: 3, items: [{ pId: 1, qty: 4 }, { pId: 13, qty: 4 }], discount: 400, payMethod: 'invoice', status: 'completed' },
      { daysAgo: 36, customerId: 4, items: [{ pId: 7, qty: 1 }, { pId: 8, qty: 2 }, { pId: 16, qty: 3 }], discount: 0, payMethod: 'card', status: 'completed' },
      { daysAgo: 32, customerId: 6, items: [{ pId: 2, qty: 3 }, { pId: 14, qty: 3 }], discount: 50, payMethod: 'bank_transfer', status: 'completed' },
      { daysAgo: 29, customerId: 10, items: [{ pId: 1, qty: 1 }, { pId: 3, qty: 1 }, { pId: 16, qty: 1 }], discount: 0, payMethod: 'card', status: 'completed' },
      { daysAgo: 26, customerId: 8, items: [{ pId: 5, qty: 2 }, { pId: 6, qty: 2 }], discount: 150, payMethod: 'invoice', status: 'completed' },
      { daysAgo: 23, customerId: 9, items: [{ pId: 2, qty: 6 }, { pId: 13, qty: 6 }], discount: 350, payMethod: 'bank_transfer', status: 'completed' },
      { daysAgo: 20, customerId: 5, items: [{ pId: 10, qty: 2 }, { pId: 12, qty: 2 }], discount: 30, payMethod: 'card', status: 'completed' },
      { daysAgo: 17, customerId: 11, items: [{ pId: 3, qty: 3 }, { pId: 14, qty: 2 }, { pId: 17, qty: 5 }], discount: 0, payMethod: 'card', status: 'completed' },
      { daysAgo: 14, customerId: 1, items: [{ pId: 1, qty: 2 }, { pId: 5, qty: 1 }], discount: 200, payMethod: 'invoice', status: 'completed' },
      { daysAgo: 12, customerId: 2, items: [{ pId: 2, qty: 1 }, { pId: 9, qty: 1 }, { pId: 11, qty: 1 }], discount: 60, payMethod: 'card', status: 'completed' },
      { daysAgo: 10, customerId: 7, items: [{ pId: 13, qty: 2 }, { pId: 14, qty: 2 }, { pId: 15, qty: 1 }], discount: 40, payMethod: 'card', status: 'completed' },
      { daysAgo: 8, customerId: 3, items: [{ pId: 1, qty: 2 }, { pId: 4, qty: 4 }], discount: 180, payMethod: 'bank_transfer', status: 'completed' },
      { daysAgo: 6, customerId: 4, items: [{ pId: 5, qty: 1 }, { pId: 8, qty: 1 }], discount: 0, payMethod: 'card', status: 'completed' },
      { daysAgo: 5, customerId: 10, items: [{ pId: 2, qty: 2 }, { pId: 13, qty: 2 }, { pId: 16, qty: 2 }], discount: 50, payMethod: 'card', status: 'completed' },
      { daysAgo: 4, customerId: 6, items: [{ pId: 6, qty: 2 }, { pId: 7, qty: 1 }], discount: 80, payMethod: 'bank_transfer', status: 'processing' },
      { daysAgo: 3, customerId: 8, items: [{ pId: 5, qty: 2 }, { pId: 2, qty: 2 }], discount: 120, payMethod: 'invoice', status: 'processing' },
      { daysAgo: 2, customerId: 9, items: [{ pId: 1, qty: 2 }, { pId: 13, qty: 2 }], discount: 150, payMethod: 'bank_transfer', status: 'pending' },
      { daysAgo: 1, customerId: 12, items: [{ pId: 10, qty: 1 }, { pId: 12, qty: 1 }], discount: 0, payMethod: 'card', status: 'completed' },
      { daysAgo: 0, customerId: 1, items: [{ pId: 2, qty: 2 }, { pId: 3, qty: 2 }], discount: 40, payMethod: 'invoice', status: 'processing' },
    ];

    // Fetch all products for lookups
    const allProds = db.prepare('SELECT id, name, sku, cost_price, selling_price FROM products').all() as any[];
    const prodMap = new Map(allProds.map(p => [p.id, p]));

    for (const plan of orderPlans) {
      let subtotal = 0;
      const orderItemsToInsert: any[] = [];

      for (const item of plan.items) {
        const prod = prodMap.get(item.pId);
        if (!prod) continue;
        const lineTotal = prod.selling_price * item.qty;
        subtotal += lineTotal;
        orderItemsToInsert.push({
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          cost: prod.cost_price,
          price: prod.selling_price,
          qty: item.qty,
          lineTotal: lineTotal
        });
      }

      const discount = Math.min(plan.discount, subtotal * 0.2); // max 20% discount
      const taxableAmount = Math.max(0, subtotal - discount);
      const taxRate = 0.085; // 8.5%
      const taxAmount = Number((taxableAmount * taxRate).toFixed(2));
      const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));
      const orderNum = `ORD-2026-${orderSeq++}`;
      const createdAt = getPastDateISO(plan.daysAgo, Math.floor(Math.random() * 10));

      const orderResult = insertOrder.run(
        orderNum,
        plan.customerId,
        plan.status,
        plan.payMethod,
        plan.status === 'completed' ? 'paid' : (plan.status === 'processing' ? 'paid' : 'pending'),
        subtotal,
        discount,
        taxAmount,
        totalAmount,
        `Standard business order ${orderNum}`,
        createdAt
      );

      const orderId = Number(orderResult.lastInsertRowid);

      for (const item of orderItemsToInsert) {
        insertOrderItem.run(
          orderId,
          item.productId,
          item.name,
          item.sku,
          item.cost,
          item.price,
          item.qty,
          item.lineTotal
        );
      }
    }

    db.exec('COMMIT;');
    return { success: true, message: 'Sample business data populated successfully with 18 products, 12 customers, and 32 historical orders.' };
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}
