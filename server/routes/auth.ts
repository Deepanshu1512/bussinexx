import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.ts';
import { emailService } from '../services/emailService.ts';
import { auditService } from '../services/auditService.ts';
import { 
  loginRateLimiter, 
  registerRateLimiter, 
  otpRateLimiter, 
  passwordResetRateLimiter 
} from '../middleware/rateLimiter.ts';
import { AuthRequest, authenticateToken } from '../middleware/auth.ts';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bussinex_jwt_secret_key_prod_2026';
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Sets secure HTTP-only session cookie
 */
function setSessionCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  res.cookie('bussinex_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  });
}

// POST /api/auth/register — Shop Registration with Real Email Verification
router.post('/register', registerRateLimiter, async (req: Request, res: Response) => {
  try {
    const { name, email, password, businessName, phone, agreeTerms, terms_accepted, terms_version } = req.body;
    const acceptedTerms = Boolean(agreeTerms || terms_accepted);

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required fields.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Validate email syntax strictly
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid, deliverable email address.' });
    }

    // 2. Validate password strength
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must contain at least 8 characters.' });
    }

    // 3. Terms & Conditions acceptance verification
    if (!acceptedTerms) {
      return res.status(400).json({ error: 'You must agree to the Terms and Conditions to register your shop account.' });
    }

    // 4. Prevent duplicate accounts
    const existingUser = await db.queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please sign in or reset your password.' });
    }

    // 5. Create Business Entity with Indian Defaults
    const bName = businessName ? String(businessName).trim() : `${String(name).trim()}'s Enterprise`;
    const bResult = await db.execute(`
      INSERT INTO businesses (
        name, currency_symbol, currency_code, tax_rate, contact_email, contact_phone, country
      ) VALUES (?, '₹', 'INR', 18.0, ?, ?, 'India')
    `, [
      bName,
      cleanEmail,
      phone ? String(phone).trim() : null
    ]);
    const businessId = Number(bResult.lastInsertId);

    // 6. Create Primary Store Automatically
    const storeRes = await db.execute(`
      INSERT INTO stores (
        business_id, name, code, contact_email, contact_phone, is_primary, status
      ) VALUES (?, ?, 'STR-01', ?, ?, 1, 'active')
    `, [
      businessId,
      `${bName} (Main Store)`,
      cleanEmail,
      phone ? String(phone).trim() : null
    ]);
    const primaryStoreId = Number(storeRes.lastInsertId);

    // 7. Hash Password Securely with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(String(password), 10);

    // 8. Create User (Unverified email by default)
    const uResult = await db.execute(`
      INSERT INTO users (
        business_id, store_id, name, email, phone, password_hash, role, email_verified, terms_accepted_at, terms_version
      ) VALUES (?, ?, ?, ?, ?, ?, 'admin', 0, CURRENT_TIMESTAMP, '1.0')
    `, [
      businessId,
      primaryStoreId,
      String(name).trim(),
      cleanEmail,
      phone ? String(phone).trim() : null,
      passwordHash
    ]);
    const userId = Number(uResult.lastInsertId);

    // 9. Record Terms & Conditions Acceptance Audit
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || null;
    await db.execute(`
      INSERT INTO terms_acceptances (user_id, business_id, terms_version, ip_address, user_agent)
      VALUES (?, ?, '1.0', ?, ?)
    `, [userId, businessId, ip, req.headers['user-agent'] || null]);

    // 10. Generate & Dispatch Email Verification OTP
    const verification = await emailService.generateVerification(userId, cleanEmail);

    await auditService.log({
      businessId,
      storeId: primaryStoreId,
      userId,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: userId,
      details: { email: cleanEmail, businessName: bName }
    });

    // Note: Newly registered businesses start 100% CLEAN without any demo data!
    res.status(201).json({
      success: true,
      requiresVerification: true,
      email: cleanEmail,
      message: 'Account created! A 6-digit verification code has been dispatched to your email.',
      verificationToken: verification.token,
      verificationOtp: verification.otp
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Unable to complete registration. Please try again.' });
  }
});

// POST /api/auth/verify-email — Verify OTP / Activation Link
router.post('/verify-email', otpRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, code, token } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const verificationKey = String(code || token || '').trim();

    if (!cleanEmail || !verificationKey) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const verificationResult = await emailService.verifyEmail(cleanEmail, verificationKey);
    if (!verificationResult.success || !verificationResult.user) {
      return res.status(400).json({ error: verificationResult.error || 'Invalid or expired verification code.' });
    }

    const user = verificationResult.user;
    const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [user.business_id]);
    const stores = await db.query('SELECT * FROM stores WHERE business_id = ? ORDER BY is_primary DESC', [user.business_id]);

    const sessionToken = jwt.sign(
      { id: user.id, email: user.email, business_id: user.business_id, role: user.role, store_id: user.store_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    setSessionCookie(res, sessionToken);

    await auditService.log({
      businessId: user.business_id,
      userId: user.id,
      action: 'EMAIL_VERIFIED',
      entityType: 'user',
      entityId: user.id,
      details: { email: cleanEmail }
    });

    res.json({
      success: true,
      message: 'Email verified successfully! Welcome to your Bussinex workspace.',
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        business_id: user.business_id,
        email_verified: true
      },
      business: business || { id: user.business_id, name: 'Bussinex Enterprise' },
      stores: stores || []
    });
  } catch (error: any) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/resend-verification — Resend Verification OTP
router.post('/resend-verification', otpRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const user = await db.queryOne('SELECT id, email_verified FROM users WHERE email = ?', [cleanEmail]);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'This email address is already verified. Please sign in.' });
    }

    const verification = await emailService.generateVerification(user.id, cleanEmail);

    res.json({
      success: true,
      message: 'A fresh 6-digit verification code has been dispatched to your email.',
      verificationToken: verification.token,
      verificationOtp: verification.otp
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Unable to resend verification code. Please try again.' });
  }
});

// POST /api/auth/login — Secure Authentication with Rate Limiting & Verification Check
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
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

    // Require email verification before shop becomes active
    if (!user.email_verified) {
      const verification = await emailService.generateVerification(user.id, cleanEmail);
      return res.status(403).json({
        error: 'Your shop email has not been verified. Please enter the 6-digit verification code sent to your email.',
        requiresVerification: true,
        email: cleanEmail,
        verificationToken: verification.token,
        verificationOtp: verification.otp
      });
    }

    const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [user.business_id]);
    const stores = await db.query('SELECT * FROM stores WHERE business_id = ? ORDER BY is_primary DESC', [user.business_id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, business_id: user.business_id, role: user.role, store_id: user.store_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    setSessionCookie(res, token);

    await auditService.log({
      businessId: user.business_id,
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        business_id: user.business_id,
        email_verified: Boolean(user.email_verified),
        store_id: user.store_id
      },
      business: business || { id: user.business_id, name: 'Bussinex Enterprise' },
      stores: stores || []
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Unable to sign in. Please try again.' });
  }
});

// POST /api/auth/forgot-password — Request Password Reset OTP
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

// POST /api/auth/reset-password — Reset Password with Verified OTP
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
        email_verified: Boolean(user.email_verified)
      },
      business: business || { id: user.business_id, name: 'Bussinex Enterprise' },
      stores: stores || []
    });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Unable to fetch user profile.' });
  }
});

export default router;
