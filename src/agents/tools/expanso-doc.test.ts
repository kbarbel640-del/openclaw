/**
 * Tests for the Expanso documentation (US-010: Unified Documentation and User Guide)
 *
 * Verifies that docs/tools/expanso.md:
 *   1. Exists and is non-empty.
 *   2. Includes natural language pipeline description examples.
 *   3. Includes the bot command reference (/expanso build, validate, fix).
 *   4. Includes the interactive Fix button section.
 *   5. Contains the required acceptance-criteria sections.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Resolve the docs file relative to the project root
// Test lives at src/agents/tools/; docs are at docs/tools/ (3 levels up)
const DOCS_ROOT = join(import.meta.dirname, "../../..");
const EXPANSO_DOC_PATH = join(DOCS_ROOT, "docs/tools/expanso.md");

function loadDoc(): string {
  return readFileSync(EXPANSO_DOC_PATH, "utf-8");
}

describe("docs/tools/expanso.md", () => {
  // ---------------------------------------------------------------------------
  // File existence
  // ---------------------------------------------------------------------------

  it("exists and is non-empty", () => {
    const content = loadDoc();
    expect(content.length).toBeGreaterThan(1000);
  });

  it("has frontmatter with a title", () => {
    const content = loadDoc();
    expect(content).toContain("title:");
    expect(content).toContain("Expanso");
  });

  // ---------------------------------------------------------------------------
  // Acceptance Criterion 1: NL pipeline description examples
  // ---------------------------------------------------------------------------

  describe("NL pipeline examples (AC-1)", () => {
    it("includes a plain English CSV pipeline example", () => {
      const content = loadDoc();
      expect(content.toLowerCase()).toContain("csv");
    });

    it("includes a Kafka example in the NL descriptions", () => {
      const content = loadDoc();
      expect(content.toLowerCase()).toContain("kafka");
    });

    it("includes an HTTP/webhook example", () => {
      const content = loadDoc();
      // Either "http" or "webhook" must appear
      expect(content.toLowerCase()).toMatch(/http|webhook/);
    });

    it("includes example YAML output", () => {
      const content = loadDoc();
      expect(content).toContain("```yaml");
      // Should contain a real pipeline structure
      expect(content).toContain("inputs:");
      expect(content).toContain("outputs:");
    });

    it("documents all three actions: build, validate, fix", () => {
      const content = loadDoc();
      expect(content).toContain("`build`");
      expect(content).toContain("`validate`");
      expect(content).toContain("`fix`");
    });
  });

  // ---------------------------------------------------------------------------
  // Acceptance Criterion 2: Bot command reference
  // ---------------------------------------------------------------------------

  describe("bot command reference (AC-2)", () => {
    it("documents /expanso build with examples", () => {
      const content = loadDoc();
      expect(content).toContain("/expanso build");
      // At least one concrete example
      expect(content).toContain("/expanso build Read CSV");
    });

    it("documents /expanso validate with examples", () => {
      const content = loadDoc();
      expect(content).toContain("/expanso validate");
    });

    it("documents /expanso fix with examples", () => {
      const content = loadDoc();
      expect(content).toContain("/expanso fix");
      expect(content).toContain("/expanso fix Stream Kafka");
    });

    it("mentions the Discord slash command setup", () => {
      const content = loadDoc();
      expect(content.toLowerCase()).toContain("discord");
      expect(content).toContain("/expanso");
    });

    it("mentions the Telegram command setup", () => {
      const content = loadDoc();
      expect(content.toLowerCase()).toContain("telegram");
    });

    it("documents the interactive Fix button", () => {
      const content = loadDoc();
      expect(content).toContain("🔧 Fix");
      // Should mention both platforms
      expect(content.toLowerCase()).toContain("discord");
      expect(content.toLowerCase()).toContain("telegram");
    });

    it("documents the Fix button callback data for Telegram", () => {
      const content = loadDoc();
      expect(content).toContain("expanso_fix");
    });

    it("documents the Fix button component ID for Discord", () => {
      const content = loadDoc();
      expect(content).toContain("expanso-fix");
    });
  });

  // ---------------------------------------------------------------------------
  // Other required sections
  // ---------------------------------------------------------------------------

  describe("required documentation sections", () => {
    it("has an overview section with action table", () => {
      const content = loadDoc();
      expect(content).toContain("## Overview");
      // Table header
      expect(content).toContain("| Action");
    });

    it("documents the validation sandbox", () => {
      const content = loadDoc();
      expect(content.toLowerCase()).toContain("docker");
      expect(content.toLowerCase()).toContain("sandbox");
    });

    it("documents the security model", () => {
      const content = loadDoc();
      expect(content.toLowerCase()).toContain("security");
      expect(content.toLowerCase()).toContain("read-only");
    });

    it("documents audit logging", () => {
      const content = loadDoc();
      expect(content.toLowerCase()).toContain("audit");
    });

    it("has an agent tool reference with JSON examples", () => {
      const content = loadDoc();
      expect(content).toContain("```json");
    });

    it("documents Expanso pipeline concepts (inputs, transforms, outputs)", () => {
      const content = loadDoc();
      expect(content).toContain("**Inputs**");
      expect(content).toContain("**Transforms**");
      expect(content).toContain("**Outputs**");
    });

    it("mentions Bloblang", () => {
      const content = loadDoc();
      expect(content).toContain("Bloblang");
    });
  });

  // ---------------------------------------------------------------------------
  // Crusty bot integration
  // ---------------------------------------------------------------------------

  describe("Crusty bot integration section", () => {
    it("has a dedicated Crusty Bot Integration section", () => {
      const content = loadDoc();
      expect(content).toContain("Crusty");
    });

    it("documents Discord setup with openclaw.json config snippet", () => {
      const content = loadDoc();
      expect(content).toContain("openclaw.json");
      expect(content).toContain("expanso-expert");
    });

    it("documents Telegram setup with nativeEnabled", () => {
      const content = loadDoc();
      expect(content).toContain("nativeEnabled");
    });
  });
});
