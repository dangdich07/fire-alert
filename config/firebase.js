import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
let app;
try {
  // Check if Firebase is already initialized
  if (admin.apps.length === 0) {
    // Initialize with service account key (you'll need to add this to .env)
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : null;

    if (serviceAccount) {
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Add your Firebase project ID here
        projectId: process.env.FIREBASE_PROJECT_ID || 'fire-alert-app'
      });
    } else {
      // For development without service account
      console.warn('Firebase not configured - FCM will be disabled');
    }
  } else {
    app = admin.app();
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  app = null;
}

export { admin, app };

// Send push notification
export async function sendPushNotification(userId, title, body, data = {}) {
  if (!app) {
    console.warn('Firebase not initialized - push notification skipped');
    return { success: false, error: 'Firebase not configured' };
  }

  try {
    // Get FCM tokens for the user
    const { query } = await import('./db.js');
    const tokens = await query(
      'SELECT token FROM fcm_tokens WHERE user_id = :userId AND is_active = TRUE',
      { userId }
    );

    if (tokens.length === 0) {
      return { success: false, error: 'No FCM tokens found for user' };
    }

    const fcmTokens = tokens.map(t => t.token);

    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      tokens: fcmTokens
    };

    const response = await admin.messaging().sendMulticast(message);
    
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses
    };
  } catch (error) {
    console.error('FCM send error:', error);
    return { success: false, error: error.message };
  }
}
