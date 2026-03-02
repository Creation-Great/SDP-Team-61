import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import type { AuthRequest, AuthUser } from '../types.js';

/**
 * JWT authentication middleware.
 * Verifies the Bearer token and attaches user info to req.user.
 * Supports ?token= query param as fallback for SSE EventSource connections.
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token: string | undefined = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : (req.query?.token as string | undefined);

    if (!token) {
      res.status(401).json({ error: 'unauthorized', message: 'No token provided' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'dev-secret';

    const decoded = jwt.verify(token, secret) as {
      user_id: string;
      email?: string;
      role: string;
    };

    // Fetch fresh user data from DB
    const client = await pool.connect();
    let result;
    try {
      result = await client.query(
        `SELECT user_id, email, name, role, netid FROM users WHERE user_id = $1`,
        [decoded.user_id]
      );
    } finally {
      client.release();
    }

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'unauthorized', message: 'User not found' });
      return;
    }

    req.user = result.rows[0] as AuthUser;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'token_expired', message: 'Token has expired' });
      return;
    }
    res.status(401).json({ error: 'unauthorized', message: 'Invalid token' });
  }
}
