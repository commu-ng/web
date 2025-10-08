import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { logger } from "../../config/logger";
import { AppException } from "../../exception";
import {
  appAuthMiddleware,
  optionalAppAuthMiddleware,
} from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import { membershipMiddleware } from "../../middleware/membership";
import {
  conversationsQuerySchema,
  optionalProfileIdQuerySchema,
  paginationQuerySchema,
  postCreateRequestSchema,
  postIdParamSchema,
  postQuerySchema,
  postReactionCreateSchema,
  postReactionDeleteSchema,
  postSearchQuerySchema,
  profileIdQuerySchema,
  scheduledPostsQuerySchema,
} from "../../schemas";
import * as exportJobService from "../../services/export-job.service";
import * as postService from "../../services/post.service";
import * as profileService from "../../services/profile.service";
import { getFileUrl } from "../../utils/r2";
import type { AuthVariables } from "../../types";
import { z } from "zod";

const exportJobIdParamSchema = z.object({
  job_id: z.string().uuid(),
});

export const postsRouter = new Hono<{ Variables: AuthVariables }>()
  .post(
    "/export",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");

      try {
        const job = await exportJobService.createExportJob(
          community.id,
          user.id,
        );

        return c.json(
          {
            job_id: job.id,
            status: job.status,
            created_at: job.createdAt,
          },
          202,
        );
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        logger.http.error("Error creating export job", { error });
        return c.json({ error: "내보내기 요청에 실패했습니다" }, 500);
      }
    },
  )
  .get(
    "/export/:job_id",
    appAuthMiddleware,
    zValidator("param", exportJobIdParamSchema),
    async (c) => {
      const { job_id: jobId } = c.req.valid("param");
      const user = c.get("user");

      try {
        const job = await exportJobService.getExportJobStatus(jobId, user.id);

        return c.json({
          id: job.id,
          status: job.status,
          download_url: job.r2Key ? getFileUrl(job.r2Key) : null,
          expires_at: job.expiresAt,
          error: job.errorMessage,
          created_at: job.createdAt,
          completed_at: job.completedAt,
        });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        logger.http.error("Error getting export job status", { error });
        return c.json({ error: "내보내기 상태 조회에 실패했습니다" }, 500);
      }
    },
  )
  .get("/exports", appAuthMiddleware, communityMiddleware, async (c) => {
    const user = c.get("user");
    const community = c.get("community");

    try {
      const exports = await exportJobService.getUserExports(
        user.id,
        community.id,
      );

      return c.json(exports);
    } catch (error: unknown) {
      logger.http.error("Error getting user exports", { error });
      return c.json({ error: "내보내기 내역 조회에 실패했습니다" }, 500);
    }
  })
  .post("/upload/file", appAuthMiddleware, async (c) => {
    // Check Content-Type before parsing formData
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

      const result = await postService.uploadImage(
        fileBuffer,
        file.name,
        fileContentType,
        file.size,
      );

      return c.json(result, 201);
    } catch (error: unknown) {
      if (error instanceof AppException) {
        return c.json({ error: error.message }, error.statusCode);
      }
      logger.http.error("Error uploading file", { error });
      return c.json({ error: "파일 업로드에 실패했습니다" }, 500);
    }
  })
  .get(
    "/announcements",
    optionalAppAuthMiddleware,
    communityMiddleware,
    zValidator("query", paginationQuerySchema),
    async (c) => {
      const community = c.get("community");
      const { limit = 10, offset = 0 } = c.req.valid("query");

      const result = await postService.getAnnouncements(
        community.id,
        limit,
        offset,
      );

      return c.json(result);
    },
  )
  .get(
    "/bookmarks",
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

      // Find and validate the profile using new ownership system
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
      );

      if (!profile) {
        return c.json(
          { message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다" },
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
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("query", postSearchQuerySchema),
    async (c) => {
      const community = c.get("community");
      const { q, limit = 20, cursor, profile_id } = c.req.valid("query");

      try {
        const result = await postService.searchPosts(
          q,
          community.id,
          limit,
          cursor,
          profile_id,
        );

        return c.json(result);
      } catch (error: unknown) {
        logger.http.error("Error searching posts", { error });
        return c.json({ error: "게시물 검색에 실패했습니다" }, 500);
      }
    },
  )
  .get(
    "/scheduled-posts",
    appAuthMiddleware,
    communityMiddleware,
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
          { message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다" },
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
    appAuthMiddleware,
    communityMiddleware,
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
          { message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다" },
          404,
        );
      }

      try {
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

        return c.json(result, 201);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        logger.http.error("Error creating post", { error });
        return c.json({ error: "게시물 생성에 실패했습니다" }, 500);
      }
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

      try {
        const post = await postService.getPost(postId, community.id, profileId);
        return c.json(post);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: "게시물 조회에 실패했습니다" }, 500);
      }
    },
  )

  .delete(
    "/posts/:post_id",
    appAuthMiddleware,
    communityMiddleware,
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
          { message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다" },
          404,
        );
      }

      try {
        await postService.deletePost(user.id, profile.id, postId, community.id);

        return c.json({ message: "게시물이 성공적으로 삭제되었습니다" });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: "게시물 삭제에 실패했습니다" }, 500);
      }
    },
  )
  .post(
    "/posts/:post_id/bookmark",
    appAuthMiddleware,
    communityMiddleware,
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
          { message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다" },
          404,
        );
      }

      try {
        const result = await postService.createBookmark(
          profile.id,
          postId,
          community.id,
        );

        return c.json(result, 201);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        logger.http.error("Error creating bookmark", { error });
        return c.json({ error: "게시물 북마크에 실패했습니다" }, 400);
      }
    },
  )
  .delete(
    "/posts/:post_id/bookmark",
    appAuthMiddleware,
    communityMiddleware,
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
          { message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다" },
          404,
        );
      }

      try {
        await postService.deleteBookmark(profile.id, postId, community.id);

        return c.json({ message: "북마크가 성공적으로 제거되었습니다" });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: "북마크 제거에 실패했습니다" }, 500);
      }
    },
  )
  .post(
    "/posts/:post_id/reactions",
    appAuthMiddleware,
    communityMiddleware,
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
        return c.json({ error: "프로필을 찾을 수 없습니다" }, 404);
      }

      try {
        const result = await postService.createReaction(
          profile.id,
          postId,
          community.id,
          emoji,
          profile.name,
        );

        return c.json(result, 201);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: "반응 추가에 실패했습니다" }, 500);
      }
    },
  )

  .delete(
    "/posts/:post_id/reactions",
    appAuthMiddleware,
    communityMiddleware,
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
        return c.json({ error: "프로필을 찾을 수 없습니다" }, 404);
      }

      try {
        await postService.deleteReaction(
          profile.id,
          postId,
          community.id,
          emoji,
        );

        return c.json(
          {
            message: "반응이 성공적으로 제거되었습니다",
          },
          200,
        );
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: "반응 제거에 실패했습니다" }, 500);
      }
    },
  )
  .post(
    "/posts/:post_id/pin",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const { post_id: postId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");
      const user = c.get("user");
      const community = c.get("community");

      try {
        await postService.pinPost(user.id, profileId, postId, community.id);
        return c.json({ message: "게시물이 성공적으로 고정되었습니다" });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        logger.http.error("Error pinning post", { error });
        return c.json({ error: "게시물 고정에 실패했습니다" }, 500);
      }
    },
  )
  .delete(
    "/posts/:post_id/pin",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("param", postIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const { post_id: postId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");
      const user = c.get("user");
      const community = c.get("community");

      try {
        await postService.unpinPost(user.id, profileId, postId, community.id);
        return c.json({ message: "게시물 고정이 성공적으로 해제되었습니다" });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        logger.http.error("Error unpinning post", { error });
        return c.json({ error: "게시물 고정 해제에 실패했습니다" }, 500);
      }
    },
  );
