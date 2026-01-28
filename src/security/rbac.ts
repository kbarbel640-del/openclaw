/**
 * RBAC (Role-Based Access Control) engine for enterprise deployments.
 *
 * Provides permission checking based on user role assignments.
 * When RBAC is disabled, all permissions are granted (backwards compatible).
 */

import type { MoltbotConfig } from "../config/types.js";
import type { RbacConfig, RbacPermission, RbacRoleDefinition } from "../config/types.rbac.js";
import { auditRbacDenied } from "./audit-log.js";

/** Result of a permission check. */
export type RbacCheckResult = {
  allowed: boolean;
  role?: string;
  reason?: string;
};

/** Built-in role definitions for when no custom roles are configured. */
const DEFAULT_ROLES: Record<string, RbacRoleDefinition> = {
  admin: {
    name: "Administrator",
    description: "Full access to all features",
    permissions: ["exec", "exec.elevated", "exec.approve", "admin"],
  },
  operator: {
    name: "Operator",
    description: "Can execute commands and approve requests",
    permissions: ["exec", "exec.approve"],
  },
  user: {
    name: "User",
    description: "Can execute basic commands",
    permissions: ["exec"],
  },
  viewer: {
    name: "Viewer",
    description: "Read-only access",
    permissions: ["read-only"],
  },
};

/**
 * Check if RBAC is enabled in the config.
 */
export function isRbacEnabled(config?: MoltbotConfig): boolean {
  return config?.rbac?.enabled === true;
}

/**
 * Validate RBAC configuration at startup.
 * Returns validation errors or null if valid.
 *
 * SECURITY: Call this during gateway startup to catch configuration
 * errors early rather than failing silently at runtime.
 */
