import dotenv from 'dotenv';
dotenv.config();

export function iotAuth(req, res, next) {
  const key = req.header('x-api-key');
  if (!key || key !== process.env.IOT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized IoT device' });
  }
  next();
}
