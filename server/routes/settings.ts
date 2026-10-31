import { Router } from 'express';
import { db } from '../db/database.ts';
import { seedDatabaseForBusiness } from '../db/seed.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(authenticateToken);

// GET all settings for current business
router.get('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;

    // Fetch business profile
    const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [businessId]);

    // Fetch key-value settings
    const rows = await db.query('SELECT key, value FROM settings WHERE business_id = ?', [businessId]);
    const settings: Record<string, string> = {
      business_name: business?.name || 'Apex Innovations Ltd',
      currency_symbol: business?.currency_symbol || '$',
      tax_rate: String(business?.tax_rate || 8.5),
      contact_email: business?.contact_email || '',
      business_address: business?.address || '',
    };

    let hasKey = false;
    // Check if server-side environment key is available
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10) {
      hasKey = true;
    }

    for (const r of rows) {
      if (r.key === 'ai_api_key' && r.value && r.value.trim().length > 5) {
        hasKey = true;
        // Strict AI Security: NEVER expose API key to client
        settings['ai_api_key'] = '••••••••';
      } else {
        settings[r.key] = r.value;
      }
    }

    settings['has_custom_api_key'] = hasKey ? 'true' : 'false';
    if (!settings['ai_api_key'] && hasKey) {
      settings['ai_api_key'] = '••••••••';
    }

    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST update settings
router.post('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const updates = req.body as Record<string, string>;

    // Update business table if profile fields are provided
    if (updates.business_name || updates.currency_symbol || updates.tax_rate !== undefined || updates.contact_email !== undefined || updates.business_address !== undefined) {
      await db.execute(`
        UPDATE businesses 
        SET name = COALESCE(?, name),
            currency_symbol = COALESCE(?, currency_symbol),
            tax_rate = COALESCE(?, tax_rate),
            contact_email = COALESCE(?, contact_email),
            address = COALESCE(?, address)
        WHERE id = ?
      `, [
        updates.business_name || null,
        updates.currency_symbol || null,
        updates.tax_rate !== undefined ? parseFloat(updates.tax_rate) : null,
        updates.contact_email !== undefined ? updates.contact_email : null,
        updates.business_address !== undefined ? updates.business_address : null,
        businessId
      ]);
    }

    // Update or insert key-value pairs in settings
    for (const [key, val] of Object.entries(updates)) {
      if (key === 'ai_api_key') {
        // AI Security: Ignore masked placeholder values
        if (val.includes('••••') || val.includes('...') || !val.trim()) {
          continue;
        }
      }

      const existing = await db.queryOne(
        'SELECT id FROM settings WHERE business_id = ? AND key = ?',
        [businessId, key]
      );

      if (existing) {
        await db.execute(
          'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ? AND key = ?',
          [String(val), businessId, key]
        );
      } else {
        await db.execute(
          'INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)',
          [businessId, key, String(val)]
        );
      }
    }

    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST test AI configuration (strictly executed on server)
router.post('/test-ai', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { provider = 'gemini', apiKey, model, baseUrl } = req.body;
    let keyToTest = apiKey;

    if (!keyToTest || keyToTest.includes('••••') || keyToTest.includes('...')) {
      const dbKey = await db.queryOne("SELECT value FROM settings WHERE business_id = ? AND key = 'ai_api_key'", [businessId]);
      keyToTest = dbKey?.value || process.env.GEMINI_API_KEY || '';
    }

    // 1. Google Gemini
    if (provider === 'gemini') {
      if (!keyToTest || keyToTest.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'No Gemini API key provided. Obtain your 100% free key at https://aistudio.google.com/app/apikey'
        });
      }

      const testModel = model || 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${keyToTest.trim()}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Respond with exactly: CONNECTION_OK' }] }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(400).json({
          success: false,
          message: `Gemini verification failed (HTTP ${response.status}): ${errText}`
        });
      }

      return res.json({
        success: true,
        message: `Successfully connected to Google Gemini (${testModel})!`
      });
    }

    // 2. Groq (Ultra-fast Free API)
    if (provider === 'groq') {
      if (!keyToTest || keyToTest.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'No Groq API key provided. Obtain your 100% free API key at https://console.groq.com/keys'
        });
      }

      const testModel = model || 'llama-3.3-70b-versatile';
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyToTest.trim()}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5,
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(400).json({
          success: false,
          message: `Groq verification failed (HTTP ${response.status}): ${errText}`
        });
      }

      return res.json({
        success: true,
        message: `Successfully connected to Groq (${testModel}) at high velocity!`
      });
    }

    // 3. OpenRouter (Free Models available)
    if (provider === 'openrouter') {
      if (!keyToTest || keyToTest.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'No OpenRouter API key provided. Obtain your free key at https://openrouter.ai/keys'
        });
      }

      const testModel = model || 'deepseek/deepseek-r1:free';
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyToTest.trim()}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5,
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(400).json({
          success: false,
          message: `OpenRouter verification failed (HTTP ${response.status}): ${errText}`
        });
      }

      return res.json({
        success: true,
        message: `Successfully connected to OpenRouter (${testModel})!`
      });
    }

    // 4. Ollama (100% Free Local AI)
    if (provider === 'ollama') {
      const host = baseUrl || 'http://127.0.0.1:11434';
      try {
        const response = await fetch(`${host.replace(/\/$/, '')}/api/tags`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const models = (data.models || []).map((m: any) => m.name).join(', ') || 'none found';
        return res.json({
          success: true,
          message: `Successfully connected to local Ollama! Available local models: ${models}`
        });
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: `Could not reach local Ollama at ${host}. Make sure Ollama is running ('ollama serve'). Error: ${err.message}`
        });
      }
    }

    // 5. Custom OpenAI-compatible Endpoint
    if (provider === 'custom') {
      if (!baseUrl) {
        return res.status(400).json({
          success: false,
          message: 'Base URL is required for custom OpenAI-compatible providers (e.g. http://localhost:1234/v1).'
        });
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (keyToTest) headers['Authorization'] = `Bearer ${keyToTest.trim()}`;

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model || 'default',
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5,
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(400).json({
          success: false,
          message: `Custom endpoint verification failed (HTTP ${response.status}): ${errText}`
        });
      }

      return res.json({
        success: true,
        message: `Successfully connected to custom endpoint (${baseUrl})!`
      });
    }

    // 6. Built-in Deterministic Engine
    return res.json({
      success: true,
      message: 'Bussinex Built-in Autonomous Business Agent is ready and 100% active!'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST seed realistic demo dataset for current business
router.post('/seed', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const result = await seedDatabaseForBusiness(businessId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST reset operational data for current business
router.post('/reset', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    await db.execute('DELETE FROM brain_messages WHERE conversation_id IN (SELECT id FROM brain_conversations WHERE business_id = ?)', [businessId]);
    await db.execute('DELETE FROM brain_conversations WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id = ?)', [businessId]);
    await db.execute('DELETE FROM orders WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM stock_logs WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM products WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM categories WHERE business_id = ?', [businessId]);
    await db.execute('DELETE FROM customers WHERE business_id = ?', [businessId]);

    res.json({ success: true, message: 'All operational records have been cleared for this business tenant.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
