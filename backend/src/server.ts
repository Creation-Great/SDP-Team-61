import app from './app.js';
import { migrateUp } from './migrate.js';
import { startPeriodicRefresh } from './utils/mvRefresh.js';
import { logger } from './utils/logger.js';

const port = process.env.PORT || 8080;
const host = process.env.HOST || '0.0.0.0';

async function boot(): Promise<void> {
  // Run pending database migrations before accepting requests
  if (process.env.SKIP_MIGRATE !== 'true') {
    try {
      await migrateUp();
    } catch (err) {
      logger.error({ err }, 'Migration failed — starting server anyway');
    }
  }

  // Start periodic materialized-view refresh (safety net)
  startPeriodicRefresh();

  app.listen(Number(port), host, () => {
    logger.info({ host, port, env: process.env.NODE_ENV || 'development' }, `API server listening on http://${host}:${port}`);
  });
}

boot();
