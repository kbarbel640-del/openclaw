/**
 * RBAC — Role-Based Access Control.
 *
 * Defines permissions per role and provides guards for sensitive operations.
 *
 * Role hierarchy (ascending privilege):
 *   viewer < operator < admin < super-admin
 */

import type { UserRole } from "../../shared/ipc-types.js";
import { ROLE_HIERARCHY } from "../../shared/constants.js";

// ─── Permission Definitions ─────────────────────────────────────────────────

export type Permission =
  // Dashboard / monitoring (all roles)
  | "view:dashboard"
  | "view:logs"
  | "view:sessions"
  // Environment control (operator+)
  | "env:start"
  | "env:stop"
  // Config (admin+) — ALWAYS requires re-auth
  | "config:read"
  | "config:write"
  // Skills (admin+)
  | "skills:list"
  | "skills:install"
  | "skills:approve"
  // Security (admin+)
  | "security:view"
  | "security:remediate"
  // Backup (admin+)
  | "backup:create"
  | "backup:restore"
  // User management (super-admin only)
  | "users:list"
  | "users:create"
  | "users:delete"
  | "users:modify-role"
  | "users:reset-password";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  "viewer": [
    "view:dashboard",
    "view:logs",
    "view:sessions",
    "skills:list",
  ],
  "operator": [
    "view:dashboard",
    "view:logs",
    "view:sessions",
    "env:start",
    "env:stop",
    "skills:list",
    "security:view",
  ],
  "admin": [
    "view:dashboard",
    "view:logs",
    "view:sessions",
    "env:start",
    "env:stop",
    "config:read",
    "config:write",
    "skills:list",
    "skills:install",
    "skills:approve",
    "security:view",
    "security:remediate",
    "backup:create",
    "backup:restore",
    "users:list",
  ],
  "super-admin": [
    "view:dashboard",
    "view:logs",
    "view:sessions",
    "env:start",
    "env:stop",
    "config:read",
    "config:write",
    "skills:list",
    "skills:install",
    "skills:approve",
    "security:view",
    "security:remediate",
    "backup:create",
    "backup:restore",
    "users:list",
    "users:create",
    "users:delete",
    "users:modify-role",
    "users:reset-password",
  ],
};

/**
 * Operations that ALWAYS require re-authentication (elevated session),
 * even if the user is already logged in.
 */
export const ALWAYS_REQUIRE_ELEVATE: Set<Permission> = new Set([
  "config:write",
  "skills:install",
  "skills:approve",
  "security:remediate",
  "backup:restore",
  "users:create",
  "users:delete",
  "users:modify-role",
  "users:reset-password",
]);

// ─── Guards ─────────────────────────────────────────────────────────────────

/** Check if a role has a specific permission. */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Check if role A is at least as privileged as role B. */
export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minimum] ?? 0);
}

/** Get all permissions for a role. */
export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Check if a specific operation requires an elevated (re-authenticated) session. */
export function requiresElevation(permission: Permission): boolean {
  return ALWAYS_REQUIRE_ELEVATE.has(permission);
}
