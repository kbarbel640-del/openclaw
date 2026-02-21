import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { GatewayRequestHandlerOptions, OpenClawPluginApi } from "openclaw/plugin-sdk";

const DEFAULT_BASE_URL = "http://127.0.0.1:48080";
const DEFAULT_TIMEOUT_MS = 5000;
const ALLOWED_PATHS = new Set(["/status", "/doctor"]);
const DEFAULT_HEALTH_CHECK_RETRIES = 20;
const DEFAULT_HEALTH_CHECK_DELAY_MS = 250;
const OPERATOR_KEY = process.env.TED_ENGINE_OPERATOR_KEY?.trim() || "ted-local-operator";
const AUTH_TTL_MS_RAW = Number.parseInt(process.env.TED_ENGINE_AUTH_TTL_MS || "3600000", 10);
const AUTH_TTL_MS =
  Number.isFinite(AUTH_TTL_MS_RAW) && AUTH_TTL_MS_RAW > 0 ? AUTH_TTL_MS_RAW : 3600000;

type TedSidecarPluginConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  autostart?: boolean;
  sidecarPath?: string;
};

type TedHealthPayload = {
  version: string;
  uptime: number;
  profiles_count: number;
  catalog?: TedCatalogPayload;
};

type TedCatalogPayload = {
  discoverability_version: string;
  commands: string[];
  route_families: string[];
  governance_guards: string[];
  non_health_auth_required: boolean;
};

