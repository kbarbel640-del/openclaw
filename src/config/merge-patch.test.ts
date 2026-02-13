import { describe, expect, it } from "vitest";
import { applyMergePatch } from "./merge-patch.js";

describe("applyMergePatch", () => {
  it("returns patch when patch is not a plain object", () => {
    expect(applyMergePatch({ a: 1 }, "hello")).toBe("hello");
    expect(applyMergePatch({ a: 1 }, 42)).toBe(42);
    expect(applyMergePatch({ a: 1 }, null)).toBe(null);
    expect(applyMergePatch({ a: 1 }, true)).toBe(true);
  });

  it("returns patch array (replaces base)", () => {
    expect(applyMergePatch({ a: 1 }, [1, 2])).toEqual([1, 2]);
  });

  it("merges top-level keys", () => {
    const result = applyMergePatch({ a: 1, b: 2 }, { b: 3, c: 4 });
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("deletes keys set to null", () => {
    const result = applyMergePatch({ a: 1, b: 2 }, { b: null });
    expect(result).toEqual({ a: 1 });
  });

  it("recursively merges nested objects", () => {
    const base = { a: { x: 1, y: 2 }, b: 3 };
    const patch = { a: { y: 99, z: 100 } };
    expect(applyMergePatch(base, patch)).toEqual({ a: { x: 1, y: 99, z: 100 }, b: 3 });
  });

  it("replaces non-object base value with object patch", () => {
    const result = applyMergePatch({ a: "string" }, { a: { nested: true } });
    expect(result).toEqual({ a: { nested: true } });
  });

  it("creates object from empty base when patch is object", () => {
    expect(applyMergePatch(null, { a: 1 })).toEqual({ a: 1 });
    expect(applyMergePatch(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(applyMergePatch("string", { a: 1 })).toEqual({ a: 1 });
  });

  it("handles deeply nested null deletions", () => {
    const base = { a: { b: { c: 1, d: 2 } } };
    const patch = { a: { b: { c: null } } };
    expect(applyMergePatch(base, patch)).toEqual({ a: { b: { d: 2 } } });
  });

  it("handles empty patch (no-op)", () => {
    const base = { a: 1, b: 2 };
    expect(applyMergePatch(base, {})).toEqual({ a: 1, b: 2 });
  });

  it("does not mutate base", () => {
    const base = { a: 1, b: { c: 2 } };
    const copy = JSON.parse(JSON.stringify(base));
    applyMergePatch(base, { a: 99 });
    expect(base).toEqual(copy);
  });
});
