import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { user as userTable, userBlock } from "../drizzle/schema";
import { AppException } from "../exception";

export enum BlockErrorCode {
  USER_NOT_FOUND = "USER_NOT_FOUND",
  ALREADY_BLOCKED = "ALREADY_BLOCKED",
  NOT_BLOCKED = "NOT_BLOCKED",
  CANNOT_BLOCK_SELF = "CANNOT_BLOCK_SELF",
}

/**
 * Block a user
 */
export async function blockUser(blockerId: string, blockedId: string) {
  // Prevent self-blocking
  if (blockerId === blockedId) {
    throw new AppException(
      400,
      BlockErrorCode.CANNOT_BLOCK_SELF,
      "You cannot block yourself",
    );
  }

  // Validate target user exists
  const targetUser = await db.query.user.findFirst({
    where: eq(userTable.id, blockedId),
  });

  if (!targetUser) {
    throw new AppException(
      404,
      BlockErrorCode.USER_NOT_FOUND,
      "User not found",
    );
  }

  // Check if already blocked
  const existingBlock = await db.query.userBlock.findFirst({
    where: and(
      eq(userBlock.blockerId, blockerId),
      eq(userBlock.blockedId, blockedId),
    ),
  });

  if (existingBlock) {
    throw new AppException(
      409,
      BlockErrorCode.ALREADY_BLOCKED,
      "User already blocked",
    );
  }

  await db.insert(userBlock).values({
    blockerId,
    blockedId,
  });
}

/**
 * Unblock a user
 */
export async function unblockUser(blockerId: string, blockedId: string) {
  const existingBlock = await db.query.userBlock.findFirst({
    where: and(
      eq(userBlock.blockerId, blockerId),
      eq(userBlock.blockedId, blockedId),
    ),
  });

  if (!existingBlock) {
    throw new AppException(404, BlockErrorCode.NOT_BLOCKED, "User not blocked");
  }

  await db
    .delete(userBlock)
    .where(
      and(
        eq(userBlock.blockerId, blockerId),
        eq(userBlock.blockedId, blockedId),
      ),
    );
}

/**
 * Get list of blocked users with details
 */
export async function getBlockedUsers(blockerId: string) {
  const blocks = await db.query.userBlock.findMany({
    where: eq(userBlock.blockerId, blockerId),
    with: {
      blocked: true,
    },
    orderBy: (userBlock, { desc }) => [desc(userBlock.createdAt)],
  });

  return blocks.map((block) => ({
    id: block.blocked.id,
    login_name: block.blocked.loginName,
    blocked_at: block.createdAt,
  }));
}

/**
 * Get array of blocked user IDs (for filtering)
 */
export async function getBlockedUserIds(blockerId: string): Promise<string[]> {
  const blocks = await db.query.userBlock.findMany({
    where: eq(userBlock.blockerId, blockerId),
    columns: { blockedId: true },
  });
  return blocks.map((block) => block.blockedId);
}

/**
 * Check if a user is blocked
 */
export async function isUserBlocked(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const block = await db.query.userBlock.findFirst({
    where: and(
      eq(userBlock.blockerId, blockerId),
      eq(userBlock.blockedId, blockedId),
    ),
  });
  return !!block;
}
