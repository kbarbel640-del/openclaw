import { describe, expect, it } from "vitest";
import { normalizeTextForComparison } from "./pi-embedded-helpers.js";
import { DEFAULT_AGENTS_FILENAME } from "./workspace.js";
import path from "node:path";
import os from "node:os";

// Helper for temp paths
const tmp = (p: string) => path.join(os.tmpdir(), p);


const _makeFile = (overrides: Partial<WorkspaceBootstrapFile>): WorkspaceBootstrapFile => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: tmp("AGENTS.md"),
  content: "",
  missing: false,
  ...overrides,
});
describe("normalizeTextForComparison", () => {
  it("lowercases text", () => {
    expect(normalizeTextForComparison("Hello World")).toBe("hello world");
  });
  it("trims whitespace", () => {
    expect(normalizeTextForComparison("  hello  ")).toBe("hello");
  });
  it("collapses multiple spaces", () => {
    expect(normalizeTextForComparison("hello    world")).toBe("hello world");
  });
  it("strips emoji", () => {
    expect(normalizeTextForComparison("Hello 👋 World 🌍")).toBe("hello world");
  });
  it("handles mixed normalization", () => {
    expect(normalizeTextForComparison("  Hello 👋   WORLD  🌍  ")).toBe("hello world");
  });
});
