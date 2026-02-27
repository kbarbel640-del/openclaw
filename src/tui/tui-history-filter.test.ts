import { describe, it, expect } from "vitest";
import { filterSystemMessages } from "./tui-history-filter.js";

describe("filterSystemMessages", () => {
  it("returns empty array unchanged", () => {
    expect(filterSystemMessages([])).toEqual([]);
  });

  it("passes through normal user and assistant messages", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "Hello!" }] },
      { role: "assistant", content: [{ type: "text", text: "Hi there!" }] },
    ];
    expect(filterSystemMessages(messages)).toEqual(messages);
  });

  it("filters heartbeat user message and HEARTBEAT_OK response pair", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "How are you?" }] },
      { role: "assistant", content: [{ type: "text", text: "Good!" }] },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Read HEARTBEAT.md if it exists. If nothing needs attention, reply HEARTBEAT_OK.",
          },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "HEARTBEAT_OK" }] },
      { role: "user", content: [{ type: "text", text: "What time is it?" }] },
    ];
    const result = filterSystemMessages(messages);
    expect(result).toEqual([
      { role: "user", content: [{ type: "text", text: "How are you?" }] },
      { role: "assistant", content: [{ type: "text", text: "Good!" }] },
      { role: "user", content: [{ type: "text", text: "What time is it?" }] },
    ]);
  });

  it("filters memory flush user message and NO_REPLY response pair", () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Pre-compaction memory flush. Store durable memories now.",
          },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
    ];
    expect(filterSystemMessages(messages)).toEqual([]);
  });

  it("filters standalone NO_REPLY assistant messages", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "Hey" }] },
      { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
      { role: "user", content: [{ type: "text", text: "Hello?" }] },
    ];
    const result = filterSystemMessages(messages);
    expect(result).toEqual([
      { role: "user", content: [{ type: "text", text: "Hey" }] },
      { role: "user", content: [{ type: "text", text: "Hello?" }] },
    ]);
  });

  it("keeps heartbeat alert responses (non-silent)", () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Read HEARTBEAT.md. reply HEARTBEAT_OK if nothing needs attention.",
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "⚠️ Disk space low: 92% used on /dev/sda1" }],
      },
    ];
    const result = filterSystemMessages(messages);
    // The system user message is filtered, but the alert assistant response is kept
    expect(result).toEqual([
      {
        role: "assistant",
        content: [{ type: "text", text: "⚠️ Disk space low: 92% used on /dev/sda1" }],
      },
    ]);
  });

  it("filters post-compaction audit messages", () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "System: [2026-02-22] ⚠️ Post-Compaction Audit: The following files were not read...",
          },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
    ];
    expect(filterSystemMessages(messages)).toEqual([]);
  });

  it("filters compaction status messages", () => {
    const messages = [
      {
        role: "user",
        content: [{ type: "text", text: "Compacted • Context 147k/200k (74%)" }],
      },
      { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
    ];
    expect(filterSystemMessages(messages)).toEqual([]);
  });

  it("handles string content format", () => {
    const messages = [
      { role: "user", content: "Pre-compaction memory flush. Save important context." },
      { role: "assistant", content: "NO_REPLY" },
    ];
    expect(filterSystemMessages(messages)).toEqual([]);
  });

  it("handles messages with metadata prefix followed by system content", () => {
    // After stripLeadingInboundMetadata runs, the text may still contain system prompts
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract key decisions. If no user-visible reply is needed, start with NO_REPLY.\nHeartbeat prompt. reply HEARTBEAT_OK.",
          },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "HEARTBEAT_OK" }] },
    ];
    expect(filterSystemMessages(messages)).toEqual([]);
  });

  it("does not filter normal messages containing system keywords in context", () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Can you explain what HEARTBEAT_OK means in OpenClaw?",
          },
        ],
      },
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "HEARTBEAT_OK is the response token used when heartbeat checks find nothing actionable.",
          },
        ],
      },
    ];
    // This should NOT be filtered because the user message doesn't match system patterns
    // (it asks about HEARTBEAT_OK but doesn't contain "reply HEARTBEAT_OK")
    expect(filterSystemMessages(messages)).toEqual(messages);
  });

  it("filters NO_FLUSH standalone responses", () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Pre-compaction memory flush. If nothing to store, reply NO_FLUSH.",
          },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "NO_FLUSH" }] },
    ];
    expect(filterSystemMessages(messages)).toEqual([]);
  });
});
