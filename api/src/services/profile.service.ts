import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "../db";
import {
  image as imageTable,
  membership as membershipTable,
  post as postTable,
  profileOwnership as profileOwnershipTable,
  profilePicture as profilePictureTable,
  profile as profileTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import {
  addUserToProfile,
  canManageProfile,
  canUseProfile,
  getPrimaryProfileIdForUserInCommunity,
  getProfileUsers,
  getUserProfiles,
  removeUserFromProfile,
} from "../utils/profile-ownership";
import {
  getProfilePictureUrl,
  getProfilePictureUrlById,
} from "../utils/profile-picture-helper";
import { addImageUrl, uploadFileDirect, validateImageFile } from "../utils/r2";

/**
 * Upload and set profile picture for an profile
 */
export async function uploadProfilePicture(
  profileId: string,
  fileBuffer: ArrayBuffer,
  fileName: string,
  fileContentType: string,
  fileSize: number,
) {
  const [isValid, errorMessage] = validateImageFile(fileContentType, fileSize);
  if (!isValid) {
    throw new AppException(400, errorMessage);
  }

  // Upload to R2
  const uniqueKey = await uploadFileDirect(
    fileBuffer,
    fileName,
    fileContentType,
  );

  // Get image dimensions
  let width = 0;
  let height = 0;
  try {
    const image = sharp(Buffer.from(fileBuffer));
    const metadata = await image.metadata();
    width = metadata.width ?? 0;
    height = metadata.height ?? 0;
  } catch (_err) {
    throw new AppException(400, "이미지 크기 가져오기에 실패했습니다");
  }

  // Create image record and profile picture in a transaction
  const result = await db.transaction(async (tx) => {
    const newImageResult = await tx
      .insert(imageTable)
      .values({
        key: uniqueKey,
        filename: fileName,
        width,
        height,
      })
      .returning();

    const newImage = newImageResult[0];
    if (!newImage) {
      throw new Error("Failed to create image record");
    }

    // Soft delete all existing profile pictures for this profile
    await tx
      .update(profilePictureTable)
      .set({ deletedAt: sql`NOW()` })
      .where(
        and(
          eq(profilePictureTable.profileId, profileId),
          isNull(profilePictureTable.deletedAt),
        ),
      );

    // Create new profile picture record
    const newProfilePictureResult = await tx
      .insert(profilePictureTable)
      .values({
        profileId: profileId,
        imageId: newImage.id,
      })
      .returning();

    const newProfilePicture = newProfilePictureResult[0];
    if (!newProfilePicture) {
      throw new Error("Failed to create profile picture record");
    }

    return { newImage, newProfilePicture };
  });

  const newImage = result.newImage;
  const newProfilePicture = result.newProfilePicture;

  return {
    id: newProfilePicture.id,
    image_id: newImage.id,
    filename: newImage.filename,
    width: newImage.width,
    height: newImage.height,
    url: addImageUrl(newImage).url,
    createdAt: newProfilePicture.createdAt,
  };
}

/**
 * Check if username exists in a community
 */
export async function checkUsernameAvailability(
  username: string,
  communityId: string,
) {
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, username),
      eq(profileTable.communityId, communityId),
      isNotNull(profileTable.activatedAt),
      isNull(profileTable.deletedAt),
    ),
  });

  return {
    exists: profile !== undefined,
    username: username,
  };
}

/**
 * Get all profiles in a community grouped by user
 * Only shows active members (isActive = true)
 */
