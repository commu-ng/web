import { createMiddleware } from "hono/factory";
import type {
  bot as botTable,
  community as communityTable,
  profile as profileTable,
} from "../drizzle/schema";
import * as botService from "../services/bot.service";

type BotAuthVariables = {
  bot: {
    id: (typeof botTable.$inferSelect)["id"];
    name: (typeof botTable.$inferSelect)["name"];
    communityId: (typeof communityTable.$inferSelect)["id"];
    profileId: (typeof profileTable.$inferSelect)["id"];
    profileName: (typeof profileTable.$inferSelect)["name"];
    profileUsername: (typeof profileTable.$inferSelect)["username"];
    createdByUserId: (typeof botTable.$inferSelect)["createdById"];
  };
  community: typeof communityTable.$inferSelect;
};

export const botAuthMiddleware = createMiddleware<{
  Variables: BotAuthVariables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid Authorization header",
        },
      },
      401,
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  const result = await botService.validateBotToken(token);

  if (!result) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired bot token",
        },
      },
      401,
    );
  }

  // Get community info
  const community = await botService.getCommunityById(result.communityId);

  if (!community) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Community not found",
        },
      },
      404,
    );
  }

  // Check if request is for the correct community
  const communityIdParam = c.req.param("communityId");
  if (communityIdParam && communityIdParam !== result.communityId) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Bot does not have access to this community",
        },
      },
      403,
    );
  }

  c.set("bot", {
    id: result.botId,
    name: result.botName,
    communityId: result.communityId,
    profileId: result.profileId,
    profileName: result.profileName,
    profileUsername: result.profileUsername,
    createdByUserId: result.createdByUserId,
  });
  c.set("community", community);

  await next();
});
