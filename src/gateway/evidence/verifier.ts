import { spawn } from "node:child_process";
import type { EvidenceGate, VerificationResult, EvidenceGateType } from "./types.js";

export abstract class BaseVerifier {
  protected gate: EvidenceGate;
  protected workspace: string;

  constructor(gate: EvidenceGate, workspace: string) {
    this.gate = gate;
    this.workspace = workspace;
  }

  abstract getType(): EvidenceGateType;
  abstract buildCommand(): string[];

  async verify(): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      const result = await this.runCommand();
      const durationMs = Date.now() - startTime;

      return {
        type: this.getType(),
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr || undefined,
        durationMs,
        timestamp: Date.now(),
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        type: this.getType(),
        success: false,
        output: "",
        error: String(error),
        durationMs,
        timestamp: Date.now(),
      };
    }
  }

  protected runCommand(): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const args = this.buildCommand();
      const proc = spawn(args[0], args.slice(1), {
        cwd: this.workspace,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      proc.on("error", (err) => {
        stderr += err.message;
        resolve({ stdout, stderr, exitCode: 1 });
      });

      if (this.gate.timeoutMs) {
        setTimeout(() => {
          proc.kill();
          resolve({ stdout, stderr: "Timeout", exitCode: 1 });
        }, this.gate.timeoutMs);
      }
    });
  }
}
