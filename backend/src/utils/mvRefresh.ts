/**
 * Materialized-view refresh helper.
 *
 * Strategy:
 *  1. Controllers call `scheduleMvRefresh()` after mutating submissions/assignments/reviews.
 *     This is **non-blocking** — the controller response is not delayed.
 *  2. Multiple calls within `DEBOUNCE_MS` are coalesced into one REFRESH.
 *  3. A periodic interval (`PERIODIC_MS`) acts as a safety-net in case a trigger was missed.
 *
 * Why not pg_cron?  It requires the pg_cron extension to be installed on the Postgres
 * server which is not always available (e.g. managed DBaaS free tiers, local dev).
 * Application-level scheduling keeps the project portable.
 */
import { pool } from '../db.js';
import { logger } from './logger.js';

const log = logger.child({ module: 'mv-refresh' });

/** Milliseconds to wait after the last trigger before actually refreshing. */
const DEBOUNCE_MS = parseInt(process.env.MV_DEBOUNCE_MS || '5000', 10);

/** Milliseconds between periodic safety-net refreshes (default 10 min). */
const PERIODIC_MS = parseInt(process.env.MV_PERIODIC_MS || '600000', 10);

let timer: ReturnType<typeof setTimeout> | null = null;
let refreshing = false;
let periodicHandle: ReturnType<typeof setInterval> | null = null;

/** Consecutive failure count for backoff calculation. */
let consecutiveFailures = 0;
const MAX_RETRY_BACKOFF = 3;

/**
 * Actually execute the refresh.  Uses CONCURRENTLY so reads are not blocked.
 * Errors are logged but never propagated — stale MV data is better than a crash.
 * On failure, retries up to MAX_RETRY_BACKOFF times with exponential backoff.
 */
async function doRefresh(): Promise<void> {
  if (refreshing) return;           // skip if already running
  refreshing = true;
  try {
    await pool.query('SELECT refresh_mv_instructor_cohort()');
    if (consecutiveFailures > 0) {
      log.info({ previousFailures: consecutiveFailures }, 'mv_instructor_cohort refreshed (recovered)');
    } else {
      log.info('mv_instructor_cohort refreshed');
    }
    consecutiveFailures = 0;
  } catch (err) {
    consecutiveFailures++;
    log.warn({ err, consecutiveFailures }, 'Refresh failed (non-fatal)');

    // Schedule a retry with exponential backoff if under limit
    if (consecutiveFailures <= MAX_RETRY_BACKOFF) {
      const backoffMs = DEBOUNCE_MS * Math.pow(2, consecutiveFailures);
      log.info({ retryIn: backoffMs, attempt: consecutiveFailures }, 'Scheduling MV refresh retry');
      setTimeout(() => void doRefresh(), backoffMs);
    }
  } finally {
    refreshing = false;
  }
}

/**
 * Schedule a debounced, non-blocking MV refresh.
 * Call this after any INSERT/UPDATE on submissions, assignments, or reviews.
 */
export function scheduleMvRefresh(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void doRefresh();
  }, DEBOUNCE_MS);
}

/**
 * Start the periodic safety-net interval.
 * Call once at server startup; returns a cleanup function for graceful shutdown.
 */
export function startPeriodicRefresh(): () => void {
  // Immediate first refresh on startup
  void doRefresh();
  periodicHandle = setInterval(() => void doRefresh(), PERIODIC_MS);
  log.info({ intervalSec: PERIODIC_MS / 1000 }, 'Periodic MV refresh started');

  return () => {
    if (periodicHandle) {
      clearInterval(periodicHandle);
      periodicHandle = null;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
