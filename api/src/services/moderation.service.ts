import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  membership as membershipTable,
  moderationLog as moderationLogTable,
  profileOwnership as profileOwnershipTable,
  profile as profileTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";

/**
 * Check if a profile has moderator or owner permissions
 */
async function validateModeratorPermissions(
  userId: string,
  communityId: string,
): Promise<{ profileId: string; role: "owner" | "moderator" }> {
  // Get the user's membership
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  if (!membership) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 커뮤의 회원이 아닙니다",
    );
  }

  if (membership.role !== "owner" && membership.role !== "moderator") {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "소유자 또는 모더레이터만 이 작업을 수행할 수 있습니다",
    );
  }

  // Get the moderator's profile in this community via ownership
  const profileOwnerships = await db.query.profileOwnership.findMany({
    where: eq(profileOwnershipTable.userId, userId),
    with: {
      profile: true,
    },
  });

  const moderatorProfile = profileOwnerships.find(
    (ownership) =>
      ownership.profile &&
      ownership.profile.communityId === communityId &&
      ownership.profile.activatedAt !== null &&
      ownership.profile.deletedAt === null,
  );

  if (!moderatorProfile?.profile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없습니다",
    );
  }

  return {
    profileId: moderatorProfile.profile.id,
    role: membership.role as "owner" | "moderator",
  };
}

/**
 * Mute a profile, preventing them from creating posts
 */
export async function muteProfile(
  userId: string,
  communityId: string,
  targetProfileId: string,
  reason?: string,
) {
  // Validate moderator permissions
  const { profileId: moderatorProfileId } = await validateModeratorPermissions(
    userId,
    communityId,
  );

  // Get the target profile
  const targetProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, targetProfileId),
      eq(profileTable.communityId, communityId),
      isNotNull(profileTable.activatedAt),
      isNull(profileTable.deletedAt),
    ),
  });

  if (!targetProfile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없습니다",
    );
  }

  // Check if profile is already muted
  if (targetProfile.mutedAt) {
    throw new AppException(
      409,
      GENERAL_ERROR_CODE,
      "프로필이 이미 음소거되었습니다",
    );
  }

  // Prevent moderators from muting themselves
  if (moderatorProfileId === targetProfileId) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "자신의 프로필을 음소거할 수 없습니다",
    );
  }

  // Mute the profile and log the action in a transaction
  await db.transaction(async (tx) => {
    // Set mute status
    await tx
      .update(profileTable)
      .set({
        mutedAt: sql`NOW()`,
        mutedById: moderatorProfileId,
      })
      .where(eq(profileTable.id, targetProfileId));

    // Log to moderation_log
    const description =
      reason || `@${targetProfile.username}의 프로필을 음소거했습니다`;
    await tx.insert(moderationLogTable).values({
      action: "mute_profile",
      description,
      moderatorId: moderatorProfileId,
      targetProfileId,
    });
  });

  return {
    message: "프로필이 성공적으로 음소거되었습니다",
  };
}

/**
 * Unmute a profile, allowing them to create posts again
 */
export async function unmuteProfile(
  userId: string,
  communityId: string,
  targetProfileId: string,
) {
  // Validate moderator permissions
  const { profileId: moderatorProfileId } = await validateModeratorPermissions(
    userId,
    communityId,
  );

  // Get the target profile
  const targetProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, targetProfileId),
      eq(profileTable.communityId, communityId),
      isNotNull(profileTable.activatedAt),
      isNull(profileTable.deletedAt),
    ),
  });

  if (!targetProfile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없습니다",
    );
  }

  // Check if profile is not muted
  if (!targetProfile.mutedAt) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "프로필이 음소거되지 않았습니다",
    );
  }

  // Unmute the profile and log the action in a transaction
  await db.transaction(async (tx) => {
    // Clear mute status
    await tx
      .update(profileTable)
      .set({
        mutedAt: null,
        mutedById: null,
      })
      .where(eq(profileTable.id, targetProfileId));

    // Log to moderation_log
    const description = `@${targetProfile.username}의 프로필 음소거를 해제했습니다`;
    await tx.insert(moderationLogTable).values({
      action: "unmute_profile",
      description,
      moderatorId: moderatorProfileId,
      targetProfileId,
    });
  });

  return {
    message: "프로필 음소거가 성공적으로 해제되었습니다",
  };
}
