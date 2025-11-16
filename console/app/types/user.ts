/**
 * User types
 */

export interface User {
  id: string;
  login_name: string | null;
  email?: string | null;
  created_at: string;
  is_admin: boolean;
  instances?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

export interface CurrentUser extends User {
  // Can add additional fields specific to current logged-in user
}
