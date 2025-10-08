import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { logger } from "../config/logger";
import { db } from "../db";
import {
  communityApplication as communityApplicationTable,
  communityBannerImage as communityBannerImageTable,
  communityDescriptionImage as communityDescriptionImageTable,
  communityLink as communityLinkTable,
  community as communityTable,
  image as imageTable,
  membership as membershipTable,
  profileOwnership as profileOwnershipTable,
  profile as profileTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import {
  createCommunityHashtags,
  replaceCommunityHashtags,
} from "../utils/hashtag-helper";
import { sanitizeCommunityDescription } from "../utils/html-sanitizer";
import { getPrimaryProfileIdForUserInCommunity } from "../utils/profile-ownership";
import { addImageUrl } from "../utils/r2";
import * as imageService from "./image.service";

/**
 * Validate that a community exists and is not deleted
 */
export async function validateCommunityExists(communityId: string) {
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new AppException(404, "커뮤를 찾을 수 없습니다");
  }

  return community;
}

/**
 * Get community by custom domain
 */
export async function getCommunityByCustomDomain(customDomain: string) {
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.customDomain, customDomain),
      isNotNull(communityTable.domainVerifiedAt),
      isNull(communityTable.deletedAt),
    ),
  });

  return community;
}

/**
 * Get community by slug
 */
export async function getCommunityBySlug(slug: string) {
  const community = await db.query.community.findFirst({
    where: and(eq(communityTable.slug, slug), isNull(communityTable.deletedAt)),
  });

  return community;
}

/**
 * Validate that a community exists by slug and is not deleted
 */
export async function validateCommunityExistsBySlug(slug: string) {
  const community = await getCommunityBySlug(slug);

  if (!community) {
    throw new AppException(404, "커뮤를 찾을 수 없습니다");
  }

  return community;
}

/**
 * Create a new community with owner membership, profile, and metadata
 */
export async function createCommunity(
  userId: string,
  data: {
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    recruiting: boolean;
    recruitingStartsAt?: string | null;
    recruitingEndsAt?: string | null;
    minimumBirthYear?: number | null;
    imageId?: string | null;
    hashtags?: string[];
    profileUsername: string;
    profileName: string;
    description?: string | null;
    muteNewMembers?: boolean;
  },
) {
  // Validate image if provided
  if (data.imageId) {
    const image = await db.query.image.findFirst({
      where: and(eq(imageTable.id, data.imageId), isNull(imageTable.deletedAt)),
    });
    if (!image) {
      throw new AppException(400, "잘못된 이미지 ID입니다");
    }
  }

  try {
    // Create community in a transaction
    const result = await db.transaction(async (tx) => {
      const sanitizedDescription = data.description
        ? sanitizeCommunityDescription(data.description)
        : null;

      // Create community
      const newCommunityResult = await tx
        .insert(communityTable)
        .values({
          name: data.name,
          slug: data.slug,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          isRecruiting: data.recruiting,
          recruitingStartsAt: data.recruitingStartsAt,
          recruitingEndsAt: data.recruitingEndsAt,
          minimumBirthYear: data.minimumBirthYear,
          description: sanitizedDescription,
          muteNewMembers: data.muteNewMembers ?? false,
        })
        .returning();

      const newCommunity = newCommunityResult[0];
      if (!newCommunity) {
        throw new Error("Failed to create community");
      }

      // Create owner membership for the user
      await tx.insert(membershipTable).values({
        userId,
        communityId: newCommunity.id,
        role: "owner",
        activatedAt: sql`NOW()`,
      });

      // Create an Profile for the community owner
      const newProfileResult = await tx
        .insert(profileTable)
        .values({
          name: data.profileName,
          username: data.profileUsername,
          communityId: newCommunity.id,
          activatedAt: sql`NOW()`, // Community owner is immediately active
          isPrimary: true, // First profile is primary
        })
        .returning();

      const newProfile = newProfileResult[0];
      if (!newProfile) {
        throw new Error("Failed to create profile");
      }

      // Create ownership record for the profile
      await tx.insert(profileOwnershipTable).values({
        profileId: newProfile.id,
        userId: userId,
        role: "owner",
        createdBy: userId,
      });

      // Create banner image association if provided
      if (data.imageId) {
        await tx.insert(communityBannerImageTable).values({
          communityId: newCommunity.id,
          imageId: data.imageId,
        });
      }

      // Create hashtag associations if provided
      if (data.hashtags && data.hashtags.length > 0) {
        await createCommunityHashtags(newCommunity.id, data.hashtags, tx);
      }

      return {
        community: newCommunity,
        profile: newProfile,
      };
    });

    return result;
  } catch (error: unknown) {
    logger.service.error("Error creating community", { error });
    if (error instanceof Error && error.message.includes("unique_slug")) {
      throw new AppException(409, "이미 존재하는 커뮤 ID입니다");
    }
    throw new AppException(400, "커뮤 생성에 실패했습니다");
  }
}

