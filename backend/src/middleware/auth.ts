import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { getUsersTableSchema, makeUserSelectClause } from '../utils/userSchema.js';
import type { AuthRequest, AuthUser } from '../types.js';

/**
 * JWT authentication middleware.
 * Verifies the Bearer token and attaches user info to req.user.
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized', message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
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
      const schema = await getUsersTableSchema(client);
      const selectClause = makeUserSelectClause(schema);
      result = await client.query(
        `SELECT ${selectClause} FROM users WHERE user_id = $1`,
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
