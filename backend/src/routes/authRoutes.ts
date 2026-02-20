import { Router } from 'express';
import { getMe, casLogin, casCallback, register, login, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas.js';

const router = Router();

// CAS (production)
router.get('/cas/login', h(casLogin));
router.get('/cas/callback', h(casCallback));

// Local email/password (dev only — handlers reject in production)
router.post('/register', validate(registerSchema), h(register));
router.post('/login', validate(loginSchema), h(login));

// Session
router.get('/me', h(authenticate), h(getMe));
router.post('/logout', h(logout));

export default router;
