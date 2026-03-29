import app from './app.js';
import { migrateUp } from './migrate.js';
import { startPeriodicRefresh } from './utils/mvRefresh.js';
import { startReminderScheduler } from './utils/scheduler.js';
import { initRedis } from './utils/redis.js';
import { logger } from './utils/logger.js';

const port = process.env.PORT || 8080;
const host = process.env.HOST || '0.0.0.0';

/**
 * Verify critical security configuration at startup.
 * In production, missing or weak config causes a fatal exit.
 * In development, issues are logged as warnings.
 */
function verifySecurity(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const issues: string[] = [];

  if (!process.env.DATABASE_URL) {
    issues.push('DATABASE_URL is not set');
  }

  const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGINS || '';
  if (isProd && (frontendUrl.includes('localhost') || !frontendUrl)) {
    issues.push('FRONTEND_URL / CORS_ORIGINS must be set to production domain (not localhost)');
  }

  if (isProd && !process.env.AI_API_KEY) {
    issues.push('AI_API_KEY is not set — AI service will reject all requests');
  }

  if (issues.length > 0) {
    if (isProd) {
      for (const issue of issues) logger.fatal(issue);
      logger.fatal('Cannot start in production with failed security checks');
      process.exit(1);
    } else {
      for (const issue of issues) logger.warn(`Security check: ${issue}`);
    }
  }
}

async function boot(): Promise<void> {
  // Verify security configuration before anything else
  verifySecurity();

  // Run pending database migrations before accepting requests
  if (process.env.SKIP_MIGRATE !== 'true') {
    try {
      await migrateUp();
    } catch (err) {
      logger.error({ err }, 'Migration failed — starting server anyway');
    }
  }

  // Initialise Redis (non-blocking; gracefully degrades if unavailable)
  await initRedis();

  // Start periodic materialized-view refresh (safety net)
  startPeriodicRefresh();

  // Start deadline reminder scheduler
  startReminderScheduler();

  // Start daily data cleanup (drafts > 30d, read notifications > 90d, AI logs > 90d)
  startDataCleanup();

  app.listen(Number(port), host, () => {
    logger.info({ host, port, env: process.env.NODE_ENV || 'development' }, `API server listening on http://${host}:${port}`);
  });
}

/** Run data cleanup functions daily. */
function startDataCleanup(): void {
  const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  async function runCleanup(): Promise<void> {
    try {
      const { pool } = await import('./db.js');
      const drafts = await pool.query('SELECT cleanup_old_drafts() AS deleted');
      const notifs = await pool.query('SELECT cleanup_old_notifications() AS deleted');
      const logs = await pool.query('SELECT cleanup_old_ai_logs() AS deleted');
      logger.info({
        drafts: drafts.rows[0]?.deleted ?? 0,
        notifications: notifs.rows[0]?.deleted ?? 0,
        aiLogs: logs.rows[0]?.deleted ?? 0,
      }, 'Daily data cleanup completed');
    } catch (err) {
      logger.warn({ err }, 'Data cleanup failed (non-fatal)');
    }
  }

  // Run first cleanup 1 hour after startup, then every 24 hours
  setTimeout(() => {
    void runCleanup();
    setInterval(() => void runCleanup(), CLEANUP_INTERVAL_MS).unref();
  }, 60 * 60 * 1000).unref();
}

boot();
