import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import type { AuthRequest, AuthUser } from '../types.js';
import { JWT_SECRET } from '../utils/jwtConfig.js';
import { getTokenFromCookieHeader } from '../utils/cookieHelper.js';
import { isBlacklisted } from '../utils/tokenBlacklist.js';

/**
 * JWT authentication middleware.
 *
 * Token resolution order:
 *   1. httpOnly cookie "token"  (browser sessions — XSS-safe)
 *   2. Authorization: Bearer … header (API clients / scripts)
 *   3. ?token= query param (SSE/EventSource — cannot set headers)
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Try httpOnly cookie first (preferred — immune to XSS)
    let token = getTokenFromCookieHeader(req.headers.cookie);

    // 2. Fallback to Authorization header (for API clients)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    // 3. Fallback to query param (for SSE / EventSource which cannot set headers)
    if (!token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      res.status(401).json({ error: 'unauthorized', message: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      user_id: string;
      email: string;
      role: string;
      jti?: string;
    };

    // Reject blacklisted (logged-out) tokens
    if (decoded.jti && isBlacklisted(decoded.jti)) {
      res.status(401).json({ error: 'token_revoked', message: 'Token has been revoked' });
      return;
    }

    // Fetch fresh user data from DB
    const result = await pool.query(
      'SELECT user_id, email, name, role, course_id, group_id FROM users WHERE user_id = $1',
      [decoded.user_id]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'unauthorized', message: 'User not found' });
      return;
    }

    // Load all enrollments for this user
    const enrollResult = await pool.query(
      `SELECT enrollment_id, course_id, group_id, role, is_primary, enrolled_at
       FROM user_enrollments
       WHERE user_id = $1
       ORDER BY is_primary DESC, enrolled_at ASC`,
      [decoded.user_id]
    );

    req.user = {
      ...result.rows[0],
      enrollments: enrollResult.rows,
    } as AuthUser;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'token_expired', message: 'Token has expired' });
      return;
    }
    res.status(401).json({ error: 'unauthorized', message: 'Invalid token' });
  }
}
