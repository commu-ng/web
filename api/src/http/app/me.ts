import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { logger } from "../../config/logger";
import { appAuthMiddleware } from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import { membershipMiddleware } from "../../middleware/membership";
import {
  profileIdQuerySchema,
  profileUpdateRequestSchema,
} from "../../schemas";
import * as userService from "../../services/user.service";
import type { AuthVariables } from "../../types";
import { canManageProfile } from "../../utils/profile-ownership";

export const meRouter = new Hono<{ Variables: AuthVariables }>()
  .get("/instance", communityMiddleware, async (c) => {
    const community = c.get("community");

    try {
      const result = await userService.getPublicInstanceInfo(community.id);
      return c.json(result);
    } catch (error) {
      logger.http.error("Error fetching public instance info", { error });
      return c.json({ error: "인스턴스 정보를 가져오는데 실패했습니다" }, 500);
    }
  })
  .get("/me", appAuthMiddleware, async (c) => {
    const user = c.get("user");

    try {
      const result = await userService.getCurrentUser(user.id);
      return c.json(result);
    } catch (error) {
      logger.http.error("Error fetching current user", { error });
      return c.json({ error: "사용자 정보를 가져오는데 실패했습니다" }, 500);
    }
  })
  .get("/me/instance", appAuthMiddleware, communityMiddleware, async (c) => {
    const user = c.get("user");
    const community = c.get("community");

    try {
      const result = await userService.getCurrentUserInstance(
        user.id,
        community.id,
      );
      return c.json(result);
    } catch (error) {
      logger.http.error("Error fetching user instance", { error });
      return c.json({ error: "인스턴스 정보를 가져오는데 실패했습니다" }, 500);
    }
  })

  .put(
    "/me/profiles",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("query", profileIdQuerySchema),
    zValidator("json", profileUpdateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");
      const { name, username, bio, profile_picture_id } = c.req.valid("json");

      // Verify the user has access to this profile via ownership
      const canManage = await canManageProfile(user.id, profileId);
      if (!canManage) {
        return c.json(
          { message: "프로필을 찾을 수 없거나 접근할 수 없습니다" },
          404,
        );
      }

      try {
        const result = await userService.updateUserProfile(
          profileId,
          community.id,
          name,
          username,
          bio,
          profile_picture_id,
        );
        return c.json(result);
      } catch (error: unknown) {
        // Check for unique constraint violation on username
        const causeMessage =
          error instanceof Error && (error as Error & { cause?: Error }).cause
            ? (error as Error & { cause: Error }).cause.message
            : "";
        if (
          error instanceof Error &&
          (error.message.includes("unique_username_community") ||
            error.message.includes("duplicate key value") ||
            causeMessage.includes("unique_username_community") ||
            causeMessage.includes("duplicate key value"))
        ) {
          return c.json(
            { message: "이 커뮤에서 이미 사용 중인 사용자명입니다" },
            400,
          );
        }
        if (
          error instanceof Error &&
          error.message === "Invalid profile picture ID"
        ) {
          return c.json({ error: "잘못된 프로필 사진 ID입니다" }, 400);
        }
        if (error instanceof Error && error.message === "Profile not found") {
          return c.json({ message: "프로필을 찾을 수 없습니다" }, 404);
        }
        logger.http.error("Error updating profile", { error });
        return c.json({ error: "프로필 업데이트에 실패했습니다" }, 500);
      }
    },
  )
  .get(
    "/me/profiles",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");

      try {
        const result = await userService.getUserProfiles(user.id, community.id);
        return c.json(result);
      } catch (error) {
        logger.http.error("Error fetching user profiles", { error });
        return c.json({ error: "프로필 목록을 가져오는데 실패했습니다" }, 500);
      }
    },
  );
