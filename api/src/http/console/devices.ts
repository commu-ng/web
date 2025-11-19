import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db";
import { device } from "../../drizzle/schema";
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

      return c.json(
        {
          data: {
            push_token: body.push_token,
            registered: true,
            registered_at: new Date().toISOString(),
          },
        },
        201,
      );
    },
  )

  .delete(
    "/devices/:push_token",
    zValidator("param", pushTokenParamSchema),
    async (c) => {
      const { push_token: pushToken } = c.req.valid("param");

      await db.delete(device).where(eq(device.pushToken, pushToken));

      return c.body(null, 204);
    },
  );
