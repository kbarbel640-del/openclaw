import type { OpenClawConfig } from "../config/config.js";
import { isDiagnosticFlagEnabled } from "../infra/diagnostic-flags.js";
import type {
  CronFailureSeverity,
  CronFailureStage,
  CronFailureTaxonomy,
  CronFailureType,
  CronRunErrorKind,
  CronRunOutcome,
} from "./types.js";

export const CRON_FAILURE_TAXONOMY_FLAG = "cron.failure-taxonomy";

export type CronFailureGuardrailClass = "tool-validation" | "runtime-validation" | "timeout";

export type CronFailureClassification = {
  errorKind: Exclude<CronRunErrorKind, "delivery-target">;
  failure: CronFailureTaxonomy;
};

export function isCronFailureTaxonomyEnabled(
  cfg?: OpenClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isDiagnosticFlagEnabled(CRON_FAILURE_TAXONOMY_FLAG, cfg, env);
}

function guardrailDefaults(kind: CronFailureGuardrailClass): {
  type: CronFailureType;
  severity: CronFailureSeverity;
  retriable: boolean;
  errorKind: Exclude<CronRunErrorKind, "delivery-target">;
} {
  if (kind === "timeout") {
    return {
      type: "timeout",
      severity: "high",
      retriable: true,
      errorKind: "timeout",
    };
  }
  if (kind === "tool-validation") {
    return {
      type: "tool_validation",
      severity: "medium",
      retriable: false,
      errorKind: "tool-validation",
    };
  }
  return {
    type: "runtime_validation",
    severity: "medium",
    retriable: false,
    errorKind: "runtime-validation",
  };
}

export function buildCronFailureClassification(params: {
  kind: CronFailureGuardrailClass;
  stage: CronFailureStage;
  rootCause: string;
  metadata?: Record<string, unknown>;
}): CronFailureClassification {
  const defaults = guardrailDefaults(params.kind);
  return {
    errorKind: defaults.errorKind,
    failure: {
      type: defaults.type,
      stage: params.stage,
      rootCause: params.rootCause,
      severity: defaults.severity,
      retriable: defaults.retriable,
      ...(params.metadata ? { metadata: params.metadata } : {}),
    },
  };
}

export function attachCronFailureClassification<T extends CronRunOutcome>(params: {
  enabled: boolean;
  outcome: T;
  classification?: CronFailureClassification;
}): T {
  if (!params.enabled || !params.classification) {
    return params.outcome;
  }
  return {
    ...params.outcome,
    errorKind: params.outcome.errorKind ?? params.classification.errorKind,
    failure: params.classification.failure,
  };
}

const TOOL_VALIDATION_ERROR_RE = /^invalid\s+[a-z0-9_.-]+\s+params\b/i;
const RUNTIME_VALIDATION_ERROR_RE =
  /(requires payload\.kind|requires non-empty|invalid model reference|delivery channel is missing|delivery target is missing|delivery\.to must be a valid)/i;
const TIMEOUT_ERROR_RE = /(timed out|timeout|deadline exceeded|aborterror)/i;

export function inferCronFailureClassificationFromError(
  error?: string,
): CronFailureClassification | undefined {
  const value = error?.trim();
  if (!value) {
    return undefined;
  }
  if (TOOL_VALIDATION_ERROR_RE.test(value)) {
    return buildCronFailureClassification({
      kind: "tool-validation",
      stage: "input_validation",
      rootCause: "tool-params-invalid",
      metadata: { message: value },
    });
  }
  if (RUNTIME_VALIDATION_ERROR_RE.test(value)) {
    const rootCause = value.toLowerCase().includes("model")
      ? "runtime-model-validation-failed"
      : "runtime-validation-failed";
    return buildCronFailureClassification({
      kind: "runtime-validation",
      stage: value.toLowerCase().includes("delivery") ? "delivery" : "input_validation",
      rootCause,
      metadata: { message: value },
    });
  }
  if (TIMEOUT_ERROR_RE.test(value)) {
    return buildCronFailureClassification({
      kind: "timeout",
      stage: "execution",
      rootCause: "job-execution-timeout",
      metadata: { message: value },
    });
  }
  return undefined;
}
