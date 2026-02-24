/**
 * RBAC — unit tests for role-based access control.
 *
 * Validates permission checks across all 4 roles, elevation requirements,
 * and role hierarchy comparisons.
 */

import { describe, it, expect } from "vitest";
import {
  hasPermission,
  roleAtLeast,
  getPermissions,
  requiresElevation,
  type Permission,
} from "../../src/main/auth/rbac.js";
import type { UserRole } from "../../src/shared/ipc-types.js";

// ─── hasPermission() ─────────────────────────────────────────────────────

describe("hasPermission()", () => {
  it("viewer can view dashboard, logs, and sessions", () => {
    expect(hasPermission("viewer", "view:dashboard")).toBe(true);
    expect(hasPermission("viewer", "view:logs")).toBe(true);
    expect(hasPermission("viewer", "view:sessions")).toBe(true);
  });

  it("viewer cannot start/stop environments", () => {
    expect(hasPermission("viewer", "env:start")).toBe(false);
    expect(hasPermission("viewer", "env:stop")).toBe(false);
  });

  it("viewer cannot manage users or config", () => {
    expect(hasPermission("viewer", "users:list")).toBe(false);
    expect(hasPermission("viewer", "users:create")).toBe(false);
    expect(hasPermission("viewer", "config:write")).toBe(false);
  });

  it("operator can start/stop environments", () => {
    expect(hasPermission("operator", "env:start")).toBe(true);
    expect(hasPermission("operator", "env:stop")).toBe(true);
  });

  it("operator cannot modify config or manage users", () => {
    expect(hasPermission("operator", "config:write")).toBe(false);
    expect(hasPermission("operator", "users:create")).toBe(false);
  });

  it("admin can read/write config and list users", () => {
    expect(hasPermission("admin", "config:read")).toBe(true);
    expect(hasPermission("admin", "config:write")).toBe(true);
    expect(hasPermission("admin", "users:list")).toBe(true);
  });

  it("admin cannot create/delete users or modify roles", () => {
    expect(hasPermission("admin", "users:create")).toBe(false);
    expect(hasPermission("admin", "users:delete")).toBe(false);
    expect(hasPermission("admin", "users:modify-role")).toBe(false);
  });

  it("super-admin has all permissions", () => {
    const allPerms: Permission[] = [
      "view:dashboard", "view:logs", "view:sessions",
      "env:start", "env:stop",
      "config:read", "config:write",
      "skills:list", "skills:install", "skills:approve",
      "security:view", "security:remediate",
      "backup:create", "backup:restore",
      "users:list", "users:create", "users:delete", "users:modify-role",
    ];
    for (const perm of allPerms) {
      expect(hasPermission("super-admin", perm)).toBe(true);
    }
  });
});

// ─── roleAtLeast() ───────────────────────────────────────────────────────

describe("roleAtLeast()", () => {
  it("super-admin is at least every role", () => {
    const roles: UserRole[] = ["viewer", "operator", "admin", "super-admin"];
    for (const r of roles) {
      expect(roleAtLeast("super-admin", r)).toBe(true);
    }
  });

  it("viewer is not at least operator", () => {
    expect(roleAtLeast("viewer", "operator")).toBe(false);
  });

  it("admin is at least operator but not super-admin", () => {
    expect(roleAtLeast("admin", "operator")).toBe(true);
    expect(roleAtLeast("admin", "super-admin")).toBe(false);
  });
});

// ─── getPermissions() ────────────────────────────────────────────────────

describe("getPermissions()", () => {
  it("returns non-empty array for all valid roles", () => {
    const roles: UserRole[] = ["viewer", "operator", "admin", "super-admin"];
    for (const r of roles) {
      expect(getPermissions(r).length).toBeGreaterThan(0);
    }
  });

  it("super-admin has more permissions than admin", () => {
    expect(getPermissions("super-admin").length).toBeGreaterThan(getPermissions("admin").length);
  });
});

// ─── requiresElevation() ─────────────────────────────────────────────────

describe("requiresElevation()", () => {
  it("config:write requires elevation", () => {
    expect(requiresElevation("config:write")).toBe(true);
  });

  it("users:create requires elevation", () => {
    expect(requiresElevation("users:create")).toBe(true);
  });

  it("view:dashboard does NOT require elevation", () => {
    expect(requiresElevation("view:dashboard")).toBe(false);
  });

  it("env:start does NOT require elevation", () => {
    expect(requiresElevation("env:start")).toBe(false);
  });
});
