/**
 * Review integrity hashing.
 *
 * Computes a SHA-256 hash of the review content at submission time,
 * providing tamper evidence for submitted reviews.
 */
import { createHash } from 'crypto';

/**
 * Compute a SHA-256 hash of review content.
 * The hash covers score + comments to detect any post-submission modification.
 */
export function computeReviewHash(score: number, comments: string): string {
  const payload = `${score}:${comments || ''}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Compute hash for peer review (multi-dimension scores + comments).
 */
export function computePeerReviewHash(
  technical: number,
  interactions: number,
  management: number,
  comments: string,
): string {
  const payload = `${technical}:${interactions}:${management}:${comments || ''}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Verify that a review's content matches its stored hash.
 */
export function verifyReviewHash(score: number, comments: string, hash: string): boolean {
  return computeReviewHash(score, comments) === hash;
}
