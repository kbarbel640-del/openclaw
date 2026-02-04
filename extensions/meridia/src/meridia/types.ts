export type MeridiaEvaluationV2 = {
  kind: "heuristic" | "llm";
  score: number;
  reason?: string;
  model?: string;
  durationMs?: number;
  error?: string;
};

export type MeridiaExperienceKindV2 = "tool_result" | "manual" | "precompact" | "session_end";

export type MeridiaExperienceRecordV2 = {
  v: 2;
  id: string;
  ts: string;
  kind: MeridiaExperienceKindV2;
  session?: { key?: string; id?: string; runId?: string };
  tool?: { name: string; callId: string; meta?: string; isError: boolean };
  capture: {
    score: number;
    threshold?: number;
    evaluation: MeridiaEvaluationV2;
    limited?: { reason: "min_interval" | "max_per_hour"; detail?: string };
  };
  content?: {
    topic?: string;
    summary?: string;
    context?: string;
    tags?: string[];
    anchors?: string[];
    facets?: {
      emotions?: string[];
      uncertainty?: string[];
      relationship?: string[];
      consequences?: string[];
    };
  };
  data?: { args?: unknown; result?: unknown; snapshot?: unknown; summary?: unknown };
};

export type MeridiaTraceEventKindV2 =
  | "tool_result_eval"
  | "precompact_snapshot"
  | "compaction_end"
  | "session_end_snapshot"
  | "bootstrap_inject";

export type MeridiaTraceEventV2 = {
  v: 2;
  id: string;
  ts: string;
  kind: MeridiaTraceEventKindV2;
  session?: { key?: string; id?: string; runId?: string };
  tool?: { name?: string; callId?: string; meta?: string; isError?: boolean };
  decision?: {
    decision: "capture" | "skip" | "error";
    score?: number;
    threshold?: number;
    limited?: { reason: "min_interval" | "max_per_hour"; detail?: string };
    evaluation?: MeridiaEvaluationV2;
    recordId?: string;
    error?: string;
  };
  paths?: { snapshotPath?: string; summaryPath?: string };
};

export type MeridiaToolResultContextV2 = {
  session?: { key?: string; id?: string; runId?: string };
  tool: { name: string; callId: string; meta?: string; isError: boolean };
  args?: unknown;
  result?: unknown;
};
