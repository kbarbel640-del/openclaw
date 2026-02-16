import type { GateFailure } from "../types.js";

type Params = {
  tokens?: string[];
};

const DEFAULT_TOKENS = ["TODO", "TBD", "<placeholder>", "..."];

function toPath(parts: Array<string | number>): string {
  if (parts.length === 0) {
    return "$";
  }
  return `$/` + parts.map((p) => String(p)).join("/");
}

export function runNoPlaceholdersInvariant(params: {
  artifact: unknown;
  params?: Params;
}): GateFailure[] {
  const tokens = (params.params?.tokens?.length ? params.params.tokens : DEFAULT_TOKENS).map((t) =>
    String(t),
  );
  const tokensLower = tokens.map((t) => t.toLowerCase());

  const failures: GateFailure[] = [];

  const visit = (value: unknown, pathParts: Array<string | number>): void => {
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      for (let i = 0; i < tokensLower.length; i += 1) {
        const tokLower = tokensLower[i];
        if (tokLower && lower.includes(tokLower)) {
          const tok = tokens[i] ?? tokLower;
          failures.push({
            gate: "invariant",
            id: "no_placeholders",
            message: `contains "${tok}"`,
            path: toPath(pathParts),
            details: { token: tok },
          });
          break;
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        visit(value[i], [...pathParts, i]);
      }
      return;
    }

    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      for (const k of Object.keys(obj).toSorted()) {
        visit(obj[k], [...pathParts, k]);
      }
    }
  };

  visit(params.artifact, []);

  return failures;
}
