import { describe, expect, it, vi } from "vitest";
import { createSmartStatus } from "./smart-status.js";

describe("createSmartStatus", () => {
  it("emits tool status on tool_start with Bash command", () => {
    const updates: string[] = [];
    const status = createSmartStatus({
      userMessage: "What's on my calendar?",
      onUpdate: (text) => updates.push(text),
      config: { minIntervalMs: 0 },
    });

    status.push({
      type: "tool_start",
      toolName: "Bash",
      toolCallId: "c1",
      input: { command: "gog calendar events --today" },
    });
    status.dispose();

    expect(updates.length).toBe(1);
    expect(updates[0]).toMatch(/gog calendar/i);
  });

  it("emits tool status on tool_start with Read command", () => {
    const updates: string[] = [];
    const status = createSmartStatus({
      userMessage: "Read the file",
      onUpdate: (text) => updates.push(text),
      config: { minIntervalMs: 0 },
    });

    status.push({
      type: "tool_start",
      toolName: "Read",
      toolCallId: "c2",
      input: { file_path: "/home/user/docs/readme.md" },
    });
    status.dispose();

    expect(updates.length).toBe(1);
    expect(updates[0]).toMatch(/readme\.md/i);
  });

  it("emits thinking excerpts with prefix", () => {
    const updates: string[] = [];
    const status = createSmartStatus({
      userMessage: "Find files",
      onUpdate: (text) => updates.push(text),
      config: { minIntervalMs: 0 },
    });

    status.push({
      type: "thinking",
      text: "Let me check the calendar events for today",
    });
    status.dispose();

    expect(updates.length).toBe(1);
    expect(updates[0]).toMatch(/^\*/);
    expect(updates[0]).toContain("check the calendar");
  });

  it("truncates long thinking excerpts", () => {
    const updates: string[] = [];
    const status = createSmartStatus({
      userMessage: "test",
      onUpdate: (text) => updates.push(text),
      config: { minIntervalMs: 0, maxStatusLength: 30 },
    });

    const longThinking = "A".repeat(100);
    status.push({ type: "thinking", text: longThinking });
    status.dispose();

    expect(updates.length).toBe(1);
    expect(updates[0]).toContain("...");
    expect(updates[0].length).toBeLessThanOrEqual(40);
  });

  it("does not emit for text or tool_result events", () => {
    const updates: string[] = [];
    const status = createSmartStatus({
      userMessage: "test",
      onUpdate: (text) => updates.push(text),
      config: { minIntervalMs: 0 },
    });

    status.push({ type: "text", text: "Here is my response" });
    status.push({ type: "tool_result", toolCallId: "c1", toolName: "Bash", isError: false });
    status.dispose();

    expect(updates.length).toBe(0);
  });

  it("debounces rapid updates", async () => {
    vi.useFakeTimers();
    const updates: string[] = [];
    const status = createSmartStatus({
      userMessage: "test",
      onUpdate: (text) => updates.push(text),
      config: { minIntervalMs: 3000 },
    });

    // First event fires immediately.
    status.push({
      type: "tool_start",
      toolName: "Bash",
      toolCallId: "c1",
      input: { command: "ls /tmp" },
    });
    expect(updates.length).toBe(1);

    // Second event within window is debounced.
    status.push({
      type: "tool_start",
      toolName: "Read",
      toolCallId: "c2",
      input: { file_path: "/tmp/foo.txt" },
    });
    expect(updates.length).toBe(1);

    // After interval elapses, debounced event fires.
    vi.advanceTimersByTime(3000);
    expect(updates.length).toBe(2);

    status.dispose();
    vi.useRealTimers();
  });

  it("suppresses updates during suppression window", () => {
    const updates: string[] = [];
    const status = createSmartStatus({
      userMessage: "test",
      onUpdate: (text) => updates.push(text),
      config: { minIntervalMs: 0 },
    });

    status.suppress(5000);
    status.push({
      type: "tool_start",
      toolName: "Bash",
      toolCallId: "c1",
      input: { command: "ls" },
    });

    expect(updates.length).toBe(0);
    status.dispose();
  });

  it("does not emit duplicate status text", () => {
    const updates: string[] = [];
    const status = createSmartStatus({
      userMessage: "test",
      onUpdate: (text) => updates.push(text),
      config: { minIntervalMs: 0 },
    });

    // Same tool twice should only emit once.
    status.push({
      type: "tool_start",
      toolName: "Bash",
      toolCallId: "c1",
      input: { command: "ls" },
    });
    status.push({
      type: "tool_start",
      toolName: "Bash",
      toolCallId: "c2",
      input: { command: "ls" },
    });
    status.dispose();

    expect(updates.length).toBe(1);
  });

  it("handles multiple different tool types in sequence", () => {
    const updates: string[] = [];
    const status = createSmartStatus({
      userMessage: "test",
      onUpdate: (text) => updates.push(text),
      config: { minIntervalMs: 0 },
    });

    status.push({
      type: "tool_start",
      toolName: "Bash",
      toolCallId: "c1",
      input: { command: "gog calendar events" },
    });
    status.push({
      type: "tool_start",
      toolName: "Read",
      toolCallId: "c2",
      input: { file_path: "/tmp/results.json" },
    });
    status.dispose();

    expect(updates.length).toBe(2);
    expect(updates[0]).toMatch(/gog calendar/i);
    expect(updates[1]).toMatch(/results\.json/i);
  });
});
