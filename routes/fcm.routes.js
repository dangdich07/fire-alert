import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { fcmTokenSchema } from '../utils/validators.js';
import { sendPushNotification } from '../config/firebase.js';

const router = Router();

// Register FCM token
router.post('/register', authRequired, async (req, res) => {
  try {
    const { error, value } = fcmTokenSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const { token, device_type } = value;
    const userId = req.user.id;

    // Check if token already exists
    const existing = await query(
      'SELECT id FROM fcm_tokens WHERE user_id = :userId AND token = :token',
      { userId, token }
    );

    if (existing.length > 0) {
      // Update existing token
      await query(
        'UPDATE fcm_tokens SET is_active = TRUE, device_type = :device_type, updated_at = NOW() WHERE user_id = :userId AND token = :token',
        { userId, token, device_type }
      );
    } else {
      // Insert new token
      await query(
        'INSERT INTO fcm_tokens (user_id, token, device_type) VALUES (:userId, :token, :device_type)',
        { userId, token, device_type }
      );
    }

    res.json({ message: 'FCM token registered successfully' });
  } catch (err) {
    console.error('FCM register error:', err);
    res.status(500).json({ error: 'Failed to register FCM token' });
  }
});

// Unregister FCM token
router.delete('/unregister', authRequired, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const userId = req.user.id;

    await query(
      'UPDATE fcm_tokens SET is_active = FALSE WHERE user_id = :userId AND token = :token',
      { userId, token }
    );

    res.json({ message: 'FCM token unregistered successfully' });
  } catch (err) {
    console.error('FCM unregister error:', err);
    res.status(500).json({ error: 'Failed to unregister FCM token' });
  }
});

// Get user's FCM tokens
router.get('/tokens', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const tokens = await query(
      'SELECT id, token, device_type, created_at FROM fcm_tokens WHERE user_id = :userId AND is_active = TRUE',
      { userId }
    );

    res.json({ tokens });
  } catch (err) {
    console.error('Get FCM tokens error:', err);
    res.status(500).json({ error: 'Failed to get FCM tokens' });
  }
});

// Test push notification (admin only)
router.post('/test', authRequired, async (req, res) => {
  try {
    const { title, body, data } = req.body;
    const userId = req.user.id;

    const result = await sendPushNotification(
      userId,
      title || 'Test Notification',
      body || 'This is a test push notification',
      data || {}
    );

    res.json(result);
  } catch (err) {
    console.error('Test push error:', err);
    res.status(500).json({ error: 'Failed to send test push notification' });
  }
});

export default router;
