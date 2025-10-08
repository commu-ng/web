import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { AppException } from "../../exception";
import { appAuthMiddleware } from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import { membershipMiddleware } from "../../middleware/membership";
import {
  conversationsQuerySchema,
  groupChatCreateRequestSchema,
  groupChatIdParamSchema,
  groupChatMessageCreateRequestSchema,
  groupChatMessageReactionCreateSchema,
  groupChatMessageReactionDeleteSchema,
  messageCreateSchema,
  messageIdParamSchema,
  messageReactionCreateSchema,
  messageReactionDeleteSchema,
  otherProfileIdParamSchema,
  profileIdQuerySchema,
  profileIdWithLimitQuerySchema,
  unreadCountQuerySchema,
} from "../../schemas";
import * as messageService from "../../services/message.service";
import * as profileService from "../../services/profile.service";
import type { AuthVariables } from "../../types";

export const messagesRouter = new Hono<{ Variables: AuthVariables }>()
  .post(
    "/messages",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("query", profileIdQuerySchema),
    zValidator("json", messageCreateSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { content, receiver_id, image_ids } = c.req.valid("json");
      const { profile_id: senderProfileId } = c.req.valid("query");

      // Get and validate sender profile
      const senderProfile = await profileService.validateAndGetProfile(
        user.id,
        senderProfileId,
        community.id,
        true,
      );

      if (!senderProfile) {
        return c.json(
          { message: "송신자 프로필을 찾을 수 없거나 귀하의 소유가 아닙니다" },
          404,
        );
      }

      try {
        const result = await messageService.sendDirectMessage(
          user.id,
          senderProfile.id,
          receiver_id,
          community.id,
          content,
          image_ids,
        );

        return c.json(result, 201);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  .delete(
    "/messages/:message_id",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("param", messageIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { message_id: messageId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          { message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다" },
          404,
        );
      }

      try {
        await messageService.deleteDirectMessage(
          profile.id,
          messageId,
          community.id,
        );

        return c.json({ message: "메시지가 성공적으로 삭제되었습니다" });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  .get(
    "/messages/unread-count",
    appAuthMiddleware,
    communityMiddleware,
    zValidator("query", unreadCountQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필을 찾을 수 없습니다" }, 404);
      }

      const count = await messageService.getUnreadCount(
        profile.id,
        community.id,
      );

      return c.json({ count });
    },
  )
  .get(
    "/conversations/:other_profile_id",
    appAuthMiddleware,
    communityMiddleware,
    zValidator("param", otherProfileIdParamSchema),
    zValidator("query", conversationsQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { other_profile_id: otherProfileId } = c.req.valid("param");
      const {
        profile_id: profileId,
        limit = 50,
        offset = 0,
      } = c.req.valid("query");

      // Validate user has access to this profile
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필에 접근할 권한이 없습니다" }, 403);
      }

      try {
        const result = await messageService.getConversationThread(
          profileId,
          otherProfileId,
          community.id,
          limit,
          offset,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .post(
    "/conversations/:other_profile_id/mark-read",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("param", otherProfileIdParamSchema),
    zValidator("query", z.object({ profile_id: z.uuid() })),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { other_profile_id: otherProfileId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필을 찾을 수 없습니다" }, 404);
      }

      try {
        await messageService.markConversationAsRead(
          profileId,
          otherProfileId,
          community.id,
        );
        return c.json({ message: "메시지가 읽음으로 표시되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .post(
    "/conversations/mark-all-read",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("query", z.object({ profile_id: z.uuid() })),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필을 찾을 수 없습니다" }, 404);
      }

      try {
        await messageService.markAllDirectMessagesAsRead(
          profileId,
          community.id,
        );
        return c.json({ message: "모든 메시지가 읽음으로 표시되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .get(
    "/conversations",
    appAuthMiddleware,
    communityMiddleware,
    zValidator("query", profileIdWithLimitQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId, limit = 20 } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필을 찾을 수 없습니다" }, 404);
      }

      const result = await messageService.getConversations(
        profile.id,
        community.id,
        limit,
      );

      return c.json(result);
    },
  )

  .post(
    "/messages/:message_id/reactions",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("param", messageIdParamSchema),
    zValidator("json", messageReactionCreateSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { message_id: messageId } = c.req.valid("param");
      const { profile_id: profileId, emoji } = c.req.valid("json");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필을 찾을 수 없습니다" }, 404);
      }

      try {
        const result = await messageService.createDirectMessageReaction(
          profile.id,
          messageId,
          community.id,
          emoji,
        );

        return c.json(result, 201);
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .delete(
    "/messages/:message_id/reactions",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("param", messageIdParamSchema),
    zValidator("query", messageReactionDeleteSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { message_id: messageId } = c.req.valid("param");
      const { profile_id: profileId, emoji } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필을 찾을 수 없습니다" }, 404);
      }

      try {
        await messageService.deleteDirectMessageReaction(
          profile.id,
          messageId,
          community.id,
          emoji,
        );

        return c.json(
          {
            message: "반응이 성공적으로 제거되었습니다",
          },
          200,
        );
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .get(
    "/group-chats",
    appAuthMiddleware,
    communityMiddleware,
    zValidator("query", conversationsQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const {
        profile_id: profileId,
        limit = 20,
        offset = 0,
      } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필을 찾을 수 없습니다" }, 404);
      }

      try {
        const result = await messageService.listGroupChats(
          profileId,
          community.id,
          limit,
          offset,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .post(
    "/group-chats",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("json", groupChatCreateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { name, member_profile_ids, creator_profile_id } =
        c.req.valid("json");

      // Verify creator profile belongs to the user
      const creatorProfile = await profileService.validateAndGetProfile(
        user.id,
        creator_profile_id,
        community.id,
        false,
      );

      if (!creatorProfile) {
        return c.json(
          { message: "생성자 프로필을 찾을 수 없거나 권한이 없습니다" },
          403,
        );
      }

      try {
        const result = await messageService.createGroupChat(
          name,
          member_profile_ids,
          creator_profile_id,
          community.id,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .get(
    "/group-chats/:group_chat_id",
    appAuthMiddleware,
    communityMiddleware,
    zValidator("param", groupChatIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id } = c.req.valid("param");
      const { profile_id } = c.req.valid("query");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          { message: "프로필을 찾을 수 없거나 권한이 없습니다" },
          403,
        );
      }

      try {
        const result = await messageService.getGroupChatDetails(
          group_chat_id,
          profile_id,
          community.id,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .get(
    "/group-chats/:group_chat_id/messages",
    appAuthMiddleware,
    communityMiddleware,
    zValidator("param", groupChatIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id } = c.req.valid("param");
      const { profile_id } = c.req.valid("query");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          { message: "프로필을 찾을 수 없거나 권한이 없습니다" },
          403,
        );
      }

      try {
        const result = await messageService.getGroupChatMessages(
          group_chat_id,
          profile_id,
          community.id,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .post(
    "/group-chats/:group_chat_id/messages",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("param", groupChatIdParamSchema),
    zValidator("json", groupChatMessageCreateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id } = c.req.valid("param");
      const { content, profile_id, image_ids } = c.req.valid("json");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필에 접근할 권한이 없습니다" }, 403);
      }

      try {
        const result = await messageService.sendGroupChatMessage(
          user.id,
          group_chat_id,
          profile_id,
          content,
          community.id,
          image_ids,
        );
        return c.json(result);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .post(
    "/group-chats/:group_chat_id/messages/:message_id/reactions",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator(
      "param",
      z.object({ group_chat_id: z.uuid(), message_id: z.uuid() }),
    ),
    zValidator("json", groupChatMessageReactionCreateSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id, message_id } = c.req.valid("param");
      const { profile_id, emoji } = c.req.valid("json");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필에 접근할 권한이 없습니다" }, 403);
      }

      try {
        const result = await messageService.createGroupChatMessageReaction(
          profile_id,
          message_id,
          group_chat_id,
          community.id,
          emoji,
        );
        return c.json(result, 201);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .delete(
    "/group-chats/:group_chat_id/messages/:message_id/reactions",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator(
      "param",
      z.object({ group_chat_id: z.uuid(), message_id: z.uuid() }),
    ),
    zValidator("query", groupChatMessageReactionDeleteSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id, message_id } = c.req.valid("param");
      const { profile_id, emoji } = c.req.valid("query");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필에 접근할 권한이 없습니다" }, 403);
      }

      try {
        await messageService.deleteGroupChatMessageReaction(
          profile_id,
          message_id,
          group_chat_id,
          community.id,
          emoji,
        );
        return c.json({ message: "반응이 성공적으로 제거되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  .post(
    "/group-chats/:group_chat_id/mark-read",
    appAuthMiddleware,
    communityMiddleware,
    membershipMiddleware,
    zValidator("param", groupChatIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id } = c.req.valid("param");
      const { profile_id } = c.req.valid("query");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json({ error: "프로필에 접근할 권한이 없습니다" }, 403);
      }

      try {
        await messageService.markGroupChatMessagesAsRead(
          group_chat_id,
          profile_id,
          community.id,
        );
        return c.json({ message: "메시지가 읽음으로 표시되었습니다" });
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  );
