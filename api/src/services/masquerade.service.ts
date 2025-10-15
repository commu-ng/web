import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  masqueradeAuditLog as masqueradeAuditLogTable,
  session as sessionTable,
  user as userTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import * as authService from "./auth.service";

/**
 * Start masquerading as another user
 * Only admins can masquerade
 * Creates a console session (communityId = null) for the target user with original admin user ID tracked
 */
export async function startMasquerade(
  adminUserId: string,
  targetUserId: string,
) {
  // Verify admin user
  const adminUser = await db.query.user.findFirst({
    where: and(eq(userTable.id, adminUserId), isNull(userTable.deletedAt)),
  });

  if (!adminUser) {
    throw new AppException(404, "관리자 사용자를 찾을 수 없습니다");
  }

  if (!adminUser.isAdmin) {
    throw new AppException(403, "관리자만 다른 사용자로 전환할 수 있습니다");
  }

  // Verify target user exists
  const targetUser = await db.query.user.findFirst({
    where: and(eq(userTable.id, targetUserId), isNull(userTable.deletedAt)),
  });

  if (!targetUser) {
    throw new AppException(404, "대상 사용자를 찾을 수 없습니다");
  }

  // Cannot masquerade as yourself
  if (adminUserId === targetUserId) {
    throw new AppException(400, "자기 자신으로 전환할 수 없습니다");
  }

  // Create new session for target user with original user ID tracked
  const session = await authService.createSession(targetUserId, null);

  // Update session to include original user ID
  await db
    .update(sessionTable)
    .set({ originalUserId: adminUserId })
    .where(eq(sessionTable.id, session.id));

  // Log the masquerade start
  await db.insert(masqueradeAuditLogTable).values({
    adminUserId,
    targetUserId,
    action: "start",
    sessionId: session.id,
  });

  // Get updated session with originalUserId
  const updatedSession = await db.query.session.findFirst({
    where: eq(sessionTable.id, session.id),
  });

  return {
    session: updatedSession,
    targetUser: {
      id: targetUser.id,
      loginName: targetUser.loginName,
    },
  };
}

/**
 * End masquerade session and return to admin user
 * Logs the end action and invalidates the masquerade session
 */
export async function endMasquerade(sessionToken: string) {
  // Get the session
  const result = await authService.validateSessionAndGetUser(sessionToken);

  if (!result) {
    throw new AppException(401, "유효하지 않은 세션입니다");
  }

  const { session } = result;

  // Check if this is actually a masquerade session
  if (!session.originalUserId) {
    throw new AppException(400, "이 세션은 전환 세션이 아닙니다");
  }

  // Log the masquerade end
  const auditLogEntry = await db.query.masqueradeAuditLog.findFirst({
    where: and(
      eq(masqueradeAuditLogTable.sessionId, session.id),
      eq(masqueradeAuditLogTable.action, "start"),
    ),
    orderBy: [desc(masqueradeAuditLogTable.createdAt)],
  });

  if (auditLogEntry) {
    await db.insert(masqueradeAuditLogTable).values({
      adminUserId: session.originalUserId,
      targetUserId: session.userId,
      action: "end",
      sessionId: session.id,
    });
  }

  // Clear session references from audit logs before deletion
  // This prevents foreign key constraint violations
  await db
    .update(masqueradeAuditLogTable)
    .set({ sessionId: null })
    .where(eq(masqueradeAuditLogTable.sessionId, session.id));

  // Delete the masquerade session
  await db.delete(sessionTable).where(eq(sessionTable.token, sessionToken));

  // Create a new session for the original admin user
  const adminSession = await authService.createSession(
    session.originalUserId,
    null,
  );

  return {
    session: adminSession,
    adminUserId: session.originalUserId,
  };
}

/**
 * Get masquerade status for a session
 * Returns null if not masquerading, otherwise returns masquerade info
 */
export async function getMasqueradeStatus(sessionToken: string) {
  const result = await authService.validateSessionAndGetUser(sessionToken);

  if (!result) {
    return null;
  }

  const { session, user } = result;

  // Check if this is a masquerade session
  if (!session.originalUserId) {
    return null;
  }

  // Get the original admin user info
  const adminUser = await db.query.user.findFirst({
    where: eq(userTable.id, session.originalUserId),
  });

  if (!adminUser) {
    return null;
  }

  return {
    isMasquerading: true,
    adminUser: {
      id: adminUser.id,
      loginName: adminUser.loginName,
    },
    targetUser: {
      id: user.id,
      loginName: user.loginName,
    },
  };
}

/**
 * Check if a session is a masquerade session
 */
export function isMasqueradeSession(
  session: typeof sessionTable.$inferSelect,
): boolean {
  return session.originalUserId !== null;
}

/**
 * List users for admin to masquerade as
 * Excludes deleted users and the current admin
 * Supports server-side search by loginName, email, or UUID
 */
export async function listUsersForMasquerade(
  adminUserId: string,
  limit = 50,
  search?: string,
) {
  // Verify admin user
  const adminUser = await db.query.user.findFirst({
    where: and(eq(userTable.id, adminUserId), isNull(userTable.deletedAt)),
  });

  if (!adminUser) {
    throw new AppException(404, "관리자 사용자를 찾을 수 없습니다");
  }

  if (!adminUser.isAdmin) {
    throw new AppException(403, "관리자만 사용자 목록을 볼 수 있습니다");
  }

  // Get all non-deleted users except the admin themselves
  const users = await db.query.user.findMany({
    where: isNull(userTable.deletedAt),
    columns: {
      id: true,
      loginName: true,
      email: true,
      createdAt: true,
      isAdmin: true,
    },
    orderBy: [desc(userTable.createdAt)],
    limit,
  });

  // Exclude the current admin
  let filteredUsers = users.filter((u) => u.id !== adminUserId);

  // Apply search filter if provided
  if (search?.trim()) {
    const searchLower = search.trim().toLowerCase();
    filteredUsers = filteredUsers.filter(
      (u) =>
        u.loginName.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower) ||
        u.id.toLowerCase().includes(searchLower),
    );
  }

  return filteredUsers;
}

/**
 * Get masquerade audit logs
 * Admin only
 */
export async function getMasqueradeAuditLogs(adminUserId: string, limit = 100) {
  // Verify admin user
  const adminUser = await db.query.user.findFirst({
    where: and(eq(userTable.id, adminUserId), isNull(userTable.deletedAt)),
  });

  if (!adminUser) {
    throw new AppException(404, "관리자 사용자를 찾을 수 없습니다");
  }

  if (!adminUser.isAdmin) {
    throw new AppException(403, "관리자만 감사 로그를 볼 수 있습니다");
  }

  // Get audit logs with user information
  const logs = await db
    .select({
      id: masqueradeAuditLogTable.id,
      action: masqueradeAuditLogTable.action,
      createdAt: masqueradeAuditLogTable.createdAt,
      endedAt: masqueradeAuditLogTable.endedAt,
      sessionId: masqueradeAuditLogTable.sessionId,
      adminUserId: masqueradeAuditLogTable.adminUserId,
      targetUserId: masqueradeAuditLogTable.targetUserId,
    })
    .from(masqueradeAuditLogTable)
    .orderBy(desc(masqueradeAuditLogTable.createdAt))
    .limit(limit);

  return logs;
}
