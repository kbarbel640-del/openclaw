import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  clearInternalHooks,
  registerInternalHook,
  type AgentBootstrapHookContext,
} from "../hooks/internal-hooks.js";
import { makeTempWorkspace, writeWorkspaceFile } from "../test-helpers/workspace.js";
import { resolveBootstrapContextForRun, resolveBootstrapFilesForRun } from "./bootstrap-files.js";

describe("resolveBootstrapFilesForRun", () => {
  beforeEach(() => clearInternalHooks());
  afterEach(() => clearInternalHooks());

  it("applies bootstrap hook overrides", async () => {
    registerInternalHook("agent:bootstrap", (event) => {
      const context = event.context as AgentBootstrapHookContext;
      context.bootstrapFiles = [
        ...context.bootstrapFiles,
        {
          name: "EXTRA.md",
          path: path.join(context.workspaceDir, "EXTRA.md"),
          content: "extra",
          missing: false,
        },
      ];
    });

    const workspaceDir = await makeTempWorkspace("openclaw-bootstrap-");
    const files = await resolveBootstrapFilesForRun({ workspaceDir });

    expect(files.some((file) => file.name === "EXTRA.md")).toBe(true);
  });
});

describe("heartbeat file filtering", () => {
  beforeEach(() => clearInternalHooks());
  afterEach(() => clearInternalHooks());

  it("excludes HEARTBEAT.md from non-heartbeat sessions when dedicated session configured", async () => {
    const workspaceDir = await makeTempWorkspace("openclaw-bootstrap-hb-");
    await writeWorkspaceFile({
      dir: workspaceDir,
      name: "HEARTBEAT.md",
      content: "# heartbeat instructions",
    });

    const config = {
      agents: { defaults: { heartbeat: { session: "agent:main:heartbeat" } } },
    } as unknown as OpenClawConfig;

    const files = await resolveBootstrapFilesForRun({
      workspaceDir,
      config,
      sessionKey: "agent:main:main",
    });

    expect(files.some((f) => f.name === "HEARTBEAT.md")).toBe(false);
  });

  it("includes HEARTBEAT.md for the heartbeat session", async () => {
    const workspaceDir = await makeTempWorkspace("openclaw-bootstrap-hb-");
    await writeWorkspaceFile({
      dir: workspaceDir,
      name: "HEARTBEAT.md",
      content: "# heartbeat instructions",
    });

    const config = {
      agents: { defaults: { heartbeat: { session: "agent:main:heartbeat" } } },
    } as unknown as OpenClawConfig;

    const files = await resolveBootstrapFilesForRun({
      workspaceDir,
      config,
      sessionKey: "agent:main:heartbeat",
    });

    expect(files.some((f) => f.name === "HEARTBEAT.md")).toBe(true);
  });

  it("keeps HEARTBEAT.md for all sessions when no dedicated session configured", async () => {
    const workspaceDir = await makeTempWorkspace("openclaw-bootstrap-hb-");
    await writeWorkspaceFile({
      dir: workspaceDir,
      name: "HEARTBEAT.md",
      content: "# heartbeat instructions",
    });

    const files = await resolveBootstrapFilesForRun({
      workspaceDir,
      sessionKey: "agent:main:main",
    });

    expect(files.some((f) => f.name === "HEARTBEAT.md")).toBe(true);
  });

  it("keeps HEARTBEAT.md when heartbeat session is 'main'", async () => {
    const workspaceDir = await makeTempWorkspace("openclaw-bootstrap-hb-");
    await writeWorkspaceFile({
      dir: workspaceDir,
      name: "HEARTBEAT.md",
      content: "# heartbeat instructions",
    });

    const config = {
      agents: { defaults: { heartbeat: { session: "main" } } },
    } as unknown as OpenClawConfig;

    const files = await resolveBootstrapFilesForRun({
      workspaceDir,
      config,
      sessionKey: "agent:main:main",
    });

    expect(files.some((f) => f.name === "HEARTBEAT.md")).toBe(true);
  });
});

describe("resolveBootstrapContextForRun", () => {
  beforeEach(() => clearInternalHooks());
  afterEach(() => clearInternalHooks());

  it("returns context files for hook-adjusted bootstrap files", async () => {
    registerInternalHook("agent:bootstrap", (event) => {
      const context = event.context as AgentBootstrapHookContext;
      context.bootstrapFiles = [
        ...context.bootstrapFiles,
        {
          name: "EXTRA.md",
          path: path.join(context.workspaceDir, "EXTRA.md"),
          content: "extra",
          missing: false,
        },
      ];
    });

    const workspaceDir = await makeTempWorkspace("openclaw-bootstrap-");
    const result = await resolveBootstrapContextForRun({ workspaceDir });
    const extra = result.contextFiles.find((file) => file.path === "EXTRA.md");

    expect(extra?.content).toBe("extra");
  });
});
