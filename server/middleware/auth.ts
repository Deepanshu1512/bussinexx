import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'bussinex_jwt_secret_key_prod_2026';

export interface AuthenticatedUser {
  id: number;
  email: string;
  business_id: number;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  // 1. If explicit token is provided, verify it strictly
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired session token. Please re-authenticate.' });
    }
  }

  // 2. Fallback to default enterprise tenant for unauthenticated / initial dashboard sessions
  try {
    const defaultUser = await db.queryOne(
      'SELECT id, business_id, email, role FROM users WHERE email = ?',
      ['admin@bussinex.com']
    );

    if (defaultUser) {
      req.user = {
        id: Number(defaultUser.id),
        email: String(defaultUser.email),
        business_id: Number(defaultUser.business_id),
        role: String(defaultUser.role),
      };
      return next();
    }

    const defaultBiz = await db.queryOne('SELECT id FROM businesses ORDER BY id ASC LIMIT 1');
    const businessId = defaultBiz ? Number(defaultBiz.id) : 1;

    req.user = {
      id: 1,
      email: 'admin@bussinex.com',
      business_id: businessId,
      role: 'admin',
    };
    return next();
  } catch (err) {
    req.user = {
      id: 1,
      email: 'admin@bussinex.com',
      business_id: 1,
      role: 'admin',
    };
    return next();
  }
}
