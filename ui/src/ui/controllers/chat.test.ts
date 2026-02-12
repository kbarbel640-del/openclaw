import { describe, expect, it, vi } from "vitest";
import {
  handleChatEvent,
  loadChatModels,
  switchChatModel,
  type ChatEventPayload,
  type ChatState,
} from "./chat.ts";

function createState(overrides: Partial<ChatState> = {}): ChatState {
  return {
    chatAttachments: [],
    chatLoading: false,
    chatMessage: "",
    chatMessages: [],
    chatRunId: null,
    chatSending: false,
    chatStream: null,
    chatStreamStartedAt: null,
    chatThinkingLevel: null,
    chatModelOptions: [],
    chatModelLoading: false,
    chatModelError: null,
    chatSelectedProvider: null,
    chatSelectedModel: null,
    chatSwitchingModel: false,
    client: null,
    connected: true,
    lastError: null,
    sessionKey: "main",
    ...overrides,
  };
}

describe("handleChatEvent", () => {
  it("returns null when payload is missing", () => {
    const state = createState();
    expect(handleChatEvent(state, undefined)).toBe(null);
  });

  it("returns null when sessionKey does not match", () => {
    const state = createState({ sessionKey: "main" });
    const payload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: "other",
      state: "final",
    };
    expect(handleChatEvent(state, payload)).toBe(null);
  });

  it("returns null for delta from another run", () => {
    const state = createState({
      sessionKey: "main",
      chatRunId: "run-user",
      chatStream: "Hello",
    });
    const payload: ChatEventPayload = {
      runId: "run-announce",
      sessionKey: "main",
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "Done" }] },
    };
    expect(handleChatEvent(state, payload)).toBe(null);
    expect(state.chatRunId).toBe("run-user");
    expect(state.chatStream).toBe("Hello");
  });

  it("returns 'final' for final from another run (e.g. sub-agent announce) without clearing state", () => {
    const state = createState({
      sessionKey: "main",
      chatRunId: "run-user",
      chatStream: "Working...",
      chatStreamStartedAt: 123,
    });
    const payload: ChatEventPayload = {
      runId: "run-announce",
      sessionKey: "main",
      state: "final",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Sub-agent findings" }],
      },
    };
    expect(handleChatEvent(state, payload)).toBe("final");
    expect(state.chatRunId).toBe("run-user");
    expect(state.chatStream).toBe("Working...");
    expect(state.chatStreamStartedAt).toBe(123);
  });

  it("processes final from own run and clears state", () => {
    const state = createState({
      sessionKey: "main",
      chatRunId: "run-1",
      chatStream: "Reply",
      chatStreamStartedAt: 100,
    });
    const payload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: "main",
      state: "final",
    };
    expect(handleChatEvent(state, payload)).toBe("final");
    expect(state.chatRunId).toBe(null);
    expect(state.chatStream).toBe(null);
    expect(state.chatStreamStartedAt).toBe(null);
  });
});

describe("model selector helpers", () => {
  it("loads and normalizes model list", async () => {
    const request = vi.fn(async () => ({
      models: [
        { provider: "google-antigravity", model: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
        { provider: "github-copilot", model: "gpt-5.2", label: "GPT-5.2" },
      ],
    }));
    const state = createState({ client: { request } as unknown as ChatState["client"] });
    await loadChatModels(state);
    expect(state.chatModelOptions.map((m) => m.value)).toEqual([
      "github-copilot/gpt-5.2",
      "google-antigravity/gemini-2.5-pro",
    ]);
    expect(state.chatModelLoading).toBe(false);
    expect(state.chatModelError).toBe(null);
  });

  it("switches model by sending /model command", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "chat.history") {
        return { messages: [] };
      }
      return { ok: true };
    });
    const state = createState({ client: { request } as unknown as ChatState["client"] });
    const ok = await switchChatModel(state, "google-antigravity/gemini-2.5-pro");
    expect(ok).toBe(true);
    expect(request).toHaveBeenCalledWith(
      "chat.send",
      expect.objectContaining({ message: "/model google-antigravity/gemini-2.5-pro" }),
    );
    expect(state.chatSelectedModel).toBe("google-antigravity/gemini-2.5-pro");
  });
});
