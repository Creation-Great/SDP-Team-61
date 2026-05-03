/**
 * Simple line-by-line text diff engine.
 *
 * Uses the longest common subsequence (LCS) algorithm to produce
 * a minimal diff between two text strings.
 */

export interface DiffLine {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  lineNumber?: number;
}

/**
 * Compute a line-by-line diff between two texts.
 */
export function computeLineDiff(textA: string, textB: string): DiffLine[] {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');

  // LCS table
  const m = linesA.length;
  const n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      result.unshift({ type: 'unchanged', content: linesA[i - 1], lineNumber: i });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', content: linesB[j - 1], lineNumber: j });
      j--;
    } else if (i > 0) {
      result.unshift({ type: 'remove', content: linesA[i - 1], lineNumber: i });
      i--;
    }
  }

  return result;
}
