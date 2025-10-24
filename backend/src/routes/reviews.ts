import { Router } from 'express';
import { withDb } from '../db';
import { audit } from '../utils/audit';
import asyncHandler from 'express-async-handler';

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
  const { user_id, role } = (req as any).user;
  const { submission_id, score, raw_uri, masked_uri } = req.body || {};

  const row = await withDb(user_id, role, async (client) => {
    const r = await client.query(
      `INSERT INTO reviews (submission_id, reviewer_id, score, raw_uri, masked_uri)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING review_id, created_at`,
      [submission_id, user_id, score || null, raw_uri || null, masked_uri || null]
    );
    await client.query(`UPDATE assignments SET status='completed' WHERE submission_id=$1 AND reviewer_id=$2`, [submission_id, user_id]);
    await audit(client, user_id, 'REVIEW', 'review', r.rows[0].review_id, { submission_id, score });
    return r.rows[0];
  });

  res.status(201).json(row);
}));

export default router;
