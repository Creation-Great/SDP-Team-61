/**
 * Redis client singleton with cache helpers.
 *
 * When REDIS_URL is configured the module exports a live ioredis client;
 * otherwise all helpers degrade gracefully (cache misses, no-ops).
 */
import { logger } from './logger.js';

// ioredis has tricky ESM/CJS interop — use dynamic import at init time
let client: any = null;
let connectionFailed = false;

/** Return the shared Redis client, or null if unavailable. */
export function getRedis(): any {
  if (client) return client;
  if (connectionFailed) return null;

  // Lazy init — actual connection happens on first call
  return null;
}

let initPromise: Promise<void> | null = null;

/** Initialise Redis connection (call once at startup). */
export async function initRedis(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const url = process.env.REDIS_URL;
    if (!url) {
      logger.info('REDIS_URL not set — running without Redis');
      connectionFailed = true;
      return;
    }

    try {
      const mod = await import('ioredis');
      const IORedis = (mod as any).default || mod;
      client = new IORedis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 5) {
            logger.warn('Redis: giving up after 5 reconnection attempts');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: false,
      });

      client.on('error', (err: Error) => {
        logger.warn({ err: err.message }, 'Redis connection error');
      });

      client.on('connect', () => {
        logger.info('Redis connected');
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to create Redis client');
      connectionFailed = true;
    }
  })();
  return initPromise;
}

/** Get a cached JSON value.  Returns `null` on miss or Redis unavailable. */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  if (!client) return null;
  try {
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Store a JSON value with a TTL (seconds). */
export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  if (!client) return;
  try {
    await client.setex(key, ttlSec, JSON.stringify(value));
  } catch {
    // non-fatal
  }
}

/** Delete keys matching a pattern (e.g. `notif:count:*`). */
export async function cacheInvalidate(pattern: string): Promise<void> {
  if (!client) return;
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // non-fatal
  }
}

/** Delete a single key. */
export async function cacheDel(key: string): Promise<void> {
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    // non-fatal
  }
}

/** Gracefully close the Redis connection (for tests / shutdown). */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => {});
    client = null;
  }
}
