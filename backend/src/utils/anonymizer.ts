/**
 * Anonymizer utilities for peer reviews.
 *
 * Provides stable anonymous IDs ("Anonymous Reviewer #N") per session/submission
 * so the same reviewer always gets the same pseudonym within a given context.
 */
import type { PoolClient } from 'pg';

export interface AnonymousMapping {
  userId: string;
  anonymousId: number;
  label: string;
}

/**
 * Get or create a stable anonymous ID for a user within a session/submission context.
 *
 * Collision model
 * ---------------
 * The anonymous_reviewer_map table has UNIQUE(session_id, user_id) and
 * UNIQUE(submission_id, user_id) but NO unique constraint on
 * (session_id, anonymous_id). That means two different users can race to claim
 * the same anonymous_id (e.g. both computing MAX+1=5 at the same time) and both
 * inserts will succeed, producing two "Reviewer #5"s in the same session.
 *
 * To prevent this without migrating historical rows, we use a guarded insert
 * (`INSERT ... WHERE NOT EXISTS`) that atomically fails if the target
 * anonymous_id is already taken in this context, and we retry with a fresh
 * MAX+1 on collision.
 *
 * Under the common case (no concurrent reviewers for the same session) this
 * is still a single INSERT after the existence check.
 */
export async function getAnonymousId(
  client: PoolClient,
  userId: string,
  sessionId: string | null,
  submissionId: string | null,
): Promise<number> {
  // Fast path: existing mapping for this user
  const { rows: existing } = await client.query(
    `SELECT anonymous_id FROM anonymous_reviewer_map
     WHERE user_id = $1
       AND (session_id = $2 OR ($2 IS NULL AND session_id IS NULL))
       AND (submission_id = $3 OR ($3 IS NULL AND submission_id IS NULL))
     LIMIT 1`,
    [userId, sessionId, submissionId],
  );
  if (existing.length > 0) return existing[0].anonymous_id;

  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    // Compute next_id inside the loop so concurrent winners don't trick us into reusing their ID
    const { rows: maxRow } = await client.query(
      `SELECT COALESCE(MAX(anonymous_id), 0) + 1 AS next_id
       FROM anonymous_reviewer_map
       WHERE (session_id = $1 OR ($1 IS NULL AND session_id IS NULL))
         AND (submission_id = $2 OR ($2 IS NULL AND submission_id IS NULL))`,
      [sessionId, submissionId],
    );
    const nextId = maxRow[0].next_id;

    // Guarded insert: only commit if the chosen anonymous_id is not already taken
    // in this context. ON CONFLICT (session_id, user_id) DO NOTHING covers the
    // "same user being inserted twice" race (we'll re-query below).
    const insertResult = await client.query(
      `INSERT INTO anonymous_reviewer_map (session_id, submission_id, user_id, anonymous_id)
       SELECT $1, $2, $3, $4
       WHERE NOT EXISTS (
         SELECT 1 FROM anonymous_reviewer_map
         WHERE anonymous_id = $4
           AND (session_id = $1 OR ($1 IS NULL AND session_id IS NULL))
           AND (submission_id = $2 OR ($2 IS NULL AND submission_id IS NULL))
       )
       ON CONFLICT (session_id, user_id) DO NOTHING
       RETURNING anonymous_id`,
      [sessionId, submissionId, userId, nextId],
    );

    if (insertResult.rows.length > 0) return insertResult.rows[0].anonymous_id;

    // Either the target anonymous_id was already taken (retry with a new MAX+1)
    // or this user was inserted concurrently by another request (re-query to find out).
    const { rows: stored } = await client.query(
      `SELECT anonymous_id FROM anonymous_reviewer_map
       WHERE user_id = $1
         AND (session_id = $2 OR ($2 IS NULL AND session_id IS NULL))
         AND (submission_id = $3 OR ($3 IS NULL AND submission_id IS NULL))
       LIMIT 1`,
      [userId, sessionId, submissionId],
    );
    if (stored.length > 0) return stored[0].anonymous_id;
    // else: anonymous_id collision with a different user — retry
  }

  throw new Error(
    `Failed to assign anonymous ID after ${MAX_ATTEMPTS} attempts (session=${sessionId ?? 'null'}, submission=${submissionId ?? 'null'}, user=${userId})`,
  );
}

/**
 * Strip real names from review objects based on anonymity level.
 */
export function anonymizeReviews(
  reviews: Record<string, any>[],
  anonymityLevel: 'none' | 'single_blind' | 'double_blind',
  mappings: Map<string, number>,
  role: 'student' | 'instructor' | 'admin' | 'ta',
): Record<string, any>[] {
  // Instructors/admins always see real names
  if (role === 'instructor' || role === 'admin') return reviews;
  if (anonymityLevel === 'none') return reviews;

  return reviews.map((r) => {
    const copy = { ...r };

    // Single-blind: hide reviewer from author; Double-blind: hide both
    if (anonymityLevel === 'single_blind' || anonymityLevel === 'double_blind') {
      if (copy.reviewer_name !== undefined) {
        const anonId = mappings.get(copy.reviewer_id) ?? 0;
        copy.reviewer_name = `Anonymous Reviewer #${anonId}`;
        copy.reviewer_email = undefined;
      }
    }

    if (anonymityLevel === 'double_blind') {
      if (copy.author_name !== undefined) {
        copy.author_name = 'Anonymous Author';
        copy.author_email = undefined;
      }
      if (copy.uploader_name !== undefined) {
        copy.uploader_name = 'Anonymous Author';
      }
    }

    return copy;
  });
}
