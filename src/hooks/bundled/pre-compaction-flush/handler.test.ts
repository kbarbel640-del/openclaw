import { describe, expect, it } from "vitest";
import type { InternalHookEvent } from "../../internal-hooks.js";
import { handler } from "./handler.js";

function createMockEvent(overrides: Partial<InternalHookEvent> = {}): InternalHookEvent {
  return {
    type: "command",
    action: "compact",
    sessionKey: "agent:main:main",
    context: {},
    timestamp: new Date(),
    messages: [],
    ...overrides,
  };
}

describe("pre-compaction-flush handler", () => {
  it("should inject a flush message on compact command", async () => {
    const event = createMockEvent();
    await handler(event);
    expect(event.messages.length).toBe(1);
    expect(event.messages[0]).toContain("Context was just compacted");
    expect(event.messages[0]).toContain("memory/YYYY-MM-DD.md");
    expect(event.messages[0]).toContain("PROJECT-STATE.md");
  });

  it("should not inject on non-compact commands", async () => {
    const event = createMockEvent({ action: "new" });
    await handler(event);
    expect(event.messages.length).toBe(0);
  });

  it("should not inject on non-command events", async () => {
    const event = createMockEvent({ type: "session" as any, action: "compact" });
    await handler(event);
    expect(event.messages.length).toBe(0);
  });

  it("should mention handoff files in the flush message", async () => {
    const event = createMockEvent();
    await handler(event);
    expect(event.messages[0]).toContain("handoff file");
  });
});
