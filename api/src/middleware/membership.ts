import { createMiddleware } from "hono/factory";
import * as membershipService from "../services/membership.service";
import type { AuthVariables } from "../types";

/**
 * Middleware to validate that the authenticated user has an active membership in the community
 * Must be used after authMiddleware and communityMiddleware
 */
export const membershipMiddleware = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  // Get user and community from context (set by previous middleware)
  const user = c.get("user");
  const community = c.get("community");

  if (!user) {
    return c.json({ error: "인증되지 않음" }, 401);
  }

  if (!community) {
    return c.json({ error: "커뮤를 찾을 수 없습니다" }, 404);
  }

  // Check if user has an active membership in this community
  const membership = await membershipService.getUserMembership(
    user.id,
    community.id,
  );

  if (!membership) {
    return c.json({ error: "이 커뮤의 회원이 아닙니다" }, 403);
  }

  // Store membership in context for downstream handlers
  c.set("membership", membership);
  await next();
});

/**
 * Middleware to validate that the authenticated user is a community owner
 * Must be used after membershipMiddleware
 */
export const ownerOnlyMiddleware = createMiddleware(async (c, next) => {
  const membership = c.get("membership");

  if (!membership) {
    return c.json({ error: "멤버십을 찾을 수 없습니다" }, 403);
  }

  if (membership.role !== "owner") {
    return c.json({ error: "커뮤 소유자만 접근할 수 있습니다" }, 403);
  }

  await next();
});

/**
 * Middleware to validate that the authenticated user is a moderator or owner
 * Must be used after membershipMiddleware
 */
export const moderatorOrOwnerMiddleware = createMiddleware(async (c, next) => {
  const membership = c.get("membership");

  if (!membership) {
    return c.json({ error: "멤버십을 찾을 수 없습니다" }, 403);
  }

  if (membership.role !== "owner" && membership.role !== "moderator") {
    return c.json(
      { error: "모더레이터 또는 소유자만 접근할 수 있습니다" },
      403,
    );
  }

  await next();
});
