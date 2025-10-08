import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { logger } from "../../../config/logger";
import { AppException } from "../../../exception";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../../middleware/auth";
import {
  communityCreateRequestSchema,
  communityUpdateRequestSchema,
} from "../../../schemas";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import { communityIdParamSchema } from "./schemas";

export const crudRouter = new Hono()
  .post(
    "/",
    authMiddleware,
    zValidator("json", communityCreateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const {
        name,
        slug,
        starts_at: startsAt,
        ends_at: endsAt,
        is_recruiting: isRecruiting,
        recruiting_starts_at: recruitingStartsAt,
        recruiting_ends_at: recruitingEndsAt,
        minimum_birth_year,
        image_id,
        hashtags,
        profile_username,
        profile_name,
        description,
        mute_new_members,
      } = c.req.valid("json");

      try {
        const result = await communityService.createCommunity(user.id, {
          name,
          slug,
          startsAt,
          endsAt,
          recruiting: isRecruiting,
          recruitingStartsAt,
          recruitingEndsAt,
          minimumBirthYear: minimum_birth_year,
          imageId: image_id,
          hashtags,
          profileUsername: profile_username,
          profileName: profile_name,
          description,
          muteNewMembers: mute_new_members,
        });

        return c.json(
          {
            id: result.community.id,
            name: result.community.name,
            domain: result.community.slug,
            starts_at: result.community.startsAt,
            ends_at: result.community.endsAt,
            is_recruiting: result.community.isRecruiting,
            owner_profile_id: result.profile.id,
            created_at: result.community.createdAt,
          },
          201,
        );
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        logger.http.error("Error creating community", { error });
        return c.json({ error: "커뮤 생성에 실패했습니다" }, 500);
      }
    },
  )
  .get("/mine", authMiddleware, async (c) => {
    const user = c.get("user");
    const result = await communityService.getUserCommunities(user.id);
    return c.json(result);
  })
  .get("/recruiting", optionalAuthMiddleware, async (c) => {
    const user = c.get("user");
    const result =
      await communityService.getRecruitingCommunitiesWithUserContext(user?.id);
    return c.json(result);
  })
  .get(
    "/:id",
    optionalAuthMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");

      try {
        // Validate community exists and get its ID
        const community =
          await communityService.validateCommunityExistsBySlug(slug);

        const result = await communityService.getCommunityDetailWithUserContext(
          community.id,
          user?.id,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: "커뮤 조회에 실패했습니다" }, 500);
      }
    },
  )
  .put(
    "/:id",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", communityUpdateRequestSchema),
    async (c) => {
      const { id: slugParam } = c.req.valid("param");
      const user = c.get("user");
      const {
        name,
        slug,
        starts_at: startsAt,
        ends_at: endsAt,
        is_recruiting: isRecruiting,
        recruiting_starts_at: recruitingStartsAt,
        recruiting_ends_at: recruitingEndsAt,
        minimum_birth_year,
        image_id,
        hashtags,
        description,
        description_image_ids,
        mute_new_members,
      } = c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slugParam);
      const communityId = community.id;

      // Check if user is the owner
      try {
        await membershipService.validateMembershipRole(user.id, communityId, [
          "owner",
        ]);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: "커뮤 소유자만 업데이트할 수 있습니다" }, 403);
      }

      // Update community using service
      try {
        const { community: updatedCommunity, ownerProfileId } =
          await communityService.updateCommunity(communityId, {
            name,
            slug,
            startsAt,
            endsAt,
            recruiting: isRecruiting,
            recruitingStartsAt,
            recruitingEndsAt,
            minimumBirthYear: minimum_birth_year,
            imageId: image_id,
            hashtags,
            description,
            descriptionImageIds: description_image_ids,
            muteNewMembers: mute_new_members,
          });

        return c.json({
          id: updatedCommunity.id,
          name: updatedCommunity.name,
          domain: updatedCommunity.slug,
          starts_at: updatedCommunity.startsAt,
          ends_at: updatedCommunity.endsAt,
          is_recruiting: updatedCommunity.isRecruiting,
          recruiting_starts_at: updatedCommunity.recruitingStartsAt,
          recruiting_ends_at: updatedCommunity.recruitingEndsAt,
          minimum_birth_year: updatedCommunity.minimumBirthYear,
          owner_profile_id: ownerProfileId,
          created_at: updatedCommunity.createdAt,
          updated_at: updatedCommunity.updatedAt,
        });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        logger.http.error("Error updating community", { error });
        return c.json({ error: "커뮤 업데이트에 실패했습니다" }, 500);
      }
    },
  )
  .delete(
    "/:id",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      const communityId = community.id;

      // Check if user is the owner
      try {
        await membershipService.validateMembershipRole(user.id, communityId, [
          "owner",
        ]);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: "커뮤 소유자만 삭제할 수 있습니다" }, 403);
      }

      // Delete community using service
      try {
        await communityService.deleteCommunity(communityId);
        return c.json({ message: "커뮤가 성공적으로 삭제되었습니다" });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        logger.http.error("Error deleting community", { error });
        return c.json({ error: "커뮤 삭제에 실패했습니다" }, 500);
      }
    },
  );
