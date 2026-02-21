export type ChannelsStatusSnapshot = {
  ts: number;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  channelDetailLabels?: Record<string, string>;
  channelSystemImages?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  channels: Record<string, unknown>;
  channelAccounts: Record<string, ChannelAccountSnapshot[]>;
  channelDefaultAccountId: Record<string, string>;
};

export type ChannelUiMetaEntry = {
  id: string;
  label: string;
  detailLabel: string;
  systemImage?: string;
};

export const CRON_CHANNEL_LAST = "last";

export type ChannelAccountSnapshot = {
  accountId: string;
  name?: string | null;
  enabled?: boolean | null;
  configured?: boolean | null;
  linked?: boolean | null;
  running?: boolean | null;
  connected?: boolean | null;
  reconnectAttempts?: number | null;
  lastConnectedAt?: number | null;
  lastError?: string | null;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  lastProbeAt?: number | null;
  mode?: string | null;
  dmPolicy?: string | null;
  allowFrom?: string[] | null;
  tokenSource?: string | null;
  botTokenSource?: string | null;
  appTokenSource?: string | null;
  credentialSource?: string | null;
  audienceType?: string | null;
  audience?: string | null;
  webhookPath?: string | null;
  webhookUrl?: string | null;
  baseUrl?: string | null;
  allowUnmentionedGroups?: boolean | null;
  cliPath?: string | null;
  dbPath?: string | null;
  port?: number | null;
  probe?: unknown;
  audit?: unknown;
  application?: unknown;
};

export type WhatsAppSelf = {
  e164?: string | null;
  jid?: string | null;
};

export type WhatsAppDisconnect = {
  at: number;
  status?: number | null;
  error?: string | null;
  loggedOut?: boolean | null;
};

export type WhatsAppStatus = {
  configured: boolean;
  linked: boolean;
  authAgeMs?: number | null;
  self?: WhatsAppSelf | null;
  running: boolean;
  connected: boolean;
  lastConnectedAt?: number | null;
  lastDisconnect?: WhatsAppDisconnect | null;
  reconnectAttempts: number;
  lastMessageAt?: number | null;
  lastEventAt?: number | null;
  lastError?: string | null;
};

export type TelegramBot = {
  id?: number | null;
  username?: string | null;
};

export type TelegramWebhook = {
  url?: string | null;
  hasCustomCert?: boolean | null;
};

export type TelegramProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
  bot?: TelegramBot | null;
  webhook?: TelegramWebhook | null;
};

export type TelegramStatus = {
  configured: boolean;
  tokenSource?: string | null;
  running: boolean;
  mode?: string | null;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  probe?: TelegramProbe | null;
  lastProbeAt?: number | null;
};

export type DiscordBot = {
  id?: string | null;
  username?: string | null;
};

export type DiscordProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
  bot?: DiscordBot | null;
};

export type DiscordStatus = {
  configured: boolean;
  tokenSource?: string | null;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  probe?: DiscordProbe | null;
  lastProbeAt?: number | null;
};

export type GoogleChatProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
};

export type GoogleChatStatus = {
  configured: boolean;
  credentialSource?: string | null;
  audienceType?: string | null;
  audience?: string | null;
  webhookPath?: string | null;
  webhookUrl?: string | null;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  probe?: GoogleChatProbe | null;
  lastProbeAt?: number | null;
};

export type SlackBot = {
  id?: string | null;
  name?: string | null;
};

export type SlackTeam = {
  id?: string | null;
  name?: string | null;
};

export type SlackProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
  bot?: SlackBot | null;
  team?: SlackTeam | null;
};

export type SlackStatus = {
  configured: boolean;
  botTokenSource?: string | null;
  appTokenSource?: string | null;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  probe?: SlackProbe | null;
  lastProbeAt?: number | null;
};

export type SignalProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
  version?: string | null;
};

export type SignalStatus = {
  configured: boolean;
  baseUrl: string;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  probe?: SignalProbe | null;
  lastProbeAt?: number | null;
};

export type IMessageProbe = {
  ok: boolean;
  error?: string | null;
};

export type IMessageStatus = {
  configured: boolean;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  cliPath?: string | null;
  dbPath?: string | null;
  probe?: IMessageProbe | null;
  lastProbeAt?: number | null;
};