export async function listProfilesByUser(
  communityId: string,
  limit: number = 20,
  cursor?: string,
) {
  // Build where conditions
  const conditions = [
    eq(profileTable.communityId, communityId),
    isNull(profileTable.deletedAt),
    isNotNull(profileTable.activatedAt), // Only show active members
  ];

  // Add cursor condition if provided
  if (cursor) {
    conditions.push(sql`${profileTable.id} < ${cursor}`);
  }

  // Fetch limit + 1 to check if there are more results
  const profileTableList = await db.query.profile.findMany({
    where: and(...conditions),
    orderBy: [desc(profileTable.id)], // Use ID for consistent ordering
    limit: limit + 1,
    with: {
      profilePictures: {
        with: {
          image: true,
        },
      },
      ownerships: {
        with: {
          user: {
            columns: {
              id: true,
              loginName: true,
            },
          },
        },
      },
    },
  });

  // Check if there are more results
  const hasMore = profileTableList.length > limit;
  const profilesToReturn = hasMore
    ? profileTableList.slice(0, limit)
    : profileTableList;
  const nextCursor =
    hasMore && profilesToReturn.length > 0
      ? profilesToReturn[profilesToReturn.length - 1].id
      : null;

  // Get memberships to determine user roles
  const memberships = await db.query.membership.findMany({
    where: and(
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
    columns: {
      userId: true,
      role: true,
    },
  });

  // Create a map of userId to role
  const userRoleMap = new Map(memberships.map((m) => [m.userId, m.role]));

  // Create a map of userId to random UUID (user_group_key)
  const userGroupKeyMap = new Map<string, string>();

  // Map each profile to its data, using the owner ownership only (not shared/admin ownerships)
  const allProfiles = profilesToReturn
    .map((profile) => {
      // Find the ownership with role='owner' (there should be exactly one)
      const ownerOwnership = profile.ownerships.find((o) => o.role === "owner");

      // If no owner found, skip this profile (shouldn't happen in valid data)
      if (!ownerOwnership) {
        return null;
      }

      const userId = ownerOwnership.user.id;

      // Generate or get user_group_key for this user
      let userGroupKey = userGroupKeyMap.get(userId);
      if (!userGroupKey) {
        userGroupKey = crypto.randomUUID();
        userGroupKeyMap.set(userId, userGroupKey);
      }

      const userRole = userRoleMap.get(userId) || "member";

      return {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        bio: profile.bio,
        profile_picture_url: getProfilePictureUrl(profile.profilePictures),
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        activatedAt: profile.activatedAt,
        is_primary: profile.isPrimary,
        user_group_key: userGroupKey,
        user_role: userRole,
      };
    })
    .filter(
      (profile): profile is NonNullable<typeof profile> => profile !== null,
    );

  return {
    data: allProfiles,
    nextCursor,
    hasMore,
  };
}

/**
 * Create a new profile
 */
export async function createProfile(
  userId: string,
  communityId: string,
  name: string,
  username: string,
  bio: string | null | undefined,
  isPrimary: boolean | null | undefined,
  profilePictureId: string | null | undefined,
) {
  // Check if username is already taken in this community
  const existingProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, username),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
  });

  if (existingProfile) {
    throw new AppException(400, "이 커뮤에서 이미 사용 중인 사용자명입니다");
  }

  // Validate profile picture if provided
  if (profilePictureId) {
    const image = await db.query.image.findFirst({
      where: and(
        eq(imageTable.id, profilePictureId),
        isNull(imageTable.deletedAt),
      ),
    });
    if (!image) {
      throw new AppException(400, "잘못된 프로필 사진 ID입니다");
    }
  }

  // Create profile in a transaction
  const newProfile = await db.transaction(async (tx) => {
    // If is_primary is true, unset primary on user's other profiles
    if (isPrimary) {
      // Get user's owned profiles in this community
      const userProfiles = await getUserProfiles(userId);
      const userProfileIds = userProfiles
        .filter(
          (
            ownership,
          ): ownership is typeof ownership & {
            profile: NonNullable<typeof ownership.profile>;
          } =>
            ownership.profile !== null &&
            ownership.profile !== undefined &&
            !ownership.profile.deletedAt &&
            ownership.profile.communityId === communityId,
        )
        .map((ownership) => ownership.profile.id);

      if (userProfileIds.length > 0) {
        await tx
          .update(profileTable)
          .set({ isPrimary: false })
          .where(
            and(
              inArray(profileTable.id, userProfileIds),
              eq(profileTable.communityId, communityId),
            ),
          );
      }
    }

    const newProfileResult = await tx
      .insert(profileTable)
      .values({
        name,
        username,
        bio: bio ?? undefined,
        isPrimary: isPrimary ?? undefined,
        communityId: communityId,
        activatedAt: sql`NOW()`, // New profiles are immediately active
      })
      .returning();

    const profile = newProfileResult[0];
    if (!profile) {
      throw new Error("Failed to create profile");
    }

    // Create ownership record for the new profile
    await tx.insert(profileOwnershipTable).values({
      profileId: profile.id,
      userId: userId,
      role: "owner",
      createdBy: userId,
    });

    // Create profile picture if provided
    if (profilePictureId) {
      await tx.insert(profilePictureTable).values({
        profileId: profile.id,
        imageId: profilePictureId,
      });
    }

    return profile;
  });

  // Get profile picture for response
  const profile_picture_url = await getProfilePictureUrlById(newProfile.id);

  return {
    id: newProfile.id,
    username: newProfile.username,
    name: newProfile.name,
    bio: newProfile.bio,
    profile_picture_url,
    createdAt: newProfile.createdAt,
    updatedAt: newProfile.updatedAt,
    activatedAt: newProfile.activatedAt,
    primary: newProfile.isPrimary,
  };
}

