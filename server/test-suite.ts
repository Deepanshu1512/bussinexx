import http from 'node:http';

async function fetchJSON(path: string, options: any = {}) {
  const res = await fetch(`http://localhost:5001${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} on ${path}: ${txt}`);
  }
  return res.json();
}

async function runTestSuite() {
  console.log('🧪 Starting Bussinex Comprehensive Verification Suite...\n');

  try {
    // 1. Health check
    console.log('1️⃣ Testing Server Health & Connectivity...');
    const health = await fetchJSON('/api/health');
    console.log('   ✅ Health OK:', health.system, '| Status:', health.status);

    // 2. Dashboard KPIs
    console.log('\n2️⃣ Testing Executive Dashboard Telemetry...');
    const dashboard = await fetchJSON('/api/dashboard');
    console.log(`   ✅ Gross Revenue: $${dashboard.summary.grossRevenue.toLocaleString()}`);
    console.log(`   ✅ Net Profit: $${dashboard.summary.netProfit.toLocaleString()} (${dashboard.summary.profitMargin}% margin)`);
    console.log(`   ✅ Total Orders: ${dashboard.summary.totalOrders}`);
    console.log(`   ✅ Inventory Health: ${dashboard.inventoryHealth.totalProducts} active products, ${dashboard.inventoryHealth.lowStockCount} low stock alerts`);

    // 3. Inventory CRUD & Adjustments
    console.log('\n3️⃣ Testing Inventory CRUD & Stock Thresholds...');
    const products = await fetchJSON('/api/inventory');
    console.log(`   ✅ Catalog contains ${products.length} products`);

    // Create a new product
    const testSku = `TEST-DEV-${Date.now().toString().slice(-4)}`;
    console.log(`   ➕ Creating new product ${testSku}...`);
    const newProd = await fetchJSON('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({
        sku: testSku,
        name: 'Enterprise Precision Stylus',
        category_id: 1,
        cost_price: 35.00,
        selling_price: 79.99,
        current_stock: 25,
        min_stock_threshold: 5,
        status: 'active',
        description: 'Automated test suite item'
      })
    });
    console.log(`   ✅ Product created with ID: ${newProd.id}, Stock: ${newProd.current_stock}`);

    // Adjust Stock
    console.log(`   📦 Adjusting stock for product ID: ${newProd.id}...`);
    const adjusted = await fetchJSON(`/api/inventory/${newProd.id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({
        change_qty: 5,
        reason: 'Verification Suite Test Delivery'
      })
    });
    console.log(`   ✅ Stock adjusted: ${adjusted.previousStock} -> ${adjusted.newStock}`);

    // 4. Sales & Order Creation with Stock Deduction
    console.log('\n4️⃣ Testing Order Creation & Automatic Inventory Deduction...');
    const customers = await fetchJSON('/api/customers');
    const targetCustomer = customers[0];

    const initialStock = adjusted.newStock;
    const orderQty = 4;
    console.log(`   🛒 Placing order for ${orderQty} units of ${newProd.name} (Initial stock: ${initialStock})...`);

    const orderRes = await fetchJSON('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: targetCustomer.id,
        items: [{ product_id: newProd.id, quantity: orderQty }],
        payment_method: 'card',
        status: 'completed',
        discount_amount: 10,
        notes: 'Automated test order'
      })
    });

    console.log(`   ✅ Order placed successfully: ${orderRes.order_number}`);
    console.log(`   ✅ Total Amount: $${orderRes.total_amount.toFixed(2)} (Subtotal: $${orderRes.subtotal}, Tax: $${orderRes.tax_amount})`);

    // Verify stock deduction
    const verifiedProd = await fetchJSON(`/api/inventory/${newProd.id}`);
    console.log(`   ✅ Verified stock after order: ${verifiedProd.current_stock} (Expected: ${initialStock - orderQty})`);
    if (verifiedProd.current_stock !== initialStock - orderQty) {
      throw new Error(`Inventory deduction mismatch! Expected ${initialStock - orderQty}, got ${verifiedProd.current_stock}`);
    }

    // 5. Analytics & Executive Report Generation
    console.log('\n5️⃣ Testing Analytics & Executive Report Generator...');
    const report = await fetchJSON('/api/analytics/report');
    console.log(`   ✅ Executive Report generated at: ${report.generatedAt}`);
    console.log(`   ✅ Strategic Observations count: ${report.observations.length}`);
    for (const obs of report.observations) {
      console.log(`      * [${obs.type.toUpperCase()}] ${obs.text}`);
    }

    // 6. Business Brain AI Intelligence Console
    console.log('\n6️⃣ Testing Business Brain AI Queries & Context Grounding...');

    const q1 = await fetchJSON('/api/brain/query', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'How is my business performing?' })
    });
    console.log(`   🤖 [Query: Performance] Engine: ${q1.providerUsed}`);
    console.log(`   📝 Response excerpt: ${q1.response.substring(0, 160).replace(/\n/g, ' ')}...`);

    const q2 = await fetchJSON('/api/brain/query', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: q1.conversationId,
        prompt: 'Which products should I restock right now?'
      })
    });
    console.log(`   🤖 [Query: Restock] Conversation: ${q2.conversationId}`);
    console.log(`   📝 Response excerpt: ${q2.response.substring(0, 160).replace(/\n/g, ' ')}...`);

    const q3 = await fetchJSON('/api/brain/query', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: q1.conversationId,
        prompt: 'What are my best-selling products?'
      })
    });
    console.log(`   🤖 [Query: Best Sellers] Excerpt: ${q3.response.substring(0, 160).replace(/\n/g, ' ')}...`);

    // 7. Clean up test product
    console.log('\n7️⃣ Cleaning up test records...');
    await fetchJSON(`/api/inventory/${newProd.id}`, { method: 'DELETE' });
    console.log('   ✅ Test cleanup complete.');

    console.log('\n🎉 ALL VERIFICATION SUITE TESTS PASSED 100% SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exit(1);
  }
}

// Check if server is running, if not start it inside this process
import('../server/index.ts').then(() => {
  setTimeout(runTestSuite, 1000);
});
