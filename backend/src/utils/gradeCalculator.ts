/**
 * Grade calculation utilities.
 *
 * Computes weighted final grades with optional drop-lowest/drop-highest.
 */

export interface GradeWeights {
  file_review_weight: number;
  peer_review_weight: number;
  checkin_weight: number;
  drop_lowest: number;
  drop_highest: number;
}

export interface StudentScores {
  fileReviewScores: number[];
  peerReviewAvg: number | null;
  checkinAvg: number | null;
}

export interface FinalGrade {
  fileReviewAvg: number | null;
  peerReviewAvg: number | null;
  checkinAvg: number | null;
  weightedTotal: number | null;
  breakdown: {
    fileReview: { weight: number; score: number | null; contribution: number };
    peerReview: { weight: number; score: number | null; contribution: number };
    checkin: { weight: number; score: number | null; contribution: number };
  };
}

function dropExtremes(scores: number[], dropLow: number, dropHigh: number): number[] {
  if (scores.length === 0) return [];
  const sorted = [...scores].sort((a, b) => a - b);
  const lo = Math.min(dropLow, Math.floor(sorted.length / 2));
  const hi = Math.min(dropHigh, Math.floor(sorted.length / 2));
  return sorted.slice(lo, sorted.length - hi);
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

export function calculateFinalGrade(
  scores: StudentScores,
  weights: GradeWeights,
): FinalGrade {
  const trimmed = dropExtremes(scores.fileReviewScores, weights.drop_lowest, weights.drop_highest);
  const frAvg = avg(trimmed);
  const prAvg = scores.peerReviewAvg;
  const ciAvg = scores.checkinAvg;

  // Normalise weights to sum to 100
  const totalWeight = weights.file_review_weight + weights.peer_review_weight + weights.checkin_weight;
  const norm = totalWeight > 0 ? 100 / totalWeight : 1;
  const frW = weights.file_review_weight * norm;
  const prW = weights.peer_review_weight * norm;
  const ciW = weights.checkin_weight * norm;

  const frContrib = frAvg !== null ? (frAvg / 5) * frW : 0;
  const prContrib = prAvg !== null ? (prAvg / 5) * prW : 0;
  const ciContrib = ciAvg !== null ? (ciAvg / 5) * ciW : 0;

  // Only compute total if at least one score category has data
  const hasAny = frAvg !== null || prAvg !== null || ciAvg !== null;
  const weightedTotal = hasAny ? frContrib + prContrib + ciContrib : null;

  return {
    fileReviewAvg: frAvg,
    peerReviewAvg: prAvg,
    checkinAvg: ciAvg,
    weightedTotal,
    breakdown: {
      fileReview: { weight: frW, score: frAvg, contribution: frContrib },
      peerReview: { weight: prW, score: prAvg, contribution: prContrib },
      checkin: { weight: ciW, score: ciAvg, contribution: ciContrib },
    },
  };
}
