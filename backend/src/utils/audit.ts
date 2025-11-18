import type { PoolClient } from 'pg';
import { createHash } from 'crypto';
import { pool } from '../db';

/**
 * Audit Logging System - Database & Security Module
 * Owner: Yanxiao Zheng
 * 
 * Provides comprehensive audit trail for all security-sensitive operations.
 * Includes tamper detection via SHA256 hashing and structured querying.
 */

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

/**
 * Query audit logs by actor (user_id) with time range and pagination.
 * Returns recent activity for a specific user.
 */
export async function queryAuditByActor(
  actorId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    actions?: string[];
  }
): Promise<any[]> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  
  let query = `
    SELECT event_id, actor, action, entity, entity_id, meta_json, 
           correlation_id, created_at
    FROM audit
    WHERE actor = $1
  `;
  
  const params: any[] = [actorId];
  let paramIndex = 2;
  
  if (options?.startDate) {
    query += ` AND created_at >= $${paramIndex}`;
    params.push(options.startDate);
    paramIndex++;
  }
  
  if (options?.endDate) {
    query += ` AND created_at <= $${paramIndex}`;
    params.push(options.endDate);
    paramIndex++;
  }
  
  if (options?.actions && options.actions.length > 0) {
    query += ` AND action = ANY($${paramIndex})`;
    params.push(options.actions);
    paramIndex++;
  }
  
  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);
  
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Query audit logs by entity (e.g., submission, review) to track all operations
 * performed on a specific resource.
 */
export async function queryAuditByEntity(
  entity: string,
  entityId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<any[]> {
  const limit = options?.limit || 100;
  
  let query = `
    SELECT event_id, actor, action, entity, entity_id, meta_json, 
           correlation_id, ip_hash, created_at
    FROM audit
    WHERE entity = $1 AND entity_id = $2
  `;
  
  const params: any[] = [entity, entityId];
  let paramIndex = 3;
  
  if (options?.startDate) {
    query += ` AND created_at >= $${paramIndex}`;
    params.push(options.startDate);
    paramIndex++;
  }
  
  if (options?.endDate) {
    query += ` AND created_at <= $${paramIndex}`;
    params.push(options.endDate);
    paramIndex++;
  }
  
  query += ` ORDER BY created_at ASC LIMIT $${paramIndex}`;
  params.push(limit);
  
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Query audit logs by correlation ID to track related operations in a workflow.
 * Useful for tracing entire request flows across multiple operations.
 */
export async function queryAuditByCorrelation(
  correlationId: string
): Promise<any[]> {
  const result = await pool.query(
    `SELECT event_id, actor, action, entity, entity_id, meta_json, 
            ip_hash, user_agent_hash, created_at
     FROM audit
     WHERE correlation_id = $1
     ORDER BY created_at ASC`,
    [correlationId]
  );
  
  return result.rows;
}

/**
 * Get audit statistics for a course within a time range.
 * Returns action counts and unique actor counts for analysis.
 */
export async function getCourseAuditStats(
  courseId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  total_events: number;
  unique_actors: number;
  actions_breakdown: { action: string; count: number }[];
}> {
  // Get actors in this course
  const actorsResult = await pool.query(
    'SELECT user_id FROM users WHERE course_id = $1',
    [courseId]
  );
  
  const actorIds = actorsResult.rows.map(r => r.user_id);
  
  if (actorIds.length === 0) {
    return {
      total_events: 0,
      unique_actors: 0,
      actions_breakdown: []
    };
  }
  
  // Get audit statistics
  const statsResult = await pool.query(
    `SELECT 
       COUNT(*) as total_events,
       COUNT(DISTINCT actor) as unique_actors
     FROM audit
     WHERE actor = ANY($1)
       AND created_at BETWEEN $2 AND $3`,
    [actorIds, startDate, endDate]
  );
  
  const breakdownResult = await pool.query(
    `SELECT action, COUNT(*) as count
     FROM audit
     WHERE actor = ANY($1)
       AND created_at BETWEEN $2 AND $3
     GROUP BY action
     ORDER BY count DESC`,
    [actorIds, startDate, endDate]
  );
  
  return {
    total_events: parseInt(statsResult.rows[0].total_events),
    unique_actors: parseInt(statsResult.rows[0].unique_actors),
    actions_breakdown: breakdownResult.rows.map(r => ({
      action: r.action,
      count: parseInt(r.count)
    }))
  };
}

/**
 * Create privacy-safe hash of IP address for audit logging.
 * Uses configurable salt to prevent rainbow table attacks.
 */
export function hashIpAddress(ip: string): string {
  const salt = process.env.PRIVACY_SALT || 'default-privacy-salt-change-in-production';
  return hashSensitiveData(ip, salt);
}

/**
 * Create privacy-safe hash of User-Agent string.
 * Truncates to first 200 chars before hashing to normalize variations.
 */
export function hashUserAgent(userAgent: string): string {
  const salt = process.env.PRIVACY_SALT || 'default-privacy-salt-change-in-production';
  const normalized = userAgent.substring(0, 200);
  return hashSensitiveData(normalized, salt);
}

