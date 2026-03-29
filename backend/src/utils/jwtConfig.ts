/**
 * Centralised JWT configuration.
 *
 * - In development the fallback secret "dev-secret" is acceptable.
 * - In production the server refuses to start unless a real
 *   JWT_SECRET environment variable is provided.
 */
import { logger } from './logger.js';

const INSECURE_DEFAULTS = new Set([
  'dev-secret',
  'change-this-to-a-random-secret-in-production',
]);

function resolveJwtSecret(): string {
  const raw = process.env.JWT_SECRET;

  // Production guard: reject insecure or weak secrets
  if (process.env.NODE_ENV === 'production') {
    if (!raw || INSECURE_DEFAULTS.has(raw)) {
      logger.fatal(
        'JWT_SECRET is missing or insecure. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))" ' +
        'Then set it in your production environment variables.'
      );
      process.exit(1);
    }
    // Minimum 64 characters (256 bits) for production security
    if (raw.length < 64) {
      logger.fatal(
        `JWT_SECRET is too short (${raw.length} chars). ` +
        'Production requires at least 64 characters (256 bits). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
      process.exit(1);
    }
    return raw;
  }

  // Development: allow fallback but warn if using default
  if (!raw || INSECURE_DEFAULTS.has(raw)) {
    logger.warn('Using insecure JWT secret — acceptable for local dev only');
  }

  return raw || 'dev-secret';
}

/** Validated JWT secret — safe to use across the application. */
export const JWT_SECRET: string = resolveJwtSecret();

/** Token lifetime, e.g. "30d". */
export const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '30d') as import('jsonwebtoken').SignOptions['expiresIn'];
