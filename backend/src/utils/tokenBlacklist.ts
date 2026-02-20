/**
 * In-memory JWT blacklist.
 *
 * When a user logs out the token's JTI (JWT ID) is added here so the
 * auth middleware can reject it even before it expires.
 *
 * Entries are automatically purged once they pass their original expiry
 * time to prevent unbounded memory growth.
 *
 * NOTE: This is a per-process store.  In a multi-instance / clustered
 * deployment you would replace this with a shared store (e.g. Redis).
 */

interface BlacklistEntry {
  /** Epoch-seconds at which the original JWT expires */
  exp: number;
}

const store = new Map<string, BlacklistEntry>();

/** Add a token to the blacklist.  `jti` is the JWT ID, `exp` is the
 *  expiry timestamp (seconds since epoch) copied from the token payload. */
export function blacklistToken(jti: string, exp: number): void {
  store.set(jti, { exp });
}

/** Returns `true` if the token has been revoked. */
export function isBlacklisted(jti: string): boolean {
  return store.has(jti);
}

// Purge expired entries every 10 minutes
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, entry] of store) {
    if (entry.exp <= now) store.delete(jti);
  }
}, 10 * 60 * 1000).unref();   // .unref() so the timer doesn't keep Node alive
