import { describe, expect, it, vi } from "vitest";

vi.mock("./verifier/index.js", () => ({
  runVerifier: vi.fn(() => ({ blocked: false })),
}));

vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: () => null,
}));

describe("before-tool-call with verifier", () => {
  it("blocks tool call when verifier denies", async () => {
    const { runVerifier } = await import("./verifier/index.js");
    vi.mocked(runVerifier).mockResolvedValueOnce({
      blocked: true,
      reason: "Denied by policy server",
    });

    const { runBeforeToolCallHook } = await import("./pi-tools.before-tool-call.js");
    const result = await runBeforeToolCallHook({
      toolName: "exec",
      params: { command: "rm -rf /" },
      ctx: {
        verifierConfig: { enabled: true, webhook: { url: "https://example.com" } },
      },
    });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("Denied by policy server");
    }
  });

  it("allows tool call when verifier approves", async () => {
    const { runVerifier } = await import("./verifier/index.js");
    vi.mocked(runVerifier).mockResolvedValueOnce({ blocked: false });

    const { runBeforeToolCallHook } = await import("./pi-tools.before-tool-call.js");
    const result = await runBeforeToolCallHook({
      toolName: "exec",
      params: { command: "echo hello" },
      ctx: {
        verifierConfig: { enabled: true, webhook: { url: "https://example.com" } },
      },
    });
    expect(result.blocked).toBe(false);
  });

  it("skips verifier when no config provided", async () => {
    const { runVerifier } = await import("./verifier/index.js");
    vi.mocked(runVerifier).mockClear();

    const { runBeforeToolCallHook } = await import("./pi-tools.before-tool-call.js");
    const result = await runBeforeToolCallHook({
      toolName: "exec",
      params: { command: "echo hello" },
    });
    expect(result.blocked).toBe(false);
    expect(runVerifier).not.toHaveBeenCalled();
  });
});
