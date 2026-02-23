import type { AgentSession } from "@mariozechner/pi-coding-agent";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import {
  applyPromptBuildHookResultToSession,
  injectHistoryImagesIntoMessages,
  resolveAttemptFsWorkspaceOnly,
  resolvePromptBuildHookResult,
  resolvePromptModeForSession,
} from "./attempt.js";

describe("resolvePromptBuildHookResult", () => {
  function createLegacyOnlyHookRunner() {
    return {
      hasHooks: vi.fn(
        (hookName: "before_prompt_build" | "before_agent_start") =>
          hookName === "before_agent_start",
      ),
      runBeforePromptBuild: vi.fn(async () => undefined),
      runBeforeAgentStart: vi.fn(async () => ({ prependContext: "from-hook" })),
    };
  }

  it("reuses precomputed legacy before_agent_start result without invoking hook again", async () => {
    const hookRunner = createLegacyOnlyHookRunner();

    const result = await resolvePromptBuildHookResult({
      prompt: "hello",
      messages: [],
      hookCtx: {},
      hookRunner,
      legacyBeforeAgentStartResult: { prependContext: "from-cache", systemPrompt: "legacy-system" },
    });

    expect(hookRunner.runBeforeAgentStart).not.toHaveBeenCalled();
    expect(result).toEqual({
      prependContext: "from-cache",
      systemPrompt: "legacy-system",
    });
  });

  it("calls legacy hook when precomputed result is absent", async () => {
    const hookRunner = createLegacyOnlyHookRunner();
    const messages: AgentMessage[] = [{ role: "user", content: "ctx" } as AgentMessage];

    const result = await resolvePromptBuildHookResult({
      prompt: "hello",
      messages,
      hookCtx: {},
      hookRunner,
    });

    expect(hookRunner.runBeforeAgentStart).toHaveBeenCalledTimes(1);
    expect(hookRunner.runBeforeAgentStart).toHaveBeenCalledWith({ prompt: "hello", messages }, {});
    expect(result.prependContext).toBe("from-hook");
  });
});

describe("resolvePromptModeForSession", () => {
  it("uses minimal mode for subagent sessions", () => {
    expect(resolvePromptModeForSession("agent:main:subagent:child")).toBe("minimal");
  });

  it("uses full mode for cron sessions", () => {
    expect(resolvePromptModeForSession("agent:main:cron:job-1")).toBe("full");
    expect(resolvePromptModeForSession("agent:main:cron:job-1:run:run-abc")).toBe("full");
  });
});

describe("resolveAttemptFsWorkspaceOnly", () => {
  it("uses global tools.fs.workspaceOnly when agent has no override", () => {
    const cfg: OpenClawConfig = {
      tools: {
        fs: { workspaceOnly: true },
      },
    };

    expect(
      resolveAttemptFsWorkspaceOnly({
        config: cfg,
        sessionAgentId: "main",
      }),
    ).toBe(true);
  });

  it("prefers agent-specific tools.fs.workspaceOnly override", () => {
    const cfg: OpenClawConfig = {
      tools: {
        fs: { workspaceOnly: true },
      },
      agents: {
        list: [
          {
            id: "main",
            tools: {
              fs: { workspaceOnly: false },
            },
          },
        ],
      },
    };

    expect(
      resolveAttemptFsWorkspaceOnly({
        config: cfg,
        sessionAgentId: "main",
      }),
    ).toBe(false);
  });
});

describe("applyPromptBuildHookResultToSession", () => {
  it("prepends multiple contexts in-order and appends system prompt", () => {
    const agent = { setSystemPrompt: vi.fn() };
    const session = { agent } as unknown as AgentSession;

    const result = applyPromptBuildHookResultToSession({
      prompt: "user prompt",
      systemPromptText: "BASE",
      hookResult: {
        actions: [
          { kind: "prependContext", text: "ctx A" },
          { kind: "prependContext", text: "ctx B" },
          { kind: "appendSystemPrompt", text: "sys X" },
          { kind: "appendSystemPrompt", text: "sys Y" },
        ],
      },
      session,
    });

    expect(result.effectivePrompt).toBe("ctx A\n\nctx B\n\nuser prompt");
    expect(result.systemPromptText).toBe("BASE\n\nsys X\n\nsys Y");
    expect(agent.setSystemPrompt).toHaveBeenCalledWith("BASE\n\nsys X\n\nsys Y");
  });

  it("treats legacy fields as shorthand actions", () => {
    const agent = { setSystemPrompt: vi.fn() };
    const session = { agent } as unknown as AgentSession;

    const result = applyPromptBuildHookResultToSession({
      prompt: "user prompt",
      systemPromptText: "BASE",
      hookResult: {
        prependContext: "legacy ctx",
        systemPrompt: "legacy sys",
      },
      session,
    });

    expect(result.effectivePrompt).toBe("legacy ctx\n\nuser prompt");
    expect(result.systemPromptText).toBe("BASE\n\nlegacy sys");
    expect(agent.setSystemPrompt).toHaveBeenCalledWith("BASE\n\nlegacy sys");
  });
});
