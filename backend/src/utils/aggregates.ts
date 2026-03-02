import type { PoolClient } from 'pg';

/**
 * Recompute week_student_aggregates and week_team_aggregates for a given reviewee.
 * MUST be called INSIDE the same withDb transaction as the review submission.
 */
export async function recomputeAggregates(
  client: PoolClient,
  weekId: string,
  revieweeWeekStudentId: string
): Promise<void> {
  // 1. Query all submitted review_scores for this reviewee in this week
  const scoresResult = await client.query(
    `SELECT wc.label, rs2.score_int
     FROM review_assignments ra
     JOIN review_submissions rs ON rs.assignment_id = ra.assignment_id
     JOIN review_scores rs2 ON rs2.submission_id = rs.submission_id
     JOIN week_categories wc ON wc.id = rs2.week_category_id
     WHERE ra.week_id = $1
       AND ra.reviewee_week_student_id = $2
       AND ra.status = 'SUBMITTED'`,
    [weekId, revieweeWeekStudentId]
  );

  // 2. Group by category label, compute per-category averages
  const categoryTotals: Record<string, { sum: number; count: number }> = {};
  for (const row of scoresResult.rows) {
    if (!categoryTotals[row.label]) {
      categoryTotals[row.label] = { sum: 0, count: 0 };
    }
    categoryTotals[row.label].sum += Number(row.score_int);
    categoryTotals[row.label].count += 1;
  }

  const perCategoryJson: Record<string, number> = {};
  let allSum = 0;
  let allCount = 0;

  for (const [label, { sum, count }] of Object.entries(categoryTotals)) {
    const avg = sum / count;
    perCategoryJson[label] = Math.round(avg * 100) / 100;
    allSum += sum;
    allCount += count;
  }

  // 3. Compute overall average
  const nReviews = scoresResult.rows.length > 0
    ? (await client.query(
        `SELECT COUNT(DISTINCT ra.assignment_id) AS n
         FROM review_assignments ra
         WHERE ra.week_id = $1
           AND ra.reviewee_week_student_id = $2
           AND ra.status = 'SUBMITTED'`,
        [weekId, revieweeWeekStudentId]
      )).rows[0].n
    : 0;

  const avgOverall = allCount > 0 ? Math.round((allSum / allCount) * 100) / 100 : null;

  // 4. Upsert week_student_aggregates
  await client.query(
    `INSERT INTO week_student_aggregates
       (week_id, reviewee_week_student_id, avg_overall, per_category_json, n_reviews, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (week_id, reviewee_week_student_id) DO UPDATE
       SET avg_overall       = EXCLUDED.avg_overall,
           per_category_json = EXCLUDED.per_category_json,
           n_reviews         = EXCLUDED.n_reviews,
           updated_at        = now()`,
    [weekId, revieweeWeekStudentId, avgOverall, JSON.stringify(perCategoryJson), nReviews]
  );

  // 5. Get reviewee's team_key, recompute week_team_aggregates
  const teamKeyResult = await client.query(
    `SELECT team_key FROM week_students WHERE id = $1`,
    [revieweeWeekStudentId]
  );
  if (teamKeyResult.rows.length === 0) return;
  const teamKey = teamKeyResult.rows[0].team_key;

  // Aggregate all student aggregates in this team
  const teamAggResult = await client.query(
    `SELECT wsa.avg_overall, wsa.per_category_json, wsa.n_reviews
     FROM week_student_aggregates wsa
     JOIN week_students ws ON ws.id = wsa.reviewee_week_student_id
     WHERE wsa.week_id = $1
       AND ws.team_key = $2
       AND wsa.avg_overall IS NOT NULL`,
    [weekId, teamKey]
  );

  if (teamAggResult.rows.length === 0) {
    // No data yet for team
    await client.query(
      `INSERT INTO week_team_aggregates
         (week_id, team_key, avg_overall, per_category_json, n_reviews, updated_at)
       VALUES ($1, $2, NULL, '{}', 0, now())
       ON CONFLICT (week_id, team_key) DO UPDATE
         SET avg_overall       = NULL,
             per_category_json = '{}',
             n_reviews         = 0,
             updated_at        = now()`,
      [weekId, teamKey]
    );
    return;
  }

  // Compute team-level category averages
  const teamCategoryTotals: Record<string, { sum: number; count: number }> = {};
  let teamAllSum = 0;
  let teamAllCount = 0;
  let teamTotalReviews = 0;

  for (const row of teamAggResult.rows) {
    const perCat = row.per_category_json as Record<string, number>;
    for (const [label, avg] of Object.entries(perCat)) {
      if (!teamCategoryTotals[label]) {
        teamCategoryTotals[label] = { sum: 0, count: 0 };
      }
      teamCategoryTotals[label].sum += avg;
      teamCategoryTotals[label].count += 1;
      teamAllSum += avg;
      teamAllCount += 1;
    }
    teamTotalReviews += Number(row.n_reviews);
  }

  const teamPerCategory: Record<string, number> = {};
  for (const [label, { sum, count }] of Object.entries(teamCategoryTotals)) {
    teamPerCategory[label] = Math.round((sum / count) * 100) / 100;
  }

  const teamAvgOverall = teamAllCount > 0
    ? Math.round((teamAllSum / teamAllCount) * 100) / 100
    : null;

  await client.query(
    `INSERT INTO week_team_aggregates
       (week_id, team_key, avg_overall, per_category_json, n_reviews, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (week_id, team_key) DO UPDATE
       SET avg_overall       = EXCLUDED.avg_overall,
           per_category_json = EXCLUDED.per_category_json,
           n_reviews         = EXCLUDED.n_reviews,
           updated_at        = now()`,
    [weekId, teamKey, teamAvgOverall, JSON.stringify(teamPerCategory), teamTotalReviews]
  );
}
