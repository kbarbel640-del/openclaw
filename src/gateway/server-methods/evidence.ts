import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { EvidenceGateManager } from "../evidence/manager.js";
import type { EvidenceConfig } from "../evidence/types.js";

const DEFAULT_EVIDENCE_CONFIG: EvidenceConfig = {
  enabled: false,
  gates: [],
  failOnError: false,
};

export const evidenceHandlers: GatewayRequestHandlers = {
  "evidence.run": async ({ respond }) => {
    try {
      const workspace = process.cwd();
      const config: EvidenceConfig = DEFAULT_EVIDENCE_CONFIG;

      const manager = new EvidenceGateManager(config, workspace);
      const results = await manager.runAllGates();

      const validation = manager.validateResults(results);
      respond(true, {
        results,
        passed: validation.passed,
        failed: validation.failed,
        optional: validation.optional,
      });
    } catch (error) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(error)));
    }
  },

  "evidence.status": async ({ respond }) => {
    try {
      const workspace = process.cwd();
      const config: EvidenceConfig = DEFAULT_EVIDENCE_CONFIG;

      const manager = new EvidenceGateManager(config, workspace);

      respond(true, {
        enabled: manager.isEnabled(),
        workspace,
      });
    } catch (error) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(error)));
    }
  },
};
