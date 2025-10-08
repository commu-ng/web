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

describe("Me Routes", () => {
  describe("GET /app/me", () => {
    it("should return current user data when authenticated", async () => {
      const app = createTestApp();
      const { user, community } = await createCommunityWithOwner();

      const res = await makeAuthenticatedRequest(app, "/app/me", user, {
        communityId: community.id,
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        id: user.id,
        loginName: user.loginName,
        admin: user.isAdmin,
      });
    });

    it("should return 401 when not authenticated", async () => {
      const app = createTestApp();

      const res = await app.request("/app/me");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /app/me/instance", () => {
    it("should return user instance data for community member", async () => {
      const app = createTestApp();
      const { user, community } = await createCommunityWithOwner();

      const res = await makeAuthenticatedRequest(
        app,
        "/app/me/instance",
        user,
        {
          communityId: community.id,
          headers: {
            Origin: `https://${community.slug}.localhost`,
          },
        },
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(community.id);
      expect(data.role).toBe("owner");
    });

    it("should return 401 when not authenticated", async () => {
      const app = createTestApp();
      const { community } = await createCommunityWithOwner();

      const res = await app.request("/app/me/instance", {
        headers: {
          Origin: `https://${community.slug}.localhost`,
        },
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /app/me/profiles", () => {
    it("should return user profiles in community", async () => {
      const app = createTestApp();
      const { user, community, profile } = await createCommunityWithOwner();

      const res = await makeAuthenticatedRequest(
        app,
        "/app/me/profiles",
        user,
        {
          communityId: community.id,
          headers: {
            Origin: `https://${community.slug}.localhost`,
          },
        },
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].id).toBe(profile.id);
    });

    it("should return 401 when not authenticated", async () => {
      const app = createTestApp();
      const { community } = await createCommunityWithOwner();

      const res = await app.request("/app/me/profiles", {
        headers: {
          Origin: `https://${community.slug}.localhost`,
        },
      });

      expect(res.status).toBe(401);
    });

    it("should return error when user is not a member of community", async () => {
      const app = createTestApp();
      const { community } = await createCommunityWithOwner();
      const otherUser = await createTestUser();

      const res = await makeAuthenticatedRequest(
        app,
        "/app/me/profiles",
        otherUser,
        {
          headers: {
            Origin: `https://${community.slug}.localhost`,
          },
        },
      );

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("PUT /app/me/profiles", () => {
    it("should update profile when user owns it", async () => {
      const app = createTestApp();
      const { user, community, profile } = await createCommunityWithOwner();

      const res = await makeAuthenticatedRequest(
        app,
        `/app/me/profiles?profile_id=${profile.id}`,
        user,
        {
          method: "PUT",
          communityId: community.id,
          headers: {
            Origin: `https://${community.slug}.localhost`,
          },
          body: {
            name: "Updated Name",
            username: "updatedusername",
          },
        },
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("Updated Name");
      expect(data.username).toBe("updatedusername");
    });

    it("should return 404 when user does not own profile", async () => {
      const app = createTestApp();
      const { community } = await createCommunityWithOwner();
      const otherUser = await createTestUser();

      // Create membership for other user
      await createTestMembership(otherUser.id, community.id);

      // Create another profile owned by someone else (in same community)
      const anotherUser = await createTestUser();
      await createTestMembership(anotherUser.id, community.id);
      const otherProfile = await createTestProfile(
        anotherUser.id,
        community.id,
        {
          username: "anotherprofile",
        },
      );

      const res = await makeAuthenticatedRequest(
        app,
        `/app/me/profiles?profile_id=${otherProfile.id}`,
        otherUser,
        {
          method: "PUT",
          communityId: community.id,
          headers: {
            Origin: `https://${community.slug}.localhost`,
          },
          body: {
            name: "Hacked Name",
            username: "hacked",
          },
        },
      );

      expect(res.status).toBe(404);
    });

    it("should return 400 when username is already taken", async () => {
      const app = createTestApp();
      const { user, community, profile } = await createCommunityWithOwner();

      // Create another user with a profile in the same community
      const otherUser = await createTestUser();
      await createTestMembership(otherUser.id, community.id);
      await createTestProfile(otherUser.id, community.id, {
        username: "existing",
      });

      const res = await makeAuthenticatedRequest(
        app,
        `/app/me/profiles?profile_id=${profile.id}`,
        user,
        {
          method: "PUT",
          communityId: community.id,
          headers: {
            Origin: `https://${community.slug}.localhost`,
          },
          body: {
            name: profile.name,
            username: "existing", // Try to use existing username
          },
        },
      );

      expect(res.status).toBe(400);
    });

    it("should return 401 when not authenticated", async () => {
      const app = createTestApp();
      const { community, profile } = await createCommunityWithOwner();

      const res = await app.request(
        `/app/me/profiles?profile_id=${profile.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Origin: `https://${community.slug}.localhost`,
          },
          body: JSON.stringify({
            name: "Updated Name",
            username: "updated",
          }),
        },
      );

      expect(res.status).toBe(401);
    });
  });
});
