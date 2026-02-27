import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./skills.js", () => ({
  buildWorkspaceSkillCommandSpecs: () => [
    {
      name: "hello",
      skillName: "hello-skill",
      description: "hello",
      dispatch: {
        kind: "tool",
        toolName: "read_file",
        argMode: "raw",
      },
    },
  ],
}));

const ORIGINAL_STATE_DIR = process.env.OPENCLAW_STATE_DIR;
const tempDirs: string[] = [];

async function setupStateDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skills-tracker-"));
  tempDirs.push(dir);
  process.env.OPENCLAW_STATE_DIR = dir;
  vi.resetModules();
  return dir;
}

async function waitFor(condition: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
}

beforeEach(async () => {
  await setupStateDir();
});

afterEach(async () => {
  try {
    const tracker = await import("./skills-usage-tracker.js");
    tracker.__resetSkillsUsageTrackerForTest();
  } catch {
    // ignore module reset errors in cleanup
  }
  if (ORIGINAL_STATE_DIR === undefined) {
    delete process.env.OPENCLAW_STATE_DIR;
  } else {
    process.env.OPENCLAW_STATE_DIR = ORIGINAL_STATE_DIR;
  }
  vi.resetModules();
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe.sequential("skills-usage-tracker", () => {
  it("tracks command invocations and mapped tool results with dedupe", async () => {
    const tracker = await import("./skills-usage-tracker.js");
    const storeMod = await import("./skills-usage-store.js");
    const { emitAgentEvent } = await import("../infra/agent-events.js");

    tracker.registerSkillsUsageTracking({
      workspaceDir: "/tmp/workspace",
      config: {},
    });
    tracker.trackSkillCommandInvocation("hello-skill");

    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: {
        phase: "result",
        name: "read_file",
        toolCallId: "tool-1",
      },
    });
    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: {
        phase: "result",
        name: "read_file",
        toolCallId: "tool-1",
      },
    });
    emitAgentEvent({
      runId: "run-1",
      stream: "lifecycle",
      data: {
        phase: "end",
      },
    });

    await waitFor(async () => {
      const store = await storeMod.loadSkillsUsageStore();
      return (
        store.skills["hello-skill"]?.commandCalls === 1 &&
        store.skills["hello-skill"]?.mappedToolCalls === 1 &&
        store.meta.mappedByStaticDispatch === 1
      );
    });
    const store = await storeMod.loadSkillsUsageStore();
    expect(store.skills["hello-skill"]?.commandCalls).toBe(1);
    expect(store.skills["hello-skill"]?.mappedToolCalls).toBe(1);
    expect(store.skills["hello-skill"]?.totalCalls).toBe(2);
    expect(store.meta.mappedByStaticDispatch).toBe(1);
    expect(store.meta.mappedByRunContext).toBe(0);

    tracker.__resetSkillsUsageTrackerForTest();
  });

  it("tracks unmapped tool results", async () => {
    const tracker = await import("./skills-usage-tracker.js");
    const storeMod = await import("./skills-usage-store.js");
    const { emitAgentEvent } = await import("../infra/agent-events.js");

    tracker.registerSkillsUsageTracking({
      workspaceDir: "/tmp/workspace",
      config: {},
    });

    emitAgentEvent({
      runId: "run-unmapped",
      stream: "tool",
      data: {
        phase: "result",
        name: "unknown_tool_name",
        toolCallId: "tool-unmapped-1",
      },
    });

    await waitFor(async () => {
      const store = await storeMod.loadSkillsUsageStore();
      return store.meta.unmappedToolCalls === 1;
    });
    const store = await storeMod.loadSkillsUsageStore();
    expect(store.meta.unmappedToolCalls).toBe(1);
    expect(store.meta.mappedByRunContext).toBe(0);
    expect(store.meta.mappedByStaticDispatch).toBe(0);
    tracker.__resetSkillsUsageTrackerForTest();
  });

  it("prefers run context attribution over static mapping", async () => {
    const tracker = await import("./skills-usage-tracker.js");
    const storeMod = await import("./skills-usage-store.js");
    const { emitAgentEvent } = await import("../infra/agent-events.js");

    tracker.registerSkillsUsageTracking({
      workspaceDir: "/tmp/workspace",
      config: {},
    });
    tracker.trackSkillCommandInvocation("context-skill", { runId: "run-ctx" });
    emitAgentEvent({
      runId: "run-ctx",
      stream: "tool",
      data: {
        phase: "result",
        name: "read_file",
        toolCallId: "tool-context-1",
      },
    });

    await waitFor(async () => {
      const store = await storeMod.loadSkillsUsageStore();
      return (
        store.skills["context-skill"]?.mappedToolCalls === 1 && store.meta.mappedByRunContext === 1
      );
    });
    const store = await storeMod.loadSkillsUsageStore();
    expect(store.skills["context-skill"]?.mappedToolCalls).toBe(1);
    expect(store.meta.mappedByRunContext).toBe(1);
    expect(store.meta.mappedByStaticDispatch).toBe(0);
    tracker.__resetSkillsUsageTrackerForTest();
  });

  it("prunes run cache by ttl and maxRuns", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    const tracker = await import("./skills-usage-tracker.js");
    const { emitAgentEvent } = await import("../infra/agent-events.js");

    tracker.__configureSkillsUsageTrackerForTest({ ttlMs: 100, maxRuns: 1 });
    tracker.registerSkillsUsageTracking({
      workspaceDir: "/tmp/workspace",
      config: {},
    });

    nowSpy.mockReturnValue(1000);
    emitAgentEvent({
      runId: "run-a",
      stream: "tool",
      data: {
        phase: "result",
        name: "read_file",
        toolCallId: "tool-a-1",
      },
    });

    nowSpy.mockReturnValue(1500);
    emitAgentEvent({
      runId: "run-b",
      stream: "tool",
      data: {
        phase: "result",
        name: "read_file",
        toolCallId: "tool-b-1",
      },
    });

    const diagnostics = tracker.getSkillsUsageTrackerDiagnostics();
    expect(diagnostics.runCacheEntries).toBe(1);
    expect(diagnostics.runContextEntries).toBe(0);

    tracker.__resetSkillsUsageTrackerForTest();
    nowSpy.mockRestore();
  });
});