/**
 * Get post count for a profile
 */
export async function getProfilePostCount(profileId: string) {
  const postCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postTable)
    .where(and(eq(postTable.authorId, profileId), isNull(postTable.deletedAt)));

  return postCount[0]?.count || 0;
}

/**
 * Delete an profile (soft delete)
 */
export async function deleteProfile(
  userId: string,
  profileId: string,
  communityId: string,
) {
  // Verify user can manage this profile
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(404, "프로필을 찾을 수 없거나 관리 권한이 없습니다");
  }

  // Find the profile to verify it exists and is in the correct community
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
  });

  if (!profile) {
    throw new AppException(404, "프로필을 찾을 수 없습니다");
  }

  // Can't delete primary profile
  if (profile.isPrimary) {
    throw new AppException(400, "메인 프로필은 삭제할 수 없습니다");
  }

  // Can't delete if it's the only profile user has access to
  const userProfilesInCommunity = await getUserProfiles(userId, communityId);

  if (userProfilesInCommunity.length <= 1) {
    throw new AppException(400, "유일한 프로필은 삭제할 수 없습니다");
  }

  // Soft delete the profile in a transaction
  await db.transaction(async (tx) => {
    // Soft delete the profile
    await tx
      .update(profileTable)
      .set({
        deletedAt: sql`NOW()`,
        activatedAt: null, // Also deactivate
      })
      .where(eq(profileTable.id, profileId));

    // If this was the primary profile, make another profile primary
    if (profile.isPrimary) {
      // Find another profile from user's available profiles
      const availableProfiles = userProfilesInCommunity
        .filter(
          (
            ownership,
          ): ownership is typeof ownership & {
            profile: NonNullable<typeof ownership.profile>;
          } =>
            ownership.profile !== null &&
            ownership.profile !== undefined &&
            ownership.profile.id !== profileId,
        )
        .map((ownership) => ownership.profile);

      const nextProfile =
        availableProfiles.length > 0 ? availableProfiles[0] : null;

      if (nextProfile) {
        await tx
          .update(profileTable)
          .set({ isPrimary: true })
          .where(eq(profileTable.id, nextProfile.id));
      }
    }
  });
}

/**
 * Set an profile as the primary profile for a user in a community
 */
