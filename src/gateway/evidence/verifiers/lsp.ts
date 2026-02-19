import { BaseVerifier } from "../verifier.js";

export class LSPVerifier extends BaseVerifier {
  getType(): "lsp" {
    return "lsp";
  }

  buildCommand(): string[] {
    const command = this.gate.command || "npx tsc --noEmit";
    return command.split(" ").filter(Boolean);
  }

  async verify() {
    const { existsSync } = await import("node:fs");
    const tsconfigExists = existsSync(`${this.workspace}/tsconfig.json`);
    const jsconfigExists = existsSync(`${this.workspace}/jsconfig.json`);

    if (!tsconfigExists && !jsconfigExists) {
      return {
        type: "lsp" as const,
        success: true,
        output: "No TypeScript/JavaScript config found, skipping LSP check",
        durationMs: 0,
        timestamp: Date.now(),
      };
    }

    return super.verify();
  }
}
