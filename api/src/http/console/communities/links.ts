import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../../middleware/auth";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import {
  communityIdParamSchema,
  communityLinkCreateSchema,
  communityLinkParamSchema,
  communityLinkUpdateSchema,
} from "./schemas";

export const linksRouter = new Hono()
  .get(
    "/:id/links",
    optionalAuthMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      const links = await communityService.getCommunityLinks(community.id);
      return c.json(
        links.map((link) => ({
          id: link.id,
          title: link.title,
          url: link.url,
          created_at: link.createdAt,
          updated_at: link.updatedAt,
        })),
      );
    },
  )
  .post(
    "/:id/links",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", communityLinkCreateSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const { title, url } = c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user is owner
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      const link = await communityService.createCommunityLink(
        community.id,
        title,
        url,
      );
      return c.json({
        id: link.id,
        title: link.title,
        url: link.url,
        created_at: link.createdAt,
        updated_at: link.updatedAt,
      });
    },
  )
  .put(
    "/:id/links/:linkId",
    authMiddleware,
    zValidator("param", communityLinkParamSchema),
    zValidator("json", communityLinkUpdateSchema),
    async (c) => {
      const { id: slug, linkId } = c.req.valid("param");
      const user = c.get("user");
      const { title, url } = c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check permissions
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      const updatedLink = await communityService.updateCommunityLink(
        community.id,
        linkId,
        title,
        url,
      );
      return c.json({
        id: updatedLink.id,
        title: updatedLink.title,
        url: updatedLink.url,
        created_at: updatedLink.createdAt,
        updated_at: updatedLink.updatedAt,
      });
    },
  )
  .delete(
    "/:id/links/:linkId",
    authMiddleware,
    zValidator("param", communityLinkParamSchema),
    async (c) => {
      const { id: slug, linkId } = c.req.valid("param");
      const user = c.get("user");

      // Check permissions
      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      await communityService.deleteCommunityLink(community.id, linkId);
      return c.json({ message: "링크가 성공적으로 삭제되었습니다" });
    },
  );
