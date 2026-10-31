import { Router } from 'express';
import { db } from '../db/database.ts';
import { seedDatabase } from '../db/seed.ts';
import { businessBrain } from '../services/businessBrain.ts';

const router = Router();

// GET all settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
      if (r.key === 'ai_api_key' && r.value) {
        // Mask API key for security
        settings[r.key] = r.value.length > 8 ? `${r.value.slice(0, 4)}...${r.value.slice(-4)}` : '••••••••';
        settings['has_custom_api_key'] = 'true';
      } else {
        settings[r.key] = r.value;
      }
    }
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST update settings
router.post('/', (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    const updateStmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    for (const [key, val] of Object.entries(updates)) {
      // Do not overwrite API key if user sent masked string
      if (key === 'ai_api_key' && (val.includes('••••') || val.includes('...'))) {
        continue;
      }
      updateStmt.run(key, String(val));
    }

    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST test AI configuration
router.post('/test-ai', async (req, res) => {
  try {
    const { apiKey, model } = req.body;
    let keyToTest = apiKey;

    if (!keyToTest || keyToTest.includes('••••') || keyToTest.includes('...')) {
      const dbKey = db.prepare("SELECT value FROM settings WHERE key = 'ai_api_key'").get() as { value: string } | undefined;
      keyToTest = dbKey?.value || process.env.GEMINI_API_KEY || '';
    }

    if (!keyToTest || keyToTest.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'No API key provided. Please input a valid Gemini API key.'
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
        message: `Connection failed (HTTP ${response.status}): ${errText}`
      });
    }

    res.json({
      success: true,
      message: `Successfully connected to Google Gemini (${testModel})!`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST seed realistic demo dataset
router.post('/seed', (req, res) => {
  try {
    const result = seedDatabase();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST reset operational data (wipe orders, products, customers)
router.post('/reset', (req, res) => {
  try {
    db.exec('BEGIN TRANSACTION;');
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
    db.exec('COMMIT;');
    res.json({ success: true, message: 'All operational records have been cleared. Database is now in clean initial state.' });
  } catch (error: any) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: error.message });
  }
});

export default router;
