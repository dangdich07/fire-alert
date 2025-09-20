import { Router } from 'express';
import { iotAuth } from '../middleware/iotAuth.js';
import { query } from '../config/db.js';
import { iotEventSchema, heartbeatSchema } from '../utils/validators.js';
import { broadcastEvent } from '../server.js'; // circular-safe
import { sendPushNotification } from '../config/firebase.js';

const router = Router();

// Mạch IoT bắn sự kiện cháy/khói
router.post('/event', iotAuth, async (req, res) => {
  const { error, value } = iotEventSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { code, type, level, message } = value;

  // Tìm thiết bị, nếu chưa có thì tạo "unclaimed"
  let device = (await query('SELECT * FROM devices WHERE code = :code', { code }))[0];
  if (!device) {
    await query(`INSERT INTO devices (code, name, status) VALUES (:code, :name, 'ok')`,
      { code, name: `Unclaimed ${code}` });
    device = (await query('SELECT * FROM devices WHERE code = :code', { code }))[0];
  }

  // cập nhật trạng thái
  await query('UPDATE devices SET status="alarm", last_seen=NOW() WHERE id=:id', { id: device.id });

  // tạo alert
  const result = await query(
    `INSERT INTO alerts (device_id, type, level, message, is_active) 
     VALUES (:device_id, :type, :level, :message, TRUE)`,
    { device_id: device.id, type, level, message: message || null }
  );
  const alert = (await query('SELECT * FROM alerts WHERE id=:id', { id: result.insertId }))[0];

  // push SSE tới chủ sở hữu (nếu có)
  if (device.owner_user_id) {
    await broadcastEvent(device.owner_user_id, 'alert', {
      ...alert,
      device: { id: device.id, code: device.code, name: device.name, location: device.location }
    });

    // Send push notification
    await sendPushNotification(
      device.owner_user_id,
      `🚨 Fire Alert - ${device.name}`,
      `${type.toUpperCase()} detected at ${device.location || 'Unknown location'}`,
      {
        alert_id: alert.id,
        device_id: device.id,
        device_code: device.code,
        alert_type: type,
        level: level.toString()
      }
    );
  }

  return res.status(201).json({ ok: true, alert_id: alert.id });
});

// heartbeat để báo online
router.post('/heartbeat', iotAuth, async (req, res) => {
  const { error, value } = heartbeatSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { code } = value;
  await query('UPDATE devices SET last_seen=NOW(), status=IF(status="alarm","alarm","ok") WHERE code=:code', { code });
  return res.json({ ok: true });
});

export default router;
