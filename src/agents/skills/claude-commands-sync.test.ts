import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SYNC_MARKER,
  safeFilename,
  stripFrontmatter,
  syncMcpToClaudeSettings,
  syncSkillsToClaudeCommands,
} from "./claude-commands-sync.js";

// ---------------------------------------------------------------------------
// stripFrontmatter
// ---------------------------------------------------------------------------

describe("stripFrontmatter", () => {
  it("returns content as-is when there is no frontmatter", () => {
    expect(stripFrontmatter("Hello world")).toBe("Hello world");
  });

  it("strips a simple frontmatter block", () => {
    const input = "---\nname: test\ndescription: demo\n---\nBody text";
    expect(stripFrontmatter(input)).toBe("Body text");
  });

  it("strips leading blank lines after frontmatter", () => {
    const input = "---\nname: x\n---\n\n\nContent";
    expect(stripFrontmatter(input)).toBe("Content");
  });

  it("returns full content when closing --- is missing", () => {
    const input = "---\nname: x\nstill in frontmatter";
    expect(stripFrontmatter(input)).toBe(input);
  });

  it("handles empty body after frontmatter", () => {
    const input = "---\nname: x\n---\n";
    expect(stripFrontmatter(input)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// safeFilename
// ---------------------------------------------------------------------------

describe("safeFilename", () => {
  it("keeps valid kebab-case names", () => {
    expect(safeFilename("status-agents")).toBe("status-agents");
  });

  it("replaces dots and special chars with underscores", () => {
    expect(safeFilename("my.skill/test")).toBe("test");
  });

  it("uses path.basename to prevent traversal", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
  });
});

// ---------------------------------------------------------------------------
// syncSkillsToClaudeCommands (integration — uses temp dirs)
// ---------------------------------------------------------------------------

describe("syncSkillsToClaudeCommands", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "claude-sync-test-"));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .claude/commands/ directory", async () => {
    const workspaceDir = path.join(tmpDir, "workspace");
    await fsp.mkdir(workspaceDir, { recursive: true });

    // No skills dirs → 0 synced, but directory should exist
    const result = await syncSkillsToClaudeCommands({
      workspaceDir,
      managedSkillsDir: path.join(tmpDir, "no-such-managed"),
      bundledSkillsDir: path.join(tmpDir, "no-such-bundled"),
    });

    expect(result.synced).toBe(0);
    const stat = await fsp.stat(path.join(workspaceDir, ".claude", "commands"));
    expect(stat.isDirectory()).toBe(true);
  });

  it("syncs a skill file with marker and strips frontmatter", async () => {
    const workspaceDir = path.join(tmpDir, "workspace");
    const skillsDir = path.join(workspaceDir, "skills");
    const skillDir = path.join(skillsDir, "my-skill");
    await fsp.mkdir(skillDir, { recursive: true });

    const skillContent = [
      "---",
      "name: my-skill",
      "description: A test skill",
      "---",
      "",
      "Do something useful.",
    ].join("\n");
    await fsp.writeFile(path.join(skillDir, "SKILL.md"), skillContent, "utf-8");

    const result = await syncSkillsToClaudeCommands({
      workspaceDir,
      managedSkillsDir: path.join(tmpDir, "no-managed"),
      bundledSkillsDir: path.join(tmpDir, "no-bundled"),
    });

    expect(result.synced).toBeGreaterThanOrEqual(1);

    const commandFile = path.join(workspaceDir, ".claude", "commands", "my-skill.md");
    const content = await fsp.readFile(commandFile, "utf-8");
    expect(content.startsWith(SYNC_MARKER)).toBe(true);
    expect(content).toContain("Do something useful.");
    // frontmatter should be stripped
    expect(content).not.toContain("name: my-skill");
  });

  it("preserves manually created command files without marker", async () => {
    const workspaceDir = path.join(tmpDir, "workspace");
    const commandsDir = path.join(workspaceDir, ".claude", "commands");
    await fsp.mkdir(commandsDir, { recursive: true });

    // Create a manual command file (no marker)
    const manualPath = path.join(commandsDir, "custom.md");
    await fsp.writeFile(manualPath, "My custom command", "utf-8");

    await syncSkillsToClaudeCommands({
      workspaceDir,
      managedSkillsDir: path.join(tmpDir, "no-managed"),
      bundledSkillsDir: path.join(tmpDir, "no-bundled"),
    });

    // Manual file should survive
    const content = await fsp.readFile(manualPath, "utf-8");
    expect(content).toBe("My custom command");
  });

  it("removes stale synced files that no longer match active skills", async () => {
    const workspaceDir = path.join(tmpDir, "workspace");
    const commandsDir = path.join(workspaceDir, ".claude", "commands");
    await fsp.mkdir(commandsDir, { recursive: true });

    // Create a stale synced file (has marker)
    const stalePath = path.join(commandsDir, "old-skill.md");
    await fsp.writeFile(stalePath, `${SYNC_MARKER}\nOld skill that no longer exists`, "utf-8");

    await syncSkillsToClaudeCommands({
      workspaceDir,
      managedSkillsDir: path.join(tmpDir, "no-managed"),
      bundledSkillsDir: path.join(tmpDir, "no-bundled"),
    });

    // Stale file should be removed
    await expect(fsp.access(stalePath)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// syncMcpToClaudeSettings
// ---------------------------------------------------------------------------

describe("syncMcpToClaudeSettings", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "claude-mcp-sync-test-"));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates settings.json with mcpServers when file does not exist", async () => {
    const workspaceDir = path.join(tmpDir, "workspace");

    await syncMcpToClaudeSettings({
      workspaceDir,
      mcpServers: {
        "web-search": { url: "https://example.com/mcp/ws", transport: "sse" },
      },
    });

    const settingsPath = path.join(workspaceDir, ".claude", "settings.json");
    const raw = await fsp.readFile(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    expect(settings.mcpServers["web-search"]).toEqual({
      url: "https://example.com/mcp/ws",
      transport: "sse",
    });
  });

  it("preserves existing keys when merging", async () => {
    const workspaceDir = path.join(tmpDir, "workspace");
    const settingsDir = path.join(workspaceDir, ".claude");
    await fsp.mkdir(settingsDir, { recursive: true });

    const existing = {
      permissions: { allow: ["Read"] },
      mcpServers: { existing: { url: "https://old.example.com", transport: "sse" } },
    };
    await fsp.writeFile(path.join(settingsDir, "settings.json"), JSON.stringify(existing), "utf-8");

    await syncMcpToClaudeSettings({
      workspaceDir,
      mcpServers: {
        "new-server": { url: "https://new.example.com", transport: "sse" },
      },
    });

    const raw = await fsp.readFile(path.join(settingsDir, "settings.json"), "utf-8");
    const settings = JSON.parse(raw);
    // Existing MCP server preserved
    expect(settings.mcpServers.existing).toBeDefined();
    // New server added
    expect(settings.mcpServers["new-server"]).toBeDefined();
    // Other keys preserved
    expect(settings.permissions).toEqual({ allow: ["Read"] });
  });

  it("handles malformed settings.json gracefully", async () => {
    const workspaceDir = path.join(tmpDir, "workspace");
    const settingsDir = path.join(workspaceDir, ".claude");
    await fsp.mkdir(settingsDir, { recursive: true });
    await fsp.writeFile(path.join(settingsDir, "settings.json"), "not json!!!", "utf-8");

    // Should not throw
    await syncMcpToClaudeSettings({
      workspaceDir,
      mcpServers: { test: { url: "https://test.com", transport: "sse" } },
    });

    const raw = await fsp.readFile(path.join(settingsDir, "settings.json"), "utf-8");
    const settings = JSON.parse(raw);
    expect(settings.mcpServers.test).toBeDefined();
  });
});
