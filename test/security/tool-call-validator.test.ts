import { describe, it, expect } from "vitest";
import {
  validateToolCall,
  DESTRUCTIVE_TOOLS,
  BLOCKED_BASH_PATTERNS,
} from "../../src/security/tool-call-validator.js";

describe("AF-001: Tool Call Validator", () => {
  it("blocks dangerous rm -rf command", () => {
    const result = validateToolCall({
      toolName: "bash",
      args: { command: "rm -rf /" },
      sessionId: "test-session",
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks fork bomb", () => {
    const result = validateToolCall({
      toolName: "bash",
      args: { command: ":(){:|:&};:" },
      sessionId: "test-session",
    });
    expect(result.allowed).toBe(false);
  });

  it("allows safe bash command", () => {
    const result = validateToolCall({
      toolName: "bash",
      args: { command: "ls -la /tmp" },
      sessionId: "test-session",
    });
    expect(result.allowed).toBe(true);
  });

  it("flags destructive tools for confirmation", () => {
    const result = validateToolCall({
      toolName: "sessions_spawn",
      args: { name: "test-agent" },
      sessionId: "test-session",
    });
    expect(result.requiresConfirmation).toBe(true);
  });

  it("DESTRUCTIVE_TOOLS list contains bash", () => {
    expect(DESTRUCTIVE_TOOLS).toContain("bash");
  });
});