/**
 * Update a community
 */
export async function updateCommunity(
  communityId: string,
  data: {
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    recruiting: boolean;
    recruitingStartsAt?: string | null;
    recruitingEndsAt?: string | null;
    minimumBirthYear?: number | null;
    imageId?: string | null;
    hashtags?: string[];
    description?: string | null;
    descriptionImageIds?: string[];
    muteNewMembers?: boolean;
  },
) {
  // Get existing community
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new AppException(404, "커뮤를 찾을 수 없습니다");
  }

  try {
    // Update community in a transaction
    const updatedCommunity = await db.transaction(async (tx) => {
      // Update community fields
      const sanitizedDescription = data.description
        ? sanitizeCommunityDescription(data.description)
        : null;

      const updatedCommunityResult = await tx
        .update(communityTable)
        .set({
          name: data.name,
          slug: data.slug,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          isRecruiting: data.recruiting,
          recruitingStartsAt: data.recruitingStartsAt,
          recruitingEndsAt: data.recruitingEndsAt,
          minimumBirthYear: data.minimumBirthYear,
          description: sanitizedDescription,
          muteNewMembers: data.muteNewMembers,
        })
        .where(eq(communityTable.id, communityId))
        .returning();

      const updated = updatedCommunityResult[0];
      if (!updated) {
        throw new Error("Failed to update community");
      }

      // Update hashtags
      if (data.hashtags) {
        await replaceCommunityHashtags(communityId, data.hashtags, tx);
      }

      // Update banner image if provided
      if (data.imageId) {
        // Remove existing banner images (soft delete)
        await tx
          .update(communityBannerImageTable)
          .set({ deletedAt: sql`NOW()` })
          .where(
            and(
              eq(communityBannerImageTable.communityId, communityId),
              isNull(communityBannerImageTable.deletedAt),
            ),
          );

        // Validate that the image exists and is not deleted
        const image = await tx.query.image.findFirst({
          where: and(
            eq(imageTable.id, data.imageId),
            isNull(imageTable.deletedAt),
          ),
        });
        if (!image) {
          throw new AppException(
            400,
            `잘못된 이미지 ID입니다: ${data.imageId}`,
          );
        }

        // Create new banner image association
        await tx.insert(communityBannerImageTable).values({
          communityId: communityId,
          imageId: data.imageId,
        });
      }

      // Update description images if provided
      if (data.descriptionImageIds) {
        // Get existing description images
        const existingDescImages =
          await tx.query.communityDescriptionImage.findMany({
            where: and(
              eq(communityDescriptionImageTable.communityId, communityId),
              isNull(communityDescriptionImageTable.deletedAt),
            ),
          });

        const existingImageIds = new Set(
          existingDescImages.map((img) => img.imageId),
        );
        const newImageIds = new Set(data.descriptionImageIds);

        // Soft delete images that are no longer in the description
        const imagesToRemove = existingDescImages
          .filter((img) => !newImageIds.has(img.imageId))
          .map((img) => img.id);

        if (imagesToRemove.length > 0) {
          await tx
            .update(communityDescriptionImageTable)
            .set({ deletedAt: sql`NOW()` })
            .where(inArray(communityDescriptionImageTable.id, imagesToRemove));
        }

        // Add new images
        const newImageIdsToAdd = data.descriptionImageIds.filter(
          (imageId) => !existingImageIds.has(imageId),
        );

        if (newImageIdsToAdd.length > 0) {
          // Batch validate all new images exist
          const validImages = await tx.query.image.findMany({
            where: and(
              inArray(imageTable.id, newImageIdsToAdd),
              isNull(imageTable.deletedAt),
            ),
          });

          if (validImages.length !== newImageIdsToAdd.length) {
            const validImageIds = new Set(validImages.map((img) => img.id));
            const invalidIds = newImageIdsToAdd.filter(
              (id) => !validImageIds.has(id),
            );
            throw new AppException(
              400,
              `잘못된 이미지 ID입니다: ${invalidIds.join(", ")}`,
            );
          }

          // Batch insert all new associations
          await tx.insert(communityDescriptionImageTable).values(
            newImageIdsToAdd.map((imageId) => ({
              communityId: communityId,
              imageId: imageId,
            })),
          );
        }
      }

      return updated;
    });

    const ownerMembership = await db.query.membership.findFirst({
      where: and(
        eq(membershipTable.communityId, updatedCommunity.id),
        eq(membershipTable.role, "owner"),
        isNotNull(membershipTable.activatedAt),
      ),
    });

    let ownerProfileId = null;
    if (ownerMembership?.userId) {
      ownerProfileId = await getPrimaryProfileIdForUserInCommunity(
        ownerMembership.userId,
        updatedCommunity.id,
      );
    }

    return {
      community: updatedCommunity,
      ownerProfileId,
    };
  } catch (error: unknown) {
    if (error instanceof AppException) {
      throw error;
    }
    logger.service.error("Error updating community", { error });
    if (error instanceof Error && error.message.includes("unique_slug")) {
      throw new AppException(409, "이미 존재하는 커뮤 ID입니다");
    }
    throw new AppException(400, "커뮤 업데이트에 실패했습니다");
  }
}