type TedWorkbenchPayload = {
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
    status: TedHealthPayload | null;
    doctor: TedHealthPayload | null;
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
  recommendations: Array<{
    id: string;
    severity: "info" | "warn" | "critical";
    message: string;
    next_step: string;
    decision: "pending" | "approved" | "dismissed";
  }>;
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

type JobCardSummary = {
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
};

type JobCardRecord = {
  id: string;
  title: string;
  family: "GOV" | "MNT" | "ING" | "LED" | "OUT";
  operator_summary: string;
  kpi_signals: string[];
  path: string;
  status: "DONE" | "BLOCKED" | "IN_PROGRESS" | "TODO_OR_UNKNOWN";
  dependencies: string[];
  proof_script: string | null;
  fullPath: string;
  contents: string;
};

type TedPolicyKey = "job_board" | "promotion_policy" | "value_friction";
type TedPolicyConfig = {
  objective: string;
  rollout_mode: "conservative" | "balanced" | "aggressive";
  automation_ceiling: "draft-only" | "approval-first" | "limited-auto";
  success_checks: string[];
  guardrails: string[];
  operator_notes: string;
};

const POLICY_PATHS: Record<TedPolicyKey, string> = {
  job_board: "docs/ted-profile/sdd-pack/10_ROADMAP_JOB_BOARD.md",
  promotion_policy: "docs/ted-profile/sdd-pack/14_DAY1_PROMOTION_POLICY.md",
  value_friction: "docs/ted-profile/sdd-pack/15_VALUE_AND_FRICTION_GATES.md",
};

let sidecarProcess: ChildProcess | null = null;
let sidecarLastError: string | null = null;
let cachedGatewayAuth: { token: string; expiresAtMs: number } | null = null;
const PROOF_SCRIPT_PATH_RE = /^scripts\/ted-profile\/proof_jc\d+\.sh$/i;
const RECOMMENDATION_DECISIONS_FILE = "recommendation_decisions.json";
const RECOMMENDATION_OUTCOMES_FILE = "recommendation_outcomes.json";
const POLICY_IMPACTS_FILE = "policy_impacts.json";
const GATE_OVERRIDES_FILE = "gate_overrides.json";
const GOVERNANCE_EVENTS_FILE = "governance_events.json";
const KPI_HISTORY_FILE = "kpi_history.json";
const EVAL_HISTORY_FILE = "eval_history.json";
const DEFAULT_FRICTION_KPIS = {
  manual_minutes_per_day_max: 45,
  approval_queue_oldest_minutes_max: 120,
  unresolved_triage_eod_max: 12,
  blocked_actions_missing_explainability_max: 0,
} as const;

function ancestorPaths(start: string, limit = 8): string[] {
  const out: string[] = [];
  let current = path.resolve(start);
  for (let i = 0; i < limit; i += 1) {
    out.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return out;
}

function resolveJobCardsDir(api: OpenClawPluginApi): string | null {
  const explicit = process.env.TED_JOB_CARDS_DIR?.trim();
  const relative = "docs/ted-profile/job-cards";
  const candidates = new Set<string>();

  if (explicit) {
    candidates.add(path.resolve(explicit));
  }

  // Primary path when running gateway from repo root.
  candidates.add(api.resolvePath(relative));

  // Common runtime roots (repo checkout, extension source path, launch cwd).
  candidates.add(path.resolve(process.cwd(), relative));
  candidates.add(path.resolve(path.dirname(api.source), relative));
  for (const root of ancestorPaths(path.dirname(api.source), 10)) {
    candidates.add(path.resolve(root, relative));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveTedUiRuntimeDir(api: OpenClawPluginApi): string {
  return api.resolvePath(".specify/runtime/ted_ui");
}

function readRecommendationDecisions(
  api: OpenClawPluginApi,
): Record<string, "approved" | "dismissed"> {
  try {
    const runtimeDir = resolveTedUiRuntimeDir(api);
    const fullPath = path.join(runtimeDir, RECOMMENDATION_DECISIONS_FILE);
    if (!fs.existsSync(fullPath)) {
      return {};
    }
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as Record<string, unknown>;
    const out: Record<string, "approved" | "dismissed"> = {};
    for (const [id, decision] of Object.entries(parsed)) {
      if (decision === "approved" || decision === "dismissed") {
        out[id] = decision;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeRecommendationDecision(
  api: OpenClawPluginApi,
  id: string,
  decision: "approved" | "dismissed",
) {
  const runtimeDir = resolveTedUiRuntimeDir(api);
  fs.mkdirSync(runtimeDir, { recursive: true });
  const fullPath = path.join(runtimeDir, RECOMMENDATION_DECISIONS_FILE);
  const current = readRecommendationDecisions(api);
  current[id] = decision;
  fs.writeFileSync(fullPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
}

type RecommendationOutcomeEntry = {
  id: string;
  decision: "approved" | "dismissed";
  decided_at: string;
  linked_cards: string[];
  rationale: string;
};

type PolicyImpactEntry = {
  ts: string;
  policy_key: TedPolicyKey;
  risk_direction: "safer" | "riskier" | "neutral";
  changed_fields: string[];
  linked_cards: string[];
  rationale: string;
  expected_kpi_effects: string[];
};

function readRecommendationOutcomes(api: OpenClawPluginApi): RecommendationOutcomeEntry[] {
  try {
    const runtimeDir = resolveTedUiRuntimeDir(api);
    const fullPath = path.join(runtimeDir, RECOMMENDATION_OUTCOMES_FILE);
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => entry as Partial<RecommendationOutcomeEntry>)
      .filter(
        (entry) =>
          typeof entry.id === "string" &&
          (entry.decision === "approved" || entry.decision === "dismissed") &&
          typeof entry.decided_at === "string" &&
          Array.isArray(entry.linked_cards) &&
          entry.linked_cards.every((token) => typeof token === "string") &&
          typeof entry.rationale === "string",
      )
      .map((entry) => entry as RecommendationOutcomeEntry);
  } catch {
    return [];
  }
}

function appendRecommendationOutcome(api: OpenClawPluginApi, entry: RecommendationOutcomeEntry) {
  const runtimeDir = resolveTedUiRuntimeDir(api);
  fs.mkdirSync(runtimeDir, { recursive: true });
  const fullPath = path.join(runtimeDir, RECOMMENDATION_OUTCOMES_FILE);
  const outcomes = readRecommendationOutcomes(api);
  outcomes.push(entry);
  fs.writeFileSync(fullPath, `${JSON.stringify(outcomes.slice(-300), null, 2)}\n`, "utf8");
}

function readPolicyImpacts(api: OpenClawPluginApi): PolicyImpactEntry[] {
  try {
    const runtimeDir = resolveTedUiRuntimeDir(api);
    const fullPath = path.join(runtimeDir, POLICY_IMPACTS_FILE);
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => entry as Partial<PolicyImpactEntry>)
      .filter(
        (entry) =>
          typeof entry.ts === "string" &&
          (entry.policy_key === "job_board" ||
            entry.policy_key === "promotion_policy" ||
            entry.policy_key === "value_friction") &&
          (entry.risk_direction === "safer" ||
            entry.risk_direction === "riskier" ||
            entry.risk_direction === "neutral") &&
          Array.isArray(entry.changed_fields) &&
          entry.changed_fields.every((item) => typeof item === "string") &&
          Array.isArray(entry.linked_cards) &&
          entry.linked_cards.every((item) => typeof item === "string") &&
          typeof entry.rationale === "string" &&
          Array.isArray(entry.expected_kpi_effects) &&
          entry.expected_kpi_effects.every((item) => typeof item === "string"),
      )
      .map((entry) => entry as PolicyImpactEntry);
  } catch {
    return [];
  }
}

function appendPolicyImpact(api: OpenClawPluginApi, entry: PolicyImpactEntry) {
  const runtimeDir = resolveTedUiRuntimeDir(api);
  fs.mkdirSync(runtimeDir, { recursive: true });
  const fullPath = path.join(runtimeDir, POLICY_IMPACTS_FILE);
  const impacts = readPolicyImpacts(api);
  impacts.push(entry);
  fs.writeFileSync(fullPath, `${JSON.stringify(impacts.slice(-250), null, 2)}\n`, "utf8");
}

type GovernanceEvent = {
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
};

function readGovernanceEvents(api: OpenClawPluginApi): GovernanceEvent[] {
  try {
    const runtimeDir = resolveTedUiRuntimeDir(api);
    const fullPath = path.join(runtimeDir, GOVERNANCE_EVENTS_FILE);
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => entry as Partial<GovernanceEvent>)
      .filter(
        (entry) =>
          typeof entry.ts === "string" &&
          typeof entry.action === "string" &&
          typeof entry.outcome === "string" &&
          typeof entry.reason_code === "string" &&
          typeof entry.next_safe_step === "string",
      )
      .map((entry) => entry as GovernanceEvent);
  } catch {
    return [];
  }
}

function appendGovernanceEvent(api: OpenClawPluginApi, event: GovernanceEvent) {
  const runtimeDir = resolveTedUiRuntimeDir(api);
  fs.mkdirSync(runtimeDir, { recursive: true });
  const fullPath = path.join(runtimeDir, GOVERNANCE_EVENTS_FILE);
  const events = readGovernanceEvents(api);
  events.push(event);
  const compact = events.slice(-200);
  fs.writeFileSync(fullPath, `${JSON.stringify(compact, null, 2)}\n`, "utf8");
}

type KpiHistoryEntry = {
  ts: string;
  manual_minutes_per_day_max: number;
  approval_queue_oldest_minutes_max: number;
  unresolved_triage_eod_max: number;
  blocked_actions_missing_explainability_max: number;
};

function readKpiHistory(api: OpenClawPluginApi): KpiHistoryEntry[] {
  try {
    const runtimeDir = resolveTedUiRuntimeDir(api);
    const fullPath = path.join(runtimeDir, KPI_HISTORY_FILE);
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => entry as Partial<KpiHistoryEntry>)
      .filter(
        (entry) =>
          typeof entry.ts === "string" &&
          typeof entry.manual_minutes_per_day_max === "number" &&
          typeof entry.approval_queue_oldest_minutes_max === "number" &&
          typeof entry.unresolved_triage_eod_max === "number" &&
          typeof entry.blocked_actions_missing_explainability_max === "number",
      )
      .map((entry) => entry as KpiHistoryEntry);
  } catch {
    return [];
  }
}

function appendKpiHistory(api: OpenClawPluginApi, entry: KpiHistoryEntry) {
  const runtimeDir = resolveTedUiRuntimeDir(api);
  fs.mkdirSync(runtimeDir, { recursive: true });
  const fullPath = path.join(runtimeDir, KPI_HISTORY_FILE);
  const history = readKpiHistory(api);
  const last = history[history.length - 1];
  const changed =
    !last ||
    last.manual_minutes_per_day_max !== entry.manual_minutes_per_day_max ||
    last.approval_queue_oldest_minutes_max !== entry.approval_queue_oldest_minutes_max ||
    last.unresolved_triage_eod_max !== entry.unresolved_triage_eod_max ||
    last.blocked_actions_missing_explainability_max !==
      entry.blocked_actions_missing_explainability_max;
  if (changed) {
    history.push(entry);
  }
  fs.writeFileSync(fullPath, `${JSON.stringify(history.slice(-120), null, 2)}\n`, "utf8");
}

type EvalHistoryEntry = {
  ts: string;
  proof_script: string;
  ok: boolean;
  exit_code: number;
};

function readEvalHistory(api: OpenClawPluginApi): EvalHistoryEntry[] {
  try {
    const runtimeDir = resolveTedUiRuntimeDir(api);
    const fullPath = path.join(runtimeDir, EVAL_HISTORY_FILE);
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => entry as Partial<EvalHistoryEntry>)
      .filter(
        (entry) =>
          typeof entry.ts === "string" &&
          typeof entry.proof_script === "string" &&
          typeof entry.ok === "boolean" &&
          typeof entry.exit_code === "number",
      )
      .map((entry) => entry as EvalHistoryEntry);
  } catch {
    return [];
  }
}

function appendEvalHistory(api: OpenClawPluginApi, entry: EvalHistoryEntry) {
  const runtimeDir = resolveTedUiRuntimeDir(api);
  fs.mkdirSync(runtimeDir, { recursive: true });
  const fullPath = path.join(runtimeDir, EVAL_HISTORY_FILE);
  const history = readEvalHistory(api);
  history.push(entry);
  fs.writeFileSync(fullPath, `${JSON.stringify(history.slice(-120), null, 2)}\n`, "utf8");
}

type FrictionKpis = {
  manual_minutes_per_day_max: number;
  approval_queue_oldest_minutes_max: number;
  unresolved_triage_eod_max: number;
  blocked_actions_missing_explainability_max: number;
};

type GateOverridesStore = {
  overrides: {
    manual_minutes_per_day_max: number | null;
    approval_queue_oldest_minutes_max: number | null;
    unresolved_triage_eod_max: number | null;
    blocked_actions_missing_explainability_max: number | null;
  };
  updated_at: string | null;
};

function defaultGateOverridesStore(): GateOverridesStore {
  return {
    overrides: {
      manual_minutes_per_day_max: null,
      approval_queue_oldest_minutes_max: null,
      unresolved_triage_eod_max: null,
      blocked_actions_missing_explainability_max: null,
    },
    updated_at: null,
  };
}

function readGateOverrides(api: OpenClawPluginApi): GateOverridesStore {
  try {
    const runtimeDir = resolveTedUiRuntimeDir(api);
    const fullPath = path.join(runtimeDir, GATE_OVERRIDES_FILE);
    if (!fs.existsSync(fullPath)) {
      return defaultGateOverridesStore();
    }
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as Partial<GateOverridesStore>;
    const defaults = defaultGateOverridesStore();
    const out: GateOverridesStore = {
      overrides: {
        manual_minutes_per_day_max:
          typeof parsed?.overrides?.manual_minutes_per_day_max === "number"
            ? parsed.overrides.manual_minutes_per_day_max
            : defaults.overrides.manual_minutes_per_day_max,
        approval_queue_oldest_minutes_max:
          typeof parsed?.overrides?.approval_queue_oldest_minutes_max === "number"
            ? parsed.overrides.approval_queue_oldest_minutes_max
            : defaults.overrides.approval_queue_oldest_minutes_max,
        unresolved_triage_eod_max:
          typeof parsed?.overrides?.unresolved_triage_eod_max === "number"
            ? parsed.overrides.unresolved_triage_eod_max
            : defaults.overrides.unresolved_triage_eod_max,
        blocked_actions_missing_explainability_max:
          typeof parsed?.overrides?.blocked_actions_missing_explainability_max === "number"
            ? parsed.overrides.blocked_actions_missing_explainability_max
            : defaults.overrides.blocked_actions_missing_explainability_max,
      },
      updated_at: typeof parsed?.updated_at === "string" ? parsed.updated_at : null,
    };
    return out;
  } catch {
    return defaultGateOverridesStore();
  }
}

function writeGateOverrides(api: OpenClawPluginApi, store: GateOverridesStore) {
  const runtimeDir = resolveTedUiRuntimeDir(api);
  fs.mkdirSync(runtimeDir, { recursive: true });
  const fullPath = path.join(runtimeDir, GATE_OVERRIDES_FILE);
  fs.writeFileSync(fullPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function resolveEffectiveFrictionKpis(api: OpenClawPluginApi) {
  const defaults: FrictionKpis = { ...DEFAULT_FRICTION_KPIS };
  const store = readGateOverrides(api);
  const effective: FrictionKpis = {
    manual_minutes_per_day_max:
      store.overrides.manual_minutes_per_day_max ?? defaults.manual_minutes_per_day_max,
    approval_queue_oldest_minutes_max:
      store.overrides.approval_queue_oldest_minutes_max ??
      defaults.approval_queue_oldest_minutes_max,
    unresolved_triage_eod_max:
      store.overrides.unresolved_triage_eod_max ?? defaults.unresolved_triage_eod_max,
    blocked_actions_missing_explainability_max:
      store.overrides.blocked_actions_missing_explainability_max ??
      defaults.blocked_actions_missing_explainability_max,
  };
  const warnings: string[] = [];
  if (effective.manual_minutes_per_day_max > defaults.manual_minutes_per_day_max) {
    warnings.push("Manual handling threshold relaxed above default.");
  }
  if (effective.approval_queue_oldest_minutes_max > defaults.approval_queue_oldest_minutes_max) {
    warnings.push("Approval queue age threshold relaxed above default.");
  }
  if (effective.unresolved_triage_eod_max > defaults.unresolved_triage_eod_max) {
    warnings.push("Unresolved triage threshold relaxed above default.");
  }
  if (
    effective.blocked_actions_missing_explainability_max >
    defaults.blocked_actions_missing_explainability_max
  ) {
    warnings.push("Blocked-without-explainability threshold relaxed above default.");
  }
  return {
    defaults,
    effective,
    overrides: store.overrides,
    relaxed: warnings.length > 0,
    warnings,
    updated_at: store.updated_at,
  };
}

async function runProofScript(
  api: OpenClawPluginApi,
  relativePath: string,
): Promise<{ ok: boolean; exit_code: number; stdout: string; stderr: string }> {
  const trimmed = relativePath.trim();
  if (!PROOF_SCRIPT_PATH_RE.test(trimmed)) {
    throw new Error("proof script path is not allowlisted");
  }
  const fullPath = api.resolvePath(trimmed);
  if (!fs.existsSync(fullPath)) {
    throw new Error("proof script not found");
  }
  await fs.promises.access(fullPath, fs.constants.X_OK);

  const child = spawn("bash", [fullPath], {
    cwd: api.resolvePath("."),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
    if (stdout.length > 32_000) {
      stdout = stdout.slice(-32_000);
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
    if (stderr.length > 32_000) {
      stderr = stderr.slice(-32_000);
    }
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  return {
    ok: exitCode === 0,
    exit_code: exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function normalizeBaseUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid ted-sidecar baseUrl");
  }

  if (!isLoopbackHost(parsed.hostname)) {
    throw new Error("ted-sidecar baseUrl must be loopback-only");
  }

  if (parsed.username || parsed.password) {
    throw new Error("ted-sidecar baseUrl must not include credentials");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("ted-sidecar baseUrl must use http or https");
  }

  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

function resolveBaseUrl(pluginConfig: TedSidecarPluginConfig | undefined): URL {
  const fromPlugin = typeof pluginConfig?.baseUrl === "string" ? pluginConfig.baseUrl.trim() : "";
  const fromEnv = process.env.TED_SIDECAR_BASE_URL?.trim() || "";
  const selected = fromPlugin || fromEnv || DEFAULT_BASE_URL;
  return normalizeBaseUrl(selected);
}

function resolveTimeoutMs(pluginConfig: TedSidecarPluginConfig | undefined): number {
  const raw = pluginConfig?.timeoutMs;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return DEFAULT_TIMEOUT_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePathFromAction(action: string): string {
  const normalized = action.trim().toLowerCase();
  if (normalized === "doctor" || normalized === "") {
    return "/doctor";
  }
  if (normalized === "status") {
    return "/status";
  }
  if (normalized === "catalog") {
    return "/status";
  }
  throw new Error("Usage: /ted doctor | /ted status | /ted catalog");
}

function buildSafeEndpoint(baseUrl: URL, targetPath: string): URL {
  if (!ALLOWED_PATHS.has(targetPath)) {
    throw new Error(`Path blocked by allowlist: ${targetPath}`);
  }
  const endpoint = new URL(targetPath, baseUrl);
  if (!isLoopbackHost(endpoint.hostname)) {
    throw new Error("Resolved endpoint is not loopback");
  }
  if (!ALLOWED_PATHS.has(endpoint.pathname)) {
    throw new Error(`Path blocked by allowlist: ${endpoint.pathname}`);
  }
  return endpoint;
}

function formatPayload(action: string, payload: TedHealthPayload): string {
  const title = action === "status" ? "Ted sidecar status" : "Ted sidecar doctor";
  const lines = [
    `${title}:`,
    `- version: ${payload.version}`,
    `- uptime: ${payload.uptime}`,
    `- profiles_count: ${payload.profiles_count}`,
  ];
  if (payload.catalog) {
    lines.push("- discoverability: available via /ted catalog");
  }
  return lines.join("\n");
}

function isCatalogPayload(value: unknown): value is TedCatalogPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<TedCatalogPayload>;
  return (
    typeof candidate.discoverability_version === "string" &&
    Array.isArray(candidate.commands) &&
    candidate.commands.every((item) => typeof item === "string") &&
    Array.isArray(candidate.route_families) &&
    candidate.route_families.every((item) => typeof item === "string") &&
    Array.isArray(candidate.governance_guards) &&
    candidate.governance_guards.every((item) => typeof item === "string") &&
    typeof candidate.non_health_auth_required === "boolean"
  );
}

function formatCatalog(payload: TedHealthPayload): string {
  if (!payload.catalog) {
    return "Ted catalog unavailable on this sidecar build.";
  }
  const catalog = payload.catalog;
  const lines = [
    "Ted sidecar catalog:",
    `- version: ${payload.version}`,
    `- discoverability_version: ${catalog.discoverability_version}`,
    `- commands: ${catalog.commands.join(", ")}`,
    `- route_families: ${catalog.route_families.join(", ")}`,
    `- governance_guards: ${catalog.governance_guards.join(", ")}`,
    `- non_health_auth_required: ${String(catalog.non_health_auth_required)}`,
  ];
  return lines.join("\n");
}

function parseJobCardStatus(
  contents: string,
): "DONE" | "BLOCKED" | "IN_PROGRESS" | "TODO_OR_UNKNOWN" {
  const match = contents.match(/- Current:\s*([A-Z_]+)/);
  const current = match?.[1]?.trim().toUpperCase() ?? "";
  if (current === "DONE") {
    return "DONE";
  }
  if (current === "BLOCKED") {
    return "BLOCKED";
  }
  if (current === "IN_PROGRESS") {
    return "IN_PROGRESS";
  }
  return "TODO_OR_UNKNOWN";
}

function parseJobCardMetadata(fileName: string, contents: string) {
  const id = contents.match(/^#\s*(JC-\d+)/m)?.[1] ?? fileName.replace(/\.md$/i, "");
  const title = contents.match(/^#\s*JC-\d+\s+[—-]\s+(.+)$/m)?.[1]?.trim() ?? fileName;
  const status = parseJobCardStatus(contents);
  const dependencies = Array.from(
    new Set((contents.match(/JC-\d+/g) ?? []).filter((token) => token !== id)),
  ).toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const proofScript = contents.match(/-\s*`(scripts\/ted-profile\/proof_[^`]+)`/m)?.[1] ?? null;
  const outcomeText = extractSection(contents, "Outcome")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  const operatorSummary =
    outcomeText.length > 0
      ? outcomeText.slice(0, 180)
      : "No plain-language outcome is defined yet for this card.";
  const kpiSignals = extractBullets(extractSection(contents, "Friction KPI Evidence"));
  const family = inferJobCardFamily(title, contents);

  return {
    id,
    title,
    family,
    operatorSummary,
    kpiSignals,
    status,
    dependencies,
    proofScript,
  };
}

function countCardsMissingKpis(cards: JobCardRecord[]): number {
  return cards.filter((card) => card.kpi_signals.length === 0).length;
}

function recommendationLinksFor(
  recommendationId: string,
  cards: Array<{
    id: string;
    status: "DONE" | "BLOCKED" | "IN_PROGRESS" | "TODO_OR_UNKNOWN";
    kpi_signals: string[];
  }>,
): { linkedCards: string[]; rationale: string } {
  if (recommendationId === "blocked-job-cards") {
    return {
      linkedCards: cards.filter((card) => card.status === "BLOCKED").map((card) => card.id),
      rationale: "Linked to blocked work items.",
    };
  }
  if (recommendationId === "missing-kpi-signals") {
    return {
      linkedCards: cards.filter((card) => card.kpi_signals.length === 0).map((card) => card.id),
      rationale: "Linked to work items missing KPI signals.",
    };
  }
  if (recommendationId === "steady-state") {
    return {
      linkedCards: cards
        .filter((card) => card.status === "DONE" || card.status === "IN_PROGRESS")
        .map((card) => card.id),
      rationale: "Linked to active and completed work items in steady state.",
    };
  }
  return {
    linkedCards: [],
    rationale: "No direct card linkage for this recommendation.",
  };
}

function promotionBandForScore(score: number): "hold" | "watch" | "progressing" | "ready" {
  if (score >= 80) {
    return "ready";
  }
  if (score >= 60) {
    return "progressing";
  }
  if (score >= 40) {
    return "watch";
  }
  return "hold";
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computePromotionConfidence(
  cards: JobCardRecord[],
  evalHistory: EvalHistoryEntry[],
  recommendationOutcomes: RecommendationOutcomeEntry[],
  policyImpacts: PolicyImpactEntry[],
) {
  const byCard = new Map<string, { approved: number; dismissed: number }>();
  for (const outcome of recommendationOutcomes) {
    for (const cardId of outcome.linked_cards) {
      const current = byCard.get(cardId) ?? { approved: 0, dismissed: 0 };
      if (outcome.decision === "approved") {
        current.approved += 1;
      } else {
        current.dismissed += 1;
      }
      byCard.set(cardId, current);
    }
  }

  const statusById = new Map(cards.map((card) => [card.id, card.status]));
  const latestEvalByScript = new Map<string, EvalHistoryEntry>();
  for (const entry of evalHistory) {
    latestEvalByScript.set(entry.proof_script, entry);
  }

  const confidenceByCard = new Map<
    string,
    {
      score: number;
      band: "hold" | "watch" | "progressing" | "ready";
      drivers: string[];
      recommendation_outcomes: { approved: number; dismissed: number };
    }
  >();

  for (const card of cards) {
    let score = 50;
    const drivers: string[] = [];

    if (card.status === "DONE") {
      score += 20;
      drivers.push("Completed status increases promotion confidence.");
    } else if (card.status === "IN_PROGRESS") {
      score += 5;
      drivers.push("In-progress status indicates active execution.");
    } else if (card.status === "BLOCKED") {
      score -= 20;
      drivers.push("Blocked status reduces confidence until remediation.");
    } else {
      score -= 8;
      drivers.push("Not-started status keeps confidence conservative.");
    }

    const kpiBoost = Math.min(12, card.kpi_signals.length * 3);
    score += kpiBoost;
    if (card.kpi_signals.length > 0) {
      drivers.push(`KPI coverage contributes +${kpiBoost} confidence points.`);
    } else {
      drivers.push("Missing KPI signals reduces measurable learning confidence.");
    }

    const unresolvedDeps = card.dependencies.filter((dep) => statusById.get(dep) !== "DONE").length;
    if (unresolvedDeps > 0) {
      const depPenalty = Math.min(16, unresolvedDeps * 4);
      score -= depPenalty;
      drivers.push(`${unresolvedDeps} unresolved dependencies lower confidence.`);
    } else if (card.dependencies.length > 0) {
      drivers.push("Dependencies resolved; readiness risk reduced.");
    }

    if (card.proof_script) {
      const latestProof = latestEvalByScript.get(card.proof_script);
      if (latestProof) {
        if (latestProof.ok) {
          score += 12;
          drivers.push("Latest proof check passed.");
        } else {
          score -= 10;
          drivers.push("Latest proof check failed.");
        }
      } else {
        score -= 4;
        drivers.push("Proof script linked but no execution evidence yet.");
      }
    } else {
      score -= 3;
      drivers.push("No proof script linked for this card.");
    }

    const outcomeCounts = byCard.get(card.id) ?? { approved: 0, dismissed: 0 };
    const outcomeDelta =
      Math.min(12, outcomeCounts.approved * 3) - Math.min(8, outcomeCounts.dismissed * 2);
    score += outcomeDelta;
    if (outcomeCounts.approved > 0 || outcomeCounts.dismissed > 0) {
      drivers.push(
        `Recommendation outcomes: ${outcomeCounts.approved} approved, ${outcomeCounts.dismissed} dismissed.`,
      );
    }

    const cardPolicyImpacts = policyImpacts
      .filter((impact) => impact.linked_cards.includes(card.id))
      .slice(-6);
    if (cardPolicyImpacts.length > 0) {
      let policyDelta = 0;
      for (const impact of cardPolicyImpacts) {
        if (impact.risk_direction === "riskier") {
          policyDelta -= 2;
        } else if (impact.risk_direction === "safer") {
          policyDelta += 1;
        }
      }
      score += policyDelta;
      drivers.push(
        `Recent policy impacts (${cardPolicyImpacts.length}) contribute ${policyDelta >= 0 ? "+" : ""}${policyDelta} points.`,
      );
    }

    const finalScore = clampScore(score);
    confidenceByCard.set(card.id, {
      score: finalScore,
      band: promotionBandForScore(finalScore),
      drivers: drivers.slice(0, 4),
      recommendation_outcomes: outcomeCounts,
    });
  }
  return confidenceByCard;
}

function inferJobCardFamily(
  title: string,
  contents: string,
): "GOV" | "MNT" | "ING" | "LED" | "OUT" {
  const haystack = `${title}\n${contents}`.toLowerCase();
  if (
    haystack.includes("governance") ||
    haystack.includes("approval") ||
    haystack.includes("policy") ||
    haystack.includes("security") ||
    haystack.includes("auth")
  ) {
    return "GOV";
  }
  if (
    haystack.includes("graph") ||
    haystack.includes("connector") ||
    haystack.includes("ingest") ||
    haystack.includes("profile manager")
  ) {
    return "ING";
  }
  if (
    haystack.includes("deal") ||
    haystack.includes("ledger") ||
    haystack.includes("triage") ||
    haystack.includes("filing") ||
    haystack.includes("job card")
  ) {
    return "LED";
  }
  if (
    haystack.includes("draft") ||
    haystack.includes("message") ||
    haystack.includes("email") ||
    haystack.includes("communication")
  ) {
    return "OUT";
  }
  return "MNT";
}

function suggestedKpisForFamily(family: "GOV" | "MNT" | "ING" | "LED" | "OUT"): string[] {
  if (family === "GOV") {
    return [
      "blocked actions without explainability",
      "policy violations prevented",
      "approval turnaround time",
      "cross-entity block accuracy",
    ];
  }
  if (family === "MNT") {
    return [
      "manual handling minutes/day",
      "approval queue oldest age",
      "sidecar uptime",
      "mean time to recovery",
    ];
  }
  if (family === "ING") {
    return [
      "connector success rate",
      "ingestion lag",
      "classification accuracy",
      "retry/backoff rate",
    ];
  }
  if (family === "LED") {
    return [
      "linked artifacts rate",
      "triage queue size at end of day",
      "deal state transition latency",
      "evidence citation completeness",
    ];
  }
  return [
    "draft acceptance rate",
    "operator edit rate",
    "response turnaround time",
    "sensitive draft escalation rate",
  ];
}

function resolveRepoRelativePath(api: OpenClawPluginApi, relativePath: string): string | null {
  const candidates = new Set<string>();
  candidates.add(api.resolvePath(relativePath));
  candidates.add(path.resolve(process.cwd(), relativePath));
  candidates.add(path.resolve(path.dirname(api.source), relativePath));
  for (const root of ancestorPaths(path.dirname(api.source), 10)) {
    candidates.add(path.resolve(root, relativePath));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function policyHeading(key: TedPolicyKey): string {
  if (key === "job_board") {
    return "Job Board Policy";
  }
  if (key === "promotion_policy") {
    return "Promotion Policy";
  }
  return "Value and Friction Gates";
}

function policyConfigDefaults(key: TedPolicyKey): TedPolicyConfig {
  return {
    objective:
      key === "job_board"
        ? "Sequence work in dependency order with clear promotion gates."
        : key === "promotion_policy"
          ? "Unlock features only after proof and quality gates are met."
          : "Balance operator speed with safe governance thresholds.",
    rollout_mode: "balanced",
    automation_ceiling: "approval-first",
    success_checks: [],
    guardrails: [],
    operator_notes: "",
  };
}

function parsePolicyConfigFromMarkdown(key: TedPolicyKey, markdown: string): TedPolicyConfig {
  const defaults = policyConfigDefaults(key);
  const block = extractSection(markdown, "Operator Configuration");
  if (!block) {
    return defaults;
  }
  const config = { ...defaults };
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let currentList: "success_checks" | "guardrails" | null = null;
  for (const line of lines) {
    if (line.startsWith("- Objective:")) {
      config.objective = line.replace("- Objective:", "").trim() || defaults.objective;
      currentList = null;
      continue;
    }
    if (line.startsWith("- Rollout mode:")) {
      const mode = line.replace("- Rollout mode:", "").trim().toLowerCase();
      if (mode === "conservative" || mode === "balanced" || mode === "aggressive") {
        config.rollout_mode = mode;
      }
      currentList = null;
      continue;
    }
    if (line.startsWith("- Automation ceiling:")) {
      const ceiling = line.replace("- Automation ceiling:", "").trim().toLowerCase();
      if (ceiling === "draft-only" || ceiling === "approval-first" || ceiling === "limited-auto") {
        config.automation_ceiling = ceiling;
      }
      currentList = null;
      continue;
    }
    if (line.startsWith("- Operator notes:")) {
      config.operator_notes = line.replace("- Operator notes:", "").trim();
      currentList = null;
      continue;
    }
    if (line === "- Success checks:") {
      currentList = "success_checks";
      continue;
    }
    if (line === "- Guardrails:") {
      currentList = "guardrails";
      continue;
    }
    if (line.startsWith("  - ") && currentList) {
      config[currentList].push(line.replace("  - ", "").trim());
    }
  }
  return config;
}

function renderPolicyConfigSection(config: TedPolicyConfig): string {
  const successChecks =
    config.success_checks.length > 0
      ? config.success_checks.map((item) => `  - ${item}`).join("\n")
      : "  - (none)";
  const guardrails =
    config.guardrails.length > 0
      ? config.guardrails.map((item) => `  - ${item}`).join("\n")
      : "  - (none)";
  return `## Operator Configuration

- Objective: ${config.objective}
- Rollout mode: ${config.rollout_mode}
- Automation ceiling: ${config.automation_ceiling}
- Success checks:
${successChecks}
- Guardrails:
${guardrails}
- Operator notes: ${config.operator_notes}
`;
}

function upsertPolicyConfigSection(markdown: string, config: TedPolicyConfig): string {
  const section = renderPolicyConfigSection(config);
  const re = /^##\s+Operator Configuration\s*$[\s\S]*?(?=^##\s+|\Z)/m;
  if (re.test(markdown)) {
    return markdown.replace(re, section).trimEnd() + "\n";
  }
  return `${markdown.trimEnd()}\n\n${section}\n`;
}

function policyLinkedFamilies(key: TedPolicyKey): Array<"GOV" | "MNT" | "ING" | "LED" | "OUT"> {
  if (key === "job_board") {
    return ["LED", "MNT", "GOV"];
  }
  if (key === "promotion_policy") {
    return ["GOV", "MNT", "OUT"];
  }
  return ["GOV", "MNT", "ING", "LED", "OUT"];
}

function expectedKpiEffectsForPolicy(key: TedPolicyKey): string[] {
  if (key === "job_board") {
    return [
      "unresolved triage at end of day",
      "manual handling minutes/day",
      "linked artifacts rate",
    ];
  }
  if (key === "promotion_policy") {
    return ["approval queue oldest age", "blocked items without explainability", "proof pass rate"];
  }
  return [
    "manual handling minutes/day",
    "approval queue oldest age",
    "unresolved triage at end of day",
    "blocked items without explainability",
  ];
}

function comparePolicyConfigs(
  key: TedPolicyKey,
  before: TedPolicyConfig,
  after: TedPolicyConfig,
  cards: JobCardRecord[],
): PolicyImpactEntry {
  const changedFields: string[] = [];
  let riskScore = 0;

  if (before.objective.trim() !== after.objective.trim()) {
    changedFields.push("objective");
  }
  if (before.operator_notes.trim() !== after.operator_notes.trim()) {
    changedFields.push("operator_notes");
  }

  if (before.rollout_mode !== after.rollout_mode) {
    changedFields.push("rollout_mode");
    const rolloutRank = { conservative: 0, balanced: 1, aggressive: 2 } as const;
    riskScore += rolloutRank[after.rollout_mode] - rolloutRank[before.rollout_mode];
  }

  if (before.automation_ceiling !== after.automation_ceiling) {
    changedFields.push("automation_ceiling");
    const ceilingRank = { "draft-only": 0, "approval-first": 1, "limited-auto": 2 } as const;
    riskScore += ceilingRank[after.automation_ceiling] - ceilingRank[before.automation_ceiling];
  }

  if (before.success_checks.join("|") !== after.success_checks.join("|")) {
    changedFields.push("success_checks");
    riskScore += before.success_checks.length - after.success_checks.length > 0 ? 1 : -1;
  }
  if (before.guardrails.join("|") !== after.guardrails.join("|")) {
    changedFields.push("guardrails");
    riskScore += before.guardrails.length - after.guardrails.length > 0 ? 1 : -1;
  }

  const riskDirection: PolicyImpactEntry["risk_direction"] =
    riskScore > 0 ? "riskier" : riskScore < 0 ? "safer" : "neutral";

  const linkedFamilies = new Set(policyLinkedFamilies(key));
  const linkedCards = cards
    .filter((card) => linkedFamilies.has(card.family))
    .map((card) => card.id)
    .slice(0, 40);

  const rationale =
    changedFields.length > 0
      ? `Policy change detected in ${changedFields.join(", ")}.`
      : "Policy save with no effective configuration delta.";

  return {
    ts: new Date().toISOString(),
    policy_key: key,
    risk_direction: riskDirection,
    changed_fields: changedFields,
    linked_cards: linkedCards,
    rationale,
    expected_kpi_effects: expectedKpiEffectsForPolicy(key),
  };
}

function listJobCardRecords(api: OpenClawPluginApi): {
  dir: string | null;
  cards: JobCardRecord[];
} {
  const jobCardsDir = resolveJobCardsDir(api);
  if (!jobCardsDir) {
    return { dir: null, cards: [] };
  }
  const files = fs.readdirSync(jobCardsDir).filter((name) => /^JC-\d+.*\.md$/i.test(name));
  const cards: JobCardRecord[] = [];
  for (const fileName of files) {
    try {
      const fullPath = path.join(jobCardsDir, fileName);
      const contents = fs.readFileSync(fullPath, "utf8");
      const metadata = parseJobCardMetadata(fileName, contents);
      cards.push({
        id: metadata.id,
        title: metadata.title,
        family: metadata.family,
        operator_summary: metadata.operatorSummary,
        kpi_signals: metadata.kpiSignals,
        path: path.join("docs/ted-profile/job-cards", fileName),
        status: metadata.status,
        dependencies: metadata.dependencies,
        proof_script: metadata.proofScript,
        fullPath,
        contents,
      });
    } catch {
      // Ignore unreadable files; board remains fail-safe.
    }
  }
  cards.sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
  return { dir: jobCardsDir, cards };
}

function extractSection(contents: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, "m");
  const match = contents.match(re);
  return match?.[1]?.trim() ?? "";
}

function extractBullets(sectionBody: string): string[] {
  return sectionBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim());
}

function buildWorkbenchPayload(
  api: OpenClawPluginApi,
  probe: { ok: boolean; status?: TedHealthPayload; doctor?: TedHealthPayload; error?: string },
  integrations: TedWorkbenchPayload["integrations"],
): TedWorkbenchPayload {
  const records = listJobCardRecords(api);
  const jobCardsDir = records.dir;
  const jobCardFiles = records.cards.map((card) => path.basename(card.fullPath));

  let done = 0;
  let blocked = 0;
  let inProgress = 0;
  let todoOrUnknown = 0;
  const cards: TedWorkbenchPayload["job_cards"]["cards"] = [];

  for (const card of records.cards) {
    cards.push({
      id: card.id,
      title: card.title,
      family: card.family,
      operator_summary: card.operator_summary,
      kpi_signals: card.kpi_signals,
      path: card.path,
      status: card.status,
      dependencies: card.dependencies,
      proof_script: card.proof_script,
      promotion_confidence: {
        score: 0,
        band: "hold",
        drivers: ["Confidence pending calculation."],
        recommendation_outcomes: { approved: 0, dismissed: 0 },
      },
    });
    const status = card.status;
    if (status === "DONE") {
      done += 1;
    } else if (status === "BLOCKED") {
      blocked += 1;
    } else if (status === "IN_PROGRESS") {
      inProgress += 1;
    } else {
      todoOrUnknown += 1;
    }
  }
  const recommendationDecisions = readRecommendationDecisions(api);
  const recommendationOutcomes = readRecommendationOutcomes(api);
  const policyImpacts = readPolicyImpacts(api);
  const thresholdControls = resolveEffectiveFrictionKpis(api);

  const recommendations: TedWorkbenchPayload["recommendations"] = [];
  if (!probe.ok) {
    recommendations.push({
      id: "ted-sidecar-unhealthy",
      severity: "critical",
      message: "Ted sidecar is unhealthy; operational dashboards may be stale.",
      next_step: "Run /ted doctor, then restart ted-engine-sidecar.service if needed.",
      decision: recommendationDecisions["ted-sidecar-unhealthy"] ?? "pending",
    });
  }
  if (blocked > 0) {
    recommendations.push({
      id: "blocked-job-cards",
      severity: "warn",
      message: `${blocked} job card(s) are blocked and need remediation sequencing.`,
      next_step: "Prioritize blocked cards before promoting new slices.",
      decision: recommendationDecisions["blocked-job-cards"] ?? "pending",
    });
  }
  const missingKpiCards = countCardsMissingKpis(records.cards);
  if (missingKpiCards > 0) {
    recommendations.push({
      id: "missing-kpi-signals",
      severity: "warn",
      message: `${missingKpiCards} job card(s) have no KPI signals and cannot learn effectively.`,
      next_step: "Add Friction KPI Evidence to each affected card before promotion.",
      decision: recommendationDecisions["missing-kpi-signals"] ?? "pending",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "steady-state",
      severity: "info",
      message: "No immediate blockers detected in the current workbench snapshot.",
      next_step: "Continue next dependency-ordered slice and run proof gates.",
      decision: recommendationDecisions["steady-state"] ?? "pending",
    });
  }
  if (!jobCardsDir) {
    recommendations.push({
      id: "job-cards-not-found",
      severity: "warn",
      message:
        "Job card directory not discovered from current runtime root; job board metrics may be incomplete.",
      next_step:
        "Run gateway from repo root or set TED_JOB_CARDS_DIR to docs/ted-profile/job-cards.",
      decision: recommendationDecisions["job-cards-not-found"] ?? "pending",
    });
  }

  appendKpiHistory(api, {
    ts: new Date().toISOString(),
    manual_minutes_per_day_max: thresholdControls.effective.manual_minutes_per_day_max,
    approval_queue_oldest_minutes_max:
      thresholdControls.effective.approval_queue_oldest_minutes_max,
    unresolved_triage_eod_max: thresholdControls.effective.unresolved_triage_eod_max,
    blocked_actions_missing_explainability_max:
      thresholdControls.effective.blocked_actions_missing_explainability_max,
  });

  const evalHistory = readEvalHistory(api);
  const confidenceByCard = computePromotionConfidence(
    records.cards,
    evalHistory,
    recommendationOutcomes,
    policyImpacts,
  );

  const approvalQueue: TedWorkbenchPayload["approval_queue"] = [];
  for (const recommendation of recommendations) {
    if (recommendation.decision === "pending") {
      approvalQueue.push({
        id: recommendation.id,
        source: "recommendation",
        severity: recommendation.severity,
        reason_code:
          recommendation.severity === "critical"
            ? "CRITICAL_REMEDIATION_REQUIRED"
            : "OPERATOR_DECISION_REQUIRED",
        summary: recommendation.message,
        next_safe_step: recommendation.next_step,
        status: recommendation.decision,
      });
    }
  }
  for (const card of cards.filter((entry) => entry.status === "BLOCKED")) {
    approvalQueue.push({
      id: `${card.id.toLowerCase()}-unblock`,
      source: "job_card",
      severity: "warn",
      reason_code: "JOB_CARD_BLOCKED",
      summary: `${card.id} is blocked and requires remediation sequencing.`,
      next_safe_step: "Review card details, clear blocker, and re-run proof before promotion.",
      status: "pending",
    });
  }

  for (const card of cards) {
    const confidence = confidenceByCard.get(card.id) ?? {
      score: 0,
      band: "hold" as const,
      drivers: ["Confidence unavailable."],
      recommendation_outcomes: { approved: 0, dismissed: 0 },
    };
    card.promotion_confidence = confidence;
  }

  const outcomesTotals = {
    approved: recommendationOutcomes.filter((entry) => entry.decision === "approved").length,
    dismissed: recommendationOutcomes.filter((entry) => entry.decision === "dismissed").length,
    pending: recommendations.filter((entry) => entry.decision === "pending").length,
  };

  return {
    generated_at: new Date().toISOString(),
    data_sources: {
      job_cards_dir: jobCardsDir,
      job_cards_discovered: Boolean(jobCardsDir),
    },
    operator_flow: {
      primary_approval_surface: "ted_workbench",
      secondary_approval_surface: "openclaw_chat",
      draft_review_surface: "ted_run_today_and_openclaw_chat",
      notes: [
        "Approvals are actioned in Ted Workbench (Pending Decisions + Recommendation actions).",
        "Chat remains available for commands and fallback review during outages.",
        "Draft-first behavior is enforced; external send/invite remains manual unless explicitly promoted.",
      ],
    },
    integrations,
    sidecar: {
      healthy: probe.ok,
      status: probe.status ?? null,
      doctor: probe.doctor ?? null,
      error: probe.error ?? null,
    },
    job_cards: {
      total: jobCardFiles.length,
      done,
      blocked,
      in_progress: inProgress,
      todo_or_unknown: todoOrUnknown,
      cards,
    },
    friction_kpis: {
      ...thresholdControls.effective,
    },
    threshold_controls: thresholdControls,
    policy_impacts: {
      totals_by_policy: {
        job_board: policyImpacts.filter((entry) => entry.policy_key === "job_board").length,
        promotion_policy: policyImpacts.filter((entry) => entry.policy_key === "promotion_policy")
          .length,
        value_friction: policyImpacts.filter((entry) => entry.policy_key === "value_friction")
          .length,
      },
      recent: policyImpacts.slice(-20).toReversed(),
    },
    recommendations,
    recommendation_outcomes: {
      totals: outcomesTotals,
      recent: recommendationOutcomes.slice(-20).toReversed(),
    },
    approval_queue: approvalQueue,
    approval_ledger: {
      recent: buildApprovalLedger(cards, recommendations, recommendationOutcomes).slice(0, 40),
    },
    governance_timeline_preview: readGovernanceEvents(api).slice(-12).reverse(),
    kpi_history_preview: readKpiHistory(api).slice(-24),
    eval_history_preview: evalHistory.slice(-24).reverse(),
    references: {
      job_board: "docs/ted-profile/sdd-pack/10_ROADMAP_JOB_BOARD.md",
      promotion_policy: "docs/ted-profile/sdd-pack/14_DAY1_PROMOTION_POLICY.md",
      value_friction: "docs/ted-profile/sdd-pack/15_VALUE_AND_FRICTION_GATES.md",
      interrogation_cycle: "docs/ted-profile/sdd-pack/17_COUNCIL_INTERROGATION_CYCLE_001.md",
    },
  };
}

function buildApprovalLedger(
  cards: TedWorkbenchPayload["job_cards"]["cards"],
  recommendations: TedWorkbenchPayload["recommendations"],
  recommendationOutcomes: RecommendationOutcomeEntry[],
): TedWorkbenchPayload["approval_ledger"]["recent"] {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const recommendationById = new Map(recommendations.map((rec) => [rec.id, rec]));
  const records: TedWorkbenchPayload["approval_ledger"]["recent"] = [];

  const toConfidence = (cardId: string) => {
    const card = cardById.get(cardId);
    if (!card) {
      return null;
    }
    return {
      card_id: card.id,
      score: card.promotion_confidence.score,
      band: card.promotion_confidence.band,
      top_driver: card.promotion_confidence.drivers[0] ?? "No confidence driver available.",
    };
  };

  for (const outcome of recommendationOutcomes.slice().reverse()) {
    const recommendation = recommendationById.get(outcome.id);
    const linkedCards =
      outcome.linked_cards.length > 0
        ? outcome.linked_cards
        : recommendationLinksFor(outcome.id, cards).linkedCards;
    const linkedConfidence = linkedCards
      .map((cardId: string) => toConfidence(cardId))
      .filter(
        (
          entry,
        ): entry is {
          card_id: string;
          score: number;
          band: "hold" | "watch" | "progressing" | "ready";
          top_driver: string;
        } => entry !== null,
      );
    records.push({
      id: `outcome:${outcome.id}:${outcome.decided_at}`,
      source: "recommendation",
      recommendation_id: outcome.id,
      decision: outcome.decision,
      reason_code:
        outcome.decision === "approved" ? "RECOMMENDATION_APPROVED" : "RECOMMENDATION_DISMISSED",
      summary:
        recommendation?.message ??
        `${outcome.id.replaceAll("-", " ")} recommendation ${outcome.decision}.`,
      linked_cards: linkedCards,
      linked_card_confidence: linkedConfidence,
      next_safe_step:
        outcome.decision === "approved"
          ? "Execute linked job cards in dependency order and run proof."
          : "Monitor linked cards and revisit if KPI drift worsens.",
      decided_at: outcome.decided_at,
    });
  }

  for (const recommendation of recommendations) {
    if (recommendation.decision !== "pending") {
      continue;
    }
    const links = recommendationLinksFor(recommendation.id, cards);
    const linkedConfidence = links.linkedCards
      .map((cardId) => toConfidence(cardId))
      .filter((entry): entry is NonNullable<ReturnType<typeof toConfidence>> => entry !== null);
    records.push({
      id: `pending:${recommendation.id}`,
      source: "recommendation",
      recommendation_id: recommendation.id,
      decision: "pending",
      reason_code:
        recommendation.severity === "critical"
          ? "CRITICAL_REMEDIATION_REQUIRED"
          : "OPERATOR_DECISION_REQUIRED",
      summary: recommendation.message,
      linked_cards: links.linkedCards,
      linked_card_confidence: linkedConfidence,
      next_safe_step: recommendation.next_step,
      decided_at: null,
    });
  }

  for (const card of cards) {
    if (card.status !== "BLOCKED") {
      continue;
    }
    records.push({
      id: `blocked:${card.id}`,
      source: "job_card",
      recommendation_id: null,
      decision: "pending",
      reason_code: "JOB_CARD_BLOCKED",
      summary: `${card.id} remains blocked and requires remediation.`,
      linked_cards: [card.id],
      linked_card_confidence: [
        {
          card_id: card.id,
          score: card.promotion_confidence.score,
          band: card.promotion_confidence.band,
          top_driver: card.promotion_confidence.drivers[0] ?? "No confidence driver available.",
        },
      ],
      next_safe_step: "Open the card, clear blocker, and rerun proof before promotion.",
      decided_at: null,
    });
  }

  return records;
}

async function fetchTedPayload(endpoint: URL, timeoutMs: number): Promise<TedHealthPayload> {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Sidecar request failed (${response.status})`);
  }

  const body = (await response.json()) as Partial<TedHealthPayload>;
  if (
    typeof body.version !== "string" ||
    typeof body.uptime !== "number" ||
    typeof body.profiles_count !== "number"
  ) {
    throw new Error("Sidecar returned invalid payload");
  }

  return {
    version: body.version,
    uptime: body.uptime,
    profiles_count: body.profiles_count,
    catalog: isCatalogPayload(body.catalog) ? body.catalog : undefined,
  };
}

async function mintTedAuthToken(baseUrl: URL, timeoutMs: number): Promise<string> {
  if (cachedGatewayAuth && cachedGatewayAuth.expiresAtMs > Date.now() + 5_000) {
    return cachedGatewayAuth.token;
  }
  const endpoint = new URL("/auth/mint", baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      operator_key: OPERATOR_KEY,
      ttl_ms: AUTH_TTL_MS,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`auth mint failed (${response.status})`);
  }
  const payload = (await response.json()) as { token?: string; expires_at_ms?: number };
  if (typeof payload.token !== "string" || typeof payload.expires_at_ms !== "number") {
    throw new Error("auth mint returned invalid payload");
  }
  cachedGatewayAuth = {
    token: payload.token,
    expiresAtMs: payload.expires_at_ms,
  };
  return payload.token;
}

async function callAuthenticatedTedRoute(
  baseUrl: URL,
  timeoutMs: number,
  routePath: string,
  body: Record<string, unknown>,
) {
  const token = await mintTedAuthToken(baseUrl, timeoutMs);
  const endpoint = new URL(routePath, baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "x-ted-execution-mode": "DETERMINISTIC",
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      String(
        payload?.next_safe_step ?? payload?.reason_code ?? `request failed (${response.status})`,
      ),
    );
  }
  return payload;
}

async function callAuthenticatedTedGetRoute(baseUrl: URL, timeoutMs: number, routePath: string) {
  const token = await mintTedAuthToken(baseUrl, timeoutMs);
  const endpoint = new URL(routePath, baseUrl);
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "x-ted-execution-mode": "DETERMINISTIC",
      accept: "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      String(
        payload?.next_safe_step ??
          payload?.reason_code ??
          payload?.error ??
          `request failed (${response.status})`,
      ),
    );
  }
  return payload;
}

async function fetchM365ProfileStatus(
  baseUrl: URL,
  timeoutMs: number,
  profileId: string,
): Promise<TedWorkbenchPayload["integrations"]["m365_profiles"][number]> {
  try {
    const payload = (await callAuthenticatedTedGetRoute(
      baseUrl,
      timeoutMs,
      `/graph/${encodeURIComponent(profileId)}/status`,
    )) as {
      auth_state?: string;
      configured?: boolean;
      auth_store?: string | null;
      delegated_scopes?: unknown[];
      last_error?: string | null;
      next_action?: string;
    };
    const configured = payload.configured === true;
    const authState =
      typeof payload.auth_state === "string" ? payload.auth_state.toUpperCase() : "UNKNOWN";
    const status: "connected" | "needs_auth" | "misconfigured" | "error" = !configured
      ? "misconfigured"
      : authState === "CONNECTED"
        ? "connected"
        : "needs_auth";
    return {
      profile_id: profileId,
      status,
      auth_store: typeof payload.auth_store === "string" ? payload.auth_store : null,
      delegated_scopes_count: Array.isArray(payload.delegated_scopes)
        ? payload.delegated_scopes.length
        : 0,
      last_error: typeof payload.last_error === "string" ? payload.last_error : null,
      next_step:
        typeof payload.next_action === "string" && payload.next_action.length > 0
          ? payload.next_action
          : status === "connected"
            ? "No immediate action."
            : "Run Graph profile authentication from Ted controls.",
    };
  } catch (error) {
    return {
      profile_id: profileId,
      status: "error",
      auth_store: null,
      delegated_scopes_count: 0,
      last_error: error instanceof Error ? error.message : String(error),
      next_step: "Check ted sidecar auth mint and profile config, then retry.",
    };
  }
}

async function fetchIntegrationSnapshot(baseUrl: URL, timeoutMs: number) {
  const profiles = await Promise.all([
    fetchM365ProfileStatus(baseUrl, timeoutMs, "olumie"),
    fetchM365ProfileStatus(baseUrl, timeoutMs, "everest"),
  ]);
  return {
    m365_profiles: profiles,
  };
}

function normalizeSupportedProfileId(value: unknown): "olumie" | "everest" | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "olumie" || normalized === "everest") {
    return normalized;
  }
  return null;
}

async function probeTedSidecar(
  baseUrl: URL,
  timeoutMs: number,
): Promise<{
  ok: boolean;
  status?: TedHealthPayload;
  doctor?: TedHealthPayload;
  error?: string;
}> {
  try {
    const [status, doctor] = await Promise.all([
      fetchTedPayload(buildSafeEndpoint(baseUrl, "/status"), timeoutMs),
      fetchTedPayload(buildSafeEndpoint(baseUrl, "/doctor"), timeoutMs),
    ]);
    sidecarLastError = null;
    return { ok: true, status, doctor };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    sidecarLastError = message;
    return { ok: false, error: message };
  }
}

async function waitForTedSidecarHealthy(
  baseUrl: URL,
  timeoutMs: number,
  retries = DEFAULT_HEALTH_CHECK_RETRIES,
): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i < retries; i += 1) {
    const probe = await probeTedSidecar(baseUrl, timeoutMs);
    if (probe.ok) {
      return { ok: true };
    }
    await sleep(DEFAULT_HEALTH_CHECK_DELAY_MS);
  }
  return { ok: false, error: sidecarLastError ?? "ted sidecar did not become healthy" };
}

