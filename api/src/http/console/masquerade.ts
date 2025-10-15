import { zValidator } from "@hono/zod-validator";
import { setCookie } from "hono/cookie";
import { Hono } from "hono";
import { AppException } from "../../exception";
import { authMiddleware } from "../../middleware/auth";
import {
  masqueradeAuditLogQuerySchema,
  masqueradeStartRequestSchema,
  masqueradeUserListQuerySchema,
} from "../../schemas";
import * as masqueradeService from "../../services/masquerade.service";
import type { AuthVariables } from "../../types";

export const consoleMasqueradeRouter = new Hono<{ Variables: AuthVariables }>()
  // Get masquerade status for current session
  .get("/admin/masquerade/status", authMiddleware, async (c) => {
    const sessionToken = c.req
      .header("cookie")
      ?.match(/session_token=([^;]+)/)?.[1];

    if (!sessionToken) {
      return c.json({ isMasquerading: false });
    }

    const status = await masqueradeService.getMasqueradeStatus(sessionToken);

    if (!status) {
      return c.json({ isMasquerading: false });
    }

    return c.json(status);
  })

  // Start masquerading as another user
  .post(
    "/admin/masquerade/start",
    authMiddleware,
    zValidator("json", masqueradeStartRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { target_user_id } = c.req.valid("json");

      try {
        const result = await masqueradeService.startMasquerade(
          user.id,
          target_user_id,
        );

        // Set the new session cookie
        setCookie(c, "session_token", result.session.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 24 * 60 * 60, // 30 days
        });

        return c.json({
          message: "전환이 시작되었습니다",
          targetUser: result.targetUser,
        });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // End masquerade and return to admin user
  .post("/admin/masquerade/end", authMiddleware, async (c) => {
    const sessionToken = c.req
      .header("cookie")
      ?.match(/session_token=([^;]+)/)?.[1];

    if (!sessionToken) {
      return c.json({ error: "세션 토큰이 없습니다" }, 401);
    }

    try {
      const result = await masqueradeService.endMasquerade(sessionToken);

      // Set the new admin session cookie
      setCookie(c, "session_token", result.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      return c.json({
        message: "전환이 종료되었습니다",
      });
    } catch (error: unknown) {
      if (error instanceof AppException) {
        return c.json({ error: error.message }, error.statusCode);
      }
      throw error;
    }
  })

  // List users available for masquerading
  .get(
    "/admin/masquerade/users",
    authMiddleware,
    zValidator("query", masqueradeUserListQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { limit, search } = c.req.valid("query");

      try {
        const users = await masqueradeService.listUsersForMasquerade(
          user.id,
          limit,
          search,
        );
        return c.json({ users });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )

  // Get masquerade audit logs (admin only)
  .get(
    "/admin/masquerade/audit-logs",
    authMiddleware,
    zValidator("query", masqueradeAuditLogQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { limit } = c.req.valid("query");

      try {
        const logs = await masqueradeService.getMasqueradeAuditLogs(
          user.id,
          limit,
        );
        return c.json({ logs });
      } catch (error: unknown) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  );