export function validateRbacConfig(config?: MoltbotConfig): string[] | null {
  if (!isRbacEnabled(config)) {
    return null; // RBAC disabled, no validation needed
  }

  const errors: string[] = [];
  const rbacConfig = config?.rbac;

  // When RBAC is enabled, defaultRole should be configured to avoid
  // denying access to all users without explicit role assignments
  if (!rbacConfig?.defaultRole) {
    errors.push(
      "RBAC enabled but no defaultRole configured. " +
        "All users without explicit role assignments will be denied access. " +
        "Set rbac.defaultRole to a valid role (e.g., 'user' or 'viewer').",
    );
  } else {
    // Verify defaultRole references a valid role
    const roles = { ...DEFAULT_ROLES, ...rbacConfig.roles };
    if (!roles[rbacConfig.defaultRole]) {
      errors.push(
        `RBAC defaultRole '${rbacConfig.defaultRole}' does not exist. ` +
          `Available roles: ${Object.keys(roles).join(", ")}`,
      );
    }
  }

  // Validate all role assignments reference valid roles
  if (rbacConfig?.assignments) {
    const roles = { ...DEFAULT_ROLES, ...rbacConfig.roles };
    for (const [userId, roleId] of Object.entries(rbacConfig.assignments)) {
      const roleIdStr = String(roleId);
      if (roleId && !roles[roleIdStr]) {
        errors.push(
          `RBAC assignment for user '${userId}' references unknown role '${roleIdStr}'. ` +
            `Available roles: ${Object.keys(roles).join(", ")}`,
        );
      }
    }
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Get the RBAC config with defaults applied.
 */
function getRbacConfig(config?: MoltbotConfig): RbacConfig {
  return {
    enabled: false,
    roles: DEFAULT_ROLES,
    assignments: {},
    ...config?.rbac,
  };
}

/**
 * Get all role definitions (custom roles merged with defaults).
 */
function getRoles(rbacConfig: RbacConfig): Record<string, RbacRoleDefinition> {
  return {
    ...DEFAULT_ROLES,
    ...rbacConfig.roles,
  };
}

/**
 * Get the role definition for a user.
 * Returns the assigned role, default role, or undefined if no role applies.
 */
export function getRoleForUser(
  senderId: string,
  config?: MoltbotConfig,
): { roleId: string; role: RbacRoleDefinition } | null {
  const rbacConfig = getRbacConfig(config);
  const roles = getRoles(rbacConfig);

  // Check explicit assignment first
  const assignedRoleId = rbacConfig.assignments?.[senderId];
  if (assignedRoleId && roles[assignedRoleId]) {
    return { roleId: assignedRoleId, role: roles[assignedRoleId] };
  }

  // Fall back to default role
  const defaultRoleId = rbacConfig.defaultRole;
  if (defaultRoleId && roles[defaultRoleId]) {
    return { roleId: defaultRoleId, role: roles[defaultRoleId] };
  }

  return null;
}

/**
 * Check if a user has a specific permission.
 */
export function hasPermission(
  senderId: string,
  permission: RbacPermission,
  config?: MoltbotConfig,
): RbacCheckResult {
  // If RBAC is disabled, allow everything
  if (!isRbacEnabled(config)) {
    return { allowed: true, reason: "rbac-disabled" };
  }

  const userRole = getRoleForUser(senderId, config);
  if (!userRole) {
    return { allowed: false, reason: "no-role-assigned" };
  }

  const { roleId, role } = userRole;

  // Admin permission grants all other permissions
  if (role.permissions.includes("admin")) {
    return { allowed: true, role: roleId, reason: "admin-role" };
  }

  // Check for the specific permission
  if (role.permissions.includes(permission)) {
    return { allowed: true, role: roleId };
  }

  // Special case: exec.elevated requires explicit permission, but exec allows basic commands
  if (permission === "exec" && role.permissions.includes("exec.elevated")) {
    return { allowed: true, role: roleId, reason: "elevated-includes-exec" };
  }

  return { allowed: false, role: roleId, reason: "permission-denied" };
}

/**
 * Check if a user can execute a command.
 * Elevated commands (sudo, etc.) require exec.elevated permission.
 */
export function canExecuteCommand(
  senderId: string,
  command: string,
  config?: MoltbotConfig,
): RbacCheckResult {
  // If RBAC is disabled, allow everything
  if (!isRbacEnabled(config)) {
    return { allowed: true, reason: "rbac-disabled" };
  }

  const isElevated = isElevatedCommand(command);
  const requiredPermission: RbacPermission = isElevated ? "exec.elevated" : "exec";

  const result = hasPermission(senderId, requiredPermission, config);

  if (!result.allowed) {
    // Audit the denial
    auditRbacDenied({
      actor: { type: "user", id: senderId },
      action: requiredPermission,
      resource: command,
      reason: result.reason,
    });
  }

  return result;
}

/**
 * Check if a command requires elevated permissions.
 */
function isElevatedCommand(command: string): boolean {
  const trimmed = command.trim().toLowerCase();

  // Check for sudo prefix
  if (trimmed.startsWith("sudo ")) return true;

  // Check for common elevated operations
  const elevatedPatterns = [
    /^su\s/,
    /^doas\s/,
    /^pkexec\s/,
    /^runas\s/,
    /\|\s*sudo\s/,
    /;\s*sudo\s/,
    /&&\s*sudo\s/,
  ];

  return elevatedPatterns.some((pattern) => pattern.test(trimmed));
}

/**
 * Check if a user can access a specific agent.
 */
export function canAccessAgent(
  senderId: string,
  agentId: string,
  config?: MoltbotConfig,
): RbacCheckResult {
  // If RBAC is disabled, allow everything
  if (!isRbacEnabled(config)) {
    return { allowed: true, reason: "rbac-disabled" };
  }

  const userRole = getRoleForUser(senderId, config);
  if (!userRole) {
    return { allowed: false, reason: "no-role-assigned" };
  }

  const { roleId, role } = userRole;

  // Admin can access all agents
  if (role.permissions.includes("admin")) {
    return { allowed: true, role: roleId, reason: "admin-role" };
  }

  // If no agent restrictions, allow all
  if (!role.agents || role.agents.length === 0) {
    return { allowed: true, role: roleId, reason: "no-agent-restrictions" };
  }

  // Check if agent is in the allowed list
  if (role.agents.includes(agentId)) {
    return { allowed: true, role: roleId };
  }

  // Audit the denial
  auditRbacDenied({
    actor: { type: "user", id: senderId },
    action: "agent.access",
    resource: agentId,
    reason: "agent-not-allowed",
  });

  return { allowed: false, role: roleId, reason: "agent-not-allowed" };
}

/**
 * Check if a user can use a specific tool.
 *
 * NOTE: This function is implemented but not currently enforced at runtime.
 * It is fully tested and ready for use when tool-level RBAC enforcement is needed.
 *
 * TODO: Add canUseTool() enforcement to tool execution paths when required.
 * This will enable role-based tool allow/deny lists. Current enforcement points:
 * - canExecuteCommand() is enforced in runner.ts for exec commands
 * - canAccessAgent() is enforced in chat.ts for agent access
 */
export function canUseTool(
  senderId: string,
  toolName: string,
  config?: MoltbotConfig,
): RbacCheckResult {
  // If RBAC is disabled, allow everything
  if (!isRbacEnabled(config)) {
    return { allowed: true, reason: "rbac-disabled" };
  }

  const userRole = getRoleForUser(senderId, config);
  if (!userRole) {
    return { allowed: false, reason: "no-role-assigned" };
  }

  const { roleId, role } = userRole;

  // Admin can use all tools
  if (role.permissions.includes("admin")) {
    return { allowed: true, role: roleId, reason: "admin-role" };
  }

  // Read-only users cannot use tools that modify state
  if (role.permissions.includes("read-only") && !role.permissions.includes("exec")) {
    auditRbacDenied({
      actor: { type: "user", id: senderId },
      action: "tool.use",
      resource: toolName,
      reason: "read-only-role",
    });
    return { allowed: false, role: roleId, reason: "read-only-role" };
  }

  const toolAccess = role.tools;
  if (!toolAccess) {
    // No tool restrictions
    return { allowed: true, role: roleId, reason: "no-tool-restrictions" };
  }

  // Check deny list first (takes precedence)
  if (toolAccess.deny?.includes(toolName)) {
    auditRbacDenied({
      actor: { type: "user", id: senderId },
      action: "tool.use",
      resource: toolName,
      reason: "tool-denied",
    });
    return { allowed: false, role: roleId, reason: "tool-denied" };
  }

  // Check allow list (if specified)
  if (toolAccess.allow && toolAccess.allow.length > 0) {
    if (!toolAccess.allow.includes(toolName)) {
      auditRbacDenied({
        actor: { type: "user", id: senderId },
        action: "tool.use",
        resource: toolName,
        reason: "tool-not-allowed",
      });
      return { allowed: false, role: roleId, reason: "tool-not-allowed" };
    }
  }

  return { allowed: true, role: roleId };
}

/**
 * Check if a user can approve exec requests.
 */
export function canApproveExec(senderId: string, config?: MoltbotConfig): RbacCheckResult {
  return hasPermission(senderId, "exec.approve", config);
}

/**
 * Get a summary of a user's permissions for debugging/display.
 */
export function getUserPermissionSummary(
  senderId: string,
  config?: MoltbotConfig,
): {
  enabled: boolean;
  roleId?: string;
  roleName?: string;
  permissions?: RbacPermission[];
  agents?: string[];
  tools?: { allow?: string[]; deny?: string[] };
} {
  if (!isRbacEnabled(config)) {
    return { enabled: false };
  }

  const userRole = getRoleForUser(senderId, config);
  if (!userRole) {
    return { enabled: true };
  }

  const { roleId, role } = userRole;
  return {
    enabled: true,
    roleId,
    roleName: role.name,
    permissions: role.permissions,
    agents: role.agents,
    tools: role.tools,
  };
}
