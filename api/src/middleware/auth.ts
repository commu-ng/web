import { deleteCookie, getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type {
  community as communityTable,
  membership as membershipTable,
  session as sessionTable,
  user as userTable,
} from "../drizzle/schema";
import * as authService from "../services/auth.service";
import * as masqueradeService from "../services/masquerade.service";
import * as membershipService from "../services/membership.service";

type ConsoleAuthVariables = {
  user: typeof userTable.$inferSelect;
  isMasquerading?: boolean;
  originalUserId?: string;
};

type AppAuthVariables = {
  user: typeof userTable.$inferSelect;
  community?: typeof communityTable.$inferSelect;
  membership?: typeof membershipTable.$inferSelect;
  session?: typeof sessionTable.$inferSelect;
};

export const authMiddleware = createMiddleware<{
  Variables: ConsoleAuthVariables;
}>(async (c, next) => {
  let sessionToken = getCookie(c, "session_token");

  // If no cookie, try Bearer token (for mobile clients)
  if (!sessionToken) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      sessionToken = authHeader.substring(7);
    }
  }

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
  Variables: Partial<ConsoleAuthVariables>;
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
// NOTE: Now supports both app-scoped sessions and universal console sessions
// For console sessions (communityId = null), validates membership dynamically
export const appAuthMiddleware = createMiddleware<{
  Variables: AppAuthVariables;
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

  c.set("user", result.user);
  c.set("session" as never, result.session as never);

  // If this is a universal session (console session with communityId = null),
  // validate user has membership in the current community
  if (result.session.communityId === null) {
    const community = c.get("community");
    if (!community) {
      return c.json({ error: "커뮤를 찾을 수 없습니다" }, 404);
    }

    // Validate user has active membership in this community
    const membership = await membershipService.getUserMembership(
      result.user.id,
      community.id,
    );

    if (!membership) {
      return c.json({ error: "이 커뮤의 회원이 아닙니다" }, 403);
    }

    // Store membership in context for downstream handlers
    c.set("membership", membership);
  } else {
    // Community-scoped session - validate it matches current community
    // (This validation is also done in communityMiddleware, but we keep it for defense in depth)
    const community = c.get("community");
    if (community && result.session.communityId !== community.id) {
      return c.json({ error: "이 세션은 다른 커뮤를 위한 세션입니다" }, 403);
    }
  }

  await next();
});

// User-scoped app auth middleware for Bearer token authentication
// This variant allows console sessions without requiring community context
// Used for endpoints like /me/profiles that are user-scoped, not community-scoped
export const userScopedAppAuthMiddleware = createMiddleware<{
  Variables: Pick<AppAuthVariables, "user" | "session">;
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

  c.set("user", result.user);
  c.set("session" as never, result.session as never);

  // No community validation - this middleware is for user-scoped endpoints
  // that work across all communities the user has access to

  await next();
});

// Optional app auth middleware for Bearer token authentication
// NOTE: Now supports both app-scoped sessions and universal console sessions
export const optionalAppAuthMiddleware = createMiddleware<{
  Variables: Partial<AppAuthVariables>;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    const result = await authService.validateSessionAndGetUser(sessionToken);
    if (result) {
      c.set("user", result.user);
      c.set("session" as never, result.session as never);

      // If this is a universal session (console session with communityId = null),
      // validate user has membership in the current community
      if (result.session.communityId === null) {
        const community = c.get("community");
        if (community) {
          // Validate user has active membership in this community
          const membership = await membershipService.getUserMembership(
            result.user.id,
            community.id,
          );

          if (membership) {
            // Store membership in context for downstream handlers
            c.set("membership", membership);
          } else {
            // User is not a member - clear the user context for optional auth
            c.set("user", undefined as never);
            c.set("session", undefined as never);
          }
        }
      }
    }
  }

  await next();
});
