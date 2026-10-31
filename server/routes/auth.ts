import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.ts';
import { seedDatabaseForBusiness } from '../db/seed.ts';
import { AuthRequest, authenticateToken } from '../middleware/auth.ts';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bussinex_jwt_secret_key_prod_2026';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, businessName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Check if user already exists
    const existingUser = await db.queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    // 1. Create Business Tenant
    const bName = businessName ? String(businessName).trim() : `${name.trim()}'s Enterprise`;
    const bResult = await db.execute(
      'INSERT INTO businesses (name, currency_symbol, tax_rate, contact_email) VALUES (?, ?, ?, ?)',
      [bName, '$', 8.5, cleanEmail]
    );
    const businessId = Number(bResult.lastInsertId);

    // 2. Hash Password
    const passwordHash = await bcrypt.hash(String(password), 10);

    // 3. Create User
    const uResult = await db.execute(
      'INSERT INTO users (business_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [businessId, String(name).trim(), cleanEmail, passwordHash, 'admin']
    );
    const userId = Number(uResult.lastInsertId);

    // 4. Seed starter operational records for this new business tenant
    try {
      await seedDatabaseForBusiness(businessId);
    } catch (seedErr) {
      console.warn('Optional starter seed skipped:', seedErr);
    }

    // 5. Generate JWT Token
    const token = jwt.sign(
      { id: userId, email: cleanEmail, business_id: businessId, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: userId, name: String(name).trim(), email: cleanEmail, role: 'admin', business_id: businessId },
      business: { id: businessId, name: bName },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await db.queryOne('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(String(password), user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [user.business_id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, business_id: user.business_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id },
      business: business || { id: user.business_id, name: 'Bussinex Enterprise' },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await db.queryOne(
      'SELECT id, business_id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user!.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [user.business_id]);

    res.json({
      user,
      business: business || { id: user.business_id, name: 'Bussinex Enterprise' },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
