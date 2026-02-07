import { describe, expect, it } from "vitest";
import { applyMergePatch } from "./merge-patch.js";

describe("applyMergePatch", () => {
  it("sets a new key on an empty base", () => {
    expect(applyMergePatch({}, { a: 1 })).toEqual({ a: 1 });
  });

  it("overwrites an existing key", () => {
    expect(applyMergePatch({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("preserves keys not in the patch", () => {
    expect(applyMergePatch({ a: 1, b: 2 }, { b: 3 })).toEqual({ a: 1, b: 3 });
  });

  it("removes a key when patch value is null", () => {
    expect(applyMergePatch({ a: 1, b: 2 }, { b: null })).toEqual({ a: 1 });
  });

  it("recursively merges nested objects", () => {
    const base = { nested: { x: 1, y: 2 } };
    const patch = { nested: { y: 3, z: 4 } };
    expect(applyMergePatch(base, patch)).toEqual({ nested: { x: 1, y: 3, z: 4 } });
  });

  it("removes a nested key when patch value is null", () => {
    const base = { nested: { x: 1, y: 2 } };
    const patch = { nested: { y: null } };
    expect(applyMergePatch(base, patch)).toEqual({ nested: { x: 1 } });
  });

  it("replaces a primitive base value with an object patch", () => {
    expect(applyMergePatch("string", { a: 1 })).toEqual({ a: 1 });
  });

  it("replaces an object base with a primitive patch", () => {
    expect(applyMergePatch({ a: 1 }, "replaced" as unknown)).toBe("replaced");
  });

  it("replaces an object base with a number patch", () => {
    expect(applyMergePatch({ a: 1 }, 42 as unknown)).toBe(42);
  });

  it("replaces base with null patch", () => {
    expect(applyMergePatch({ a: 1 }, null as unknown)).toBeNull();
  });

  it("creates a new object when base is not a plain object", () => {
    expect(applyMergePatch(null, { a: 1 })).toEqual({ a: 1 });
  });

  it("handles array base replaced by object patch", () => {
    expect(applyMergePatch([1, 2, 3], { a: 1 })).toEqual({ a: 1 });
  });

  it("replaces arrays in patch (no array merge)", () => {
    const base = { list: [1, 2, 3] };
    const patch = { list: [4, 5] };
    expect(applyMergePatch(base, patch)).toEqual({ list: [4, 5] });
  });

  it("does not mutate the original base object", () => {
    const base = { a: 1, b: 2 };
    const copy = { ...base };
    applyMergePatch(base, { b: 3, c: 4 });
    expect(base).toEqual(copy);
  });

  it("handles deeply nested merges", () => {
    const base = { a: { b: { c: { d: 1, e: 2 } } } };
    const patch = { a: { b: { c: { e: 3, f: 4 } } } };
    expect(applyMergePatch(base, patch)).toEqual({
      a: { b: { c: { d: 1, e: 3, f: 4 } } },
    });
  });

  it("handles an empty patch (no changes)", () => {
    const base = { a: 1, b: 2 };
    expect(applyMergePatch(base, {})).toEqual({ a: 1, b: 2 });
  });

  it("creates nested structure from non-object base", () => {
    expect(applyMergePatch(undefined, { a: { b: 1 } })).toEqual({ a: { b: 1 } });
  });
});
