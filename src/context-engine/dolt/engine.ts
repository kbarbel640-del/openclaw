import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type {
  AssembleResult,
  BootstrapResult,
  CompactResult,
  ContextEngine,
  ContextEngineInfo,
  IngestBatchResult,
  IngestResult,
} from "../types.js";
import { registerContextEngine } from "../registry.js";

/**
 * Built-in Dolt context engine registration target.
 *
 * This engine is intentionally isolated from the legacy bridge path so selecting
 * `contextEngine: "dolt"` never silently routes through legacy compaction.
 */
export class DoltContextEngine implements ContextEngine {
  readonly info: ContextEngineInfo = {
    id: "dolt",
    name: "Dolt Context Engine",
    version: "0.1.0",
    ownsCompaction: true,
  };

  async bootstrap(_params: { sessionId: string; sessionFile: string }): Promise<BootstrapResult> {
    return {
      bootstrapped: false,
      reason: "dolt_bootstrap_not_yet_enabled",
    };
  }

  async ingest(_params: {
    sessionId: string;
    message: AgentMessage;
    isHeartbeat?: boolean;
  }): Promise<IngestResult> {
    return { ingested: false };
  }

  async ingestBatch(_params: {
    sessionId: string;
    messages: AgentMessage[];
    isHeartbeat?: boolean;
  }): Promise<IngestBatchResult> {
    return { ingestedCount: 0 };
  }

  async assemble(params: {
    sessionId: string;
    messages: AgentMessage[];
    tokenBudget?: number;
  }): Promise<AssembleResult> {
    return {
      messages: params.messages,
      estimatedTokens: 0,
    };
  }

  async compact(_params: {
    sessionId: string;
    sessionFile: string;
    tokenBudget?: number;
    currentTokenCount?: number;
    compactionTarget?: "budget" | "threshold";
    customInstructions?: string;
    legacyParams?: Record<string, unknown>;
  }): Promise<CompactResult> {
    return {
      ok: true,
      compacted: false,
      reason: "dolt_compaction_not_yet_enabled",
    };
  }

  async dispose(): Promise<void> {
    // No resources yet.
  }
}

/** Register the built-in Dolt context engine factory. */
export function registerDoltContextEngine(): void {
  registerContextEngine("dolt", () => new DoltContextEngine());
}
