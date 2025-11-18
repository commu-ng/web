import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { authMiddleware } from "../../../middleware/auth";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import {
  communityIdParamSchema,
  communityMemberParamSchema,
  memberRoleUpdateSchema,
  paginationQuerySchema,
} from "./schemas";

export const membersRouter = new Hono()
  .delete(
    "/:id/members/:membership_id",
    authMiddleware,
    zValidator("param", communityMemberParamSchema),
    async (c) => {
      const { id: slug, membership_id: membershipId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      await membershipService.removeMember(community.id, membershipId, user.id);
      return c.json({ message: "회원이 성공적으로 제거되었습니다" });
    },
  )
  .delete(
    "/:id/leave",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      await membershipService.leaveCommunity(user.id, community.id);
      return c.json({ message: "커뮤에서 성공적으로 나갔습니다" });
    },
  )
  .get(
    "/:id/members",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("query", paginationQuerySchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const { limit = 50, offset = 0 } = c.req.valid("query");

      // Check if user has permission (must be owner only)
      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      // Get community members with profiles
      const result = await membershipService.getCommunityMembers(
        community.id,
        user.id,
        { limit, offset },
      );

      return c.json(result);
    },
  )
  .put(
    "/:id/members/role",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", memberRoleUpdateSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const { membership_id: membershipId, role: newRole } =
        c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      const result = await membershipService.updateMemberRole(
        community.id,
        membershipId,
        newRole,
        user.id,
      );

      // Check if ownership was transferred
      if (
        typeof result === "object" &&
        "transferred" in result &&
        result.transferred
      ) {
        return c.json({ message: "소유권이 성공적으로 이전되었습니다" });
      }

      return c.json({ message: "회원 역할이 성공적으로 업데이트되었습니다" });
    },
  );
