import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { broadcastEvent } from '../server.js';

const router = Router();

// Danh sách cảnh báo (lọc active nếu cần)
router.get('/', authRequired, async (req, res) => {
  const active = String(req.query.active || '').toLowerCase() === 'true';
  const rows = await query(
    `SELECT a.*, d.code, d.name AS device_name, d.location
     FROM alerts a 
     JOIN devices d ON d.id = a.device_id
     WHERE d.owner_user_id = :uid ${active ? 'AND a.is_active=TRUE' : ''}
     ORDER BY a.created_at DESC`, { uid: req.user.id }
  );
  res.json({ alerts: rows });
});

// Acknowledge/đóng cảnh báo
router.patch('/:id/ack', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  // chỉ cho phép ack nếu alert thuộc thiết bị của user
  const owning = await query(
    `SELECT a.id FROM alerts a JOIN devices d ON d.id=a.device_id WHERE a.id=:id AND d.owner_user_id=:uid`,
    { id, uid: req.user.id }
  );
  if (!owning.length) return res.status(404).json({ error: 'Alert not found' });

  await query('UPDATE alerts SET is_active=FALSE, ack_by_user_id=:uid, resolved_at=NOW() WHERE id=:id', { id, uid: req.user.id });
  const alert = (await query('SELECT * FROM alerts WHERE id=:id', { id }))[0];
  // fetch device to know owner
  const device = (await query('SELECT * FROM devices WHERE id=:id', { id: alert.device_id }))[0];
  if (device?.owner_user_id) {
    await broadcastEvent(device.owner_user_id, 'alert_update', { ...alert });
  }
  res.json({ alert });
});

// Create alert manually (from client) and broadcast to owner
router.post('/', authRequired, async (req, res) => {
  const { code, device_id, type, level = 0, message, syncKey } = req.body;
  if (!code && !device_id) return res.status(400).json({ error: 'Missing device identifier' });
  if (!type) return res.status(400).json({ error: 'Missing alert type' });

  // find device by id or code
  let device;
  if (device_id) device = (await query('SELECT * FROM devices WHERE id = :id', { id: device_id }))[0];
  else device = (await query('SELECT * FROM devices WHERE code = :code', { code }))[0];

  if (!device) return res.status(404).json({ error: 'Device not found' });

  // ensure caller is owner of device
  if (device.owner_user_id && device.owner_user_id !== req.user.id) return res.status(403).json({ error: 'Not allowed' });

  // insert alert
  const result = await query(
    `INSERT INTO alerts (device_id, type, level, message, is_active) VALUES (:device_id, :type, :level, :message, TRUE)`,
    { device_id: device.id, type, level, message: message || null }
  );
  const alert = (await query('SELECT a.*, d.code, d.name AS device_name, d.location FROM alerts a JOIN devices d ON d.id=a.device_id WHERE a.id=:id', { id: result.insertId }))[0];

  // broadcast to owner
  if (device.owner_user_id) {
    await broadcastEvent(device.owner_user_id, 'alert', alert);
  }

  // return alert with syncKey if provided so client can match
  return res.status(201).json({ alert: { ...alert, syncKey: syncKey || null } });
});

export default router;
