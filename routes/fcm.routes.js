import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// All FCM endpoints disabled
router.use(authRequired, (_req, res) => {
  return res.status(501).json({ error: 'Push notifications are disabled' });
});

export default router;
