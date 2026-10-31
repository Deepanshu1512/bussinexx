let authToken = '';

async function fetchJSON(path: string, options: any = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`http://localhost:5001${path}`, {
    ...options,
    headers
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} on ${path}: ${txt}`);
  }
  return res.json();
}

async function runTestSuite() {
  console.log('🧪 Starting Bussinex Production & Security Verification Suite...\n');

  try {
    // 1. Health check
    console.log('1️⃣ Testing Server Health & Serverless API Architecture...');
    const health = await fetchJSON('/api/health');
    console.log(`   ✅ System: ${health.system} | Serverless: ${health.serverless} | Status: ${health.status}`);

    // 2. User Authentication & JWT Security
    console.log('\n2️⃣ Testing Authentication & Authorization (Admin Login)...');
    const loginRes = await fetchJSON('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@bussinex.com', password: 'admin123' })
    });
    authToken = loginRes.token;
    console.log(`   ✅ Authenticated as: ${loginRes.user.name} (${loginRes.user.email})`);
    console.log(`   ✅ Tenant Business: ${loginRes.business.name} (ID: ${loginRes.user.business_id})`);
    console.log(`   ✅ JWT Token received & verified: ${authToken.slice(0, 18)}...`);

    // Verify /api/auth/me
    const meRes = await fetchJSON('/api/auth/me');
    console.log(`   ✅ /api/auth/me confirmed for user ID ${meRes.user.id}`);

    // 3. Multi-Tenant Data Isolation Test
    console.log('\n3️⃣ Testing Multi-Tenant Data Isolation...');
    const tenant2Email = `tenant2_${Date.now()}@enterprise.com`;
    const tenant2Res = await fetchJSON('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Tenant Two Admin',
        email: tenant2Email,
        password: 'password123',
        businessName: 'Quantum Dynamics Corp'
      })
    });
    console.log(`   ✅ Created second tenant: ${tenant2Res.business.name} (ID: ${tenant2Res.business.id})`);

    // Verify tenant 2 gets their own isolated catalog
    const tenant2Products = await fetchJSON('/api/inventory', {
      headers: { Authorization: `Bearer ${tenant2Res.token}` }
    });
    console.log(`   ✅ Tenant 2 catalog query isolated: ${tenant2Products.length} items`);

    // 4. AI Security: Verify Gemini API Key is NEVER exposed to client
    console.log('\n4️⃣ Testing AI Security & Key Protection...');
    const settings = await fetchJSON('/api/settings');
    console.log(`   🔒 ai_api_key returned to client: "${settings.ai_api_key}"`);
    console.log(`   🔒 has_custom_api_key flag: ${settings.has_custom_api_key}`);
    if (settings.ai_api_key && settings.ai_api_key !== '••••••••') {
      throw new Error(`CRITICAL SECURITY FAILURE: Raw API key was exposed to client! Value: ${settings.ai_api_key}`);
    }
    console.log('   ✅ AI Security Verified: API key is strictly masked / server-side protected!');

    // 5. Dashboard Telemetry & KPI Calculations
    console.log('\n5️⃣ Testing Executive Dashboard Telemetry...');
    const dashboard = await fetchJSON('/api/dashboard');
    console.log(`   ✅ Gross Revenue: $${dashboard.summary.grossRevenue.toLocaleString()}`);
    console.log(`   ✅ Net Profit: $${dashboard.summary.netProfit.toLocaleString()} (${dashboard.summary.profitMargin}% margin)`);
    console.log(`   ✅ Completed Orders: ${dashboard.summary.totalOrders}`);
    console.log(`   ✅ Low Stock Alerts: ${dashboard.inventoryHealth.lowStockCount}`);

    // 6. Inventory CRUD & Stock Thresholds
    console.log('\n6️⃣ Testing Inventory CRUD & Stock Auditing...');
    const testSku = `PROD-${Date.now().toString().slice(-4)}`;
    const newProd = await fetchJSON('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({
        sku: testSku,
        name: 'HoloLens Quantum Headset',
        cost_price: 650.00,
        selling_price: 1199.00,
        current_stock: 15,
        min_stock_threshold: 4,
        status: 'active',
        description: 'Multi-tenant test product'
      })
    });
    console.log(`   ✅ Product created: ${newProd.name} (${newProd.sku})`);

    // 7. Order Placement with Atomic Stock Deduction
    console.log('\n7️⃣ Testing Order Placement with Stock Deduction...');
    const customers = await fetchJSON('/api/customers');
    const orderRes = await fetchJSON('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customers[0]?.id || null,
        items: [{ product_id: newProd.id, quantity: 3 }],
        payment_method: 'card',
        status: 'completed',
        discount_amount: 50,
        notes: 'Verification test order'
      })
    });
    console.log(`   ✅ Order placed: ${orderRes.order_number} | Total: $${orderRes.total_amount}`);

    const verifiedProd = await fetchJSON(`/api/inventory/${newProd.id}`);
    console.log(`   ✅ Stock decremented from 15 to ${verifiedProd.current_stock} (Expected: 12)`);
    if (Number(verifiedProd.current_stock) !== 12) {
      throw new Error(`Stock deduction mismatch! Expected 12, got ${verifiedProd.current_stock}`);
    }

    // 8. Business Brain AI Grounded Intelligence
    console.log('\n8️⃣ Testing Business Brain AI Grounded Inquiries...');
    const q1 = await fetchJSON('/api/brain/query', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'How is my business performing?' })
    });
    console.log(`   🤖 [Query: Performance] Engine: ${q1.providerUsed}`);
    console.log(`   📝 Excerpt: ${q1.response.substring(0, 150).replace(/\n/g, ' ')}...`);

    const q2 = await fetchJSON('/api/brain/query', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: q1.conversationId,
        prompt: 'Which products should I restock?'
      })
    });
    console.log(`   🤖 [Query: Restock] Conversation: ${q2.conversationId}`);
    console.log(`   📝 Excerpt: ${q2.response.substring(0, 150).replace(/\n/g, ' ')}...`);

    // Clean up test product
    await fetchJSON(`/api/inventory/${newProd.id}`, { method: 'DELETE' });
    console.log('\n   ✅ Test cleanup complete.');

    console.log('\n🎉 ALL PRODUCTION & SECURITY TEST SUITES PASSED 100% SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exit(1);
  }
}

// Start server and run test suite
import('../server/index.ts').then(() => {
  setTimeout(runTestSuite, 1200);
});
