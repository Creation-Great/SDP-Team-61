/**
 * Cookie helpers for JWT token storage.
 *
 * Using httpOnly cookies instead of localStorage prevents XSS attacks
 * from stealing the JWT — JavaScript cannot read httpOnly cookies.
 *
 * Security flags:
 *   httpOnly  — not accessible via document.cookie
 *   secure    — sent only over HTTPS (production)
 *   sameSite  — "lax" blocks CSRF for POST/PUT/DELETE while allowing
 *               top-level GET navigations (needed for CAS redirect back)
 *   path      — "/" so all API routes receive the cookie
 *   maxAge    — 30 days, matching the JWT expiry
 */

import type { Response, CookieOptions } from 'express';

const COOKIE_NAME = 'token';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function baseCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  };
}

/** Set the JWT as an httpOnly cookie on the response. */
export function setTokenCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: THIRTY_DAYS_MS,
  });
}

/** Clear the JWT cookie. */
export function clearTokenCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, baseCookieOptions());
}

/**
 * Extract the JWT from the raw Cookie header string.
 * This avoids adding cookie-parser as a dependency — we only need
 * to read one specific cookie name.
 */
export function getTokenFromCookieHeader(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}
