import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { withDbNoRLS } from '../db.js';
import type { AuthRequest, AuthUser } from '../types.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../utils/jwtConfig.js';
import { setTokenCookie, clearTokenCookie } from '../utils/cookieHelper.js';
import { blacklistToken } from '../utils/tokenBlacklist.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/** Shape of the JWT payload we sign and verify. */
interface JwtPayload {
  user_id: string;
  email: string;
  role: string;
  jti?: string;
  exp?: number;
}

/** Row shape returned from user queries. */
interface UserRow {
  user_id: string;
  email: string;
  name: string;
  role: string;
  course_id?: string;
  group_id?: string;
  password_hash?: string;
}

const SALT_ROUNDS = 10;
const DEFAULT_COURSE_ID = process.env.DEFAULT_COURSE_ID || 'CSE4939W';
const DEFAULT_GROUP_ID = process.env.DEFAULT_GROUP_ID || 'G1';

function generateToken(user: { user_id: string; email: string; role: string }): string {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, jwtid: crypto.randomUUID() }
  );
}

// =====================================================
// CAS (UConn SSO) Authentication
// =====================================================

/** Resolve frontend base URL: prefer the Origin/Referer from the request so
 *  the redirect works from any device (PC localhost, phone LAN IP, etc.).
 *  Falls back to FRONTEND_URL env var, then http://localhost:5173. */
function resolveFrontendBase(req?: Request): string {
  if (req) {
    const origin = req.get('Origin');
    if (origin) return origin.replace(/\/$/, '');
    const referer = req.get('Referer');
    if (referer) {
      try { const u = new URL(referer); return `${u.protocol}//${u.host}`; } catch { /* ignore */ }
    }
  }
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function buildCasServiceUrl(req?: Request): string {
  return `${resolveFrontendBase(req)}/auth/cas/callback`;
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

  // Try full-name attributes first
  let name = extractCasValue(xml, ['cas:displayName', 'cas:cn', 'cas:name']);

  // If no full name, try to build from givenName + sn (surname)
  if (!name) {
    const firstName = extractCasValue(xml, ['cas:givenName', 'cas:firstName', 'givenName']);
    const lastName = extractCasValue(xml, ['cas:sn', 'cas:surname', 'cas:lastName', 'sn']);
    if (firstName && lastName) {
      name = `${firstName} ${lastName}`;
    } else if (firstName) {
      name = firstName;
    } else if (lastName) {
      name = lastName;
    }
  }

  const email = extractCasValue(xml, ['cas:mail', 'cas:email', 'mail', 'email']);
  return { netid, name, email };
}

async function findOrCreateCasUser(netidRaw: string, casName: string | null, casEmail: string | null): Promise<UserRow> {
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

    if (existing.rows[0]) {
      const row = existing.rows[0];
      // If CAS returned a real name and the DB still has netid as name, update it
      if (casName?.trim() && row.name !== casName.trim()) {
        await client.query('UPDATE users SET name = $1 WHERE user_id = $2', [casName.trim(), row.user_id]);
        row.name = casName.trim();
      }
      return row;
    }

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
  const ticket = String(req.query.ticket || '');
  if (!ticket) {
    throw new AppError(400, 'Missing CAS ticket');
  }

  const service = buildCasServiceUrl();
  const validateUrl = `${getCasBaseUrl()}/serviceValidate?service=${encodeURIComponent(service)}&ticket=${encodeURIComponent(ticket)}`;
  const response = await fetch(validateUrl);
  const xml = await response.text();

  const { netid, name, email } = parseCasProfile(xml);
  logger.debug({ netid, hasName: !!name, hasEmail: !!email }, 'CAS profile parsed');

  if (!response.ok || !netid) {
    logger.warn({ action: 'login_failed', reason: 'cas_validation' }, 'CAS validation failed');
    throw new AppError(401, 'CAS validation failed');
  }

  const user = await findOrCreateCasUser(netid, name, email);
  const token = generateToken(user);

  // Set JWT in httpOnly cookie (not in URL) to prevent XSS token theft
  setTokenCookie(res, token);
  const frontend = resolveFrontendBase();
  res.redirect(`${frontend}/login?cas=success`);
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
    enrollments: req.user.enrollments ?? [],
  });
}

/**
 * PATCH /auth/profile
 * Update current user's display name.
 */
export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  const { name } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError(400, 'name is required');
  }

  const trimmedName = name.trim();
  await withDbNoRLS(async (client) => {
    await client.query('UPDATE users SET name = $1 WHERE user_id = $2', [trimmedName, req.user.user_id]);
  });

  res.json({ message: 'Profile updated', name: trimmedName });
}

// =====================================================
// Local email/password auth (development only)
// =====================================================

function isDevMode(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * POST /auth/register
 * Register a new user with email & password.  Dev-only.
 */
export async function register(req: Request, res: Response): Promise<void> {
  if (!isDevMode()) {
    throw new AppError(403, 'Local registration is disabled in production. Use CAS login.');
  }

  const { name, email, password, role, group_id } = req.body;

  const userRole = (role === 'instructor' || role === 'admin') ? role : 'student';
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await withDbNoRLS(async (client) => {
    // Check duplicate
    const dup = await client.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (dup.rows.length > 0) {
      return null; // duplicate
    }

    const ins = await client.query(
      `INSERT INTO users (email, password_hash, name, role, course_id, group_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, email, name, role, course_id, group_id`,
      [email, passwordHash, name, userRole, DEFAULT_COURSE_ID, group_id || DEFAULT_GROUP_ID]
    );
    return ins.rows[0];
  });

  if (!user) {
    throw new AppError(409, 'Email already registered');
  }

  res.status(201).json({ message: 'Registration successful', user_id: user.user_id });
}

/**
 * POST /auth/login
 * Authenticate with email & password.  Dev-only.
 */
export async function login(req: Request, res: Response): Promise<void> {
  if (!isDevMode()) {
    throw new AppError(403, 'Local login is disabled in production. Use CAS login.');
  }

  const { email, password } = req.body;

  const user = await withDbNoRLS(async (client) => {
    const result = await client.query(
      'SELECT user_id, email, password_hash, name, role, course_id, group_id FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  });

  if (!user) {
    logger.warn({ action: 'login_failed' }, 'Invalid credentials (user not found)');
    throw new AppError(401, 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash!);
  if (!valid) {
    logger.warn({ action: 'login_failed', userId: user.user_id }, 'Invalid credentials (wrong password)');
    throw new AppError(401, 'Invalid email or password');
  }

  const token = generateToken(user);

  // Set JWT in httpOnly cookie — never expose token to JavaScript
  setTokenCookie(res, token);

  // Fetch enrollments for the logged-in user
  const enrollments = await withDbNoRLS(async (client) => {
    const r = await client.query(
      `SELECT enrollment_id, course_id, group_id, role, is_primary, enrolled_at
       FROM user_enrollments WHERE user_id = $1 ORDER BY is_primary DESC`,
      [user.user_id]
    );
    return r.rows;
  });

  res.json({
    user: {
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      course_id: user.course_id,
      group_id: user.group_id,
      enrollments,
    },
  });
}

/**
 * POST /auth/logout
 * Blacklist the current JWT and clear the httpOnly cookie.
 */
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  // Try to read the current token so we can blacklist it
  try {
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) {
      const decoded = jwt.verify(match[1], JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
      if (decoded.jti && decoded.exp) {
        await blacklistToken(decoded.jti, decoded.exp);
      }
    }
  } catch { /* token already invalid — nothing to blacklist */ }

  clearTokenCookie(res);
  res.json({ message: 'Logged out' });
}
