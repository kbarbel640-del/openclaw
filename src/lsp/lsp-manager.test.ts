import { describe, expect, it, afterEach } from "vitest";
import { getLspManager, resetLspManager } from "./lsp-manager.js";

describe("lsp-manager", () => {
  afterEach(() => {
    resetLspManager();
  });

  describe("getLspManager", () => {
    it("returns a singleton instance", () => {
      const manager1 = getLspManager();
      const manager2 = getLspManager();
      expect(manager1).toBe(manager2);
    });

    it("returns a new instance after reset", () => {
      const manager1 = getLspManager();
      resetLspManager();
      const manager2 = getLspManager();
      expect(manager1).not.toBe(manager2);
    });
  });

  describe("getStatus", () => {
    it("returns empty array when no servers are running", () => {
      const manager = getLspManager();
      expect(manager.getStatus()).toEqual([]);
    });
  });

  describe("getDiagnostics", () => {
    it("returns empty array for unknown files", () => {
      const manager = getLspManager();
      expect(manager.getDiagnostics("/nonexistent/file.ts")).toEqual([]);
    });
  });

  describe("enabled flag", () => {
    it("defaults to enabled", () => {
      const manager = getLspManager();
      expect(manager.enabled).toBe(true);
    });

    it("can be disabled", () => {
      const manager = getLspManager();
      manager.enabled = false;
      expect(manager.enabled).toBe(false);
    });

    it("handleFileChange returns empty when disabled", async () => {
      const manager = getLspManager();
      manager.enabled = false;
      const result = await manager.handleFileChange("/some/file.ts", "const x = 1;");
      expect(result).toEqual([]);
    });
  });

  describe("handleFileChange", () => {
    it("returns empty for unsupported file types", async () => {
      const manager = getLspManager();
      const result = await manager.handleFileChange("/some/file.md", "# Hello");
      expect(result).toEqual([]);
    });

    // Note: Full integration tests would require actual LSP server binaries.
    // These are tested in the e2e test suite or manually.
    it("returns empty when no project root is found (no config file)", async () => {
      const manager = getLspManager();
      // File in a random temp location with no tsconfig.json, package.json, etc.
      const result = await manager.handleFileChange("/tmp/random-isolated-file.ts", "const x = 1;");
      expect(result).toEqual([]);
    });
  });
});
