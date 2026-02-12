import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { SessionsListResult } from "../types.ts";
import { renderChat, type ChatProps } from "./chat.ts";

function createSessions(): SessionsListResult {
  return {
    ts: 0,
    path: "",
    count: 0,
    defaults: { model: null, contextTokens: null },
    sessions: [],
  };
}

function createProps(overrides: Partial<ChatProps> = {}): ChatProps {
  return {
    sessionKey: "main",
    onSessionKeyChange: () => undefined,
    thinkingLevel: null,
    showThinking: false,
    loading: false,
    sending: false,
    canAbort: false,
    compactionStatus: null,
    messages: [],
    toolMessages: [],
    stream: null,
    streamStartedAt: null,
    assistantAvatarUrl: null,
    draft: "",
    queue: [],
    connected: true,
    canSend: true,
    disabledReason: null,
    error: null,
    sessions: createSessions(),
    focusMode: false,
    assistantName: "OpenClaw",
    assistantAvatar: null,
    onRefresh: () => undefined,
    onToggleFocusMode: () => undefined,
    onDraftChange: () => undefined,
    onSend: () => undefined,
    onQueueRemove: () => undefined,
    onNewSession: () => undefined,
    ...overrides,
  };
}

describe("chat view", () => {
  it("renders execution checklist in composer", () => {
    const container = document.createElement("div");
    render(renderChat(createProps()), container);

    expect(container.textContent).toContain("Execution checklist");
    expect(container.textContent).toContain("Problem Statement");
    expect(container.textContent).toContain("0/5");
  });

  it("inserts checklist template into draft", () => {
    const container = document.createElement("div");
    const onDraftChange = vi.fn();
    render(renderChat(createProps({ onDraftChange })), container);

    const button = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Problem Statement"),
    );
    expect(button).toBeDefined();
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(String(onDraftChange.mock.calls[0]?.[0] ?? "")).toContain("## Problem Statement");
  });

  it("shows a stop button when aborting is available", () => {
    const container = document.createElement("div");
    const onAbort = vi.fn();
    render(
      renderChat(
        createProps({
          canAbort: true,
          onAbort,
        }),
      ),
      container,
    );

    const stopButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Stop",
    );
    expect(stopButton).not.toBeUndefined();
    stopButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("New session");
  });

  it("shows a new session button when aborting is unavailable", () => {
    const container = document.createElement("div");
    const onNewSession = vi.fn();
    render(
      renderChat(
        createProps({
          canAbort: false,
          onNewSession,
        }),
      ),
      container,
    );

    const newSessionButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "New" || btn.textContent?.trim() === "New session",
    );
    expect(newSessionButton).not.toBeUndefined();
    newSessionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onNewSession).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("New");
    expect(container.textContent).not.toContain("Stop");
  });

  it("hides unavailable or missing models from selectors", () => {
    const container = document.createElement("div");
    render(
      renderChat(
        createProps({
          modelsCatalog: [
            {
              provider: "github-copilot",
              id: "gpt-5.2-codex",
              name: "GPT-5.2 Codex",
              capabilities: { coding: true, reasoning: true },
            },
            {
              provider: "openai-codex",
              id: "gpt-5.1-codex",
              name: "GPT-5.1 Codex",
              tags: ["missing"],
              capabilities: { coding: true, reasoning: true },
            },
          ],
          detectedProviders: new Set(["github-copilot"]),
          unavailableProviders: new Set(["openai-codex"]),
          cooldownModels: new Set(),
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("GPT-5.2 Codex");
    expect(container.textContent).not.toContain("GPT-5.1 Codex");
  });

  it("filters model options from search inputs in both selectors", () => {
    const container = document.createElement("div");
    render(
      renderChat(
        createProps({
          modelsCatalog: [
            {
              provider: "google-antigravity",
              id: "gemini-2.5-pro",
              name: "Gemini 2.5 Pro",
              capabilities: { reasoning: true },
            },
            {
              provider: "google-antigravity",
              id: "gemini-2.5-flash",
              name: "Gemini 2.5 Flash",
              capabilities: { reasoning: true, coding: true },
            },
            {
              provider: "openai-codex",
              id: "gpt-5.2-codex",
              name: "GPT-5.2 Codex",
              capabilities: { coding: true },
            },
          ],
          onSessionThinkingModelChange: () => undefined,
          onSessionCodingModelChange: () => undefined,
        }),
      ),
      container,
    );

    const thinkingSearch = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "Search thinking models",
    );
    expect(thinkingSearch).toBeDefined();
    thinkingSearch!.value = "flash";
    thinkingSearch!.dispatchEvent(new Event("input", { bubbles: true, composed: true }));

    const thinkingRoot = thinkingSearch?.closest(".compose-dd") as HTMLElement | null;
    const thinkingPro = Array.from(
      thinkingRoot?.querySelectorAll<HTMLElement>(".compose-dd__item") ?? [],
    ).find((item) => item.textContent?.includes("Gemini 2.5 Pro"));
    const thinkingFlash = Array.from(
      thinkingRoot?.querySelectorAll<HTMLElement>(".compose-dd__item") ?? [],
    ).find((item) => item.textContent?.includes("Gemini 2.5 Flash"));
    expect(thinkingPro?.hidden).toBe(true);
    expect(thinkingFlash?.hidden).toBe(false);

    const codingSearch = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "Search coding models",
    );
    expect(codingSearch).toBeDefined();
    codingSearch!.value = "gpt";
    codingSearch!.dispatchEvent(new Event("input", { bubbles: true, composed: true }));

    const codingRoot = codingSearch?.closest(".compose-dd") as HTMLElement | null;
    const codingFlash = Array.from(
      codingRoot?.querySelectorAll<HTMLElement>(".compose-dd__item") ?? [],
    ).find((item) => item.textContent?.includes("Gemini 2.5 Flash"));
    const codingGpt = Array.from(
      codingRoot?.querySelectorAll<HTMLElement>(".compose-dd__item") ?? [],
    ).find((item) => item.textContent?.includes("GPT-5.2 Codex"));
    expect(codingFlash?.hidden).toBe(true);
    expect(codingGpt?.hidden).toBe(false);
  });
});
