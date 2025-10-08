import { describe, expect, it, vi } from "vitest";
import { testDb } from "../test/setup";

// Mock the db module before importing services
vi.mock("../db");

import { eq } from "drizzle-orm";
import { mention as mentionTable } from "../drizzle/schema";
import {
  createCommunityWithOwner,
  createTestMembership,
  createTestProfile,
  createTestUser,
} from "../test/factories";
import * as postService from "./post.service";
import * as profileService from "./profile.service";

describe("Post Service", () => {
  describe("Community Isolation", () => {
    it("should not show posts from another community in profile posts listing", async () => {
      // Create two communities
      const { community: community1 } = await createCommunityWithOwner();
      const { community: community2 } = await createCommunityWithOwner();

      // Create a user who is a member of both communities
      const user = await createTestUser();

      // Create memberships in both communities
      await createTestMembership(user.id, community1.id, {
        role: "member",
      });
      await createTestMembership(user.id, community2.id, {
        role: "member",
      });

      // Create profiles in both communities with DIFFERENT usernames
      const profile1 = await createTestProfile(user.id, community1.id, {
        username: "user_comm1",
        name: "User in Community 1",
      });
      const profile2 = await createTestProfile(user.id, community2.id, {
        username: "user_comm2",
        name: "User in Community 2",
      });

      // Create posts in both communities
      const post1 = await postService.createPost(
        user.id,
        profile1.id,
        community1.id,
        "Post in Community 1",
        null,
        undefined,
        false,
        null,
        null,
        community1.startsAt,
        community1.endsAt,
      );

      const post2 = await postService.createPost(
        user.id,
        profile2.id,
        community2.id,
        "Post in Community 2",
        null,
        undefined,
        false,
        null,
        null,
        community2.startsAt,
        community2.endsAt,
      );

      // Get posts for profile1 in community1
      const postsInCommunity1 = await profileService.getProfilePosts(
        "user_comm1",
        community1.id,
        10,
        0,
      );

      // Get posts for profile2 in community2
      const postsInCommunity2 = await profileService.getProfilePosts(
        "user_comm2",
        community2.id,
        10,
        0,
      );

      // Verify community 1 only shows its own posts
      expect(postsInCommunity1).toHaveLength(1);
      const firstPost1 = postsInCommunity1[0];
      expect(firstPost1).toBeDefined();
      expect(post1).toBeDefined();
      expect(firstPost1?.id).toBe(post1?.id);
      expect(firstPost1?.content).toBe("Post in Community 1");

      // Verify community 2 only shows its own posts
      expect(postsInCommunity2).toHaveLength(1);
      const firstPost2 = postsInCommunity2[0];
      expect(firstPost2).toBeDefined();
      expect(post2).toBeDefined();
      expect(firstPost2?.id).toBe(post2?.id);
      expect(firstPost2?.content).toBe("Post in Community 2");

      // Critical: Ensure posts from community 2 don't appear in community 1
      const postIdsInCommunity1 = postsInCommunity1.map((p) => p.id);
      expect(post2).toBeDefined();
      expect(postIdsInCommunity1).not.toContain(post2?.id);

      // Critical: Ensure posts from community 1 don't appear in community 2
      const postIdsInCommunity2 = postsInCommunity2.map((p) => p.id);
      expect(post1).toBeDefined();
      expect(postIdsInCommunity2).not.toContain(post1?.id);
    });
  });

  describe("Mentions", () => {
    it("should create a mention record when a post mentions an existing active profile", async () => {
      // Create a community with owner
      const { community } = await createCommunityWithOwner();

      // Create two users
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // Create memberships for both users
      await createTestMembership(user1.id, community.id, { role: "member" });
      await createTestMembership(user2.id, community.id, { role: "member" });

      // Create profiles for both users
      const profile1 = await createTestProfile(user1.id, community.id, {
        username: "alice",
        name: "Alice",
      });
      const profile2 = await createTestProfile(user2.id, community.id, {
        username: "bob",
        name: "Bob",
      });

      // User 1 creates a post mentioning User 2
      const post = await postService.createPost(
        user1.id,
        profile1.id,
        community.id,
        "Hello @bob, how are you?",
        null, // no reply
        undefined, // no images
        false, // not announcement
        null, // no content warning
        null, // no scheduled time
        community.startsAt,
        community.endsAt,
      );

      // Verify the post was created
      expect(post).toBeDefined();
      expect(post.content).toBe("Hello @bob, how are you?");

      // Verify a mention record was created
      const mentions = await testDb
        .select()
        .from(mentionTable)
        .where(eq(mentionTable.postId, post?.id ?? ""));

      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toBeDefined();
      expect(mentions[0]?.profileId).toBe(profile2.id);
      expect(mentions[0]?.postId).toBe(post.id);
    });

    it("should not create a mention record when mentioning a non-existent profile", async () => {
      // Create a community with owner
      const { community } = await createCommunityWithOwner();

      // Create a user
      const user = await createTestUser();

      // Create membership
      await createTestMembership(user.id, community.id, { role: "member" });

      // Create profile
      const profile = await createTestProfile(user.id, community.id, {
        username: "alice",
        name: "Alice",
      });

      // User creates a post mentioning a non-existent user
      const post = await postService.createPost(
        user.id,
        profile.id,
        community.id,
        "Hello @nonexistent, are you there?",
        null,
        undefined,
        false,
        null,
        null,
        community.startsAt,
        community.endsAt,
      );

      // Verify the post was created
      expect(post).toBeDefined();

      // Verify no mention record was created
      const mentions = await testDb
        .select()
        .from(mentionTable)
        .where(eq(mentionTable.postId, post?.id ?? ""));

      expect(mentions).toHaveLength(0);
    });

    it("should not create a mention record when mentioning yourself", async () => {
      // Create a community with owner
      const { community } = await createCommunityWithOwner();

      // Create a user
      const user = await createTestUser();

      // Create membership
      await createTestMembership(user.id, community.id, { role: "member" });

      // Create profile
      const profile = await createTestProfile(user.id, community.id, {
        username: "alice",
        name: "Alice",
      });

      // User creates a post mentioning themselves
      const post = await postService.createPost(
        user.id,
        profile.id,
        community.id,
        "Hello @alice, reminder to myself!",
        null,
        undefined,
        false,
        null,
        null,
        community.startsAt,
        community.endsAt,
      );

      // Verify the post was created
      expect(post).toBeDefined();

      // Verify no mention record was created (self-mentions are filtered)
      const mentions = await testDb
        .select()
        .from(mentionTable)
        .where(eq(mentionTable.postId, post?.id ?? ""));

      expect(mentions).toHaveLength(0);
    });
  });
});
