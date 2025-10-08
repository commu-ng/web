import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { profilePicture as profilePictureTable } from "../drizzle/schema";
import { addImageUrl } from "./r2";

/**
 * Get profile picture URL for a single profile
 * Handles the common pattern of finding non-deleted profile picture and adding URL
 */
export function getProfilePictureUrl(
  profilePictures: Array<{
    deletedAt: string | null;
    image: {
      id: string;
      key: string;
      filename: string;
      width: number;
      height: number;
      deletedAt: string | null;
      createdAt: string;
    };
  }>,
): string | null {
  const profilePicture = profilePictures.find(
    (pp) => pp.deletedAt === null,
  )?.image;

  return profilePicture ? addImageUrl(profilePicture).url : null;
}

/**
 * Batch load profile pictures for multiple profile IDs
 * Returns a Map of profileId -> profile picture URL
 */
export async function batchLoadProfilePictures(
  profileIds: string[],
): Promise<Map<string, string | null>> {
  if (profileIds.length === 0) {
    return new Map();
  }

  const profilePictures = await db.query.profilePicture.findMany({
    where: and(
      inArray(profilePictureTable.profileId, profileIds),
      isNull(profilePictureTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });

  const pictureMap = new Map<string, string | null>();

  // Initialize all profiles with null
  for (const id of profileIds) {
    pictureMap.set(id, null);
  }

  // Set URLs for profiles that have pictures
  profilePictures.forEach((pp) => {
    if (pp.image && !pp.image.deletedAt) {
      pictureMap.set(pp.profileId, addImageUrl(pp.image).url);
    }
  });

  return pictureMap;
}

/**
 * Get profile picture URL for a single profile by ID
 */
export async function getProfilePictureUrlById(
  profileId: string,
): Promise<string | null> {
  const profilePicture = await db.query.profilePicture.findFirst({
    where: and(
      eq(profilePictureTable.profileId, profileId),
      isNull(profilePictureTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });

  if (!profilePicture?.image || profilePicture.image.deletedAt) {
    return null;
  }

  return addImageUrl(profilePicture.image).url;
}

/**
 * Type for profile with picture URL
 */
export interface ProfileWithPicture {
  id: string;
  username: string;
  name: string;
  profile_picture_url: string | null;
}

/**
 * Helper to format profile data with picture URL
 */
export function formatProfileWithPicture(
  profile: {
    id: string;
    username: string;
    name: string;
  },
  profilePictureUrl: string | null,
): ProfileWithPicture {
  return {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    profile_picture_url: profilePictureUrl,
  };
}
