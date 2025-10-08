/**
 * Community types
 */

export interface Community {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  is_recruiting: boolean;
  recruiting_starts_at: string | null;
  recruiting_ends_at: string | null;
  minimum_birth_year: number | null;
  created_at: string;
  custom_domain: string | null;
  domain_verified: string | null;
  banner_image_url?: string | null;
  banner_image_width?: number | null;
  banner_image_height?: number | null;
  hashtags?: { id: string; tag: string }[];
  membership_status?: string | null;
  user_role: string | null;
  description?: string | null;
  owner_profile_id?: string | null;
  role?: string | null;
  has_applied?: boolean;
  application_id?: string | null;
  application_status?: string | null;
  is_member?: boolean;
  mute_new_members?: boolean;
}

export interface CommunityStats {
  community: {
    id: string;
    name: string;
    slug: string;
    owner_profile_id: string | null;
    banner_image_url?: string | null;
    banner_image_width?: number | null;
    banner_image_height?: number | null;
    hashtags?: { id: string; tag: string }[];
  };
  applications: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  members: {
    total: number;
  };
}

export interface CommunityLink {
  id: string;
  title: string;
  url: string;
  created_at: string;
  updated_at: string;
}