/**
 * Delete a community (soft delete)
 */
export async function deleteCommunity(communityId: string) {
  // Get existing community
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new AppException(404, "커뮤를 찾을 수 없습니다");
  }

  // Get banner images before transaction
  const bannerImages = await db.query.communityBannerImage.findMany({
    where: and(
      eq(communityBannerImageTable.communityId, communityId),
      isNull(communityBannerImageTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });

  // Get description images before transaction
  const descriptionImages = await db.query.communityDescriptionImage.findMany({
    where: and(
      eq(communityDescriptionImageTable.communityId, communityId),
      isNull(communityDescriptionImageTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });

  // Delete community in a transaction
  await db.transaction(async (tx) => {
    // Soft delete all community banner images
    if (bannerImages.length > 0) {
      const bannerImageIds = bannerImages.map((img) => img.id);
      await tx
        .update(communityBannerImageTable)
        .set({ deletedAt: sql`NOW()` })
        .where(inArray(communityBannerImageTable.id, bannerImageIds));
    }

    // Soft delete all community description images
    if (descriptionImages.length > 0) {
      const descImageIds = descriptionImages.map((img) => img.id);
      await tx
        .update(communityDescriptionImageTable)
        .set({ deletedAt: sql`NOW()` })
        .where(inArray(communityDescriptionImageTable.id, descImageIds));
    }

    // Soft delete the community
    await tx
      .update(communityTable)
      .set({
        deletedAt: sql`NOW()`,
      })
      .where(eq(communityTable.id, communityId));
  });

  // Delete images if unused (outside transaction since it might involve external calls)
  // Collect all image IDs
  const imageIdsToDelete = [
    ...bannerImages.filter((bi) => bi.image).map((bi) => bi.image.id),
    ...descriptionImages.filter((di) => di.image).map((di) => di.image.id),
  ];

  // Batch delete unused images
  if (imageIdsToDelete.length > 0) {
    await imageService.batchDeleteImagesIfUnused(imageIdsToDelete);
  }
}

/**
 * Delete a community banner image
 */
export async function deleteBannerImage(
  communityId: string,
  bannerImageId: string,
) {
  // Find the banner image association
  const bannerImage = await db.query.communityBannerImage.findFirst({
    where: and(
      eq(communityBannerImageTable.id, bannerImageId),
      eq(communityBannerImageTable.communityId, communityId),
      isNull(communityBannerImageTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });

  if (!bannerImage) {
    throw new AppException(404, "배너 이미지를 찾을 수 없습니다");
  }

  // Soft delete the banner image association
  await db
    .update(communityBannerImageTable)
    .set({ deletedAt: sql`NOW()` })
    .where(eq(communityBannerImageTable.id, bannerImage.id));

  // Delete the image if it's not used elsewhere
  if (bannerImage.image) {
    await imageService.deleteImageIfUnused(bannerImage.image.id);
  }
}

/**
 * Get all recruiting communities with hashtags
 * Filters by recruiting status and date ranges
 */
export async function getRecruitingCommunities() {
  const communities = await db.query.community.findMany({
    where: and(
      eq(communityTable.isRecruiting, true),
      isNull(communityTable.deletedAt),
      sql`${communityTable.endsAt} > NOW()`,
      // Check recruiting dates if they are set
      or(
        isNull(communityTable.recruitingStartsAt),
        sql`${communityTable.recruitingStartsAt} <= NOW()`,
      ),
      or(
        isNull(communityTable.recruitingEndsAt),
        sql`${communityTable.recruitingEndsAt} > NOW()`,
      ),
    ),
    orderBy: [desc(communityTable.createdAt)],
    with: {
      communityHashtags: {
        with: {
          hashtag: true,
        },
      },
    },
  });

  return communities;
}

/**
 * Get all links for a community
 */
export async function getCommunityLinks(communityId: string) {
  const links = await db.query.communityLink.findMany({
    where: and(
      eq(communityLinkTable.communityId, communityId),
      isNull(communityLinkTable.deletedAt),
    ),
    orderBy: [desc(communityLinkTable.createdAt)],
  });

  return links;
}

/**
 * Create a new community link
 */
export async function createCommunityLink(
  communityId: string,
  title: string,
  url: string,
) {
  const newLink = await db
    .insert(communityLinkTable)
    .values({
      communityId,
      title,
      url,
    })
    .returning();

  if (!newLink[0]) {
    throw new AppException(500, "링크 생성에 실패했습니다");
  }

  return newLink[0];
}

/**
 * Update a community link
 */
export async function updateCommunityLink(
  communityId: string,
  linkId: string,
  title: string,
  url: string,
) {
  const updatedLinks = await db
    .update(communityLinkTable)
    .set({ title, url })
    .where(
      and(
        eq(communityLinkTable.id, linkId),
        eq(communityLinkTable.communityId, communityId),
        isNull(communityLinkTable.deletedAt),
      ),
    )
    .returning();

  const updatedLink = updatedLinks[0];
  if (!updatedLink) {
    throw new AppException(404, "링크를 찾을 수 없습니다");
  }

  return updatedLink;
}

/**
 * Delete (soft delete) a community link
 */
export async function deleteCommunityLink(communityId: string, linkId: string) {
  const deletedLinks = await db
    .update(communityLinkTable)
    .set({ deletedAt: sql`NOW()` })
    .where(
      and(
        eq(communityLinkTable.id, linkId),
        eq(communityLinkTable.communityId, communityId),
        isNull(communityLinkTable.deletedAt),
      ),
    )
    .returning();

  if (deletedLinks.length === 0) {
    throw new AppException(404, "링크를 찾을 수 없습니다");
  }

  return deletedLinks[0];
}

/**
 * Get all communities that a user is a member of with enriched data
 * Returns communities with banner images, hashtags, and owner profile info
 */
export async function getUserCommunities(userId: string) {
  const communityTableWithRoles = await db.query.membership.findMany({
    where: and(
      eq(membershipTable.userId, userId),
      isNotNull(membershipTable.activatedAt),
    ),
    with: {
      community: {
        with: {
          communityHashtags: {
            with: {
              hashtag: true,
            },
          },
        },
      },
    },
  });

  // Filter out deleted communities and collect IDs
  const validMemberships = communityTableWithRoles.filter(
    (m) => m.community && !m.community.deletedAt,
  );
  const communityIds = validMemberships.map((m) => m.community.id);

  // Batch fetch banner images for all communities
  const bannerImages =
    communityIds.length > 0
      ? await imageService.getCommunityBannerInfo(communityIds)
      : new Map();

  // Batch fetch owner memberships for all communities
  const ownerMemberships =
    communityIds.length > 0
      ? await db.query.membership.findMany({
          where: and(
            inArray(membershipTable.communityId, communityIds),
            eq(membershipTable.role, "owner"),
            isNotNull(membershipTable.activatedAt),
          ),
        })
      : [];

  // Build map of community ID -> owner user ID
  const ownerUserIdMap = new Map(
    ownerMemberships.map((m) => [m.communityId, m.userId]),
  );

  // Batch fetch pending application counts for communities where user is owner or moderator
  const managedCommunityIds = validMemberships
    .filter((m) => m.role === "owner" || m.role === "moderator")
    .map((m) => m.community.id);

  const pendingApplicationCounts =
    managedCommunityIds.length > 0
      ? await db
          .select({
            communityId: communityApplicationTable.communityId,
            count: count(communityApplicationTable.id),
          })
          .from(communityApplicationTable)
          .where(
            and(
              inArray(
                communityApplicationTable.communityId,
                managedCommunityIds,
              ),
              eq(communityApplicationTable.status, "pending"),
            ),
          )
          .groupBy(communityApplicationTable.communityId)
      : [];

  // Build map of community ID -> pending application count
  const pendingCountMap = new Map(
    pendingApplicationCounts.map((c) => [c.communityId, Number(c.count)]),
  );

  // Collect all unique owner user IDs and their communities
  const ownerUserCommunityPairs = Array.from(ownerUserIdMap.entries()).map(
    ([communityId, userId]) => ({ userId, communityId }),
  );

  // Batch fetch primary profile IDs for all owners
  const ownerProfileIdsMap =
    ownerUserCommunityPairs.length > 0
      ? await getPrimaryProfileIdForUserInCommunity(ownerUserCommunityPairs)
      : new Map<string, string | null>();

  // Convert map keys from "userId:communityId" to just communityId
  const ownerProfileIds = new Map<string, string | null>();
  for (const { userId, communityId } of ownerUserCommunityPairs) {
    const key = `${userId}:${communityId}`;
    ownerProfileIds.set(communityId, ownerProfileIdsMap.get(key) || null);
  }

  const result = validMemberships.map((membership) => {
    const community = membership.community;
    const bannerInfo = bannerImages.get(community.id) || null;

    const hashtagTableData = community.communityHashtags.map((ch) => ({
      id: ch.hashtag.id,
      tag: ch.hashtag.tag,
    }));

    const ownerProfileId = ownerProfileIds.get(community.id) || null;
    const pendingApplicationCount = pendingCountMap.get(community.id) || 0;

    return {
      id: community.id,
      name: community.name,
      slug: community.slug,
      starts_at: community.startsAt,
      ends_at: community.endsAt,
      is_recruiting: community.isRecruiting,
      recruiting_starts_at: community.recruitingStartsAt,
      recruiting_ends_at: community.recruitingEndsAt,
      minimum_birth_year: community.minimumBirthYear,
      created_at: community.createdAt,
      role: membership.role,
      custom_domain: community.customDomain,
      domain_verified: community.domainVerifiedAt,
      banner_image_url: bannerInfo?.url || null,
      banner_image_width: bannerInfo?.width || null,
      banner_image_height: bannerInfo?.height || null,
      hashtags: hashtagTableData,
      owner_profile_id: ownerProfileId,
      pending_application_count: pendingApplicationCount,
    };
  });

  // Sort by creation date
  result.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return result;
}

/**
 * Get recruiting communities with user context (applications, memberships)
 * If userId is provided, includes user's application status and membership info
 */
export async function getRecruitingCommunitiesWithUserContext(userId?: string) {
  const recruitingCommunities = await db.query.community.findMany({
    where: and(
      eq(communityTable.isRecruiting, true),
      isNull(communityTable.deletedAt),
      sql`${communityTable.endsAt} > NOW()`,
      // Check recruiting dates if they are set
      or(
        isNull(communityTable.recruitingStartsAt),
        sql`${communityTable.recruitingStartsAt} <= NOW()`,
      ),
      or(
        isNull(communityTable.recruitingEndsAt),
        sql`${communityTable.recruitingEndsAt} > NOW()`,
      ),
    ),
    orderBy: [desc(communityTable.createdAt)],
    with: {
      communityHashtags: {
        with: {
          hashtag: true,
        },
      },
    },
  });

  // Get user applications and memberships if user is authenticated
  const userApplications: {
    [key: string]: typeof communityApplicationTable.$inferSelect;
  } = {};
  const userMemberships: Set<string> = new Set();
  const userRoles: { [key: string]: string } = {};

  if (userId) {
    const applications = await db.query.communityApplication.findMany({
      where: and(
        eq(communityApplicationTable.userId, userId),
        or(
          eq(communityApplicationTable.status, "pending"),
          eq(communityApplicationTable.status, "rejected"),
        ),
      ),
    });
    applications.forEach((app) => {
      userApplications[app.communityId] = app;
    });

    const membershipTableList = await db.query.membership.findMany({
      where: and(
        eq(membershipTable.userId, userId),
        isNotNull(membershipTable.activatedAt),
      ),
    });
    membershipTableList.forEach((membership) => {
      userMemberships.add(membership.communityId);
      userRoles[membership.communityId] = membership.role;
    });
  }

  // Collect all community IDs for batch operations
  const communityIds = recruitingCommunities.map((c) => c.id);

  // Batch fetch banner images for all communities
  const bannerImages =
    communityIds.length > 0
      ? await imageService.getCommunityBannerInfo(communityIds)
      : new Map();

  // Batch fetch owner memberships for all communities
  const ownerMemberships =
    communityIds.length > 0
      ? await db.query.membership.findMany({
          where: and(
            inArray(membershipTable.communityId, communityIds),
            eq(membershipTable.role, "owner"),
            isNotNull(membershipTable.activatedAt),
          ),
        })
      : [];

  // Build map of community ID -> owner user ID
  const ownerUserIdMap = new Map(
    ownerMemberships.map((m) => [m.communityId, m.userId]),
  );

  // Collect all unique owner user IDs and their communities
  const ownerUserCommunityPairs = Array.from(ownerUserIdMap.entries()).map(
    ([communityId, userId]) => ({ userId, communityId }),
  );

  // Batch fetch primary profile IDs for all owners
  const ownerProfileIdsMap =
    ownerUserCommunityPairs.length > 0
      ? await getPrimaryProfileIdForUserInCommunity(ownerUserCommunityPairs)
      : new Map<string, string | null>();

  // Convert map keys from "userId:communityId" to just communityId
  const ownerProfileIds = new Map<string, string | null>();
  for (const { userId, communityId } of ownerUserCommunityPairs) {
    const key = `${userId}:${communityId}`;
    ownerProfileIds.set(communityId, ownerProfileIdsMap.get(key) || null);
  }

  const result = recruitingCommunities.map((community) => {
    const bannerInfo = bannerImages.get(community.id) || null;

    const hashtagTableData = community.communityHashtags.map((ch) => ({
      id: ch.hashtag.id,
      tag: ch.hashtag.tag,
    }));

    const hasApplied = userApplications[community.id] !== undefined;
    const application = userApplications[community.id];
    const applicationId = application?.id || null;
    const applicationStatus = application?.status || null;
    const isMember = userMemberships.has(community.id);
    const userRole = userRoles[community.id] || null;

    const ownerProfileId = ownerProfileIds.get(community.id) || null;

    return {
      id: community.id,
      name: community.name,
      slug: community.slug,
      starts_at: community.startsAt,
      ends_at: community.endsAt,
      is_recruiting: community.isRecruiting,
      recruiting_starts_at: community.recruitingStartsAt,
      recruiting_ends_at: community.recruitingEndsAt,
      minimum_birth_year: community.minimumBirthYear,
      created_at: community.createdAt,
      custom_domain: community.customDomain,
      domain_verified: community.domainVerifiedAt,
      owner_profile_id: ownerProfileId,
      banner_image_url: bannerInfo?.url || null,
      banner_image_width: bannerInfo?.width || null,
      banner_image_height: bannerInfo?.height || null,
      has_applied: hasApplied,
      application_id: applicationId,
      application_status: applicationStatus,
      is_member: isMember,
      role: userRole,
      hashtags: hashtagTableData,
    };
  });

  // Sort by creation date
  result.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return result;
}

/**
 * Get community statistics including applications and member counts
 * Returns aggregated data for community dashboard
 */
export async function getCommunityStats(communityId: string) {
  // Get community with hashtags
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
    with: {
      communityHashtags: {
        with: {
          hashtag: true,
        },
      },
    },
  });

  if (!community) {
    throw new AppException(404, "커뮤를 찾을 수 없습니다");
  }

  // Get application statistics
  const appStats = await db
    .select({
      status: communityApplicationTable.status,
      count: count(communityApplicationTable.id),
    })
    .from(communityApplicationTable)
    .where(eq(communityApplicationTable.communityId, communityId))
    .groupBy(communityApplicationTable.status);

  // Convert to object for easier access
  const statsDict: { [key: string]: number } = {};
  for (const stat of appStats) {
    statsDict[stat.status] = stat.count;
  }

  // Get total member count (active members)
  const totalMembersResult = await db
    .select({ count: count(membershipTable.id) })
    .from(membershipTable)
    .where(
      and(
        eq(membershipTable.communityId, communityId),
        isNotNull(membershipTable.activatedAt),
      ),
    );

  // Get banner image info
  const bannerInfo = await imageService.getCommunityBannerInfo(communityId);

  // Get hashtags
  const hashtags = community.communityHashtags.map((ch) => ({
    id: ch.hashtag.id,
    tag: ch.hashtag.tag,
  }));

  return {
    community: {
      id: community.id,
      name: community.name,
      slug: community.slug,
      banner_image_url: bannerInfo?.url || null,
      banner_image_width: bannerInfo?.width || null,
      banner_image_height: bannerInfo?.height || null,
      hashtags: hashtags,
    },
    applications: {
      pending: statsDict.pending || 0,
      approved: statsDict.approved || 0,
      rejected: statsDict.rejected || 0,
      total: Object.values(statsDict).reduce((sum, count) => sum + count, 0),
    },
    members: {
      total: totalMembersResult[0]?.count ?? 0,
    },
  };
}

/**
 * Get community detail with user membership and application status
 */
export async function getCommunityDetailWithUserContext(
  communityId: string,
  userId?: string,
) {
  // Find the community with hashtags
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
    with: {
      communityHashtags: {
        with: {
          hashtag: true,
        },
      },
    },
  });

  if (!community) {
    throw new AppException(404, "커뮤를 찾을 수 없습니다");
  }

  // Get banner info
  const bannerInfo = await imageService.getCommunityBannerInfo(community.id);

  // Get hashtags
  const hashtags = community.communityHashtags.map((ch) => ({
    id: ch.hashtag.id,
    tag: ch.hashtag.tag,
  }));

  let membershipStatus = null;
  let applicationStatus = null;
  let userRole = null;

  if (userId) {
    // Check if user is already a member
    const membership = await db.query.membership.findFirst({
      where: and(
        eq(membershipTable.userId, userId),
        eq(membershipTable.communityId, communityId),
        isNotNull(membershipTable.activatedAt),
      ),
    });

    if (membership) {
      membershipStatus = "member";
      userRole = membership.role;
    } else {
      // Check for existing application
      const application = await db.query.communityApplication.findFirst({
        where: and(
          eq(communityApplicationTable.communityId, communityId),
          eq(communityApplicationTable.userId, userId),
        ),
        orderBy: [desc(communityApplicationTable.createdAt)],
        with: {
          attachments: {
            with: {
              image: true,
            },
          },
        },
      });

      if (application) {
        applicationStatus = {
          status: application.status,
          application_id: application.id,
          created_at: application.createdAt,
          message: application.message,
          rejection_reason: application.rejectionReason,
          attachments: application.attachments.map((attachment) => ({
            id: attachment.id,
            image_id: attachment.imageId,
            image_url: addImageUrl(attachment.image),
            created_at: attachment.createdAt,
          })),
        };
      }
    }
  }

  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    starts_at: community.startsAt,
    ends_at: community.endsAt,
    is_recruiting: community.isRecruiting,
    recruiting_starts_at: community.recruitingStartsAt,
    recruiting_ends_at: community.recruitingEndsAt,
    minimum_birth_year: community.minimumBirthYear,
    custom_domain: community.customDomain,
    domain_verified: community.domainVerifiedAt,
    created_at: community.createdAt,
    hashtags,
    banner_image_url: bannerInfo?.url || null,
    banner_image_width: bannerInfo?.width || null,
    banner_image_height: bannerInfo?.height || null,
    membership_status: membershipStatus,
    application_status: applicationStatus,
    user_role: userRole,
    description: community.description,
  };
}
