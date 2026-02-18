import { Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { withDbNoRLS } from '../db.js';
import { audit } from '../utils/audit.js';
import { getUsersTableSchema, makeUserSelectClause, resolveIdentifierInput } from '../utils/userSchema.js';
import type { AuthRequest } from '../types.js';

const SALT_ROUNDS = 10;

function generateToken(user: { user_id: string; email: string; role: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const expiresIn = (process.env.JWT_EXPIRES_IN || '30d') as SignOptions['expiresIn'];
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    secret,
    { expiresIn }
  );
}

/**
 * POST /auth/register
 * Register a new user with email and password.
 */
export async function register(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'validation', message: 'Name, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'validation', message: 'Password must be at least 6 characters' });
      return;
    }

    const validRoles = ['student', 'instructor'];
    const userRole = validRoles.includes(role) ? role : 'student';

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await withDbNoRLS(async (client) => {
      const schema = await getUsersTableSchema(client);
      if (!schema.hasEmail || !schema.hasPasswordHash || !schema.hasName) {
        throw {
          status: 400,
          message: 'Registration is disabled for legacy DB schema. Use an existing account.',
        };
      }

      // Check if email already exists
      const existing = await client.query('SELECT user_id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        throw { status: 400, message: 'Email already registered' };
      }

      const result = await client.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING user_id, email, name, role, created_at`,
        [email, passwordHash, name, userRole]
      );

      await audit(client, result.rows[0].user_id, 'REGISTER', 'user', result.rows[0].user_id, { email });
      return result.rows[0];
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Registration failed' });
  }
}

/**
 * POST /auth/login
 * Authenticate user with email and password.
 */
export async function login(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'validation', message: 'Email and password are required' });
      return;
    }

    const result = await withDbNoRLS(async (client) => {
      const schema = await getUsersTableSchema(client);
      const selectClause = makeUserSelectClause(schema);
      const { raw, netidGuess } = resolveIdentifierInput(email);

      let query = `SELECT ${selectClause} FROM users`;
      const params: string[] = [];

      if (schema.hasEmail && schema.hasNetid) {
        query += ' WHERE email = $1 OR netid = $2';
        params.push(raw, netidGuess);
      } else if (schema.hasEmail) {
        query += ' WHERE email = $1';
        params.push(raw);
      } else if (schema.hasNetid) {
        query += ' WHERE netid = $1';
        params.push(netidGuess);
      } else {
        return null;
      }

      const r = await client.query(query, params);
      const user = r.rows[0] || null;
      return { user, schema };
    });

    if (!result?.user) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid credentials' });
      return;
    }

    if (result.schema.hasPasswordHash) {
      const match = await bcrypt.compare(password, result.user.password_hash);
      if (!match) {
        res.status(401).json({ error: 'unauthorized', message: 'Invalid credentials' });
        return;
      }
    }

    const token = generateToken(result.user);

    res.json({
      token,
      user: {
        id: result.user.user_id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Login failed' });
  }
}

/**
 * GET /auth/me
 * Get current user's profile.
 */
export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  res.json({
    id: req.user.user_id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    course_id: req.user.course_id,
    group_id: req.user.group_id,
  });
}
