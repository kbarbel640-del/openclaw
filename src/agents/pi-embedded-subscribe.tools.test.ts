import { beforeEach, describe, expect, it } from "vitest";
import { telegramPlugin } from "../../extensions/telegram/src/channel.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import {
  extractMessagingToolSend,
  extractToolErrorMessage,
  isToolResultError,
} from "./pi-embedded-subscribe.tools.js";

describe("extractMessagingToolSend", () => {
  beforeEach(() => {
    setActivePluginRegistry(
      createTestRegistry([{ pluginId: "telegram", plugin: telegramPlugin, source: "test" }]),
    );
  });

  it("uses channel as provider for message tool", () => {
    const result = extractMessagingToolSend("message", {
      action: "send",
      channel: "telegram",
      to: "123",
    });

    expect(result?.tool).toBe("message");
    expect(result?.provider).toBe("telegram");
    expect(result?.to).toBe("telegram:123");
  });

  it("prefers provider when both provider and channel are set", () => {
    const result = extractMessagingToolSend("message", {
      action: "send",
      provider: "slack",
      channel: "telegram",
      to: "channel:C1",
    });

    expect(result?.tool).toBe("message");
    expect(result?.provider).toBe("slack");
    expect(result?.to).toBe("channel:c1");
  });
});

describe("isToolResultError", () => {
  it("returns true when details.status is 'error'", () => {
    const result = {
      content: [{ type: "text", text: "Error occurred" }],
      details: { status: "error" },
    };
    expect(isToolResultError(result)).toBe(true);
  });

  it("returns true when details.status is 'timeout'", () => {
    const result = {
      content: [{ type: "text", text: "Timeout" }],
      details: { status: "timeout" },
    };
    expect(isToolResultError(result)).toBe(true);
  });

  it("returns false when details.status is 'ok'", () => {
    const result = {
      content: [{ type: "text", text: "Success" }],
      details: { status: "ok" },
    };
    expect(isToolResultError(result)).toBe(false);
  });

  it("returns false when details.status is missing", () => {
    const result = {
      content: [{ type: "text", text: "No status" }],
      details: {},
    };
    expect(isToolResultError(result)).toBe(false);
  });
});

describe("extractToolErrorMessage", () => {
  it("extracts error from details.error field", () => {
    const result = {
      content: [],
      details: { error: "Connection failed" },
    };
    expect(extractToolErrorMessage(result)).toBe("Connection failed");
  });

  it("extracts error from details.message field", () => {
    const result = {
      content: [],
      details: { message: "Invalid input" },
    };
    expect(extractToolErrorMessage(result)).toBe("Invalid input");
  });

  it("extracts error from root-level error field", () => {
    const result = {
      error: "Root level error",
      content: [],
      details: {},
    };
    expect(extractToolErrorMessage(result)).toBe("Root level error");
  });

  it("extracts error from TOON-encoded content with sentinel", () => {
    const result = {
      content: [
        {
          type: "text",
          text: "# toon\nerror: Authentication failed\ncode: 401",
        },
      ],
      details: {},
    };
    expect(extractToolErrorMessage(result)).toBe("Authentication failed");
  });

  it("handles TOON content with extra whitespace in sentinel", () => {
    const result = {
      content: [
        {
          type: "text",
          text: "# toon  \nerror: Rate limit exceeded",
        },
      ],
      details: {},
    };
    expect(extractToolErrorMessage(result)).toBe("Rate limit exceeded");
  });

  it("extracts error from JSON-encoded content", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: "JSON error message", code: 500 }),
        },
      ],
      details: {},
    };
    expect(extractToolErrorMessage(result)).toBe("JSON error message");
  });

  it("extracts nested error.message from JSON content", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: { message: "Nested error" },
          }),
        },
      ],
      details: {},
    };
    expect(extractToolErrorMessage(result)).toBe("Nested error");
  });

  it("falls back to plain text when no structured error found", () => {
    const result = {
      content: [
        {
          type: "text",
          text: "Plain error message",
        },
      ],
      details: {},
    };
    expect(extractToolErrorMessage(result)).toBe("Plain error message");
  });

  it("returns undefined when no error information is available", () => {
    const result = {
      content: [],
      details: {},
    };
    expect(extractToolErrorMessage(result)).toBeUndefined();
  });

  it("truncates long error messages to max length", () => {
    const longError = "x".repeat(500);
    const result = {
      content: [],
      details: { error: longError },
    };
    const extracted = extractToolErrorMessage(result);
    expect(extracted).toBeDefined();
    expect(extracted!.length).toBeLessThanOrEqual(401); // 400 + ellipsis
  });

  it("extracts only first line from multi-line errors", () => {
    const result = {
      content: [],
      details: {
        error: "First line error\nSecond line\nThird line",
      },
    };
    expect(extractToolErrorMessage(result)).toBe("First line error");
  });

  it("prioritizes details over content blocks", () => {
    const result = {
      content: [
        {
          type: "text",
          text: "# toon\nerror: Content error",
        },
      ],
      details: { error: "Details error" },
    };
    // Should extract from details first
    expect(extractToolErrorMessage(result)).toBe("Details error");
  });

  it("handles TOON parsing failure gracefully", () => {
    const result = {
      content: [
        {
          type: "text",
          text: "# toon\ninvalid toon format {{{}}}",
        },
      ],
      details: {},
    };
    // Should fall back to plain text extraction
    const extracted = extractToolErrorMessage(result);
    expect(extracted).toBeTruthy();
  });

  it("handles JSON parsing failure gracefully", () => {
    const result = {
      content: [
        {
          type: "text",
          text: "{invalid json",
        },
      ],
      details: {},
    };
    // Should fall back to plain text
    expect(extractToolErrorMessage(result)).toBe("{invalid json");
  });

  it("skips non-text content blocks", () => {
    const result = {
      content: [
        { type: "image", data: "base64...", mimeType: "image/png" },
        { type: "text", text: "# toon\nerror: Found it" },
      ],
      details: {},
    };
    expect(extractToolErrorMessage(result)).toBe("Found it");
  });

  it("extracts from details.reason field", () => {
    const result = {
      content: [],
      details: { reason: "Timeout exceeded" },
    };
    expect(extractToolErrorMessage(result)).toBe("Timeout exceeded");
  });
});
