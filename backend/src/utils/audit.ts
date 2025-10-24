import type { PoolClient } from 'pg';
export async function audit(client: PoolClient, actor: string, action: string, entity: string, entity_id: string|null, meta: any) {
  await client.query(
    'INSERT INTO audit (actor, action, entity, entity_id, meta_json) VALUES ($1,$2,$3,$4,$5)',
    [actor, action, entity, entity_id, meta || {}],
  );
}
