import { describe, expect, it } from "vitest";
import {
  formatToolDetail,
  formatToolFeedbackDiscord,
  formatToolResultBlockDiscord,
  formatToolSummary,
  resolveToolDisplay,
} from "./tool-display.js";

describe("MCP tool name normalization", () => {
  it("strips mcp__server__prefix from tool names", () => {
    const display = resolveToolDisplay({ name: "mcp__claude-code-mcp__claude_code" });
    expect(display.name).toBe("claude_code");
    expect(display.title).toBe("Claude Code");
    expect(display.emoji).toBe("🔧");
  });

  it("strips mcp prefix for unknown MCP tools", () => {
    const display = resolveToolDisplay({ name: "mcp__filesystem__read_file" });
    expect(display.name).toBe("read_file");
    expect(display.title).toBe("Read File");
  });

  it("leaves non-MCP tool names unchanged", () => {
    const display = resolveToolDisplay({ name: "read" });
    expect(display.name).toBe("read");
    expect(display.title).toBe("Read");
  });

  it("formats claude_code summary with detail only (no label)", () => {
    const summary = formatToolSummary(
      resolveToolDisplay({
        name: "mcp__claude-code-mcp__claude_code",
        args: { prompt: "list files in /tmp" },
      }),
    );
    expect(summary).toBe("🔧 list files in /tmp");
  });
});

describe("tool display detailOnly", () => {
  it("marks claude_code as detailOnly", () => {
    const display = resolveToolDisplay({ name: "mcp__claude-code-mcp__claude_code" });
    expect(display.detailOnly).toBe(true);
  });

  it("does not set detailOnly for regular tools", () => {
    const display = resolveToolDisplay({ name: "read" });
    expect(display.detailOnly).toBe(false);
  });

  it("falls back to label format when detailOnly tool has no detail", () => {
    const summary = formatToolSummary(
      resolveToolDisplay({ name: "mcp__claude-code-mcp__claude_code" }),
    );
    expect(summary).toBe("🔧 Claude Code");
  });
});

describe("tool display details", () => {
  it("skips zero/false values for optional detail fields", () => {
    const detail = formatToolDetail(
      resolveToolDisplay({
        name: "sessions_spawn",
        args: {
          task: "double-message-bug-gpt",
          label: 0,
          runTimeoutSeconds: 0,
          timeoutSeconds: 0,
        },
      }),
    );

    expect(detail).toBe("double-message-bug-gpt");
  });

  it("includes only truthy boolean details", () => {
    const detail = formatToolDetail(
      resolveToolDisplay({
        name: "message",
        args: {
          action: "react",
          provider: "discord",
          to: "chan-1",
          remove: false,
        },
      }),
    );

    expect(detail).toContain("provider discord");
    expect(detail).toContain("to chan-1");
    expect(detail).not.toContain("remove");
  });

  it("keeps positive numbers and true booleans", () => {
    const detail = formatToolDetail(
      resolveToolDisplay({
        name: "sessions_history",
        args: {
          sessionKey: "agent:main:main",
          limit: 20,
          includeTools: true,
        },
      }),
    );

    expect(detail).toContain("session agent:main:main");
    expect(detail).toContain("limit 20");
    expect(detail).toContain("tools true");
  });
});

