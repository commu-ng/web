import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { AppException } from "../../../exception";
import { authMiddleware } from "../../../middleware/auth";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import { communityIdParamSchema } from "./schemas";

export const statsRouter = new Hono().get(
  "/:id/stats",
  authMiddleware,
  zValidator("param", communityIdParamSchema),
  async (c) => {
    const { id: slug } = c.req.valid("param");
    const user = c.get("user");

    // Validate community exists and get its ID
    const community =
      await communityService.validateCommunityExistsBySlug(slug);
    const communityId = community.id;

    // Check if user is owner or moderator
    try {
      await membershipService.validateMembershipRole(user.id, communityId, [
        "owner",
        "moderator",
      ]);
    } catch (error) {
      if (error instanceof AppException) {
        return c.json({ error: error.message }, error.statusCode);
      }
      return c.json({ error: "접근이 거부되었습니다" }, 403);
    }

    try {
      const stats = await communityService.getCommunityStats(communityId);
      return c.json(stats);
    } catch (error) {
      if (error instanceof AppException) {
        return c.json({ error: error.message }, error.statusCode);
      }
      throw error;
    }
  },
);
