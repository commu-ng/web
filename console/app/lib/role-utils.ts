import type { Role } from "~/components/shared/RoleBadge";

/**
 * Role hierarchy for permission checks
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 3,
  moderator: 2,
  member: 1,
};

/**
 * Check if a user can modify another member's role
 * @param currentUserRole - The role of the user performing the action
 * @param targetMemberRole - The role of the member being modified
 * @returns true if the action is allowed
 */
export function canModifyMember(
  currentUserRole: Role,
  targetMemberRole: Role,
): boolean {
  // Owners can modify anyone except other owners
  if (currentUserRole === "owner") {
    return targetMemberRole !== "owner";
  }

  // Moderators can only modify members
  if (currentUserRole === "moderator") {
    return targetMemberRole === "member";
  }

  // Members cannot modify anyone
  return false;
}

/**
 * Check if a user can update a member's role to a specific target role
 * @param currentUserRole - The role of the user performing the action
 * @param newRole - The new role to assign
 * @returns true if the action is allowed
 */
export function canAssignRole(currentUserRole: Role, newRole: Role): boolean {
  // Only owners can assign owner role
  if (newRole === "owner") {
    return currentUserRole === "owner";
  }

  // Owners and moderators can assign moderator and member roles
  if (newRole === "moderator" || newRole === "member") {
    return currentUserRole === "owner" || currentUserRole === "moderator";
  }

  return false;
}

/**
 * Check if a user can remove a member from the community
 * @param currentUserRole - The role of the user performing the action
 * @param targetMemberRole - The role of the member being removed
 * @returns true if the action is allowed
 */
export function canRemoveMember(
  currentUserRole: Role,
  targetMemberRole: Role,
): boolean {
  // Same logic as canModifyMember
  return canModifyMember(currentUserRole, targetMemberRole);
}

/**
 * Check if a role has higher or equal permission level than another
 * @param role1 - First role
 * @param role2 - Second role
 * @returns true if role1 has higher or equal permission
 */
export function hasHigherOrEqualPermission(role1: Role, role2: Role): boolean {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
}

/**
 * Check if a role has permission to manage applications
 * @param role - Role to check
 * @returns true if the role can manage applications
 */
export function canManageApplications(role: Role): boolean {
  return role === "owner" || role === "moderator";
}

/**
 * Check if a role has permission to modify community settings
 * @param role - Role to check
 * @returns true if the role can modify settings
 */
export function canModifySettings(role: Role): boolean {
  return role === "owner";
}

/**
 * Check if a role has permission to view community stats
 * @param role - Role to check
 * @returns true if the role can view stats
 */
export function canViewStats(role: Role): boolean {
  return role === "owner" || role === "moderator";
}
