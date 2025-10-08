import { eq, inArray } from "drizzle-orm";
import type { db } from "../db";
import {
  communityHashtag as communityHashtagTable,
  hashtag as hashtagTable,
} from "../drizzle/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Process and upsert hashtags, returning their IDs
 * Handles cleaning, deduplication, and database upsert
 * Optimized to batch queries instead of N+1 pattern
 */
export async function upsertHashtags(
  tags: string[],
  tx: Transaction,
): Promise<string[]> {
  // Clean and deduplicate tags
  const cleanedTags = Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0),
    ),
  );

  if (cleanedTags.length === 0) {
    return [];
  }

  // Batch load all existing hashtags in a single query
  const existingHashtags = await tx.query.hashtag.findMany({
    where: inArray(hashtagTable.tag, cleanedTags),
  });

  // Create a map of tag -> hashtag for O(1) lookup
  const existingTagMap = new Map(existingHashtags.map((h) => [h.tag, h]));

  // Identify which tags need to be created
  const tagsToCreate = cleanedTags.filter((tag) => !existingTagMap.has(tag));

  // Batch insert all new hashtags in a single query
  if (tagsToCreate.length > 0) {
    const newHashtags = await tx
      .insert(hashtagTable)
      .values(tagsToCreate.map((tag) => ({ tag })))
      .returning();

    // Add newly created hashtags to the map
    for (const hashtag of newHashtags) {
      existingTagMap.set(hashtag.tag, hashtag);
    }
  }

  // Build result array in the same order as input cleanedTags
  const hashtagIds = cleanedTags.map((tag) => {
    const hashtag = existingTagMap.get(tag);
    if (!hashtag) {
      throw new Error(`Failed to get hashtag ID for tag: ${tag}`);
    }
    return hashtag.id;
  });

  return hashtagIds;
}

/**
 * Replace all hashtags for a community
 * Deletes existing associations and creates new ones
 */
export async function replaceCommunityHashtags(
  communityId: string,
  tags: string[],
  tx: Transaction,
): Promise<void> {
  // Remove all existing hashtag associations
  await tx
    .delete(communityHashtagTable)
    .where(eq(communityHashtagTable.communityId, communityId));

  if (tags.length === 0) {
    return;
  }

  // Upsert hashtags and get their IDs
  const hashtagIds = await upsertHashtags(tags, tx);

  // Create new associations
  const hashtagAssociations = hashtagIds.map((hashtagId) => ({
    communityId,
    hashtagId,
  }));

  await tx.insert(communityHashtagTable).values(hashtagAssociations);
}

/**
 * Create hashtag associations for a new community
 */
export async function createCommunityHashtags(
  communityId: string,
  tags: string[],
  tx: Transaction,
): Promise<void> {
  if (tags.length === 0) {
    return;
  }

  const hashtagIds = await upsertHashtags(tags, tx);

  const hashtagAssociations = hashtagIds.map((hashtagId) => ({
    communityId,
    hashtagId,
  }));

  await tx.insert(communityHashtagTable).values(hashtagAssociations);
}
