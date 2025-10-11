import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import {
  communityApplication as communityApplicationTable,
  membership as membershipTable,
  profileOwnership as profileOwnershipTable,
  profile as profileTable,
} from "../drizzle/schema";
import {
  createCommunityWithOwner,
  createTestApplication,
  createTestCommunity,
  createTestMembership,
  createTestProfile,
  createTestUser,
} from "../test/factories";
import { testDb } from "../test/setup";

// Mock the db module before importing services
vi.mock("../db");

import * as membershipService from "./membership.service";
import * as profileService from "./profile.service";

describe("Membership State Transitions", () => {
  describe("Application Workflow", () => {
    it("should create a pending application", async () => {
      const user = await createTestUser();
      const community = await createTestCommunity();

      const application = await membershipService.createApplication(
        user.id,
        community.id,
        {
          profileName: "Test User",
          profileUsername: "testuser",
          message: "I want to join",
        },
      );

      expect(application.status).toBe("pending");
      expect(application.userId).toBe(user.id);
      expect(application.communityId).toBe(community.id);
    });

    it("should not allow duplicate pending applications", async () => {
      const user = await createTestUser();
      const community = await createTestCommunity();

      await createTestApplication(user.id, community.id);

      await expect(
        membershipService.createApplication(user.id, community.id, {
          profileName: "Test User",
          profileUsername: "testuser",
        }),
      ).rejects.toThrow("이미 대기 중인 지원서가 있습니다");
    });

    it("should approve application and create active membership + profile", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const applicant = await createTestUser();

      const application = await createTestApplication(
        applicant.id,
        community.id,
        {
          profileName: "Applicant",
          profileUsername: "applicant",
        },
      );

      const result = await membershipService.approveMembershipApplication(
        application.id,
        owner.id,
      );

      // Check membership is active
      expect(result.membership.activatedAt).not.toBeNull();
      expect(result.membership.role).toBe("member");
      expect(result.membership.applicationId).toBe(application.id);

      // Check profile is created and active
      expect(result.profile.activatedAt).not.toBeNull();
      expect(result.profile.username).toBe("applicant");

      // Check application status
      const updatedApp = await testDb.query.communityApplication.findFirst({
        where: eq(communityApplicationTable.id, application.id),
      });
      expect(updatedApp?.status).toBe("approved");
      expect(updatedApp?.reviewedById).toBe(owner.id);
    });

    it("should reject application and keep status as rejected", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const applicant = await createTestUser();

      const application = await createTestApplication(
        applicant.id,
        community.id,
      );

      await membershipService.rejectMembershipApplication(
        application.id,
        owner.id,
        "Not qualified",
      );

      const updatedApp = await testDb.query.communityApplication.findFirst({
        where: eq(communityApplicationTable.id, application.id),
      });

      expect(updatedApp?.status).toBe("rejected");
      expect(updatedApp?.rejectionReason).toBe("Not qualified");
      expect(updatedApp?.reviewedById).toBe(owner.id);

      // Should not create membership
      const membership = await testDb.query.membership.findFirst({
        where: and(
          eq(membershipTable.userId, applicant.id),
          eq(membershipTable.communityId, community.id),
        ),
      });
      expect(membership).toBeUndefined();
    });

    it("should revoke approved application and deactivate membership + profile", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const applicant = await createTestUser();

      const application = await createTestApplication(
        applicant.id,
        community.id,
        {
          profileUsername: "applicant",
        },
      );

      // Approve first
      const { membership, profile } =
        await membershipService.approveMembershipApplication(
          application.id,
          owner.id,
        );

      expect(membership.activatedAt).not.toBeNull();
      expect(profile.activatedAt).not.toBeNull();

      // Revoke the approval
      await membershipService.revokeApplicationReview(application.id);

      // Check application is back to pending
      const revokedApp = await testDb.query.communityApplication.findFirst({
        where: eq(communityApplicationTable.id, application.id),
      });
      expect(revokedApp?.status).toBe("pending");
      expect(revokedApp?.reviewedById).toBeNull();

      // Check membership is deactivated
      const deactivatedMembership = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, membership.id),
      });
      expect(deactivatedMembership?.activatedAt).toBeNull();

      // Check profile is deactivated
      const deactivatedProfile = await testDb.query.profile.findFirst({
        where: eq(profileTable.id, profile.id),
      });
      expect(deactivatedProfile?.activatedAt).toBeNull();
    });

    it("should reactivate membership and profiles when re-approving", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const applicant = await createTestUser();

      const application = await createTestApplication(
        applicant.id,
        community.id,
        { profileUsername: "applicant" },
      );

      // Approve, revoke, then approve again
      const firstApproval =
        await membershipService.approveMembershipApplication(
          application.id,
          owner.id,
        );
      await membershipService.revokeApplicationReview(application.id);

      const secondApproval =
        await membershipService.approveMembershipApplication(
          application.id,
          owner.id,
        );

      // Should reuse the same membership
      expect(secondApproval.membership.id).toBe(firstApproval.membership.id);
      expect(secondApproval.membership.activatedAt).not.toBeNull();

      // Should reactivate the profile
      expect(secondApproval.profile.id).toBe(firstApproval.profile.id);
      expect(secondApproval.profile.activatedAt).not.toBeNull();
    });

    it("should not list deactivated profiles in actor listing", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();

      // Create and approve application
      const application = await createTestApplication(member.id, community.id, {
        profileUsername: "member",
      });
      await membershipService.approveMembershipApplication(
        application.id,
        owner.id,
      );

      // Verify member is listed when active
      const activeResponse = await profileService.listProfilesByUser(
        community.id,
      );
      const activeUsernames = activeResponse.map(
        (p: { username: string }) => p.username,
      );
      expect(activeUsernames).toContain("member");

      // Deactivate the membership
      const membership = await testDb.query.membership.findFirst({
        where: and(
          eq(membershipTable.userId, member.id),
          eq(membershipTable.communityId, community.id),
        ),
      });
      expect(membership).toBeDefined();
      if (!membership) throw new Error("Membership not found");
      await membershipService.deactivateMembership(membership.id);

      // Verify member is NOT listed when deactivated
      const inactiveResponse = await profileService.listProfilesByUser(
        community.id,
      );
      const inactiveUsernames = inactiveResponse.map(
        (p: { username: string }) => p.username,
      );
      expect(inactiveUsernames).not.toContain("member");
    });

    it("should reject application with username already taken by existing profile", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const existingMember = await createTestUser();

      // Create approved member with username "taken"
      const existingApplication = await createTestApplication(
        existingMember.id,
        community.id,
        {
          profileUsername: "taken",
        },
      );
      await membershipService.approveMembershipApplication(
        existingApplication.id,
        owner.id,
      );

      // New user tries to apply with same username
      const newUser = await createTestUser();
      await expect(
        membershipService.createApplication(newUser.id, community.id, {
          profileName: "New User",
          profileUsername: "taken",
        }),
      ).rejects.toThrow("이 사용자명은 이미 사용중입니다");
    });

    it("should reject application with username reserved by another pending application", async () => {
      const community = await createTestCommunity();
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // User1 applies with username "reserved"
      await createTestApplication(user1.id, community.id, {
        profileUsername: "reserved",
      });

      // User2 tries to apply with same username - should be rejected
      await expect(
        membershipService.createApplication(user2.id, community.id, {
          profileName: "User 2",
          profileUsername: "reserved",
        }),
      ).rejects.toThrow("이 사용자명은 다른 대기 중인 지원서에서 사용중입니다");
    });

    it("should allow application with username from deactivated profile after rejection", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const user1 = await createTestUser();

      // User1 joins and leaves
      const app1 = await createTestApplication(user1.id, community.id, {
        profileUsername: "available",
      });
      await membershipService.approveMembershipApplication(app1.id, owner.id);
      const membership = await testDb.query.membership.findFirst({
        where: and(
          eq(membershipTable.userId, user1.id),
          eq(membershipTable.communityId, community.id),
        ),
      });
      if (!membership) throw new Error("Membership not found");
      await membershipService.leaveCommunity(user1.id, community.id);

      // User2 tries to apply with same username - should be rejected during application
      const user2 = await createTestUser();
      await expect(
        membershipService.createApplication(user2.id, community.id, {
          profileName: "User 2",
          profileUsername: "available",
        }),
      ).rejects.toThrow("이 사용자명은 이미 사용중입니다");
    });

    it("should not allow two concurrent applications with same username", async () => {
      const community = await createTestCommunity();
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // User1 creates pending application
      await membershipService.createApplication(user1.id, community.id, {
        profileName: "User 1",
        profileUsername: "concurrent",
      });

      // User2 tries to create application with same username
      await expect(
        membershipService.createApplication(user2.id, community.id, {
          profileName: "User 2",
          profileUsername: "concurrent",
        }),
      ).rejects.toThrow("이 사용자명은 다른 대기 중인 지원서에서 사용중입니다");
    });
  });

  describe("Membership Deactivation", () => {
    it("should deactivate membership and owned profiles", async () => {
      const { community } = await createCommunityWithOwner();

      // Create member
      const member = await createTestUser();
      const memberMembership = await createTestMembership(
        member.id,
        community.id,
        { role: "member" },
      );
      const memberProfile = await createTestProfile(member.id, community.id);

      await membershipService.deactivateMembership(memberMembership.id);

      // Check membership is deactivated
      const deactivated = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, memberMembership.id),
      });
      expect(deactivated?.activatedAt).toBeNull();

      // Check profile is deactivated
      const deactivatedProfile = await testDb.query.profile.findFirst({
        where: eq(profileTable.id, memberProfile.id),
      });
      expect(deactivatedProfile?.activatedAt).toBeNull();
    });

    it("should deactivate owned profiles even if shared with others", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();
      const memberMembership = await createTestMembership(
        member.id,
        community.id,
      );
      const memberProfile = await createTestProfile(member.id, community.id);

      // Share profile with another user
      const otherUser = await createTestUser();
      await createTestMembership(otherUser.id, community.id);
      await testDb.insert(profileOwnershipTable).values({
        profileId: memberProfile.id,
        userId: otherUser.id,
        role: "admin",
        createdBy: owner.id,
      });

      await membershipService.deactivateMembership(memberMembership.id);

      // Profile is deactivated because the owner's membership ended,
      // even though it was shared with others
      const profile = await testDb.query.profile.findFirst({
        where: eq(profileTable.id, memberProfile.id),
      });
      expect(profile?.activatedAt).toBeNull();
    });
  });

  describe("Role Transitions", () => {
    it("should promote member to moderator", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();
      const memberMembership = await createTestMembership(
        member.id,
        community.id,
        { role: "member" },
      );

      await membershipService.updateMemberRole(
        community.id,
        memberMembership.id,
        "moderator",
        owner.id,
      );

      const updated = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, memberMembership.id),
      });
      expect(updated?.role).toBe("moderator");
    });

    it("should transfer ownership and demote previous owner to moderator", async () => {
      const {
        user: owner,
        community,
        membership: ownerMembership,
      } = await createCommunityWithOwner();
      const member = await createTestUser();
      const memberMembership = await createTestMembership(
        member.id,
        community.id,
        { role: "member" },
      );

      await membershipService.updateMemberRole(
        community.id,
        memberMembership.id,
        "owner",
        owner.id,
      );

      // Check new owner
      const newOwner = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, memberMembership.id),
      });
      expect(newOwner?.role).toBe("owner");

      // Check old owner is now moderator
      const oldOwner = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, ownerMembership.id),
      });
      expect(oldOwner?.role).toBe("moderator");

      // Verify only one active owner exists
      const activeOwners = await testDb
        .select()
        .from(membershipTable)
        .where(
          and(
            eq(membershipTable.communityId, community.id),
            eq(membershipTable.role, "owner"),
            sql`${membershipTable.activatedAt} IS NOT NULL`,
          ),
        );
      expect(activeOwners).toHaveLength(1);
      const firstOwner = activeOwners[0];
      expect(firstOwner).toBeDefined();
      expect(firstOwner?.id).toBe(memberMembership.id);
    });

    it("should not allow demoting owner without transferring ownership", async () => {
      const {
        user: owner,
        community,
        membership,
      } = await createCommunityWithOwner();

      await expect(
        membershipService.updateMemberRole(
          community.id,
          membership.id,
          "moderator",
          owner.id,
        ),
      ).rejects.toThrow("소유자의 역할을 변경할 수 없습니다");
    });

    it("should revoke shared profile access when demoting moderator to member", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const moderator = await createTestUser();
      const moderatorMembership = await createTestMembership(
        moderator.id,
        community.id,
        { role: "moderator" },
      );

      // Create a shared profile
      const sharedProfile = await createTestProfile(owner.id, community.id, {
        username: "shared",
      });
      await testDb.insert(profileOwnershipTable).values({
        profileId: sharedProfile.id,
        userId: moderator.id,
        role: "admin",
        createdBy: owner.id,
      });

      // Demote to member
      await membershipService.updateMemberRole(
        community.id,
        moderatorMembership.id,
        "member",
        owner.id,
      );

      // Check shared access is revoked
      const ownership = await testDb.query.profileOwnership.findFirst({
        where: and(
          eq(profileOwnershipTable.userId, moderator.id),
          eq(profileOwnershipTable.profileId, sharedProfile.id),
        ),
      });
      expect(ownership).toBeUndefined();
    });
  });

  describe("Leave Community", () => {
    it("should allow member to leave community", async () => {
      const { community } = await createCommunityWithOwner();
      const member = await createTestUser();
      const memberMembership = await createTestMembership(
        member.id,
        community.id,
      );
      const memberProfile = await createTestProfile(member.id, community.id);

      await membershipService.leaveCommunity(member.id, community.id);

      // Check membership is deactivated
      const deactivated = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, memberMembership.id),
      });
      expect(deactivated?.activatedAt).toBeNull();

      // Check profile is deactivated
      const deactivatedProfile = await testDb.query.profile.findFirst({
        where: eq(profileTable.id, memberProfile.id),
      });
      expect(deactivatedProfile?.activatedAt).toBeNull();
    });

    it("should not allow owner to leave community", async () => {
      const { user: owner, community } = await createCommunityWithOwner();

      await expect(
        membershipService.leaveCommunity(owner.id, community.id),
      ).rejects.toThrow("소유자는 커뮤를 떠날 수 없습니다");
    });
  });

  describe("Remove Member", () => {
    it("should allow owner to remove member", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();
      const memberMembership = await createTestMembership(
        member.id,
        community.id,
      );

      await membershipService.removeMember(
        community.id,
        memberMembership.id,
        owner.id,
      );

      const removed = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, memberMembership.id),
      });
      expect(removed?.activatedAt).toBeNull();
    });

    it("should not allow non-owner to remove member", async () => {
      const { community } = await createCommunityWithOwner();
      const moderator = await createTestUser();
      const _moderatorMembership = await createTestMembership(
        moderator.id,
        community.id,
        { role: "moderator" },
      );
      const member = await createTestUser();
      const memberMembership = await createTestMembership(
        member.id,
        community.id,
      );

      await expect(
        membershipService.removeMember(
          community.id,
          memberMembership.id,
          moderator.id,
        ),
      ).rejects.toThrow("커뮤 소유자만 회원을 제거할 수 있습니다");
    });

    it("should not allow removing owner", async () => {
      const {
        user: owner,
        community,
        membership,
      } = await createCommunityWithOwner();

      await expect(
        membershipService.removeMember(community.id, membership.id, owner.id),
      ).rejects.toThrow("커뮤 소유자는 제거할 수 없습니다");
    });
  });

  describe("Leave and Rejoin Workflow", () => {
    it("should allow deactivated member to reapply", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();

      // Join community
      const application = await createTestApplication(member.id, community.id, {
        profileUsername: "member",
      });
      await membershipService.approveMembershipApplication(
        application.id,
        owner.id,
      );

      // Get membership
      const membership = await testDb.query.membership.findFirst({
        where: and(
          eq(membershipTable.userId, member.id),
          eq(membershipTable.communityId, community.id),
        ),
      });
      expect(membership).toBeDefined();
      if (!membership) throw new Error("Membership not found");

      // Leave community
      await membershipService.leaveCommunity(member.id, community.id);

      // Verify membership is deactivated
      const deactivatedMembership = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, membership.id),
      });
      expect(deactivatedMembership?.activatedAt).toBeNull();

      // Should be able to submit new application
      const rejoinApplication = await membershipService.createApplication(
        member.id,
        community.id,
        {
          profileName: "Member Rejoining",
          profileUsername: "member",
        },
      );

      expect(rejoinApplication.status).toBe("pending");
      expect(rejoinApplication.userId).toBe(member.id);
    });

    it("should reactivate previous membership on rejoin with different username", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();

      // Join, leave, rejoin cycle
      const firstApplication = await createTestApplication(
        member.id,
        community.id,
        { profileUsername: "member" },
      );
      const firstApproval =
        await membershipService.approveMembershipApplication(
          firstApplication.id,
          owner.id,
        );
      const firstMembershipId = firstApproval.membership.id;

      await membershipService.leaveCommunity(member.id, community.id);

      // Rejoin with different username (old username is taken even if deactivated)
      const rejoinApplication = await createTestApplication(
        member.id,
        community.id,
        { profileUsername: "member2" },
      );
      const rejoinApproval =
        await membershipService.approveMembershipApplication(
          rejoinApplication.id,
          owner.id,
        );

      // Should reuse the same membership record
      expect(rejoinApproval.membership.id).toBe(firstMembershipId);
      expect(rejoinApproval.membership.activatedAt).not.toBeNull();
      expect(rejoinApproval.membership.role).toBe("member");
    });

    it("should not allow reusing deactivated username on rejoin", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();

      // Join with username "member"
      const firstApplication = await createTestApplication(
        member.id,
        community.id,
        { profileUsername: "member" },
      );
      const firstApproval =
        await membershipService.approveMembershipApplication(
          firstApplication.id,
          owner.id,
        );
      const firstProfileId = firstApproval.profile.id;

      await membershipService.leaveCommunity(member.id, community.id);

      // Verify profile is deactivated
      const deactivatedProfile = await testDb.query.profile.findFirst({
        where: eq(profileTable.id, firstProfileId),
      });
      expect(deactivatedProfile?.activatedAt).toBeNull();

      // Try to rejoin with same username - should fail
      const rejoinApplication = await createTestApplication(
        member.id,
        community.id,
        { profileUsername: "member" },
      );

      await expect(
        membershipService.approveMembershipApplication(
          rejoinApplication.id,
          owner.id,
        ),
      ).rejects.toThrow("이 사용자명은 이미 다른 사용자가 사용중입니다");
    });

    it("should not allow active member to submit application", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();

      // Join community
      const application = await createTestApplication(member.id, community.id);
      await membershipService.approveMembershipApplication(
        application.id,
        owner.id,
      );

      // Try to submit another application while active
      await expect(
        membershipService.createApplication(member.id, community.id, {
          profileName: "Test",
          profileUsername: "test2",
        }),
      ).rejects.toThrow("이미 이 커뮤의 회원입니다");
    });
  });

  describe("Ownership Transfer Edge Cases", () => {
    it("should allow former owner to leave after ownership transfer", async () => {
      const {
        user: owner,
        community,
        membership: ownerMembership,
      } = await createCommunityWithOwner();
      const newOwnerUser = await createTestUser();
      const newOwnerMembership = await createTestMembership(
        newOwnerUser.id,
        community.id,
        { role: "member" },
      );

      // Transfer ownership
      await membershipService.updateMemberRole(
        community.id,
        newOwnerMembership.id,
        "owner",
        owner.id,
      );

      // Former owner (now moderator) should be able to leave
      await expect(
        membershipService.leaveCommunity(owner.id, community.id),
      ).resolves.toBeDefined();

      // Verify former owner's membership is deactivated
      const deactivatedMembership = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, ownerMembership.id),
      });
      expect(deactivatedMembership?.activatedAt).toBeNull();
    });

    it("should maintain only one active owner after transfer", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const newOwnerUser = await createTestUser();
      const newOwnerMembership = await createTestMembership(
        newOwnerUser.id,
        community.id,
        { role: "member" },
      );

      // Transfer ownership
      await membershipService.updateMemberRole(
        community.id,
        newOwnerMembership.id,
        "owner",
        owner.id,
      );

      // Count active owners
      const activeOwners = await testDb
        .select()
        .from(membershipTable)
        .where(
          and(
            eq(membershipTable.communityId, community.id),
            eq(membershipTable.role, "owner"),
            sql`${membershipTable.activatedAt} IS NOT NULL`,
          ),
        );

      expect(activeOwners).toHaveLength(1);
      const activeOwner = activeOwners[0];
      expect(activeOwner).toBeDefined();
      expect(activeOwner?.userId).toBe(newOwnerUser.id);
    });

    it("should preserve old owner's profiles after ownership transfer", async () => {
      const {
        user: owner,
        community,
        profile: ownerProfile,
      } = await createCommunityWithOwner();
      const newOwnerUser = await createTestUser();
      const newOwnerMembership = await createTestMembership(
        newOwnerUser.id,
        community.id,
        { role: "member" },
      );

      // Transfer ownership
      await membershipService.updateMemberRole(
        community.id,
        newOwnerMembership.id,
        "owner",
        owner.id,
      );

      // Old owner's profile should still be active
      const oldOwnerProfile = await testDb.query.profile.findFirst({
        where: eq(profileTable.id, ownerProfile.id),
      });
      expect(oldOwnerProfile?.activatedAt).not.toBeNull();
      expect(oldOwnerProfile?.username).toBe(ownerProfile.username);
    });

    it("should allow new owner to remove former owner", async () => {
      const {
        user: owner,
        community,
        membership: ownerMembership,
      } = await createCommunityWithOwner();
      const newOwnerUser = await createTestUser();
      const newOwnerMembership = await createTestMembership(
        newOwnerUser.id,
        community.id,
        { role: "member" },
      );

      // Transfer ownership
      await membershipService.updateMemberRole(
        community.id,
        newOwnerMembership.id,
        "owner",
        owner.id,
      );

      // New owner should be able to remove former owner (now moderator)
      await expect(
        membershipService.removeMember(
          community.id,
          ownerMembership.id,
          newOwnerUser.id,
        ),
      ).resolves.toBeDefined();

      // Verify former owner is removed
      const removedMembership = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, ownerMembership.id),
      });
      expect(removedMembership?.activatedAt).toBeNull();
    });

    it("should allow promoting former owner back to owner", async () => {
      const {
        user: owner,
        community,
        membership: ownerMembership,
      } = await createCommunityWithOwner();
      const tempOwnerUser = await createTestUser();
      const tempOwnerMembership = await createTestMembership(
        tempOwnerUser.id,
        community.id,
        { role: "member" },
      );

      // Transfer ownership to temp owner
      await membershipService.updateMemberRole(
        community.id,
        tempOwnerMembership.id,
        "owner",
        owner.id,
      );

      // Transfer back to original owner
      await membershipService.updateMemberRole(
        community.id,
        ownerMembership.id,
        "owner",
        tempOwnerUser.id,
      );

      // Original owner should be owner again
      const restoredOwnership = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, ownerMembership.id),
      });
      expect(restoredOwnership?.role).toBe("owner");

      // Temp owner should be moderator
      const demotedOwnership = await testDb.query.membership.findFirst({
        where: eq(membershipTable.id, tempOwnerMembership.id),
      });
      expect(demotedOwnership?.role).toBe("moderator");
    });
  });

  describe("Multiple Leave-Rejoin Cycles", () => {
    it("should handle multiple leave-rejoin cycles correctly", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();

      // Cycle 1: Join
      const app1 = await createTestApplication(member.id, community.id, {
        profileUsername: "cycle1",
      });
      const approval1 = await membershipService.approveMembershipApplication(
        app1.id,
        owner.id,
      );
      const membershipId = approval1.membership.id;

      // Cycle 1: Leave
      await membershipService.leaveCommunity(member.id, community.id);

      // Cycle 2: Rejoin
      const app2 = await createTestApplication(member.id, community.id, {
        profileUsername: "cycle2",
      });
      const approval2 = await membershipService.approveMembershipApplication(
        app2.id,
        owner.id,
      );

      // Should reuse same membership
      expect(approval2.membership.id).toBe(membershipId);

      // Cycle 2: Leave
      await membershipService.leaveCommunity(member.id, community.id);

      // Cycle 3: Rejoin
      const app3 = await createTestApplication(member.id, community.id, {
        profileUsername: "cycle3",
      });
      const approval3 = await membershipService.approveMembershipApplication(
        app3.id,
        owner.id,
      );

      // Should still reuse same membership
      expect(approval3.membership.id).toBe(membershipId);
      expect(approval3.membership.activatedAt).not.toBeNull();

      // Verify only one membership exists for this user+community
      const allMemberships = await testDb
        .select()
        .from(membershipTable)
        .where(
          and(
            eq(membershipTable.userId, member.id),
            eq(membershipTable.communityId, community.id),
          ),
        );

      expect(allMemberships).toHaveLength(1);
    });

    it("should not create duplicate memberships on rejoin", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();

      // Join -> Leave -> Rejoin multiple times
      for (let i = 0; i < 3; i++) {
        const app = await createTestApplication(member.id, community.id, {
          profileUsername: `user${i}`,
        });
        await membershipService.approveMembershipApplication(app.id, owner.id);
        await membershipService.leaveCommunity(member.id, community.id);
      }

      // Final rejoin
      const finalApp = await createTestApplication(member.id, community.id, {
        profileUsername: "finaluser",
      });
      await membershipService.approveMembershipApplication(
        finalApp.id,
        owner.id,
      );

      // Count total memberships
      const allMemberships = await testDb
        .select()
        .from(membershipTable)
        .where(
          and(
            eq(membershipTable.userId, member.id),
            eq(membershipTable.communityId, community.id),
          ),
        );

      // Should only have 1 membership record (reused across cycles)
      expect(allMemberships).toHaveLength(1);
      const membership = allMemberships[0];
      expect(membership).toBeDefined();
      expect(membership?.activatedAt).not.toBeNull();
    });
  });

  describe("Profile State Integrity", () => {
    it("should track profile creation count after multiple rejoins", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();

      // Join with profile1
      const app1 = await createTestApplication(member.id, community.id, {
        profileUsername: "profile1",
      });
      await membershipService.approveMembershipApplication(app1.id, owner.id);
      await membershipService.leaveCommunity(member.id, community.id);

      // Rejoin with profile2
      const app2 = await createTestApplication(member.id, community.id, {
        profileUsername: "profile2",
      });
      await membershipService.approveMembershipApplication(app2.id, owner.id);
      await membershipService.leaveCommunity(member.id, community.id);

      // Rejoin with profile3
      const app3 = await createTestApplication(member.id, community.id, {
        profileUsername: "profile3",
      });
      await membershipService.approveMembershipApplication(app3.id, owner.id);

      // Count all profiles for this user in this community via profile_ownership
      const allProfiles = await testDb
        .select({ profile: profileTable })
        .from(profileOwnershipTable)
        .innerJoin(
          profileTable,
          eq(profileOwnershipTable.profileId, profileTable.id),
        )
        .where(
          and(
            eq(profileTable.communityId, community.id),
            eq(profileOwnershipTable.userId, member.id),
            eq(profileOwnershipTable.role, "owner"),
          ),
        );

      // Should have 3 profiles created (one per join with different username)
      expect(allProfiles).toHaveLength(3);

      // Only the most recent should be active
      const activeProfiles = allProfiles.filter(
        (p: { profile: { activatedAt: string | null } }) =>
          p.profile.activatedAt !== null,
      );
      expect(activeProfiles).toHaveLength(1);
      const activeProfile = activeProfiles[0]?.profile;
      expect(activeProfile).toBeDefined();
      expect(activeProfile?.username).toBe("profile3");
    });

    it("should not allow reusing deactivated username (enforces username uniqueness)", async () => {
      const { user: owner, community } = await createCommunityWithOwner();
      const member = await createTestUser();

      // Join with username "test"
      const app1 = await createTestApplication(member.id, community.id, {
        profileUsername: "test",
      });
      await membershipService.approveMembershipApplication(app1.id, owner.id);

      await membershipService.leaveCommunity(member.id, community.id);

      // Try to rejoin with same username "test" - should fail
      // Usernames must be unique even if the previous profile is deactivated
      const app2 = await membershipService.createApplication(
        member.id,
        community.id,
        {
          profileName: "Test User",
          profileUsername: "test", // Same username as deactivated profile
        },
      );

      await expect(
        membershipService.approveMembershipApplication(app2.id, owner.id),
      ).rejects.toThrow("이 사용자명은 이미 다른 사용자가 사용중입니다");

      // Verify only the original deactivated profile exists
      const allProfiles = await testDb
        .select({ profile: profileTable })
        .from(profileOwnershipTable)
        .innerJoin(
          profileTable,
          eq(profileOwnershipTable.profileId, profileTable.id),
        )
        .where(
          and(
            eq(profileTable.communityId, community.id),
            eq(profileOwnershipTable.userId, member.id),
            eq(profileOwnershipTable.role, "owner"),
            eq(profileTable.username, "test"),
          ),
        );

      expect(allProfiles).toHaveLength(1);
      const profile = allProfiles[0]?.profile;
      expect(profile).toBeDefined();
      expect(profile?.activatedAt).toBeNull(); // Still deactivated
    });
  });
});
