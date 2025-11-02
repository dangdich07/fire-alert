# Fire Alert Backend API

Express + MySQL backend for IoT fire/smoke alerts with JWT auth, SSE streaming, video storage, and FCM push notifications.

## Quick Start

### 1. Environment Setup
Create `.env`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=fire_alert_db
JWT_SECRET=your-jwt-secret
IOT_API_KEY=your-iot-key
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
DEVICE_SUPPRESS_SECONDS=60

# Optional: Firebase for push notifications
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
FIREBASE_PROJECT_ID=your-project-id
```

### 2. Database Setup
```bash
npm run migrate
```

### 3. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login

### Devices
- `POST /devices` - Claim/create device
- `GET /devices` - List user's devices
- `PATCH /devices/:id/mark-safe` - Mark device as safe

### Alerts
- `GET /alerts?active=true` - List active alerts
- `PATCH /alerts/:id/ack` - Acknowledge alert

### IoT Integration
- `POST /iot/event` - Receive fire/smoke event (header: `x-api-key`)
- `POST /iot/heartbeat` - Device heartbeat (header: `x-api-key`)
  - Response includes `suppress_until` and `suppressed` so firmware can pause alerts after users mark a device safe

### Video Storage
- `POST /videos/upload` - Upload escape guidance video
- `GET /videos` - List videos
- `GET /videos/:id` - Get video info
- `GET /videos/:id/file` - Serve video file
- `DELETE /videos/:id` - Delete video

### Push Notifications (FCM)
- `POST /fcm/register` - Register FCM token
- `DELETE /fcm/unregister` - Unregister FCM token
- `GET /fcm/tokens` - List user's FCM tokens
- `POST /fcm/test` - Send test notification

### Real-time Streaming
- `GET /stream/alerts` - SSE stream for real-time alerts (header: `Authorization: Bearer <token>`)

## Features
- JWT authentication
- Real-time SSE streaming
- Video storage for escape guidance
- Firebase Cloud Messaging
- IoT device integration
- MySQL database with proper indexing
- Rate limiting and security headers
- CORS configuration




