import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { query } from '../config/db.js';
import { signupSchema, loginSchema } from '../utils/validators.js';

const router = Router();

function generateRefreshToken() {
  return randomBytes(48).toString('hex');
}

async function storeRefreshToken(userId, token, expiresAt) {
  await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (:user_id, :token, :expires_at)', { user_id: userId, token, expires_at: expiresAt });
}

async function revokeRefreshToken(token) {
  await query('DELETE FROM refresh_tokens WHERE token = :token', { token });
}

async function findRefreshToken(token) {
  const rows = await query('SELECT * FROM refresh_tokens WHERE token = :token', { token });
  return rows[0];
}

router.post('/signup', async (req, res) => {
  const { error, value } = signupSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { name, email, password } = value;
  const exists = await query('SELECT id FROM users WHERE email = :email', { email });
  if (exists.length) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (name, email, password_hash) VALUES (:name, :email, :password_hash)',
    { name, email, password_hash }
  );
  const user = { id: result.insertId, name, email };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '15m' });
  // create refresh token valid for 30 days
  const refresh = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await storeRefreshToken(user.id, refresh, expiresAt);
  res.status(201).json({ user, token, refreshToken: refresh });
});

router.post('/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { email, password } = value;
  const rows = await query('SELECT * FROM users WHERE email = :email', { email });
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

  const userRow = rows[0];
  const ok = await bcrypt.compare(password, userRow.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const user = { id: userRow.id, name: userRow.name, email: userRow.email };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refresh = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await storeRefreshToken(user.id, refresh, expiresAt);
  res.json({ user, token, refreshToken: refresh });
});

// Exchange refresh token for a new access token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });
  const row = await findRefreshToken(refreshToken);
  if (!row) return res.status(401).json({ error: 'Invalid refresh token' });
  if (new Date(row.expires_at) < new Date()) {
    await revokeRefreshToken(refreshToken);
    return res.status(401).json({ error: 'Refresh token expired' });
  }
  const userRow = (await query('SELECT id, name, email FROM users WHERE id=:id', { id: row.user_id }))[0];
  if (!userRow) return res.status(401).json({ error: 'Invalid user' });
  const user = { id: userRow.id, name: userRow.name, email: userRow.email };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '15m' });
  res.json({ token });
});

// Revoke a refresh token (logout)
router.post('/logout-refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });
  await revokeRefreshToken(refreshToken);
  res.json({ ok: true });
});

export default router;
