import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("account", "routes/account.tsx"),
  route("verify-email", "routes/verify-email.tsx"),
  route("confirm-delete-account", "routes/confirm-delete-account.tsx"),
  route("applications", "routes/applications.tsx"),
  route("communities/create", "routes/communities.create.tsx"),
  route("communities/mine", "routes/communities.mine.tsx"),
  route("communities/recruiting", "routes/communities.recruiting.tsx"),
  route(
    "communities/:slug/applications/:applicationId",
    "routes/communities.$slug.applications.$applicationId.tsx",
  ),
  route(
    "communities/:slug/applications",
    "routes/communities.$slug.applications.tsx",
  ),
  route("communities/:slug/apply", "routes/communities.$slug.apply.tsx"),
  route("communities/:slug/settings", "routes/communities.$slug.settings.tsx"),
  route("communities/:slug/members", "routes/communities.$slug.members.tsx"),
  route("communities/:slug/links", "routes/communities.$slug.links.tsx"),
  route(
    "communities/:slug/analytics",
    "routes/communities.$slug.analytics.tsx",
  ),
  route("communities/:slug", "routes/communities.$slug.tsx"),
] satisfies RouteConfig;
