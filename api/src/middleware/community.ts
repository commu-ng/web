import { URL } from "node:url"; // Node.js URL module
import { createMiddleware } from "hono/factory";
import { env } from "../config/env";
import type { community as communityTable } from "../drizzle/schema";
import * as communityService from "../services/community.service";

type CommunityVariables = {
  community: typeof communityTable.$inferSelect;
};

const MAIN_DOMAIN = env.consoleDomain;

export const communityMiddleware = createMiddleware<{
  Variables: CommunityVariables;
}>(async (c, next) => {
  let hostname: string | undefined;

  const origin = c.req.header("origin");
  if (origin) {
    try {
      const parsedUrl = new URL(origin);
      hostname = parsedUrl.hostname;
    } catch (_error) {
      return c.json({ error: "잘못된 origin 헤더" }, 400);
    }
  } else {
    hostname = c.req.header("host")?.split(":")[0]; // Get hostname without port
  }

  if (!hostname) {
    return c.json({ error: "호스트명을 결정할 수 없습니다" }, 400);
  }

  let community: Awaited<
    ReturnType<typeof communityService.getCommunityByCustomDomain>
  >;

  // First check if it's a custom domain
  community = await communityService.getCommunityByCustomDomain(hostname);

  if (community) {
    c.set("community", community);
    await next();
    return;
  }

  // Otherwise, extract subdomain
  const domainSuffix = `.${MAIN_DOMAIN}`;

  if (hostname.endsWith(domainSuffix)) {
    const slug = hostname.replace(domainSuffix, "");
    community = await communityService.getCommunityBySlug(slug);
  } else if (hostname === MAIN_DOMAIN) {
    return c.json({ error: "메인 도메인에 대한 커뮤가 없습니다" }, 404);
  } else {
    return c.json({ error: "잘못된 도메인" }, 400);
  }

  if (!community) {
    return c.json({ error: "커뮤를 찾을 수 없습니다" }, 404);
  }

  c.set("community", community);

  // If this is an app route with a session, validate the session is scoped to this community
  const session = c.get("session" as never) as
    | { communityId: string | null }
    | undefined;
  if (session && session.communityId !== null) {
    if (session.communityId !== community.id) {
      return c.json({ error: "이 세션은 다른 커뮤를 위한 세션입니다" }, 403);
    }
  }

  await next();
});
