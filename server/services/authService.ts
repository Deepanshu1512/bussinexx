import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.ts';
import { emailService } from './emailService.ts';
import { auditService } from './auditService.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'bussinex_jwt_secret_key_prod_2026';
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  businessName?: string;
  phone?: string;
  terms_accepted?: boolean;
  terms_version?: string;
  ip_address?: string;
  user_agent?: string;
}

export const authService = {
  async register(data: RegisterInput) {
    if (!data.name || !data.email || !data.password) {
      throw new Error('Name, email, and password are required fields.');
    }

    const cleanEmail = data.email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      throw new Error('Please enter a valid, deliverable email address.');
    }

    if (data.password.length < 8) {
      throw new Error('Password must contain at least 8 characters.');
    }

    if (!data.terms_accepted) {
      throw new Error('You must agree to the Terms and Conditions to register your shop account.');
    }

    const existingUser = await db.queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingUser) {
      throw new Error('An account with this email address already exists. Please sign in or reset your password.');
    }

    // Create Business Entity with Indian Defaults
    const bName = data.businessName ? data.businessName.trim() : `${data.name.trim()}'s Enterprise`;
    const bResult = await db.execute(`
      INSERT INTO businesses (
        name, currency_symbol, currency_code, tax_rate, contact_email, contact_phone, country
      ) VALUES (?, '₹', 'INR', 18.0, ?, ?, 'India')
    `, [
      bName,
      cleanEmail,
      data.phone ? data.phone.trim() : null
    ]);
    const businessId = Number(bResult.lastInsertId);

    // Create Primary Store Automatically
    const storeRes = await db.execute(`
      INSERT INTO stores (
        business_id, name, code, contact_email, contact_phone, is_primary, status
      ) VALUES (?, ?, 'STR-01', ?, ?, 1, 'active')
    `, [
      businessId,
      `${bName} (Main Store)`,
      cleanEmail,
      data.phone ? data.phone.trim() : null
    ]);
    const primaryStoreId = Number(storeRes.lastInsertId);

    // Hash Password Securely with bcrypt
    const passwordHash = await bcrypt.hash(data.password, 10);
    const termsVer = data.terms_version || '2026.1';

    // Create User (unverified email by default)
    const uResult = await db.execute(`
      INSERT INTO users (
        business_id, store_id, name, email, phone, password_hash, role, email_verified, terms_accepted_at, terms_version
      ) VALUES (?, ?, ?, ?, ?, ?, 'admin', 0, CURRENT_TIMESTAMP, ?)
    `, [
      businessId,
      primaryStoreId,
      data.name.trim(),
      cleanEmail,
      data.phone ? data.phone.trim() : null,
      passwordHash,
      termsVer
    ]);
    const userId = Number(uResult.lastInsertId);

    // Record Terms Acceptance Audit
    await db.execute(`
      INSERT INTO terms_acceptances (user_id, business_id, terms_version, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `, [
      userId, 
      businessId, 
      termsVer, 
      data.ip_address || null, 
      data.user_agent || null
    ]);

    // Generate & Dispatch Email Verification OTP
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

    const token = jwt.sign(
      { id: userId, email: cleanEmail, business_id: businessId, role: 'admin', store_id: primaryStoreId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: userId,
        name: data.name.trim(),
        email: cleanEmail,
        role: 'admin',
        business_id: businessId,
        email_verified: 0,
        store_id: primaryStoreId
      },
      business: {
        id: businessId,
        name: bName,
        currency_symbol: '₹',
        currency_code: 'INR',
        tax_rate: 18.0
      },
      verificationToken: verification.token,
      verificationOtp: verification.otp
    };
  },

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.queryOne('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new Error('Invalid email or password.');
    }

    const business = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [user.business_id]);
    const stores = await db.query('SELECT * FROM stores WHERE business_id = ? ORDER BY is_primary DESC', [user.business_id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, business_id: user.business_id, role: user.role, store_id: user.store_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        business_id: user.business_id,
        store_id: user.store_id,
        email_verified: user.email_verified === 1
      },
      business: business || { id: user.business_id, name: 'Bussinex Enterprise' },
      stores: stores || [],
      email_verified: user.email_verified === 1
    };
  }
};
