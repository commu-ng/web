import { describe, expect, it, vi } from "vitest";

// Mock the db module before importing services
vi.mock("../db");

import {
  createCommunityWithOwner,
  createTestGroupChat,
  createTestGroupChatMembership,
  createTestMembership,
  createTestProfile,
  createTestUser,
} from "../test/factories";
import * as messageService from "./message.service";

/**
 * Security Test Suite: Export Data Isolation
 *
 * These tests verify that data exports only include:
 * - User's own posts
 * - Direct messages where user is sender OR receiver
 * - Group chats where user is a member
 *
 * And specifically do NOT include:
 * - Other users' direct messages
 * - Group chats user is not a member of
 */

describe("Security: Export Data Isolation", () => {
  describe("Direct Message Export Isolation", () => {
    it("should only export direct messages where user is participant", async () => {
      // Create community with three users
      const {
        user: user1,
        community,
        profile: profile1,
      } = await createCommunityWithOwner();

      const user2 = await createTestUser();
      await createTestMembership(user2.id, community.id);
      const profile2 = await createTestProfile(user2.id, community.id, {
        username: "user2",
      });

      const user3 = await createTestUser();
      await createTestMembership(user3.id, community.id);
      const profile3 = await createTestProfile(user3.id, community.id, {
        username: "user3",
      });

      // User1 sends message to User2
      await messageService.sendDirectMessage(
        user1.id,
        profile1.id,
        profile2.id,
        community.id,
        "User1 to User2: Hello!",
      );

      // User2 sends message to User3 (User1 should NOT see this)
      await messageService.sendDirectMessage(
        user2.id,
        profile2.id,
        profile3.id,
        community.id,
        "User2 to User3: Secret message",
      );

      // User3 sends message to User1
      await messageService.sendDirectMessage(
        user3.id,
        profile3.id,
        profile1.id,
        community.id,
        "User3 to User1: Hey there!",
      );

      // Get User1's conversations for export
      const user1Conversations =
        await messageService.getAllConversationsForExport(community.id, [
          profile1.id,
        ]);

      // User1 should have exactly 2 conversations
      expect(user1Conversations.size).toBe(2);

      // Verify User1 has conversation with User2
      const conv1 = Array.from(user1Conversations.values()).find((messages) =>
        messages.some(
          (m) =>
            (m.sender.id === profile1.id && m.receiver.id === profile2.id) ||
            (m.sender.id === profile2.id && m.receiver.id === profile1.id),
        ),
      );
      expect(conv1).toBeDefined();
      expect(conv1?.length).toBe(1);
      expect(conv1?.[0].content).toBe("User1 to User2: Hello!");

      // Verify User1 has conversation with User3
      const conv2 = Array.from(user1Conversations.values()).find((messages) =>
        messages.some(
          (m) =>
            (m.sender.id === profile1.id && m.receiver.id === profile3.id) ||
            (m.sender.id === profile3.id && m.receiver.id === profile1.id),
        ),
      );
      expect(conv2).toBeDefined();
      expect(conv2?.length).toBe(1);
      expect(conv2?.[0].content).toBe("User3 to User1: Hey there!");

      // Verify User1 does NOT have User2-User3 conversation
      const allMessages = Array.from(user1Conversations.values()).flat();
      const hasSecretMessage = allMessages.some(
        (m) => m.content === "User2 to User3: Secret message",
      );
      expect(hasSecretMessage).toBe(false);
    });

    it("should export messages where user is receiver", async () => {
      const {
        user: _user1,
        community,
        profile: profile1,
      } = await createCommunityWithOwner();

      const user2 = await createTestUser();
      await createTestMembership(user2.id, community.id);
      const profile2 = await createTestProfile(user2.id, community.id, {
        username: "user2",
      });

      // User2 sends message to User1
      await messageService.sendDirectMessage(
        user2.id,
        profile2.id,
        profile1.id,
        community.id,
        "Message to User1",
      );

      // Get User1's conversations (User1 is receiver)
      const user1Conversations =
        await messageService.getAllConversationsForExport(community.id, [
          profile1.id,
        ]);

      expect(user1Conversations.size).toBe(1);
      const messages = Array.from(user1Conversations.values())[0];
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe("Message to User1");
      expect(messages[0].receiver.id).toBe(profile1.id);
    });

    it("should not export deleted direct messages", async () => {
      const {
        user: user1,
        community,
        profile: profile1,
      } = await createCommunityWithOwner();

      const user2 = await createTestUser();
      await createTestMembership(user2.id, community.id);
      const profile2 = await createTestProfile(user2.id, community.id, {
        username: "user2",
      });

      // Send and then delete a message
      const message = await messageService.sendDirectMessage(
        user1.id,
        profile1.id,
        profile2.id,
        community.id,
        "Message to be deleted",
      );

      await messageService.deleteDirectMessage(
        profile1.id,
        message.id,
        community.id,
      );

      // Get User1's conversations - should be empty
      const user1Conversations =
        await messageService.getAllConversationsForExport(community.id, [
          profile1.id,
        ]);

      expect(user1Conversations.size).toBe(0);
    });
  });

  describe("Group Chat Export Isolation", () => {
    it("should only export group chats where user is a member", async () => {
      // Create community with three users
      const {
        user: user1,
        community,
        profile: profile1,
      } = await createCommunityWithOwner();

      const user2 = await createTestUser();
      await createTestMembership(user2.id, community.id);
      const profile2 = await createTestProfile(user2.id, community.id, {
        username: "user2",
      });

      const user3 = await createTestUser();
      await createTestMembership(user3.id, community.id);
      const profile3 = await createTestProfile(user3.id, community.id, {
        username: "user3",
      });

      // Create group chat with User1 and User2 (User3 not included)
      const groupChat1 = await createTestGroupChat(community.id, profile1.id, {
        name: "User1 and User2 Group",
      });
      await createTestGroupChatMembership(groupChat1.id, profile1.id);
      await createTestGroupChatMembership(groupChat1.id, profile2.id);

      // Send message in groupChat1
      await messageService.sendGroupChatMessage(
        user1.id,
        groupChat1.id,
        profile1.id,
        "Message in group 1",
        community.id,
      );

      // Create group chat with User2 and User3 (User1 not included)
      const groupChat2 = await createTestGroupChat(community.id, profile2.id, {
        name: "User2 and User3 Group",
      });
      await createTestGroupChatMembership(groupChat2.id, profile2.id);
      await createTestGroupChatMembership(groupChat2.id, profile3.id);

      // Send message in groupChat2 (User1 should NOT see this)
      await messageService.sendGroupChatMessage(
        user2.id,
        groupChat2.id,
        profile2.id,
        "Secret group message",
        community.id,
      );

      // Get User1's group chats for export
      const user1GroupChats = await messageService.getAllGroupChatsForExport(
        community.id,
        [profile1.id],
      );

      // User1 should only see groupChat1
      expect(user1GroupChats.length).toBe(1);
      expect(user1GroupChats[0].id).toBe(groupChat1.id);
      expect(user1GroupChats[0].name).toBe("User1 and User2 Group");

      // Verify the message content
      expect(user1GroupChats[0].messages.length).toBe(1);
      expect(user1GroupChats[0].messages[0].content).toBe("Message in group 1");

      // Verify User1 does NOT see the secret message
      const allMessages = user1GroupChats.flatMap((gc) => gc.messages);
      const hasSecretMessage = allMessages.some(
        (m) => m.content === "Secret group message",
      );
      expect(hasSecretMessage).toBe(false);
    });

    it("should export all messages from group chats where user is member", async () => {
      const {
        user: user1,
        community,
        profile: profile1,
      } = await createCommunityWithOwner();

      const user2 = await createTestUser();
      await createTestMembership(user2.id, community.id);
      const profile2 = await createTestProfile(user2.id, community.id, {
        username: "user2",
      });

      // Create group chat with User1 and User2
      const groupChat = await createTestGroupChat(community.id, profile1.id, {
        name: "Test Group",
      });
      await createTestGroupChatMembership(groupChat.id, profile1.id);
      await createTestGroupChatMembership(groupChat.id, profile2.id);

      // Send multiple messages
      await messageService.sendGroupChatMessage(
        user1.id,
        groupChat.id,
        profile1.id,
        "Message 1 from User1",
        community.id,
      );
      await messageService.sendGroupChatMessage(
        user2.id,
        groupChat.id,
        profile2.id,
        "Message 2 from User2",
        community.id,
      );
      await messageService.sendGroupChatMessage(
        user1.id,
        groupChat.id,
        profile1.id,
        "Message 3 from User1",
        community.id,
      );

      // Get User1's group chats for export
      const user1GroupChats = await messageService.getAllGroupChatsForExport(
        community.id,
        [profile1.id],
      );

      // Verify all messages are included
      expect(user1GroupChats[0].messages.length).toBe(3);
      expect(user1GroupChats[0].messages[0].content).toBe(
        "Message 1 from User1",
      );
      expect(user1GroupChats[0].messages[1].content).toBe(
        "Message 2 from User2",
      );
      expect(user1GroupChats[0].messages[2].content).toBe(
        "Message 3 from User1",
      );
    });

    it("should handle user with multiple profiles in same group chat", async () => {
      const { user, community } = await createCommunityWithOwner();

      // Create two profiles for same user
      const profile1 = await createTestProfile(user.id, community.id, {
        username: "user_profile1",
      });
      const profile2 = await createTestProfile(user.id, community.id, {
        username: "user_profile2",
      });

      // Create group chat with both profiles
      const groupChat = await createTestGroupChat(community.id, profile1.id, {
        name: "Multi-Profile Group",
      });
      await createTestGroupChatMembership(groupChat.id, profile1.id);
      await createTestGroupChatMembership(groupChat.id, profile2.id);

      // Send messages from both profiles
      await messageService.sendGroupChatMessage(
        user.id,
        groupChat.id,
        profile1.id,
        "From profile 1",
        community.id,
      );
      await messageService.sendGroupChatMessage(
        user.id,
        groupChat.id,
        profile2.id,
        "From profile 2",
        community.id,
      );

      // Get export with both profile IDs
      const groupChats = await messageService.getAllGroupChatsForExport(
        community.id,
        [profile1.id, profile2.id],
      );

      // Should get the group chat once (not duplicated)
      expect(groupChats.length).toBe(1);
      expect(groupChats[0].messages.length).toBe(2);
    });
  });

  describe("Cross-Community Export Isolation", () => {
    it("should not export messages from different community", async () => {
      // Create user with membership in two communities
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

      const user2 = await createTestUser();
      await createTestMembership(user2.id, community1.id);
      const profile1b = await createTestProfile(user2.id, community1.id, {
        username: "user2incommunity1",
      });

      // Send message in community1
      await messageService.sendDirectMessage(
        user.id,
        profile1.id,
        profile1b.id,
        community1.id,
        "Message in community 1",
      );

      // Get export for community2 - should NOT include community1 messages
      const community2Conversations =
        await messageService.getAllConversationsForExport(community2.id, [
          profile2.id,
        ]);

      expect(community2Conversations.size).toBe(0);

      // Get export for community1 - should include the message
      const community1Conversations =
        await messageService.getAllConversationsForExport(community1.id, [
          profile1.id,
        ]);

      expect(community1Conversations.size).toBe(1);
      const messages = Array.from(community1Conversations.values())[0];
      expect(messages[0].content).toBe("Message in community 1");
    });
  });

  describe("Full Export Data Isolation", () => {
    it("should only export user's own data, not other users' messages", async () => {
      // Create community with two users
      const {
        user: user1,
        community,
        profile: profile1,
      } = await createCommunityWithOwner();

      const user2 = await createTestUser();
      await createTestMembership(user2.id, community.id);
      const profile2 = await createTestProfile(user2.id, community.id, {
        username: "user2",
      });

      const user3 = await createTestUser();
      await createTestMembership(user3.id, community.id);
      const profile3 = await createTestProfile(user3.id, community.id, {
        username: "user3",
      });

      // User1 <-> User2 conversation
      await messageService.sendDirectMessage(
        user1.id,
        profile1.id,
        profile2.id,
        community.id,
        "User1 to User2",
      );

      // User2 <-> User3 conversation (User1 should NOT see this)
      await messageService.sendDirectMessage(
        user2.id,
        profile2.id,
        profile3.id,
        community.id,
        "User2 to User3 - PRIVATE",
      );

      // Create group chat without User1
      const groupChat = await createTestGroupChat(community.id, profile2.id, {
        name: "User2 and User3 Private Group",
      });
      await createTestGroupChatMembership(groupChat.id, profile2.id);
      await createTestGroupChatMembership(groupChat.id, profile3.id);
      await messageService.sendGroupChatMessage(
        user2.id,
        groupChat.id,
        profile2.id,
        "Group message - User1 should not see",
        community.id,
      );

      // Get User1's export data
      const user1DMs = await messageService.getAllConversationsForExport(
        community.id,
        [profile1.id],
      );
      const user1Groups = await messageService.getAllGroupChatsForExport(
        community.id,
        [profile1.id],
      );

      // Verify User1 only has their own conversation
      expect(user1DMs.size).toBe(1);
      const user1Messages = Array.from(user1DMs.values()).flat();
      expect(user1Messages.length).toBe(1);
      expect(user1Messages[0].content).toBe("User1 to User2");

      // Verify User1 has no group chats
      expect(user1Groups.length).toBe(0);

      // Verify User1 does NOT have access to User2-User3 data
      const hasPrivateMessage = user1Messages.some(
        (m) => m.content === "User2 to User3 - PRIVATE",
      );
      expect(hasPrivateMessage).toBe(false);
    });
  });
});
