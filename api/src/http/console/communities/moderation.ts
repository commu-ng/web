import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth";
import * as communityService from "../../../services/community.service";
import * as moderationService from "../../../services/moderation.service";

const communityIdParamSchema = z.object({
  id: z.string(),
});

const profileIdParamSchema = z.object({
  profileId: z.string().uuid(),
});

const muteProfileSchema = z.object({
  reason: z.string().optional(),
});

export const moderationRouter = new Hono()
  .post(
    "/:id/profiles/:profileId/mute",
    authMiddleware,
    zValidator("param", communityIdParamSchema.merge(profileIdParamSchema)),
    zValidator("json", muteProfileSchema),
    async (c) => {
      const user = c.get("user");
      const { id: slug, profileId } = c.req.valid("param");
      const { reason } = c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      const result = await moderationService.muteProfile(
        user.id,
        community.id,
        profileId,
        reason,
      );

      return c.json({ data: result });
    },
  )
  .delete(
    "/:id/profiles/:profileId/mute",
    authMiddleware,
    zValidator("param", communityIdParamSchema.merge(profileIdParamSchema)),
    async (c) => {
      const user = c.get("user");
      const { id: slug, profileId } = c.req.valid("param");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      const result = await moderationService.unmuteProfile(
        user.id,
        community.id,
        profileId,
      );

      return c.json({ data: result });
    },
  );
