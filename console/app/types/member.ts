/**
 * Member types
 */

import type { Role } from "~/components/shared/RoleBadge";

export interface CommunityMember {
  id: string;
  role: Role;
  active: boolean;
  created_at: string;
  is_current_user: boolean;
  user_group?: string; // Random UUID for grouping users with multiple profiles
  profiles: Array<{
    id: string;
    name: string;
    username: string;
    bio: string | null;
    primary: boolean;
    activated: boolean;
    muted_at: string | null;
    muted_by_id: string | null;
  }>;
  application: {
    id: string;
    profile_name: string;
    profile_username: string;
    message: string | null;
    status: string;
    created_at: string;
  } | null;
}
