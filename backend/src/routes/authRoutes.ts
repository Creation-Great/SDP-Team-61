import { Router } from 'express';
import { getMe, updateProfile, casLogin, casCallback, register, login, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../schemas.js';

const router = Router();

// CAS (production)
router.get('/cas/login', h(casLogin));
router.get('/cas/callback', h(casCallback));

// Local email/password (dev only — handlers reject in production)
router.post('/register', validate(registerSchema), h(register));
router.post('/login', validate(loginSchema), h(login));

// Session & profile
router.get('/me', h(authenticate), h(getMe));
router.patch('/profile', h(authenticate), validate(updateProfileSchema), h(updateProfile));
router.post('/logout', h(logout));

export default router;
