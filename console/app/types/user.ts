/**
 * User types
 */

export interface User {
  id: string;
  loginName: string | null;
  email?: string | null;
  createdAt: string;
  admin: boolean;
  instances?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

export interface CurrentUser extends User {
  // Can add additional fields specific to current logged-in user
}
