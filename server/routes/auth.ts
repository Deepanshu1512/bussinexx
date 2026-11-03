import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, ensureDefaultExpenseCategoriesForBusiness } from '../db/database.ts';
import { ensureDefaultUserAndBusiness } from '../db/seed.ts';
import { emailService } from '../services/emailService.ts';
import { auditService } from '../services/auditService.ts';
import { 
  loginRateLimiter, 
  registerRateLimiter, 
  passwordResetRateLimiter 
} from '../middleware/rateLimiter.ts';
import { AuthRequest, authenticateToken } from '../middleware/auth.ts';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bussinex_jwt_secret_key_prod_2026';
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Sets secure HTTP-only session cookie
 */
function setSessionCookie(res: Response, token: string, maxAgeDays: number = 30) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  res.cookie('bussinex_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

// POST /api/auth/register — Real Shop & Owner Registration (Instant Access, No OTP)
router.post('/register', registerRateLimiter, async (req: Request, res: Response) => {
  try {
    const {
      // Owner Details
      name,
      email,
      password,
      confirmPassword,
      phone,
      // Business Details
      businessName,
      businessType = 'Retail Store',
      businessEmail,
      businessPhone,
      businessAddress,
      city,
      state,
      pincode
    } = req.body;

    // 1. Validate Owner Details
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }

    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid, deliverable email address.' });
    }

    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must contain at least 8 characters.' });
    }

    if (confirmPassword && String(password) !== String(confirmPassword)) {
      return res.status(400).json({ error: 'Password and confirm password do not match.' });
    }

    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: 'Please enter your phone number.' });
    }

    // 2. Validate Business Details
    if (!businessName || !String(businessName).trim()) {
      return res.status(400).json({ error: 'Please enter your shop or business name.' });
    }

    if (!businessAddress || !String(businessAddress).trim()) {
      return res.status(400).json({ error: 'Please enter your business address.' });
    }

    if (!city || !String(city).trim()) {
      return res.status(400).json({ error: 'Please enter your city.' });
    }

    if (!state || !String(state).trim()) {
      return res.status(400).json({ error: 'Please enter your state.' });
    }

    if (!pincode || !String(pincode).trim()) {
      return res.status(400).json({ error: 'Please enter your PIN code.' });
    }

    // 3. Prevent duplicate account registration with the same email
    const existingUser = await db.queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    // 4. Create Business Entity in Database
    const cleanBusinessName = String(businessName).trim();
    const cleanBusinessType = String(businessType || 'Retail Store').trim();
    const cleanContactEmail = businessEmail ? String(businessEmail).trim().toLowerCase() : cleanEmail;
    const cleanContactPhone = businessPhone ? String(businessPhone).trim() : String(phone).trim();
    const cleanAddress = String(businessAddress).trim();
    const cleanCity = String(city).trim();
    const cleanState = String(state).trim();
    const cleanPincode = String(pincode).trim();

    const bResult = await db.execute(`
      INSERT INTO businesses (
        name, business_type, currency_symbol, currency_code, tax_rate,
        contact_email, contact_phone, address, city, state, pincode, country
      ) VALUES (?, ?, '₹', 'INR', 18.0, ?, ?, ?, ?, ?, ?, 'India')
    `, [
      cleanBusinessName,
      cleanBusinessType,
      cleanContactEmail,
      cleanContactPhone,
      cleanAddress,
      cleanCity,
      cleanState,
      cleanPincode
    ]);
    const businessId = Number(bResult.lastInsertId);

    // 5. Create Primary Main Store for this Business
    const storeRes = await db.execute(`
      INSERT INTO stores (
        business_id, name, code, contact_email, contact_phone, address, city, state, pincode, is_primary, status
      ) VALUES (?, ?, 'MAIN-01', ?, ?, ?, ?, ?, ?, 1, 'active')
    `, [
      businessId,
      `${cleanBusinessName} (Main Store)`,
      cleanContactEmail,
      cleanContactPhone,
      cleanAddress,
      cleanCity,
      cleanState,
      cleanPincode
    ]);
    const primaryStoreId = Number(storeRes.lastInsertId);

    // 6. Hash Password Securely with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(String(password), 10);

    // 7. Create User Account (email_verified = 1 for instant real access)
    const uResult = await db.execute(`
      INSERT INTO users (
        business_id, store_id, name, email, phone, password_hash, role, email_verified, terms_accepted_at, terms_version
      ) VALUES (?, ?, ?, ?, ?, ?, 'owner', 1, CURRENT_TIMESTAMP, '1.0')
    `, [
      businessId,
      primaryStoreId,
      String(name).trim(),
      cleanEmail,
      String(phone).trim(),
      passwordHash
    ]);
    const userId = Number(uResult.lastInsertId);

    // 8. Provision standard expense categories for new business
    await ensureDefaultExpenseCategoriesForBusiness(businessId);

    // 9. Record Terms & Audit Log
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || null;
    await db.execute(`
      INSERT INTO terms_acceptances (user_id, business_id, terms_version, ip_address, user_agent)
      VALUES (?, ?, '1.0', ?, ?)
    `, [userId, businessId, ip, req.headers['user-agent'] || null]);

    await auditService.log({
      businessId,
      storeId: primaryStoreId,
      userId,
      action: 'SHOP_REGISTERED',
      entityType: 'business',
      entityId: businessId,
      details: { email: cleanEmail, businessName: cleanBusinessName, businessType: cleanBusinessType }
    });

    // 10. Generate JWT Session Token (30 Days)
    const sessionToken = jwt.sign(
      { id: userId, email: cleanEmail, business_id: businessId, role: 'owner', store_id: primaryStoreId },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    setSessionCookie(res, sessionToken, 30);

    const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [businessId]);
    const stores = await db.query('SELECT * FROM stores WHERE business_id = ? ORDER BY is_primary DESC', [businessId]);

    // Note: Newly registered businesses start 100% CLEAN without any demo data!
    res.status(201).json({
      success: true,
      message: `Welcome to Bussinex! ${cleanBusinessName} has been registered successfully.`,
      token: sessionToken,
      user: {
        id: userId,
        name: String(name).trim(),
        email: cleanEmail,
        phone: String(phone).trim(),
        role: 'owner',
        business_id: businessId,
        store_id: primaryStoreId,
        email_verified: true
      },
      business: business || {
        id: businessId,
        name: cleanBusinessName,
        business_type: cleanBusinessType,
        currency_symbol: '₹',
        currency_code: 'INR',
        tax_rate: 18.0,
        address: cleanAddress,
        city: cleanCity,
        state: cleanState,
        pincode: cleanPincode,
        contact_email: cleanContactEmail,
        contact_phone: cleanContactPhone
      },
      stores: stores || []
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Unable to complete shop registration. Please try again.' });
  }
});