export async function setPrimaryProfile(
  userId: string,
  profileId: string,
  communityId: string,
) {
  // Verify user can manage this profile (only owners can set primary)
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(
      403,
      "공유된 프로필은 기본 프로필로 설정할 수 없습니다",
    );
  }

  // Get and validate the profile is active
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
      isNotNull(profileTable.activatedAt),
      isNull(profileTable.deletedAt),
    ),
  });

  if (!profile) {
    throw new AppException(
      404,
      "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
    );
  }

  // Set all user's profiles in this community as not primary
  const userProfiles = await getUserProfiles(userId);
  const userProfileIds = userProfiles
    .filter(
      (
        ownership,
      ): ownership is typeof ownership & {
        profile: NonNullable<typeof ownership.profile>;
      } =>
        ownership.profile !== null &&
        ownership.profile !== undefined &&
        ownership.profile.communityId === communityId &&
        ownership.profile.deletedAt === null,
    )
    .map((ownership) => ownership.profile.id);

  // Set primary profile in a transaction
  await db.transaction(async (tx) => {
    if (userProfileIds.length > 0) {
      await tx
        .update(profileTable)
        .set({ isPrimary: false })
        .where(
          and(
            inArray(profileTable.id, userProfileIds),
            eq(profileTable.communityId, communityId),
            isNull(profileTable.deletedAt),
          ),
        );
    }

    // Set the specified profile as primary
    await tx
      .update(profileTable)
      .set({ isPrimary: true })
      .where(eq(profileTable.id, profile.id));
  });
}

/**
 * Get profile profile by username
 */
export async function getProfileProfile(username: string, communityId: string) {
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, username),
      eq(profileTable.communityId, communityId),
      isNotNull(profileTable.activatedAt),
      isNull(profileTable.deletedAt),
    ),
    with: {
      profilePictures: {
        with: {
          image: true,
        },
      },
    },
  });

  if (!profile) {
    throw new AppException(404, "프로필을 찾을 수 없습니다");
  }

  return {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    bio: profile.bio,
    profile_picture_url: getProfilePictureUrl(profile.profilePictures),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Get posts by an profile
 */
/**
 * Validate profile access and get profile details
 * Checks if user has permission to use the profile and retrieves it
 */
export async function validateAndGetProfile(
  userId: string,
  profileId: string,
  communityId: string,
  requireActive: boolean = false,
) {
  // Check if user has permission to use this profile
  const hasAccess = await canUseProfile(userId, profileId);
  if (!hasAccess) {
    return null;
  }

  // Get the profile details
  const conditions = [
    eq(profileTable.id, profileId),
    eq(profileTable.communityId, communityId),
    isNull(profileTable.deletedAt),
  ];

  if (requireActive) {
    conditions.push(isNotNull(profileTable.activatedAt));
  }

  const profile = await db.query.profile.findFirst({
    where: and(...conditions),
  });

  return profile;
}

export async function getProfilePosts(
  username: string,
  communityId: string,
  limit: number,
  offset: number,
) {
  // Find profile by username in the same community
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, username),
      eq(profileTable.communityId, communityId),
      isNotNull(profileTable.activatedAt),
      isNull(profileTable.deletedAt),
    ),
  });

  if (!profile) {
    throw new AppException(404, "프로필을 찾을 수 없습니다");
  }

  // Get posts by this profile
  // Order by pinnedAt first (pinned posts at top), then by createdAt
  const postTableList = await db.query.post.findMany({
    where: and(eq(postTable.authorId, profile.id), isNull(postTable.deletedAt)),
    orderBy: [
      sql`${postTable.pinnedAt} DESC NULLS LAST`,
      desc(postTable.createdAt),
    ],
    limit: limit,
    offset: offset,
    with: {
      postImages: {
        with: {
          image: true,
        },
      },
      postReactions: {
        with: {
          profile: true,
        },
      },
    },
  });

  // Get profile's profile picture once
  const profileProfilePicture = await db.query.profilePicture.findFirst({
    where: and(
      eq(profilePictureTable.profileId, profile.id),
      isNull(profilePictureTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });
  const profile_profile_picture_url = profileProfilePicture?.image
    ? addImageUrl(profileProfilePicture.image).url
    : null;

  const result = postTableList.map((post) => {
    const postImageTableData = post.postImages.map((pi) => ({
      id: pi.image.id,
      url: addImageUrl(pi.image).url,
      width: pi.image.width,
      height: pi.image.height,
      filename: pi.image.filename,
    }));

    return {
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      announcement: post.announcement,
      content_warning: post.contentWarning,
      pinned_at: post.pinnedAt,
      author: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        profile_picture_url: profile_profile_picture_url,
      },
      images: postImageTableData,
      in_reply_to_id: post.inReplyToId,
      depth: post.depth,
      root_post_id: post.rootPostId,
      is_bookmarked: false,
      replies: [],
      reactions:
        post.postReactions?.map((reaction) => ({
          emoji: reaction.emoji,
          user: {
            id: reaction.profile.id,
            username: reaction.profile.username,
            name: reaction.profile.name,
          },
        })) || [],
    };
  });

  return result;
}

