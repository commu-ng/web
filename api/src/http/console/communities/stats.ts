import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import { communityIdParamSchema } from "./schemas";

const activityQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).optional().default(30),
});

export const statsRouter = new Hono()
  .get(
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
      await membershipService.validateMembershipRole(user.id, communityId, [
        "owner",
        "moderator",
      ]);

      const stats = await communityService.getCommunityStats(communityId);
      return c.json(stats);
    },
  )
  .get(
    "/:id/activity",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("query", activityQuerySchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const { days } = c.req.valid("query");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      const communityId = community.id;

      // Check if user is owner or moderator
      await membershipService.validateMembershipRole(user.id, communityId, [
        "owner",
        "moderator",
      ]);

      const activityStats = await communityService.getCommunityActivityStats(
        communityId,
        days,
      );
      return c.json(activityStats);
    },
  );
