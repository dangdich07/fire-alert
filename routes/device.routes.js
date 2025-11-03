import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { createDeviceSchema } from '../utils/validators.js';
import { broadcastEvent } from '../server.js';

const router = Router();
const SUPPRESS_SECONDS = Number(process.env.DEVICE_SUPPRESS_SECONDS || 60);

// Thêm/claim thiết bị IoT
router.post('/', authRequired, async (req, res) => {
  const { error, value } = createDeviceSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { code, name, location } = value;

  // Nếu thiết bị đã tồn tại nhưng chưa có owner -> claim, nếu có owner -> báo lỗi
  const exists = await query('SELECT * FROM devices WHERE code = :code', { code });
  if (exists.length) {
    const dev = exists[0];
    if (dev.owner_user_id && dev.owner_user_id !== req.user.id) {
      return res.status(409).json({ error: 'Device already claimed by another user' });
    }
    await query(
      `UPDATE devices SET name=:name, location=:location, owner_user_id=:owner WHERE code=:code`,
      { name, location, owner: req.user.id, code }
    );
  } else {
    await query(
      `INSERT INTO devices (code, name, location, owner_user_id) 
       VALUES (:code, :name, :location, :owner)`,
      { code, name, location, owner: req.user.id }
    );
  }
  const device = (await query('SELECT * FROM devices WHERE code = :code', { code }))[0];
  res.status(201).json({ device });
});

// Danh sách thiết bị của tôi
router.get('/', authRequired, async (req, res) => {
  const devices = await query('SELECT * FROM devices WHERE owner_user_id = :uid ORDER BY created_at DESC', { uid: req.user.id });
  res.json({ devices });
});

// Đánh dấu thiết bị an toàn (đổi trạng thái + đóng các cảnh báo active)
router.patch('/:id/mark-safe', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const own = await query('SELECT * FROM devices WHERE id=:id AND owner_user_id=:uid', { id, uid: req.user.id });
  if (!own.length) return res.status(404).json({ error: 'Device not found' });

  const suppressDuration = Number.isFinite(SUPPRESS_SECONDS) && SUPPRESS_SECONDS > 0 ? SUPPRESS_SECONDS : 60;
  const suppressUntil = new Date(Date.now() + suppressDuration * 1000);

  await query('UPDATE devices SET status="safe", suppress_until=:suppress_until WHERE id=:id', { id, suppress_until: suppressUntil });
  await query('UPDATE alerts SET is_active=FALSE, ack_by_user_id=:uid, resolved_at=NOW() WHERE device_id=:id AND is_active=TRUE', { id, uid: req.user.id });

  const device = (await query('SELECT * FROM devices WHERE id=:id', { id }))[0];
  await broadcastEvent(req.user.id, 'device_update', { id: device.id, status: device.status, suppress_until: device.suppress_until });
  res.json({ device, suppress_until: device.suppress_until });
});

export default router;
