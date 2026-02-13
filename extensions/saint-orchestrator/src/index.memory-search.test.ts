import { describe, expect, it } from "vitest";
import { __testing } from "../index.js";

describe("resolveMemoryReadPatterns (memory_search / memory_get scope)", () => {
  it("returns empty when memory_scope is undefined", () => {
    expect(__testing.resolveMemoryReadPatterns(undefined, "alice")).toEqual([]);
  });

  it("returns empty when memory_scope is empty array", () => {
    expect(__testing.resolveMemoryReadPatterns([], "alice")).toEqual([]);
  });

  it("returns shared patterns for 'shared' scope", () => {
    const patterns = __testing.resolveMemoryReadPatterns(["shared"], "alice");
    expect(patterns).toContain("memory/shared/*");
    expect(patterns).toContain("MEMORY.md");
  });

  it("returns user-scoped patterns for 'own_user'", () => {
    const patterns = __testing.resolveMemoryReadPatterns(["own_user"], "alice");
    expect(patterns).toContain("memory/users/alice/*");
  });

  it("returns all-users pattern for 'all_users'", () => {
    const patterns = __testing.resolveMemoryReadPatterns(["all_users"], "alice");
    expect(patterns).toContain("memory/users/*/*");
  });

  it("returns private patterns for 'private' scope", () => {
    const patterns = __testing.resolveMemoryReadPatterns(["private"], "alice");
    expect(patterns).toContain("memory/private/*");
  });

  it("returns daily patterns for 'daily' scope", () => {
    const patterns = __testing.resolveMemoryReadPatterns(["daily"], "alice");
    expect(patterns).toContain("memory/daily/*");
  });

  it("returns empty for 'own_user' with empty slug", () => {
    const patterns = __testing.resolveMemoryReadPatterns(["own_user"], "");
    // own_user requires a slug; without one, no pattern is added
    expect(patterns).toEqual([]);
  });

  it("combines multiple scopes", () => {
    const patterns = __testing.resolveMemoryReadPatterns(["shared", "own_user"], "bob");
    expect(patterns).toContain("memory/shared/*");
    expect(patterns).toContain("MEMORY.md");
    expect(patterns).toContain("memory/users/bob/*");
  });
});

describe("memory_search empty scope blocks (Fix #4 integration)", () => {
  // The before_tool_call handler calls resolveMemoryReadPatterns and blocks when
  // allowed.length === 0. We verify this policy by testing the function directly
  // since it's the gating logic.
  it("empty memory_scope → resolveMemoryReadPatterns returns [] → search should be blocked", () => {
    const allowed = __testing.resolveMemoryReadPatterns([], "external-user");
    expect(allowed).toHaveLength(0);
    // The handler code: if (allowed.length > 0) { inject pathFilter } else { block }
    // This means an empty result triggers the block branch.
  });

  it("undefined memory_scope → resolveMemoryReadPatterns returns [] → search should be blocked", () => {
    const allowed = __testing.resolveMemoryReadPatterns(undefined, "external-user");
    expect(allowed).toHaveLength(0);
  });

  it("valid memory_scope → resolveMemoryReadPatterns returns patterns → search should inject pathFilter", () => {
    const allowed = __testing.resolveMemoryReadPatterns(["shared"], "external-user");
    expect(allowed.length).toBeGreaterThan(0);
    // The handler code injects these as pathFilter into the params.
  });
});
