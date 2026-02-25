import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearInternalHooks } from "../hooks/internal-hooks.js";
import { makeTempWorkspace } from "../test-helpers/workspace.js";
import { resolveBootstrapContextForRun, resolveBootstrapFilesForRun } from "./bootstrap-files.js";
import { DEFAULT_HEARTBEAT_FILENAME } from "./workspace.js";

describe("HEARTBEAT.md conditional loading", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    clearInternalHooks();
    workspaceDir = await makeTempWorkspace("openclaw-heartbeat-");
    // Ensure HEARTBEAT.md exists in the workspace
    await fs.writeFile(
      path.join(workspaceDir, DEFAULT_HEARTBEAT_FILENAME),
      "# HEARTBEAT.md\n\n## Priority Order\n1. Check active tasks\n2. Post status updates\n",
    );
  });

  afterEach(() => clearInternalHooks());

  it("excludes HEARTBEAT.md when isHeartbeat is false", async () => {
    const files = await resolveBootstrapFilesForRun({
      workspaceDir,
      isHeartbeat: false,
    });
    expect(files.some((f) => f.name === DEFAULT_HEARTBEAT_FILENAME)).toBe(false);
  });

  it("excludes HEARTBEAT.md when isHeartbeat is undefined (default)", async () => {
    const files = await resolveBootstrapFilesForRun({
      workspaceDir,
    });
    expect(files.some((f) => f.name === DEFAULT_HEARTBEAT_FILENAME)).toBe(false);
  });

  it("includes HEARTBEAT.md when isHeartbeat is true", async () => {
    const files = await resolveBootstrapFilesForRun({
      workspaceDir,
      isHeartbeat: true,
    });
    expect(files.some((f) => f.name === DEFAULT_HEARTBEAT_FILENAME)).toBe(true);
  });

  it("preserves all non-HEARTBEAT files regardless of isHeartbeat flag", async () => {
    const withHeartbeat = await resolveBootstrapFilesForRun({
      workspaceDir,
      isHeartbeat: true,
    });
    const withoutHeartbeat = await resolveBootstrapFilesForRun({
      workspaceDir,
      isHeartbeat: false,
    });

    const nonHeartbeatNames = withHeartbeat
      .filter((f) => f.name !== DEFAULT_HEARTBEAT_FILENAME)
      .map((f) => f.name)
      .sort();
    const withoutNames = withoutHeartbeat.map((f) => f.name).sort();

    expect(nonHeartbeatNames).toEqual(withoutNames);
  });

  it("contextFiles exclude HEARTBEAT.md for non-heartbeat messages", async () => {
    const { contextFiles } = await resolveBootstrapContextForRun({
      workspaceDir,
      isHeartbeat: false,
    });
    expect(
      contextFiles.some(
        (f) => f.path === DEFAULT_HEARTBEAT_FILENAME || f.path.includes("HEARTBEAT"),
      ),
    ).toBe(false);
  });

  it("contextFiles include HEARTBEAT.md for heartbeat messages", async () => {
    const { contextFiles } = await resolveBootstrapContextForRun({
      workspaceDir,
      isHeartbeat: true,
    });
    expect(
      contextFiles.some(
        (f) => f.path === DEFAULT_HEARTBEAT_FILENAME || f.path.includes("HEARTBEAT"),
      ),
    ).toBe(true);
  });
});
