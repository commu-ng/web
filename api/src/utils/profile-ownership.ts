import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "../db";
import {
  profileOwnership as profileOwnershipTable,
  profile as profileTable,
} from "../drizzle/schema";

export interface ProfileOwnership {
  id: string;
  profileId: string;
  userId: string;
  role: "owner" | "admin";
  createdAt: string;
  createdBy: string;
}

/**
 * Get a user's ownership record for a specific profile
 */
export async function getProfileOwnership(
  userId: string,
  profileId: string,
): Promise<ProfileOwnership | undefined> {
  return await db.query.profileOwnership.findFirst({
    where: and(
      eq(profileOwnershipTable.userId, userId),
      eq(profileOwnershipTable.profileId, profileId),
    ),
  });
}

/**
 * Check if user can manage an profile (only owners can manage)
 */
export async function canManageProfile(
  userId: string,
  profileId: string,
): Promise<boolean> {
  const ownership = await getProfileOwnership(userId, profileId);
  return ownership?.role === "owner";
}

/**
 * Check if user can use/act as an profile (both owners and admins)
 */
export async function canUseProfile(
  userId: string,
  profileId: string,
): Promise<boolean> {
  const ownership = await getProfileOwnership(userId, profileId);
  return ownership !== undefined;
}

/**
 * Get all profiles a user has access to
 * If communityId is provided, filters profiles to that community using JOIN
 */
export async function getUserProfiles(userId: string, communityId?: string) {
  if (communityId) {
    // Use JOIN to filter in database
    const results = await db
      .select({
        id: profileOwnershipTable.id,
        profileId: profileOwnershipTable.profileId,
        userId: profileOwnershipTable.userId,
        role: profileOwnershipTable.role,
        createdBy: profileOwnershipTable.createdBy,
        createdAt: profileOwnershipTable.createdAt,
        profile: profileTable,
      })
      .from(profileOwnershipTable)
      .innerJoin(
        profileTable,
        eq(profileOwnershipTable.profileId, profileTable.id),
      )
      .where(
        and(
          eq(profileOwnershipTable.userId, userId),
          eq(profileTable.communityId, communityId),
          isNull(profileTable.deletedAt),
        ),
      );

    return results;
  }

  // Original behavior when no communityId
  return await db.query.profileOwnership.findMany({
    where: eq(profileOwnershipTable.userId, userId),
    with: {
      profile: true,
    },
  });
}

/**
 * Get all users who have access to an profile
 */
export async function getProfileUsers(profileId: string) {
  return await db.query.profileOwnership.findMany({
    where: eq(profileOwnershipTable.profileId, profileId),
    with: {
      user: true,
    },
  });
}

/**
 * Add a user to an profile with a specific role
 */
export async function addUserToProfile(
  profileId: string,
  userId: string,
  role: "owner" | "admin",
  addedBy: string,
) {
  return await db.insert(profileOwnershipTable).values({
    profileId,
    userId,
    role,
    createdBy: addedBy,
  });
}

/**
 * Remove a user's access to an profile
 */
export async function removeUserFromProfile(profileId: string, userId: string) {
  return await db
    .delete(profileOwnershipTable)
    .where(
      and(
        eq(profileOwnershipTable.profileId, profileId),
        eq(profileOwnershipTable.userId, userId),
      ),
    );
}

/**
 * Create ownership record for a new profile (used during profile creation)
 */
export async function createProfileOwnership(
  profileId: string,
  ownerId: string,
) {
  return await addUserToProfile(profileId, ownerId, "owner", ownerId);
}

/**
 * Get the primary profile ID for a user in a specific community (single)
 */
export async function getPrimaryProfileIdForUserInCommunity(
  userId: string,
  communityId: string,
): Promise<string | null>;

/**
 * Get the primary profile IDs for multiple user-community pairs (batch)
 */
export async function getPrimaryProfileIdForUserInCommunity(
  userCommunityPairs: Array<{ userId: string; communityId: string }>,
): Promise<Map<string, string | null>>;

/**
 * Get the primary profile ID for a user in a specific community
 * Returns the profile ID if found, null otherwise
 * Supports both single and batch operations
 */
