import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { withDbNoRLS } from '../db.js';
import { autoEnroll } from '../utils/autoEnroll.js';
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

function buildCasServiceUrl(): string {
  const backendUrl = (process.env.BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');
  return `${backendUrl}/auth/cas/callback`;
}

function getCasBaseUrl(): string {
  return (process.env.CAS_BASE_URL || 'https://login.uconn.edu/cas').replace(/\/$/, '');
}

function extractCasValue(xml: string, tags: string[]): string | null {
  for (const tag of tags) {
    const escaped = tag.replace(':', '\\:');
    const re = new RegExp(`<${escaped}>([^<]+)</${escaped}>`, 'i');
    const match = xml.match(re);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function parseCasProfile(xml: string): { netid: string | null; name: string | null; email: string | null } {
  const netid = extractCasValue(xml, ['cas:user', 'user']);
  const name = extractCasValue(xml, ['cas:displayName', 'cas:cn', 'cas:name', 'cas:givenName']);
  const email = extractCasValue(xml, ['cas:mail', 'cas:email', 'mail', 'email']);
  return { netid, name, email };
}

async function findOrCreateCasUser(
  netidRaw: string,
  casName: string | null,
  casEmail: string | null
): Promise<any> {
  const netid = netidRaw.trim();
  const email = casEmail?.trim() || `${netid}@uconn.edu`;
  const displayName = casName?.trim() || netid;

  return withDbNoRLS(async (client) => {
    // Try to find existing user by netid or email
    const findResult = await client.query(
      `SELECT user_id, email, name, role, netid FROM users WHERE netid = $1 OR email = $2 LIMIT 1`,
      [netid, email]
    );

    if (findResult.rows.length > 0) {
      const existing = findResult.rows[0];
      // Update netid if not already set
      if (!existing.netid) {
        await client.query(
          `UPDATE users SET netid = $1 WHERE user_id = $2`,
          [netid, existing.user_id]
        );
        existing.netid = netid;
      }
      return existing;
    }

    // Create new user
    const insertResult = await client.query(
      `INSERT INTO users (email, password_hash, name, role, netid)
       VALUES ($1, 'cas-nologin', $2, 'student', $3)
       RETURNING user_id, email, name, role, netid`,
      [email, displayName, netid]
    );
    return insertResult.rows[0];
  });
}

/**
 * POST /auth/register
 * Register a new user with name, email, password, and optional role.
 */
export async function register(req: Request, res: Response): Promise<void> {
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
      const existing = await client.query('SELECT user_id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        throw { status: 400, message: 'Email already registered' };
      }

      const result = await client.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING user_id, email, name, role, netid`,
        [email, passwordHash, name, userRole]
      );
      return result.rows[0];
    });

    // Auto-enroll if this user has a netid set
    if (user.netid) {
      await autoEnroll(user.user_id, user.netid.slice(0, 3));
    }

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: { id: user.user_id, name: user.name, email: user.email, role: user.role, netid: user.netid ?? null },
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
 * Authenticate user with email/netid and password.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'validation', message: 'Email and password are required' });
      return;
    }

    const user = await withDbNoRLS(async (client) => {
      // Support login by email or netid
      const r = await client.query(
        `SELECT user_id, email, name, role, netid, password_hash FROM users
         WHERE email = $1 OR netid = $1 LIMIT 1`,
        [email]
      );
      return r.rows[0] || null;
    });

    if (!user) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid credentials' });
      return;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid credentials' });
      return;
    }

    // Auto-enroll if user has a netid
    if (user.netid) {
      await autoEnroll(user.user_id, user.netid.slice(0, 3));
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.user_id, name: user.name, email: user.email, role: user.role, netid: user.netid ?? null },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Login failed' });
  }
}

/**
 * GET /auth/cas/login
 * Redirect to UConn CAS login.
 */
export async function casLogin(_req: Request, res: Response): Promise<void> {
  const service = buildCasServiceUrl();
  const casLoginUrl = `${getCasBaseUrl()}/login?service=${encodeURIComponent(service)}`;
  res.redirect(casLoginUrl);
}

/**
 * GET /auth/cas/callback
 * Validate CAS ticket, find/create user, trigger auto-enroll, redirect to frontend.
 */
export async function casCallback(req: Request, res: Response): Promise<void> {
  try {
    const ticket = String(req.query.ticket || '');
    if (!ticket) {
      res.status(400).json({ error: 'validation', message: 'Missing CAS ticket' });
      return;
    }

    const service = buildCasServiceUrl();
    const validateUrl = `${getCasBaseUrl()}/serviceValidate?service=${encodeURIComponent(service)}&ticket=${encodeURIComponent(ticket)}`;
    const response = await fetch(validateUrl);
    const xml = await response.text();
    const { netid, name, email } = parseCasProfile(xml);

    if (!response.ok || !netid) {
      res.status(401).json({ error: 'unauthorized', message: 'CAS validation failed' });
      return;
    }

    const user = await findOrCreateCasUser(netid, name, email);

    // Auto-enroll using 3-char prefix
    await autoEnroll(user.user_id, netid.slice(0, 3));

    const token = generateToken(user);
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const redirectUrl = `${frontend}/login?token=${encodeURIComponent(token)}&id=${encodeURIComponent(user.user_id)}&name=${encodeURIComponent(user.name || name || netid)}&email=${encodeURIComponent(user.email || email || `${netid}@uconn.edu`)}&role=${encodeURIComponent(user.role || 'student')}&netid=${encodeURIComponent(netid)}`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('CAS callback error:', err);
    res.status(500).json({ error: 'internal_error', message: 'CAS login failed' });
  }
}

/**
 * GET /auth/me
 * Return current user info plus their enrolled courses.
 */
export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;

    const courses = await withDbNoRLS(async (client) => {
      if (role === 'instructor' || role === 'admin') {
        const r = await client.query(
          `SELECT course_id, name, term, created_at FROM courses WHERE instructor_user_id = $1 ORDER BY created_at DESC`,
          [user_id]
        );
        return r.rows;
      } else {
        const r = await client.query(
          `SELECT c.course_id, c.name, c.term, c.created_at
           FROM courses c
           JOIN course_members cm ON cm.course_id = c.course_id
           WHERE cm.user_id = $1
           ORDER BY c.created_at DESC`,
          [user_id]
        );
        return r.rows;
      }
    });

    res.json({
      user_id: req.user.user_id,
      name: req.user.name,
      email: req.user.email,
      netid: req.user.netid,
      role: req.user.role,
      courses,
    });
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch user info' });
  }
}
