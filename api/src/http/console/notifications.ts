import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db";
import {
  notification as notificationTable,
  profile as profileTable,
  profileOwnership as profileOwnershipTable,
} from "../../drizzle/schema";
import { authMiddleware } from "../../middleware/auth";
import type { AuthVariables, ProfilePicture } from "../../types";
import { addImageUrl } from "../../utils/r2";

const notificationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const notificationIdParamSchema = z.object({
  notification_id: z.string(),
});

export const consoleNotificationsRouter = new Hono<{
  Variables: AuthVariables;
}>()
  .get(
    "/notifications",
    authMiddleware,
    zValidator("query", notificationQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { limit, cursor } = c.req.valid("query");

      // Build where conditions - get all notifications for profiles owned by this user
      const userProfiles = await db
        .select({ profileId: profileOwnershipTable.profileId })
        .from(profileOwnershipTable)
        .where(eq(profileOwnershipTable.userId, user.id));

      if (userProfiles.length === 0) {
        return c.json({
          data: [],
          nextCursor: null,
          hasMore: false,
        });
      }

      const profileIds = userProfiles.map((p) => p.profileId);

      const conditions = [inArray(notificationTable.recipientId, profileIds)];

      if (cursor) {
        conditions.push(sql`${notificationTable.id} < ${cursor}`);
      }

      // Get notifications across all profiles (fetch limit + 1)
      const notificationTableList = await db.query.notification.findMany({
        where: and(...conditions),
        orderBy: [desc(notificationTable.id)],
        limit: limit + 1,
      });

      // Check if there are more results
      const hasMore = notificationTableList.length > limit;
      const notificationsToReturn = hasMore
        ? notificationTableList.slice(0, limit)
        : notificationTableList;
      const nextCursor =
        hasMore && notificationsToReturn.length > 0
          ? notificationsToReturn[notificationsToReturn.length - 1]?.id
          : null;

      // Get additional details for notifications with posts
      const notificationsWithPostIds = notificationsToReturn.filter(
        (n) => n.postId,
      );
      const postIds = [
        ...new Set(notificationsWithPostIds.map((n) => n.postId!)),
      ];

      // Get posts with their board and community info
      const posts =
        postIds.length > 0
          ? await db.query.post.findMany({
              where: (post, { inArray }) => inArray(post.id, postIds),
              columns: {
                id: true,
                content: true,
                communityId: true,
                deletedAt: true,
              },
            })
          : [];

      const postsMap = new Map(posts.map((p) => [p.id, p]));

      // Get boards and communities for URL generation
      const communityIds = [
        ...new Set(posts.map((p) => p.communityId).filter(Boolean)),
      ];
      const communities =
        communityIds.length > 0
          ? await db.query.community.findMany({
              where: (community, { inArray }) =>
                inArray(community.id, communityIds as string[]),
            })
          : [];

      const communitiesMap = new Map(communities.map((c) => [c.id, c]));

      const data = notificationsToReturn
        .filter((notification) => {
          // Filter out notifications with deleted posts
          if (notification.postId) {
            const post = postsMap.get(notification.postId);
            if (!post || post.deletedAt) {
              return false;
            }
          }
          return true;
        })
        .map((notification) => {
          let communityUrl = null;

          if (notification.postId) {
            const post = postsMap.get(notification.postId);
            if (post && post.communityId) {
              const community = communitiesMap.get(post.communityId);

              if (community) {
                const baseDomain = process.env.BASE_DOMAIN || "commu.ng";
                communityUrl = `https://${community.slug}.${baseDomain}`;
              }
            }
          }

          return {
            id: notification.id,
            type: notification.type,
            content: notification.message,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
            communityUrl,
            sender: null,
            related_post: null,
          };
        });

      return c.json({
        data,
        nextCursor,
        hasMore,
      });
    },
  )

  .get(
    "/notifications/unread-count",
    authMiddleware,
    async (c) => {
      const user = c.get("user");

      // Get all profiles owned by this user
      const userProfiles = await db
        .select({ profileId: profileOwnershipTable.profileId })
        .from(profileOwnershipTable)
        .where(eq(profileOwnershipTable.userId, user.id));

      if (userProfiles.length === 0) {
        return c.json({ count: 0 });
      }

      const profileIds = userProfiles.map((p) => p.profileId);

      // Count unread notifications across all profiles
      const result = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(notificationTable)
        .where(
          and(
            inArray(notificationTable.recipientId, profileIds),
            isNull(notificationTable.readAt),
          ),
        );

      return c.json({ count: result[0]?.count || 0 });
    },
  )

  .post(
    "/notifications/mark-all-read",
    authMiddleware,
    async (c) => {
      const user = c.get("user");

      // Get all profiles owned by this user
      const userProfiles = await db
        .select({ profileId: profileOwnershipTable.profileId })
        .from(profileOwnershipTable)
        .where(eq(profileOwnershipTable.userId, user.id));

      if (userProfiles.length === 0) {
        return c.json({ message: "No notifications to mark as read" });
      }

      const profileIds = userProfiles.map((p) => p.profileId);

      // Mark all unread notifications as read
      await db
        .update(notificationTable)
        .set({ readAt: new Date().toISOString() })
        .where(
          and(
            inArray(notificationTable.recipientId, profileIds),
            isNull(notificationTable.readAt),
          ),
        );

      return c.json({ message: "All notifications marked as read" });
    },
  )

  .post(
    "/notifications/:notification_id/read",
    authMiddleware,
    zValidator("param", notificationIdParamSchema),
    async (c) => {
      const user = c.get("user");
      const { notification_id } = c.req.valid("param");

      // Verify the notification belongs to one of the user's profiles
      const notification = await db.query.notification.findFirst({
        where: eq(notificationTable.id, notification_id),
        columns: {
          id: true,
          recipientId: true,
        },
      });

      if (!notification) {
        return c.json({ error: "Notification not found" }, 404);
      }

      // Check if user owns the recipient profile
      const ownership = await db.query.profileOwnership.findFirst({
        where: and(
          eq(profileOwnershipTable.profileId, notification.recipientId),
          eq(profileOwnershipTable.userId, user.id),
        ),
      });

      if (!ownership) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      // Mark as read
      await db
        .update(notificationTable)
        .set({ readAt: new Date().toISOString() })
        .where(eq(notificationTable.id, notification_id));

      return c.json({ message: "Notification marked as read" });
    },
  );
