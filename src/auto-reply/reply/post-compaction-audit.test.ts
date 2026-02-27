import fs from "node:fs";
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
            input: { file_path: "AGENTS.md" },
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
    expect(paths).toEqual(["AGENTS.md", "memory/2026-02-16.md"]);
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
            input: { command: "cat AGENTS.md" },
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
  const tmpDir = path.join("/tmp", "test-post-compaction-audit-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes when memory file pattern is satisfied (default required reads)", () => {
    const readPaths = ["memory/2026-02-16.md"];
    const result = auditPostCompactionReads(readPaths, tmpDir);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });

  it("fails when no files are read and memory pattern is unmatched", () => {
    const result = auditPostCompactionReads([], tmpDir);

    expect(result.passed).toBe(false);
    expect(result.missingPatterns.some((p) => p.includes("memory"))).toBe(true);
  });

  it("skips string-type required reads for files that do not exist on disk", () => {
    const customRequired = ["nonexistent-file.md"];
    const result = auditPostCompactionReads([], tmpDir, customRequired);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });

  it("audits string-type required reads that exist on disk", () => {
    fs.writeFileSync(path.join(tmpDir, "startup.md"), "# Startup rules");
    const customRequired = ["startup.md"];
    const result = auditPostCompactionReads([], tmpDir, customRequired);

    expect(result.passed).toBe(false);
    expect(result.missingPatterns).toContain("startup.md");
  });

  it("passes when existing required file was read", () => {
    fs.writeFileSync(path.join(tmpDir, "startup.md"), "# Startup rules");
    const readPaths = ["startup.md"];
    const customRequired = ["startup.md"];
    const result = auditPostCompactionReads(readPaths, tmpDir, customRequired);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });

  it("matches RegExp patterns against relative paths", () => {
    const readPaths = ["memory/2026-02-16.md"];
    const result = auditPostCompactionReads(readPaths, tmpDir);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });

  it("normalizes relative paths when matching", () => {
    fs.writeFileSync(path.join(tmpDir, "startup.md"), "# Rules");
    const readPaths = ["./startup.md", "memory/2026-02-16.md"];
    const customRequired: Array<string | RegExp> = ["startup.md", /memory\/\d{4}-\d{2}-\d{2}\.md/];
    const result = auditPostCompactionReads(readPaths, tmpDir, customRequired);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });

  it("normalizes absolute paths when matching", () => {
    fs.writeFileSync(path.join(tmpDir, "startup.md"), "# Rules");
    const readPaths = [path.join(tmpDir, "startup.md"), path.join(tmpDir, "memory/2026-02-16.md")];
    const customRequired: Array<string | RegExp> = ["startup.md", /memory\/\d{4}-\d{2}-\d{2}\.md/];
    const result = auditPostCompactionReads(readPaths, tmpDir, customRequired);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });

  it("accepts custom required reads list", () => {
    fs.writeFileSync(path.join(tmpDir, "custom.md"), "# Custom");
    const readPaths = ["custom.md"];
    const customRequired = ["custom.md"];
    const result = auditPostCompactionReads(readPaths, tmpDir, customRequired);

    expect(result.passed).toBe(true);
    expect(result.missingPatterns).toEqual([]);
  });
});

describe("formatAuditWarning", () => {
  it("formats warning message with missing patterns", () => {
    const missingPatterns = ["startup.md", "memory\\/\\d{4}-\\d{2}-\\d{2}\\.md"];
    const message = formatAuditWarning(missingPatterns);

    expect(message).toContain("⚠️ Post-Compaction Audit");
    expect(message).toContain("startup.md");
    expect(message).toContain("memory");
    expect(message).toContain("Please read them now");
  });

  it("formats single missing pattern", () => {
    const missingPatterns = ["startup.md"];
    const message = formatAuditWarning(missingPatterns);

    expect(message).toContain("startup.md");
    const lines = message.split("\n");
    const patternLines = lines.filter((l) => l.trim().startsWith("- "));
    expect(patternLines).toHaveLength(1);
    expect(patternLines[0]).toContain("startup.md");
  });
});
