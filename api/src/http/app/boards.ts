import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { appAuthMiddleware } from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import { membershipMiddleware } from "../../middleware/membership";
import * as communityBoardService from "../../services/community-board.service";
import * as profileService from "../../services/profile.service";
import type { AuthVariables } from "../../types";
import { GeneralErrorCode } from "../../types/api-responses";

const boardSlugParamSchema = z.object({
  slug: z.string().min(1),
});

const boardPostIdParamSchema = z.object({
  slug: z.string().min(1),
  postId: z.uuid(),
});

const boardPostsQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional(),
  profile_id: z.uuid(),
});

const boardRepliesQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional(),
  profile_id: z.uuid(),
});

const boardPostCreateSchema = z.object({
  profile_id: z.uuid(),
  title: z.string().min(1, "Title cannot be empty").max(200),
  content: z.string().min(1, "Content cannot be empty").max(50000),
  image_id: z.uuid().optional().nullable(),
});

const boardPostUpdateSchema = z.object({
  profile_id: z.uuid(),
  title: z.string().min(1, "Title cannot be empty").max(200),
  content: z.string().min(1, "Content cannot be empty").max(50000),
  image_id: z.uuid().optional().nullable(),
});

const boardReplyCreateSchema = z.object({
  profile_id: z.uuid(),
  content: z.string().min(1, "Content cannot be empty").max(10000),
  in_reply_to_id: z.uuid().optional(),
});

const profileIdQuerySchema = z.object({
  profile_id: z.uuid(),
});

export const communityBoardsRouter = new Hono<{ Variables: AuthVariables }>()
  // List all boards for the community
  .get(
    "/boards",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    async (c) => {
      const community = c.get("community");

      const boards = await communityBoardService.getCommunityBoards(
        community.id,
      );
      return c.json({ data: boards });
    },
  )
  // Get a single board by slug
  .get(
    "/boards/:slug",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", boardSlugParamSchema),
    async (c) => {
      const community = c.get("community");
      const { slug } = c.req.valid("param");

      const board = await communityBoardService.getCommunityBoardBySlug(
        community.id,
        slug,
      );
      return c.json({ data: board });
    },
  )
  // Get posts for a board
  .get(
    "/boards/:slug/posts",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("query", boardPostsQuerySchema),
    async (c) => {
      const community = c.get("community");
      const user = c.get("user");
      const { slug } = c.req.valid("param");
      const { limit = 20, cursor, profile_id } = c.req.valid("query");

      // Validate profile belongs to the current user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "Profile not found or does not belong to you",
            },
          },
          404,
        );
      }

      // Get the board first
      const board = await communityBoardService.getCommunityBoardBySlug(
        community.id,
        slug,
      );

      const result = await communityBoardService.getCommunityBoardPosts(
        board.id,
        limit,
        cursor,
      );

      return c.json(result);
    },
  )
  // Get a single post
  .get(
    "/boards/:slug/posts/:postId",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", boardPostIdParamSchema),
    async (c) => {
      const { postId } = c.req.valid("param");

      const post = await communityBoardService.getCommunityBoardPost(postId);
      return c.json({ data: post });
    },
  )
  // Create a post
  .post(
    "/boards/:slug/posts",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("json", boardPostCreateSchema),
    async (c) => {
      const community = c.get("community");
      const user = c.get("user");
      const { slug } = c.req.valid("param");
      const { profile_id, title, content, image_id } = c.req.valid("json");

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
              message: "Profile not found or does not belong to you",
            },
          },
          404,
        );
      }

      // Get the board first
      const board = await communityBoardService.getCommunityBoardBySlug(
        community.id,
        slug,
      );

      const post = await communityBoardService.createCommunityBoardPost(
        board.id,
        profile.id,
        title,
        content,
        image_id,
      );

      return c.json({ data: post }, 201);
    },
  )
  // Update a post
  .patch(
    "/boards/:slug/posts/:postId",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", boardPostIdParamSchema),
    zValidator("json", boardPostUpdateSchema),
    async (c) => {
      const community = c.get("community");
      const user = c.get("user");
      const { postId } = c.req.valid("param");
      const { profile_id, title, content, image_id } = c.req.valid("json");

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
              message: "Profile not found or does not belong to you",
            },
          },
          404,
        );
      }

      const post = await communityBoardService.updateCommunityBoardPost(
        postId,
        profile.id,
        title,
        content,
        image_id,
      );

      return c.json({ data: post });
    },
  )
  // Delete a post
  .delete(
    "/boards/:slug/posts/:postId",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", boardPostIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const community = c.get("community");
      const user = c.get("user");
      const { postId } = c.req.valid("param");
      const { profile_id } = c.req.valid("query");

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
              message: "Profile not found or does not belong to you",
            },
          },
          404,
        );
      }

      await communityBoardService.deleteCommunityBoardPost(postId, profile.id);

      return c.json({ data: { id: postId, deleted: true } });
    },
  )
  // Get replies for a post
  .get(
    "/boards/:slug/posts/:postId/replies",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", boardPostIdParamSchema),
    zValidator("query", boardRepliesQuerySchema),
    async (c) => {
      const { postId } = c.req.valid("param");
      const { limit = 20, cursor } = c.req.valid("query");

      const result = await communityBoardService.getCommunityBoardPostReplies(
        postId,
        limit,
        cursor,
      );

      return c.json(result);
    },
  )
  // Create a reply
  .post(
    "/boards/:slug/posts/:postId/replies",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", boardPostIdParamSchema),
    zValidator("json", boardReplyCreateSchema),
    async (c) => {
      const community = c.get("community");
      const user = c.get("user");
      const { postId } = c.req.valid("param");
      const { profile_id, content, in_reply_to_id } = c.req.valid("json");

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
              message: "Profile not found or does not belong to you",
            },
          },
          404,
        );
      }

      const reply = await communityBoardService.createCommunityBoardPostReply(
        postId,
        profile.id,
        content,
        in_reply_to_id,
      );

      return c.json({ data: reply }, 201);
    },
  )
  // Delete a reply
  .delete(
    "/boards/:slug/posts/:postId/replies/:replyId",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator(
      "param",
      z.object({
        slug: z.string().min(1),
        postId: z.uuid(),
        replyId: z.uuid(),
      }),
    ),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const community = c.get("community");
      const user = c.get("user");
      const { replyId } = c.req.valid("param");
      const { profile_id } = c.req.valid("query");

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
              message: "Profile not found or does not belong to you",
            },
          },
          404,
        );
      }

      await communityBoardService.deleteCommunityBoardPostReply(
        replyId,
        profile.id,
      );

      return c.json({ data: { id: replyId, deleted: true } });
    },
  );
