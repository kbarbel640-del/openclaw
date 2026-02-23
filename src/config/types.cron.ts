export type CronCriticLoopConfig = {
  /** Feature flag for deterministic executor-output critic scoring. */
  enabled?: boolean;
  /** Default pass threshold (0..1). Jobs may override via payload.criticThreshold. */
  minScore?: number;
  /** Optional default spec text to evaluate against when job payload omits criticSpec. */
  defaultSpec?: string;
};

export type CronConfig = {
  enabled?: boolean;
  store?: string;
  maxConcurrentRuns?: number;
  /**
   * Deprecated legacy fallback webhook URL used only for stored jobs with notify=true.
   * Prefer per-job delivery.mode="webhook" with delivery.to.
   */
  webhook?: string;
  /** Bearer token for cron webhook POST delivery. */
  webhookToken?: string;
  /**
   * How long to retain completed cron run sessions before automatic pruning.
   * Accepts a duration string (e.g. "24h", "7d", "1h30m") or `false` to disable pruning.
   * Default: "24h".
   */
  sessionRetention?: string | false;
  /**
   * Run-log pruning controls for `cron/runs/<jobId>.jsonl`.
   * Defaults: `maxBytes=2_000_000`, `keepLines=2000`.
   */
  runLog?: {
    maxBytes?: number | string;
    keepLines?: number;
  };
  /**
   * Optional deterministic critic-loop gate for isolated executor outputs.
   * Disabled by default.
   */
  criticLoop?: CronCriticLoopConfig;
};
