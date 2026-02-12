import { describe, expect, it } from "vitest";
import { isFileWriteTool } from "./file-change-hook.js";

describe("file-change-hook", () => {
  describe("isFileWriteTool", () => {
    it("recognizes write tool", () => {
      expect(isFileWriteTool("write")).toBe(true);
    });

    it("recognizes edit tool", () => {
      expect(isFileWriteTool("edit")).toBe(true);
    });

    it("recognizes apply_patch tool", () => {
      expect(isFileWriteTool("apply_patch")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(isFileWriteTool("Write")).toBe(true);
      expect(isFileWriteTool("EDIT")).toBe(true);
    });

    it("rejects non-write tools", () => {
      expect(isFileWriteTool("read")).toBe(false);
      expect(isFileWriteTool("exec")).toBe(false);
      expect(isFileWriteTool("message")).toBe(false);
    });
  });
});
