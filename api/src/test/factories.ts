import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";
import {
  communityApplication as communityApplicationTable,
  community as communityTable,
  groupChat as groupChatTable,
  groupChatMembership as groupChatMembershipTable,
  membership as membershipTable,
  post as postTable,
  profileOwnership as profileOwnershipTable,
  profile as profileTable,
  user as userTable,
} from "../drizzle/schema";
import { testDb } from "./setup";

/**
 * Factory functions for creating test data
 */

/**
 * Generate a unique identifier for test data
 * Combines timestamp with random number to prevent collisions in parallel tests
 */
function generateUniqueId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export async function createTestUser(
  data: Partial<{
    loginName: string;
    email: string;
    password: string;
    isAdmin: boolean;
  }> = {},
) {
  const passwordHash = await bcrypt.hash(data.password || "password123", 10);

  const result = await testDb
    .insert(userTable)
    .values({
      loginName: data.loginName || `user_${generateUniqueId()}`,
      email: data.email || `test_${generateUniqueId()}@example.com`,
      passwordHash,
      isAdmin: data.isAdmin || false,
    })
    .returning();

  if (!result[0]) {
    throw new Error("Failed to create test user");
  }

  return result[0];
}

export async function createTestCommunity(
  data: Partial<{
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    isRecruiting: boolean;
    recruitingStartsAt: string | null;
    recruitingEndsAt: string | null;
  }> = {},
) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const result = await testDb
    .insert(communityTable)
    .values({
      name: data.name || `Test Community ${generateUniqueId()}`,
      slug: data.slug || `test-comm-${generateUniqueId().replace(/_/g, "-")}`,
      startsAt: data.startsAt || yesterday.toISOString(),
      endsAt: data.endsAt || nextWeek.toISOString(),
      isRecruiting: data.isRecruiting ?? true,
      recruitingStartsAt: data.recruitingStartsAt || yesterday.toISOString(),
      recruitingEndsAt: data.recruitingEndsAt || tomorrow.toISOString(),
    })
    .returning();

  if (!result[0]) {
    throw new Error("Failed to create test community");
  }

  return result[0];
}

export async function createTestMembership(
  userId: string,
  communityId: string,
  data: Partial<{
    role: "owner" | "moderator" | "member";
    activatedAt: string | null;
  }> = {},
) {
  const result = await testDb
    .insert(membershipTable)
    .values({
      userId,
      communityId,
      role: data.role || "member",
      activatedAt: data.activatedAt === null ? null : sql`NOW()`,
    })
    .returning();

  if (!result[0]) {
    throw new Error("Failed to create test membership");
  }

  return result[0];
}

export async function createTestProfile(
  userId: string,
  communityId: string,
  data: Partial<{
    name: string;
    username: string;
    activatedAt: string | null;
    isPrimary: boolean;
  }> = {},
) {
  const result = await testDb
    .insert(profileTable)
    .values({
      name: data.name || `Test User`,
      username: data.username || `testuser_${generateUniqueId()}`,
      communityId,
      activatedAt: data.activatedAt === null ? null : sql`NOW()`,
      isPrimary: data.isPrimary || false,
    })
    .returning();

  const profile = result[0];
  if (!profile) {
    throw new Error("Failed to create test profile");
  }

  // Create ownership record
  await testDb.insert(profileOwnershipTable).values({
    profileId: profile.id,
    userId,
    role: "owner",
    createdBy: userId,
  });

  return profile;
}

export async function createTestApplication(
  userId: string,
  communityId: string,
  data: Partial<{
    profileName: string;
    profileUsername: string;
    message: string | null;
    status: "pending" | "approved" | "rejected";
  }> = {},
) {
  const result = await testDb
    .insert(communityApplicationTable)
    .values({
      userId,
      communityId,
      profileName: data.profileName || "Test Applicant",
      profileUsername:
        data.profileUsername || `applicant_${generateUniqueId()}`,
      message: data.message || null,
      status: data.status || "pending",
    })
    .returning();

  if (!result[0]) {
    throw new Error("Failed to create test application");
  }

  return result[0];
}

/**
 * Helper to create a complete community setup with owner
 */
export async function createCommunityWithOwner(
  userData: Parameters<typeof createTestUser>[0] = {},
  communityData: Parameters<typeof createTestCommunity>[0] = {},
) {
  const user = await createTestUser(userData);
  const community = await createTestCommunity(communityData);

  const membership = await createTestMembership(user.id, community.id, {
    role: "owner",
  });

  const profile = await createTestProfile(user.id, community.id, {
    username: userData.loginName || `owner_${generateUniqueId()}`,
    isPrimary: true,
  });

  return { user, community, membership, profile };
}

export async function createTestPost(
  authorId: string,
  communityId: string,
  data: Partial<{
    content: string;
    announcement: boolean;
    contentWarning: string | null;
    inReplyToId: string | null;
    publishedAt: string | null;
  }> = {},
) {
  // Get userId from profile ownership
  const ownership = await testDb.query.profileOwnership.findFirst({
    where: (fields, { eq }) => eq(fields.profileId, authorId),
  });

  if (!ownership) {
    throw new Error(`Profile ownership not found for profile ${authorId}`);
  }

  const result = await testDb
    .insert(postTable)
    .values({
      authorId,
      communityId,
      createdByUserId: ownership.userId,
      content: data.content || `Test post ${generateUniqueId()}`,
      announcement: data.announcement || false,
      contentWarning: data.contentWarning || null,
      inReplyToId: data.inReplyToId || null,
      publishedAt: data.publishedAt === null ? null : sql`NOW()`,
      depth: 0,
    })
    .returning();

  if (!result[0]) {
    throw new Error("Failed to create test post");
  }

  return result[0];
}

export async function createTestGroupChat(
  communityId: string,
  createdByProfileId: string,
  data: Partial<{
    name: string;
  }> = {},
) {
  const result = await testDb
    .insert(groupChatTable)
    .values({
      name: data.name || `Test Group ${generateUniqueId()}`,
      communityId,
      createdById: createdByProfileId,
    })
    .returning();

  if (!result[0]) {
    throw new Error("Failed to create test group chat");
  }

  return result[0];
}

export async function createTestGroupChatMembership(
  groupChatId: string,
  profileId: string,
) {
  const result = await testDb
    .insert(groupChatMembershipTable)
    .values({
      groupChatId,
      profileId,
    })
    .returning();

  if (!result[0]) {
    throw new Error("Failed to create test group chat membership");
  }

  return result[0];
}
