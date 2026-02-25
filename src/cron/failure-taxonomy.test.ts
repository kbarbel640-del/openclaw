import { describe, expect, it } from "vitest";
import {
  CRON_FAILURE_TAXONOMY_FLAG,
  attachCronFailureClassification,
  buildCronFailureClassification,
  inferCronFailureClassificationFromError,
  isCronFailureTaxonomyEnabled,
} from "./failure-taxonomy.js";
import type { CronRunOutcome } from "./types.js";

describe("cron failure taxonomy", () => {
  it("enables taxonomy when diagnostics flag is configured", () => {
    expect(
      isCronFailureTaxonomyEnabled({
        diagnostics: {
          flags: [CRON_FAILURE_TAXONOMY_FLAG],
        },
      }),
    ).toBe(true);

    expect(
      isCronFailureTaxonomyEnabled(undefined, {
        OPENCLAW_DIAGNOSTICS: CRON_FAILURE_TAXONOMY_FLAG,
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("builds guardrail taxonomy with required fields", () => {
    const timeout = buildCronFailureClassification({
      kind: "timeout",
      stage: "execution",
      rootCause: "job-execution-timeout",
      metadata: { source: "unit-test" },
    });

    expect(timeout.errorKind).toBe("timeout");
    expect(timeout.failure).toEqual({
      type: "timeout",
      stage: "execution",
      rootCause: "job-execution-timeout",
      severity: "high",
      retriable: true,
      metadata: { source: "unit-test" },
    });
  });

  it("attaches taxonomy only when feature is enabled", () => {
    const classification = buildCronFailureClassification({
      kind: "runtime-validation",
      stage: "input_validation",
      rootCause: "main-job-payload-invalid",
    });

    const disabled = attachCronFailureClassification<CronRunOutcome>({
      enabled: false,
      outcome: { status: "error" as const, error: "main job requires payload.kind=systemEvent" },
      classification,
    });
    expect(disabled).toEqual({
      status: "error",
      error: "main job requires payload.kind=systemEvent",
    });

    const enabled = attachCronFailureClassification<CronRunOutcome>({
      enabled: true,
      outcome: { status: "error" as const, error: "main job requires payload.kind=systemEvent" },
      classification,
    });
    expect(enabled.errorKind).toBe("runtime-validation");
    expect(enabled.failure?.rootCause).toBe("main-job-payload-invalid");
  });

  it("infers deterministic guardrail mappings for tool/runtime validation and timeout", () => {
    expect(
      inferCronFailureClassificationFromError("invalid cron.add params: missing name")?.errorKind,
    ).toBe("tool-validation");

    const runtime = inferCronFailureClassificationFromError(
      'main job requires payload.kind="systemEvent"',
    );
    expect(runtime?.errorKind).toBe("runtime-validation");
    expect(runtime?.failure.stage).toBe("input_validation");

    const timeout = inferCronFailureClassificationFromError("cron: job execution timed out");
    expect(timeout?.errorKind).toBe("timeout");
    expect(timeout?.failure.retriable).toBe(true);
  });
});