export async function getPrimaryProfileIdForUserInCommunity(
  userIdOrPairs: string | Array<{ userId: string; communityId: string }>,
  communityId?: string,
): Promise<string | null | Map<string, string | null>> {
  // Single user case
  if (typeof userIdOrPairs === "string") {
    const userId = userIdOrPairs;
    if (!communityId) {
      throw new Error("communityId is required for single user lookup");
    }

    // Use a JOIN query to filter profiles directly in the database
    const userOwnerships = await db
      .select({
        profileId: profileOwnershipTable.profileId,
        isPrimary: profileTable.isPrimary,
      })
      .from(profileOwnershipTable)
      .innerJoin(
        profileTable,
        eq(profileOwnershipTable.profileId, profileTable.id),
      )
      .where(
        and(
          eq(profileOwnershipTable.userId, userId),
          eq(profileTable.communityId, communityId),
          isNull(profileTable.deletedAt),
        ),
      );

    if (userOwnerships.length === 0) {
      return null;
    }

    // Find the primary profile
    const primaryProfile = userOwnerships.find((o) => o.isPrimary);
    if (primaryProfile) {
      return primaryProfile.profileId;
    }

    // If no primary profile, return the first active profile
    const firstOwnership = userOwnerships[0];
    return firstOwnership?.profileId || null;
  }

  // Batch case - multiple user-community pairs
  const pairs = userIdOrPairs;
  if (pairs.length === 0) {
    return new Map();
  }

  // Collect all unique user IDs and community IDs
  const userIds = [...new Set(pairs.map((p) => p.userId))];
  const communityIds = [...new Set(pairs.map((p) => p.communityId))];

  // Batch fetch all relevant ownerships
  const allOwnerships = await db
    .select({
      userId: profileOwnershipTable.userId,
      profileId: profileOwnershipTable.profileId,
      communityId: profileTable.communityId,
      isPrimary: profileTable.isPrimary,
    })
    .from(profileOwnershipTable)
    .innerJoin(
      profileTable,
      eq(profileOwnershipTable.profileId, profileTable.id),
    )
    .where(
      and(
        inArray(profileOwnershipTable.userId, userIds),
        inArray(profileTable.communityId, communityIds),
        isNull(profileTable.deletedAt),
      ),
    );

  // Build a map: "userId:communityId" -> profile info
  const ownershipMap = new Map<
    string,
    Array<{ profileId: string; isPrimary: boolean }>
  >();

  for (const ownership of allOwnerships) {
    const key = `${ownership.userId}:${ownership.communityId}`;
    if (!ownershipMap.has(key)) {
      ownershipMap.set(key, []);
    }
    ownershipMap.get(key)?.push({
      profileId: ownership.profileId,
      isPrimary: ownership.isPrimary,
    });
  }

  // Build result map for each requested pair
  const resultMap = new Map<string, string | null>();
  for (const { userId, communityId } of pairs) {
    const key = `${userId}:${communityId}`;
    const ownerships = ownershipMap.get(key) || [];

    if (ownerships.length === 0) {
      resultMap.set(key, null);
      continue;
    }

    // Find primary profile
    const primaryProfile = ownerships.find((o) => o.isPrimary);
    if (primaryProfile) {
      resultMap.set(key, primaryProfile.profileId);
      continue;
    }

    // If no primary, return first profile
    resultMap.set(key, ownerships[0]?.profileId || null);
  }

  return resultMap;
}

/**
 * Revoke all shared profile access for a user in a community
 * Removes ownership records where role is not 'owner' (shared and admin profiles only)
 * Owner-role ownership records are preserved even when leaving community
 * Optimized: Uses batch delete with JOIN instead of loop
 */
export async function revokeSharedProfileAccess(
  userId: string,
  communityId: string,
): Promise<number> {
  // Find shared ownership IDs (where role is 'shared' or 'admin', but NOT 'owner')
  const sharedOwnerships = await db
    .select({
      id: profileOwnershipTable.id,
      role: profileOwnershipTable.role,
    })
    .from(profileOwnershipTable)
    .innerJoin(
      profileTable,
      eq(profileOwnershipTable.profileId, profileTable.id),
    )
    .where(
      and(
        eq(profileOwnershipTable.userId, userId),
        eq(profileTable.communityId, communityId),
        isNull(profileTable.deletedAt),
        ne(profileOwnershipTable.role, "owner"), // Only revoke non-owner access
      ),
    );

  const sharedOwnershipIds = sharedOwnerships.map((o) => o.id);

  if (sharedOwnershipIds.length === 0) {
    return 0;
  }

  // Batch delete all shared ownerships at once
  await db
    .delete(profileOwnershipTable)
    .where(inArray(profileOwnershipTable.id, sharedOwnershipIds));

  return sharedOwnershipIds.length;
}