describe("formatToolFeedbackDiscord", () => {
  it("formats Bash with command in inline code, no colon", () => {
    const display = resolveToolDisplay({
      name: "Bash",
      args: { command: "git status" },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toBe("*Running `git status`...*");
    expect(result).not.toContain(":");
  });

  it("formats Bash without command as generic message", () => {
    const display = resolveToolDisplay({ name: "Bash" });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toBe("*Running a command...*");
  });

  it("formats Read with file path in inline code", () => {
    const display = resolveToolDisplay({
      name: "Read",
      args: { file_path: "/home/user/project/src/index.ts" },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toContain("*Reading `");
    expect(result).toContain("index.ts");
    expect(result).not.toContain(":");
  });

  it("formats Write with file path", () => {
    const display = resolveToolDisplay({
      name: "Write",
      args: { path: "/tmp/output.txt" },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toContain("*Writing `");
    expect(result).toContain("output.txt");
  });

  it("formats Edit with file path", () => {
    const display = resolveToolDisplay({
      name: "Edit",
      args: { path: "/src/main.ts" },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toContain("*Editing `");
    expect(result).toContain("main.ts");
  });

  it("formats search tools with query in inline code", () => {
    const display = resolveToolDisplay({
      name: "web_search",
      args: { query: "vitest fake timers" },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toContain("*Searching `vitest fake timers`...*");
  });

  it("formats WebFetch with URL in inline code", () => {
    const display = resolveToolDisplay({
      name: "web_fetch",
      args: { url: "https://example.com" },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toContain("*Fetching `https://example.com`...*");
  });

  it("truncates long Bash commands at 120 chars", () => {
    const longCmd = "a".repeat(200);
    const display = resolveToolDisplay({
      name: "Bash",
      args: { command: longCmd },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result.length).toBeLessThan(200);
    expect(result).toContain("...");
  });

  it("strips stderr redirections and trailing pipes from Bash commands", () => {
    const display = resolveToolDisplay({
      name: "Bash",
      args: { command: "todoist list 2>/dev/null | head -30" },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toBe("*Running `todoist list`...*");
    expect(result).not.toContain("2>/dev/null");
    expect(result).not.toContain("head");
  });

  it("uses only the first line of multi-line Bash commands", () => {
    const display = resolveToolDisplay({
      name: "Bash",
      args: { command: "echo hello\necho world\necho done" },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toContain("echo hello");
    expect(result).not.toContain("echo world");
  });

  it("formats claude_code detailOnly with detail", () => {
    const display = resolveToolDisplay({
      name: "mcp__claude-code-mcp__claude_code",
      args: { prompt: "list files in /tmp" },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toBe("*list files in /tmp...*");
  });

  it("formats unknown tools with label and detail in code", () => {
    const display = resolveToolDisplay({
      name: "custom_tool",
      args: { path: "/some/path" },
    });
    const result = formatToolFeedbackDiscord(display);
    expect(result).toBe("*Custom Tool `/some/path`...*");
  });
});

describe("formatToolResultBlockDiscord", () => {
  it("formats Read with ts code fence for .ts files", () => {
    const display = resolveToolDisplay({
      name: "Read",
      args: { file_path: "/src/config.ts" },
    });
    const result = formatToolResultBlockDiscord(display, {
      outputPreview: 'export const port = 3000;\nexport const host = "localhost";',
      lineCount: 2,
      isError: false,
    });
    expect(result).toContain("*Read* (`/src/config.ts`)");
    expect(result).toContain("```ts\n");
    expect(result).toContain("export const port = 3000;");
    expect(result).toContain("*(2 lines)*");
  });

  it("formats Read with json code fence for .json files", () => {
    const display = resolveToolDisplay({
      name: "Read",
      args: { file_path: "/app/package.json" },
    });
    const result = formatToolResultBlockDiscord(display, {
      outputPreview: '{ "name": "test" }',
      lineCount: 1,
      isError: false,
    });
    expect(result).toContain("```json\n");
    expect(result).toContain("*(1 line)*");
  });

  it("formats Bash with command header and bash code fence", () => {
    const display = resolveToolDisplay({
      name: "Bash",
      args: { command: "git status" },
    });
    const result = formatToolResultBlockDiscord(display, {
      outputPreview: "On branch main\nnothing to commit",
      lineCount: 2,
      isError: false,
    });
    expect(result).toContain("*Bash* (`git status`)");
    expect(result).toContain("```bash\n");
    expect(result).toContain("On branch main");
  });

  it("formats Edit with diff code fence", () => {
    const display = resolveToolDisplay({
      name: "Edit",
      args: { path: "/src/types.ts" },
    });
    const result = formatToolResultBlockDiscord(display, {
      outputPreview: "- old line\n+ new line",
      lineCount: 2,
      isError: false,
    });
    expect(result).toContain("*Edit* (`/src/types.ts`)");
    expect(result).toContain("```diff\n");
  });

  it("formats Grep with detail", () => {
    const display = resolveToolDisplay({
      name: "Grep",
      args: { pattern: "sessionId", path: "src/**/*.ts" },
    });
    const result = formatToolResultBlockDiscord(display, {
      outputPreview: "src/store.ts\nsrc/routing.ts",
      lineCount: 2,
      isError: false,
    });
    expect(result).toContain("*Grep*");
    expect(result).toContain("src/store.ts");
  });

  it("truncates output to 10 lines and shows footer", () => {
    const lines = Array.from({ length: 25 }, (_, i) => `line ${i + 1}`);
    const display = resolveToolDisplay({
      name: "Bash",
      args: { command: "cat bigfile.txt" },
    });
    const result = formatToolResultBlockDiscord(display, {
      outputPreview: lines.slice(0, 10).join("\n"),
      lineCount: 25,
      isError: false,
    });
    expect(result).toContain("line 1");
    expect(result).toContain("line 10");
    expect(result).not.toContain("line 11");
    expect(result).toContain("*(25 lines, showing first 10)*");
  });

  it("returns header only when no output preview", () => {
    const display = resolveToolDisplay({
      name: "Write",
      args: { path: "/tmp/out.txt" },
    });
    const result = formatToolResultBlockDiscord(display, {
      isError: false,
    });
    expect(result).toBe("*Write* (`/tmp/out.txt`)");
    expect(result).not.toContain("```");
  });

  it("shows error marker when no output and isError", () => {
    const display = resolveToolDisplay({
      name: "Bash",
      args: { command: "false" },
    });
    const result = formatToolResultBlockDiscord(display, {
      isError: true,
    });
    expect(result).toContain("*(error)*");
  });

  it("formats MCP tools with title and detail", () => {
    const display = resolveToolDisplay({
      name: "mcp__todoist__get_tasks",
      args: { project: "OpenClaw" },
    });
    const result = formatToolResultBlockDiscord(display, {
      outputPreview: "3 tasks found",
      lineCount: 1,
      isError: false,
    });
    expect(result).toContain("*Get Tasks*");
    expect(result).toContain("3 tasks found");
  });

  it("formats Web Search results", () => {
    const display = resolveToolDisplay({
      name: "web_search",
      args: { query: "vitest docs" },
    });
    const result = formatToolResultBlockDiscord(display, {
      outputPreview: "1. Vitest - https://vitest.dev\n2. Getting Started",
      lineCount: 2,
      isError: false,
    });
    expect(result).toContain("*Web Search* (`vitest docs`)");
    expect(result).toContain("vitest.dev");
  });

  it("handles single-line output with correct noun", () => {
    const display = resolveToolDisplay({
      name: "Read",
      args: { file_path: "/tmp/one.txt" },
    });
    const result = formatToolResultBlockDiscord(display, {
      outputPreview: "single line",
      lineCount: 1,
      isError: false,
    });
    expect(result).toContain("*(1 line)*");
    expect(result).not.toContain("lines");
  });
});
