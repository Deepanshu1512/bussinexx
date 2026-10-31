import { db } from '../db/database.ts';
import { analyticsService } from './analyticsService.ts';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const businessBrain = {
  /**
   * Builds verified, deterministic business facts strictly for the caller's business_id.
   * NEVER runs arbitrary SQL. Uses controlled aggregation pipelines.
   */
  async gatherBusinessContext(businessId: number) {
    const summary = await analyticsService.getExecutiveSummary(businessId);
    const topProducts = await analyticsService.getTopSellingProducts(businessId, 5);
    const categoryStats = await analyticsService.getCategoryPerformance(businessId);
    const topCustomers = await analyticsService.getTopCustomers(businessId, 5);

    // Products needing restock
    const criticalStock = await db.query(`
      SELECT p.id, p.name, p.sku, p.current_stock, p.min_stock_threshold, p.cost_price, p.selling_price,
             COALESCE(SUM(oi.quantity), 0) as total_units_sold
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.business_id = ? AND p.status = 'active' AND p.current_stock <= p.min_stock_threshold
      GROUP BY p.id, p.name, p.sku, p.current_stock, p.min_stock_threshold, p.cost_price, p.selling_price
      ORDER BY p.current_stock ASC
    `, [businessId]);

    // Underperforming items
    const underperformingProducts = await db.query(`
      SELECT p.id, p.name, p.sku, p.current_stock, p.cost_price, p.selling_price,
             (p.current_stock * p.cost_price) as tied_up_capital,
             COALESCE(SUM(oi.quantity), 0) as total_units_sold
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.business_id = ? AND p.status = 'active'
      GROUP BY p.id, p.name, p.sku, p.current_stock, p.cost_price, p.selling_price
      HAVING COALESCE(SUM(oi.quantity), 0) <= 2
      ORDER BY tied_up_capital DESC
      LIMIT 5
    `, [businessId]);

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
        criticalStockItems: criticalStock.map((i: any) => ({
          name: i.name,
          sku: i.sku,
          stock: Number(i.current_stock),
          threshold: Number(i.min_stock_threshold),
          unitsSoldHistorically: Number(i.total_units_sold)
        })),
        underperformingItems: underperformingProducts.map((u: any) => ({
          name: u.name,
          sku: u.sku,
          stock: Number(u.current_stock),
          tiedUpCapital: Number(Number(u.tied_up_capital).toFixed(2)),
          unitsSold: Number(u.total_units_sold)
        }))
      },
      topPerformers: topProducts.map((tp: any) => ({
        name: tp.product_name,
        sku: tp.product_sku,
        revenue: tp.total_revenue,
        unitsSold: tp.units_sold,
        grossProfit: tp.gross_profit
      })),
      categories: categoryStats.map((cs: any) => ({
        category: cs.name,
        revenue: cs.total_revenue,
        unitsSold: cs.units_sold
      })),
      customerInsights: {
        totalCustomers: summary.totalCustomers,
        activeCustomers: summary.activeCustomers,
        topTwoCustomerRevenueConcentration: `${topTwoCustomerShare}%`,
        topCustomers: topCustomers.map((tc: any) => ({
          name: tc.name,
          company: tc.company,
          lifetimeValue: tc.lifetime_value,
          orders: tc.total_orders
        }))
      }
    };
  },

  async getAISettings(businessId: number) {
    const rows = await db.query(
      "SELECT key, value FROM settings WHERE business_id = ? AND key LIKE 'ai_%'",
      [businessId]
    );
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

  async processQuery(businessId: number, conversationId: string | null, userPrompt: string) {
    const context = await this.gatherBusinessContext(businessId);
    const aiConfig = await this.getAISettings(businessId);

    let convId = conversationId;
    if (!convId) {
      convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const title = userPrompt.length > 36 ? userPrompt.substring(0, 33) + '...' : userPrompt;
      await db.execute(
        'INSERT INTO brain_conversations (id, business_id, title) VALUES (?, ?, ?)',
        [convId, businessId, title]
      );
    } else {
      // Verify conversation belongs to this business
      const conv = await db.queryOne('SELECT id FROM brain_conversations WHERE business_id = ? AND id = ?', [businessId, convId]);
      if (!conv) {
        throw new Error('Conversation not found or access denied.');
      }
    }

    // Save user message
    await db.execute(
      'INSERT INTO brain_messages (conversation_id, role, content) VALUES (?, ?, ?)',
      [convId, 'user', userPrompt]
    );

    const history = await db.query<Message>(`
      SELECT role, content FROM brain_messages 
      WHERE conversation_id = ? 
      ORDER BY id ASC 
      LIMIT 10
    `, [convId]);

    let assistantResponse = '';
    let providerUsed = 'Deterministic Business Intelligence Engine';

    // Strictly server-side call to hosted Gemini API
    if (aiConfig.apiKey && aiConfig.apiKey.trim().length > 10) {
      try {
        assistantResponse = await this.callGeminiAPI(aiConfig.apiKey, aiConfig.model, userPrompt, history, context);
        providerUsed = `Google Gemini (${aiConfig.model})`;
      } catch (err: any) {
        console.warn('Gemini API call failed, falling back to Deterministic Intelligence Engine:', err.message);
        assistantResponse = this.generateDeterministicAnalysis(userPrompt, context) + 
          `\n\n> *[Notice: Using verified deterministic engine fallback (Gemini response: ${err.message}). Check API key in Settings.]*`;
        providerUsed = 'Deterministic Engine (Fallback)';
      }
    } else {
      assistantResponse = this.generateDeterministicAnalysis(userPrompt, context);
    }

    // Save assistant message
    await db.execute(
      'INSERT INTO brain_messages (conversation_id, role, content, metrics_context) VALUES (?, ?, ?, ?)',
      [convId, 'assistant', assistantResponse, JSON.stringify(context.financials)]
    );

    await db.execute("UPDATE brain_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [convId]);

    return {
      conversationId: convId,
      response: assistantResponse,
      metrics: context,
      providerUsed
    };
  },

  async callGeminiAPI(apiKey: string, model: string, userPrompt: string, history: Message[], context: any): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstruction = `
You are the **Bussinex Business Brain**, the central executive intelligence analyst for this enterprise.
You are directly connected to the company's verified operational database.

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

    const payload = {
      system_instruction: { parts: [{ text: systemInstruction }] },
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
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error('Gemini API returned empty text candidate.');
    }

    return candidate;
  },

  generateDeterministicAnalysis(prompt: string, ctx: any): string {
    const p = prompt.toLowerCase();
    const f = ctx.financials;
    const inv = ctx.inventory;
    const topP = ctx.topPerformers;
    const cust = ctx.customerInsights;

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
Your top products contribute the overwhelming majority of operating gross profit. Consider bundling top items or renegotiating bulk wholesale vendor terms.`;
    }

    if (p.includes('restock') || p.includes('stock') || p.includes('inventory') || p.includes('reorder')) {
      if (inv.criticalStockItems.length === 0) {
        return `### 📦 Inventory Health & Restock Guidance\n\n**All inventory levels are currently healthy!**\n* All **${inv.totalProducts} active products** are above designated safety thresholds.\n* Total inventory cost value on hand: **$${inv.totalInventoryCostValue.toLocaleString()}**.\n* No purchase orders are urgently required today.`;
      }

      const restockList = inv.criticalStockItems.map((c: any) => 
        `* ⚠️ **${c.name}** (\`${c.sku}\`): Current Stock: **${c.stock} units** (Min Threshold: ${c.threshold}) — Sold **${c.unitsSoldHistorically} units** historically.`
      ).join('\n');

      return `### 📦 Priority Restock Recommendations

The following **${inv.criticalStockItems.length} products** have fallen below safety thresholds:

${restockList}

**Recommended Next Steps:**
1. Issue purchase orders immediately for items with lowest days-of-supply remaining.
2. Adjust lead times for recurring best sellers to prevent future stockouts.`;
    }

    return `### 💡 Business Brain Intelligence

**Live Database Telemetry:**
* **Gross Revenue:** $${f.grossRevenue.toLocaleString()} | **Net Profit:** $${f.netProfit.toLocaleString()} (**${f.profitMarginPercent}%** margin)
* **Completed Orders:** ${f.totalCompletedOrders} | **Catalog Health:** ${inv.totalProducts} active products (${inv.lowStockItemsCount} low stock alerts)

Regarding your inquiry: "${prompt}"
Your operational database has been cross-referenced. For deeper multi-step exploratory analysis, you can enter your Google Gemini API key in Settings (securely saved on the server).`;
  },

  async getConversations(businessId: number) {
    return db.query(`
      SELECT c.*, COUNT(m.id) as message_count, MAX(m.created_at) as last_message_at
      FROM brain_conversations c
      LEFT JOIN brain_messages m ON c.id = m.conversation_id
      WHERE c.business_id = ?
      GROUP BY c.id, c.business_id, c.title, c.created_at, c.updated_at
      ORDER BY c.updated_at DESC
    `, [businessId]);
  },

  async getConversationMessages(businessId: number, id: string) {
    const conv = await db.queryOne('SELECT id FROM brain_conversations WHERE business_id = ? AND id = ?', [businessId, id]);
    if (!conv) {
      throw new Error('Conversation not found.');
    }
    return db.query(`
      SELECT * FROM brain_messages 
      WHERE conversation_id = ? 
      ORDER BY id ASC
    `, [id]);
  },

  async deleteConversation(businessId: number, id: string) {
    await db.execute('DELETE FROM brain_conversations WHERE business_id = ? AND id = ?', [businessId, id]);
    return { success: true };
  }
};
