import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildCommandPrompt } from "./executor.js";
import {
  parseCommandDefinition,
  loadCommandDefinitionsFromDir,
  loadCommandDefinitions,
} from "./loader.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cmd-def-test-"));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("parseCommandDefinition", () => {
  it("should parse a complete command definition", () => {
    const content = `---
name: review
description: Review code changes for quality
allowed-tools: [web-search, web-fetch, memory, message]
user-invocable: true
model: claude-sonnet-4-5
---
Review the current code changes. Check for:
1. Code quality and patterns
2. Security vulnerabilities
3. Performance issues`;

    const result = parseCommandDefinition("/tmp/review.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const cmd = result.command;
    expect(cmd.name).toBe("review");
    expect(cmd.description).toBe("Review code changes for quality");
    expect(cmd.allowedTools).toEqual(["web-search", "web-fetch", "memory", "message"]);
    expect(cmd.userInvocable).toBe(true);
    expect(cmd.model).toBe("claude-sonnet-4-5");
    expect(cmd.promptTemplate).toContain("Review the current code changes");
    expect(cmd.promptTemplate).toContain("Security vulnerabilities");
  });

  it("should derive name from filename", () => {
    const content = `---
description: Do a thing
---
Do the thing.`;

    const result = parseCommandDefinition("/tmp/do-thing.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.command.name).toBe("do-thing");
  });

  it("should default userInvocable to true", () => {
    const content = `---
name: test
---
Test command`;

    const result = parseCommandDefinition("/tmp/test.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.command.userInvocable).toBe(true);
  });

  it("should allow setting userInvocable to false", () => {
    const content = `---
name: internal
user-invocable: false
---
Internal command`;

    const result = parseCommandDefinition("/tmp/internal.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.command.userInvocable).toBe(false);
  });

  it("should reject empty body", () => {
    const content = `---
name: empty
description: Empty command
---`;

    const result = parseCommandDefinition("/tmp/empty.md", content);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("empty body");
  });

  it("should default acceptsArgs to true", () => {
    const content = `---
name: test
---
Test prompt`;

    const result = parseCommandDefinition("/tmp/test.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.command.acceptsArgs).toBe(true);
  });

  it("should handle comma-separated tool lists", () => {
    const content = `---
name: test
allowed-tools: web-search, memory
---
Test prompt`;

    const result = parseCommandDefinition("/tmp/test.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.command.allowedTools).toEqual(["web-search", "memory"]);
  });

  it("should omit optional fields when not provided", () => {
    const content = `---
name: minimal
---
Minimal command`;

    const result = parseCommandDefinition("/tmp/minimal.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.command.model).toBeUndefined();
    expect(result.command.allowedTools).toBeUndefined();
  });
});

describe("buildCommandPrompt", () => {
  it("should substitute {{args}} placeholder", () => {
    const cmd = {
      name: "review",
      description: "Review code",
      userInvocable: true,
      acceptsArgs: true,
      promptTemplate: "Review the following: {{args}}",
      filePath: "/tmp/review.md",
    };

    const result = buildCommandPrompt(cmd, "src/main.ts");
    expect(result).toBe("Review the following: src/main.ts");
  });

  it("should remove {{args}} when no args provided", () => {
    const cmd = {
      name: "review",
      description: "Review code",
      userInvocable: true,
      acceptsArgs: true,
      promptTemplate: "Review the code {{args}}",
      filePath: "/tmp/review.md",
    };

    const result = buildCommandPrompt(cmd);
    expect(result).toBe("Review the code");
  });

  it("should handle template without {{args}}", () => {
    const cmd = {
      name: "test",
      description: "Test",
      userInvocable: true,
      acceptsArgs: false,
      promptTemplate: "Run all tests and report.",
      filePath: "/tmp/test.md",
    };

    const result = buildCommandPrompt(cmd, "ignored");
    expect(result).toBe("Run all tests and report.");
  });
});

describe("loadCommandDefinitionsFromDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("should load multiple command definitions", () => {
    fs.writeFileSync(path.join(tmpDir, "review.md"), "---\nname: review\n---\nReview code");
    fs.writeFileSync(path.join(tmpDir, "deploy.md"), "---\nname: deploy\n---\nDeploy the app");

    const result = loadCommandDefinitionsFromDir(tmpDir);
    expect(result.commands).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("should return empty for non-existent directory", () => {
    const result = loadCommandDefinitionsFromDir("/tmp/does-not-exist-67890");
    expect(result.commands).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe("loadCommandDefinitions", () => {
  let stateDir: string;
  let workspaceDir: string;

  beforeEach(() => {
    stateDir = makeTmpDir();
    workspaceDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(stateDir);
    cleanup(workspaceDir);
  });

  it("should merge global and workspace commands", () => {
    const globalDir = path.join(stateDir, "commands");
    const wsDir = path.join(workspaceDir, ".openclaw", "commands");
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(wsDir, { recursive: true });

    fs.writeFileSync(path.join(globalDir, "review.md"), "---\nname: review\n---\nGlobal review");
    fs.writeFileSync(path.join(wsDir, "deploy.md"), "---\nname: deploy\n---\nWorkspace deploy");

    const result = loadCommandDefinitions({ stateDir, workspaceDir });
    expect(result.commands).toHaveLength(2);
  });

  it("should let workspace commands override global on name collision", () => {
    const globalDir = path.join(stateDir, "commands");
    const wsDir = path.join(workspaceDir, ".openclaw", "commands");
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(wsDir, { recursive: true });

    fs.writeFileSync(path.join(globalDir, "review.md"), "---\nname: review\n---\nGlobal review");
    fs.writeFileSync(path.join(wsDir, "review.md"), "---\nname: review\n---\nWorkspace review");

    const result = loadCommandDefinitions({ stateDir, workspaceDir });
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].promptTemplate).toBe("Workspace review");
  });
});
