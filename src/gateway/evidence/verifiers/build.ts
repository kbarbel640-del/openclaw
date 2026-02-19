import { BaseVerifier } from "../verifier.js";

export class BuildVerifier extends BaseVerifier {
  getType(): "build" {
    return "build";
  }

  buildCommand(): string[] {
    const command = this.gate.command || "npm run build";
    return command.split(" ").filter(Boolean);
  }
}
