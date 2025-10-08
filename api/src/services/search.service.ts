import { sql } from "drizzle-orm";
import { db } from "../db";
import { hashtag as hashtagTable } from "../drizzle/schema";

/**
 * Search for hashtags by tag using prefix matching for better performance
 * Uses the existing unique index on 'tag' column for efficient lookups
 */
export async function searchHashtags(query: string, limit: number = 10) {
  if (!query || query.length < 2) {
    return [];
  }

  // Use prefix matching (LIKE 'query%') instead of substring matching (LIKE '%query%')
  // This allows PostgreSQL to use the B-tree index on the tag column
  const searchResults = await db.query.hashtag.findMany({
    where: sql`LOWER(${hashtagTable.tag}) LIKE LOWER(${`${query}%`})`,
    limit,
    orderBy: [hashtagTable.tag],
  });

  return searchResults.map((h) => ({
    id: h.id,
    tag: h.tag,
  }));
}
