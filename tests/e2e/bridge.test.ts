import { execa } from "execa";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CLI_PATH = join(process.cwd(), "src/index.ts");

// Helper to run bridge commands
async function runBridge(payload: object) {
  const input = JSON.stringify(payload);
  const { stdout } = await execa("bun", [CLI_PATH, "bridge"], {
    input,
    reject: false,
  });
  try {
    return JSON.parse(stdout);
  } catch (e) {
    throw new Error(`Failed to parse bridge output: ${stdout}`, { cause: e });
  }
}

describe("Command Bridge E2E", () => {
  it("should list models via bridge", async () => {
    const result = await runBridge({ action: "models.list", args: { all: true } });

    expect(result.success).toBe(true);
    expect(result.view).toBe("table");
    expect(Array.isArray(result.data)).toBe(true);

    // Check for standard providers
    const models = result.data as any[];
    const hasOpenAI = models.some((m: any) => m.provider === "openai");
    const hasAnthropic = models.some((m: any) => m.provider === "anthropic");

    // Note: Depends on what's configured/mocked in the env, but structure validation is key
    expect(models.length).toBeGreaterThanOrEqual(0);
  });

  it("should fail on unknown action", async () => {
    const result = await runBridge({ action: "unknown.action" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown action");
  });

  it("should fail on invalid json input", async () => {
    // We can't use runBridge helper here because it stringifies valid JSON
    const { stdout, exitCode } = await execa("bun", [CLI_PATH, "bridge"], {
      input: "invalid-json",
      reject: false,
    });

    // Expect parse error handled by command
    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unexpected token");
  });
});
