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

/**
 * Actually execute the refresh.  Uses CONCURRENTLY so reads are not blocked.
 * Errors are logged but never propagated — stale MV data is better than a crash.
 */
async function doRefresh(): Promise<void> {
  if (refreshing) return;           // skip if already running
  refreshing = true;
  try {
    await pool.query('SELECT refresh_mv_instructor_cohort()');
    log.info('mv_instructor_cohort refreshed');
  } catch (err) {
    // The MV or function may not exist yet (fresh DB before migrations)
    log.warn({ err }, 'Refresh failed (non-fatal)');
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
