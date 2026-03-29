/**
 * JWT blacklist backed by Redis with in-memory fallback.
 *
 * When Redis is available, revoked tokens are stored with TTL matching
 * the token's remaining lifetime — they auto-expire, no manual purge needed.
 *
 * When Redis is unavailable, falls back to the original in-memory Map
 * with periodic purge (same as before).
 */
import { getRedis } from './redis.js';

interface BlacklistEntry {
  /** Epoch-seconds at which the original JWT expires */
  exp: number;
}

// In-memory fallback store
const memStore = new Map<string, BlacklistEntry>();

const KEY_PREFIX = 'bl:';

/**
 * Add a token to the blacklist.
 * `jti` is the JWT ID, `exp` is the expiry timestamp (seconds since epoch).
 */
export async function blacklistToken(jti: string, exp: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 1);
    try {
      await redis.setex(`${KEY_PREFIX}${jti}`, ttl, '1');
      return;
    } catch {
      // fall through to in-memory
    }
  }
  memStore.set(jti, { exp });
}

/** Returns `true` if the token has been revoked. */
export async function isBlacklisted(jti: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      const val = await redis.exists(`${KEY_PREFIX}${jti}`);
      return val === 1;
    } catch {
      // fall through to in-memory
    }
  }
  return memStore.has(jti);
}

// Purge expired entries from in-memory fallback every 10 minutes
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, entry] of memStore) {
    if (entry.exp <= now) memStore.delete(jti);
  }
}, 10 * 60 * 1000).unref();
