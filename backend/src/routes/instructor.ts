import { Router } from 'express';
import { withDb } from '../db';
import { requireRole } from '../middleware/roleGuard';
const router = Router();

router.get('/overview', requireRole('instructor'), async (req, res, next) => {
  try {
    const { user_id, role } = (req as any).user;
    const course = (req.query.course as string) || null;
    const group = (req.query.group as string) || null;
    const rows = await withDb(user_id, role, async (client) => {
      const q = `
        SELECT course_id, group_id, wk, submissions, assignments, reviews_completed
        FROM mv_instructor_cohort
        WHERE ($1::text IS NULL OR course_id = $1)
          AND ($2::text IS NULL OR group_id = $2)
        ORDER BY wk DESC
      `;
      const r = await client.query(q, [course, group]);
      return r.rows;
    });
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
