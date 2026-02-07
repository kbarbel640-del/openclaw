import { describe, expect, it } from "vitest";
import type { SessionEntry } from "../config/sessions.js";
import { applyVerboseOverride, parseVerboseOverride } from "./level-overrides.js";

function makeEntry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return { sessionId: "test", updatedAt: 0, ...overrides };
}

describe("parseVerboseOverride", () => {
  it("returns { ok: true, value: null } for null input (clear override)", () => {
    expect(parseVerboseOverride(null)).toEqual({ ok: true, value: null });
  });

  it("returns { ok: true, value: undefined } for undefined input", () => {
    expect(parseVerboseOverride(undefined)).toEqual({ ok: true, value: undefined });
  });

  it('normalizes "on" to VerboseLevel', () => {
    const result = parseVerboseOverride("on");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("on");
    }
  });

  it('normalizes "off" to VerboseLevel', () => {
    const result = parseVerboseOverride("off");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("off");
    }
  });

  it('normalizes "full" to VerboseLevel', () => {
    const result = parseVerboseOverride("full");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("full");
    }
  });

  it('normalizes aliases like "true" → "on"', () => {
    const result = parseVerboseOverride("true");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("on");
    }
  });

  it('normalizes aliases like "false" → "off"', () => {
    const result = parseVerboseOverride("false");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("off");
    }
  });

  it("rejects invalid string values", () => {
    const result = parseVerboseOverride("invalid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("invalid verboseLevel");
    }
  });

  it("rejects non-string types (number)", () => {
    const result = parseVerboseOverride(42);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("invalid verboseLevel");
    }
  });

  it("rejects non-string types (object)", () => {
    const result = parseVerboseOverride({ level: "on" });
    expect(result.ok).toBe(false);
  });
});

describe("applyVerboseOverride", () => {
  it("sets verboseLevel when a valid level is provided", () => {
    const entry = makeEntry();
    applyVerboseOverride(entry, "on");
    expect(entry.verboseLevel).toBe("on");
  });

  it("overwrites an existing verboseLevel", () => {
    const entry = makeEntry({ verboseLevel: "on" });
    applyVerboseOverride(entry, "off");
    expect(entry.verboseLevel).toBe("off");
  });

  it("deletes verboseLevel when null is passed (clear)", () => {
    const entry = makeEntry({ verboseLevel: "on" });
    applyVerboseOverride(entry, null);
    expect(entry.verboseLevel).toBeUndefined();
  });

  it("does nothing when undefined is passed (no-op)", () => {
    const entry = makeEntry({ verboseLevel: "on" });
    applyVerboseOverride(entry, undefined);
    expect(entry.verboseLevel).toBe("on");
  });

  it("does nothing on a clean entry when undefined is passed", () => {
    const entry = makeEntry();
    applyVerboseOverride(entry, undefined);
    expect("verboseLevel" in entry).toBe(false);
  });
});
