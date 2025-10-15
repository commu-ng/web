import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { AppException } from "../../exception";
import { authMiddleware } from "../../middleware/auth";
import {
  boardCreateRequestSchema,
  boardIdParamSchema,
  boardPostCreateRequestSchema,
  boardPostIdParamSchema,
  boardPostQuerySchema,
  boardPostUpdateRequestSchema,
  boardSlugParamSchema,
  boardUpdateRequestSchema,
} from "../../schemas";
import * as boardPostService from "../../services/board-post.service";
import type { AuthVariables } from "../../types";

export const consoleBoardsRouter = new Hono<{ Variables: AuthVariables }>()
  // Get all boards (public)
  .get("/boards", async (c) => {
    const boards = await boardPostService.getBoards();
    return c.json(boards);
  })

  // Create a new board (admin only)
  .post(
    "/boards",
    authMiddleware,
    zValidator("json", boardCreateRequestSchema),
    async (c) => {
      const user = c.get("user");

      // Check if user is admin
      if (!user.isAdmin) {
        return c.json({ error: "관리자만 게시판을 생성할 수 있습니다" }, 403);
      }

      const { name, slug, description } = c.req.valid("json");

      try {
        const board = await boardPostService.createBoard(
          name,
          slug,
          description,
        );
        return c.json(board, 201);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Get a single board by ID
  .get(
    "/boards/:board_id",
    authMiddleware,
    zValidator("param", boardIdParamSchema),
    async (c) => {
      const { board_id: boardId } = c.req.valid("param");

      try {
        const board = await boardPostService.getBoard(boardId);
        return c.json(board);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Get a single board by slug (public)
  .get(
    "/board/:board_slug",
    zValidator("param", boardSlugParamSchema),
    async (c) => {
      const { board_slug: boardSlug } = c.req.valid("param");

      try {
        const board = await boardPostService.getBoardBySlug(boardSlug);
        return c.json(board);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Get hashtags for a board (public)
  .get(
    "/board/:board_slug/hashtags",
    zValidator("param", boardSlugParamSchema),
    async (c) => {
      const { board_slug: boardSlug } = c.req.valid("param");

      try {
        const board = await boardPostService.getBoardBySlug(boardSlug);
        const hashtags = await boardPostService.getBoardHashtags(board.id);
        return c.json(hashtags);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Update a board (admin only)
  .patch(
    "/boards/:board_id",
    authMiddleware,
    zValidator("param", boardIdParamSchema),
    zValidator("json", boardUpdateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { board_id: boardId } = c.req.valid("param");
      const { name, slug, description } = c.req.valid("json");

      // Check if user is admin
      if (!user.isAdmin) {
        return c.json({ error: "관리자만 게시판을 수정할 수 있습니다" }, 403);
      }

      try {
        const board = await boardPostService.updateBoard(
          boardId,
          name,
          slug,
          description,
        );
        return c.json(board);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Delete a board (admin only)
  .delete(
    "/boards/:board_id",
    authMiddleware,
    zValidator("param", boardIdParamSchema),
    async (c) => {
      const user = c.get("user");
      const { board_id: boardId } = c.req.valid("param");

      // Check if user is admin
      if (!user.isAdmin) {
        return c.json({ error: "관리자만 게시판을 삭제할 수 있습니다" }, 403);
      }

      try {
        await boardPostService.deleteBoard(boardId);
        return c.json({ message: "게시판이 성공적으로 삭제되었습니다" });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Get board posts (public)
  .get(
    "/board/:board_slug/posts",
    zValidator("param", boardSlugParamSchema),
    zValidator("query", boardPostQuerySchema),
    async (c) => {
      const { board_slug: boardSlug } = c.req.valid("param");
      const { limit = 20, cursor, hashtags } = c.req.valid("query");

      try {
        const board = await boardPostService.getBoardBySlug(boardSlug);
        const hashtagsArray = hashtags
          ? hashtags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0)
          : undefined;
        const result = await boardPostService.getBoardPosts(
          board.id,
          limit,
          cursor,
          hashtagsArray,
        );
        return c.json(result);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Create a board post
  .post(
    "/board/:board_slug/posts",
    authMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("json", boardPostCreateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { board_slug: boardSlug } = c.req.valid("param");
      const {
        title,
        content,
        image_id: imageId,
        hashtags,
      } = c.req.valid("json");

      try {
        const board = await boardPostService.getBoardBySlug(boardSlug);
        const post = await boardPostService.createBoardPost(
          board.id,
          user.id,
          title,
          content,
          imageId,
          hashtags,
        );
        return c.json(post, 201);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Get a single board post (public)
  .get(
    "/board/:board_slug/posts/:board_post_id",
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    async (c) => {
      const { board_post_id: postId } = c.req.valid("param");

      try {
        const post = await boardPostService.getBoardPost(postId);
        return c.json(post);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Update a board post
  .patch(
    "/board/:board_slug/posts/:board_post_id",
    authMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    zValidator("json", boardPostUpdateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { board_post_id: postId } = c.req.valid("param");
      const {
        title,
        content,
        image_id: imageId,
        hashtags,
      } = c.req.valid("json");

      try {
        const post = await boardPostService.updateBoardPost(
          postId,
          user.id,
          title,
          content,
          imageId,
          hashtags,
        );
        return c.json(post);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Delete a board post
  .delete(
    "/board/:board_slug/posts/:board_post_id",
    authMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    async (c) => {
      const user = c.get("user");
      const { board_post_id: postId } = c.req.valid("param");

      try {
        await boardPostService.deleteBoardPost(postId, user.id);
        return c.json({ message: "게시물이 성공적으로 삭제되었습니다" });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  );
