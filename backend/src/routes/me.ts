import { Router } from 'express';
import { withDb } from '../db';
const router = Router();

router.get('/submissions', async (req, res, next) => {
  try {
    const { user_id, role } = (req as any).user;
    const rows = await withDb(user_id, role, async (client) => {
      const q = `
        SELECT s.submission_id,
               coalesce(x.assigned_count,0) as assigned_count,
               coalesce(x.completed_count,0) as completed_count
        FROM submissions s
        LEFT JOIN (
          SELECT submission_id,
                 COUNT(*) FILTER (WHERE status <> 'canceled') AS assigned_count,
                 COUNT(*) FILTER (WHERE status = 'completed') AS completed_count
          FROM assignments
          GROUP BY submission_id
        ) x USING (submission_id)
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
      `;
      const r = await client.query(q, [user_id]);
      return r.rows;
    });
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/assignments', async (req, res, next) => {
  try {
    const { user_id, role } = (req as any).user;
    const rows = await withDb(user_id, role, async (client) => {
      const q = `
        SELECT a.assignment_id, a.submission_id, a.created_at
        FROM assignments a
        LEFT JOIN reviews r ON r.submission_id = a.submission_id AND r.reviewer_id = a.reviewer_id
        WHERE a.reviewer_id = $1 AND a.status = 'pending' AND r.review_id IS NULL
        ORDER BY a.created_at DESC
      `;
      const r = await client.query(q, [user_id]);
      return r.rows;
    });
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
