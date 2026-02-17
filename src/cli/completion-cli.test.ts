import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { HEAVY_SUBCMD_STUBS, registerCompletionCli } from "./completion-cli.js";
import { getSubCliEntries } from "./program/register.subclis.js";

function captureStdout(fn: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string) => {
    chunks.push(chunk);
    return true;
  }) as typeof process.stdout.write;
  return fn()
    .finally(() => {
      process.stdout.write = origWrite;
    })
    .then(() => chunks.join(""));
}

describe("completion cli", () => {
  it("generates bash completion including heavy subcommands", async () => {
    const program = new Command("openclaw");
    registerCompletionCli(program);

    const output = await captureStdout(() =>
      program.parseAsync(["node", "openclaw", "completion", "--shell", "bash"]),
    );

    // Core subcommands should be present
    expect(output).toContain("gateway");
    expect(output).toContain("logs");
    // Heavy subcommands (registered as stubs) should still appear
    expect(output).toContain("plugins");
    expect(output).toContain("pairing");
  });

  it("generates zsh completion including heavy subcommands", async () => {
    const program = new Command("openclaw");
    registerCompletionCli(program);

    const output = await captureStdout(() =>
      program.parseAsync(["node", "openclaw", "completion", "--shell", "zsh"]),
    );

    expect(output).toContain("compdef");
    expect(output).toContain("gateway");
    expect(output).toContain("plugins");
    expect(output).toContain("pairing");
  });

  it("generates fish completion including heavy subcommands", async () => {
    const program = new Command("openclaw");
    registerCompletionCli(program);

    const output = await captureStdout(() =>
      program.parseAsync(["node", "openclaw", "completion", "--shell", "fish"]),
    );

    expect(output).toContain("plugins");
    expect(output).toContain("pairing");
    expect(output).toContain("gateway");
  });
});

describe("HEAVY_SUBCMD_STUBS sync check", () => {
  it("stub descriptions match the SubCliEntry descriptions in register.subclis", () => {
    // This test guards against silent drift: if someone updates the description
    // in register.subclis.ts or completion-cli.ts, this test will catch the mismatch.
    const entries = getSubCliEntries();
    const entryMap = new Map(entries.map((e) => [e.name, e.description]));

    for (const [name, stub] of Object.entries(HEAVY_SUBCMD_STUBS)) {
      const registeredDesc = entryMap.get(name);
      expect(
        registeredDesc,
        `HEAVY_SUBCMD_STUBS["${name}"] exists but "${name}" is not in getSubCliEntries()`,
      ).toBeDefined();
      expect(stub.desc).toBe(
        registeredDesc,
        // Note: descriptions must also match the actual CLI files:
        //   pairing → src/cli/pairing-cli.ts (registerPairingCli)
        //   plugins → src/cli/plugins-cli.ts (registerPluginsCli)
      );
    }
  });
});
