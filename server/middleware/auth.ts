import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'bussinex_jwt_secret_key_prod_2026';

export interface AuthenticatedUser {
  id: number;
  email: string;
  business_id: number;
  store_id?: number | null;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Extracts session token from Authorization Header or HTTP-only cookie
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // Check HTTP-only cookie
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/bussinex_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);

  // 1. If token is provided, verify it strictly
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    }
  }

  // 2. Strict Authentication Requirement: reject unauthenticated access
  return res.status(401).json({ error: 'Authentication required. Please sign in to access your business.' });
}

/**
 * Enforces strict authentication (blocks unauthenticated access)
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required to access this resource.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

/**
 * Role-Based Access Control middleware
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have sufficient permissions to perform this action.' });
    }

    next();
  };
}