function stopTedSidecarProcess() {
  const active = sidecarProcess;
  sidecarProcess = null;
  if (!active) {
    return;
  }
  try {
    active.kill("SIGTERM");
  } catch {
    // ignore
  }
  setTimeout(() => {
    if (active.exitCode == null) {
      try {
        active.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
  }, 2_000).unref();
}

function resolveSidecarPaths(
  api: OpenClawPluginApi,
  pluginConfig: TedSidecarPluginConfig | undefined,
): { entry: string; logsDir: string } | null {
  const configuredPath =
    typeof pluginConfig?.sidecarPath === "string" ? pluginConfig.sidecarPath.trim() : "";
  const candidates: string[] = [];

  if (configuredPath) {
    candidates.push(api.resolvePath(configuredPath));
  }
  candidates.push(api.resolvePath("sidecars/ted-engine/server.mjs"));

  if (fs.existsSync(api.source)) {
    const pluginDir = path.dirname(api.source);
    candidates.push(path.resolve(pluginDir, "../../sidecars/ted-engine/server.mjs"));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return {
        entry: candidate,
        logsDir: path.join(path.dirname(candidate), "logs"),
      };
    }
  }
  return null;
}

export default function register(api: OpenClawPluginApi) {
  api.registerService({
    id: "ted-engine",
    start: async () => {
      const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
      if (pluginConfig.autostart === false) {
        api.logger.info("ted-sidecar: autostart disabled via config");
        return;
      }

      const baseUrl = resolveBaseUrl(pluginConfig);
      const timeoutMs = resolveTimeoutMs(pluginConfig);
      const sidecar = resolveSidecarPaths(api, pluginConfig);
      if (!sidecar) {
        sidecarLastError = "ted sidecar entry not found (set ted-sidecar.config.sidecarPath)";
        api.logger.warn(`ted-sidecar: ${sidecarLastError}`);
        return;
      }
      const sidecarEntry = sidecar.entry;
      const logsDir = sidecar.logsDir;

      fs.mkdirSync(logsDir, { recursive: true });
      stopTedSidecarProcess();

      const child = spawn(process.execPath, [sidecarEntry], {
        cwd: path.dirname(sidecarEntry),
        env: process.env,
        stdio: "ignore",
      });
      sidecarProcess = child;
      child.on("exit", (code, signal) => {
        if (sidecarProcess === child) {
          sidecarProcess = null;
        }
        if (code !== 0) {
          sidecarLastError = `ted sidecar exited (code=${String(code)}, signal=${String(signal ?? "")})`;
          api.logger.warn(`ted-sidecar: ${sidecarLastError}`);
        }
      });

      const healthy = await waitForTedSidecarHealthy(baseUrl, timeoutMs);
      if (!healthy.ok) {
        api.logger.warn(
          `ted-sidecar: started but unhealthy (${healthy.error ?? "unknown reason"}); /ted doctor and /ted status remain available`,
        );
      } else {
        api.logger.info("ted-sidecar: sidecar healthy");
      }
    },
    stop: async () => {
      stopTedSidecarProcess();
    },
  });

  api.registerCommand({
    name: "ted",
    description: "Ted sidecar checks and discoverability (/ted doctor, /ted status, /ted catalog).",
    acceptsArgs: true,
    handler: async (ctx) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const action = ctx.args?.trim().toLowerCase() ?? "doctor";
        if (action !== "doctor" && action !== "status" && action !== "catalog") {
          const probe = await probeTedSidecar(baseUrl, timeoutMs);
          if (!probe.ok) {
            return {
              text: "Ted sidecar is unhealthy. Only /ted doctor and /ted status are allowed until it recovers.",
            };
          }
          return { text: "Usage: /ted doctor | /ted status | /ted catalog" };
        }
        const targetPath = resolvePathFromAction(action);
        const endpoint = buildSafeEndpoint(baseUrl, targetPath);

        const payload = await fetchTedPayload(endpoint, timeoutMs);
        if (action === "catalog") {
          return { text: formatCatalog(payload) };
        }
        return { text: formatPayload(action || "doctor", payload) };
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        api.logger.warn(`ted-sidecar command failed: ${message}`);
        return { text: `Ted command failed: ${message}` };
      }
    },
  });

  api.registerGatewayMethod("ted.workbench", async ({ respond }: GatewayRequestHandlerOptions) => {
    try {
      const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
      const baseUrl = resolveBaseUrl(pluginConfig);
      const timeoutMs = resolveTimeoutMs(pluginConfig);
      const probe = await probeTedSidecar(baseUrl, timeoutMs);
      const integrations = probe.ok
        ? await fetchIntegrationSnapshot(baseUrl, timeoutMs)
        : {
            m365_profiles: [
              {
                profile_id: "olumie",
                status: "error" as const,
                auth_store: null,
                delegated_scopes_count: 0,
                last_error: probe.error ?? "sidecar_unhealthy",
                next_step: "Recover sidecar health before checking integration status.",
              },
              {
                profile_id: "everest",
                status: "error" as const,
                auth_store: null,
                delegated_scopes_count: 0,
                last_error: probe.error ?? "sidecar_unhealthy",
                next_step: "Recover sidecar health before checking integration status.",
              },
            ],
          };
      const payload = buildWorkbenchPayload(api, probe, integrations);
      respond(true, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      api.logger.warn(`ted-sidecar gateway method failed: ${message}`);
      respond(false, { error: message });
    }
  });

  api.registerGatewayMethod(
    "ted.integrations.graph.auth.start",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const profileId = normalizeSupportedProfileId(
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown }).profile_id
            : undefined,
        );
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          `/graph/${encodeURIComponent(profileId)}/auth/device/start`,
          {},
        );
        respond(true, {
          profile_id: profileId,
          ...(payload as Record<string, unknown>),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted graph auth start failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.integrations.graph.auth.poll",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; device_code?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        const deviceCode =
          typeof payloadIn.device_code === "string" ? payloadIn.device_code.trim() : "";
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        if (!deviceCode) {
          respond(false, { error: "device_code is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          `/graph/${encodeURIComponent(profileId)}/auth/device/poll`,
          { device_code: deviceCode },
        );
        respond(true, {
          profile_id: profileId,
          ...(payload as Record<string, unknown>),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted graph auth poll failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.integrations.graph.auth.revoke",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const profileId = normalizeSupportedProfileId(
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown }).profile_id
            : undefined,
        );
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          `/graph/${encodeURIComponent(profileId)}/auth/revoke`,
          {},
        );
        respond(true, {
          profile_id: profileId,
          ...(payload as Record<string, unknown>),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted graph auth revoke failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.governance.rolecards.validate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const roleCard =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { role_card?: unknown }).role_card
            : undefined;
        if (!roleCard || typeof roleCard !== "object") {
          respond(false, { error: "role_card object is required" });
          return;
        }
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/governance/role-cards/validate",
          {
            role_card: roleCard as Record<string, unknown>,
          },
        );
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "rolecard_validate",
          outcome: "allowed",
          reason_code: "ROLE_CARD_VALIDATED",
          next_safe_step: "Promote role card only after proof gates pass.",
        });
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted role-card validate failed: ${message}`);
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "rolecard_validate",
          outcome: "blocked",
          reason_code: "ROLE_CARD_VALIDATION_FAILED",
          next_safe_step: "Fix role-card contract violations and re-validate.",
        });
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.jobcards.detail",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const cardId =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { id?: unknown }).id
            : undefined;
        if (typeof cardId !== "string" || cardId.trim().length === 0) {
          respond(false, { error: "id is required" });
          return;
        }
        const records = listJobCardRecords(api).cards;
        const record = records.find(
          (entry) => entry.id.toUpperCase() === cardId.trim().toUpperCase(),
        );
        if (!record) {
          respond(false, { error: `job card not found: ${cardId}` });
          return;
        }
        const outcome = extractSection(record.contents, "Outcome")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .join(" ");
        const nonNegotiables = extractBullets(extractSection(record.contents, "Non-negotiables"));
        const deliverables = extractBullets(extractSection(record.contents, "Deliverables"));
        const evidence = extractBullets(
          extractSection(record.contents, "Proof Evidence (Executed)"),
        );
        respond(true, {
          ...record,
          family: record.family,
          operator_summary: record.operator_summary,
          kpi_signals: record.kpi_signals,
          outcome: outcome || null,
          non_negotiables: nonNegotiables,
          deliverables,
          proof_evidence: evidence,
          markdown: record.contents,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted job-card detail failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.jobcards.preview_update",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const body =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { id?: unknown; markdown?: unknown })
            : {};
        const cardId = typeof body.id === "string" ? body.id.trim() : "";
        const markdown = typeof body.markdown === "string" ? body.markdown : "";
        if (!cardId) {
          respond(false, { error: "id is required" });
          return;
        }
        if (!markdown.trim()) {
          respond(false, { error: "markdown is required" });
          return;
        }
        const records = listJobCardRecords(api).cards;
        const record = records.find(
          (entry) => entry.id.toUpperCase() === cardId.trim().toUpperCase(),
        );
        if (!record) {
          respond(false, { error: `job card not found: ${cardId}` });
          return;
        }
        const before = {
          family: record.family,
          dependencies: record.dependencies,
          kpi_signals: record.kpi_signals,
          proof_script: record.proof_script,
          status: record.status,
        };
        const afterMeta = parseJobCardMetadata(`${record.id}.md`, markdown);
        const after = {
          family: afterMeta.family,
          dependencies: afterMeta.dependencies,
          kpi_signals: afterMeta.kpiSignals,
          proof_script: afterMeta.proofScript,
          status: afterMeta.status,
        };
        const impactSummary: string[] = [];
        const warnings: string[] = [];
        if (before.family !== after.family) {
          impactSummary.push(`Family changes: ${before.family} -> ${after.family}`);
        }
        if (before.status !== after.status) {
          impactSummary.push(`Status changes: ${before.status} -> ${after.status}`);
        }
        if (before.proof_script !== after.proof_script) {
          impactSummary.push("Proof script reference changed.");
        }
        if (before.dependencies.join("|") !== after.dependencies.join("|")) {
          impactSummary.push(
            `Dependencies changed (${before.dependencies.length} -> ${after.dependencies.length}).`,
          );
        }
        if (before.kpi_signals.join("|") !== after.kpi_signals.join("|")) {
          impactSummary.push(
            `KPI signals changed (${before.kpi_signals.length} -> ${after.kpi_signals.length}).`,
          );
        }
        if (!after.proof_script) {
          warnings.push("No proof script linked in edited markdown.");
        }
        if (after.kpi_signals.length === 0) {
          warnings.push("No KPI signals found. Add Friction KPI Evidence bullets.");
        }
        if (after.dependencies.length === 0 && after.status !== "DONE") {
          warnings.push("No dependencies listed; verify sequencing intent.");
        }
        respond(true, {
          id: record.id,
          before,
          after,
          impact_summary:
            impactSummary.length > 0 ? impactSummary : ["No structural metadata changes detected."],
          warnings,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted job-card preview failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.jobcards.update",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const body =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { id?: unknown; markdown?: unknown })
            : {};
        const cardId = typeof body.id === "string" ? body.id.trim() : "";
        const markdown = typeof body.markdown === "string" ? body.markdown : "";
        if (!cardId) {
          respond(false, { error: "id is required" });
          return;
        }
        if (!markdown.trim()) {
          respond(false, { error: "markdown is required" });
          return;
        }
        const records = listJobCardRecords(api).cards;
        const record = records.find(
          (entry) => entry.id.toUpperCase() === cardId.trim().toUpperCase(),
        );
        if (!record) {
          respond(false, { error: `job card not found: ${cardId}` });
          return;
        }
        const afterMetadata = parseJobCardMetadata(`${cardId}.md`, markdown);
        if (afterMetadata.kpiSignals.length === 0) {
          respond(false, {
            error:
              "Save blocked: card is missing Friction KPI Evidence bullets. Use Suggest KPIs and apply before save.",
            suggested_kpis: suggestedKpisForFamily(afterMetadata.family),
          });
          return;
        }
        fs.writeFileSync(record.fullPath, `${markdown.trimEnd()}\n`, "utf8");
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "jobcard_update",
          outcome: "allowed",
          reason_code: "JOB_CARD_UPDATED",
          next_safe_step: "Re-run proof and verify KPI evidence before promotion.",
        });
        respond(true, { ok: true, id: record.id, path: record.path });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "jobcard_update",
          outcome: "blocked",
          reason_code: "JOB_CARD_UPDATE_FAILED",
          next_safe_step: "Fix file write issue and retry save.",
        });
        api.logger.warn(`ted job-card update failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.jobcards.suggest_kpis",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const cardId =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { id?: unknown }).id
            : undefined;
        if (typeof cardId !== "string" || cardId.trim().length === 0) {
          respond(false, { error: "id is required" });
          return;
        }
        const records = listJobCardRecords(api).cards;
        const record = records.find(
          (entry) => entry.id.toUpperCase() === cardId.trim().toUpperCase(),
        );
        if (!record) {
          respond(false, { error: `job card not found: ${cardId}` });
          return;
        }
        respond(true, {
          id: record.id,
          family: record.family,
          suggestions: suggestedKpisForFamily(record.family),
          rationale: `Suggested KPI set for ${record.family} family based on the current job-card intent.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted job-card KPI suggestion failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.docs.read",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const key =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { key?: unknown }).key
            : undefined;
        if (
          key !== "job_board" &&
          key !== "promotion_policy" &&
          key !== "value_friction" &&
          key !== "interrogation_cycle"
        ) {
          respond(false, {
            error:
              "key must be one of job_board|promotion_policy|value_friction|interrogation_cycle",
          });
          return;
        }
        const relativePath =
          key === "job_board"
            ? "docs/ted-profile/sdd-pack/10_ROADMAP_JOB_BOARD.md"
            : key === "promotion_policy"
              ? "docs/ted-profile/sdd-pack/14_DAY1_PROMOTION_POLICY.md"
              : key === "value_friction"
                ? "docs/ted-profile/sdd-pack/15_VALUE_AND_FRICTION_GATES.md"
                : "docs/ted-profile/sdd-pack/17_COUNCIL_INTERROGATION_CYCLE_001.md";
        const fullPath = resolveRepoRelativePath(api, relativePath);
        if (!fullPath) {
          respond(false, { error: `document not found: ${relativePath}` });
          return;
        }
        respond(true, {
          key,
          path: relativePath,
          content: fs.readFileSync(fullPath, "utf8"),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted docs read failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.policy.read",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const key =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { key?: unknown }).key
            : undefined;
        if (key !== "job_board" && key !== "promotion_policy" && key !== "value_friction") {
          respond(false, { error: "key must be one of job_board|promotion_policy|value_friction" });
          return;
        }
        const pathKey = POLICY_PATHS[key];
        const fullPath = resolveRepoRelativePath(api, pathKey);
        if (!fullPath) {
          respond(false, { error: `policy document not found: ${pathKey}` });
          return;
        }
        const markdown = fs.readFileSync(fullPath, "utf8");
        respond(true, {
          key,
          path: pathKey,
          heading: policyHeading(key),
          config: parsePolicyConfigFromMarkdown(key, markdown),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted policy read failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.policy.preview_update",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const body =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { key?: unknown; config?: unknown })
            : {};
        const key = body.key;
        if (key !== "job_board" && key !== "promotion_policy" && key !== "value_friction") {
          respond(false, { error: "key must be one of job_board|promotion_policy|value_friction" });
          return;
        }
        const pathKey = POLICY_PATHS[key];
        const fullPath = resolveRepoRelativePath(api, pathKey);
        if (!fullPath) {
          respond(false, { error: `policy document not found: ${pathKey}` });
          return;
        }
        const configRaw = body.config;
        if (!configRaw || typeof configRaw !== "object" || Array.isArray(configRaw)) {
          respond(false, { error: "config object is required" });
          return;
        }
        const config = configRaw as TedPolicyConfig;
        const beforeMarkdown = fs.readFileSync(fullPath, "utf8");
        const before = parsePolicyConfigFromMarkdown(key, beforeMarkdown);
        const previewMarkdown = upsertPolicyConfigSection(beforeMarkdown, config);
        const impactSummary: string[] = [];
        const warnings: string[] = [];
        if (before.rollout_mode !== config.rollout_mode) {
          impactSummary.push(
            `Rollout mode changes: ${before.rollout_mode} -> ${config.rollout_mode}`,
          );
        }
        if (before.automation_ceiling !== config.automation_ceiling) {
          impactSummary.push(
            `Automation ceiling changes: ${before.automation_ceiling} -> ${config.automation_ceiling}`,
          );
        }
        if (before.objective !== config.objective) {
          impactSummary.push("Objective text updated.");
        }
        if (before.success_checks.join("|") !== config.success_checks.join("|")) {
          impactSummary.push("Success checks updated.");
        }
        if (before.guardrails.join("|") !== config.guardrails.join("|")) {
          impactSummary.push("Guardrails updated.");
        }
        if (!config.objective.trim()) {
          warnings.push("Objective is empty.");
        }
        if (config.guardrails.length === 0) {
          warnings.push("No guardrails listed.");
        }
        if (config.success_checks.length === 0) {
          warnings.push("No success checks listed.");
        }
        respond(true, {
          key,
          path: pathKey,
          impact_summary:
            impactSummary.length > 0 ? impactSummary : ["No effective policy changes detected."],
          warnings,
          preview_markdown: previewMarkdown,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted policy preview failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.policy.update",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const body =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { key?: unknown; config?: unknown })
            : {};
        const key = body.key;
        if (key !== "job_board" && key !== "promotion_policy" && key !== "value_friction") {
          respond(false, { error: "key must be one of job_board|promotion_policy|value_friction" });
          return;
        }
        const pathKey = POLICY_PATHS[key];
        const fullPath = resolveRepoRelativePath(api, pathKey);
        if (!fullPath) {
          respond(false, { error: `policy document not found: ${pathKey}` });
          return;
        }
        const configRaw = body.config;
        if (!configRaw || typeof configRaw !== "object" || Array.isArray(configRaw)) {
          respond(false, { error: "config object is required" });
          return;
        }
        const config = configRaw as TedPolicyConfig;
        const markdown = fs.readFileSync(fullPath, "utf8");
        const beforeConfig = parsePolicyConfigFromMarkdown(key, markdown);
        const nextMarkdown = upsertPolicyConfigSection(markdown, config);
        fs.writeFileSync(fullPath, nextMarkdown, "utf8");
        const impact = comparePolicyConfigs(
          key,
          beforeConfig,
          config,
          listJobCardRecords(api).cards,
        );
        appendPolicyImpact(api, impact);
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "threshold_update",
          outcome: "allowed",
          reason_code: "POLICY_CONFIG_UPDATED",
          next_safe_step: "Review impact, then run relevant proof gates before promotion.",
        });
        respond(true, { ok: true, key, path: pathKey, impact });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "threshold_update",
          outcome: "blocked",
          reason_code: "POLICY_CONFIG_UPDATE_FAILED",
          next_safe_step: "Fix policy validation errors and retry save.",
        });
        api.logger.warn(`ted policy update failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.recommendations.decide",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payload =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { id?: unknown; decision?: unknown })
            : {};
        const id = typeof payload.id === "string" ? payload.id.trim() : "";
        const decision = payload.decision;
        if (!id) {
          respond(false, { error: "id is required" });
          return;
        }
        if (decision !== "approved" && decision !== "dismissed") {
          respond(false, { error: "decision must be approved|dismissed" });
          return;
        }
        const cards = listJobCardRecords(api).cards;
        const links = recommendationLinksFor(id, cards);
        writeRecommendationDecision(api, id, decision);
        appendRecommendationOutcome(api, {
          id,
          decision,
          decided_at: new Date().toISOString(),
          linked_cards: links.linkedCards,
          rationale: links.rationale,
        });
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "recommendation_decision",
          outcome: "allowed",
          reason_code:
            decision === "approved" ? "RECOMMENDATION_APPROVED" : "RECOMMENDATION_DISMISSED",
          next_safe_step:
            decision === "approved"
              ? "Execute the recommended remediation in dependency order."
              : "Document dismissal rationale and monitor KPI drift.",
        });
        respond(true, {
          ok: true,
          id,
          decision,
          linked_cards: links.linkedCards,
          rationale: links.rationale,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted recommendation decision failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.intake.recommend",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const body =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const outcome = typeof body.outcome === "string" ? body.outcome.trim() : "";
        const jobFamily =
          typeof body.job_family === "string" ? body.job_family.trim().toUpperCase() : "MNT";
        const riskLevel =
          typeof body.risk_level === "string" ? body.risk_level.trim().toLowerCase() : "medium";
        const automationLevel =
          typeof body.automation_level === "string"
            ? body.automation_level.trim().toLowerCase()
            : "draft-only";
        if (!title || !outcome) {
          respond(false, { error: "title and outcome are required" });
          return;
        }

        const releaseTarget =
          riskLevel === "high"
            ? "Phase-1"
            : automationLevel === "draft-only"
              ? "Day-1 to Phase-1"
              : "Phase-1";
        const priority = riskLevel === "high" ? "P1" : "P0";
        const governanceTier =
          riskLevel === "high" ? "Tier-3 (approval required)" : "Tier-2 (approval-first)";
        const recommendedKpis = suggestedKpisForFamily(
          jobFamily === "GOV" || jobFamily === "MNT" || jobFamily === "ING" || jobFamily === "LED"
            ? jobFamily
            : "OUT",
        );
        const hardBans =
          automationLevel === "draft-only"
            ? ["No autonomous send/invite/share", "No cross-entity rendering without override"]
            : ["No unapproved risky writes", "No policy bypass on entity or provenance checks"];
        const safeTitle = title.replace(/[^\w\s-]/g, "").trim() || "new-job-card";
        const slug = safeTitle.toLowerCase().replace(/\s+/g, "-");
        const draftMarkdown = `# JC-XXX — ${title}

## Outcome

${outcome}

## Promotion State

- Current: TODO
- Promotion rule:
  - Requires council proof gate PASS.

## Non-negotiables

${hardBans.map((item) => `- ${item}`).join("\n")}

## Deliverables

- Primary workflow for ${jobFamily}.
- Operator approval surface for risky actions.
- KPI instrumentation with explainability output.

## Suggested Metadata

- Priority: ${priority}
- Release target: ${releaseTarget}
- Governance tier: ${governanceTier}
- Recommended KPIs: ${recommendedKpis.join("; ")}

## Friction KPI Evidence

${recommendedKpis.map((kpi) => `- ${kpi}`).join("\n")}

## Proof Script

- scripts/ted-profile/proof_jcXXX.sh
`;
        respond(true, {
          priority,
          release_target: releaseTarget,
          governance_tier: governanceTier,
          recommended_kpis: recommendedKpis,
          hard_bans: hardBans,
          suggested_dependencies: [],
          suggested_path: `docs/ted-profile/job-cards/${slug}.md`,
          draft_markdown: draftMarkdown,
        });
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "intake_recommend",
          outcome: "allowed",
          reason_code: "INTAKE_RECOMMENDATION_GENERATED",
          next_safe_step: "Review suggested draft, then create card and link proof script.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted intake recommendation failed: ${message}`);
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "intake_recommend",
          outcome: "blocked",
          reason_code: "INTAKE_RECOMMENDATION_FAILED",
          next_safe_step: "Provide title/outcome and retry intake recommendation.",
        });
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.gates.set",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payload =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                overrides?: Partial<FrictionKpis>;
                acknowledge_risk?: unknown;
                reset?: unknown;
              })
            : {};
        if (payload.reset === true) {
          writeGateOverrides(api, defaultGateOverridesStore());
          appendGovernanceEvent(api, {
            ts: new Date().toISOString(),
            action: "threshold_update",
            outcome: "allowed",
            reason_code: "THRESHOLDS_RESET_DEFAULTS",
            next_safe_step: "Continue with default promotion gates.",
          });
          respond(true, {
            ok: true,
            reset: true,
            threshold_controls: resolveEffectiveFrictionKpis(api),
          });
          return;
        }
        const overrides = payload.overrides ?? {};
        const defaults = { ...DEFAULT_FRICTION_KPIS };
        const current = readGateOverrides(api);
        const next: GateOverridesStore = {
          overrides: {
            manual_minutes_per_day_max:
              typeof overrides.manual_minutes_per_day_max === "number"
                ? Math.max(1, Math.floor(overrides.manual_minutes_per_day_max))
                : current.overrides.manual_minutes_per_day_max,
            approval_queue_oldest_minutes_max:
              typeof overrides.approval_queue_oldest_minutes_max === "number"
                ? Math.max(1, Math.floor(overrides.approval_queue_oldest_minutes_max))
                : current.overrides.approval_queue_oldest_minutes_max,
            unresolved_triage_eod_max:
              typeof overrides.unresolved_triage_eod_max === "number"
                ? Math.max(0, Math.floor(overrides.unresolved_triage_eod_max))
                : current.overrides.unresolved_triage_eod_max,
            blocked_actions_missing_explainability_max:
              typeof overrides.blocked_actions_missing_explainability_max === "number"
                ? Math.max(0, Math.floor(overrides.blocked_actions_missing_explainability_max))
                : current.overrides.blocked_actions_missing_explainability_max,
          },
          updated_at: new Date().toISOString(),
        };
        const effective: FrictionKpis = {
          manual_minutes_per_day_max:
            next.overrides.manual_minutes_per_day_max ?? defaults.manual_minutes_per_day_max,
          approval_queue_oldest_minutes_max:
            next.overrides.approval_queue_oldest_minutes_max ??
            defaults.approval_queue_oldest_minutes_max,
          unresolved_triage_eod_max:
            next.overrides.unresolved_triage_eod_max ?? defaults.unresolved_triage_eod_max,
          blocked_actions_missing_explainability_max:
            next.overrides.blocked_actions_missing_explainability_max ??
            defaults.blocked_actions_missing_explainability_max,
        };
        const relaxed =
          effective.manual_minutes_per_day_max > defaults.manual_minutes_per_day_max ||
          effective.approval_queue_oldest_minutes_max >
            defaults.approval_queue_oldest_minutes_max ||
          effective.unresolved_triage_eod_max > defaults.unresolved_triage_eod_max ||
          effective.blocked_actions_missing_explainability_max >
            defaults.blocked_actions_missing_explainability_max;
        if (relaxed && payload.acknowledge_risk !== true) {
          appendGovernanceEvent(api, {
            ts: new Date().toISOString(),
            action: "threshold_update",
            outcome: "blocked",
            reason_code: "RISK_ACK_REQUIRED",
            next_safe_step:
              "Set acknowledge_risk=true if intentionally relaxing thresholds with operator accountability.",
          });
          respond(true, {
            ok: false,
            reason_code: "RISK_ACK_REQUIRED",
            warning:
              "Relaxed thresholds require acknowledge_risk=true. Warning: this can unlock value sooner but raises quality/regression risk.",
            threshold_controls: resolveEffectiveFrictionKpis(api),
          });
          return;
        }
        writeGateOverrides(api, next);
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "threshold_update",
          outcome: "allowed",
          reason_code: relaxed
            ? "THRESHOLDS_RELAXED_ACKNOWLEDGED"
            : "THRESHOLDS_TIGHTENED_OR_EQUAL",
          next_safe_step: relaxed
            ? "Monitor KPI drift closely and revert if regression risk rises."
            : "Proceed to next dependency-ordered slice with standard guardrails.",
        });
        respond(true, { ok: true, threshold_controls: resolveEffectiveFrictionKpis(api) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted gates set failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.jobcards.proof.run",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const proofScript =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { proof_script?: unknown }).proof_script
            : undefined;
        if (typeof proofScript !== "string" || proofScript.trim().length === 0) {
          respond(false, { error: "proof_script is required" });
          return;
        }
        const payload = await runProofScript(api, proofScript);
        appendEvalHistory(api, {
          ts: new Date().toISOString(),
          proof_script: proofScript,
          ok: payload.ok,
          exit_code: payload.exit_code,
        });
        appendGovernanceEvent(api, {
          ts: new Date().toISOString(),
          action: "proof_run",
          outcome: payload.ok ? "allowed" : "blocked",
          reason_code: payload.ok ? "PROOF_PASS" : "PROOF_FAIL",
          next_safe_step: payload.ok
            ? "Update job-card promotion state and continue dependency chain."
            : "Fix failing gate, then rerun proof before promotion.",
        });
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted proof run failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );
}

export { buildSafeEndpoint, isLoopbackHost, normalizeBaseUrl, resolvePathFromAction };
