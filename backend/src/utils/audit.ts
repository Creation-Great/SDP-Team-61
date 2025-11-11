import type { PoolClient } from 'pg';
import { createHash } from 'crypto';

interface AuditOptions {
  correlationId?: string;
  ipHash?: string;
  userAgentHash?: string;
  skipHash?: boolean;
}

export async function audit(
  client: PoolClient, 
  actor: string, 
  action: string, 
  entity: string, 
  entity_id: string | null, 
  meta: any,
  options?: AuditOptions
) {
  const metaJson = meta || {};
  const salt = process.env.AUDIT_SALT || 'default-salt-change-in-production';
  
  // Calculate hash for tamper detection (unless explicitly skipped)
  const hashPayload = options?.skipHash 
    ? null 
    : hashAuditPayload(metaJson, salt);

  await client.query(
    `INSERT INTO audit (actor, action, entity, entity_id, meta_json, hash_payload, correlation_id, ip_hash, user_agent_hash) 
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      actor, 
      action, 
      entity, 
      entity_id, 
      metaJson,
      hashPayload,
      options?.correlationId || null,
      options?.ipHash || null,
      options?.userAgentHash || null
    ],
  );
}

export function hashAuditPayload(payload: any, salt: string = ''): string {
  const data = JSON.stringify(payload) + salt;
  return createHash('sha256').update(data).digest('hex');
}

export function hashSensitiveData(data: string, salt?: string): string {
  const finalData = salt ? data + salt : data;
  return createHash('sha256').update(finalData).digest('hex');
}

export async function verifyAuditIntegrity(
  client: PoolClient,
  eventId: string
): Promise<{ valid: boolean; expected?: string; actual?: string }> {
  const result = await client.query(
    'SELECT meta_json, hash_payload FROM audit WHERE event_id = $1',
    [eventId]
  );

  if (result.rows.length === 0) {
    return { valid: false };
  }

  const { meta_json, hash_payload } = result.rows[0];
  
  if (!hash_payload) {
    return { valid: false }; // No hash to verify
  }

  const salt = process.env.AUDIT_SALT || 'default-salt-change-in-production';
  const expectedHash = hashAuditPayload(meta_json, salt);

  return {
    valid: expectedHash === hash_payload,
    expected: expectedHash,
    actual: hash_payload
  };
}

