import { Router } from 'express';
import { withDb } from '../db';
import { audit } from '../utils/audit';
import asyncHandler from 'express-async-handler';
import { requireRole } from '../middleware/roleGuard';

const router = Router();

router.post('/', requireRole('instructor'), asyncHandler(async (req, res) => {
  const { user_id, role } = (req as any).user;
  const { submission_id, reviewer_id } = req.body || {};

  const result = await withDb(user_id, role, async (client) => {
    const ins = await client.query(
      `INSERT INTO assignments (submission_id, reviewer_id, status)
       VALUES ($1,$2,'pending')
       ON CONFLICT ON CONSTRAINT ux_assign_unique DO NOTHING
       RETURNING assignment_id, submission_id, reviewer_id, status, created_at`,
      [submission_id, reviewer_id]
    );
    if (ins.rowCount === 1) {
      const row = ins.rows[0];
      await audit(client, user_id, 'ASSIGN', 'assignment', row.assignment_id, { submission_id, reviewer_id, inserted: true });
      return { code: 201, body: row };
    }

    const ex = await client.query(
      `SELECT assignment_id, status FROM assignments
       WHERE submission_id=$1 AND reviewer_id=$2
       FOR UPDATE`,
      [submission_id, reviewer_id]
    );
    if (ex.rowCount === 0) {
      const ins2 = await client.query(
        `INSERT INTO assignments (submission_id, reviewer_id, status)
         VALUES ($1,$2,'pending')
         RETURNING assignment_id, submission_id, reviewer_id, status, created_at`,
        [submission_id, reviewer_id]
      );
      const row = ins2.rows[0];
      await audit(client, user_id, 'ASSIGN', 'assignment', row.assignment_id, { submission_id, reviewer_id, inserted: true, retry: true });
      return { code: 201, body: row };
    }

    const { assignment_id, status } = ex.rows[0];
    if (status === 'canceled') {
      const upd = await client.query(
        `UPDATE assignments
         SET status='pending', created_at=now()
         WHERE assignment_id=$1
         RETURNING assignment_id, submission_id, reviewer_id, status, created_at`,
        [assignment_id]
      );
      const row = upd.rows[0];
      await audit(client, user_id, 'ASSIGN', 'assignment', row.assignment_id, { submission_id, reviewer_id, revived: true });
      return { code: 201, body: row };
    }

    await audit(client, user_id, 'ASSIGN', 'assignment', assignment_id, { submission_id, reviewer_id, already_assigned: status });
    return { code: 200, body: { note: 'already_assigned', status } };
  });

  return res.status(result.code).json(result.body);
}));

export default router;
