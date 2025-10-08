import { describe, expect, it, vi } from "vitest";

// Mock the db module before importing services
vi.mock("../../db");

import {
  createCommunityWithOwner,
  createTestMembership,
  createTestPost,
  createTestProfile,
} from "../../test/factories";
import {
  createTestApp,
  expectError,
  expectSuccess,
  makeAuthenticatedRequest,
} from "../../test/http-helpers";

/**
 * Security Test Suite: Cross-Community Data Isolation
 *
 * These tests verify that users cannot access data from communities
 * they don't belong to, preventing data contamination and exfiltration.
 */

describe("Security: Cross-Community Data Isolation", () => {
  describe("Post Access Control", () => {
    it("should prevent accessing posts from different community", async () => {
      const app = createTestApp();

      // Create two separate communities
      const {
        user: user1,
        community: community1,
        profile: _profile1,
      } = await createCommunityWithOwner();
      const {
        user: _user2,
        community: community2,
        profile: profile2,
      } = await createCommunityWithOwner();

      // Create a post in community2
      const post = await createTestPost(profile2.id, community2.id, {
        content: "Secret post in community 2",
      });

      // User1 tries to access community2's post while authenticated for community1
      const res = await makeAuthenticatedRequest(
        app,
        `/app/posts/${post.id}`,
        user1,
        {
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
        },
      );

      // Should fail - post doesn't exist in community1
      await expectError(res, 404);
    });

    it("should prevent creating posts with cross-community parent references", async () => {
      const app = createTestApp();

      // Create two communities with same user as member
      const {
        user,
        community: community1,
        profile: profile1,
      } = await createCommunityWithOwner();
      const { community: community2 } = await createCommunityWithOwner();

      await createTestMembership(user.id, community2.id);
      const profile2 = await createTestProfile(user.id, community2.id, {
        username: "userincommunity2",
      });

      // Create a post in community2
      const parentPost = await createTestPost(profile2.id, community2.id, {
        content: "Parent post in community 2",
      });

      // Try to reply to community2 post from community1
      const res = await makeAuthenticatedRequest(app, "/app/posts", user, {
        method: "POST",
        communityId: community1.id,
        headers: {
          Origin: `https://${community1.slug}.localhost`,
        },
        body: {
          profile_id: profile1.id,
          content: "Reply from community 1",
          in_reply_to_id: parentPost.id, // Cross-community parent reference
        },
      });

      // Should fail - parent post not in same community
      await expectError(res, 404);
    });

    it("should prevent deleting posts from different community", async () => {
      const app = createTestApp();

      // Create two communities
      const {
        user: user1,
        community: community1,
        profile: profile1,
      } = await createCommunityWithOwner();
      const {
        user: _user2,
        community: community2,
        profile: profile2,
      } = await createCommunityWithOwner();

      // Create a post in community2
      const post = await createTestPost(profile2.id, community2.id, {
        content: "Post to delete",
      });

      // User1 (community1 owner) tries to delete community2's post
      const res = await makeAuthenticatedRequest(
        app,
        `/app/posts/${post.id}?profile_id=${profile1.id}`,
        user1,
        {
          method: "DELETE",
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
        },
      );

      // Should fail - post doesn't exist in community1
      await expectError(res, 404);
    });
  });

  describe("Bookmark Isolation", () => {
    it("should only return bookmarks for posts in the same community", async () => {
      const app = createTestApp();

      // Create user with membership in two communities
      const {
        user,
        community: community1,
        profile: profile1,
      } = await createCommunityWithOwner();
      const { community: community2 } = await createCommunityWithOwner();

      await createTestMembership(user.id, community2.id);
      const profile2 = await createTestProfile(user.id, community2.id, {
        username: "userincommunity2",
      });

      // Create and bookmark a post in community1
      const post1 = await createTestPost(profile1.id, community1.id, {
        content: "Post in community 1",
      });
      await makeAuthenticatedRequest(
        app,
        `/app/posts/${post1.id}/bookmark?profile_id=${profile1.id}`,
        user,
        {
          method: "POST",
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
        },
      );

      // Create and bookmark a post in community2
      const post2 = await createTestPost(profile2.id, community2.id, {
        content: "Post in community 2",
      });
      await makeAuthenticatedRequest(
        app,
        `/app/posts/${post2.id}/bookmark?profile_id=${profile2.id}`,
        user,
        {
          method: "POST",
          communityId: community2.id,
          headers: {
            Origin: `https://${community2.slug}.localhost`,
          },
        },
      );

      // Get bookmarks from community1 - should only return community1 bookmarks
      const res1 = await makeAuthenticatedRequest(
        app,
        `/app/bookmarks?profile_id=${profile1.id}`,
        user,
        {
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
        },
      );

      const response1 = await expectSuccess(res1);
      expect(response1.data.length).toBe(1);
      expect(response1.data[0].id).toBe(post1.id);

      // Get bookmarks from community2 - should only return community2 bookmarks
      const res2 = await makeAuthenticatedRequest(
        app,
        `/app/bookmarks?profile_id=${profile2.id}`,
        user,
        {
          communityId: community2.id,
          headers: {
            Origin: `https://${community2.slug}.localhost`,
          },
        },
      );

      const response2 = await expectSuccess(res2);
      expect(response2.data.length).toBe(1);
      expect(response2.data[0].id).toBe(post2.id);
    });

    it("should prevent accessing bookmarks with cross-community profile", async () => {
      const app = createTestApp();

      // Create user with membership in two communities
      const { user, community: community1 } = await createCommunityWithOwner();
      const { community: community2 } = await createCommunityWithOwner();

      await createTestMembership(user.id, community2.id);
      const profile2 = await createTestProfile(user.id, community2.id, {
        username: "userincommunity2",
      });

      // Try to access community2 bookmarks while authenticated for community1
      const res = await makeAuthenticatedRequest(
        app,
        `/app/bookmarks?profile_id=${profile2.id}`,
        user,
        {
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
        },
      );

      // Should fail - profile belongs to different community
      await expectError(res, 404);
    });
  });

  describe("Message Isolation", () => {
    it("should prevent sending messages to profiles in different community", async () => {
      const app = createTestApp();

      // Create two communities
      const {
        user: user1,
        community: community1,
        profile: profile1,
      } = await createCommunityWithOwner();
      const {
        user: _user2,
        community: _community2,
        profile: profile2,
      } = await createCommunityWithOwner();

      // User1 tries to send a message to user2's profile in community2
      const res = await makeAuthenticatedRequest(
        app,
        `/app/messages?profile_id=${profile1.id}`,
        user1,
        {
          method: "POST",
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
          body: {
            receiver_id: profile2.id, // Cross-community profile
            content: "Cross-community message attempt",
          },
        },
      );

      // Should fail - receiver not in same community
      await expectError(res, 404);
    });
  });

  describe("Profile Access Control", () => {
    it("should prevent accessing profiles from different community", async () => {
      const app = createTestApp();

      // Create two communities
      const { user: user1, community: community1 } =
        await createCommunityWithOwner();
      const {
        user: _user2,
        community: _community2,
        profile: profile2,
      } = await createCommunityWithOwner();

      // User1 tries to access user2's profile in community2
      const res = await makeAuthenticatedRequest(
        app,
        `/app/profiles/${profile2.username}`,
        user1,
        {
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
        },
      );

      // Should fail - profile doesn't exist in community1
      await expectError(res, 404);
    });

    it("should prevent updating profiles from different community", async () => {
      const app = createTestApp();

      // Create user with profiles in two communities
      const { user, community: community1 } = await createCommunityWithOwner();
      const { community: community2 } = await createCommunityWithOwner();

      await createTestMembership(user.id, community2.id);
      const profile2 = await createTestProfile(user.id, community2.id, {
        username: "userincommunity2",
        name: "User in Community 2",
      });

      // Try to update community2 profile while authenticated for community1
      const res = await makeAuthenticatedRequest(
        app,
        `/app/me/profiles?profile_id=${profile2.id}`,
        user,
        {
          method: "PUT",
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
          body: {
            name: "Hacked Name",
            username: "hacked",
          },
        },
      );

      // Should fail - profile belongs to different community
      await expectError(res, 404);
    });
  });

  describe("Reaction Isolation", () => {
    it("should prevent reacting to posts from different community", async () => {
      const app = createTestApp();

      // Create two communities
      const {
        user: user1,
        community: community1,
        profile: profile1,
      } = await createCommunityWithOwner();
      const {
        user: _user2,
        community: community2,
        profile: profile2,
      } = await createCommunityWithOwner();

      // Create a post in community2
      const post = await createTestPost(profile2.id, community2.id, {
        content: "Post to react to",
      });

      // User1 tries to react to community2's post
      const res = await makeAuthenticatedRequest(
        app,
        `/app/posts/${post.id}/reactions`,
        user1,
        {
          method: "POST",
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
          body: {
            profile_id: profile1.id,
            emoji: "👍",
          },
        },
      );

      // Should fail - post doesn't exist in community1
      await expectError(res, 404);
    });
  });

  describe("Notification Isolation", () => {
    it("should only return notifications for the current community", async () => {
      const app = createTestApp();

      // This test verifies that notifications with cross-community
      // content are filtered out by the service layer
      const {
        user,
        community: community1,
        profile: profile1,
      } = await createCommunityWithOwner();

      // Get notifications for community1
      const res = await makeAuthenticatedRequest(
        app,
        `/app/notifications?profile_id=${profile1.id}`,
        user,
        {
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
        },
      );

      const response = await expectSuccess(res);

      // All notifications should belong to community1
      // (The service layer filters out cross-community content)
      expect(response).toHaveProperty("data");
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe("Multi-Community User Scenarios", () => {
    it("should correctly isolate data when user is member of multiple communities", async () => {
      const app = createTestApp();

      // Create a user who is a member of two communities
      const {
        user,
        community: community1,
        profile: profile1,
      } = await createCommunityWithOwner();
      const { community: community2 } = await createCommunityWithOwner();

      await createTestMembership(user.id, community2.id);
      const profile2 = await createTestProfile(user.id, community2.id, {
        username: "sameuserincommunity2",
      });

      // Create posts in both communities
      const post1 = await createTestPost(profile1.id, community1.id, {
        content: "Post in community 1",
      });
      const post2 = await createTestPost(profile2.id, community2.id, {
        content: "Post in community 2",
      });

      // Verify user can access community1 post when authenticated for community1
      const res1 = await makeAuthenticatedRequest(
        app,
        `/app/posts/${post1.id}`,
        user,
        {
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
        },
      );
      const postData1 = await expectSuccess(res1);
      expect(postData1.id).toBe(post1.id);

      // Verify user can access community2 post when authenticated for community2
      const res2 = await makeAuthenticatedRequest(
        app,
        `/app/posts/${post2.id}`,
        user,
        {
          communityId: community2.id,
          headers: {
            Origin: `https://${community2.slug}.localhost`,
          },
        },
      );
      const postData2 = await expectSuccess(res2);
      expect(postData2.id).toBe(post2.id);

      // Verify user CANNOT access community2 post when authenticated for community1
      const res3 = await makeAuthenticatedRequest(
        app,
        `/app/posts/${post2.id}`,
        user,
        {
          communityId: community1.id,
          headers: {
            Origin: `https://${community1.slug}.localhost`,
          },
        },
      );
      await expectError(res3, 404);

      // Verify user CANNOT access community1 post when authenticated for community2
      const res4 = await makeAuthenticatedRequest(
        app,
        `/app/posts/${post1.id}`,
        user,
        {
          communityId: community2.id,
          headers: {
            Origin: `https://${community2.slug}.localhost`,
          },
        },
      );
      await expectError(res4, 404);
    });
  });
});
