import type { ChannelId } from "../channels/plugins/types.js";

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | {
      kind: "cron";
      expr: string;
      tz?: string;
      /** Optional deterministic stagger window in milliseconds (0 keeps exact schedule). */
      staggerMs?: number;
    };

export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";

export type CronMessageChannel = ChannelId | "last";

export type CronDeliveryMode = "none" | "announce" | "webhook";

export type CronDelivery = {
  mode: CronDeliveryMode;
  channel?: CronMessageChannel;
  to?: string;
  bestEffort?: boolean;
};

export type CronDeliveryPatch = Partial<CronDelivery>;

export type CronRunStatus = "ok" | "error" | "skipped";

export type CronUsageSummary = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
};

export type CronRunTelemetry = {
  model?: string;
  provider?: string;
  usage?: CronUsageSummary;
};

export type CronRunOutcome = {
  status: CronRunStatus;
  error?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
};

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | {
      kind: "agentTurn";
      message: string;
      /** Optional model override (provider/model or alias). */
      model?: string;
      thinking?: string;
      timeoutSeconds?: number;
      allowUnsafeExternalContent?: boolean;
      deliver?: boolean;
      channel?: CronMessageChannel;
      to?: string;
      bestEffortDeliver?: boolean;
    };

export type CronPayloadPatch =
  | { kind: "systemEvent"; text?: string }
  | {
      kind: "agentTurn";
      message?: string;
      model?: string;
      thinking?: string;
      timeoutSeconds?: number;
      allowUnsafeExternalContent?: boolean;
      deliver?: boolean;
      channel?: CronMessageChannel;
      to?: string;
      bestEffortDeliver?: boolean;
    };

export type CronJobState = {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
  /** Number of consecutive execution errors (reset on success). Used for backoff. */
  consecutiveErrors?: number;
  /** Number of consecutive schedule computation errors. Auto-disables job after threshold. */
  scheduleErrorCount?: number;
  /** Whether the last run's output was delivered to the target channel. */
  lastDelivered?: boolean;
};

export type CronJob = {
  id: string;
  agentId?: string;
  /** Origin session namespace for reminder delivery and wake routing. */
  sessionKey?: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: CronSessionTarget;
  wakeMode: CronWakeMode;
  payload: CronPayload;
  delivery?: CronDelivery;
  scheduler?: CronJobSchedulerExtensions;
  state: CronJobState;
};

export type CronStoreFile = {
  version: 1;
  jobs: CronJob[];
};

export type CronJobCreate = Omit<CronJob, "id" | "createdAtMs" | "updatedAtMs" | "state"> & {
  state?: Partial<CronJobState>;
};

export type CronJobPatch = Partial<Omit<CronJob, "id" | "createdAtMs" | "state" | "payload">> & {
  payload?: CronPayloadPatch;
  delivery?: CronDeliveryPatch;
  state?: Partial<CronJobState>;
};

// ── Scheduler extensions (v5+) ─────────────────────────────

/** Delivery guarantee for crash recovery behavior. */
export type CronDeliveryGuarantee = "at-most-once" | "at-least-once";

/** Overlap policy when a previous run is still active. */
export type CronOverlapPolicy = "skip" | "allow" | "queue";

/** Job class for specialized dispatch behavior. */
export type CronJobClass = "standard" | "pre_compaction_flush";

/** Context retrieval mode for injecting prior run context. */
export type CronContextRetrieval = "none" | "recent" | "hybrid";

/** Run status extended with scheduler states. */
export type CronRunStatusExtended =
  | CronRunStatus
  | "timeout"
  | "crashed"
  | "awaiting_approval"
  | "cancelled";

/** Approval gate configuration. */
export type CronApprovalConfig = {
  required: boolean;
  timeoutS?: number;
  auto?: "approve" | "reject";
};

/** Workflow chain configuration. */
export type CronChainConfig = {
  parentId?: string;
  triggerOn?: "success" | "failure" | "complete";
  triggerDelayS?: number;
  triggerCondition?: string; // "contains:<substr>" | "regex:<pattern>"
};

/** Resource pool for cross-job concurrency control. */
export type CronResourcePool = string;

/** Task contract schema for validated pipeline events. */
export type CronTaskContract = {
  /** Schema name (e.g., "odds_capture", "health_check"). */
  name: string;
  /** JSON Schema for validating job output. */
  outputSchema?: Record<string, unknown>;
  /** JSON Schema for validating input from parent job. */
  inputSchema?: Record<string, unknown>;
  /** Required fields in the output. */
  requiredOutputFields?: string[];
};

/** Extended job fields for scheduler features. */
export type CronJobSchedulerExtensions = {
  deliveryGuarantee?: CronDeliveryGuarantee;
  overlapPolicy?: CronOverlapPolicy;
  jobClass?: CronJobClass;
  contextRetrieval?: CronContextRetrieval;
  contextRetrievalLimit?: number;
  approval?: CronApprovalConfig;
  chain?: CronChainConfig;
  resourcePool?: CronResourcePool;
  maxRetries?: number;
  runTimeoutMs?: number;
  payloadScope?: "own" | "global";
  taskContract?: CronTaskContract;
  idempotencyKeyPrefix?: string;
};

/** Extended run log entry with scheduler metadata. */
export type CronRunLogSchedulerExtensions = {
  idempotencyKey?: string;
  replayOf?: string;
  contextSummary?: Record<string, unknown>;
  chainTriggeredBy?: string;
  approvalId?: string;
  contractValidation?: { valid: boolean; errors?: string[] };
};
