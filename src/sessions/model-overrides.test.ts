import { describe, expect, test } from "vitest";
import type { SessionEntry } from "../config/sessions.js";
import { applyModelOverrideToSessionEntry } from "./model-overrides.js";

function makeEntry(overrides?: Partial<SessionEntry>): SessionEntry {
  return {
    sessionId: "test-session",
    updatedAt: 1000,
    ...overrides,
  };
}

describe("applyModelOverrideToSessionEntry", () => {
  describe("non-default selection (switching to a specific model)", () => {
    test("sets both override and display fields", () => {
      const entry = makeEntry();
      const { updated } = applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "openai", model: "gpt-5.2" },
      });

      expect(updated).toBe(true);
      expect(entry.providerOverride).toBe("openai");
      expect(entry.modelOverride).toBe("gpt-5.2");
      expect(entry.modelProvider).toBe("openai");
      expect(entry.model).toBe("gpt-5.2");
    });

    test("updates display fields when override fields already match but display fields are stale", () => {
      const entry = makeEntry({
        providerOverride: "openai",
        modelOverride: "gpt-5.2",
        modelProvider: "anthropic",
        model: "claude-opus-4-5",
      });
      const { updated } = applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "openai", model: "gpt-5.2" },
      });

      expect(updated).toBe(true);
      expect(entry.modelProvider).toBe("openai");
      expect(entry.model).toBe("gpt-5.2");
    });

    test("returns updated=false when all fields already match", () => {
      const entry = makeEntry({
        providerOverride: "openai",
        modelOverride: "gpt-5.2",
        modelProvider: "openai",
        model: "gpt-5.2",
      });
      const { updated } = applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "openai", model: "gpt-5.2" },
      });

      expect(updated).toBe(false);
    });

    test("switches from one model to another, updating all fields", () => {
      const entry = makeEntry({
        providerOverride: "anthropic",
        modelOverride: "claude-opus-4-5",
        modelProvider: "anthropic",
        model: "claude-opus-4-5",
      });
      const { updated } = applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "openai", model: "gpt-5.2" },
      });

      expect(updated).toBe(true);
      expect(entry.providerOverride).toBe("openai");
      expect(entry.modelOverride).toBe("gpt-5.2");
      expect(entry.modelProvider).toBe("openai");
      expect(entry.model).toBe("gpt-5.2");
    });
  });

  describe("default selection (reverting to configured default)", () => {
    test("clears both override and display fields", () => {
      const entry = makeEntry({
        providerOverride: "openai",
        modelOverride: "gpt-5.2",
        modelProvider: "openai",
        model: "gpt-5.2",
      });
      const { updated } = applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "anthropic", model: "claude-opus-4-5", isDefault: true },
      });

      expect(updated).toBe(true);
      expect(entry.providerOverride).toBeUndefined();
      expect(entry.modelOverride).toBeUndefined();
      expect(entry.modelProvider).toBeUndefined();
      expect(entry.model).toBeUndefined();
    });

    test("returns updated=false when entry is already clean", () => {
      const entry = makeEntry();
      const { updated } = applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "anthropic", model: "claude-opus-4-5", isDefault: true },
      });

      expect(updated).toBe(false);
    });

    test("clears display fields even when override fields were already absent", () => {
      const entry = makeEntry({
        modelProvider: "openai",
        model: "gpt-5.2",
      });
      const { updated } = applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "anthropic", model: "claude-opus-4-5", isDefault: true },
      });

      expect(updated).toBe(true);
      expect(entry.modelProvider).toBeUndefined();
      expect(entry.model).toBeUndefined();
    });
  });

  describe("auth profile override handling", () => {
    test("sets auth profile alongside model override", () => {
      const entry = makeEntry();
      const { updated } = applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "openai", model: "gpt-5.2" },
        profileOverride: "openai:custom",
      });

      expect(updated).toBe(true);
      expect(entry.authProfileOverride).toBe("openai:custom");
      expect(entry.authProfileOverrideSource).toBe("user");
    });

    test("clears auth profile when switching model without profile", () => {
      const entry = makeEntry({
        providerOverride: "anthropic",
        modelOverride: "claude-opus-4-5",
        modelProvider: "anthropic",
        model: "claude-opus-4-5",
        authProfileOverride: "anthropic:default",
        authProfileOverrideSource: "user" as const,
        authProfileOverrideCompactionCount: 3,
      });
      const { updated } = applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "openai", model: "gpt-5.2" },
      });

      expect(updated).toBe(true);
      expect(entry.authProfileOverride).toBeUndefined();
      expect(entry.authProfileOverrideSource).toBeUndefined();
      expect(entry.authProfileOverrideCompactionCount).toBeUndefined();
    });
  });

  describe("updatedAt timestamp", () => {
    test("updates timestamp when changes are made", () => {
      const entry = makeEntry({ updatedAt: 1000 });
      applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "openai", model: "gpt-5.2" },
      });

      expect(entry.updatedAt).toBeGreaterThan(1000);
    });

    test("does not update timestamp when no changes are made", () => {
      const entry = makeEntry({
        updatedAt: 1000,
        providerOverride: "openai",
        modelOverride: "gpt-5.2",
        modelProvider: "openai",
        model: "gpt-5.2",
      });
      applyModelOverrideToSessionEntry({
        entry,
        selection: { provider: "openai", model: "gpt-5.2" },
      });

      expect(entry.updatedAt).toBe(1000);
    });
  });

  test("regression: session list shows new model immediately after switch (issue #18603)", () => {
    // Simulate the exact bug scenario: user switches model, then session list
    // returns stale display fields because only override fields were updated.
    const entry = makeEntry({
      modelProvider: "anthropic",
      model: "claude-opus-4-5",
    });

    // User switches to gpt-5.2
    applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openai", model: "gpt-5.2" },
    });

    // Session list reads entry.model and entry.modelProvider (the display fields).
    // Before the fix, these would still show the old model.
    expect(entry.model).toBe("gpt-5.2");
    expect(entry.modelProvider).toBe("openai");

    // Also verify override fields for runtime model resolution
    expect(entry.modelOverride).toBe("gpt-5.2");
    expect(entry.providerOverride).toBe("openai");
  });
});