/**
 * Update an profile's information
 */
export async function updateProfile(
  userId: string,
  profileId: string,
  communityId: string,
  name: string,
  username: string,
  bio: string | null | undefined,
  _profilePictureId: string | null | undefined,
) {
  // Verify user can manage this profile
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(404, "프로필을 찾을 수 없거나 관리 권한이 없습니다");
  }

  // Get the profile
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
  });

  if (!profile) {
    throw new AppException(404, "프로필을 찾을 수 없습니다");
  }

  // Check if username is already taken by another profile
  if (username !== profile.username) {
    const existingProfile = await db.query.profile.findFirst({
      where: and(
        eq(profileTable.username, username),
        eq(profileTable.communityId, communityId),
        isNull(profileTable.deletedAt),
      ),
    });

    if (existingProfile && existingProfile.id !== profile.id) {
      throw new AppException(400, "사용자명이 이미 사용 중입니다");
    }
  }

  // Note: profilePictureId parameter is deprecated since we no longer support
  // switching between multiple profile pictures. Use uploadProfilePicture() instead.

  // Update the profile
  const updateResult = await db
    .update(profileTable)
    .set({
      name,
      username,
      bio,
    })
    .where(eq(profileTable.id, profileId))
    .returning();

  const updatedProfile = updateResult[0];
  if (!updatedProfile) {
    throw new Error("Failed to update profile");
  }

  // Return the updated profile with profile picture
  const profileWithProfilePicture = await db.query.profile.findFirst({
    where: eq(profileTable.id, updatedProfile.id),
    with: {
      profilePictures: {
        with: {
          image: true,
        },
      },
    },
  });

  return {
    id: updatedProfile.id,
    name: updatedProfile.name,
    username: updatedProfile.username,
    bio: updatedProfile.bio,
    is_primary: updatedProfile.isPrimary,
    createdAt: updatedProfile.createdAt,
    updatedAt: updatedProfile.updatedAt,
    profile_picture_url: profileWithProfilePicture
      ? getProfilePictureUrl(profileWithProfilePicture.profilePictures)
      : null,
  };
}

/**
 * Get users who have access to an profile (for sharing)
 * Returns all profiles for each user instead of just primary
 */
export async function getProfileSharedUsers(userId: string, profileId: string) {
  // Check if user can manage this profile (only owners can see user list)
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(403, "이 프로필을 관리할 권한이 없습니다");
  }

  // Get the community ID for this profile
  const profile = await db.query.profile.findFirst({
    where: eq(profileTable.id, profileId),
  });

  if (!profile) {
    throw new AppException(404, "프로필을 찾을 수 없습니다");
  }

  const profileUsers = await getProfileUsers(profileId);

  // For each user, get all their profiles in this community
  const usersWithRoles = await Promise.all(
    profileUsers.map(async (ownership) => {
      // Get all profiles for this user in the community
      const userProfileOwnerships = await getUserProfiles(
        ownership.user.id,
        profile.communityId,
      );

      // Load profile details with pictures
      const profileIds = userProfileOwnerships.map((po) => po.profileId);
      const userProfiles =
        profileIds.length > 0
          ? await db.query.profile.findMany({
              where: inArray(profileTable.id, profileIds),
              with: {
                profilePictures: {
                  where: isNull(profilePictureTable.deletedAt),
                  with: {
                    image: true,
                  },
                },
              },
            })
          : [];

      // Map profiles to return format
      const profiles = userProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        username: p.username,
        profile_picture_url: getProfilePictureUrl(p.profilePictures),
        is_primary: p.isPrimary,
      }));

      // Get primary profile ID for backwards compatibility
      const primaryProfile = profiles.find((p) => p.is_primary);

      return {
        primary_profile_id: primaryProfile?.id || null,
        profiles,
        role: ownership.role,
        added_at: ownership.createdAt,
      };
    }),
  );

  return { users: usersWithRoles };
}

