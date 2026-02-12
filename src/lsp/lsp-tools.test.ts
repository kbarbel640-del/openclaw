import { describe, expect, it } from "vitest";
import { createLspTools } from "./lsp-tools.js";

describe("lsp-tools", () => {
  describe("createLspTools", () => {
    it("creates all five LSP tools", () => {
      const tools = createLspTools();
      expect(tools).toHaveLength(5);
    });

    it("includes lsp_diagnostics tool", () => {
      const tools = createLspTools();
      const diag = tools.find((t) => t.name === "lsp_diagnostics");
      expect(diag).toBeDefined();
      expect(diag!.description).toContain("diagnostics");
    });

    it("includes lsp_hover tool", () => {
      const tools = createLspTools();
      const hover = tools.find((t) => t.name === "lsp_hover");
      expect(hover).toBeDefined();
      expect(hover!.description).toContain("hover");
    });

    it("includes lsp_definition tool", () => {
      const tools = createLspTools();
      const def = tools.find((t) => t.name === "lsp_definition");
      expect(def).toBeDefined();
      expect(def!.description).toContain("definition");
    });

    it("includes lsp_references tool", () => {
      const tools = createLspTools();
      const refs = tools.find((t) => t.name === "lsp_references");
      expect(refs).toBeDefined();
      expect(refs!.description).toContain("references");
    });

    it("includes lsp_status tool", () => {
      const tools = createLspTools();
      const status = tools.find((t) => t.name === "lsp_status");
      expect(status).toBeDefined();
      expect(status!.description).toContain("status");
    });

    it("all tools have unique names", () => {
      const tools = createLspTools();
      const names = tools.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("all tools have execute functions", () => {
      const tools = createLspTools();
      for (const tool of tools) {
        expect(typeof tool.execute).toBe("function");
      }
    });

    it("all tools have parameters schemas", () => {
      const tools = createLspTools();
      for (const tool of tools) {
        expect(tool.parameters).toBeDefined();
      }
    });
  });
});
