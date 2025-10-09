import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { AppException } from "../../../exception";
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

      try {
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
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
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
      try {
        await membershipService.validateMembershipRole(user.id, community.id, [
          "owner",
        ]);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json(
          { error: "커뮤 소유자만 링크를 관리할 수 있습니다" },
          403,
        );
      }

      try {
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
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
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
      try {
        await membershipService.validateMembershipRole(user.id, community.id, [
          "owner",
        ]);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json(
          { error: "커뮤 소유자만 링크를 관리할 수 있습니다" },
          403,
        );
      }

      try {
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
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  .delete(
    "/:id/links/:linkId",
    authMiddleware,
    zValidator("param", communityLinkParamSchema),
    async (c) => {
      const { id: slug, linkId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check permissions
      try {
        await membershipService.validateMembershipRole(user.id, community.id, [
          "owner",
        ]);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json(
          { error: "커뮤 소유자만 링크를 관리할 수 있습니다" },
          403,
        );
      }

      try {
        await communityService.deleteCommunityLink(community.id, linkId);
        return c.json({ message: "링크가 성공적으로 삭제되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  );
