import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { AppException } from "../../exception";
import {
  appAuthMiddleware,
  optionalAppAuthMiddleware,
} from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import {
  membershipMiddleware,
  moderatorOrOwnerMiddleware,
  ownerOnlyMiddleware,
} from "../../middleware/membership";
import {
  onlineStatusQuerySchema,
  onlineStatusVisibilitySchema,
  paginationQuerySchema,
  profileCreateSchema,
  profileIdParamSchema,
  profileIdQuerySchema,
  profileShareRequestSchema,
  profileUpdateQuerySchema,
  profileUpdateRequestSchema,
  usernameParamSchema,
} from "../../schemas";
import { validateMembershipAndProfile } from "../../services/membership.service";
import * as profileService from "../../services/profile.service";
import type { AuthVariables } from "../../types";

export const profilesRouter = new Hono<{ Variables: AuthVariables }>()
  .post(
    "/profile-picture",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      // Get and validate the profile belongs to the user using helper function
      let profile: Awaited<
        ReturnType<typeof validateMembershipAndProfile>
      >["profile"];
      try {
        const result = await validateMembershipAndProfile(
          user.id,
          community.id,
          profileId,
        );
        profile = result.profile;
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ message: error.message }, error.statusCode);
        }
        return c.json(
          {
            message:
              error instanceof Error
                ? error.message
                : "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
          },
          404,
        );
      }

      // Check Content-Type
      const contentType = c.req.header("content-type") || "";
      if (!contentType.includes("multipart") && !contentType.includes("form")) {
        return c.json(
          {
            message: 'Content-Type must contain "multipart" or "form"',
          },
          400,
        );
      }

      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return c.json({ error: "업로드된 파일이 없습니다" }, 400);
      }

      try {
        const fileBuffer = await file.arrayBuffer();
        const fileContentType = file.type || "application/octet-stream";

        const result = await profileService.uploadProfilePicture(
          profile.id,
          fileBuffer,
          file.name,
          fileContentType,
          file.size,
        );

        return c.json(result, 201);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .get(
    "/username/:username",
    optionalAppAuthMiddleware,
    communityMiddleware,
    zValidator("param", usernameParamSchema),
    async (c) => {
      const { username } = c.req.valid("param");
      const community = c.get("community");

      const result = await profileService.checkUsernameAvailability(
        username,
        community.id,
      );

      return c.json(result);
    },
  )

  .get("/profiles", appAuthMiddleware, communityMiddleware, async (c) => {
    const community = c.get("community");

    const result = await profileService.listProfilesByUser(community.id);

    return c.json(result);
  })

  .post(
    "/profiles",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    moderatorOrOwnerMiddleware,
    zValidator("json", profileCreateSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { name, username, bio, is_primary, profile_picture_id } =
        c.req.valid("json");

      try {
        const result = await profileService.createProfile(
          user.id,
          community.id,
          name,
          username,
          bio,
          is_primary,
          profile_picture_id,
        );

        return c.json(result, 201);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  .get(
    "/profiles/post-count",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const { profile_id: profileId } = c.req.valid("query");
      const postCount = await profileService.getProfilePostCount(profileId);
      return c.json({ post_count: postCount });
    },
  )
  .delete(
    "/profiles",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      try {
        await profileService.deleteProfile(user.id, profileId, community.id);
        return c.json({ message: "프로필이 성공적으로 삭제되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  // Online status endpoints - must be before :username routes
  .get(
    "/profiles/online-status",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("query", onlineStatusQuerySchema),
    async (c) => {
      const { profile_ids } = c.req.valid("query");

      try {
        const onlineStatus = await profileService.getOnlineStatus(profile_ids);
        return c.json(onlineStatus);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  .put(
    "/profiles/online-status-settings",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("json", onlineStatusVisibilitySchema),
    async (c) => {
      const user = c.get("user");
      const { profile_id: profileId, visible } = c.req.valid("json");

      try {
        await profileService.updateOnlineStatusVisibility(
          user.id,
          profileId,
          visible,
        );
        return c.json({ message: "온라인 상태 설정이 변경되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  // Parameterized routes - must be after specific routes
  .get(
    "/profiles/:username",
    optionalAppAuthMiddleware,
    communityMiddleware,
    zValidator("param", usernameParamSchema),
    async (c) => {
      const { username } = c.req.valid("param");
      const community = c.get("community");

      try {
        const result = await profileService.getProfileProfile(
          username,
          community.id,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .get(
    "/profiles/:username/posts",
    optionalAppAuthMiddleware,
    communityMiddleware,
    zValidator("param", usernameParamSchema),
    zValidator("query", paginationQuerySchema),
    async (c) => {
      const { username } = c.req.valid("param");
      const community = c.get("community");
      const { limit = 20, offset = 0 } = c.req.valid("query");

      try {
        const result = await profileService.getProfilePosts(
          username,
          community.id,
          limit,
          offset,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  .post(
    "/profiles/set-primary",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      try {
        await profileService.setPrimaryProfile(
          user.id,
          profileId,
          community.id,
        );
        return c.json({ message: "기본 프로필이 성공적으로 설정되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  .put(
    "/profiles",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("query", profileUpdateQuerySchema),
    zValidator("json", profileUpdateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");
      const { name, username, bio, profile_picture_id } = c.req.valid("json");

      try {
        const result = await profileService.updateProfile(
          user.id,
          profileId,
          community.id,
          name,
          username,
          bio,
          profile_picture_id,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  // Profile sharing endpoints
  .get(
    "/profiles/:profile_id/users",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    ownerOnlyMiddleware,
    zValidator("param", profileIdParamSchema),
    async (c) => {
      const user = c.get("user");
      const { profile_id: profileId } = c.req.valid("param");

      try {
        const result = await profileService.getProfileSharedUsers(
          user.id,
          profileId,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  .post(
    "/profiles/:profile_id/users",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    ownerOnlyMiddleware,
    zValidator("param", profileIdParamSchema),
    zValidator("json", profileShareRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("param");
      const { username, role } = c.req.valid("json");

      try {
        const result = await profileService.shareProfileWithUser(
          user.id,
          profileId,
          community.id,
          username,
          role,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        // Handle duplicate constraint error
        type DatabaseError = Error & { cause?: { constraint?: string } };
        if (
          error instanceof Error &&
          (error.message.includes("unique_profile_user_ownership") ||
            (error as DatabaseError).cause?.constraint ===
              "unique_profile_user_ownership")
        ) {
          return c.json(
            {
              error: "사용자가 이미 이 프로필에 액세스 권한을 가지고 있습니다",
            },
            400,
          );
        }
        throw error;
      }
    },
  )
  .delete(
    "/profiles/:profile_id/shared-profiles/:shared_profile_id",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    ownerOnlyMiddleware,
    zValidator(
      "param",
      z.object({
        profile_id: z.uuid(),
        shared_profile_id: z.uuid(),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const { profile_id: profileId, shared_profile_id: sharedProfileId } =
        c.req.valid("param");

      try {
        // Look up the profile ownership to find the user ID
        const userIds =
          await profileService.getUserIdsFromProfile(sharedProfileId);
        const targetUserId = userIds[0];

        if (!targetUserId) {
          return c.json({ error: "프로필 소유권을 찾을 수 없습니다" }, 404);
        }

        await profileService.removeUserFromProfileSharing(
          user.id,
          profileId,
          targetUserId,
        );
        return c.json({ message: "사용자가 성공적으로 제거되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  );
