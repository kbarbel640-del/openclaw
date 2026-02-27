import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getSubCliEntries, registerSubCliByName } = vi.hoisted(() => ({
  getSubCliEntries: vi.fn(() => []),
  registerSubCliByName: vi.fn(async () => {}),
}));

vi.mock("./program/register.subclis.js", () => ({
  getSubCliEntries,
  registerSubCliByName,
}));

const { registerCompletionCli } = await import("./completion-cli.js");

describe("completion-cli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates zsh completion that initializes compinit before compdef", async () => {
    const program = new Command();
    program.name("openclaw");
    registerCompletionCli(program);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync(["node", "openclaw", "completion", "--shell", "zsh"], {
      from: "node",
    });

    const script = String(logSpy.mock.calls.at(0)?.[0] ?? "");
    const compinitIndex = script.indexOf("autoload -Uz compinit");
    const compdefIndex = script.indexOf("compdef _openclaw_root_completion openclaw");

    expect(script).toContain("if ! (( $+functions[compdef] )); then");
    expect(compinitIndex).toBeGreaterThan(-1);
    expect(compdefIndex).toBeGreaterThan(-1);
    expect(compinitIndex).toBeLessThan(compdefIndex);
  });
});
