import { Router } from 'express';
import { getMe, casLogin, casCallback } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/cas/login', casLogin as any);
router.get('/cas/callback', casCallback as any);
router.get('/me', authenticate as any, getMe as any);

export default router;