/**
 * Share an profile with another user
 */
export async function shareProfileWithUser(
  userId: string,
  profileId: string,
  communityId: string,
  targetUsername: string,
  role: "admin",
) {
  // Check if user can manage this profile (only owners can add users)
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(403, "이 프로필을 관리할 권한이 없습니다");
  }

  // Get the profile to check if it's primary
  const profile = await db.query.profile.findFirst({
    where: eq(profileTable.id, profileId),
  });

  if (!profile) {
    throw new AppException(404, "프로필을 찾을 수 없습니다");
  }

  // Prevent sharing primary profiles
  if (profile.isPrimary) {
    throw new AppException(400, "주 프로필는 공유할 수 없습니다");
  }

  // Find user by profile username
  const targetProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, targetUsername),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
    with: {
      ownerships: {
        where: eq(profileOwnershipTable.role, "owner"),
        with: {
          user: true,
        },
      },
    },
  });

  if (!targetProfile || !targetProfile.ownerships[0]) {
    throw new AppException(404, "사용자를 찾을 수 없습니다");
  }

  const targetUser = targetProfile.ownerships[0].user;

  // Check if target user is a member of this community
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, targetUser.id),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  if (!membership) {
    throw new AppException(400, "사용자가 이 커뮤의 회원이 아닙니다");
  }

  // Check if user already has access to this profile
  const existingOwnership = await db.query.profileOwnership.findFirst({
    where: and(
      eq(profileOwnershipTable.profileId, profileId),
      eq(profileOwnershipTable.userId, targetUser.id),
    ),
  });

  if (existingOwnership) {
    throw new AppException(
      400,
      "사용자가 이미 이 프로필에 액세스 권한을 가지고 있습니다",
    );
  }

  // Add user to profile
  await addUserToProfile(profileId, targetUser.id, role, userId);

  // Get primary profile ID for the target user in this community
  const primaryProfileId = await getPrimaryProfileIdForUserInCommunity(
    targetUser.id,
    profile.communityId,
  );

  return {
    message: "사용자가 성공적으로 추가되었습니다",
    user: {
      primary_profile_id: primaryProfileId,
      role: role,
    },
  };
}

/**
 * Remove a user's access to an profile
 */
export async function removeUserFromProfileSharing(
  userId: string,
  profileId: string,
  targetUserId: string,
) {
  // Check if user can manage this profile (only owners can remove users)
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(403, "이 프로필을 관리할 권한이 없습니다");
  }

  // Prevent removing self if you're the only owner
  if (userId === targetUserId) {
    const profileUsers = await getProfileUsers(profileId);
    const owners = profileUsers.filter((u) => u.role === "owner");
    if (owners.length === 1) {
      throw new AppException(400, "유일한 소유자는 자신을 제거할 수 없습니다");
    }
  }

  await removeUserFromProfile(profileId, targetUserId);
}

/**
 * Get user ID(s) from profile ownership
 */
export async function getUserIdsFromProfile(profileId: string) {
  const profileOwnerships = await db.query.profileOwnership.findMany({
    where: eq(profileOwnershipTable.profileId, profileId),
  });

  if (!profileOwnerships || profileOwnerships.length === 0) {
    throw new AppException(404, "프로필을 찾을 수 없습니다");
  }

  return profileOwnerships.map((ownership) => ownership.userId);
}
