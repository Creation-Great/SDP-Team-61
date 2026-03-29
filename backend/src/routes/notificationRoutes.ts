import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { h } from '../utils/asyncHandler.js';
import { validateParams } from '../middleware/validate.js';
import { uuidParamSchema } from '../schemas.js';
import {
  listNotifications,
  getUnreadCount,
  getPreferences,
  updatePreferences,
  getVapidPublicKey,
  listPushSubscriptions,
  createPushSubscription,
  deletePushSubscription,
  markAllRead,
  markOneRead,
} from '../controllers/notificationController.js';

const router = Router();

// All notification routes require authentication
router.use(h(authenticate));

// GET /notifications
router.get('/', h(listNotifications));

// GET /notifications/unread-count
router.get('/unread-count', h(getUnreadCount));

// GET /notifications/preferences
router.get('/preferences', h(getPreferences));

// PATCH /notifications/preferences
router.patch('/preferences', h(updatePreferences));

// GET /notifications/push/public-key
router.get('/push/public-key', h(getVapidPublicKey));

// GET /notifications/push/subscriptions
router.get('/push/subscriptions', h(listPushSubscriptions));

// POST /notifications/push/subscriptions
router.post('/push/subscriptions', h(createPushSubscription));

// DELETE /notifications/push/subscriptions
router.delete('/push/subscriptions', h(deletePushSubscription));

// PATCH /notifications/read-all (must be before /:id to avoid param capture)
router.patch('/read-all', h(markAllRead));

// PATCH /notifications/:id/read
router.patch('/:id/read', validateParams(uuidParamSchema), h(markOneRead));

export default router;
