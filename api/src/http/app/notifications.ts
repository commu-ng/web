import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";
import { AppException } from "../../exception";
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
    appAuthMiddleware,
    communityMiddleware,
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
    appAuthMiddleware,
    communityMiddleware,
    zValidator("query", unreadCountQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      try {
        const count = await notificationService.getUnreadCount(
          user.id,
          community.id,
          profileId,
        );

        return c.json({ count });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  .post(
    "/notifications/mark-all-read",
    zValidator("query", z.object({ profile_id: z.string() })),
    appAuthMiddleware,
    communityMiddleware,
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      try {
        await notificationService.markAllAsRead(
          user.id,
          community.id,
          profileId,
        );

        return c.json({ message: "모든 알림이 읽음으로 표시되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .post(
    "/notifications/:notification_id/read",
    zValidator("param", notificationIdParamSchema),
    zValidator("query", z.object({ profile_id: z.string() })),
    appAuthMiddleware,
    communityMiddleware,
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { notification_id: notificationId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");

      try {
        await notificationService.markAsRead(
          user.id,
          community.id,
          profileId,
          notificationId,
        );

        return c.json({ message: "알림이 읽음으로 표시되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .post(
    "/notifications/:notification_id/unread",
    zValidator("param", notificationIdParamSchema),
    zValidator("query", z.object({ profile_id: z.string() })),
    appAuthMiddleware,
    communityMiddleware,
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { notification_id: notificationId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");

      try {
        await notificationService.markAsUnread(
          user.id,
          community.id,
          profileId,
          notificationId,
        );

        return c.json({ message: "알림이 읽지 않음으로 표시되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  );
