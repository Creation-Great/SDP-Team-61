import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { withDbNoRLS } from '../db.js';
import { audit } from '../utils/audit.js';
import { getUsersTableSchema, makeUserSelectClause, resolveIdentifierInput } from '../utils/userSchema.js';
import type { AuthRequest } from '../types.js';

const SALT_ROUNDS = 10;
const DEFAULT_COURSE_ID = process.env.DEFAULT_COURSE_ID || 'CSE4939W';
const DEFAULT_GROUP_ID = process.env.DEFAULT_GROUP_ID || 'G1';

function generateToken(user: { user_id: string; email: string; role: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const expiresIn = (process.env.JWT_EXPIRES_IN || '30d') as SignOptions['expiresIn'];
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    secret,
    { expiresIn }
  );
}

// =====================================================
// CAS (UConn SSO) Authentication
// =====================================================
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

async function findOrCreateCasUser(netidRaw: string, casName: string | null, casEmail: string | null): Promise<any> {
  const netid = netidRaw.trim();
  const email = casEmail?.trim() || `${netid}@uconn.edu`;
  const displayName = casName?.trim() || netid;
  const randomPassword = `cas-${netid}-${Date.now()}`;
  const randomPasswordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

  return withDbNoRLS(async (client) => {
    // Check if user exists by email
    const existing = await client.query(
      'SELECT user_id, email, name, role, course_id, group_id FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    if (existing.rows[0]) return existing.rows[0];

    // Auto-create student account
    const ins = await client.query(
      `INSERT INTO users (email, password_hash, name, role, course_id, group_id)
       VALUES ($1, $2, $3, 'student', $4, $5)
       RETURNING user_id, email, name, role, course_id, group_id`,
      [email, randomPasswordHash, displayName, DEFAULT_COURSE_ID, DEFAULT_GROUP_ID]
    );
    return ins.rows[0];
  });
}

/**
 * GET /auth/cas/login
 * Redirect to UConn CAS login with service callback URL.
 */
export async function casLogin(_req: Request, res: Response): Promise<void> {
  const service = buildCasServiceUrl();
  const casLoginUrl = `${getCasBaseUrl()}/login?service=${encodeURIComponent(service)}`;
  res.redirect(casLoginUrl);
}

/**
 * GET /auth/cas/callback
 * Validate CAS ticket and create/login local user, then redirect to frontend.
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
    const token = generateToken(user);

    const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const redirectUrl = `${frontend}/login?token=${encodeURIComponent(token)}&id=${encodeURIComponent(user.user_id)}&name=${encodeURIComponent(user.name || name || netid)}&email=${encodeURIComponent(user.email || email || `${netid}@uconn.edu`)}&role=${encodeURIComponent(user.role || 'student')}`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('CAS callback error:', err);
    res.status(500).json({ error: 'internal_error', message: 'CAS login failed' });
  }
}

/**
 * POST /auth/register
 * Register a new user with email and password.
 */
export async function register(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, email, password, role, group_id } = req.body;

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
      // Check if email already exists
      const existing = await client.query('SELECT user_id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        throw { status: 400, message: 'Email already registered' };
      }

      const result = await client.query(
        `INSERT INTO users (email, password_hash, name, role, group_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id, email, name, role, group_id, created_at`,
        [email, passwordHash, name, userRole, group_id || null]
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
      const r = await client.query(
        'SELECT user_id, email, name, role, password_hash FROM users WHERE email = $1',
        [email]
      );
      return r.rows[0] || null;
    });

    if (!result) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid credentials' });
      return;
    }

    const match = await bcrypt.compare(password, result.password_hash);
    if (!match) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid credentials' });
      return;
    }

    const token = generateToken(result);

    res.json({
      token,
      user: {
        id: result.user_id,
        name: result.name,
        email: result.email,
        role: result.role,
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
