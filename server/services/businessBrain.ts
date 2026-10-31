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
          costPrice: Number(i.cost_price),
          sellingPrice: Number(i.selling_price),
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

    const provider = settingsMap['ai_provider'] || process.env.AI_PROVIDER || 'gemini';
    const apiKey = settingsMap['ai_api_key'] || process.env.GEMINI_API_KEY || '';
    const baseUrl = settingsMap['ai_base_url'] || '';

    let defaultModel = 'gemini-2.5-flash';
    if (provider === 'groq') defaultModel = 'llama-3.3-70b-versatile';
    else if (provider === 'openrouter') defaultModel = 'deepseek/deepseek-r1:free';
    else if (provider === 'ollama') defaultModel = 'llama3';

    const model = settingsMap['ai_model'] || process.env.AI_MODEL || defaultModel;
    const temperature = parseFloat(settingsMap['ai_temperature'] || '0.2');

    return { provider, apiKey, baseUrl, model, temperature };
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
    let providerUsed = 'Bussinex Autonomous Business Agent (Built-in Free)';

    const lower = userPrompt.toLowerCase();
    const isFreeAIQuestion = lower.includes('free ai') || lower.includes('connect ai') || lower.includes('free model') || lower.includes('api key') || lower.includes('which free');

    // If user is directly asking how to connect free AI, provide the interactive setup guide immediately
    if (isFreeAIQuestion) {
      assistantResponse = this.generateFreeAIConnectionGuide();
      providerUsed = 'Bussinex Free AI Connection Assistant';
    } else if (aiConfig.provider === 'gemini' && aiConfig.apiKey && aiConfig.apiKey.trim().length > 10) {
      try {
        assistantResponse = await this.callGeminiAPI(aiConfig.apiKey, aiConfig.model, userPrompt, history, context);
        providerUsed = `Google Gemini (${aiConfig.model})`;
      } catch (err: any) {
        console.warn('Gemini API call failed, falling back to Deterministic Intelligence Engine:', err.message);
        assistantResponse = this.generateDeterministicAnalysis(userPrompt, context) + 
          `\n\n> *[Notice: Using verified autonomous engine fallback (Gemini error: ${err.message}). Check your key in Settings.]*`;
        providerUsed = 'Bussinex Agent (Autonomous Fallback)';
      }
    } else if (aiConfig.provider === 'groq' && aiConfig.apiKey && aiConfig.apiKey.trim().length > 10) {
      try {
        assistantResponse = await this.callOpenAICompatibleAPI(
          'https://api.groq.com/openai/v1',
          aiConfig.apiKey,
          aiConfig.model || 'llama-3.3-70b-versatile',
          userPrompt,
          history,
          context
        );
        providerUsed = `Groq High-Speed (${aiConfig.model || 'llama-3.3-70b'})`;
      } catch (err: any) {
        console.warn('Groq call failed, fallback:', err.message);
        assistantResponse = this.generateDeterministicAnalysis(userPrompt, context) +
          `\n\n> *[Notice: Using verified autonomous engine fallback (Groq error: ${err.message}).]*`;
        providerUsed = 'Bussinex Agent (Autonomous Fallback)';
      }
    } else if (aiConfig.provider === 'openrouter' && aiConfig.apiKey && aiConfig.apiKey.trim().length > 10) {
      try {
        assistantResponse = await this.callOpenAICompatibleAPI(
          'https://openrouter.ai/api/v1',
          aiConfig.apiKey,
          aiConfig.model || 'deepseek/deepseek-r1:free',
          userPrompt,
          history,
          context
        );
        providerUsed = `OpenRouter (${aiConfig.model || 'deepseek-r1:free'})`;
      } catch (err: any) {
        console.warn('OpenRouter call failed, fallback:', err.message);
        assistantResponse = this.generateDeterministicAnalysis(userPrompt, context) +
          `\n\n> *[Notice: Using verified autonomous engine fallback (OpenRouter error: ${err.message}).]*`;
        providerUsed = 'Bussinex Agent (Autonomous Fallback)';
      }
    } else if (aiConfig.provider === 'ollama') {
      try {
        const host = aiConfig.baseUrl || 'http://127.0.0.1:11434/v1';
        assistantResponse = await this.callOpenAICompatibleAPI(
          host,
          'ollama',
          aiConfig.model || 'llama3',
          userPrompt,
          history,
          context
        );
        providerUsed = `Local Ollama (${aiConfig.model || 'llama3'})`;
      } catch (err: any) {
        console.warn('Ollama call failed, fallback:', err.message);
        assistantResponse = this.generateDeterministicAnalysis(userPrompt, context) +
          `\n\n> *[Notice: Local Ollama unreachable at ${aiConfig.baseUrl || 'http://127.0.0.1:11434'}. Ensure 'ollama serve' is running.]*`;
        providerUsed = 'Bussinex Agent (Autonomous Fallback)';
      }
    } else if (aiConfig.provider === 'custom' && aiConfig.baseUrl) {
      try {
        assistantResponse = await this.callOpenAICompatibleAPI(
          aiConfig.baseUrl,
          aiConfig.apiKey || '',
          aiConfig.model || 'default',
          userPrompt,
          history,
          context
        );
        providerUsed = `Custom Model (${aiConfig.model})`;
      } catch (err: any) {
        assistantResponse = this.generateDeterministicAnalysis(userPrompt, context);
        providerUsed = 'Bussinex Agent (Autonomous Fallback)';
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

  buildSystemPrompt(context: any): string {
    return `
You are the **Bussinex Business Brain**, the autonomous Chief Operating Officer (COO) and Executive Financial Intelligence Agent for this enterprise.
You have direct, verified, read-only access to the company's live database.

HERE ARE THE VERIFIED FACTS FROM THE ENTERPRISE DATABASE:
${JSON.stringify(context, null, 2)}

OPERATIONAL RULES:
1. Ground all analysis strictly in the database facts above (gross revenue, COGS, margins, stock levels, orders, customer concentration).
2. Clearly distinguish between **VERIFIED LIVE DATA** and **STRATEGIC RECOMMENDATIONS**.
3. If asked about performance, break down: Financial Snapshot, Margin Health, Supply Chain Bottlenecks, and High-Leverage Strategic Directives.
4. If asked about restocking, calculate exact units needed to reach healthy safety thresholds, estimated replenishment cost, and historic sales velocity.
5. If the user asks how to connect a free AI or configure API keys, guide them warmly on connecting Google Gemini, Groq (Llama 3.3), OpenRouter, or Local Ollama.
6. Format responses with clean markdown headers, bold metrics, and executive bullet points.
`;
  },

  async callGeminiAPI(apiKey: string, model: string, userPrompt: string, history: Message[], context: any): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const systemInstruction = this.buildSystemPrompt(context);

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

  async callOpenAICompatibleAPI(
    baseUrl: string,
    apiKey: string,
    model: string,
    userPrompt: string,
    history: Message[],
    context: any
  ): Promise<string> {
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const systemInstruction = this.buildSystemPrompt(context);

    const messages = [
      { role: 'system', content: systemInstruction },
      ...history.map(h => ({ role: h.role, content: h.content })),
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey && apiKey !== 'ollama') {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 2048,
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Model returned empty response.';
  },

  generateFreeAIConnectionGuide(): string {
    return `### 🤖 Bussinex Free AI Connection Assistant

You can connect **any 100% free AI model** to power your Business Brain in seconds with zero credit card required!

---

#### 🌟 Option 1: Google Gemini (Recommended — Most Capable)
* **What you get:** Unlimited smart analysis with \`gemini-2.5-flash\` or \`gemini-1.5-flash\` (15 requests/min free).
* **Step 1:** Open [Google AI Studio](https://aistudio.google.com/app/apikey) in your browser.
* **Step 2:** Click **"Create API Key"** (free forever with any Google account).
* **Step 3:** In Bussinex, click **"Connect Free AI"** in the top bar or go to **Settings → AI Engine**, paste your key, and click **Save & Test**!

---

#### ⚡ Option 2: Groq (Blazing Fast — ~300 tokens/sec)
* **What you get:** Ultra-fast open-weights intelligence running **Llama 3.3 70B** and **DeepSeek R1**.
* **Step 1:** Open [Groq Cloud Console](https://console.groq.com/keys).
* **Step 2:** Sign in with GitHub or Google and generate a free API key in 10 seconds.
* **Step 3:** Choose **Groq** in Settings, paste your key, and select model \`llama-3.3-70b-versatile\`!

---

#### 🌐 Option 3: OpenRouter (Access Hundreds of Free Open Models)
* **What you get:** Access to \`deepseek/deepseek-r1:free\`, \`meta-llama/llama-3.3-70b-instruct:free\`, and \`mistralai/mistral-7b-instruct:free\`.
* **Step 1:** Go to [OpenRouter Keys](https://openrouter.ai/keys) and create a free key.
* **Step 2:** Choose **OpenRouter** in Settings and use model \`deepseek/deepseek-r1:free\`.

---

#### 💻 Option 4: Local Ollama (100% Free, Private & Offline)
* **What you get:** Zero keys, zero rate limits, runs 100% locally on your computer!
* **Step 1:** Download and install [Ollama](https://ollama.com).
* **Step 2:** Run in your terminal: \`ollama run llama3\` or \`ollama run deepseek-r1\`.
* **Step 3:** Choose **Ollama** in Settings (URL: \`http://127.0.0.1:11434/v1\`).

---

💡 **Pro Tip:** Even without connecting an external key, Bussinex's **Built-in Autonomous Business Agent** is always active and analyzing your live inventory, order velocity, and profit margins!`;
  },

  generateDeterministicAnalysis(prompt: string, ctx: any): string {
    const p = prompt.toLowerCase();
    const f = ctx.financials;
    const inv = ctx.inventory;
    const topP = ctx.topPerformers;
    const cust = ctx.customerInsights;

    // Check for Free AI guidance
    if (p.includes('free ai') || p.includes('connect ai') || p.includes('api key') || p.includes('model') || p.includes('which ai')) {
      return this.generateFreeAIConnectionGuide();
    }

    // 1. Executive Performance
    if (p.includes('perform') || p.includes('summary') || p.includes('how is my business') || p.includes('overview') || p.includes('health')) {
      const stockHealth = inv.lowStockItemsCount === 0 
        ? "✅ Optimal: All products meet or exceed safety stock thresholds."
        : `⚠️ Critical: **${inv.lowStockItemsCount} product(s)** are below threshold and risk stockouts.`;

      return `### 📊 Executive Performance Overview

**Financial Snapshot (Verified Live Data):**
* **Gross Revenue:** $${f.grossRevenue.toLocaleString()} across **${f.totalCompletedOrders} completed orders**
* **Cost of Goods Sold (COGS):** $${f.cogs.toLocaleString()}
* **Net Operating Profit:** **$${f.netProfit.toLocaleString()}** (Gross Margin: **${f.profitMarginPercent}%**)
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

    // 2. Best Sellers
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

    // 3. Restock Urgency & Calculation
    if (p.includes('restock') || p.includes('stock') || p.includes('inventory') || p.includes('reorder')) {
      if (inv.criticalStockItems.length === 0) {
        return `### 📦 Inventory Health & Restock Guidance\n\n**All inventory levels are currently healthy!**\n* All **${inv.totalProducts} active products** are above designated safety thresholds.\n* Total inventory cost value on hand: **$${inv.totalInventoryCostValue.toLocaleString()}**.\n* No purchase orders are urgently required today.`;
      }

      let totalEstReplenishCost = 0;
      const restockList = inv.criticalStockItems.map((c: any) => {
        const unitsNeeded = Math.max(10, (c.threshold * 2) - c.stock);
        const estCost = unitsNeeded * c.costPrice;
        totalEstReplenishCost += estCost;
        return `* ⚠️ **${c.name}** (\`${c.sku}\`):
  * Current Stock: **${c.stock} units** (Safety Threshold: ${c.threshold})
  * Suggested Reorder: **+${unitsNeeded} units** | Estimated Cost: **$${estCost.toLocaleString()}**`;
      }).join('\n\n');

      return `### 📦 Priority Restock Order & Budget Calculation

The following **${inv.criticalStockItems.length} products** require immediate supplier purchase orders:

${restockList}

---
**Estimated Total Restock Capital Required:** **$${totalEstReplenishCost.toLocaleString()}**

**Action Items:**
1. Generate Purchase Orders with primary suppliers today to protect fulfillment velocity.
2. Consider setting automated re-order points at 1.5x minimum threshold.`;
    }

    // 4. Risk Audit & Vulnerabilities
    if (p.includes('risk') || p.includes('vulnerab') || p.includes('threat') || p.includes('audit')) {
      let riskScore = 0;
      const risks: string[] = [];

      if (inv.lowStockItemsCount > 0) {
        riskScore += 35;
        risks.push(`* **Supply Chain Fulfillment Risk (High):** ${inv.lowStockItemsCount} items are below safety stock threshold. Inability to fulfill incoming orders risks customer dissatisfaction.`);
      }

      if (parseFloat(cust.topTwoCustomerRevenueConcentration) > 40) {
        riskScore += 30;
        risks.push(`* **Client Concentration Risk (Moderate):** Your top 2 clients account for **${cust.topTwoCustomerRevenueConcentration}** of total business revenue. Churn from either client would significantly impact short-term cash flow.`);
      }

      if (inv.underperformingItems && inv.underperformingItems.length > 0) {
        riskScore += 20;
        const idleCapital = inv.underperformingItems.reduce((acc: number, item: any) => acc + item.tiedUpCapital, 0);
        risks.push(`* **Idle Capital In Dead Stock (Moderate):** $${idleCapital.toLocaleString()} is locked in slow-moving inventory with low historical turnover.`);
      }

      return `### 🛡️ Enterprise Risk & Vulnerability Audit

**Overall Risk Index:** **${riskScore > 50 ? '⚠️ Elevated' : '✅ Moderate'} (${riskScore}/100)**

${risks.join('\n\n')}

**Mitigation Directives:**
1. **Diversify Revenue:** Implement targeted B2B outreach to onboard 3 new enterprise accounts this quarter.
2. **Liquidate Dead Inventory:** Run promotional clearance or bundle slow-moving accessories with top-sellers.
3. **Safety Buffers:** Increase re-order triggers by 20% for top revenue-generating hardware.`;
    }

    // 5. Weekly Focus & Growth Directives
    if (p.includes('week') || p.includes('focus') || p.includes('action plan') || p.includes('grow')) {
      return `### 🎯 High-Leverage Weekly Action Plan

**1. Revenue Expansion (Primary Focus):**
* Engage top customer **${cust.topCustomers[0]?.name || 'Tier 1 Clients'}** (${cust.topCustomers[0]?.company || 'Enterprise'}) for recurring contract renewals.
* Cross-sell accessories with your top seller **${topP[0]?.name || 'leading hardware'}**.

**2. Operations & Inventory:**
* Issue restock orders for the **${inv.lowStockItemsCount} low-stock products** before fulfillment backlogs accumulate.
* Review pricing on categories with margins exceeding 40% for strategic promotional opportunities.

**3. Cash Flow Optimization:**
* Monitor Accounts Receivable to maintain average order turnaround under 3 business days.`;
    }

    // Default Intelligence
    return `### 💡 Business Brain Intelligence

**Live Database Telemetry:**
* **Gross Revenue:** $${f.grossRevenue.toLocaleString()} | **Net Profit:** $${f.netProfit.toLocaleString()} (**${f.profitMarginPercent}%** margin)
* **Completed Orders:** ${f.totalCompletedOrders} | **Catalog Health:** ${inv.totalProducts} active products (${inv.lowStockItemsCount} low stock alerts)

Regarding your inquiry: "${prompt}"

**Executive Assessment:**
Your operational metrics have been fully analyzed. You can ask for:
* **"How is my business performing?"** for full executive telemetry
* **"Which products should I restock?"** for exact reorder calculations and budget estimates
* **"Identify potential business risks"** for customer concentration & inventory audits
* **"How to connect a free AI"** to link Google Gemini, Groq (Llama 3.3), OpenRouter, or Local Ollama!`;
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
