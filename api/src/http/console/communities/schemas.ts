import { z } from "zod";

export const communityLinkCreateSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
  url: z.url("Must be a valid URL"),
});

export const communityLinkUpdateSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
  url: z.url("Must be a valid URL"),
});

export const paginationQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const memberRoleUpdateSchema = z.object({
  membership_id: z.uuid(),
  role: z.enum(["owner", "moderator", "member"]),
});

export const communityBannerImageParamSchema = z.object({
  id: z.string().min(1),
  bannerImageId: z.uuid(),
});

export const communityLinkParamSchema = z.object({
  id: z.string().min(1),
  linkId: z.uuid(),
});

export const communityMemberParamSchema = z.object({
  id: z.string().min(1),
  membership_id: z.uuid(),
});

export const communityIdParamSchema = z.object({
  id: z.string().min(1),
});

export const applicationIdParamSchema = z.object({
  application_id: z.uuid(),
});

export const communityApplicationParamSchema = z.object({
  id: z.string().min(1),
  application_id: z.uuid(),
});

export const communityApplicationSchema = z.object({
  message: z.string().nullable().optional(),
  profile_name: z.string().min(1, "Profile name cannot be empty"),
  profile_username: z.string().min(1, "Profile username cannot be empty"),
  attachment_ids: z.array(z.uuid()).optional(),
});

export const applicationReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejection_reason: z.string().optional(),
});
