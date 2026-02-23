import { describe, expect, it, vi } from "vitest";
import { isDescendantOf } from "./restart-health.js";

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    readFileSync: vi.fn(),
  };
});

import { readFileSync } from "node:fs";

const mockedReadFileSync = vi.mocked(readFileSync);

describe("isDescendantOf", () => {
  it("returns true when child is a direct child of ancestor", () => {
    mockedReadFileSync.mockReturnValueOnce("Name:\topenclaw-gateway\nPPid:\t100\n");
    expect(isDescendantOf(200, 100)).toBe(true);
  });

  it("returns true when child is a grandchild of ancestor", () => {
    mockedReadFileSync
      .mockReturnValueOnce("Name:\topenclaw-gateway\nPPid:\t150\n")
      .mockReturnValueOnce("Name:\topenclaw\nPPid:\t100\n");
    expect(isDescendantOf(200, 100)).toBe(true);
  });

  it("returns false when child is not a descendant", () => {
    mockedReadFileSync.mockReturnValueOnce("Name:\tunrelated\nPPid:\t999\n");
    mockedReadFileSync.mockReturnValueOnce("Name:\tinit\nPPid:\t0\n");
    expect(isDescendantOf(200, 100)).toBe(false);
  });

  it("returns false when /proc read fails (non-Linux)", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(isDescendantOf(200, 100)).toBe(false);
  });

  it("returns false when PPid field is missing", () => {
    mockedReadFileSync.mockReturnValueOnce("Name:\topenclaw\n");
    expect(isDescendantOf(200, 100)).toBe(false);
  });

  it("returns true when child equals ancestor (identity)", () => {
    expect(isDescendantOf(100, 100)).toBe(true);
  });

  it("returns false for pid 1 (init) to prevent infinite loop", () => {
    mockedReadFileSync.mockReturnValueOnce("Name:\tinit\nPPid:\t0\n");
    expect(isDescendantOf(1, 100)).toBe(false);
  });
});
