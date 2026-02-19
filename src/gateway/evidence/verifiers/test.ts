import { BaseVerifier } from "../verifier.js";

export class TestVerifier extends BaseVerifier {
  getType(): "test" {
    return "test";
  }

  buildCommand(): string[] {
    const command = this.gate.command || "npm test";
    return command.split(" ").filter(Boolean);
  }
}
