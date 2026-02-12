import { describe, expect, it } from "vitest";
import { diagnosticSeverityLabel } from "./lsp-client.js";

describe("lsp-client", () => {
  describe("diagnosticSeverityLabel", () => {
    it("maps severity 1 to Error", () => {
      expect(diagnosticSeverityLabel(1)).toBe("Error");
    });

    it("maps severity 2 to Warning", () => {
      expect(diagnosticSeverityLabel(2)).toBe("Warning");
    });

    it("maps severity 3 to Information", () => {
      expect(diagnosticSeverityLabel(3)).toBe("Information");
    });

    it("maps severity 4 to Hint", () => {
      expect(diagnosticSeverityLabel(4)).toBe("Hint");
    });

    it("returns Unknown for undefined severity", () => {
      expect(diagnosticSeverityLabel(undefined)).toBe("Unknown");
    });

    it("returns Unknown for unknown severity numbers", () => {
      expect(diagnosticSeverityLabel(99)).toBe("Unknown");
    });
  });
});
