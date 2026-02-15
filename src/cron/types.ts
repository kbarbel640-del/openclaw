import type { ChannelId } from "../channels/plugins/types.js";

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string };

export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";

export type CronMessageChannel = ChannelId | "last";

export type CronDeliveryMode = "none" | "announce";

export type CronDelivery = {
  mode: CronDeliveryMode;
  channel?: CronMessageChannel;
  to?: string;
  bestEffort?: boolean;
};

export type CronDeliveryPatch = Partial<CronDelivery>;

/**
 * Pre-check gate: a lightweight shell command that runs before the agent turn.
 * If the command exits 0 and produces non-empty stdout, the job proceeds with
 * stdout as context. If it exits non-zero or produces empty stdout, the job
 * is skipped — saving tokens when there's nothing to do.
 *
 * Example: `preCheck: { command: "gh pr list --state open --json number | jq 'if length > 0 then . else empty end'" }`
 * Only wakes the agent when there are open PRs.
 */
export type CronPreCheck = {
  /** Shell command to execute. Runs in the agent workspace directory. */
  command: string;
  /** Timeout in seconds (default: 30). Killed + skipped on timeout. */
  timeoutSeconds?: number;
  /**
   * What to do with stdout when the check passes:
   * - "prepend" (default): prepend stdout to the agent message/system-event as context
   * - "replace": use stdout as the entire message (replaces payload text/message)
   * - "ignore": discard stdout, just use the gate result
   */
  outputMode?: "prepend" | "replace" | "ignore";
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
};

export type CronJob = {
  id: string;
  agentId?: string;
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
  /** Optional pre-check gate. Runs a shell command before the agent turn;
   *  skips the job (no tokens spent) if the command fails or returns empty. */
  preCheck?: CronPreCheck;
  delivery?: CronDelivery;
  state: CronJobState;
};

export type CronStoreFile = {
  version: 1;
  jobs: CronJob[];
};

export type CronJobCreate = Omit<CronJob, "id" | "createdAtMs" | "updatedAtMs" | "state"> & {
  state?: Partial<CronJobState>;
};

export type CronPreCheckPatch = Partial<CronPreCheck>;

export type CronJobPatch = Partial<
  Omit<CronJob, "id" | "createdAtMs" | "state" | "payload" | "preCheck">
> & {
  payload?: CronPayloadPatch;
  preCheck?: CronPreCheckPatch | null;
  delivery?: CronDeliveryPatch;
  state?: Partial<CronJobState>;
};