// POST /api/auth/login — Real User Authentication with Email & Password
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe = true } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: 'Please enter your email address.' });
    }

    if (!password || !String(password).trim()) {
      return res.status(400).json({ error: 'Please enter your password.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await db.queryOne('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password. Please verify your credentials.' });
    }

    const validPassword = await bcrypt.compare(String(password), user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password. Please verify your credentials.' });
    }

    const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [user.business_id]);
    const stores = await db.query('SELECT * FROM stores WHERE business_id = ? ORDER BY is_primary DESC', [user.business_id]);

    const expiresIn = rememberMe ? '30d' : '24h';
    const cookieDays = rememberMe ? 30 : 1;

    const token = jwt.sign(
      { id: user.id, email: user.email, business_id: user.business_id, role: user.role, store_id: user.store_id },
      JWT_SECRET,
      { expiresIn }
    );

    setSessionCookie(res, token, cookieDays);

    await auditService.log({
      businessId: user.business_id,
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        business_id: user.business_id,
        store_id: user.store_id,
        email_verified: Boolean(user.email_verified)
      },
      business: business || { id: user.business_id, name: 'Bussinex Enterprise' },
      stores: stores || [],
      is_demo: user.business_id === 1 && user.role === 'demo'
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Unable to sign in. Please try again.' });
  }
});

