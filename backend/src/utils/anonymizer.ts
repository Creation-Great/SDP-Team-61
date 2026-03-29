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
 * Get or create a stable anonymous ID for a user within a session.
 * Returns the anonymous number (1-based).
 */
export async function getAnonymousId(
  client: PoolClient,
  userId: string,
  sessionId: string | null,
  submissionId: string | null,
): Promise<number> {
  // Check for existing mapping
  const { rows: existing } = await client.query(
    `SELECT anonymous_id FROM anonymous_reviewer_map
     WHERE user_id = $1
       AND (session_id = $2 OR ($2 IS NULL AND session_id IS NULL))
       AND (submission_id = $3 OR ($3 IS NULL AND submission_id IS NULL))
     LIMIT 1`,
    [userId, sessionId, submissionId],
  );

  if (existing.length > 0) return existing[0].anonymous_id;

  // Get next available ID in this context
  const { rows: maxRow } = await client.query(
    `SELECT COALESCE(MAX(anonymous_id), 0) + 1 AS next_id
     FROM anonymous_reviewer_map
     WHERE (session_id = $1 OR ($1 IS NULL AND session_id IS NULL))
       AND (submission_id = $2 OR ($2 IS NULL AND submission_id IS NULL))`,
    [sessionId, submissionId],
  );

  const nextId = maxRow[0].next_id;

  await client.query(
    `INSERT INTO anonymous_reviewer_map (session_id, submission_id, user_id, anonymous_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [sessionId, submissionId, userId, nextId],
  );

  return nextId;
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
