import type { PoolClient } from 'pg';

/**
 * Write an entry to the audit log table.
 * All write operations should call this for traceability.
 */
export async function audit(
  client: PoolClient,
  actor: string,
  action: string,
  entity: string,
  entityId: string | null,
  meta: Record<string, unknown>
): Promise<void> {
  await client.query(
    'INSERT INTO audit (actor, action, entity, entity_id, meta_json) VALUES ($1,$2,$3,$4,$5)',
    [actor, action, entity, entityId, meta || {}]
  );
}
