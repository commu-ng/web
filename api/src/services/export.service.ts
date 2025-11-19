import archiver from "archiver";
import { and, eq, isNull } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Readable } from "node:stream";
import { batchDb } from "../db";
import {
  community as communityTable,
  profileOwnership as profileOwnershipTable,
  profile as profileTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";
import { logger } from "../config/logger";
import * as messageService from "./message.service";
import * as postService from "./post.service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, "../templates");

interface ExportPost {
  id: string;
  content: string;
  createdAt: string | null;
  updatedAt: string | null;
  announcement: boolean;
  contentWarning: string | null;
  author: {
    id: string;
    name: string;
    username: string;
    profilePictureUrl: string | null;
  };
  images: Array<{
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  }>;
  reactions: Array<{
    emoji: string;
    user: {
      id: string;
      username: string;
      name: string;
    };
  }>;
  depth: number;
  inReplyToId: string | null;
  replies: ExportPost[];
}

interface ExportDirectMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username: string;
    profilePictureUrl?: string | null;
  };
  receiver: {
    id: string;
    name: string;
    username: string;
    profilePictureUrl?: string | null;
  };
  reactions: Array<{
    emoji: string;
    user: {
      id: string;
      username: string;
      name: string;
    };
  }>;
}

interface ExportGroupMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username: string;
    profilePictureUrl?: string | null;
  };
  images: Array<{
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  }>;
  reactions: Array<{
    emoji: string;
    user: {
      id: string;
      username: string;
      name: string;
    };
  }>;
}

interface ExportGroupChat {
  id: string;
  name: string;
  createdAt: string;
  messages: ExportGroupMessage[];
}

/**
 * Stream posts in batches using async generator
 * Yields batches instead of loading all posts into memory
 */
async function* streamPostsForExport(
  communityId: string,
): AsyncGenerator<ExportPost[], void, unknown> {
  const batchSize = 100;
  let cursor: string | undefined;

  while (true) {
    const result = await postService.getPosts(
      communityId,
      batchSize,
      cursor,
      undefined,
    );

    if (result.data.length === 0) break;

    // Convert batch to export format
    const exportBatch: ExportPost[] = [];
    for (const post of result.data) {
      exportBatch.push({
        id: post.id,
        content: post.content,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        announcement: post.announcement,
        contentWarning: post.content_warning || null,
        author: {
          id: post.author.id,
          name: post.author.name,
          username: post.author.username,
          profilePictureUrl: post.author.profile_picture_url || null,
        },
        images: post.images || [],
        reactions: post.reactions || [],
        depth: post.depth,
        inReplyToId: post.in_reply_to_id || null,
        replies: (post.threaded_replies || []).map(
          (reply: Parameters<typeof convertReply>[0]) => convertReply(reply),
        ),
      });
    }

    // Yield batch and free memory
    yield exportBatch;

    if (!result.pagination.has_more) break;
    cursor = result.pagination.next_cursor ?? undefined;
  }
}

/**
 * Convert nested reply to export format
 */
function convertReply(reply: {
  id: string;
  content: string;
  created_at: string | null;
  updated_at: string | null;
  announcement: boolean;
  content_warning?: string | null;
  author: {
    id: string;
    name: string;
    username: string;
    profile_picture_url?: string | null;
  };
  images?: Array<{
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  }>;
  reactions?: Array<{
    emoji: string;
    user: {
      id: string;
      username: string;
      name: string;
    };
  }>;
  depth: number;
  in_reply_to_id?: string | null;
  threaded_replies?: unknown[];
}): ExportPost {
  return {
    id: reply.id,
    content: reply.content,
    createdAt: reply.created_at,
    updatedAt: reply.updated_at,
    announcement: reply.announcement,
    contentWarning: reply.content_warning || null,
    author: {
      id: reply.author.id,
      name: reply.author.name,
      username: reply.author.username,
      profilePictureUrl: reply.author.profile_picture_url || null,
    },
    images: reply.images || [],
    reactions: reply.reactions || [],
    depth: reply.depth,
    inReplyToId: reply.in_reply_to_id || null,
    replies: (reply.threaded_replies || []).map((r) =>
      convertReply(r as typeof reply),
    ),
  };
}

/**
 * Get all direct messages for user's profiles using service layer
 */
async function getAllDirectMessagesForExport(
  communityId: string,
  userProfileIds: string[],
): Promise<Map<string, ExportDirectMessage[]>> {
  const conversations = await messageService.getAllConversationsForExport(
    communityId,
    userProfileIds,
  );

  // Type conversion to match export interface
  const typedConversations = new Map<string, ExportDirectMessage[]>();
  for (const [key, messages] of conversations) {
    typedConversations.set(key, messages as ExportDirectMessage[]);
  }

  return typedConversations;
}

/**
 * Get all group chats for user's profiles using service layer
 */
