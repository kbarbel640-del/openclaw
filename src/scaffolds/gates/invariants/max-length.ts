import type { GateFailure } from "../types.js";

type Params = {
  field: string;
  max: number;
};

export function runMaxLengthInvariant(params: {
  artifact: unknown;
  params: Params;
}): GateFailure[] {
  const artifact = params.artifact as Record<string, unknown> | null;
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    return [];
  }

  const field = params.params.field;
  const max = params.params.max;
  const val = artifact[field];
  if (typeof val !== "string") {
    return [];
  }

  if (val.length <= max) {
    return [];
  }

  return [
    {
      gate: "invariant",
      id: "max_length",
      message: `exceeds max length ${max}`,
      path: `$/` + field,
      details: { field, max, length: val.length },
    },
  ];
}
