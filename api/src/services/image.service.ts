import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  communityBannerImage as communityBannerImageTable,
  communityDescriptionImage as communityDescriptionImageTable,
  image as imageTable,
  postImage as postImageTable,
  profilePicture as profilePictureTable,
} from "../drizzle/schema";
import { addImageUrl, deleteFile } from "../utils/r2";

/**
 * Check if an image is used in multiple places and delete if unused
 * Returns true if the image was deleted, false if it's still in use
 */
export async function deleteImageIfUnused(imageId: string): Promise<boolean> {
  // Check if image is used anywhere in a single query using UNION
  const usageCheck = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM (
      SELECT 1 FROM ${communityBannerImageTable}
      WHERE ${communityBannerImageTable.imageId} = ${imageId}
        AND ${communityBannerImageTable.deletedAt} IS NULL
      UNION ALL
      SELECT 1 FROM ${communityDescriptionImageTable}
      WHERE ${communityDescriptionImageTable.imageId} = ${imageId}
        AND ${communityDescriptionImageTable.deletedAt} IS NULL
      UNION ALL
      SELECT 1 FROM ${postImageTable}
      WHERE ${postImageTable.imageId} = ${imageId}
      UNION ALL
      SELECT 1 FROM ${profilePictureTable}
      WHERE ${profilePictureTable.imageId} = ${imageId}
    ) as usage_check
  `);

  const usageCount = usageCheck.rows[0]?.count || 0;

  // Only delete the image if it's not used anywhere
  if (usageCount === 0) {
    // Get the image key before deleting
    const image = await db.query.image.findFirst({
      where: eq(imageTable.id, imageId),
    });

    if (!image) {
      return false;
    }

    // Soft delete the image record
    await db
      .update(imageTable)
      .set({ deletedAt: sql`NOW()` })
      .where(eq(imageTable.id, imageId));

    // Delete the file from R2 storage
    await deleteFile(image.key);

    return true;
  }

  return false;
}

/**
 * Batch check and delete unused images
 * Returns array of deleted image IDs
 */
export async function batchDeleteImagesIfUnused(
  imageIds: string[],
): Promise<string[]> {
  if (imageIds.length === 0) {
    return [];
  }

  // Check usage for all images in a single query
  const usageCheck = await db.execute<{ image_id: string; count: number }>(sql`
    WITH image_usage AS (
      SELECT
        ${communityBannerImageTable.imageId} as image_id,
        COUNT(*) as count
      FROM ${communityBannerImageTable}
      WHERE ${communityBannerImageTable.imageId} IN ${imageIds}
        AND ${communityBannerImageTable.deletedAt} IS NULL
      GROUP BY ${communityBannerImageTable.imageId}

      UNION ALL

      SELECT
        ${communityDescriptionImageTable.imageId} as image_id,
        COUNT(*) as count
      FROM ${communityDescriptionImageTable}
      WHERE ${communityDescriptionImageTable.imageId} IN ${imageIds}
        AND ${communityDescriptionImageTable.deletedAt} IS NULL
      GROUP BY ${communityDescriptionImageTable.imageId}

      UNION ALL

      SELECT
        ${postImageTable.imageId} as image_id,
        COUNT(*) as count
      FROM ${postImageTable}
      WHERE ${postImageTable.imageId} IN ${imageIds}
      GROUP BY ${postImageTable.imageId}

      UNION ALL

      SELECT
        ${profilePictureTable.imageId} as image_id,
        COUNT(*) as count
      FROM ${profilePictureTable}
      WHERE ${profilePictureTable.imageId} IN ${imageIds}
      GROUP BY ${profilePictureTable.imageId}
    )
    SELECT image_id, SUM(count)::int as count
    FROM image_usage
    GROUP BY image_id
  `);

  // Build set of used image IDs
  const usedImageIds = new Set(usageCheck.rows.map((row) => row.image_id));

  // Find unused images
  const unusedImageIds = imageIds.filter((id) => !usedImageIds.has(id));

  if (unusedImageIds.length === 0) {
    return [];
  }

  // Batch load image keys before deleting
  const images = await db.query.image.findMany({
    where: inArray(imageTable.id, unusedImageIds),
  });

  // Soft delete all unused images
  await db
    .update(imageTable)
    .set({ deletedAt: sql`NOW()` })
    .where(inArray(imageTable.id, unusedImageIds));

  // Delete files from R2 storage
  await Promise.all(images.map((image) => deleteFile(image.key)));

  return unusedImageIds;
}

/**
 * Get community banner info with URL (single community)
 */
export async function getCommunityBannerInfo(
  communityId: string,
): Promise<{ url: string; width: number; height: number } | null>;

/**
 * Get community banner info with URL (multiple communities)
 */
export async function getCommunityBannerInfo(
  communityIds: string[],
): Promise<Map<string, { url: string; width: number; height: number }>>;

export async function getCommunityBannerInfo(
  communityIdOrIds: string | string[],
): Promise<
  | { url: string; width: number; height: number }
  | null
  | Map<string, { url: string; width: number; height: number }>
> {
  // Single community case
  if (typeof communityIdOrIds === "string") {
    const bannerImage = await db.query.communityBannerImage.findFirst({
      where: and(
        eq(communityBannerImageTable.communityId, communityIdOrIds),
        isNull(communityBannerImageTable.deletedAt),
        isNull(imageTable.deletedAt),
      ),
      with: {
        image: true,
      },
    });

    if (bannerImage?.image) {
      const imageWithUrl = addImageUrl(bannerImage.image);
      return {
        url: imageWithUrl.url,
        width: imageWithUrl.width,
        height: imageWithUrl.height,
      };
    }
    return null;
  }

  const bannerImages = await db.query.communityBannerImage.findMany({
    where: and(
      inArray(communityBannerImageTable.communityId, communityIdOrIds),
      isNull(communityBannerImageTable.deletedAt),
      isNull(imageTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });

  const resultMap = new Map<
    string,
    { url: string; width: number; height: number }
  >();
  for (const bannerImage of bannerImages) {
    if (bannerImage.image) {
      const imageWithUrl = addImageUrl(bannerImage.image);
      resultMap.set(bannerImage.communityId, {
        url: imageWithUrl.url,
        width: imageWithUrl.width,
        height: imageWithUrl.height,
      });
    }
  }

  return resultMap;
}
/**
 * Create an image record in the database
 */
export async function createImageRecord(
  key: string,
  filename: string,
  width: number,
  height: number,
) {
  const newImageResult = await db
    .insert(imageTable)
    .values({
      key,
      filename,
      width,
      height,
    })
    .returning();

  const newImage = newImageResult[0];
  if (!newImage) {
    throw new Error("Failed to create image record");
  }

  return newImage;
}