async function getAllGroupChatsForExport(
  communityId: string,
  userProfileIds: string[],
): Promise<ExportGroupChat[]> {
  const groupChats = await messageService.getAllGroupChatsForExport(
    communityId,
    userProfileIds,
  );

  // Convert snake_case service response to camelCase export format
  return groupChats.map((chat) => ({
    id: chat.id,
    name: chat.name,
    createdAt: chat.created_at,
    messages: chat.messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      createdAt: msg.created_at,
      sender: {
        id: msg.sender.id,
        name: msg.sender.name,
        username: msg.sender.username,
        profilePictureUrl: msg.sender.profilePictureUrl,
      },
      images: msg.images,
      reactions: msg.reactions,
    })),
  }));
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<Buffer> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download image: ${url} (status: ${response.status})`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.service.error("Error downloading image: {url} {error}", {
      url,
      error,
    });
    throw error;
  }
}

/**
 * Download images in parallel batches with controlled concurrency
 */
async function downloadImagesInBatches(
  imageUrls: string[],
  batchSize: number = 10,
): Promise<{
  successful: Array<{ url: string; buffer: Buffer; filename: string }>;
  failed: string[];
}> {
  const successful: Array<{ url: string; buffer: Buffer; filename: string }> =
    [];
  const failed: string[] = [];

  // Process images in batches
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize);

    logger.service.info(
      "Downloading image batch {current}/{total} ({batchStart}-{batchEnd})",
      {
        current: Math.floor(i / batchSize) + 1,
        total: Math.ceil(imageUrls.length / batchSize),
        batchStart: i + 1,
        batchEnd: Math.min(i + batchSize, imageUrls.length),
      },
    );

    // Download batch in parallel
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const buffer = await downloadImage(url);
        const filename = url.split("/").pop() || "image";
        return { url, buffer, filename };
      }),
    );

    // Categorize results
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (!result) continue;

      if (result.status === "fulfilled") {
        successful.push(result.value);
      } else {
        const failedUrl = batch[j];
        if (failedUrl) {
          failed.push(failedUrl);
          logger.service.warn("Failed to download image: {url} {reason}", {
            url: failedUrl,
            reason: result.reason,
          });
        }
      }
    }
  }

  logger.service.info(
    "Image download complete: {successful} successful, {failed} failed out of {total}",
    {
      successful: successful.length,
      failed: failed.length,
      total: imageUrls.length,
    },
  );

  return { successful, failed };
}

/**
 * Export all community data as a ZIP file stream
 * Streams data directly to avoid loading everything into memory
 */
export async function exportCommunityData(
  communityId: string,
  userId: string,
): Promise<{ stream: Readable; filename: string }> {
  // Get community info using batch pool for long-running export operation
  const community = await batchDb.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  // Get all user's profiles in this community via profile_ownership
  const userProfileOwnerships = await batchDb
    .select({
      profileId: profileOwnershipTable.profileId,
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

  const userProfileIds = userProfileOwnerships.map((p) => p.profileId);

  const exportDate = new Date().toISOString();

  // Create PassThrough stream for piping archive output
  const outputStream = new PassThrough();

  // Create ZIP archive
  const archive = archiver("zip", {
    zlib: { level: 9 },
  });

  // Pipe archive to output stream (data flows directly, not accumulated)
  archive.pipe(outputStream);

  // Handle archive errors
  archive.on("error", (err) => {
    logger.service.error("Archive error: {error}", { error: err });
    outputStream.destroy(err);
  });

  // Add index.html (navigation page)
  try {
    let indexContent = await readFile(
      join(TEMPLATES_DIR, "index.html"),
      "utf-8",
    );
    indexContent = indexContent
      .replaceAll("{{COMMUNITY_NAME}}", community.name)
      .replaceAll("{{EXPORT_DATE}}", exportDate);
    archive.append(indexContent, { name: "index.html" });
  } catch (error) {
    logger.service.warn("Failed to add index.html: {error}", { error });
  }

  // Stream posts in batches and collect for HTML embedding
  logger.service.info("Starting to stream posts for export");
  let postCount = 0;
  const allImageUrls = new Set<string>();
  const allPosts: ExportPost[] = [];

  for await (const postBatch of streamPostsForExport(communityId)) {
    postCount += postBatch.length;
    allPosts.push(...postBatch);

    // Collect image URLs from this batch
    for (const post of postBatch) {
      for (const img of post.images) {
        allImageUrls.add(img.url);
      }
      if (post.author.profilePictureUrl) {
        allImageUrls.add(post.author.profilePictureUrl);
      }
      // Recursively collect from replies
      const collectReplyImages = (reply: ExportPost) => {
        for (const img of reply.images) {
          allImageUrls.add(img.url);
        }
        if (reply.author.profilePictureUrl) {
          allImageUrls.add(reply.author.profilePictureUrl);
        }
        for (const r of reply.replies) {
          collectReplyImages(r);
        }
      };
      for (const reply of post.replies) {
        collectReplyImages(reply);
      }
    }

    logger.service.debug("Streamed {count} posts so far", { count: postCount });
  }

  logger.service.info("Completed streaming {postCount} posts", { postCount });

  // Get messages and group chats
  const [directMessages, groupChats] = await Promise.all([
    getAllDirectMessagesForExport(communityId, userProfileIds),
    getAllGroupChatsForExport(communityId, userProfileIds),
  ]);

  // Collect image URLs from messages and chats
  for (const messages of directMessages.values()) {
    for (const msg of messages) {
      if (msg.sender.profilePictureUrl) {
        allImageUrls.add(msg.sender.profilePictureUrl);
      }
      if (msg.receiver.profilePictureUrl) {
        allImageUrls.add(msg.receiver.profilePictureUrl);
      }
    }
  }

  for (const chat of groupChats) {
    for (const msg of chat.messages) {
      if (msg.sender.profilePictureUrl) {
        allImageUrls.add(msg.sender.profilePictureUrl);
      }
      for (const img of msg.images) {
        allImageUrls.add(img.url);
      }
    }
  }

  // Generate posts.html with embedded data
  try {
    let postsContent = await readFile(
      join(TEMPLATES_DIR, "posts.html"),
      "utf-8",
    );
    postsContent = postsContent
      .replaceAll("{{COMMUNITY_NAME}}", community.name)
      .replaceAll("{{EXPORT_DATE}}", exportDate);

    // Embed posts data as JavaScript
    const postsDataScript = `<script>window.POSTS_DATA = ${JSON.stringify({ posts: allPosts, exportDate, communityName: community.name })};</script>`;
    postsContent = postsContent.replace(
      "</head>",
      `${postsDataScript}\n</head>`,
    );

    archive.append(postsContent, { name: "posts.html" });
  } catch (error) {
    logger.service.warn("Failed to add posts.html: {error}", { error });
  }

  // Generate messages.html with embedded data
  try {
    let messagesContent = await readFile(
      join(TEMPLATES_DIR, "messages.html"),
      "utf-8",
    );
    messagesContent = messagesContent
      .replaceAll("{{COMMUNITY_NAME}}", community.name)
      .replaceAll("{{EXPORT_DATE}}", exportDate);

    // Embed messages data as JavaScript
    const messagesDataScript = `<script>window.MESSAGES_DATA = ${JSON.stringify({ directMessages: Array.from(directMessages.entries()), exportDate })};</script>`;
    messagesContent = messagesContent.replace(
      "</head>",
      `${messagesDataScript}\n</head>`,
    );

    archive.append(messagesContent, { name: "messages.html" });
  } catch (error) {
    logger.service.warn("Failed to add messages.html: {error}", {
      error,
    });
  }

  // Generate chats.html with embedded data
  try {
    let chatsContent = await readFile(
      join(TEMPLATES_DIR, "chats.html"),
      "utf-8",
    );
    chatsContent = chatsContent
      .replaceAll("{{COMMUNITY_NAME}}", community.name)
      .replaceAll("{{EXPORT_DATE}}", exportDate);

    // Embed chats data as JavaScript
    const chatsDataScript = `<script>window.CHATS_DATA = ${JSON.stringify({ groupChats, exportDate })};</script>`;
    chatsContent = chatsContent.replace(
      "</head>",
      `${chatsDataScript}\n</head>`,
    );

    archive.append(chatsContent, { name: "chats.html" });
  } catch (error) {
    logger.service.warn("Failed to add chats.html: {error}", { error });
  }

  // Filter out undefined/null URLs before downloading
  const imageUrls = Array.from(allImageUrls).filter(
    (url): url is string => url != null && url !== "",
  );
  logger.service.info("Starting export with {imageCount} images to download", {
    imageCount: imageUrls.length,
  });

  // Download images in parallel batches
  const { successful: downloadedImages, failed: failedImages } =
    await downloadImagesInBatches(imageUrls, 10);

  // Add successfully downloaded images to archive
  for (const { buffer, filename } of downloadedImages) {
    archive.append(buffer, { name: `images/${filename}` });
  }

  // Log failed images if any
  if (failedImages.length > 0) {
    logger.service.warn(
      "Export completed with {failedCount} failed image downloads",
      {
        failedCount: failedImages.length,
        failedUrls: failedImages,
      },
    );
  }

  // Finalize the archive (archive will emit 'end' when done)
  archive.finalize();

  // Generate filename
  const dateStr = new Date().toISOString().split("T")[0]?.replace(/-/g, "");
  const filename = `${community.slug}-export-${dateStr}.zip`;

  return { stream: outputStream, filename };
}