export type NostrProfile = {
  name?: string | null;
  displayName?: string | null;
  about?: string | null;
  picture?: string | null;
  banner?: string | null;
  website?: string | null;
  nip05?: string | null;
  lud16?: string | null;
};

export type NostrStatus = {
  configured: boolean;
  publicKey?: string | null;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  profile?: NostrProfile | null;
};

export type MSTeamsProbe = {
  ok: boolean;
  error?: string | null;
  appId?: string | null;
};

export type MSTeamsStatus = {
  configured: boolean;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  port?: number | null;
  probe?: MSTeamsProbe | null;
  lastProbeAt?: number | null;
};

export type ConfigSnapshotIssue = {
  path: string;
  message: string;
};

export type ConfigSnapshot = {
  path?: string | null;
  exists?: boolean | null;
  raw?: string | null;
  hash?: string | null;
  parsed?: unknown;
  valid?: boolean | null;
  config?: Record<string, unknown> | null;
  issues?: ConfigSnapshotIssue[] | null;
};

export type ConfigUiHint = {
  label?: string;
  help?: string;
  group?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
  itemTemplate?: unknown;
};

export type ConfigUiHints = Record<string, ConfigUiHint>;

export type ConfigSchemaResponse = {
  schema: unknown;
  uiHints: ConfigUiHints;
  version: string;
  generatedAt: string;
};

export type PresenceEntry = {
  instanceId?: string | null;
  host?: string | null;
  ip?: string | null;
  version?: string | null;
  platform?: string | null;
  deviceFamily?: string | null;
  modelIdentifier?: string | null;
  roles?: string[] | null;
  scopes?: string[] | null;
  mode?: string | null;
  lastInputSeconds?: number | null;
  reason?: string | null;
  text?: string | null;
  ts?: number | null;
};

export type GatewaySessionsDefaults = {
  model: string | null;
  contextTokens: number | null;
};

export type GatewayAgentRow = {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
};

export type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: GatewayAgentRow[];
};

export type AgentIdentityResult = {
  agentId: string;
  name: string;
  avatar: string;
  emoji?: string;
};

export type AgentFileEntry = {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
};

export type AgentsFilesListResult = {
  agentId: string;
  workspace: string;
  files: AgentFileEntry[];
};

export type AgentsFilesGetResult = {
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
};

export type AgentsFilesSetResult = {
  ok: true;
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
};

export type GatewaySessionRow = {
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  label?: string;
  displayName?: string;
  surface?: string;
  subject?: string;
  room?: string;
  space?: string;
  updatedAt: number | null;
  sessionId?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  elevatedLevel?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  modelProvider?: string;
  contextTokens?: number;
};

export type SessionsListResult = {
  ts: number;
  path: string;
  count: number;
  defaults: GatewaySessionsDefaults;
  sessions: GatewaySessionRow[];
};

export type SessionsPatchResult = {
  ok: true;
  path: string;
  key: string;
  entry: {
    sessionId: string;
    updatedAt?: number;
    thinkingLevel?: string;
    verboseLevel?: string;
    reasoningLevel?: string;
    elevatedLevel?: string;
  };
};

export type {
  CostUsageDailyEntry,
  CostUsageSummary,
  SessionsUsageEntry,
  SessionsUsageResult,
  SessionsUsageTotals,
  SessionUsageTimePoint,
  SessionUsageTimeSeries,
} from "./usage-types.ts";

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string };

export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | {
      kind: "agentTurn";
      message: string;
      thinking?: string;
      timeoutSeconds?: number;
    };

export type CronDelivery = {
  mode: "none" | "announce" | "webhook";
  channel?: string;
  to?: string;
  bestEffort?: boolean;
};

export type CronJobState = {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
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
  delivery?: CronDelivery;
  state?: CronJobState;
};

export type CronStatus = {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number | null;
};

export type CronRunLogEntry = {
  ts: number;
  jobId: string;
  status: "ok" | "error" | "skipped";
  durationMs?: number;
  error?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
};

export type SkillsStatusConfigCheck = {
  path: string;
  satisfied: boolean;
};

export type SkillInstallOption = {
  id: string;
  kind: "brew" | "node" | "go" | "uv";
  label: string;
  bins: string[];
};

