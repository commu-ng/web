import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  appAuthMiddleware,
  optionalAppAuthMiddleware,
} from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import { membershipMiddleware } from "../../middleware/membership";
import {
  conversationsQuerySchema,
  optionalProfileIdQuerySchema,
  postCreateRequestSchema,
  postIdParamSchema,
  postQuerySchema,
  postReactionCreateSchema,
  postReactionDeleteSchema,
  postSearchQuerySchema,
  postUpdateRequestSchema,
  profileIdQuerySchema,
  scheduledPostsQuerySchema,
} from "../../schemas";
import * as exportJobService from "../../services/export-job.service";
import * as postService from "../../services/post.service";
import * as profileService from "../../services/profile.service";
import type { AuthVariables } from "../../types";
import { GeneralErrorCode } from "../../types/api-responses";

const exportJobIdParamSchema = z.object({
  job_id: z.string().uuid(),
});

export const postsRouter = new Hono<{ Variables: AuthVariables }>()
  .post(
    "/export",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");

      const job = await exportJobService.createExportJob(community.id, user.id);

      return c.json(
        {
          data: {
            job_id: job.id,
            status: job.status,
            created_at: job.created_at,
          },
        },
        202,
      );
    },
  )
  .get(
    "/export/:job_id",
    appAuthMiddleware,
    zValidator("param", exportJobIdParamSchema),
    async (c) => {
      const { job_id: jobId } = c.req.valid("param");
      const user = c.get("user");

      const job = await exportJobService.getExportJobStatus(jobId, user.id);

      return c.json({
        data: {
          id: job.id,
          status: job.status,
          download_url: job.download_url,
          expires_at: job.expires_at,
          error: job.error_message,
          created_at: job.created_at,
          completed_at: job.completed_at,
        },
      });
    },
  )
  .get("/exports", communityMiddleware, appAuthMiddleware, async (c) => {
    const user = c.get("user");
    const community = c.get("community");
    const exports = await exportJobService.getUserExports(
      user.id,
      community.id,
    );

    return c.json({ data: exports });
  })
  .post("/upload/file", appAuthMiddleware, async (c) => {
    // Check Content-Type before parsing formData
    const contentType = c.req.header("content-type") || "";
    if (!contentType.includes("multipart") && !contentType.includes("form")) {
      return c.json(
        {
          error: {
            code: GeneralErrorCode.INVALID_CONTENT_TYPE,
            message: 'Content-Type must contain "multipart" or "form"',
          },
        },
        400,
      );
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json(
        {
          error: {
            code: GeneralErrorCode.NO_FILE_UPLOADED,
            message: "업로드된 파일이 없습니다",
          },
        },
        400,
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const fileContentType = file.type || "application/octet-stream";

    const result = await postService.uploadImage(
      fileBuffer,
      file.name,
      fileContentType,
      file.size,
    );

    return c.json({ data: result }, 201);
  })
  .get(
    "/announcements",
    optionalAppAuthMiddleware,
    communityMiddleware,
    async (c) => {
      const community = c.get("community");

      const result = await postService.getAnnouncements(community.id);

      return c.json({ data: result });
    },
  )
  .get(
    "/bookmarks",
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

      // Find and validate the profile using new ownership system
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      const result = await postService.getBookmarks(
        profileId,
        community.id,
        limit,
        cursor,
      );

      return c.json(result);
    },
  )
  .get(
    "/posts",
    optionalAppAuthMiddleware,
    communityMiddleware,
    zValidator("query", postQuerySchema),
    async (c) => {
      const community = c.get("community");
      const { limit = 20, cursor, profile_id } = c.req.valid("query");

      // Update last activity for the profile if provided
      if (profile_id) {
        // Don't await - fire and forget to avoid slowing down the request
        profileService.updateLastActivity(profile_id).catch(() => {
          // Silently ignore errors to not break the request
        });
      }

      const result = await postService.getPosts(
        community.id,
        limit,
        cursor,
        profile_id,
      );

      return c.json(result);
    },
  )
  .get(
    "/posts/search",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("query", postSearchQuerySchema),
    async (c) => {
      const community = c.get("community");
      const { q, limit = 20, cursor, profile_id } = c.req.valid("query");
      const result = await postService.searchPosts(
        q,
        community.id,
        limit,
        cursor,
        profile_id,
      );

      return c.json(result);
    },
  )
  .get(
    "/scheduled-posts",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("query", scheduledPostsQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const {
        profile_id: profileId,
        limit = 20,
        cursor,
      } = c.req.valid("query");

      // Validate profile belongs to the current user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        true,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      const result = await postService.getScheduledPosts(
        profileId,
        community.id,
        limit,
        cursor,
      );

      return c.json(result);
    },
  )

  .post(
    "/posts",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("json", postCreateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const {
        content,
        profile_id,
        in_reply_to_id,
        image_ids,
        announcement,
        content_warning,
        scheduled_at,
      } = c.req.valid("json");

      // Validate profile belongs to the current user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        true,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      // Update last activity
      profileService.updateLastActivity(profile.id).catch(() => {
        // Silently ignore errors
      });

      const result = await postService.createPost(
        user.id,
        profile.id,
        community.id,
        content,
        in_reply_to_id || null,
        image_ids,
        announcement,
        content_warning || null,
        scheduled_at || null,
        community.startsAt,
        community.endsAt,
      );

      return c.json({ data: result }, 201);
    },
  )

  .get(
    "/posts/:post_id",
    optionalAppAuthMiddleware,
    communityMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("query", optionalProfileIdQuerySchema),
    async (c) => {
      const { post_id: postId } = c.req.valid("param");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      const post = await postService.getPost(postId, community.id, profileId);
      return c.json({ data: post });
    },
  )

  .get(
    "/posts/:post_id/history",
    optionalAppAuthMiddleware,
    communityMiddleware,
    zValidator("param", postIdParamSchema),
    async (c) => {
      const { post_id: postId } = c.req.valid("param");
      const community = c.get("community");

      const history = await postService.getPostHistory(postId, community.id);
      return c.json({ data: history });
    },
  )

  .delete(
    "/posts/:post_id",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const { post_id: postId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query"); // Profile ID performing the deletion
      const user = c.get("user");
      const community = c.get("community");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        true,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      await postService.deletePost(user.id, profile.id, postId, community.id);

      return c.json({ data: { id: postId, deleted: true } });
    },
  )
  .patch(
    "/posts/:post_id",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    zValidator("json", postUpdateRequestSchema),
    async (c) => {
      const { post_id: postId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");
      const { content, image_ids, content_warning } = c.req.valid("json");
      const user = c.get("user");
      const community = c.get("community");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        true,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      const result = await postService.updatePost(
        user.id,
        profile.id,
        postId,
        community.id,
        content,
        image_ids,
        content_warning,
      );

      return c.json({ data: result });
    },
  )
  .post(
    "/posts/:post_id/bookmark",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const { post_id: postId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");
      const user = c.get("user");
      const community = c.get("community");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        true,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      const result = await postService.createBookmark(
        profile.id,
        postId,
        community.id,
      );

      return c.json({ data: result }, 201);
    },
  )
  .delete(
    "/posts/:post_id/bookmark",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const { post_id: postId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");
      const user = c.get("user");
      const community = c.get("community");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        true,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      await postService.deleteBookmark(profile.id, postId, community.id);

      return c.json({ data: { post_id: postId, bookmarked: false } });
    },
  )
  .post(
    "/posts/:post_id/reactions",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("json", postReactionCreateSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { post_id: postId } = c.req.valid("param");
      const { profile_id: profileId, emoji } = c.req.valid("json");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      const result = await postService.createReaction(
        profile.id,
        postId,
        community.id,
        emoji,
        profile.name,
      );

      return c.json({ data: result }, 201);
    },
  )

  .delete(
    "/posts/:post_id/reactions",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("query", postReactionDeleteSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { post_id: postId } = c.req.valid("param");
      const { profile_id: profileId, emoji } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      await postService.deleteReaction(profile.id, postId, community.id, emoji);

      return c.json({
        data: { post_id: postId, emoji, deleted: true },
      });
    },
  )
  .post(
    "/posts/:post_id/pin",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const { post_id: postId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");
      const user = c.get("user");
      const community = c.get("community");

      await postService.pinPost(user.id, profileId, postId, community.id);
      return c.json({
        data: {
          post_id: postId,
          pinned: true,
          pinned_at: new Date().toISOString(),
        },
      });
    },
  )
  .delete(
    "/posts/:post_id/pin",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const { post_id: postId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");
      const user = c.get("user");
      const community = c.get("community");

      await postService.unpinPost(user.id, profileId, postId, community.id);
      return c.json({ data: { post_id: postId, pinned: false } });
    },
  );
