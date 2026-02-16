export type GateFailure = {
  gate: "schema" | "invariant" | "extract" | "json_parse";
  id: string;
  message: string;
  path?: string;
  details?: unknown;
};

export type GateResult =
  | { ok: true }
  | {
      ok: false;
      failures: GateFailure[];
    };
