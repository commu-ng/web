import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { authMiddleware } from "../../middleware/auth";
import {
  masqueradeAuditLogQuerySchema,
  masqueradeStartRequestSchema,
  masqueradeUserListQuerySchema,
} from "../../schemas";
import * as masqueradeService from "../../services/masquerade.service";
import type { AuthVariables } from "../../types";
import { GeneralErrorCode } from "../../types/api-responses";

export const consoleMasqueradeRouter = new Hono<{ Variables: AuthVariables }>()
  // Get masquerade status for current session
  .get("/admin/masquerade/status", authMiddleware, async (c) => {
    const sessionToken = c.req
      .header("cookie")
      ?.match(/session_token=([^;]+)/)?.[1];

    if (!sessionToken) {
      return c.json({ data: { isMasquerading: false } });
    }

    const status = await masqueradeService.getMasqueradeStatus(sessionToken);

    if (!status) {
      return c.json({ data: { isMasquerading: false } });
    }

    return c.json({ data: status });
  })

  // Start masquerading as another user
  .post(
    "/admin/masquerade/start",
    authMiddleware,
    zValidator("json", masqueradeStartRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { target_user_id } = c.req.valid("json");

      const result = await masqueradeService.startMasquerade(
        user.id,
        target_user_id,
      );

      if (!result.session) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.SESSION_CREATION_FAILED,
              message: "세션 생성에 실패했습니다",
            },
          },
          500,
        );
      }

      // Set the new session cookie
      setCookie(c, "session_token", result.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      return c.json({
        data: {
          started: true,
          target_user: result.targetUser,
          started_at: new Date().toISOString(),
        },
      });
    },
  )

  // End masquerade and return to admin user
  .post("/admin/masquerade/end", authMiddleware, async (c) => {
    const sessionToken = c.req
      .header("cookie")
      ?.match(/session_token=([^;]+)/)?.[1];

    if (!sessionToken) {
      return c.json(
        {
          error: {
            code: GeneralErrorCode.SESSION_REQUIRED,
            message: "세션 토큰이 없습니다",
          },
        },
        401,
      );
    }

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
      data: {
        ended: true,
        ended_at: new Date().toISOString(),
      },
    });
  })

  // List users available for masquerading
  .get(
    "/admin/masquerade/users",
    authMiddleware,
    zValidator("query", masqueradeUserListQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { limit, search } = c.req.valid("query");

      const users = await masqueradeService.listUsersForMasquerade(
        user.id,
        limit,
        search,
      );
      return c.json({ data: { users } });
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

      const logs = await masqueradeService.getMasqueradeAuditLogs(
        user.id,
        limit,
      );
      return c.json({ data: { logs } });
    },
  );
