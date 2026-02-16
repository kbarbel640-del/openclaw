import type { SkillScaffoldInvariantSpecV1 } from "../manifests/skill-scaffold-manifest.v1.js";
import type { GateFailure, GateResult } from "./types.js";
import { runInvariant } from "./invariants/index.js";
import { runSchemaGate } from "./schema-gate.js";

export function runGatePipeline(params: {
  artifact: unknown;
  schema: unknown;
  answerField: string;
  invariants: SkillScaffoldInvariantSpecV1[];
}): GateResult {
  const failures: GateFailure[] = [];

  // 1) schema
  const schemaResult = runSchemaGate({ artifact: params.artifact, schema: params.schema });
  if (!schemaResult.ok) {
    failures.push(...schemaResult.failures);
    return { ok: false, failures };
  }

  // 2) extract (only if schema passed)
  const obj = params.artifact as Record<string, unknown> | null;
  const answerVal =
    obj && typeof obj === "object" && !Array.isArray(obj) ? obj[params.answerField] : undefined;
  if (typeof answerVal !== "string") {
    failures.push({
      gate: "extract",
      id: "answer_field_missing",
      message: `answerField '${params.answerField}' must be a string`,
      path: `$/` + params.answerField,
    });
    return { ok: false, failures };
  }

  // 3) invariants in manifest order
  for (const inv of params.invariants) {
    failures.push(...runInvariant({ artifact: params.artifact, spec: inv }));
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  return { ok: true };
}
