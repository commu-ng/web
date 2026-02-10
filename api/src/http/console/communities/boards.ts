import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth";
import * as communityBoardService from "../../../services/community-board.service";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import { communityIdParamSchema } from "./schemas";

const communityBoardParamSchema = z.object({
  id: z.string().min(1),
  boardId: z.uuid(),
});

const communityBoardCreateSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  slug: z
    .string()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Invalid slug format"),
  description: z.string().max(1000).optional().nullable(),
  allow_comments: z.boolean().optional().default(true),
});

const communityBoardUpdateSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  slug: z
    .string()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Invalid slug format"),
  description: z.string().max(1000).optional().nullable(),
  allow_comments: z.boolean().optional(),
});

export const boardsRouter = new Hono()
  .get(
    "/:id/boards",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user has access (owner or moderator)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);

      const boards = await communityBoardService.getCommunityBoards(
        community.id,
      );
      return c.json({ data: boards });
    },
  )
  .post(
    "/:id/boards",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", communityBoardCreateSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const {
        name,
        slug: boardSlug,
        description,
        allow_comments,
      } = c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user is owner
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      const board = await communityBoardService.createCommunityBoard(
        community.id,
        name,
        boardSlug,
        description,
        allow_comments,
      );
      return c.json({ data: board }, 201);
    },
  )
  .get(
    "/:id/boards/:boardId",
    authMiddleware,
    zValidator("param", communityBoardParamSchema),
    async (c) => {
      const { id: slug, boardId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user has access (owner or moderator)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);

      const board = await communityBoardService.getCommunityBoardById(
        community.id,
        boardId,
      );
      return c.json({ data: board });
    },
  )
  .patch(
    "/:id/boards/:boardId",
    authMiddleware,
    zValidator("param", communityBoardParamSchema),
    zValidator("json", communityBoardUpdateSchema),
    async (c) => {
      const { id: slug, boardId } = c.req.valid("param");
      const user = c.get("user");
      const {
        name,
        slug: boardSlug,
        description,
        allow_comments,
      } = c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user is owner
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      const updatedBoard = await communityBoardService.updateCommunityBoard(
        community.id,
        boardId,
        name,
        boardSlug,
        description,
        allow_comments,
      );
      return c.json({ data: updatedBoard });
    },
  )
  .delete(
    "/:id/boards/:boardId",
    authMiddleware,
    zValidator("param", communityBoardParamSchema),
    async (c) => {
      const { id: slug, boardId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user is owner
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      await communityBoardService.deleteCommunityBoard(community.id, boardId);
      return c.body(null, 204);
    },
  );
