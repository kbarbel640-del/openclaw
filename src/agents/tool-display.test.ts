import { describe, expect, it } from "vitest";
import { formatToolDetail, resolveToolDisplay } from "./tool-display.js";

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

  it("resolves file_path for Read tool (SDK format)", () => {
    const display = resolveToolDisplay({
      name: "Read",
      args: { file_path: "/workspace/src/foo.ts" },
    });
    expect(display.detail).toContain("/workspace/src/foo.ts");
  });

  it("resolves file_path for Write tool (SDK format)", () => {
    const display = resolveToolDisplay({
      name: "Write",
      args: { file_path: "/workspace/src/bar.ts" },
    });
    expect(display.detail).toContain("/workspace/src/bar.ts");
  });

  it("prefers path over file_path when both present", () => {
    const display = resolveToolDisplay({
      name: "Read",
      args: { path: "short.ts", file_path: "/long/path/short.ts" },
    });
    expect(display.detail).toBe("short.ts");
  });
});
