import { Router, Response } from 'express';
import { h } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate } from '../middleware/validate.js';
import { anonymityConfigSchema } from '../schemas.js';
import * as ctrl from '../controllers/anonymityController.js';
import type { AuthRequest } from '../types.js';

const router = Router();
router.use(h(authenticate));

router.get('/sessions/:sessionId/anonymity', async (req, res: Response) => {
  await ctrl.getAnonymityConfig(req as unknown as AuthRequest, res);
});

router.patch('/sessions/:sessionId/anonymity', h(requireRole('instructor', 'admin')), validate(anonymityConfigSchema), async (req, res: Response) => {
  await ctrl.updateAnonymityConfig(req as unknown as AuthRequest, res);
});

export default router;
