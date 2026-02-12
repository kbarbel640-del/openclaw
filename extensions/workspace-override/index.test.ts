import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { buildOverrideContext } from "./index.js";

describe("workspace-override plugin", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-override-test-"));
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test("plugin exports correct id", async () => {
    const { default: plugin } = await import("./index.js");
    expect(plugin.id).toBe("workspace-override");
  });

  test("buildOverrideContext wraps overrides in XML tags", () => {
    const overrides = [
      { name: "AGENTS.md", content: "Custom agent rules" },
      { name: "SOUL.md", content: "Custom soul" },
    ];

    const result = buildOverrideContext(overrides);

    expect(result).toContain("<workspace-overrides>");
    expect(result).toContain("</workspace-overrides>");
    expect(result).toContain("## AGENTS.md (override)");
    expect(result).toContain("Custom agent rules");
    expect(result).toContain("## SOUL.md (override)");
    expect(result).toContain("Custom soul");
    expect(result).toContain("take precedence");
  });

  test("buildOverrideContext handles single override", () => {
    const overrides = [{ name: "TOOLS.md", content: "Custom tools guidance" }];

    const result = buildOverrideContext(overrides);

    expect(result).toContain("## TOOLS.md (override)");
    expect(result).toContain("Custom tools guidance");
    // Should not contain other filenames
    expect(result).not.toContain("AGENTS.md");
    expect(result).not.toContain("SOUL.md");
  });

  test("register hooks into before_agent_start with overrides dir", async () => {
    const { default: plugin } = await import("./index.js");

    // Create override files in tmpDir
    await fs.writeFile(path.join(tmpDir, "AGENTS.md"), "Override agents rules");
    await fs.writeFile(path.join(tmpDir, "SOUL.md"), "Override soul content");

    // Capture the hook handler
    let capturedHandler: (() => Promise<unknown>) | undefined;
    const mockApi = {
      id: "workspace-override",
      name: "Workspace Override",
      source: "/fake/path",
      config: {},
      pluginConfig: { dir: tmpDir },
      runtime: {},
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      resolvePath: (p: string) => p,
      on: (_hookName: string, handler: () => Promise<unknown>) => {
        capturedHandler = handler;
      },
    };

    plugin.register?.(mockApi as never);
    expect(capturedHandler).toBeDefined();

    // Invoke the captured hook
    const result = (await capturedHandler!()) as { prependContext?: string } | undefined;
    expect(result).toBeDefined();
    expect(result!.prependContext).toContain("Override agents rules");
    expect(result!.prependContext).toContain("Override soul content");
    expect(result!.prependContext).toContain("## AGENTS.md (override)");
    expect(result!.prependContext).toContain("## SOUL.md (override)");
  });

  test("hook returns undefined when no overrides exist", async () => {
    const { default: plugin } = await import("./index.js");

    // Empty tmpDir — no override files
    let capturedHandler: (() => Promise<unknown>) | undefined;
    const mockApi = {
      id: "workspace-override",
      name: "Workspace Override",
      source: "/fake/path",
      config: {},
      pluginConfig: { dir: tmpDir },
      runtime: {},
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      resolvePath: (p: string) => p,
      on: (_hookName: string, handler: () => Promise<unknown>) => {
        capturedHandler = handler;
      },
    };

    plugin.register?.(mockApi as never);
    const result = await capturedHandler!();
    expect(result).toBeUndefined();
  });

  test("hook skips empty override files", async () => {
    const { default: plugin } = await import("./index.js");

    // Create an empty file and a non-empty one
    await fs.writeFile(path.join(tmpDir, "AGENTS.md"), "");
    await fs.writeFile(path.join(tmpDir, "SOUL.md"), "   "); // whitespace-only
    await fs.writeFile(path.join(tmpDir, "TOOLS.md"), "Real content");

    let capturedHandler: (() => Promise<unknown>) | undefined;
    const mockApi = {
      id: "workspace-override",
      name: "Workspace Override",
      source: "/fake/path",
      config: {},
      pluginConfig: { dir: tmpDir },
      runtime: {},
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      resolvePath: (p: string) => p,
      on: (_hookName: string, handler: () => Promise<unknown>) => {
        capturedHandler = handler;
      },
    };

    plugin.register?.(mockApi as never);
    const result = (await capturedHandler!()) as { prependContext?: string };

    expect(result.prependContext).toContain("## TOOLS.md (override)");
    expect(result.prependContext).toContain("Real content");
    // Empty/whitespace files should not appear
    expect(result.prependContext).not.toContain("## AGENTS.md");
    expect(result.prependContext).not.toContain("## SOUL.md");
  });

  test("hook ignores non-overridable files", async () => {
    const { default: plugin } = await import("./index.js");

    await fs.writeFile(path.join(tmpDir, "AGENTS.md"), "Agent override");
    await fs.writeFile(path.join(tmpDir, "random.md"), "Should be ignored");

    let capturedHandler: (() => Promise<unknown>) | undefined;
    const mockApi = {
      id: "workspace-override",
      name: "Workspace Override",
      source: "/fake/path",
      config: {},
      pluginConfig: { dir: tmpDir },
      runtime: {},
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      resolvePath: (p: string) => p,
      on: (_hookName: string, handler: () => Promise<unknown>) => {
        capturedHandler = handler;
      },
    };

    plugin.register?.(mockApi as never);
    const result = (await capturedHandler!()) as { prependContext?: string };

    expect(result.prependContext).toContain("Agent override");
    expect(result.prependContext).not.toContain("Should be ignored");
  });
});
