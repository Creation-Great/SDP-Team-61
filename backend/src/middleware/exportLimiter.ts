import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Per-user key extractor. Prefers JWT user_id for authenticated requests; falls back to IP.
 * Duplicated here (rather than imported from app.ts) to avoid circular imports
 * between app.ts and route modules that import this limiter.
 */
function getUserIdFromRequest(req: Request): string {
  try {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) {
      const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
      return `user:${payload.user_id}`;
    }
  } catch { /* fall through to IP */ }
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = JSON.parse(Buffer.from(auth.split(' ')[1].split('.')[1], 'base64').toString());
      return `user:${payload.user_id}`;
    } catch { /* fall through to IP */ }
  }
  return req.ip || 'unknown';
}

/**
 * Export rate limiter: 10 per hour per user.
 *
 * Bulk data exports (grades CSV, GDPR data) are expensive and contain PII.
 * Tight per-user limit prevents scraping while still allowing legitimate use
 * (e.g. a TA who wants to download and reimport a grade sheet a few times).
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: getUserIdFromRequest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Export rate limit exceeded; try again in an hour' },
});
