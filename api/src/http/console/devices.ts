import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db";
import { device } from "../../drizzle/schema";
import { AppException } from "../../exception";
import { authMiddleware } from "../../middleware/auth";
import type { AuthVariables } from "../../types";

const registerDeviceSchema = z.object({
  push_token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
  device_model: z.string().optional(),
  os_version: z.string().optional(),
  app_version: z.string().optional(),
});

const pushTokenParamSchema = z.object({
  push_token: z.string(),
});

export const consoleDevicesRouter = new Hono<{ Variables: AuthVariables }>()
  .post(
    "/devices",
    authMiddleware,
    zValidator("json", registerDeviceSchema),
    async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");

      try {
        // Upsert: Update if exists, insert if not
        await db
          .insert(device)
          .values({
            pushToken: body.push_token,
            platform: body.platform,
            userId: user.id,
            deviceModel: body.device_model,
            osVersion: body.os_version,
            appVersion: body.app_version,
          })
          .onConflictDoUpdate({
            target: device.pushToken,
            set: {
              userId: user.id,
              platform: body.platform,
              deviceModel: body.device_model,
              osVersion: body.os_version,
              appVersion: body.app_version,
              updatedAt: new Date().toISOString(),
            },
          });

        return c.json({ message: "Device registered successfully" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .delete(
    "/devices/:push_token",
    zValidator("param", pushTokenParamSchema),
    async (c) => {
      const { push_token: pushToken } = c.req.valid("param");

      try {
        await db.delete(device).where(eq(device.pushToken, pushToken));

        return c.json({ message: "Device deleted successfully" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  );
