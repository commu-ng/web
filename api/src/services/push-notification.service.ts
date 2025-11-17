import * as admin from "firebase-admin";
import apn from "@parse/node-apn";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { device as deviceTable } from "../drizzle/schema";

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

class PushNotificationService {
  private fcmApp: admin.app.App | null = null;
  private apnProvider: apn.Provider | null = null;

  constructor() {
    this.initializeFCM();
    this.initializeAPNs();
  }

  private initializeFCM() {
    try {
      const serviceAccountKeyPath = process.env.FCM_SERVICE_ACCOUNT_KEY_PATH;

      if (!serviceAccountKeyPath) {
        console.warn(
          "FCM credentials not configured. Push notifications for Android will not work.",
        );
        return;
      }

      // Initialize Firebase Admin SDK
      const serviceAccount = require(
        serviceAccountKeyPath,
      );
      this.fcmApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log("FCM initialized successfully");
    } catch (error) {
      console.error("Failed to initialize FCM:", error);
    }
  }

  private initializeAPNs() {
    try {
      const keyId = process.env.APNS_KEY_ID;
      const teamId = process.env.APNS_TEAM_ID;
      const keyPath = process.env.APNS_AUTH_KEY_PATH;
      const production = process.env.APNS_PRODUCTION === "true";

      if (!keyId || !teamId || !keyPath) {
        console.warn(
          "APNs credentials not configured. Push notifications for iOS will not work.",
        );
        return;
      }

      this.apnProvider = new apn.Provider({
        token: {
          key: keyPath,
          keyId: keyId,
          teamId: teamId,
        },
        production: production,
      });

      console.log(
        `APNs initialized successfully (${production ? "production" : "development"})`,
      );
    } catch (error) {
      console.error("Failed to initialize APNs:", error);
    }
  }

  async sendPushNotification(userId: string, payload: NotificationPayload) {
    try {
      // Get all active devices for this user
      const devices = await db.query.device.findMany({
        where: eq(deviceTable.userId, userId),
        columns: {
          pushToken: true,
          platform: true,
        },
      });

      if (devices.length === 0) {
        console.log(`No devices found for user ${userId}`);
        return;
      }

      // Group devices by platform
      const iosTokens = devices
        .filter((d) => d.platform === "ios")
        .map((d) => d.pushToken);
      const androidTokens = devices
        .filter((d) => d.platform === "android")
        .map((d) => d.pushToken);

      // Send to iOS devices
      if (iosTokens.length > 0) {
        await this.sendToIOS(iosTokens, payload);
      }

      // Send to Android devices
      if (androidTokens.length > 0) {
        await this.sendToAndroid(androidTokens, payload);
      }
    } catch (error) {
      // Log error but don't throw - push notifications are fire-and-forget
      console.error("Failed to send push notification:", error);
    }
  }

  private async sendToIOS(tokens: string[], payload: NotificationPayload) {
    if (!this.apnProvider) {
      console.warn("APNs not initialized, skipping iOS push notifications");
      return;
    }

    try {
      const notification = new apn.Notification({
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: "default",
        badge: 1,
        topic: "ng.commu.app", // Bundle ID
        payload: payload.data || {},
      });

      const result = await this.apnProvider.send(notification, tokens);

      // Log any failures
      if (result.failed && result.failed.length > 0) {
        console.error(
          "Failed to send to some iOS devices:",
          result.failed.map((f) => ({
            device: f.device,
            response: f.response,
          })),
        );
      }

      console.log(
        `Sent push notification to ${result.sent.length} iOS devices`,
      );
    } catch (error) {
      console.error("Failed to send iOS push notification:", error);
    }
  }

  private async sendToAndroid(tokens: string[], payload: NotificationPayload) {
    if (!this.fcmApp) {
      console.warn("FCM not initialized, skipping Android push notifications");
      return;
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      // Log any failures
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.error(`Failed to send to ${tokens[idx]}:`, resp.error);
          }
        });

        // Remove invalid tokens from database
        if (failedTokens.length > 0) {
          await this.removeInvalidTokens(failedTokens);
        }
      }

      console.log(
        `Sent push notification to ${response.successCount} Android devices`,
      );
    } catch (error) {
      console.error("Failed to send Android push notification:", error);
    }
  }

  private async removeInvalidTokens(tokens: string[]) {
    try {
      for (const token of tokens) {
        await db.delete(deviceTable).where(eq(deviceTable.pushToken, token));
      }
      console.log(`Removed ${tokens.length} invalid device tokens`);
    } catch (error) {
      console.error("Failed to remove invalid tokens:", error);
    }
  }
}

// Singleton instance
export const pushNotificationService = new PushNotificationService();
