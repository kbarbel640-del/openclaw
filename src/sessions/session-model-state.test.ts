import { describe, expect, it } from "vitest";
import { formatModelState, resolveSessionModelState } from "./session-model-state.js";
import type { SessionEntry } from "../config/sessions.js";

const mockSession: SessionEntry = {
  sessionId: "test",
  channel: "whatsapp",
  from: "1234567890",
  to: "1234567890",
  chatType: "direct",
};

describe("resolveSessionModelState", () => {
  it("uses configured model when no override", () => {
    const state = resolveSessionModelState({
      sessionEntry: mockSession,
      configuredProvider: "anthropic",
      configuredModel: "claude-opus",
    });

    expect(state.requestedModel).toBe("claude-opus");
    expect(state.requestedProvider).toBe("anthropic");
    expect(state.actualModel).toBe("claude-opus");
    expect(state.actualProvider).toBe("anthropic");
    expect(state.hasMismatch).toBe(false);
  });

  it("uses override model when set", () => {
    const session: SessionEntry = {
      ...mockSession,
      modelOverride: "gpt-4",
      providerOverride: "openai",
    };

    const state = resolveSessionModelState({
      sessionEntry: session,
      configuredProvider: "anthropic",
      configuredModel: "claude-opus",
    });

    expect(state.requestedModel).toBe("gpt-4");
    expect(state.requestedProvider).toBe("openai");
    expect(state.actualModel).toBe("gpt-4");
    expect(state.actualProvider).toBe("openai");
    expect(state.hasMismatch).toBe(false);
  });

  it("detects mismatch when actual differs from requested", () => {
    const state = resolveSessionModelState({
      sessionEntry: mockSession,
      configuredProvider: "anthropic",
      configuredModel: "claude-opus",
      actualRunningProvider: "openai",
      actualRunningModel: "gpt-4-fallback",
    });

    expect(state.requestedProvider).toBe("anthropic");
    expect(state.requestedModel).toBe("claude-opus");
    expect(state.actualProvider).toBe("openai");
    expect(state.actualModel).toBe("gpt-4-fallback");
    expect(state.hasMismatch).toBe(true);
  });

  it("detects provider mismatch only", () => {
    const state = resolveSessionModelState({
      sessionEntry: mockSession,
      configuredProvider: "anthropic",
      configuredModel: "claude-opus",
      actualRunningProvider: "openai",
      actualRunningModel: "claude-opus",
    });

    expect(state.hasMismatch).toBe(true);
  });

  it("detects model mismatch only", () => {
    const state = resolveSessionModelState({
      sessionEntry: mockSession,
      configuredProvider: "anthropic",
      configuredModel: "claude-opus",
      actualRunningProvider: "anthropic",
      actualRunningModel: "claude-sonnet",
    });

    expect(state.hasMismatch).toBe(true);
  });

  it("handles whitespace in overrides", () => {
    const session: SessionEntry = {
      ...mockSession,
      modelOverride: "  gpt-4  ",
      providerOverride: "  openai  ",
    };

    const state = resolveSessionModelState({
      sessionEntry: session,
      configuredProvider: "anthropic",
      configuredModel: "claude-opus",
    });

    expect(state.requestedModel).toBe("gpt-4");
    expect(state.requestedProvider).toBe("openai");
  });
});

describe("formatModelState", () => {
  it("formats model without mismatch", () => {
    const state = {
      requestedModel: "claude-opus",
      requestedProvider: "anthropic",
      actualModel: "claude-opus",
      actualProvider: "anthropic",
      hasMismatch: false,
    };

    expect(formatModelState(state)).toBe("anthropic/claude-opus");
  });

  it("shows mismatch in format", () => {
    const state = {
      requestedModel: "claude-opus",
      requestedProvider: "anthropic",
      actualModel: "gpt-4",
      actualProvider: "openai",
      hasMismatch: true,
    };

    expect(formatModelState(state)).toContain("anthropic/claude-opus");
    expect(formatModelState(state)).toContain("openai/gpt-4");
    expect(formatModelState(state)).toContain("running:");
  });
});
