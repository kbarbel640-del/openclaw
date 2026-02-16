import type { SkillScaffoldInvariantSpecV1 } from "../../manifests/skill-scaffold-manifest.v1.js";
import type { GateFailure } from "../types.js";
import { runMaxLengthInvariant } from "./max-length.js";
import { runNoPlaceholdersInvariant } from "./no-placeholders.js";

export function runInvariant(params: {
  artifact: unknown;
  spec: SkillScaffoldInvariantSpecV1;
}): GateFailure[] {
  if (params.spec.id === "no_placeholders") {
    return runNoPlaceholdersInvariant({ artifact: params.artifact, params: params.spec.params });
  }
  if (params.spec.id === "max_length") {
    return runMaxLengthInvariant({ artifact: params.artifact, params: params.spec.params });
  }

  // Should never happen due to manifest parsing (fail-closed).
  return [
    {
      gate: "invariant",
      id: "unknown_invariant",
      message: `Unknown invariant id: ${(params.spec as { id?: string }).id}`,
      path: "$",
    },
  ];
}
