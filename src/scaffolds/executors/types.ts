import type { BudgetCounter } from "../budgets/budget-counter.js";
import type { SkillScaffoldManifestV1 } from "../manifests/skill-scaffold-manifest.v1.js";

export type ScaffoldExecutorId = "g-v-p";

export type ScaffoldExecutionContext = {
  sessionId: string;
  sessionKey?: string;
  runId?: string;
  agentId?: string;
  provider?: string;
  modelId?: string;
  messageChannel?: string;
  workspaceDir?: string;

  skillId?: string;
  skillName?: string;

  // Convenience: the user-visible prompt that triggered the scaffold.
  prompt?: string;
};

export type ScaffoldModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CallModelFn = (params: {
  messages: ScaffoldModelMessage[];
}) => Promise<{ text: string }>;

export type ScaffoldExecutorResult = {
  text: string;
  meta?: {
    applied?: string[];
    warnings?: string[];
    debug?: Record<string, unknown>;
  };
};

export interface ScaffoldExecutor {
  readonly id: ScaffoldExecutorId;

  execute(params: {
    ctx: ScaffoldExecutionContext;
    manifest: SkillScaffoldManifestV1;
    callModel: CallModelFn;
    budgets: BudgetCounter;
  }): Promise<ScaffoldExecutorResult>;
}
