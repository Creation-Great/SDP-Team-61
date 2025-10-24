import { Router } from 'express';
import { withDb } from '../db';
import { audit } from '../utils/audit';
import asyncHandler from 'express-async-handler';

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
  const { user_id, role } = (req as any).user;
  const { title, raw_uri, masked_uri, hash_raw, hash_masked } = req.body || {};
  const row = await withDb(user_id, role, async (client) => {
    const r = await client.query(
      `INSERT INTO submissions (user_id, title, raw_uri, masked_uri, hash_raw, hash_masked)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING submission_id, created_at`,
      [user_id, title || null, raw_uri || null, masked_uri || null, hash_raw || null, hash_masked || null]
    );
    await audit(client, user_id, 'CREATE', 'submission', r.rows[0].submission_id, { title, masked_uri });
    return r.rows[0];
  });
  res.status(201).json(row);
}));

router.get('/:id/assignments', asyncHandler(async (req, res) => {
  const { user_id, role } = (req as any).user;
  const { id } = req.params;
  if (role === 'instructor' || role === 'admin') {
    const rows = await withDb(user_id, role, async (client) => {
      const r = await client.query(
        `SELECT assignment_id, reviewer_id, status, created_at
         FROM assignments WHERE submission_id = $1
         ORDER BY created_at DESC`, [id]
      );
      return r.rows;
    });
    res.json(rows);
  } else {
    const row = await withDb(user_id, role, async (client) => {
      const r = await client.query(
        `SELECT
            COUNT(*) FILTER (WHERE status <> 'canceled') AS assigned_count,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_count
         FROM assignments WHERE submission_id = $1`, [id]
      );
      return r.rows[0];
    });
    res.json(row);
  }
}));

export default router;
