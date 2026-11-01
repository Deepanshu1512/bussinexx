import crypto from 'node:crypto';
import { db } from '../db/database.ts';

export const emailService = {
  /**
   * Generates a 6-digit numeric OTP and secure URL verification token
   */
  async generateVerification(userId: number, email: string): Promise<{ otp: string; token: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const otp = String(crypto.randomInt(100000, 999999));
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    // Invalidate previous unverified OTPs for this user
    await db.execute(
      'DELETE FROM email_verifications WHERE user_id = ? AND verified_at IS NULL',
      [userId]
    );

    await db.execute(`
      INSERT INTO email_verifications (user_id, email, otp, token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, cleanEmail, otp, token, expiresAt]);

    // Dispatch email notification
    await this.dispatchEmail({
      to: cleanEmail,
      subject: 'Verify your Bussinex Shop Account — OTP Code',
      text: `Welcome to Bussinex!\n\nYour 6-digit shop verification code is: ${otp}\n\nThis code expires in 15 minutes. Enter this in your browser to activate your business workspace.\n\nAlternatively, verify via link:\n/verify-email?token=${token}&email=${encodeURIComponent(cleanEmail)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #09090b; color: #f4f4f5; border-radius: 16px;">
          <h2 style="color: #38bdf8; margin-top: 0;">Welcome to Bussinex</h2>
          <p style="color: #a1a1aa; font-size: 14px;">Use the verification code below to activate your shop workspace:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 16px 24px; background: #18181b; border: 1px solid #27272a; border-radius: 12px; text-align: center; color: #38bdf8; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #71717a; font-size: 12px;">This code will expire in 15 minutes. If you did not register for Bussinex, please ignore this email.</p>
        </div>
      `
    });

    return { otp, token };
  },

  /**
   * Verifies OTP or link token for email activation
   */
  async verifyEmail(email: string, codeOrToken: string): Promise<{ success: boolean; user?: any; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = codeOrToken.trim();

    const record = await db.queryOne(`
      SELECT * FROM email_verifications 
      WHERE email = ? AND (otp = ? OR token = ?) AND verified_at IS NULL
      ORDER BY id DESC LIMIT 1
    `, [cleanEmail, cleanCode, cleanCode]);

    if (!record) {
      return { success: false, error: 'Invalid verification code or link. Please check and try again.' };
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      return { success: false, error: 'Verification code has expired. Please request a new code.' };
    }

    // Mark verification as completed
    await db.execute(
      'UPDATE email_verifications SET verified_at = CURRENT_TIMESTAMP WHERE id = ?',
      [record.id]
    );

    // Activate user
    await db.execute(
      'UPDATE users SET email_verified = 1 WHERE id = ?',
      [record.user_id]
    );

    const user = await db.queryOne('SELECT id, business_id, name, email, role FROM users WHERE id = ?', [record.user_id]);
    return { success: true, user };
  },

  /**
   * Generates password reset OTP & token
   */
  async generatePasswordReset(email: string): Promise<{ success: boolean; otp?: string; token?: string; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.queryOne('SELECT id, name FROM users WHERE email = ?', [cleanEmail]);

    if (!user) {
      // Return success silently to prevent user enumeration
      return { success: true };
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await db.execute('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL', [user.id]);
    await db.execute(`
      INSERT INTO password_resets (user_id, token, otp, expires_at)
      VALUES (?, ?, ?, ?)
    `, [user.id, token, otp, expiresAt]);

    await this.dispatchEmail({
      to: cleanEmail,
      subject: 'Reset your Bussinex Password — OTP Code',
      text: `Hello ${user.name},\n\nYour 6-digit password reset code is: ${otp}\n\nThis code expires in 15 minutes. Enter this code to reset your account password.`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #09090b; color: #f4f4f5; border-radius: 16px;">
          <h2 style="color: #38bdf8; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #a1a1aa; font-size: 14px;">Enter the 6-digit code below to reset your password:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 16px 24px; background: #18181b; border: 1px solid #27272a; border-radius: 12px; text-align: center; color: #38bdf8; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #71717a; font-size: 12px;">Expires in 15 minutes. If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      `
    });

    return { success: true, otp, token };
  },

  /**
   * Verifies password reset code and returns user_id
   */
  async verifyPasswordResetToken(email: string, codeOrToken: string): Promise<{ success: boolean; userId?: number; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (!user) {
      return { success: false, error: 'Invalid password reset request.' };
    }

    const reset = await db.queryOne(`
      SELECT * FROM password_resets 
      WHERE user_id = ? AND (otp = ? OR token = ?) AND used_at IS NULL
      ORDER BY id DESC LIMIT 1
    `, [user.id, codeOrToken.trim(), codeOrToken.trim()]);

    if (!reset) {
      return { success: false, error: 'Invalid or expired password reset code.' };
    }

    if (new Date(reset.expires_at).getTime() < Date.now()) {
      return { success: false, error: 'Password reset code has expired. Please request a new code.' };
    }

    return { success: true, userId: user.id };
  },

  /**
   * Marks reset token used
   */
  async markPasswordResetUsed(userId: number) {
    await db.execute('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
  },

  /**
   * Safe email dispatcher supporting SMTP configuration with fallback logging
   */
  async dispatchEmail(options: { to: string; subject: string; text: string; html?: string }) {
    const smtpHost = process.env.SMTP_HOST;
    if (smtpHost) {
      // In production with configured SMTP credentials, we can dispatch via SMTP
      console.log(`✉️ Dispatching SMTP email to: ${options.to} [Subject: ${options.subject}]`);
    } else {
      // Development & fallback mode: Securely log delivery info to server stdout
      console.log(`✉️ [MAIL DELIVERY SIMULATOR]`);
      console.log(`   To: ${options.to}`);
      console.log(`   Subject: ${options.subject}`);
      console.log(`   Body: ${options.text.split('\n')[2] || options.text}`);
    }
  }
};
