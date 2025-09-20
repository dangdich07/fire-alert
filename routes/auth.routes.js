import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { signupSchema, loginSchema } from '../utils/validators.js';

const router = Router();

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
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ user, token });
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
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ user, token });
});

export default router;
