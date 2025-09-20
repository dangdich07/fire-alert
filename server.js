import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes.js';
import deviceRoutes from './routes/device.routes.js';
import alertRoutes from './routes/alert.routes.js';
import iotRoutes from './routes/iot.routes.js';
import videoRoutes from './routes/video.routes.js';
import fcmRoutes from './routes/fcm.routes.js';
import { query } from './config/db.js';
import { validateEnv, getCorsOrigin } from './utils/env.js';

dotenv.config();
validateEnv();
const app = express();

// security & basic middlewares
// Allow inline scripts on the test page by disabling CSP (only for local test UI)
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = getCorsOrigin();
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl, server-to-server
    const port = String(process.env.PORT || 4000);
    const sameOrigin = origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
    if (sameOrigin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  }
}));
app.use(express.json());
app.use(morgan('dev'));

// basic rate limit for all requests
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(apiLimiter);

// Static files removed - backend API only

// API routes
app.use('/auth', authRoutes);
app.use('/devices', deviceRoutes);
app.use('/alerts', alertRoutes);
app.use('/iot', iotRoutes);
app.use('/videos', videoRoutes);
app.use('/fcm', fcmRoutes);

// ---------- SSE (Server-Sent Events) cho cảnh báo realtime ----------
/**
 * Map<userId, Set<res>>
 */
const sseClients = new Map();

app.get('/stream/alerts', async (req, res) => {
  // auth rất nhẹ cho SSE: token qua query hoặc header
  const token = (req.headers.authorization || '').replace('Bearer ', '') || (req.query.token || '');
  if (!token) return res.status(401).end();
  let userId = null;
  try {
    // tránh import vòng, check JWT thủ công để giữ gọn
    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(token, process.env.JWT_SECRET);
    userId = payload.id;
  } catch {
    return res.status(401).end();
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no' // tránh buffer (nginx)
  });
  res.write(': connected\n\n');

  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);

  // gửi các cảnh báo đang active khi mới kết nối
  const initial = await query(
    `SELECT a.*, d.code, d.name AS device_name, d.location
       FROM alerts a JOIN devices d ON d.id=a.device_id
      WHERE d.owner_user_id=:uid AND a.is_active=TRUE
      ORDER BY a.created_at DESC`, { uid: userId }
  );
  res.write(`event: snapshot\ndata: ${JSON.stringify(initial)}\n\n`);

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const set = sseClients.get(userId);
    if (set) {
      set.delete(res);
      if (!set.size) sseClients.delete(userId);
    }
  });
});

// broadcast helpers
export async function broadcastEvent(userId, eventName, payload) {
  const set = sseClients.get(userId);
  if (!set || !set.size) return;
  const msg = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) res.write(msg);
}

export async function broadcastAlert(userId, payload) {
  return broadcastEvent(userId, 'alert', payload);
}

// health check
app.get('/', (req, res) => res.json({ 
  ok: true, 
  msg: 'Fire Alert API running',
  version: '1.0.0',
  endpoints: {
    auth: '/auth',
    devices: '/devices', 
    alerts: '/alerts',
    iot: '/iot',
    videos: '/videos',
    fcm: '/fcm',
    stream: '/stream/alerts'
  }
}));

// 404 handler
app.use((req, res) => {
  return res.status(404).json({ error: 'Not Found' });
});

// error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const payload = {
    error: status === 500 ? 'Internal Server Error' : err.message
  };
  if (!isProd && status === 500) {
    payload.details = err.sqlMessage || err.message || 'Unknown error';
    payload.stack = err.stack;
  }
  // eslint-disable-next-line no-console
  if (status >= 500) console.error('ERROR:', err);
  return res.status(status).json(payload);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🔥 Server listening on http://localhost:${PORT}`);
});
