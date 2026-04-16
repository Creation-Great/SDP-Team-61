import { Router, Response } from 'express';
import { h } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate, validateParams } from '../middleware/validate.js';
import { anonymityConfigSchema } from '../schemas.js';
import * as ctrl from '../controllers/anonymityController.js';
import type { AuthRequest } from '../types.js';
import { verifySessionAccess } from '../utils/enrollment.js';
import { pool } from '../db.js';
import { z } from 'zod';

const router = Router();
router.use(h(authenticate));

const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
});

router.get('/sessions/:sessionId/anonymity', validateParams(sessionIdParamSchema), async (req, res: Response) => {
  await ctrl.getAnonymityConfig(req as unknown as AuthRequest, res);
});

router.patch('/sessions/:sessionId/anonymity', h(requireRole('instructor', 'admin')), validateParams(sessionIdParamSchema), validate(anonymityConfigSchema), async (req, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  const { sessionId } = req.params;

  // Verify instructor owns this session's course
  await verifySessionAccess(pool, authReq.user.user_id, authReq.user.role, sessionId as string);

  await ctrl.updateAnonymityConfig(authReq, res);
});

export default router;