// POST /api/auth/demo-login — Dedicated Demo Mode Login (Apex Enterprises Demo Store)
router.post('/demo-login', async (req: Request, res: Response) => {
  try {
    // Ensure default demo enterprise exists
    await ensureDefaultUserAndBusiness();

    const demoBiz = await db.queryOne('SELECT * FROM businesses WHERE id = 1') ||
      await db.queryOne('SELECT * FROM businesses ORDER BY id ASC LIMIT 1');

    if (!demoBiz) {
      return res.status(500).json({ error: 'Demo store is currently unavailable.' });
    }

    let demoUser = await db.queryOne('SELECT * FROM users WHERE email = ?', ['admin@bussinex.com']) ||
      await db.queryOne('SELECT * FROM users WHERE business_id = ? LIMIT 1', [demoBiz.id]);

    if (!demoUser) {
      return res.status(500).json({ error: 'Demo administrator account could not be found.' });
    }

    const stores = await db.query('SELECT * FROM stores WHERE business_id = ? ORDER BY is_primary DESC', [demoBiz.id]);

    const token = jwt.sign(
      { id: demoUser.id, email: demoUser.email, business_id: demoBiz.id, role: 'demo', store_id: demoUser.store_id, is_demo: true },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    setSessionCookie(res, token, 7);

    res.json({
      success: true,
      token,
      user: {
        id: demoUser.id,
        name: 'Demo Explorer (Apex)',
        email: demoUser.email,
        role: 'demo',
        business_id: demoBiz.id,
        store_id: demoUser.store_id,
        email_verified: true,
        is_demo: true
      },
      business: demoBiz,
      stores: stores || [],
      is_demo: true
    });
  } catch (error: any) {
    console.error('Demo login error:', error);
    res.status(500).json({ error: 'Unable to launch demo store. Please try again.' });
  }
});

// POST /api/auth/forgot-password — Request Password Reset
router.post('/forgot-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const result = await emailService.generatePasswordReset(cleanEmail);

    res.json({
      success: true,
      message: 'If an account exists with this email address, a password reset code has been sent.',
      resetOtp: result.otp
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

// POST /api/auth/reset-password — Reset Password with Verified Token/OTP
router.post('/reset-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (!cleanEmail || !cleanCode || !newPassword) {
      return res.status(400).json({ error: 'Email, reset code, and new password are required.' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const verification = await emailService.verifyPasswordResetToken(cleanEmail, cleanCode);
    if (!verification.success || !verification.userId) {
      return res.status(400).json({ error: verification.error || 'Invalid or expired password reset code.' });
    }

    const newHash = await bcrypt.hash(String(newPassword), 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, verification.userId]);
    await emailService.markPasswordResetUsed(verification.userId);

    const user = await db.queryOne('SELECT business_id FROM users WHERE id = ?', [verification.userId]);

    await auditService.log({
      businessId: user?.business_id || 1,
      userId: verification.userId,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: verification.userId
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new credentials.'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Unable to reset password. Please try again.' });
  }
});

// POST /api/auth/logout — Invalidate Session Cookie
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('bussinex_token', { path: '/' });
  res.json({ success: true, message: 'Successfully logged out.' });
});

// GET /api/auth/me — Verified Profile & Active Stores
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.queryOne(
      'SELECT id, business_id, store_id, name, email, phone, role, email_verified, terms_accepted_at, created_at FROM users WHERE id = ?',
      [req.user!.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [user.business_id]);
    const stores = await db.query('SELECT * FROM stores WHERE business_id = ? ORDER BY is_primary DESC', [user.business_id]);

    res.json({
      user: {
        ...user,
        email_verified: Boolean(user.email_verified),
        is_demo: req.user!.role === 'demo' || user.business_id === 1 && req.user!.role === 'demo'
      },
      business: business || { id: user.business_id, name: 'Bussinex Enterprise' },
      stores: stores || [],
      is_demo: req.user!.role === 'demo' || user.business_id === 1 && req.user!.role === 'demo'
    });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Unable to fetch user profile.' });
  }
});

export default router;
