import { describe, test, expect } from "vitest";
import { mergeDefaults } from "./index.js";

describe("config-preset plugin", () => {
  test("plugin exports correct id", async () => {
    const { default: plugin } = await import("./index.js");
    expect(plugin.id).toBe("config-preset");
  });

  test("mergeDefaults sets missing keys", () => {
    const base = { a: 1 };
    const patch = { b: 2 };
    expect(mergeDefaults(base, patch)).toEqual({ a: 1, b: 2 });
  });

  test("mergeDefaults does not overwrite existing keys", () => {
    const base = { a: 1, b: "original" };
    const patch = { b: "overwrite", c: 3 };
    expect(mergeDefaults(base, patch)).toEqual({ a: 1, b: "original", c: 3 });
  });

  test("mergeDefaults recurses into nested objects", () => {
    const base = { agents: { defaults: { model: "existing" } } };
    const patch = { agents: { defaults: { model: "new", maxConcurrent: 4 }, extra: true } };
    expect(mergeDefaults(base, patch)).toEqual({
      agents: { defaults: { model: "existing", maxConcurrent: 4 }, extra: true },
    });
  });

  test("mergeDefaults does not overwrite scalars with objects", () => {
    const base = { key: "string-value" };
    const patch = { key: { nested: true } };
    expect(mergeDefaults(base, patch)).toEqual({ key: "string-value" });
  });

  test("mergeDefaults skips null/undefined patch values", () => {
    const base = { a: 1 };
    const patch = { b: null, c: undefined, d: 42 };
    expect(mergeDefaults(base, patch as Record<string, unknown>)).toEqual({ a: 1, d: 42 });
  });

  test("mergeDefaults handles empty base", () => {
    const base = {};
    const patch = { gateway: { mode: "local", port: 18789 } };
    expect(mergeDefaults(base, patch)).toEqual({ gateway: { mode: "local", port: 18789 } });
  });

  test("mergeDefaults handles empty patch", () => {
    const base = { a: 1 };
    expect(mergeDefaults(base, {})).toEqual({ a: 1 });
  });

  test("mergeDefaults preserves arrays in base", () => {
    const base = { list: [1, 2, 3] };
    const patch = { list: [4, 5] };
    // Existing array is not overwritten.
    expect(mergeDefaults(base, patch)).toEqual({ list: [1, 2, 3] });
  });

  test("mergeDefaults sets array when key is missing", () => {
    const base = {};
    const patch = { list: [1, 2, 3] };
    expect(mergeDefaults(base, patch)).toEqual({ list: [1, 2, 3] });
  });
});
