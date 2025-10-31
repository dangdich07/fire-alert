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

  const { code, gas, flame } = value;
  const gasReading = Math.max(0, gas);
  const flameReading = Math.max(0, flame);

  const gasStatus = gasReading > 700 ? 'danger'
    : gasReading > 400 ? 'warning'
      : 'safe';
  const flameStatus = flameReading < 200 ? 'danger'
    : flameReading < 500 ? 'warning'
      : 'safe';

  const gasLevel = gasStatus === 'danger' ? 100 : gasStatus === 'warning' ? 60 : 0;
  const flameLevel = flameStatus === 'danger' ? 100 : flameStatus === 'warning' ? 60 : 0;
  const alertLevel = Math.max(gasLevel, flameLevel);
  const alertType = flameLevel > 0 ? 'fire' : gasLevel > 0 ? 'smoke' : 'smoke';
  const alertMessage = `Gas: ${gasReading} (${gasStatus}), Flame: ${flameReading} (${flameStatus})`;
  const isAlarm = alertLevel > 0;

  // Tìm thiết bị, nếu chưa có thì tạo "unclaimed"
  let device = (await query('SELECT * FROM devices WHERE code = :code', { code }))[0];
  if (!device) {
    await query(`INSERT INTO devices (code, name, status) VALUES (:code, :name, 'ok')`,
      { code, name: `Unclaimed ${code}` });
    device = (await query('SELECT * FROM devices WHERE code = :code', { code }))[0];
  }

  // cập nhật trạng thái
  await query('UPDATE devices SET status=:status, last_seen=NOW() WHERE id=:id', {
    id: device.id,
    status: isAlarm ? 'alarm' : 'ok'
  });

  if (!isAlarm) {
    return res.status(200).json({
      ok: true,
      alert: null,
      status: 'safe',
      readings: { gas: gasReading, gasStatus, flame: flameReading, flameStatus }
    });
  }

  // tạo alert
  const result = await query(
    `INSERT INTO alerts (device_id, type, level, message, is_active) 
     VALUES (:device_id, :type, :level, :message, TRUE)`,
    { device_id: device.id, type: alertType, level: alertLevel, message: alertMessage }
  );
  const alert = (await query('SELECT * FROM alerts WHERE id=:id', { id: result.insertId }))[0];

  // push SSE tới chủ sở hữu (nếu có)
  if (device.owner_user_id) {
    const payload = {
      ...alert,
      device: { id: device.id, code: device.code, name: device.name, location: device.location }
    };
    payload.gas = gasReading;
    payload.gasStatus = gasStatus;
    payload.flame = flameReading;
    payload.flameStatus = flameStatus;
    await broadcastEvent(device.owner_user_id, 'alert', payload);

    // Send push notification
    const pushData = {
      alert_id: alert.id,
      device_id: device.id,
      device_code: device.code,
      alert_type: alertType,
      level: alertLevel.toString()
    };
    pushData.gas = String(gasReading);
    pushData.gas_status = gasStatus;
    pushData.flame = String(flameReading);
    pushData.flame_status = flameStatus;
    await sendPushNotification(
      device.owner_user_id,
      `🚨 Fire Alert - ${device.name}`,
      `${alertType.toUpperCase()} detected at ${device.location || 'Unknown location'}`,
      pushData
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
