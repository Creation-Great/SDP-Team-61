/**
 * Programmatic migration runner using node-pg-migrate.
 * Can be imported by server.ts for auto-migrate on startup,
 * or invoked via CLI scripts in package.json.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import type { RunnerOption } from 'node-pg-migrate';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildOptions(
  direction: 'up' | 'down' = 'up',
  count?: number
): RunnerOption {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required for migrations');
  }

  return {
    databaseUrl,
    dir: resolve(__dirname, '..', 'migrations'),
    direction,
    count: count ?? Infinity,
    migrationsTable: 'pgmigrations',
    // Use SQL files (not JS)
    log: (msg: string) => logger.info(msg),
    verbose: true,
  };
}

/**
 * Run all pending migrations (up).
 */
export async function migrateUp(count?: number): Promise<void> {
  logger.info('Running UP migrations...');
  await runner(buildOptions('up', count));
  logger.info('UP migrations complete');
}

/**
 * Roll back the last N migrations (default 1).
 */
export async function migrateDown(count = 1): Promise<void> {
  logger.info({ count }, `Rolling back ${count} migration(s)...`);
  await runner(buildOptions('down', count));
  logger.info('DOWN migrations complete');
}

// CLI entrypoint: `tsx src/migrate.ts up` or `tsx src/migrate.ts down [count]`
const [, , command, countArg] = process.argv;
if (command === 'up' || command === 'down') {
  const fn = command === 'up' ? migrateUp : migrateDown;
  const cnt = countArg ? parseInt(countArg, 10) : undefined;
  fn(cnt).catch((err) => {
    logger.fatal({ err }, 'Migration FAILED');
    process.exit(1);
  });
}
