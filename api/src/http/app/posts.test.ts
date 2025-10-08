import { describe, expect, it, vi } from "vitest";

// Mock the db module before importing services
vi.mock("../../db");

import {
  createCommunityWithOwner,
  createTestMembership,
  createTestProfile,
  createTestUser,
} from "../../test/factories";
import {
  createTestApp,
  makeAuthenticatedRequest,
} from "../../test/http-helpers";
import * as postService from "../../services/post.service";

describe("Posts Routes", () => {
  describe("GET /app/announcements", () => {
    it("should return announcements for community", async () => {
      const app = createTestApp();
      const { user, community, profile } = await createCommunityWithOwner();

      // Create an announcement post
      await postService.createPost(
        user.id,
        profile.id,
        community.id,
        "This is an announcement",
        null,
        undefined,
        true,
        null,
        null,
        community.startsAt,
        community.endsAt,
      );

      const res = await app.request("/app/announcements", {
        headers: {
          Origin: `https://${community.slug}.localhost`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].content).toBe("This is an announcement");
    });

    it("should return empty array when no announcements", async () => {
      const app = createTestApp();
      const { community } = await createCommunityWithOwner();

      const res = await app.request("/app/announcements", {
        headers: {
          Origin: `https://${community.slug}.localhost`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it("should respect pagination params", async () => {
      const app = createTestApp();
      const { user, community, profile } = await createCommunityWithOwner();

      // Create multiple announcements
      for (let i = 0; i < 5; i++) {
        await postService.createPost(
          user.id,
          profile.id,
          community.id,
          `Announcement ${i}`,
          null,
          undefined,
          true,
          null,
          null,
          community.startsAt,
          community.endsAt,
        );
      }

      const res = await app.request("/app/announcements?limit=2&offset=0", {
        headers: {
          Origin: `https://${community.slug}.localhost`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBeLessThanOrEqual(2);
    });
  });

  describe("GET /app/bookmarks", () => {
    it("should require authentication", async () => {
      const app = createTestApp();
      const { community } = await createCommunityWithOwner();

      const res = await app.request("/app/bookmarks?profile_id=test-id", {
        headers: {
          Origin: `https://${community.slug}.localhost`,
        },
      });

      expect(res.status).toBe(401);
    });

    it("should return bookmarks for authenticated user", async () => {
      const app = createTestApp();
      const { user, community, profile } = await createCommunityWithOwner();

      const res = await makeAuthenticatedRequest(
        app,
        `/app/bookmarks?profile_id=${profile.id}`,
        user,
        {
          communityId: community.id,
          headers: {
            Origin: `https://${community.slug}.localhost`,
          },
        },
      );

      expect(res.status).toBe(200);
      const response = await res.json();
      expect(response).toHaveProperty("data");
      expect(response).toHaveProperty("nextCursor");
      expect(response).toHaveProperty("hasMore");
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe("POST /app/upload/file", () => {
    it("should require authentication", async () => {
      const app = createTestApp();

      const res = await app.request("/app/upload/file", {
        method: "POST",
      });

      expect(res.status).toBe(401);
    });

    it("should return 400 when Content-Type is not multipart", async () => {
      const app = createTestApp();
      const { community } = await createCommunityWithOwner();
      const user = await createTestUser();
      await createTestMembership(user.id, community.id);

      const res = await makeAuthenticatedRequest(
        app,
        "/app/upload/file",
        user,
        {
          method: "POST",
          communityId: community.id,
          headers: {
            "Content-Type": "application/json",
          },
          body: {},
        },
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain("multipart");
    });
  });

  describe("Community Isolation", () => {
    it("should not show posts from another community in announcements", async () => {
      const app = createTestApp();
      const {
        user: user1,
        community: community1,
        profile: profile1,
      } = await createCommunityWithOwner();
      const {
        user: user2,
        community: community2,
        profile: profile2,
      } = await createCommunityWithOwner();

      // Create announcement in community1
      await postService.createPost(
        user1.id,
        profile1.id,
        community1.id,
        "Community 1 announcement",
        null,
        undefined,
        true,
        null,
        null,
        community1.startsAt,
        community1.endsAt,
      );

      // Create announcement in community2
      await postService.createPost(
        user2.id,
        profile2.id,
        community2.id,
        "Community 2 announcement",
        null,
        undefined,
        true,
        null,
        null,
        community2.startsAt,
        community2.endsAt,
      );

      // Request announcements for community1
      const res = await app.request("/app/announcements", {
        headers: {
          Origin: `https://${community1.slug}.localhost`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(1);
      expect(data[0].content).toBe("Community 1 announcement");
    });

    it("should not allow accessing bookmarks from different community", async () => {
      const app = createTestApp();
      const { user, community: community1 } = await createCommunityWithOwner();
      const { community: community2 } = await createCommunityWithOwner();

      // Create membership in community2
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

      // Should fail because profile is in different community
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Pagination", () => {
    it("should validate pagination parameters", async () => {
      const app = createTestApp();
      const { community } = await createCommunityWithOwner();

      // Test with invalid limit (negative)
      const res1 = await app.request("/app/announcements?limit=-1", {
        headers: {
          Origin: `https://${community.slug}.localhost`,
        },
      });
      expect(res1.status).toBe(400);

      // Test with valid cursor (should accept any string)
      const res2 = await app.request(
        "/app/announcements?cursor=some-cursor-value",
        {
          headers: {
            Origin: `https://${community.slug}.localhost`,
          },
        },
      );
      expect(res2.status).toBe(200);
    });
  });

  describe("POST /app/posts - Announcements", () => {
    it("should allow owners to create announcements", async () => {
      const app = createTestApp();
      const { user, community, profile } = await createCommunityWithOwner();

      const res = await makeAuthenticatedRequest(app, "/app/posts", user, {
        method: "POST",
        communityId: community.id,
        headers: {
          Origin: `https://${community.slug}.localhost`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "This is an announcement",
          profile_id: profile.id,
          announcement: true,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.announcement).toBe(true);
    });

    it("should not allow non-owners to create announcements", async () => {
      const app = createTestApp();
      const { community } = await createCommunityWithOwner();

      // Create a regular member (non-owner)
      const memberUser = await createTestUser();
      await createTestMembership(memberUser.id, community.id, "member");
      const memberProfile = await createTestProfile(
        memberUser.id,
        community.id,
        {
          username: "member",
        },
      );

      const res = await makeAuthenticatedRequest(
        app,
        "/app/posts",
        memberUser,
        {
          method: "POST",
          communityId: community.id,
          headers: {
            Origin: `https://${community.slug}.localhost`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "Trying to create an announcement",
            profile_id: memberProfile.id,
            announcement: true,
          }),
        },
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("소유자만");
    });

    it("should not allow moderators to create announcements", async () => {
      const app = createTestApp();
      const { community } = await createCommunityWithOwner();

      // Create a moderator (not owner)
      const moderatorUser = await createTestUser();
      await createTestMembership(moderatorUser.id, community.id, "moderator");
      const moderatorProfile = await createTestProfile(
        moderatorUser.id,
        community.id,
        {
          username: "moderator",
        },
      );

      const res = await makeAuthenticatedRequest(
        app,
        "/app/posts",
        moderatorUser,
        {
          method: "POST",
          communityId: community.id,
          headers: {
            Origin: `https://${community.slug}.localhost`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "Trying to create an announcement",
            profile_id: moderatorProfile.id,
            announcement: true,
          }),
        },
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("소유자만");
    });

    it("should not allow announcements to be replies", async () => {
      const app = createTestApp();
      const { user, community, profile } = await createCommunityWithOwner();

      // Create a regular post first
      const parentPost = await postService.createPost(
        user.id,
        profile.id,
        community.id,
        "Parent post",
        null,
        undefined,
        false,
        null,
        null,
        community.startsAt,
        community.endsAt,
      );

      // Try to create a reply as an announcement
      const res = await makeAuthenticatedRequest(app, "/app/posts", user, {
        method: "POST",
        communityId: community.id,
        headers: {
          Origin: `https://${community.slug}.localhost`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "Reply as announcement",
          profile_id: profile.id,
          in_reply_to_id: parentPost.id,
          announcement: true,
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("답글");
    });
  });
});
