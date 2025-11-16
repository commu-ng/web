import { URL } from "node:url";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { env } from "../config/env";
import { AppException } from "../exception";
import { optionalAuthMiddleware } from "../middleware/auth";
import { ssoQuerySchema, tokenExchangeSchema } from "../schemas";
import * as authService from "../services/auth.service";

export const auth = new Hono()
  .post("/logout", async (c) => {
    // Accept session token from either cookie (web) or Authorization header (mobile)
    let sessionToken = getCookie(c, "session_token");

    // If no cookie, try Bearer token
    if (!sessionToken) {
      const authHeader = c.req.header("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        sessionToken = authHeader.substring(7);
      }
    }

    if (!sessionToken) {
      return c.json({ error: "세션 토큰이 필요합니다" }, 400);
    }

    await authService.logoutUser(sessionToken);

    // Clear cookie if it exists
    deleteCookie(c, "session_token");

    return c.json({ message: "성공적으로 로그아웃되었습니다" });
  })
  .get(
    "/sso",
    optionalAuthMiddleware,
    zValidator("query", ssoQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { return_to: returnTo } = c.req.valid("query");

      // If user is not authenticated, redirect to console frontend login
      if (!user) {
        const currentUrl = new URL(c.req.url);
        const consoleUrl = `https://${env.consoleDomain}`;
        const loginUrl = `${consoleUrl}/login?next=${encodeURIComponent(
          currentUrl.toString(),
        )}`;
        return c.redirect(loginUrl, 302);
      }

      try {
        // Get targetDomain from returnTo
        const mainDomain = env.consoleDomain;
        const returnToUrl = new URL(returnTo);
        const targetDomain = returnToUrl.hostname;

        // Verify the community exists for this domain
        await authService.findCommunityByDomain(targetDomain, mainDomain);

        // Create exchange token
        const exchangeToken = await authService.createExchangeToken(
          user.id,
          targetDomain,
        );

        // Extract the path from returnTo to pass to callback
        const returnPath =
          returnToUrl.pathname + returnToUrl.search + returnToUrl.hash;

        // Redirect to target domain with token and return path
        const redirectUrl = `https://${targetDomain}/auth/callback?token=${exchangeToken.token}&return_path=${encodeURIComponent(returnPath)}`;
        return c.redirect(redirectUrl, 302);
      } catch (error) {
        if (error instanceof AppException) {
          return c.json({ error: error.message }, error.statusCode);
        }
        throw error;
      }
    },
  )
  .post("/callback", zValidator("json", tokenExchangeSchema), async (c) => {
    const { token, domain } = c.req.valid("json");

    try {
      const session = await authService.exchangeTokenForSession(token, domain);
      return c.json({ message: "SSO 성공", session_token: session.token });
    } catch (error) {
      if (error instanceof AppException) {
        return c.json({ error: error.message }, error.statusCode);
      }
      throw error;
    }
  });
