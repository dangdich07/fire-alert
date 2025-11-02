import { Router } from 'express';
import { iotAuth } from '../middleware/iotAuth.js';
import { query } from '../config/db.js';
import { iotEventSchema, heartbeatSchema } from '../utils/validators.js';
import { broadcastEvent } from '../server.js'; // circular-safe

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

  const now = new Date();
  const suppressUntil = device.suppress_until ? new Date(device.suppress_until) : null;
  const suppressionActive = suppressUntil && suppressUntil > now;
  const suppressionExpired = suppressUntil && suppressUntil <= now;

  if (suppressionExpired) {
    await query('UPDATE devices SET suppress_until=NULL WHERE id=:id', { id: device.id });
    device.suppress_until = null;
  }

  const nextStatus = suppressionActive
    ? 'safe'
    : (isAlarm ? 'alarm' : 'ok');

  await query(`
    UPDATE devices
       SET status=:status,
           last_seen=NOW()
     WHERE id=:id
  `, { id: device.id, status: nextStatus });

  device = (await query('SELECT * FROM devices WHERE id=:id', { id: device.id }))[0];
  const deviceSuppressed = device.suppress_until ? new Date(device.suppress_until) > new Date() : false;

  if (!isAlarm) {
    return res.status(200).json({
      ok: true,
      alert: null,
      suppressed: deviceSuppressed,
      status: device.status,
      readings: { gas: gasReading, gasStatus, flame: flameReading, flameStatus },
      suppress_until: device.suppress_until
    });
  }

  if (deviceSuppressed) {
    return res.status(202).json({
      ok: true,
      suppressed: true,
      suppress_until: device.suppress_until,
      status: device.status,
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
    payload.suppress_until = device.suppress_until;
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
    if (device.suppress_until) {
      pushData.suppress_until = device.suppress_until.toISOString ? device.suppress_until.toISOString() : `${device.suppress_until}`;
    }
    // Push notifications disabled
      /* device.owner_user_id, */
      /*
      `🚨 Fire Alert - ${device.name}`,
      `${alertType.toUpperCase()} detected at ${device.location || 'Unknown location'}`,
      pushData
    ); */
  }

  return res.status(201).json({ ok: true, alert_id: alert.id });
});

// heartbeat để báo online
router.post('/heartbeat', iotAuth, async (req, res) => {
  const { error, value } = heartbeatSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { code } = value;
  let device = (await query('SELECT * FROM devices WHERE code = :code', { code }))[0];
  if (!device) {
    await query(`INSERT INTO devices (code, name, status) VALUES (:code, :name, 'ok')`, { code, name: `Unclaimed ${code}` });
    device = (await query('SELECT * FROM devices WHERE code = :code', { code }))[0];
  }

  const now = new Date();
  const suppressUntil = device.suppress_until ? new Date(device.suppress_until) : null;
  const suppressionActive = suppressUntil && suppressUntil > now;
  const suppressionExpired = suppressUntil && suppressUntil <= now;

  const nextStatus = device.status === 'alarm'
    ? 'alarm'
    : suppressionActive
      ? 'safe'
      : 'ok';

  await query(
    `UPDATE devices
        SET last_seen=NOW(),
            status=:status${suppressionExpired ? ', suppress_until=NULL' : ''}
      WHERE code=:code`,
    { code, status: nextStatus }
  );

  const updated = (await query('SELECT * FROM devices WHERE code = :code', { code }))[0];
  const updatedSuppressed = updated.suppress_until ? new Date(updated.suppress_until) > new Date() : false;
  return res.json({
    ok: true,
    status: updated.status,
    suppressed: updatedSuppressed,
    suppress_until: updated.suppress_until
  });
});

export default router;
