import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  auditPostCompactionReads,
  extractReadPaths,
  formatAuditWarning,
} from "./post-compaction-audit.js";

describe("extractReadPaths", () => {
  it("extracts file paths from Read tool calls", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            name: "read",
            input: { file_path: "WORKFLOW_AUTO.md" },
          },
        ],
      },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            name: "read",
            input: { file_path: "memory/2026-02-16.md" },
          },
        ],
      },
    ];

    const paths = extractReadPaths(messages);
    expect(paths).toEqual(["WORKFLOW_AUTO.md", "memory/2026-02-16.md"]);
  });

  it("handles path parameter (alternative to file_path)", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            name: "read",
            input: { path: "AGENTS.md" },
          },
        ],
      },
    ];

    const paths = extractReadPaths(messages);
    expect(paths).toEqual(["AGENTS.md"]);
  });

  it("ignores non-assistant messages", () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "tool_use",
            name: "read",
            input: { file_path: "should_be_ignored.md" },
          },
        ],
      },
    ];

    const paths = extractReadPaths(messages);
    expect(paths).toEqual([]);
  });

  it("ignores non-read tool calls", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            name: "exec",
            input: { command: "cat WORKFLOW_AUTO.md" },
          },
        ],
      },
    ];

    const paths = extractReadPaths(messages);
    expect(paths).toEqual([]);
  });

  it("handles empty messages array", () => {
    const paths = extractReadPaths([]);
    expect(paths).toEqual([]);
  });

  it("handles messages with non-array content", () => {
    const messages = [
      {
        role: "assistant",
        content: "text only",
      },
    ];

    const paths = extractReadPaths(messages);
    expect(paths).toEqual([]);
  });
});

describe("auditPostCompactionReads", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "post-compaction-test-"));
    // Create WORKFLOW_AUTO.md in the temp directory
    fs.writeFileSync(path.join(tempDir, "WORKFLOW_AUTO.md"), "# Workflow\n");
    // Create memory directory with a daily file
    fs.mkdirSync(path.join(tempDir, "memory"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "memory", "2026-02-16.md"), "# Notes\n");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("passes when all required files are read", () => {
    const readPaths = ["WORKFLOW_AUTO.md", "memory/2026-02-16.md"];
    const result = auditPostCompactionReads(readPaths, tempDir);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });

  it("fails when no files are read", () => {
    const result = auditPostCompactionReads([], tempDir);

    expect(result.passed).toBe(false);
    expect(result.missingPatterns).toContain("WORKFLOW_AUTO.md");
    expect(result.missingPatterns.some((p) => p.includes("memory"))).toBe(true);
  });

  it("reports only missing files", () => {
    const readPaths = ["WORKFLOW_AUTO.md"];
    const result = auditPostCompactionReads(readPaths, tempDir);

    expect(result.passed).toBe(false);
    expect(result.missingPatterns).not.toContain("WORKFLOW_AUTO.md");
    expect(result.missingPatterns.some((p) => p.includes("memory"))).toBe(true);
  });

  it("matches RegExp patterns against relative paths", () => {
    const readPaths = ["memory/2026-02-16.md"];
    const result = auditPostCompactionReads(readPaths, tempDir);

    expect(result.passed).toBe(false);
    expect(result.missingPatterns).toContain("WORKFLOW_AUTO.md");
    expect(result.missingPatterns.length).toBe(1);
  });

  it("normalizes relative paths when matching", () => {
    const readPaths = ["./WORKFLOW_AUTO.md", "memory/2026-02-16.md"];
    const result = auditPostCompactionReads(readPaths, tempDir);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });

  it("normalizes absolute paths when matching", () => {
    const readPaths = [
      path.join(tempDir, "WORKFLOW_AUTO.md"),
      path.join(tempDir, "memory", "2026-02-16.md"),
    ];
    const result = auditPostCompactionReads(readPaths, tempDir);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });

  it("accepts custom required reads list", () => {
    const readPaths = ["custom.md"];
    const customRequired = ["custom.md"];
    // Create the custom file so it's not skipped
    fs.writeFileSync(path.join(tempDir, "custom.md"), "# Custom\n");
    const result = auditPostCompactionReads(readPaths, tempDir, customRequired);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });

  it("skips non-existent required files", () => {
    // Remove WORKFLOW_AUTO.md to test skipping
    fs.unlinkSync(path.join(tempDir, "WORKFLOW_AUTO.md"));

    const readPaths = ["memory/2026-02-16.md"];
    const result = auditPostCompactionReads(readPaths, tempDir);

    // Should pass because WORKFLOW_AUTO.md doesn't exist and memory file was read
    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });
});

describe("formatAuditWarning", () => {
  it("formats warning message with missing patterns", () => {
    const missingPatterns = ["WORKFLOW_AUTO.md", "memory\\/\\d{4}-\\d{2}-\\d{2}\\.md"];
    const message = formatAuditWarning(missingPatterns);

    expect(message).toContain("⚠️ Post-Compaction Audit");
    expect(message).toContain("WORKFLOW_AUTO.md");
    expect(message).toContain("memory");
    expect(message).toContain("Please read them now");
  });

  it("formats single missing pattern", () => {
    const missingPatterns = ["WORKFLOW_AUTO.md"];
    const message = formatAuditWarning(missingPatterns);

    expect(message).toContain("WORKFLOW_AUTO.md");
    // Check that the missing patterns list only contains WORKFLOW_AUTO.md
    const lines = message.split("\n");
    const patternLines = lines.filter((l) => l.trim().startsWith("- "));
    expect(patternLines).toHaveLength(1);
    expect(patternLines[0]).toContain("WORKFLOW_AUTO.md");
  });
});
