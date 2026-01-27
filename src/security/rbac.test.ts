import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { ClawdbotConfig } from "../config/types.js";
import {
  isRbacEnabled,
  getRoleForUser,
  hasPermission,
  canExecuteCommand,
  canAccessAgent,
  canUseTool,
  canApproveExec,
  getUserPermissionSummary,
} from "./rbac.js";
import { initAuditLog, stopAuditLog } from "./audit-log.js";

describe("rbac", () => {
  beforeEach(() => {
    // Initialize audit log in disabled mode to prevent file writes during tests
    initAuditLog({ enabled: false });
  });

  afterEach(() => {
    stopAuditLog();
  });

  describe("isRbacEnabled", () => {
    it("returns false when config is undefined", () => {
      expect(isRbacEnabled()).toBe(false);
    });

    it("returns false when rbac is not configured", () => {
      expect(isRbacEnabled({})).toBe(false);
    });

    it("returns false when rbac.enabled is false", () => {
      expect(isRbacEnabled({ rbac: { enabled: false } })).toBe(false);
    });

    it("returns true when rbac.enabled is true", () => {
      expect(isRbacEnabled({ rbac: { enabled: true } })).toBe(true);
    });
  });

  describe("getRoleForUser", () => {
    it("returns null when RBAC is disabled", () => {
      const config: ClawdbotConfig = { rbac: { enabled: false } };
      expect(getRoleForUser("user-1", config)).toBeNull();
    });

    it("returns assigned role when user is assigned", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "admin" },
        },
      };
      const result = getRoleForUser("user-1", config);
      expect(result?.roleId).toBe("admin");
      expect(result?.role.name).toBe("Administrator");
    });

    it("returns default role when user is not assigned", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          defaultRole: "viewer",
        },
      };
      const result = getRoleForUser("user-1", config);
      expect(result?.roleId).toBe("viewer");
    });

    it("returns null when no assignment and no default role", () => {
      const config: ClawdbotConfig = {
        rbac: { enabled: true },
      };
      expect(getRoleForUser("user-1", config)).toBeNull();
    });

    it("uses custom role definitions", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          roles: {
            custom: {
              name: "Custom Role",
              permissions: ["exec"],
            },
          },
          assignments: { "user-1": "custom" },
        },
      };
      const result = getRoleForUser("user-1", config);
      expect(result?.roleId).toBe("custom");
      expect(result?.role.name).toBe("Custom Role");
    });
  });

  describe("hasPermission", () => {
    it("allows everything when RBAC is disabled", () => {
      const config: ClawdbotConfig = { rbac: { enabled: false } };
      const result = hasPermission("user-1", "exec.elevated", config);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("rbac-disabled");
    });

    it("denies when user has no role", () => {
      const config: ClawdbotConfig = { rbac: { enabled: true } };
      const result = hasPermission("user-1", "exec", config);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("no-role-assigned");
    });

    it("allows when user has the permission", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "user" },
        },
      };
      const result = hasPermission("user-1", "exec", config);
      expect(result.allowed).toBe(true);
      expect(result.role).toBe("user");
    });

    it("denies when user lacks the permission", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "user" },
        },
      };
      const result = hasPermission("user-1", "exec.elevated", config);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("permission-denied");
    });

    it("admin role grants all permissions", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "admin" },
        },
      };
      expect(hasPermission("user-1", "exec", config).allowed).toBe(true);
      expect(hasPermission("user-1", "exec.elevated", config).allowed).toBe(true);
      expect(hasPermission("user-1", "exec.approve", config).allowed).toBe(true);
      expect(hasPermission("user-1", "admin", config).allowed).toBe(true);
    });
  });

  describe("canExecuteCommand", () => {
    it("allows basic commands with exec permission", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "user" },
        },
      };
      const result = canExecuteCommand("user-1", "ls -la", config);
      expect(result.allowed).toBe(true);
    });

    it("denies elevated commands without exec.elevated permission", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "user" },
        },
      };
      const result = canExecuteCommand("user-1", "sudo rm -rf /tmp/test", config);
      expect(result.allowed).toBe(false);
    });

    it("allows elevated commands with exec.elevated permission", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "admin" },
        },
      };
      const result = canExecuteCommand("user-1", "sudo apt update", config);
      expect(result.allowed).toBe(true);
    });

    it("detects sudo in various positions", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "user" },
        },
      };
      expect(canExecuteCommand("user-1", "echo test | sudo tee /etc/file", config).allowed).toBe(
        false,
      );
      expect(canExecuteCommand("user-1", "cd /tmp && sudo rm -rf *", config).allowed).toBe(false);
    });
  });

  describe("canAccessAgent", () => {
    it("allows all agents when no restrictions", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "user" },
        },
      };
      const result = canAccessAgent("user-1", "any-agent", config);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("no-agent-restrictions");
    });

    it("denies access to restricted agents", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          roles: {
            restricted: {
              name: "Restricted",
              permissions: ["exec"],
              agents: ["agent-a", "agent-b"],
            },
          },
          assignments: { "user-1": "restricted" },
        },
      };
      expect(canAccessAgent("user-1", "agent-a", config).allowed).toBe(true);
      expect(canAccessAgent("user-1", "agent-c", config).allowed).toBe(false);
    });

    it("admin bypasses agent restrictions", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "admin" },
        },
      };
      const result = canAccessAgent("user-1", "any-agent", config);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("admin-role");
    });
  });

  describe("canUseTool", () => {
    it("allows all tools when no restrictions", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "user" },
        },
      };
      const result = canUseTool("user-1", "any-tool", config);
      expect(result.allowed).toBe(true);
    });

    it("denies tools on deny list", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          roles: {
            limited: {
              name: "Limited",
              permissions: ["exec"],
              tools: { deny: ["dangerous-tool"] },
            },
          },
          assignments: { "user-1": "limited" },
        },
      };
      expect(canUseTool("user-1", "safe-tool", config).allowed).toBe(true);
      expect(canUseTool("user-1", "dangerous-tool", config).allowed).toBe(false);
    });

    it("only allows tools on allow list when specified", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          roles: {
            limited: {
              name: "Limited",
              permissions: ["exec"],
              tools: { allow: ["read", "search"] },
            },
          },
          assignments: { "user-1": "limited" },
        },
      };
      expect(canUseTool("user-1", "read", config).allowed).toBe(true);
      expect(canUseTool("user-1", "write", config).allowed).toBe(false);
    });

    it("deny takes precedence over allow", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          roles: {
            mixed: {
              name: "Mixed",
              permissions: ["exec"],
              tools: { allow: ["tool-a", "tool-b"], deny: ["tool-b"] },
            },
          },
          assignments: { "user-1": "mixed" },
        },
      };
      expect(canUseTool("user-1", "tool-a", config).allowed).toBe(true);
      expect(canUseTool("user-1", "tool-b", config).allowed).toBe(false);
    });

    it("read-only role cannot use tools", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "viewer" },
        },
      };
      const result = canUseTool("user-1", "any-tool", config);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("read-only-role");
    });
  });

  describe("canApproveExec", () => {
    it("allows with exec.approve permission", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "operator" },
        },
      };
      const result = canApproveExec("user-1", config);
      expect(result.allowed).toBe(true);
    });

    it("denies without exec.approve permission", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "user" },
        },
      };
      const result = canApproveExec("user-1", config);
      expect(result.allowed).toBe(false);
    });
  });

  describe("getUserPermissionSummary", () => {
    it("returns disabled when RBAC is off", () => {
      const config: ClawdbotConfig = { rbac: { enabled: false } };
      const summary = getUserPermissionSummary("user-1", config);
      expect(summary.enabled).toBe(false);
      expect(summary.roleId).toBeUndefined();
    });

    it("returns role details when RBAC is on", () => {
      const config: ClawdbotConfig = {
        rbac: {
          enabled: true,
          assignments: { "user-1": "admin" },
        },
      };
      const summary = getUserPermissionSummary("user-1", config);
      expect(summary.enabled).toBe(true);
      expect(summary.roleId).toBe("admin");
      expect(summary.roleName).toBe("Administrator");
      expect(summary.permissions).toContain("admin");
    });

    it("returns enabled with no role when user unassigned", () => {
      const config: ClawdbotConfig = { rbac: { enabled: true } };
      const summary = getUserPermissionSummary("user-1", config);
      expect(summary.enabled).toBe(true);
      expect(summary.roleId).toBeUndefined();
    });
  });
});
