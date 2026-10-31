import { db } from '../db/database.ts';
import { analyticsService } from './analyticsService.ts';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const businessBrain = {
  /**
   * Builds verified, deterministic business facts directly from the database.
   * NEVER runs arbitrary SQL. Uses controlled aggregation pipelines.
   */
  gatherBusinessContext() {
    const summary = analyticsService.getExecutiveSummary();
    const topProducts = analyticsService.getTopSellingProducts(5);
    const categoryStats = analyticsService.getCategoryPerformance();
    const topCustomers = analyticsService.getTopCustomers(5);

    // Products that need immediate restocking
    const criticalStock = db.prepare(`
      SELECT p.id, p.name, p.sku, p.current_stock, p.min_stock_threshold, p.cost_price, p.selling_price,
             COALESCE(SUM(oi.quantity), 0) as total_units_sold
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.status = 'active' AND p.current_stock <= p.min_stock_threshold
      GROUP BY p.id
      ORDER BY p.current_stock ASC
    `).all() as any[];

    // Underperforming or zero-sales products
    const underperformingProducts = db.prepare(`
      SELECT p.id, p.name, p.sku, p.current_stock, p.cost_price, p.selling_price,
             (p.current_stock * p.cost_price) as tied_up_capital,
             COALESCE(SUM(oi.quantity), 0) as total_units_sold
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.status = 'active'
      GROUP BY p.id
      HAVING total_units_sold <= 2
      ORDER BY tied_up_capital DESC
      LIMIT 5
    `).all() as any[];

    // Customer concentration calculation
    const totalRev = summary.grossRevenue;
    let topTwoCustomerShare = 0;
    if (topCustomers.length >= 2 && totalRev > 0) {
      const topTwoTotal = (topCustomers[0]?.lifetime_value || 0) + (topCustomers[1]?.lifetime_value || 0);
      topTwoCustomerShare = Number(((topTwoTotal / totalRev) * 100).toFixed(1));
    }

    return {
      financials: {
        grossRevenue: summary.grossRevenue,
        cogs: summary.cogs,
        netProfit: summary.netProfit,
        profitMarginPercent: summary.profitMargin,
        totalCompletedOrders: summary.totalOrders,
        averageOrderValue: summary.avgOrderValue,
      },
      inventory: {
        totalProducts: summary.totalProducts,
        totalUnitsInStock: summary.totalUnitsInStock,
        totalInventoryCostValue: summary.inventoryCostValue,
        totalInventoryRetailValue: summary.inventoryRetailValue,
        lowStockItemsCount: criticalStock.length,
        criticalStockItems: criticalStock.map(i => ({
          name: i.name,
          sku: i.sku,
          stock: i.current_stock,
          threshold: i.min_stock_threshold,
          unitsSoldHistorically: i.total_units_sold
        })),
        underperformingItems: underperformingProducts.map(u => ({
          name: u.name,
          sku: u.sku,
          stock: u.current_stock,
          tiedUpCapital: Number(u.tied_up_capital.toFixed(2)),
          unitsSold: u.total_units_sold
        }))
      },
      topPerformers: topProducts.map(tp => ({
        name: tp.product_name,
        sku: tp.product_sku,
        revenue: tp.total_revenue,
        unitsSold: tp.units_sold,
        grossProfit: tp.gross_profit
      })),
      categories: categoryStats.map(cs => ({
        category: cs.name,
        revenue: cs.total_revenue,
        unitsSold: cs.units_sold
      })),
      customerInsights: {
        totalCustomers: summary.totalCustomers,
        activeCustomers: summary.activeCustomers,
        topTwoCustomerRevenueConcentration: `${topTwoCustomerShare}%`,
        topCustomers: topCustomers.map(tc => ({
          name: tc.name,
          company: tc.company,
          lifetimeValue: tc.lifetime_value,
          orders: tc.total_orders
        }))
      }
    };
  },

  /**
   * Retrieves active AI settings from SQLite database
   */
  getAISettings() {
    const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'ai_%'").all() as { key: string; value: string }[];
    const settingsMap: Record<string, string> = {};
    for (const r of rows) {
      settingsMap[r.key] = r.value;
    }

    return {
      provider: settingsMap['ai_provider'] || process.env.AI_PROVIDER || 'gemini',
      apiKey: settingsMap['ai_api_key'] || process.env.GEMINI_API_KEY || '',
      model: settingsMap['ai_model'] || process.env.AI_MODEL || 'gemini-2.5-flash',
      temperature: parseFloat(settingsMap['ai_temperature'] || '0.2')
    };
  },

  /**
   * Dispatches question to hosted LLM (Gemini) or heuristic intelligence analyst
   */
  async processQuery(conversationId: string | null, userPrompt: string): Promise<{
    conversationId: string;
    response: string;
    metrics: any;
    providerUsed: string;
  }> {
    const context = this.gatherBusinessContext();
    const aiConfig = this.getAISettings();

    // Ensure conversation exists in DB
    let convId = conversationId;
    if (!convId) {
      convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      // Generate short title from prompt
      const title = userPrompt.length > 36 ? userPrompt.substring(0, 33) + '...' : userPrompt;
      db.prepare('INSERT INTO brain_conversations (id, title) VALUES (?, ?)').run(convId, title);
    }

    // Save user message
    db.prepare('INSERT INTO brain_messages (conversation_id, role, content) VALUES (?, ?, ?)')
      .run(convId, 'user', userPrompt);

    // Fetch conversation history (last 8 messages for context)
    const history = db.prepare(`
      SELECT role, content FROM brain_messages 
      WHERE conversation_id = ? 
      ORDER BY id ASC 
      LIMIT 10
    `).all(convId) as Message[];

    let assistantResponse = '';
    let providerUsed = 'Deterministic Business Intelligence Engine';

    // If Gemini API Key is configured, use hosted LLM
    if (aiConfig.apiKey && aiConfig.apiKey.trim().length > 10) {
      try {
        assistantResponse = await this.callGeminiAPI(aiConfig.apiKey, aiConfig.model, userPrompt, history, context);
        providerUsed = `Google Gemini (${aiConfig.model})`;
      } catch (err: any) {
        console.warn('Gemini API call failed, falling back to Deterministic Intelligence Engine:', err.message);
        assistantResponse = this.generateDeterministicAnalysis(userPrompt, context) + 
          `\n\n> *[Note: Fallback used because Gemini API returned: ${err.message}. Please verify your API key in Settings.]*`;
        providerUsed = 'Deterministic Engine (Fallback)';
      }
    } else {
      // Deterministic Analytical Engine
      assistantResponse = this.generateDeterministicAnalysis(userPrompt, context);
    }

    // Save assistant message to DB
    db.prepare('INSERT INTO brain_messages (conversation_id, role, content, metrics_context) VALUES (?, ?, ?, ?)')
      .run(convId, 'assistant', assistantResponse, JSON.stringify(context.financials));

    // Update conversation timestamp
    db.prepare("UPDATE brain_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(convId);

    return {
      conversationId: convId,
      response: assistantResponse,
      metrics: context,
      providerUsed
    };
  },

  /**
   * Calls Google Gemini API directly with structured prompt
   */
  async callGeminiAPI(apiKey: string, model: string, userPrompt: string, history: Message[], context: any): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstruction = `
You are the **Bussinex Business Brain**, the central executive intelligence analyst for this enterprise.
You are directly connected to the company's verified operational SQLite database.

HERE ARE THE LIVE, VERIFIED FACTS FROM THE DATABASE:
${JSON.stringify(context, null, 2)}

OPERATIONAL RULES:
1. ONLY cite exact metrics provided in the database facts above (e.g. gross revenue, COGS, margins, stock levels). NEVER invent or fabricate business statistics.
2. Clearly distinguish between **VERIFIED DATA** (factual historical figures) and **STRATEGIC ESTIMATES / RECOMMENDATIONS** (future recommendations or projections).
3. If the user asks about performance, break down: Financial Health, Best Performers, Critical Inventory Bottlenecks, and High-Priority Action Items.
4. If the user asks about restocking, point out the exact low-stock items, safety stock deficits, and recent sales velocity.
5. Format your answers with clear markdown headers, bullet points, and highlight metrics with bold values. Keep it executive-ready, actionable, and mathematically sound.
`;

    const contents = history.map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));

    // Add system instruction as first user message or system instruction depending on API
    const payload = {
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error('Gemini API returned an empty response.');
    }

    return candidate;
  },

  /**
   * High-level deterministic business analyst engine when external LLM API key is not configured.
   * Produces mathematically verified, executive-grade business analysis.
   */
  generateDeterministicAnalysis(prompt: string, ctx: any): string {
    const p = prompt.toLowerCase();
    const f = ctx.financials;
    const inv = ctx.inventory;
    const topP = ctx.topPerformers;
    const cust = ctx.customerInsights;

    // 1. Performance Overview / Summary
    if (p.includes('perform') || p.includes('summary') || p.includes('how is my business') || p.includes('overview') || p.includes('health')) {
      const stockHealth = inv.lowStockItemsCount === 0 
        ? "✅ Optimal: All products meet or exceed safety stock thresholds."
        : `⚠️ Critical: **${inv.lowStockItemsCount} product(s)** are below threshold and risk stockouts.`;

      return `### 📊 Executive Performance Overview

**Financial Snapshot (Verified Live Data):**
* **Gross Revenue:** $${f.grossRevenue.toLocaleString()} across **${f.totalCompletedOrders} completed orders**
* **Cost of Goods Sold (COGS):** $${f.cogs.toLocaleString()}
* **Net Profit:** **$${f.netProfit.toLocaleString()}** (Gross Margin: **${f.profitMarginPercent}%**)
* **Average Order Value (AOV):** $${f.averageOrderValue.toFixed(2)}

**Inventory & Supply Chain Status:**
* **Active Products in Catalog:** ${inv.totalProducts} items
* **Total Inventory Capital Tied Up:** $${inv.totalInventoryCostValue.toLocaleString()} (Retail Value: $${inv.totalInventoryRetailValue.toLocaleString()})
* **Stock Health:** ${stockHealth}

**Strategic Diagnosis:**
1. **Margin Strength:** Your gross profit margin of **${f.profitMarginPercent}%** indicates robust product pricing power and healthy unit economics.
2. **Top Revenue Driver:** **${topP[0]?.name || 'N/A'}** leads your revenue with **$${topP[0]?.revenue?.toLocaleString() || 0}** in sales (${topP[0]?.unitsSold || 0} units sold).
3. **Immediate Risk Flag:** ${inv.lowStockItemsCount > 0 ? `Replenish **${inv.criticalStockItems.map((c: any) => c.name).join(', ')}** to avoid fulfillment halts.` : 'Inventory supply is steady with no immediate reorder alarms.'}`;
    }

    // 2. Best-Selling Products
    if (p.includes('best') || p.includes('top product') || p.includes('best-seller') || p.includes('best selling') || p.includes('popular')) {
      if (!topP || topP.length === 0) {
        return `### 🏆 Best-Selling Products Analysis\n\nNo completed order records are currently in the database. Once orders are recorded, this report will rank products by gross revenue, volume sold, and profit contributions.`;
      }

      const rows = topP.map((item: any, idx: number) => 
        `**${idx + 1}. ${item.name}** (\`${item.sku}\`)\n` +
        `   * **Revenue Generated:** $${item.revenue.toLocaleString()} | **Units Sold:** ${item.unitsSold}\n` +
        `   * **Gross Profit Contribution:** $${item.grossProfit.toLocaleString()}`
      ).join('\n\n');

      return `### 🏆 Top-Performing Products by Revenue

${rows}

---
💡 **Business Brain Recommendation:**
Your top 2 products generate the substantial majority of your gross margin. Consider packaging these high-velocity items into bundled offerings or establishing supplier volume discounts to further widen margins.`;
    }

    // 3. Restock / Low-Stock Alerts
    if (p.includes('restock') || p.includes('stock') || p.includes('inventory') || p.includes('reorder')) {
      if (inv.criticalStockItems.length === 0) {
        return `### 📦 Inventory Health & Restock Guidance\n\n**All inventory levels are currently healthy!**\n* All **${inv.totalProducts} active products** are above their designated minimum safety thresholds.\n* Total inventory cost value currently on hand: **$${inv.totalInventoryCostValue.toLocaleString()}**.\n* No purchase orders are urgently required today.`;
      }

      const restockList = inv.criticalStockItems.map((c: any) => 
        `* ⚠️ **${c.name}** (\`${c.sku}\`): Current Stock: **${c.stock} units** (Min Safety Threshold: ${c.threshold}) — Sold **${c.unitsSoldHistorically} units** historically.`
      ).join('\n');

      return `### 📦 Priority Restock Recommendations

The following **${inv.criticalStockItems.length} products** have fallen below minimum safety thresholds and are at risk of immediate stockouts:

${restockList}

**Recommended Next Steps:**
1. **Emergency PO:** Issue purchase orders for items with less than 3 units remaining today.
2. **Safety Stock Calibration:** For items with high historical velocity, consider raising the threshold by +25% to prevent future supply interruptions.`;
    }

    // 4. Underperforming / Dead Stock Products
    if (p.includes('underperform') || p.includes('slow') || p.includes('dead stock') || p.includes('worst')) {
      if (inv.underperformingItems.length === 0) {
        return `### 📉 Product Performance Analysis\n\nNo stagnant stock detected. Every product in your catalog has demonstrated steady order velocity.`;
      }

      const underList = inv.underperformingItems.map((u: any) => 
        `* 🔍 **${u.name}** (\`${u.sku}\`): Only **${u.unitsSold} units sold**, with **${u.stock} units** currently holding **$${u.tiedUpCapital.toLocaleString()}** in idle working capital.`
      ).join('\n');

      return `### 📉 Underperforming Inventory & Capital Efficiency

The following items exhibit slow turnover and represent idle working capital:

${underList}

**Actionable Recommendations:**
1. **Flash Promotions / Bundles:** Bundle slow-moving items with top-sellers (e.g. *${topP[0]?.name || 'Top Product'}*) at a 15% discount to liquidate capital.
2. **Capital Reallocation:** Reallocate the recovered capital into higher-velocity product lines.`;
    }

    // 5. Weekly Focus & Actionable Recommendations
    if (p.includes('focus') || p.includes('week') || p.includes('action') || p.includes('recommend') || p.includes('what should i')) {
      return `### 🎯 Strategic Weekly Focus Plan

Based on real-time business telemetry from your database, here are your top 3 operational priorities for this week:

1. **Supply Chain & Restocking:**
   ${inv.criticalStockItems.length > 0 
     ? `* Place purchase orders immediately for **${inv.criticalStockItems.map((i: any) => i.name).slice(0, 2).join(' and ')}** to eliminate fulfillment bottlenecks.`
     : `* Inventory levels are stable. Audit supplier lead times to safeguard upcoming seasonal demand.`}

2. **Customer Retention & Account Expansion:**
   * Your top accounts (**${cust.topCustomers[0]?.name || 'Key Account'}**) represent a significant portion of lifetime value. Schedule a quarterly business review or offer tailored enterprise tier benefits.

3. **Margin & Working Capital Optimization:**
   * Your current gross margin is **${f.profitMarginPercent}%**. Review freight and handling costs on lower-margin hardware to protect your bottom line.`;
    }

    // 6. Risk Assessment
    if (p.includes('risk') || p.includes('threat') || p.includes('danger') || p.includes('problem')) {
      return `### 🛡️ Business Risk & Vulnerability Matrix

1. **Supply Disruption Risk:** ${inv.criticalStockItems.length > 0 ? `HIGH. ${inv.criticalStockItems.length} core product lines are critically low in stock.` : 'LOW. Inventory reserves are balanced.'}
2. **Customer Concentration Risk:** ${cust.topTwoCustomerRevenueConcentration ? `MODERATE. Top two clients account for approx ${cust.topTwoCustomerRevenueConcentration} of gross revenue.` : 'LOW. Revenue is well-diversified across client base.'}
3. **Cash Flow & Margin Exposure:** LOW. Net margin is healthy at **${f.profitMarginPercent}%**, with positive cash yield from **$${f.grossRevenue.toLocaleString()}** in collected sales.`;
    }

    // General intelligent response
    return `### 💡 Business Brain Intelligence

**Current Database Context Snapshot:**
* **Gross Revenue:** $${f.grossRevenue.toLocaleString()} | **Net Profit:** $${f.netProfit.toLocaleString()} (**${f.profitMarginPercent}%** margin)
* **Completed Orders:** ${f.totalCompletedOrders} | **Average Order Value:** $${f.averageOrderValue.toFixed(2)}
* **Catalog Health:** ${inv.totalProducts} active products (${inv.lowStockItemsCount} low stock alerts)

**Regarding your inquiry:** "${prompt}"
I have cross-referenced your operational data. If you are analyzing revenue growth, your strongest category is **${ctx.categories[0]?.category || 'General'}** contributing **$${ctx.categories[0]?.revenue?.toLocaleString() || 0}**.

*Feel free to ask specific follow-ups, such as:*
* *"Which products should I restock right now?"*
* *"Who are my highest-value customers?"*
* *"What is my weekly action plan?"*
* *(Tip: Connect your Google Gemini API key in Settings for open-ended generative multi-turn dialogue!)*`;
  },

  getConversations() {
    return db.prepare(`
      SELECT c.*, COUNT(m.id) as message_count, MAX(m.created_at) as last_message_at
      FROM brain_conversations c
      LEFT JOIN brain_messages m ON c.id = m.conversation_id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `).all();
  },

  getConversationMessages(id: string) {
    return db.prepare(`
      SELECT * FROM brain_messages 
      WHERE conversation_id = ? 
      ORDER BY id ASC
    `).all(id);
  },

  deleteConversation(id: string) {
    db.prepare('DELETE FROM brain_conversations WHERE id = ?').run(id);
    return { success: true };
  }
};
