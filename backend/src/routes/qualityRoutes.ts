import { Router, Response } from 'express';
import { h } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate } from '../middleware/validate.js';
import { helpfulnessVoteSchema } from '../schemas.js';
import * as ctrl from '../controllers/qualityController.js';
import type { AuthRequest } from '../types.js';

const router = Router();
router.use(h(authenticate));

router.post('/helpfulness', validate(helpfulnessVoteSchema), async (req, res: Response) => {
  await ctrl.voteHelpfulness(req as unknown as AuthRequest, res);
});

router.get('/reputation/:userId', async (req, res: Response) => {
  await ctrl.getReviewerReputation(req as unknown as AuthRequest, res);
});

router.get('/consistency', h(requireRole('instructor', 'admin')), async (req, res: Response) => {
  await ctrl.getConsistencyAlerts(req as unknown as AuthRequest, res);
});

export default router;
