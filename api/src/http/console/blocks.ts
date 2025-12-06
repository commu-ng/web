import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth";
import * as blockService from "../../services/block.service";
import type { AuthVariables } from "../../types";

const userIdParamSchema = z.object({
  user_id: z.string().uuid(),
});

export const consoleBlocksRouter = new Hono<{ Variables: AuthVariables }>()
  // Get all blocked users
  .get("/blocks", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "인증되지 않음" } },
        401,
      );
    }
    const blockedUsers = await blockService.getBlockedUsers(user.id);
    return c.json({ data: blockedUsers });
  })

  // Block a user
  .post(
    "/blocks/:user_id",
    authMiddleware,
    zValidator("param", userIdParamSchema),
    async (c) => {
      const user = c.get("user");
      if (!user) {
        return c.json(
          { error: { code: "UNAUTHORIZED", message: "인증되지 않음" } },
          401,
        );
      }
      const { user_id: blockedUserId } = c.req.valid("param");

      await blockService.blockUser(user.id, blockedUserId);
      return c.json({ data: { blocked: true } }, 201);
    },
  )

  // Unblock a user
  .delete(
    "/blocks/:user_id",
    authMiddleware,
    zValidator("param", userIdParamSchema),
    async (c) => {
      const user = c.get("user");
      if (!user) {
        return c.json(
          { error: { code: "UNAUTHORIZED", message: "인증되지 않음" } },
          401,
        );
      }
      const { user_id: blockedUserId } = c.req.valid("param");

      await blockService.unblockUser(user.id, blockedUserId);
      return c.json({ data: { unblocked: true } });
    },
  );
