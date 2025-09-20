import dotenv from 'dotenv';
dotenv.config();

const requiredVars = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'IOT_API_KEY'
];

// Optional vars (warnings only)
const optionalVars = [
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'FIREBASE_PROJECT_ID'
];

export function validateEnv() {
  const missing = requiredVars.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
  if (missing.length) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    // eslint-disable-next-line no-console
    console.error(message);
    process.exit(1);
  }

  // Warn about optional vars
  const missingOptional = optionalVars.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
  if (missingOptional.length) {
    // eslint-disable-next-line no-console
    console.warn(`Optional environment variables not set: ${missingOptional.join(', ')} (FCM will be disabled)`);
  }
}

export function getCorsOrigin() {
  // Allow multiple origins comma-separated
  const raw = process.env.CORS_ORIGIN || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}






