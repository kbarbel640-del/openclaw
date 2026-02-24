import { describe, expect, it } from "vitest";
import type { UpdateRunResult } from "../../infra/update-runner.js";
import { inferUpdateFailureHints } from "./progress.js";

function makeResult(stepName: string, stderrTail: string): UpdateRunResult {
  return {
    status: "error",
    mode: "npm",
    reason: stepName,
    steps: [
      {
        name: stepName,
        command: "npm i -g openclaw@latest",
        cwd: "/tmp",
        durationMs: 1,
        exitCode: 1,
        stderrTail,
      },
    ],
    durationMs: 1,
  };
}

describe("inferUpdateFailureHints", () => {
  it("returns EACCES hint for global update permission failures", () => {
    const result = makeResult(
      "global update",
      "npm ERR! code EACCES\nnpm ERR! Error: EACCES: permission denied",
    );
    const hints = inferUpdateFailureHints(result);
    expect(hints.join("\n")).toContain("EACCES");
    expect(hints.join("\n")).toContain("npm config set prefix ~/.local");
  });

  it("returns native optional dependency hint for node-gyp/opus failures", () => {
    const result = makeResult(
      "global update",
      "node-pre-gyp ERR!\n@discordjs/opus\nnode-gyp rebuild failed",
    );
    const hints = inferUpdateFailureHints(result);
    expect(hints.join("\n")).toContain("--omit=optional");
  });
});
