# Copilot Instructions for Fire Alert Backend

## Project Overview
This is an Express.js backend for an IoT fire/smoke alert system. It integrates with MySQL, uses JWT for authentication, supports real-time alert streaming via SSE, stores guidance videos, and sends push notifications via Firebase Cloud Messaging (FCM).

## Architecture & Key Components
- **Express server** (`server.js`): Main entry point, sets up middleware, routes, and error handling.
- **Routes** (`routes/`): Organized by domain (auth, device, alert, iot, video, fcm). Each file defines RESTful endpoints and uses controller logic inline or via helpers.
- **Database** (`config/db.js`, `migrations/001_schema.sql`): MySQL connection and schema migration. Use `npm run migrate` to initialize/update schema.
- **Firebase Integration** (`config/firebase.js`): Handles FCM push notifications. Requires service account credentials in `.env`.
- **Middleware** (`middleware/`): Auth (`auth.js`), IoT API key validation (`iotAuth.js`), and other request guards.
- **Utilities** (`utils/`): Environment variable loader, input validators, etc.

## Developer Workflows
- **Environment Setup**: Copy `.env.example` or follow README to create `.env` with DB, JWT, and Firebase keys.
- **Database Migration**: Run `npm run migrate` to apply schema changes from `migrations/001_schema.sql`.
- **Development Server**: Use `npm run dev` (nodemon) for hot reload; `npm start` for production.
- **Testing**: No formal test suite; test endpoints with Postman or curl. Use the provided API routes for manual testing.
- **Debugging**: Add `console.log` in route handlers or middleware. Watch for errors in the terminal output.

## Project-Specific Patterns & Conventions
- **Authentication**: JWT required for most endpoints except IoT and auth routes. Use `auth.js` middleware.
- **IoT API Key**: IoT device endpoints require `x-api-key` header, validated by `iotAuth.js`.
- **SSE Streaming**: Real-time alerts via `/stream/alerts` using Server-Sent Events. Requires JWT in `Authorization` header.
- **Video Storage**: Videos uploaded via `/videos/upload`, stored locally or in configured storage. Metadata managed in DB.
- **FCM Tokens**: Register/unregister tokens via `/fcm/register` and `/fcm/unregister`. Send test notifications with `/fcm/test`.
- **CORS**: Origins set via `.env` (`CORS_ORIGIN`).
- **Rate Limiting & Security**: Implemented via Express middleware (see `server.js`).

## Integration Points
- **MySQL**: All persistent data (users, devices, alerts, videos, FCM tokens).
- **Firebase**: Push notifications for alerts and updates.
- **IoT Devices**: Communicate via `/iot/event` and `/iot/heartbeat` endpoints.

## Examples
- To add a new device endpoint, create a route in `routes/device.routes.js` and update DB logic in the same file or a helper.
- To add a new alert type, update DB schema and extend logic in `routes/alert.routes.js`.
- For new middleware, add to `middleware/` and register in `server.js`.

## References
- See `README.md` for API endpoint details and environment setup.
- See `migrations/001_schema.sql` for DB structure.
- See `config/` for integration configs.

---

**Feedback:** If any section is unclear or missing, please specify which workflows, patterns, or integration details need further documentation.
