import type { SigConfig } from "@disreguard/sig";
import { describe, it, expect } from "vitest";
import { checkMutationGate } from "./sig-mutation-gate.js";

const PROJECT_ROOT = "/workspace";

function makeConfig(files?: SigConfig["files"]): SigConfig {
  return {
    version: 1,
    files: files ?? {
      "soul.md": {
        mutable: true,
        authorizedIdentities: ["owner:*"],
        requireSignedSource: true,
      },
      "agents.md": {
        mutable: true,
        authorizedIdentities: ["owner:*"],
        requireSignedSource: true,
      },
      "llm/prompts/*.txt": {
        mutable: false,
      },
    },
  };
}

describe("sig-mutation-gate", () => {
  it("passes non-write tools through", () => {
    const config = makeConfig();
    for (const tool of ["exec", "read", "message", "gateway", "sessions_spawn"]) {
      const result = checkMutationGate(tool, { path: "soul.md" }, PROJECT_ROOT, config);
      expect(result.blocked, `${tool} should not be blocked`).toBe(false);
    }
  });

  it("passes write to non-protected file", () => {
    const config = makeConfig();
    const result = checkMutationGate("write", { path: "README.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(false);
  });

  it("blocks write to protected mutable file", () => {
    const config = makeConfig();
    const result = checkMutationGate("write", { path: "soul.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("soul.md");
      expect(result.reason).toContain("update_and_sign");
      expect(result.reason).toContain("signed_message");
    }
  });

  it("blocks edit to protected mutable file", () => {
    const config = makeConfig();
    const result = checkMutationGate("edit", { path: "agents.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("agents.md");
      expect(result.reason).toContain("update_and_sign");
    }
  });

  it("passes apply_patch through (excluded from mutation gate)", () => {
    const config = makeConfig();
    const result = checkMutationGate(
      "apply_patch",
      { input: "*** Update File: soul.md\n..." },
      PROJECT_ROOT,
      config,
    );
    expect(result.blocked).toBe(false);
  });

  it("passes write to immutable policy file (integrity handled by verify)", () => {
    const config = makeConfig();
    const result = checkMutationGate(
      "write",
      { path: "llm/prompts/identity.txt" },
      PROJECT_ROOT,
      config,
    );
    expect(result.blocked).toBe(false);
  });

  it("passes when no file policy exists", () => {
    const config = makeConfig({});
    const result = checkMutationGate("write", { path: "soul.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(false);
  });

  it("handles file_path param alias", () => {
    const config = makeConfig();
    const result = checkMutationGate("write", { file_path: "soul.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(true);
  });

  it("passes when sigConfig is null", () => {
    const result = checkMutationGate("write", { path: "soul.md" }, PROJECT_ROOT, null);
    expect(result.blocked).toBe(false);
  });

  it("passes when projectRoot is undefined", () => {
    const config = makeConfig();
    const result = checkMutationGate("write", { path: "soul.md" }, undefined, config);
    expect(result.blocked).toBe(false);
  });

  it("does not include signed source note when requireSignedSource is false", () => {
    const config = makeConfig({
      "notes.md": { mutable: true, requireSignedSource: false },
    });
    const result = checkMutationGate("write", { path: "notes.md" }, PROJECT_ROOT, config);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("update_and_sign");
      expect(result.reason).not.toContain("signed_message");
    }
  });
});