export type SkillStatusEntry = {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  skillKey: string;
  bundled?: boolean;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  configChecks: SkillsStatusConfigCheck[];
  install: SkillInstallOption[];
};

export type SkillStatusReport = {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
};

export type StatusSummary = Record<string, unknown>;

export type HealthSnapshot = Record<string, unknown>;

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogEntry = {
  raw: string;
  time?: string | null;
  level?: LogLevel | null;
  subsystem?: string | null;
  message?: string | null;
  meta?: Record<string, unknown> | null;
};

export type TedRecommendation = {
  id: string;
  severity: "info" | "warn" | "critical";
  message: string;
  next_step: string;
  decision: "pending" | "approved" | "dismissed";
};

export type TedJobCardDetail = {
  id: string;
  title: string;
  family: "GOV" | "MNT" | "ING" | "LED" | "OUT";
  operator_summary: string;
  kpi_signals: string[];
  path: string;
  status: "DONE" | "BLOCKED" | "IN_PROGRESS" | "TODO_OR_UNKNOWN";
  dependencies: string[];
  proof_script: string | null;
  outcome: string | null;
  non_negotiables: string[];
  deliverables: string[];
  proof_evidence: string[];
  markdown: string;
};

export type TedIntakeRecommendation = {
  priority: string;
  release_target: string;
  governance_tier: string;
  recommended_kpis: string[];
  hard_bans: string[];
  suggested_dependencies: string[];
  suggested_path: string;
  draft_markdown: string;
};

export type TedSourceDocument = {
  key: "job_board" | "promotion_policy" | "value_friction" | "interrogation_cycle";
  path: string;
  content: string;
};

export type TedKpiSuggestion = {
  id: string;
  family: "GOV" | "MNT" | "ING" | "LED" | "OUT";
  suggestions: string[];
  rationale: string;
};

export type TedJobCardImpactPreview = {
  id: string;
  before: {
    family: "GOV" | "MNT" | "ING" | "LED" | "OUT";
    dependencies: string[];
    kpi_signals: string[];
    proof_script: string | null;
    status: "DONE" | "BLOCKED" | "IN_PROGRESS" | "TODO_OR_UNKNOWN";
  };
  after: {
    family: "GOV" | "MNT" | "ING" | "LED" | "OUT";
    dependencies: string[];
    kpi_signals: string[];
    proof_script: string | null;
    status: "DONE" | "BLOCKED" | "IN_PROGRESS" | "TODO_OR_UNKNOWN";
  };
  impact_summary: string[];
  warnings: string[];
};

export type TedPolicyKey = "job_board" | "promotion_policy" | "value_friction";

export type TedPolicyConfig = {
  objective: string;
  rollout_mode: "conservative" | "balanced" | "aggressive";
  automation_ceiling: "draft-only" | "approval-first" | "limited-auto";
  success_checks: string[];
  guardrails: string[];
  operator_notes: string;
};

export type TedPolicyDocument = {
  key: TedPolicyKey;
  path: string;
  heading: string;
  config: TedPolicyConfig;
};

export type TedPolicyImpactPreview = {
  key: TedPolicyKey;
  path: string;
  impact_summary: string[];
  warnings: string[];
  preview_markdown: string;
};

export type TedConnectorAuthStartResponse = {
  profile_id: "olumie" | "everest";
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  expires_in?: number;
  interval?: number;
  message?: string;
};

export type TedConnectorAuthPollResponse = {
  profile_id: "olumie" | "everest";
  auth_state?: string;
  status?: string;
  message?: string;
  reason_code?: string;
  next_safe_step?: string;
};

export type TedConnectorAuthRevokeResponse = {
  profile_id: "olumie" | "everest";
  ok?: boolean;
  status?: string;
  message?: string;
};

