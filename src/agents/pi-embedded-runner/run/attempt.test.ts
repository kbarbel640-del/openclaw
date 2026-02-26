import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import {
  injectHistoryImagesIntoMessages,
  pruneProcessedHistoryImages,
  resolveAttemptFsWorkspaceOnly,
  resolvePromptBuildHookResult,
  resolvePromptModeForSession,
} from "./attempt.js";
import { IMAGE_PRUNED_MARKER } from "./images.js";

describe("injectHistoryImagesIntoMessages", () => {
  const image: ImageContent = { type: "image", data: "abc", mimeType: "image/png" };

  it("injects history images and converts string content", () => {
    const messages: AgentMessage[] = [
      {
        role: "user",
        content: "See /tmp/photo.png",
      } as AgentMessage,
    ];

    const didMutate = injectHistoryImagesIntoMessages(messages, new Map([[0, [image]]]));

    expect(didMutate).toBe(true);
    const firstUser = messages[0] as Extract<AgentMessage, { role: "user" }> | undefined;
    expect(Array.isArray(firstUser?.content)).toBe(true);
    const content = firstUser?.content as Array<{ type: string; text?: string; data?: string }>;
    expect(content).toHaveLength(2);
    expect(content[0]?.type).toBe("text");
    expect(content[1]).toMatchObject({ type: "image", data: "abc" });
  });

  it("avoids duplicating existing image content", () => {
    const messages: AgentMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: "See /tmp/photo.png" }, { ...image }],
      } as AgentMessage,
    ];

    const didMutate = injectHistoryImagesIntoMessages(messages, new Map([[0, [image]]]));

    expect(didMutate).toBe(false);
    const first = messages[0] as Extract<AgentMessage, { role: "user" }> | undefined;
    if (!first || !Array.isArray(first.content)) {
      throw new Error("expected array content");
    }
    expect(first.content).toHaveLength(2);
  });

  it("ignores non-user messages and out-of-range indices", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: "noop",
      } as unknown as AgentMessage,
    ];

    const didMutate = injectHistoryImagesIntoMessages(messages, new Map([[1, [image]]]));

    expect(didMutate).toBe(false);
    const firstAssistant = messages[0] as Extract<AgentMessage, { role: "assistant" }> | undefined;
    expect(firstAssistant?.content).toBe("noop");
  });
});

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
    const messages = [{ role: "user", content: "ctx" }];
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

describe("pruneProcessedHistoryImages", () => {
  const image: ImageContent = { type: "image", data: "base64data", mimeType: "image/png" };

  it("replaces image blocks with pruned marker for messages before an assistant reply", () => {
    const messages: AgentMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: "See /tmp/photo.png" }, { ...image }],
      } as AgentMessage,
      {
        role: "assistant",
        content: "I see the image",
      } as unknown as AgentMessage,
    ];

    const didMutate = pruneProcessedHistoryImages(messages);

    expect(didMutate).toBe(true);
    const userMsg = messages[0] as Extract<AgentMessage, { role: "user" }>;
    const content = userMsg.content as Array<{ type: string; text?: string }>;
    expect(content).toHaveLength(2);
    expect(content[0]).toMatchObject({ type: "text", text: "See /tmp/photo.png" });
    expect(content[1]).toMatchObject({ type: "text", text: IMAGE_PRUNED_MARKER });
  });

  it("does not prune images from the most recent user message (no assistant reply after)", () => {
    const messages: AgentMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: "See /tmp/photo.png" }, { ...image }],
      } as AgentMessage,
    ];

    const didMutate = pruneProcessedHistoryImages(messages);

    expect(didMutate).toBe(false);
    const userMsg = messages[0] as Extract<AgentMessage, { role: "user" }>;
    const content = userMsg.content as Array<{ type: string; data?: string }>;
    expect(content[1]).toMatchObject({ type: "image", data: "base64data" });
  });

  it("prunes multiple image blocks from a single message", () => {
    const image2: ImageContent = { type: "image", data: "other", mimeType: "image/jpeg" };
    const messages: AgentMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: "Two images" }, { ...image }, { ...image2 }],
      } as AgentMessage,
      {
        role: "assistant",
        content: "Got them",
      } as unknown as AgentMessage,
    ];

    const didMutate = pruneProcessedHistoryImages(messages);

    expect(didMutate).toBe(true);
    const content = (messages[0] as Extract<AgentMessage, { role: "user" }>).content as Array<{
      type: string;
      text?: string;
    }>;
    expect(content).toHaveLength(3);
    expect(content[1]).toMatchObject({ type: "text", text: IMAGE_PRUNED_MARKER });
    expect(content[2]).toMatchObject({ type: "text", text: IMAGE_PRUNED_MARKER });
  });

  it("returns false when no messages have image content", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hello" } as AgentMessage,
      { role: "assistant", content: "hi" } as unknown as AgentMessage,
    ];

    expect(pruneProcessedHistoryImages(messages)).toBe(false);
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
