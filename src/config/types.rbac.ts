/**
 * RBAC (Role-Based Access Control) configuration types.
 *
 * Provides flat role-based permission boundaries for enterprise deployments.
 * When enabled, restricts what actions users can perform based on their assigned role.
 */

/** Tool access control for a role. */
export type RbacToolAccess = {
  /** Tools explicitly allowed (if set, only these tools are available). */
  allow?: string[];
  /** Tools explicitly denied (takes precedence over allow). */
  deny?: string[];
};

/** Permission levels for RBAC. */
export type RbacPermission =
  | "exec" // Can execute basic commands
  | "exec.elevated" // Can execute elevated/sudo commands
  | "exec.approve" // Can approve exec requests from others
  | "admin" // Full administrative access
  | "read-only"; // Can only view, not modify

/** Definition of a single role. */
export type RbacRoleDefinition = {
  /** Human-readable role name. */
  name: string;
  /** Permissions granted to this role. */
  permissions: RbacPermission[];
  /** Tool access restrictions (optional). */
  tools?: RbacToolAccess;
  /** Allowed agent IDs this role can interact with (optional, all if not set). */
  agents?: string[];
  /** Description of this role's purpose. */
  description?: string;
};

/** RBAC configuration. */
export type RbacConfig = {
  /** Enable RBAC enforcement (default: false). */
  enabled?: boolean;
  /** Role definitions keyed by role ID. */
  roles?: Record<string, RbacRoleDefinition>;
  /** User assignments: senderId -> roleId. */
  assignments?: Record<string, string>;
  /** Default role for users not explicitly assigned (optional). */
  defaultRole?: string;
};