export type TedWorkbenchSnapshot = {
  generated_at: string;
  data_sources: {
    job_cards_dir: string | null;
    job_cards_discovered: boolean;
  };
  operator_flow: {
    primary_approval_surface: "ted_workbench";
    secondary_approval_surface: "openclaw_chat";
    draft_review_surface: "ted_run_today_and_openclaw_chat";
    notes: string[];
  };
  integrations: {
    m365_profiles: Array<{
      profile_id: string;
      status: "connected" | "needs_auth" | "misconfigured" | "error";
      auth_store: string | null;
      delegated_scopes_count: number;
      last_error: string | null;
      next_step: string;
    }>;
  };
  sidecar: {
    healthy: boolean;
    status: Record<string, unknown> | null;
    doctor: Record<string, unknown> | null;
    error: string | null;
  };
  job_cards: {
    total: number;
    done: number;
    blocked: number;
    in_progress: number;
    todo_or_unknown: number;
    cards: Array<{
      id: string;
      title: string;
      family: "GOV" | "MNT" | "ING" | "LED" | "OUT";
      operator_summary: string;
      kpi_signals: string[];
      path: string;
      status: "DONE" | "BLOCKED" | "IN_PROGRESS" | "TODO_OR_UNKNOWN";
      dependencies: string[];
      proof_script: string | null;
      promotion_confidence: {
        score: number;
        band: "hold" | "watch" | "progressing" | "ready";
        drivers: string[];
        recommendation_outcomes: {
          approved: number;
          dismissed: number;
        };
      };
    }>;
  };
  friction_kpis: {
    manual_minutes_per_day_max: number;
    approval_queue_oldest_minutes_max: number;
    unresolved_triage_eod_max: number;
    blocked_actions_missing_explainability_max: number;
  };
  threshold_controls: {
    defaults: {
      manual_minutes_per_day_max: number;
      approval_queue_oldest_minutes_max: number;
      unresolved_triage_eod_max: number;
      blocked_actions_missing_explainability_max: number;
    };
    effective: {
      manual_minutes_per_day_max: number;
      approval_queue_oldest_minutes_max: number;
      unresolved_triage_eod_max: number;
      blocked_actions_missing_explainability_max: number;
    };
    overrides: {
      manual_minutes_per_day_max: number | null;
      approval_queue_oldest_minutes_max: number | null;
      unresolved_triage_eod_max: number | null;
      blocked_actions_missing_explainability_max: number | null;
    };
    relaxed: boolean;
    warnings: string[];
    updated_at: string | null;
  };
  policy_impacts: {
    totals_by_policy: {
      job_board: number;
      promotion_policy: number;
      value_friction: number;
    };
    recent: Array<{
      ts: string;
      policy_key: TedPolicyKey;
      risk_direction: "safer" | "riskier" | "neutral";
      changed_fields: string[];
      linked_cards: string[];
      rationale: string;
      expected_kpi_effects: string[];
    }>;
  };
  recommendations: TedRecommendation[];
  recommendation_outcomes: {
    totals: {
      approved: number;
      dismissed: number;
      pending: number;
    };
    recent: Array<{
      id: string;
      decision: "approved" | "dismissed";
      decided_at: string;
      linked_cards: string[];
      rationale: string;
    }>;
  };
  approval_queue: Array<{
    id: string;
    source: "recommendation" | "job_card";
    severity: "info" | "warn" | "critical";
    reason_code: string;
    summary: string;
    next_safe_step: string;
    status: "pending" | "approved" | "dismissed";
  }>;
  approval_ledger: {
    recent: Array<{
      id: string;
      source: "recommendation" | "job_card";
      recommendation_id: string | null;
      decision: "pending" | "approved" | "dismissed";
      reason_code: string;
      summary: string;
      linked_cards: string[];
      linked_card_confidence: Array<{
        card_id: string;
        score: number;
        band: "hold" | "watch" | "progressing" | "ready";
        top_driver: string;
      }>;
      next_safe_step: string;
      decided_at: string | null;
    }>;
  };
  governance_timeline_preview: Array<{
    ts: string;
    action:
      | "proof_run"
      | "recommendation_decision"
      | "threshold_update"
      | "rolecard_validate"
      | "intake_recommend"
      | "jobcard_update";
    outcome: "allowed" | "blocked";
    reason_code: string;
    next_safe_step: string;
  }>;
  kpi_history_preview: Array<{
    ts: string;
    manual_minutes_per_day_max: number;
    approval_queue_oldest_minutes_max: number;
    unresolved_triage_eod_max: number;
    blocked_actions_missing_explainability_max: number;
  }>;
  eval_history_preview: Array<{
    ts: string;
    proof_script: string;
    ok: boolean;
    exit_code: number;
  }>;
  references: {
    job_board: string;
    promotion_policy: string;
    value_friction: string;
    interrogation_cycle: string;
  };
};
