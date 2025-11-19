import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";
import { appAuthMiddleware } from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import {
  conversationsQuerySchema,
  notificationIdParamSchema,
  unreadCountQuerySchema,
} from "../../schemas";
import * as notificationService from "../../services/notification.service";
import type { AuthVariables } from "../../types";

export const notificationsRouter = new Hono<{ Variables: AuthVariables }>()
  .get(
    "/notifications",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("query", conversationsQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const {
        profile_id: profileId,
        limit = 20,
        cursor,
      } = c.req.valid("query");

      const result = await notificationService.getNotificationsForProfile(
        user.id,
        community.id,
        profileId,
        limit,
        cursor,
      );

      return c.json(result);
    },
  )

  .get(
    "/notifications/unread-count",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("query", unreadCountQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      const count = await notificationService.getUnreadCount(
        user.id,
        community.id,
        profileId,
      );

      return c.json({
        data: {
          count,
        },
      });
    },
  )
  .post(
    "/notifications/mark-all-read",
    zValidator("query", z.object({ profile_id: z.string() })),
    communityMiddleware,
    appAuthMiddleware,
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      await notificationService.markAllAsRead(user.id, community.id, profileId);

      return c.json({
        data: {
          profile_id: profileId,
          all_read: true,
          read_at: new Date().toISOString(),
        },
      });
    },
  )

  .post(
    "/notifications/:notification_id/read",
    zValidator("param", notificationIdParamSchema),
    zValidator("query", z.object({ profile_id: z.string() })),
    communityMiddleware,
    appAuthMiddleware,
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { notification_id: notificationId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");

      await notificationService.markAsRead(
        user.id,
        community.id,
        profileId,
        notificationId,
      );

      return c.json({
        data: {
          id: notificationId,
          is_read: true,
          read_at: new Date().toISOString(),
        },
      });
    },
  )

  .post(
    "/notifications/:notification_id/unread",
    zValidator("param", notificationIdParamSchema),
    zValidator("query", z.object({ profile_id: z.string() })),
    communityMiddleware,
    appAuthMiddleware,
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { notification_id: notificationId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");

      await notificationService.markAsUnread(
        user.id,
        community.id,
        profileId,
        notificationId,
      );

      return c.json({
        data: {
          id: notificationId,
          is_read: false,
        },
      });
    },
  );
