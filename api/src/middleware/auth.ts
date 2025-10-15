import { deleteCookie, getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type {
  session as sessionTable,
  user as userTable,
} from "../drizzle/schema";
import * as authService from "../services/auth.service";
import * as masqueradeService from "../services/masquerade.service";

type AuthVariables = {
  user: typeof userTable.$inferSelect;
  isMasquerading?: boolean;
  originalUserId?: string;
};

export const authMiddleware = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const sessionToken = getCookie(c, "session_token");

  if (!sessionToken) {
    return c.json({ error: "인증되지 않음" }, 401);
  }

  const result = await authService.validateSessionAndGetUser(sessionToken);

  if (!result) {
    deleteCookie(c, "session_token");
    return c.json({ error: "잘못된 세션" }, 401);
  }

  // Console routes require console-only sessions (communityId must be null)
  if (result.session.communityId !== null) {
    return c.json({ error: "이 세션은 앱 전용입니다" }, 403);
  }

  c.set("user", result.user);

  // Check if this is a masquerade session and add context
  if (masqueradeService.isMasqueradeSession(result.session)) {
    c.set("isMasquerading", true);
    c.set("originalUserId", result.session.originalUserId || undefined);
  }

  await next();
});

export const optionalAuthMiddleware = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const sessionToken = getCookie(c, "session_token");

  if (sessionToken) {
    const result = await authService.validateSessionAndGetUser(sessionToken);
    if (result) {
      // Optional auth for console routes - only accept console sessions
      if (result.session.communityId === null) {
        c.set("user", result.user);
      }
    }
  }

  await next();
});

// Basic App Auth middleware for Bearer token authentication (used by mobile/SPA clients)
// NOTE: Validates that session is app-scoped (not console-only)
export const appAuthMiddleware = createMiddleware<{
  Variables: AuthVariables & { session?: typeof sessionTable.$inferSelect };
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "인증되지 않음" }, 401);
  }

  const sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  const result = await authService.validateSessionAndGetUser(sessionToken);

  if (!result) {
    return c.json({ error: "잘못된 세션" }, 401);
  }

  // App routes require community-scoped sessions (communityId must NOT be null)
  if (result.session.communityId === null) {
    return c.json({ error: "콘솔 세션은 앱에서 사용할 수 없습니다" }, 403);
  }

  c.set("user", result.user);
  c.set("session" as never, result.session as never);
  await next();
});

// Optional app auth middleware for Bearer token authentication
export const optionalAppAuthMiddleware = createMiddleware<{
  Variables: AuthVariables & { session?: typeof sessionTable.$inferSelect };
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    const result = await authService.validateSessionAndGetUser(sessionToken);
    if (result) {
      // Only set user if session is community-scoped (not console-only)
      if (result.session.communityId !== null) {
        c.set("user", result.user);
        c.set("session" as never, result.session as never);
      }
    }
  }

  await next();
});
