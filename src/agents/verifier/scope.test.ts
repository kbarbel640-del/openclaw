import { describe, expect, it } from "vitest";
import { isToolInVerifierScope } from "./scope.js";

describe("isToolInVerifierScope", () => {
  it("returns true for all tools when no scope configured", () => {
    expect(isToolInVerifierScope("exec", undefined)).toBe(true);
    expect(isToolInVerifierScope("write", undefined)).toBe(true);
  });

  it("returns true only for included tools", () => {
    const scope = { include: ["exec", "write"] };
    expect(isToolInVerifierScope("exec", scope)).toBe(true);
    expect(isToolInVerifierScope("write", scope)).toBe(true);
    expect(isToolInVerifierScope("read", scope)).toBe(false);
  });

  it("returns false for excluded tools", () => {
    const scope = { exclude: ["read", "session_status"] };
    expect(isToolInVerifierScope("exec", scope)).toBe(true);
    expect(isToolInVerifierScope("read", scope)).toBe(false);
    expect(isToolInVerifierScope("session_status", scope)).toBe(false);
  });

  it("normalizes tool names (case-insensitive)", () => {
    const scope = { include: ["Exec", "WRITE"] };
    expect(isToolInVerifierScope("exec", scope)).toBe(true);
    expect(isToolInVerifierScope("EXEC", scope)).toBe(true);
  });

  it("expands tool groups", () => {
    const scope = { include: ["group:runtime"] };
    expect(isToolInVerifierScope("exec", scope)).toBe(true);
    expect(isToolInVerifierScope("process", scope)).toBe(true);
    expect(isToolInVerifierScope("read", scope)).toBe(false);
  });
});
