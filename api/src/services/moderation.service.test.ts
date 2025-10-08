import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import {
  community as communityTable,
  membership as membershipTable,
  moderationLog as moderationLogTable,
  profileOwnership as profileOwnershipTable,
  profile as profileTable,
  user as userTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import * as moderationService from "./moderation.service";

describe("Moderation Service", () => {
  let communityId: string;
  let ownerUserId: string;
  let ownerProfileId: string;
  let moderatorUserId: string;
  let moderatorProfileId: string;
  let memberUserId: string;
  let memberProfileId: string;

  beforeEach(async () => {
    // Create a community with unique slug
    const uniqueSlug = `test-community-mute-${Date.now()}`;
    const community = await db
      .insert(communityTable)
      .values({
        name: "Test Community",
        slug: uniqueSlug,
        startsAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        endsAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        isRecruiting: false,
      })
      .returning();
    communityId = community[0].id;

    // Create owner user with unique login name
    const ownerUser = await db
      .insert(userTable)
      .values({
        loginName: `owner_mute_test_${Date.now()}`,
        passwordHash: "hash",
      })
      .returning();
    ownerUserId = ownerUser[0].id;

    // Create owner membership
    await db.insert(membershipTable).values({
      userId: ownerUserId,
      communityId,
      role: "owner",
      activatedAt: new Date().toISOString(),
    });

    // Create owner profile with unique username
    const ownerProfile = await db
      .insert(profileTable)
      .values({
        name: "Owner",
        username: `owner_mute_${Date.now()}`,
        communityId,
        activatedAt: new Date().toISOString(),
      })
      .returning();
    ownerProfileId = ownerProfile[0].id;

    // Create owner profile ownership
    await db.insert(profileOwnershipTable).values({
      profileId: ownerProfileId,
      userId: ownerUserId,
      role: "owner",
      createdBy: ownerUserId,
    });

    // Create moderator user with unique login name
    const moderatorUser = await db
      .insert(userTable)
      .values({
        loginName: `moderator_mute_test_${Date.now()}`,
        passwordHash: "hash",
      })
      .returning();
    moderatorUserId = moderatorUser[0].id;

    // Create moderator membership
    await db.insert(membershipTable).values({
      userId: moderatorUserId,
      communityId,
      role: "moderator",
      activatedAt: new Date().toISOString(),
    });

    // Create moderator profile with unique username
    const moderatorProfile = await db
      .insert(profileTable)
      .values({
        name: "Moderator",
        username: `moderator_mute_${Date.now() + 1}`,
        communityId,
        activatedAt: new Date().toISOString(),
      })
      .returning();
    moderatorProfileId = moderatorProfile[0].id;

    // Create moderator profile ownership
    await db.insert(profileOwnershipTable).values({
      profileId: moderatorProfileId,
      userId: moderatorUserId,
      role: "owner",
      createdBy: ownerUserId,
    });

    // Create member user with unique login name
    const memberUser = await db
      .insert(userTable)
      .values({
        loginName: `member_mute_test_${Date.now()}`,
        passwordHash: "hash",
      })
      .returning();
    memberUserId = memberUser[0].id;

    // Create member membership
    await db.insert(membershipTable).values({
      userId: memberUserId,
      communityId,
      role: "member",
      activatedAt: new Date().toISOString(),
    });

    // Create member profile with unique username
    const memberProfile = await db
      .insert(profileTable)
      .values({
        name: "Member",
        username: `member_mute_${Date.now() + 2}`,
        communityId,
        activatedAt: new Date().toISOString(),
      })
      .returning();
    memberProfileId = memberProfile[0].id;

    // Create member profile ownership
    await db.insert(profileOwnershipTable).values({
      profileId: memberProfileId,
      userId: memberUserId,
      role: "owner",
      createdBy: ownerUserId,
    });
  });

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    await db
      .delete(moderationLogTable)
      .where(eq(moderationLogTable.moderatorId, ownerProfileId));
    await db
      .delete(moderationLogTable)
      .where(eq(moderationLogTable.moderatorId, moderatorProfileId));

    // Clear muted_by_id to avoid foreign key constraint issues
    await db
      .update(profileTable)
      .set({ mutedById: null })
      .where(isNotNull(profileTable.mutedById));

    await db
      .delete(profileOwnershipTable)
      .where(eq(profileOwnershipTable.profileId, ownerProfileId));
    await db
      .delete(profileOwnershipTable)
      .where(eq(profileOwnershipTable.profileId, moderatorProfileId));
    await db
      .delete(profileOwnershipTable)
      .where(eq(profileOwnershipTable.profileId, memberProfileId));
    await db.delete(profileTable).where(eq(profileTable.id, ownerProfileId));
    await db
      .delete(profileTable)
      .where(eq(profileTable.id, moderatorProfileId));
    await db.delete(profileTable).where(eq(profileTable.id, memberProfileId));
    await db
      .delete(membershipTable)
      .where(eq(membershipTable.userId, ownerUserId));
    await db
      .delete(membershipTable)
      .where(eq(membershipTable.userId, moderatorUserId));
    await db
      .delete(membershipTable)
      .where(eq(membershipTable.userId, memberUserId));
    await db.delete(userTable).where(eq(userTable.id, ownerUserId));
    await db.delete(userTable).where(eq(userTable.id, moderatorUserId));
    await db.delete(userTable).where(eq(userTable.id, memberUserId));
    await db.delete(communityTable).where(eq(communityTable.id, communityId));
  });

  describe("muteProfile", () => {
    it("should allow owner to mute a member profile", async () => {
      const result = await moderationService.muteProfile(
        ownerUserId,
        communityId,
        memberProfileId,
      );

      expect(result.message).toBe("프로필이 성공적으로 음소거되었습니다");

      // Verify profile is muted
      const profile = await db.query.profile.findFirst({
        where: eq(profileTable.id, memberProfileId),
      });
      expect(profile?.mutedAt).not.toBeNull();
      expect(profile?.mutedById).toBe(ownerProfileId);

      // Verify moderation log
      const log = await db.query.moderationLog.findFirst({
        where: and(
          eq(moderationLogTable.action, "mute_profile"),
          eq(moderationLogTable.targetProfileId, memberProfileId),
        ),
      });
      expect(log).not.toBeNull();
      expect(log?.moderatorId).toBe(ownerProfileId);
    });

    it("should allow moderator to mute a member profile", async () => {
      const result = await moderationService.muteProfile(
        moderatorUserId,
        communityId,
        memberProfileId,
      );

      expect(result.message).toBe("프로필이 성공적으로 음소거되었습니다");

      // Verify profile is muted
      const profile = await db.query.profile.findFirst({
        where: eq(profileTable.id, memberProfileId),
      });
      expect(profile?.mutedAt).not.toBeNull();
      expect(profile?.mutedById).toBe(moderatorProfileId);
    });

    it("should allow muting with a custom reason", async () => {
      const reason = "스팸 게시물을 반복적으로 작성함";
      await moderationService.muteProfile(
        ownerUserId,
        communityId,
        memberProfileId,
        reason,
      );

      // Verify reason is in moderation log
      const log = await db.query.moderationLog.findFirst({
        where: and(
          eq(moderationLogTable.action, "mute_profile"),
          eq(moderationLogTable.targetProfileId, memberProfileId),
        ),
      });
      expect(log?.description).toBe(reason);
    });

    it("should not allow regular member to mute profiles", async () => {
      try {
        await moderationService.muteProfile(
          memberUserId,
          communityId,
          ownerProfileId,
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).statusCode).toBe(403);
      }
    });

    it("should not allow muting already muted profile", async () => {
      // First mute
      await moderationService.muteProfile(
        ownerUserId,
        communityId,
        memberProfileId,
      );

      // Try to mute again
      try {
        await moderationService.muteProfile(
          ownerUserId,
          communityId,
          memberProfileId,
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).statusCode).toBe(409);
      }
    });

    it("should not allow muting self", async () => {
      try {
        await moderationService.muteProfile(
          ownerUserId,
          communityId,
          ownerProfileId,
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).statusCode).toBe(400);
      }
    });
  });

  describe("unmuteProfile", () => {
    beforeEach(async () => {
      // Mute the member profile first
      await moderationService.muteProfile(
        ownerUserId,
        communityId,
        memberProfileId,
      );
    });

    it("should allow owner to unmute a muted profile", async () => {
      const result = await moderationService.unmuteProfile(
        ownerUserId,
        communityId,
        memberProfileId,
      );

      expect(result.message).toBe("프로필 음소거가 성공적으로 해제되었습니다");

      // Verify profile is unmuted
      const profile = await db.query.profile.findFirst({
        where: eq(profileTable.id, memberProfileId),
      });
      expect(profile?.mutedAt).toBeNull();
      expect(profile?.mutedById).toBeNull();

      // Verify moderation log
      const log = await db.query.moderationLog.findFirst({
        where: and(
          eq(moderationLogTable.action, "unmute_profile"),
          eq(moderationLogTable.targetProfileId, memberProfileId),
        ),
      });
      expect(log).not.toBeNull();
    });

    it("should allow moderator to unmute a muted profile", async () => {
      const result = await moderationService.unmuteProfile(
        moderatorUserId,
        communityId,
        memberProfileId,
      );

      expect(result.message).toBe("프로필 음소거가 성공적으로 해제되었습니다");
    });

    it("should not allow unmuting non-muted profile", async () => {
      // First unmute
      await moderationService.unmuteProfile(
        ownerUserId,
        communityId,
        memberProfileId,
      );

      // Try to unmute again
      try {
        await moderationService.unmuteProfile(
          ownerUserId,
          communityId,
          memberProfileId,
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).statusCode).toBe(400);
      }
    });

    it("should not allow regular member to unmute profiles", async () => {
      try {
        await moderationService.unmuteProfile(
          memberUserId,
          communityId,
          memberProfileId,
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).statusCode).toBe(403);
      }
    });
  });
});
