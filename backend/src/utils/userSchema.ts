import type { PoolClient } from 'pg';

export interface UsersTableSchema {
  hasEmail: boolean;
  hasPasswordHash: boolean;
  hasName: boolean;
  hasNetid: boolean;
}

let cachedSchema: UsersTableSchema | null = null;

export async function getUsersTableSchema(client: PoolClient): Promise<UsersTableSchema> {
  if (cachedSchema) return cachedSchema;

  const result = await client.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`
  );

  const cols = new Set(result.rows.map((r) => r.column_name));
  cachedSchema = {
    hasEmail: cols.has('email'),
    hasPasswordHash: cols.has('password_hash'),
    hasName: cols.has('name'),
    hasNetid: cols.has('netid'),
  };
  return cachedSchema;
}

export function makeUserSelectClause(schema: UsersTableSchema): string {
  const identifierExpr = schema.hasEmail
    ? 'email'
    : schema.hasNetid
      ? 'netid'
      : "''::text";
  const nameExpr = schema.hasName
    ? 'name'
    : schema.hasNetid
      ? 'netid'
      : "'User'::text";
  const passwordExpr = schema.hasPasswordHash ? 'password_hash' : 'NULL::text';

  return `
    user_id,
    ${identifierExpr} AS email,
    ${nameExpr} AS name,
    role,
    course_id,
    group_id,
    ${passwordExpr} AS password_hash
  `;
}

export function resolveIdentifierInput(input: string): { raw: string; netidGuess: string } {
  const raw = input.trim();
  const atIndex = raw.indexOf('@');
  const netidGuess = atIndex > 0 ? raw.slice(0, atIndex) : raw;
  return { raw, netidGuess };
}
