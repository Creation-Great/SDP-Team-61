import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT_MS || '5000', 10),
});

// Surface unexpected backend errors so the process doesn't crash silently.
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected idle-client error in pg Pool');
});

/**
 * Execute a callback within a database transaction with RLS context set.
 * Automatically sets app.current_user_id and app.current_role for Row Level Security.
 */
export async function withDb<T>(
  userId: string,
  role: string,
  cb: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    await client.query("SELECT set_config('app.current_role', $1, true)", [role]);
    const result = await cb(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Execute a callback without RLS context (for auth operations like register/login).
 */
export async function withDbNoRLS<T>(
  cb: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await cb(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
