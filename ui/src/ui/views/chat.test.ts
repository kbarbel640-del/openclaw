import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { SessionsListResult } from "../types.ts";
import { renderChat, type ChatProps, isAllowedFileType, formatFileSize } from "./chat.ts";

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
      (btn) => btn.textContent?.trim() === "New session",
    );
    expect(newSessionButton).not.toBeUndefined();
    newSessionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onNewSession).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Stop");
  });
});

describe("isAllowedFileType", () => {
  it("allows image types", () => {
    expect(isAllowedFileType("image/png")).toBe(true);
    expect(isAllowedFileType("image/jpeg")).toBe(true);
    expect(isAllowedFileType("image/gif")).toBe(true);
    expect(isAllowedFileType("image/webp")).toBe(true);
    expect(isAllowedFileType("image/svg+xml")).toBe(true);
  });

  it("allows PDF files", () => {
    expect(isAllowedFileType("application/pdf")).toBe(true);
  });

  it("allows text files", () => {
    expect(isAllowedFileType("text/plain")).toBe(true);
    expect(isAllowedFileType("text/markdown")).toBe(true);
    expect(isAllowedFileType("text/csv")).toBe(true);
  });

  it("allows JSON files", () => {
    expect(isAllowedFileType("application/json")).toBe(true);
  });

  it("rejects other file types", () => {
    expect(isAllowedFileType("application/zip")).toBe(false);
    expect(isAllowedFileType("application/octet-stream")).toBe(false);
    expect(isAllowedFileType("video/mp4")).toBe(false);
    expect(isAllowedFileType("audio/mpeg")).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10240)).toBe("10.0 KB");
    expect(formatFileSize(1024 * 1024 - 1)).toBe("1024.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1024 * 1024 * 5)).toBe("5.0 MB");
    expect(formatFileSize(1024 * 1024 * 25)).toBe("25.0 MB");
  });
});
