import { Pool } from 'pg';
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function withDb(userId: string, role: string, cb: (client: any)=>Promise<any>) {
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
