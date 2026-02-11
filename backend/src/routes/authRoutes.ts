import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', register as any);
router.post('/login', login as any);
router.get('/me', authenticate as any, getMe as any);

export default router;
