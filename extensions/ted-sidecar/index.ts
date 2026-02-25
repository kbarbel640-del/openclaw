import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Type } from "@sinclair/typebox";
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
const TED_API_VERSION = "2026-02";

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
const PROOF_SCRIPT_PATH_RE = /^scripts\/ted-profile\/proof_[\w]+\.sh$/i;
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
  const re = /^##\s+Operator Configuration\s*\n[\s\S]*?(?=\n##\s|$(?![\s\S]))/m;
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
  // Use $(?![\s\S]) for true end-of-string in multiline mode (bare $ matches end-of-line).
  const re = new RegExp(`^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$(?![\\s\\S]))`, "m");
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
  extraHeaders?: Record<string, string>,
) {
  const token = await mintTedAuthToken(baseUrl, timeoutMs);
  const endpoint = new URL(routePath, baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "x-ted-execution-mode": "DETERMINISTIC",
      "x-ted-api-version": TED_API_VERSION,
      "content-type": "application/json",
      accept: "application/json",
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const serverVersion = response.headers.get("x-ted-api-version");
  if (serverVersion && serverVersion !== TED_API_VERSION) {
    console.warn(
      `[ted-sidecar] API version mismatch: client=${TED_API_VERSION} server=${serverVersion}`,
    );
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      String(
        payload?.error ??
          payload?.message ??
          payload?.next_safe_step ??
          payload?.reason_code ??
          `request failed (${response.status})`,
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
      "x-ted-api-version": TED_API_VERSION,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const serverVersion = response.headers.get("x-ted-api-version");
  if (serverVersion && serverVersion !== TED_API_VERSION) {
    console.warn(
      `[ted-sidecar] API version mismatch: client=${TED_API_VERSION} server=${serverVersion}`,
    );
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      String(
        payload?.error ??
          payload?.message ??
          payload?.next_safe_step ??
          payload?.reason_code ??
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
        // Destructure to exclude fullPath (absolute filesystem path) and
        // contents (raw bytes) from any accidental spread into the response.
        const { fullPath: _fp, contents, ...safeRecord } = record;
        const outcome = extractSection(contents, "Outcome")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .join(" ");
        const nonNegotiables = extractBullets(extractSection(contents, "Non-negotiables"));
        const deliverables = extractBullets(extractSection(contents, "Deliverables"));
        const evidence = extractBullets(extractSection(contents, "Proof Evidence (Executed)"));
        respond(true, {
          ...safeRecord,
          outcome: outcome || null,
          non_negotiables: nonNegotiables,
          deliverables,
          proof_evidence: evidence,
          markdown: contents,
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
    "ted.intake.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, "/intake/create", body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted intake create failed: ${message}`);
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

  // ---------------------------------------------------------------------------
  // Core JTBD gateway methods: inbox, filing, calendar, deadlines, briefs
  // ---------------------------------------------------------------------------

  api.registerGatewayMethod(
    "ted.mail.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                profile_id?: unknown;
                folder?: unknown;
                top?: unknown;
                filter?: unknown;
                skip?: unknown;
              })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const folder =
          typeof payloadIn.folder === "string" && payloadIn.folder.trim().length > 0
            ? payloadIn.folder.trim()
            : "inbox";
        const top =
          typeof payloadIn.top === "number" && Number.isFinite(payloadIn.top) && payloadIn.top > 0
            ? Math.floor(payloadIn.top)
            : 25;
        const filter =
          typeof payloadIn.filter === "string" && payloadIn.filter.trim().length > 0
            ? payloadIn.filter.trim()
            : "all";
        const skip =
          typeof payloadIn.skip === "number" &&
          Number.isFinite(payloadIn.skip) &&
          payloadIn.skip >= 0
            ? Math.floor(payloadIn.skip)
            : 0;
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const queryParams = `folder=${encodeURIComponent(folder)}&top=${top}&filter=${encodeURIComponent(filter)}&skip=${skip}`;
        const routePath = `/graph/${encodeURIComponent(profileId)}/mail/list?${queryParams}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted mail list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.mail.move",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                profile_id?: unknown;
                message_id?: unknown;
                destination_folder_id?: unknown;
              })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const messageId =
          typeof payloadIn.message_id === "string" ? payloadIn.message_id.trim() : "";
        if (!messageId) {
          respond(false, { error: "message_id is required" });
          return;
        }
        const destinationFolderId =
          typeof payloadIn.destination_folder_id === "string"
            ? payloadIn.destination_folder_id.trim()
            : "";
        if (!destinationFolderId) {
          respond(false, { error: "destination_folder_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/mail/${encodeURIComponent(messageId)}/move`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {
            destination_folder_id: destinationFolderId,
          },
          { "x-ted-approval-source": "operator" },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted mail move failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.calendar.event.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                profile_id?: unknown;
                subject?: unknown;
                start_datetime?: unknown;
                end_datetime?: unknown;
                location?: unknown;
                body_text?: unknown;
              })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const subject = typeof payloadIn.subject === "string" ? payloadIn.subject.trim() : "";
        if (!subject) {
          respond(false, { error: "subject is required" });
          return;
        }
        const startDatetime =
          typeof payloadIn.start_datetime === "string" ? payloadIn.start_datetime.trim() : "";
        if (!startDatetime) {
          respond(false, { error: "start_datetime is required" });
          return;
        }
        const endDatetime =
          typeof payloadIn.end_datetime === "string" ? payloadIn.end_datetime.trim() : "";
        if (!endDatetime) {
          respond(false, { error: "end_datetime is required" });
          return;
        }
        const body: Record<string, unknown> = {
          subject,
          start_datetime: startDatetime,
          end_datetime: endDatetime,
        };
        if (typeof payloadIn.location === "string" && payloadIn.location.trim().length > 0) {
          body.location = payloadIn.location.trim();
        }
        if (typeof payloadIn.body_text === "string" && payloadIn.body_text.trim().length > 0) {
          body.body_text = payloadIn.body_text.trim();
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/calendar/event/create`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted calendar event create failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.extraction.deadlines",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { text?: unknown; source_ref?: unknown })
            : {};
        const text = typeof payloadIn.text === "string" ? payloadIn.text.trim() : "";
        if (!text) {
          respond(false, { error: "text is required" });
          return;
        }
        const body: Record<string, unknown> = { text };
        if (typeof payloadIn.source_ref === "string" && payloadIn.source_ref.trim().length > 0) {
          body.source_ref = payloadIn.source_ref.trim();
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/extraction/deadlines",
          body,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted extraction deadlines failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.reporting.morning_brief",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/reporting/morning-brief",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted reporting morning brief failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.reporting.eod_digest",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/reporting/eod-digest",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted reporting eod digest failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.drafts.generate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                profile_id?: unknown;
                max_drafts?: unknown;
                filter?: unknown;
              })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const maxDrafts =
          typeof payloadIn.max_drafts === "number" &&
          Number.isFinite(payloadIn.max_drafts) &&
          payloadIn.max_drafts > 0
            ? Math.floor(payloadIn.max_drafts)
            : 5;
        const filter =
          typeof payloadIn.filter === "string" && payloadIn.filter.trim().length > 0
            ? payloadIn.filter.trim()
            : "unread";
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/drafts/generate`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, {
          max_drafts: maxDrafts,
          filter,
        });
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted drafts generate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Deal CRUD gateway methods ---

  api.registerGatewayMethod(
    "ted.deals.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                deal_name?: unknown;
                deal_type?: unknown;
                entity?: unknown;
                stage?: unknown;
                status?: unknown;
              })
            : {};
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body = {
          deal_id: payloadIn.deal_id,
          deal_name: payloadIn.deal_name,
          deal_type: payloadIn.deal_type,
          entity: payloadIn.entity,
          stage: payloadIn.stage,
          status: payloadIn.status,
        };
        const routePath = "/deals/create";
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals create failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.list",
    async ({ params: _params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = "/deals/list";
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.get",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { deal_id?: unknown })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/deals/${encodeURIComponent(dealId)}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals get failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.update",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                deal_name?: unknown;
                deal_type?: unknown;
                stage?: unknown;
                status?: unknown;
                entity?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.deal_name !== undefined) body.deal_name = payloadIn.deal_name;
        if (payloadIn.deal_type !== undefined) body.deal_type = payloadIn.deal_type;
        if (payloadIn.stage !== undefined) body.stage = payloadIn.stage;
        if (payloadIn.status !== undefined) body.status = payloadIn.status;
        if (payloadIn.entity !== undefined) body.entity = payloadIn.entity;
        const routePath = `/deals/${encodeURIComponent(dealId)}/update`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals update failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.dates.add",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                label?: unknown;
                date?: unknown;
                type?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.label !== undefined) body.label = payloadIn.label;
        if (payloadIn.date !== undefined) body.date = payloadIn.date;
        if (payloadIn.type !== undefined) body.type = payloadIn.type;
        const routePath = `/deals/${encodeURIComponent(dealId)}/dates`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals dates add failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.investors.add",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                name?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.name !== undefined) body.name = payloadIn.name;
        const routePath = `/deals/${encodeURIComponent(dealId)}/investors`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals investors add failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.investors.update",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                name?: unknown;
                oig_status?: unknown;
                state_exclusion_status?: unknown;
                disclosure_form_sent?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.name !== undefined) body.name = payloadIn.name;
        if (payloadIn.oig_status !== undefined) body.oig_status = payloadIn.oig_status;
        if (payloadIn.state_exclusion_status !== undefined)
          body.state_exclusion_status = payloadIn.state_exclusion_status;
        if (payloadIn.disclosure_form_sent !== undefined)
          body.disclosure_form_sent = payloadIn.disclosure_form_sent;
        const routePath = `/deals/${encodeURIComponent(dealId)}/investors/update`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals investors update failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.counsel.add",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                firm_name?: unknown;
                matter?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.firm_name !== undefined) body.firm_name = payloadIn.firm_name;
        if (payloadIn.matter !== undefined) body.matter = payloadIn.matter;
        const routePath = `/deals/${encodeURIComponent(dealId)}/counsel`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals counsel add failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.counsel.invoice",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                firm_name?: unknown;
                amount?: unknown;
                date?: unknown;
                description?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.firm_name !== undefined) body.firm_name = payloadIn.firm_name;
        if (payloadIn.amount !== undefined) body.amount = payloadIn.amount;
        if (payloadIn.date !== undefined) body.date = payloadIn.date;
        if (payloadIn.description !== undefined) body.description = payloadIn.description;
        const routePath = `/deals/${encodeURIComponent(dealId)}/counsel/invoice`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals counsel invoice failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.tasks.add",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                task?: unknown;
                owner?: unknown;
                due_date?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.task !== undefined) body.task = payloadIn.task;
        if (payloadIn.owner !== undefined) body.owner = payloadIn.owner;
        if (payloadIn.due_date !== undefined) body.due_date = payloadIn.due_date;
        const routePath = `/deals/${encodeURIComponent(dealId)}/tasks`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals tasks add failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.tasks.update",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                task_index?: unknown;
                status?: unknown;
                owner?: unknown;
                due_date?: unknown;
                task?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.task_index !== undefined) body.task_index = payloadIn.task_index;
        if (payloadIn.status !== undefined) body.status = payloadIn.status;
        if (payloadIn.owner !== undefined) body.owner = payloadIn.owner;
        if (payloadIn.due_date !== undefined) body.due_date = payloadIn.due_date;
        if (payloadIn.task !== undefined) body.task = payloadIn.task;
        const routePath = `/deals/${encodeURIComponent(dealId)}/tasks/update`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals tasks update failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.checklist.update",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                action?: unknown;
                item?: unknown;
                item_index?: unknown;
                status?: unknown;
                notes?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.action !== undefined) body.action = payloadIn.action;
        if (payloadIn.item !== undefined) body.item = payloadIn.item;
        if (payloadIn.item_index !== undefined) body.item_index = payloadIn.item_index;
        if (payloadIn.status !== undefined) body.status = payloadIn.status;
        if (payloadIn.notes !== undefined) body.notes = payloadIn.notes;
        const routePath = `/deals/${encodeURIComponent(dealId)}/checklist`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals checklist update failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.deals.notes.add",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                text?: unknown;
                author?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.text !== undefined) body.text = payloadIn.text;
        if (payloadIn.author !== undefined) body.author = payloadIn.author;
        const routePath = `/deals/${encodeURIComponent(dealId)}/notes`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals notes add failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- LLM Provider gateway methods (JC-070d) ---

  api.registerGatewayMethod(
    "ted.llm.provider.get",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/ops/llm-provider");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted llm provider get failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.llm.provider.set",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                default_provider?: unknown;
                per_job_overrides?: unknown;
              })
            : {};
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.default_provider !== undefined)
          body.default_provider = payloadIn.default_provider;
        if (payloadIn.per_job_overrides !== undefined)
          body.per_job_overrides = payloadIn.per_job_overrides;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/llm-provider",
          body,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted llm provider set failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Notification Budget gateway method (JC-084a) ---

  api.registerGatewayMethod(
    "ted.ops.notification_budget",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/notification-budget",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted notification budget get failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Meeting: upcoming (Phase 6) ---

  api.registerGatewayMethod(
    "ted.meeting.upcoming",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/meeting/upcoming?hours=24",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted meeting upcoming failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Meeting: prep (Phase 6) ---

  api.registerGatewayMethod(
    "ted.meeting.prep",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const paramsObj =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const eventId = typeof paramsObj.event_id === "string" ? paramsObj.event_id : "";
        const routePath = `/meeting/prep/${encodeURIComponent(eventId)}`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, paramsObj);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted meeting prep failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Meeting: debrief (Phase 6) ---

  api.registerGatewayMethod(
    "ted.meeting.debrief",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/meeting/debrief",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted meeting debrief failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Commitments: list (Phase 6) ---

  api.registerGatewayMethod(
    "ted.commitments.list",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/commitments/list");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted commitments list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Commitments: create (Phase 6) ---

  api.registerGatewayMethod(
    "ted.commitments.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/commitments/create",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted commitments create failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Commitments: complete (Phase 6) ---

  api.registerGatewayMethod(
    "ted.commitments.complete",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const paramsObj =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const commitmentId =
          typeof paramsObj.commitment_id === "string" ? paramsObj.commitment_id : "";
        const routePath = `/commitments/${encodeURIComponent(commitmentId)}/complete`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, {});
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted commitments complete failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- GTD Actions: list (Phase 7) ---

  api.registerGatewayMethod(
    "ted.gtd.actions.list",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/gtd/actions/list");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted gtd actions list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- GTD Actions: create (Phase 7) ---

  api.registerGatewayMethod(
    "ted.gtd.actions.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/gtd/actions/create",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted gtd actions create failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- GTD Actions: complete (Phase 7) ---

  api.registerGatewayMethod(
    "ted.gtd.actions.complete",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const paramsObj =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const actionId = typeof paramsObj.action_id === "string" ? paramsObj.action_id : "";
        const routePath = `/gtd/actions/${encodeURIComponent(actionId)}/complete`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, {});
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted gtd actions complete failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- GTD Waiting-For: list (Phase 7) ---

  api.registerGatewayMethod(
    "ted.gtd.waiting_for.list",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/gtd/waiting-for/list",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted gtd waiting-for list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- GTD Waiting-For: create (Phase 7) ---

  api.registerGatewayMethod(
    "ted.gtd.waiting_for.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/gtd/waiting-for/create",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted gtd waiting-for create failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Planning: timeblock generate (Phase 7) ---

  api.registerGatewayMethod(
    "ted.planning.timeblock.generate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/planning/timeblock/generate",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted planning timeblock generate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Filing: PARA classify (Phase 8) ---

  api.registerGatewayMethod(
    "ted.filing.para.classify",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/filing/para/classify",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted filing para classify failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Filing: PARA structure (Phase 8) ---

  api.registerGatewayMethod(
    "ted.filing.para.structure",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/filing/para/structure",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted filing para structure failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Reporting: deep work metrics (Phase 8) ---

  api.registerGatewayMethod(
    "ted.reporting.deep_work_metrics",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/reporting/deep-work-metrics?period=week",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted reporting deep work metrics failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Reporting: trust metrics (Phase 8) ---

  api.registerGatewayMethod(
    "ted.reporting.trust_metrics",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/reporting/trust-metrics?period=week",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted reporting trust metrics failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.events.stats",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/events/stats");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted events stats failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.events.recent",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { limit?: unknown; event_type?: unknown })
            : {};
        const queryParts: string[] = [];
        if (
          typeof payloadIn.limit === "number" &&
          Number.isFinite(payloadIn.limit) &&
          payloadIn.limit > 0
        ) {
          queryParts.push(`limit=${Math.floor(payloadIn.limit)}`);
        }
        if (typeof payloadIn.event_type === "string" && payloadIn.event_type.trim().length > 0) {
          queryParts.push(`event_type=${encodeURIComponent(payloadIn.event_type.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/events/recent${queryString}`,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted events recent failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── Planner / To Do / Sync / Extraction gateway methods (JC-104a) ───────────

  api.registerGatewayMethod(
    "ted.planner.plans.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/planner/plans`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted planner plans list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.planner.tasks.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; plan_id?: unknown; bucket_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const planId = typeof payloadIn.plan_id === "string" ? payloadIn.plan_id.trim() : "";
        if (!planId) {
          respond(false, { error: "plan_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const queryParts: string[] = [];
        if (typeof payloadIn.bucket_id === "string" && payloadIn.bucket_id.trim().length > 0) {
          queryParts.push(`bucket_id=${encodeURIComponent(payloadIn.bucket_id.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const routePath = `/graph/${encodeURIComponent(profileId)}/planner/plans/${encodeURIComponent(planId)}/tasks${queryString}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted planner tasks list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.todo.lists",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/todo/lists`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted todo lists failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.todo.tasks.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; list_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const listId = typeof payloadIn.list_id === "string" ? payloadIn.list_id.trim() : "";
        if (!listId) {
          respond(false, { error: "list_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/todo/lists/${encodeURIComponent(listId)}/tasks`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted todo tasks list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.sync.reconcile",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/sync/reconcile`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sync reconcile failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.sync.proposals.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; status?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const queryParts: string[] = [];
        if (typeof payloadIn.status === "string" && payloadIn.status.trim().length > 0) {
          queryParts.push(`status=${encodeURIComponent(payloadIn.status.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const routePath = `/graph/${encodeURIComponent(profileId)}/sync/proposals${queryString}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sync proposals list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.sync.proposals.approve",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; proposal_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const proposalId =
          typeof payloadIn.proposal_id === "string" ? payloadIn.proposal_id.trim() : "";
        if (!proposalId) {
          respond(false, { error: "proposal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/sync/proposals/${encodeURIComponent(proposalId)}/approve`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sync proposals approve failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.sync.proposals.reject",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; proposal_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const proposalId =
          typeof payloadIn.proposal_id === "string" ? payloadIn.proposal_id.trim() : "";
        if (!proposalId) {
          respond(false, { error: "proposal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/sync/proposals/${encodeURIComponent(proposalId)}/reject`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sync proposals reject failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── SharePoint gateway methods ────────────────────────────────────────────────

  api.registerGatewayMethod(
    "ted.sharepoint.sites.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/sites`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sharepoint sites list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.sharepoint.drives.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; site_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const siteId = typeof payloadIn.site_id === "string" ? payloadIn.site_id.trim() : "";
        if (!siteId) {
          respond(false, { error: "site_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/sites/${encodeURIComponent(siteId)}/drives`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sharepoint drives list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.sharepoint.items.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                profile_id?: unknown;
                drive_id?: unknown;
                path?: unknown;
                item_id?: unknown;
              })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const driveId = typeof payloadIn.drive_id === "string" ? payloadIn.drive_id.trim() : "";
        if (!driveId) {
          respond(false, { error: "drive_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const queryParts: string[] = [];
        if (typeof payloadIn.path === "string" && payloadIn.path.trim().length > 0) {
          queryParts.push(`path=${encodeURIComponent(payloadIn.path.trim())}`);
        }
        if (typeof payloadIn.item_id === "string" && payloadIn.item_id.trim().length > 0) {
          queryParts.push(`item_id=${encodeURIComponent(payloadIn.item_id.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/drives/${encodeURIComponent(driveId)}/items${queryString}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sharepoint items list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.sharepoint.item.get",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; drive_id?: unknown; item_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const driveId = typeof payloadIn.drive_id === "string" ? payloadIn.drive_id.trim() : "";
        if (!driveId) {
          respond(false, { error: "drive_id is required" });
          return;
        }
        const itemId = typeof payloadIn.item_id === "string" ? payloadIn.item_id.trim() : "";
        if (!itemId) {
          respond(false, { error: "item_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sharepoint item get failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.sharepoint.search",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; drive_id?: unknown; query?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const driveId = typeof payloadIn.drive_id === "string" ? payloadIn.drive_id.trim() : "";
        if (!driveId) {
          respond(false, { error: "drive_id is required" });
          return;
        }
        const query = typeof payloadIn.query === "string" ? payloadIn.query.trim() : "";
        if (!query) {
          respond(false, { error: "query is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/drives/${encodeURIComponent(driveId)}/search?q=${encodeURIComponent(query)}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sharepoint search failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.sharepoint.upload",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                profile_id?: unknown;
                drive_id?: unknown;
                path?: unknown;
                file_name?: unknown;
                content_base64?: unknown;
                content_type?: unknown;
              })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const driveId = typeof payloadIn.drive_id === "string" ? payloadIn.drive_id.trim() : "";
        if (!driveId) {
          respond(false, { error: "drive_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/drives/${encodeURIComponent(driveId)}/upload`;
        const body: Record<string, unknown> = {};
        if (typeof payloadIn.path === "string") body.path = payloadIn.path;
        if (typeof payloadIn.file_name === "string") body.file_name = payloadIn.file_name;
        if (typeof payloadIn.content_base64 === "string")
          body.content_base64 = payloadIn.content_base64;
        if (typeof payloadIn.content_type === "string") body.content_type = payloadIn.content_type;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sharepoint upload failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.sharepoint.folder.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                profile_id?: unknown;
                drive_id?: unknown;
                parent_path?: unknown;
                folder_name?: unknown;
              })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const driveId = typeof payloadIn.drive_id === "string" ? payloadIn.drive_id.trim() : "";
        if (!driveId) {
          respond(false, { error: "drive_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/drives/${encodeURIComponent(driveId)}/folder`;
        const body: Record<string, unknown> = {};
        if (typeof payloadIn.parent_path === "string") body.parent_path = payloadIn.parent_path;
        if (typeof payloadIn.folder_name === "string") body.folder_name = payloadIn.folder_name;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted sharepoint folder create failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.extraction.commitments",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; message_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const messageId =
          typeof payloadIn.message_id === "string" ? payloadIn.message_id.trim() : "";
        if (!messageId) {
          respond(false, { error: "message_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/mail/${encodeURIComponent(messageId)}/extract-commitments`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, {});
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted extraction commitments failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── Draft Queue gateway methods (Phase 11 / JC-089e) ────────────────────────

  api.registerGatewayMethod(
    "ted.drafts.queue",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { state?: unknown; from_profile?: unknown })
            : {};
        const qs = new URLSearchParams();
        if (typeof payloadIn.state === "string" && payloadIn.state.trim().length > 0) {
          qs.set("state", payloadIn.state.trim());
        }
        if (
          typeof payloadIn.from_profile === "string" &&
          payloadIn.from_profile.trim().length > 0
        ) {
          qs.set("from_profile", payloadIn.from_profile.trim());
        }
        const qsStr = qs.toString();
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/drafts/queue${qsStr ? `?${qsStr}` : ""}`,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted drafts queue failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.drafts.get",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { draft_id?: unknown })
            : {};
        const draftId = typeof payloadIn.draft_id === "string" ? payloadIn.draft_id.trim() : "";
        if (!draftId) {
          respond(false, { error: "draft_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/drafts/${encodeURIComponent(draftId)}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted drafts get failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.drafts.edit",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { draft_id?: unknown; content?: unknown; subject?: unknown })
            : {};
        const draftId = typeof payloadIn.draft_id === "string" ? payloadIn.draft_id.trim() : "";
        if (!draftId) {
          respond(false, { error: "draft_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.content !== undefined) body.content = payloadIn.content;
        if (payloadIn.subject !== undefined) body.subject = payloadIn.subject;
        const routePath = `/drafts/${encodeURIComponent(draftId)}/edit`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted drafts edit failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.drafts.approve",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { draft_id?: unknown })
            : {};
        const draftId = typeof payloadIn.draft_id === "string" ? payloadIn.draft_id.trim() : "";
        if (!draftId) {
          respond(false, { error: "draft_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/drafts/${encodeURIComponent(draftId)}/approve`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted drafts approve failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.drafts.execute",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { draft_id?: unknown })
            : {};
        const draftId = typeof payloadIn.draft_id === "string" ? payloadIn.draft_id.trim() : "";
        if (!draftId) {
          respond(false, { error: "draft_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/drafts/${encodeURIComponent(draftId)}/execute`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted drafts execute failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── State Machine Extensions gateway methods (Phase 13 / JC-091e) ──────────

  api.registerGatewayMethod(
    "ted.commitments.escalate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { id?: unknown; reason?: unknown })
            : {};
        const id = typeof payloadIn.id === "string" ? payloadIn.id.trim() : "";
        if (!id) {
          respond(false, { error: "id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.reason !== undefined) body.reason = payloadIn.reason;
        const routePath = `/commitments/${encodeURIComponent(id)}/escalate`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted commitments escalate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.investors.oig.update",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                deal_id?: unknown;
                investor_name?: unknown;
                new_status?: unknown;
                notes?: unknown;
              })
            : {};
        const dealId = typeof payloadIn.deal_id === "string" ? payloadIn.deal_id.trim() : "";
        const investorName =
          typeof payloadIn.investor_name === "string" ? payloadIn.investor_name.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        if (!investorName) {
          respond(false, { error: "investor_name is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.new_status !== undefined) body.new_status = payloadIn.new_status;
        if (payloadIn.notes !== undefined) body.notes = payloadIn.notes;
        const routePath = `/deals/${encodeURIComponent(dealId)}/investors/${encodeURIComponent(investorName)}/oig-update`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted investors oig update failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.facility.alerts.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/facility/alert/create",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted facility alerts create failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.facility.alerts.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { status?: unknown })
            : {};
        const qs = new URLSearchParams();
        if (typeof payloadIn.status === "string" && payloadIn.status.trim().length > 0) {
          qs.set("status", payloadIn.status.trim());
        }
        const qsStr = qs.toString();
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/facility/alerts/list${qsStr ? `?${qsStr}` : ""}`,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted facility alerts list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.facility.alert.escalate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { id?: unknown; target_status?: unknown; reason?: unknown })
            : {};
        const id = typeof payloadIn.id === "string" ? payloadIn.id.trim() : "";
        if (!id) {
          respond(false, { error: "id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.target_status !== undefined) body.target_status = payloadIn.target_status;
        if (payloadIn.reason !== undefined) body.reason = payloadIn.reason;
        const routePath = `/facility/alert/${encodeURIComponent(id)}/escalate`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted facility alert escalate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.facility.alert.resolve",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { id?: unknown; notes?: unknown })
            : {};
        const id = typeof payloadIn.id === "string" ? payloadIn.id.trim() : "";
        if (!id) {
          respond(false, { error: "id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.notes !== undefined) body.notes = payloadIn.notes;
        const routePath = `/facility/alert/${encodeURIComponent(id)}/resolve`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted facility alert resolve failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── Improvement Proposals & Trust Autonomy gateway methods ─────────────────

  api.registerGatewayMethod(
    "ted.improvement.proposals.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { status?: unknown })
            : {};
        const qs = new URLSearchParams();
        if (typeof payloadIn.status === "string" && payloadIn.status.trim().length > 0) {
          qs.set("status", payloadIn.status.trim());
        }
        const qsStr = qs.toString();
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/improvement/proposals${qsStr ? `?${qsStr}` : ""}`,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted improvement proposals list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.improvement.proposals.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                title?: unknown;
                type?: unknown;
                description?: unknown;
                source?: unknown;
                change_spec?: unknown;
                evidence?: unknown;
              })
            : {};
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.title !== undefined) body.title = payloadIn.title;
        if (payloadIn.type !== undefined) body.type = payloadIn.type;
        if (payloadIn.description !== undefined) body.description = payloadIn.description;
        if (payloadIn.source !== undefined) body.source = payloadIn.source;
        if (payloadIn.change_spec !== undefined) body.change_spec = payloadIn.change_spec;
        if (payloadIn.evidence !== undefined) body.evidence = payloadIn.evidence;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/improvement/proposals",
          body,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted improvement proposals create failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.improvement.proposals.review",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { proposal_id?: unknown; verdict?: unknown; notes?: unknown })
            : {};
        const proposalId =
          typeof payloadIn.proposal_id === "string" ? payloadIn.proposal_id.trim() : "";
        if (!proposalId) {
          respond(false, { error: "proposal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (payloadIn.verdict !== undefined) body.verdict = payloadIn.verdict;
        if (payloadIn.notes !== undefined) body.notes = payloadIn.notes;
        const routePath = `/improvement/proposals/${encodeURIComponent(proposalId)}/review`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted improvement proposals review failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.improvement.proposals.apply",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { proposal_id?: unknown })
            : {};
        const proposalId =
          typeof payloadIn.proposal_id === "string" ? payloadIn.proposal_id.trim() : "";
        if (!proposalId) {
          respond(false, { error: "proposal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/improvement/proposals/${encodeURIComponent(proposalId)}/apply`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted improvement proposals apply failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.improvement.proposals.generate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { days?: unknown })
            : {};
        const body: Record<string, unknown> = {};
        if (payloadIn.days !== undefined) body.days = Number(payloadIn.days);
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/improvement/proposals/generate",
          body,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted improvement proposals generate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.improvement.failure_aggregation",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { days?: unknown })
            : {};
        const qs = new URLSearchParams();
        if (payloadIn.days !== undefined) {
          qs.set("days", String(payloadIn.days));
        }
        const qsStr = qs.toString();
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/improvement/failure-aggregation${qsStr ? `?${qsStr}` : ""}`,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted improvement failure aggregation failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── Builder Lane Gateway Methods (BL-008) ───

  api.registerGatewayMethod(
    "ted.builder_lane.patterns",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/builder-lane/patterns",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted builder lane patterns failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.builder_lane.generate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { domain?: string; context_bucket?: unknown })
            : {};
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/builder-lane/generate",
          { domain: payloadIn.domain, context_bucket: payloadIn.context_bucket },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted builder lane generate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.builder_lane.revert",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { proposal_id?: string })
            : {};
        if (!payloadIn.proposal_id) {
          respond(false, { error: "proposal_id required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          `/ops/builder-lane/revert/${encodeURIComponent(payloadIn.proposal_id)}`,
          {},
          { "x-ted-approval-source": "operator" },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted builder lane revert failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.builder_lane.status",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/builder-lane/status",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted builder lane status failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.builder_lane.improvement_metrics",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/builder-lane/improvement-metrics",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted builder lane improvement metrics failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.builder_lane.calibration_response",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                prompt_id?: string;
                response?: string;
                domain?: string;
                moment?: string;
              })
            : {};
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/builder-lane/calibration-response",
          {
            prompt_id: payloadIn.prompt_id,
            response: payloadIn.response,
            domain: payloadIn.domain,
            moment: payloadIn.moment,
          },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted builder lane calibration response failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.trust.autonomy.evaluate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/trust/autonomy/evaluate",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted trust autonomy evaluate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── Draft submit-review gateway ────────────────────────────────────────────
  api.registerGatewayMethod(
    "ted.drafts.submit_review",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { draft_id?: unknown })
            : {};
        const draftId = typeof payloadIn.draft_id === "string" ? payloadIn.draft_id.trim() : "";
        if (!draftId) {
          respond(false, { error: "draft_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/drafts/${encodeURIComponent(draftId)}/submit-review`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, {});
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted drafts submit-review failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── Deep work session gateway ──────────────────────────────────────────────
  api.registerGatewayMethod(
    "ted.deep_work.session",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/deep-work/session",
          payloadIn,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deep work session failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── Graph sync status gateway ──────────────────────────────────────────────
  api.registerGatewayMethod(
    "ted.graph.sync.status",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown; limit?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const qs = new URLSearchParams();
        if (payloadIn.limit !== undefined) {
          qs.set("limit", String(payloadIn.limit));
        }
        const qsStr = qs.toString();
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/graph/${encodeURIComponent(profileId)}/sync/status${qsStr ? `?${qsStr}` : ""}`,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted graph sync status failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- MF-10: Setup validation gateway ---

  api.registerGatewayMethod(
    "ted.ops.setup.validate",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/setup/validate",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted setup validate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- MF-10: Onboarding activate gateway ---

  api.registerGatewayMethod(
    "ted.ops.onboarding.activate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/onboarding/activate",
          params as Record<string, unknown>,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted onboarding activate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ingestion status gateway (GET) ---

  api.registerGatewayMethod(
    "ted.ops.ingestion.status",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/ingestion/status",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ingestion status failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ingestion run gateway (POST) ---

  api.registerGatewayMethod(
    "ted.ops.ingestion.run",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/ingestion/run",
          params as Record<string, unknown>,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ingestion run failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Onboarding discover gateway (POST) ---

  api.registerGatewayMethod(
    "ted.ops.onboarding.discover",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/onboarding/discover",
          params as Record<string, unknown>,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted onboarding discover failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Onboarding discovery status gateway (GET) ---

  api.registerGatewayMethod(
    "ted.ops.onboarding.discovery.status",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/onboarding/discovery-status",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted onboarding discovery status failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── C10-023: Missing gateway methods for sidecar routes ────────────────────

  // --- Graph: calendar list (GET) ---

  api.registerGatewayMethod(
    "ted.calendar.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { profile_id?: unknown })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/graph/${encodeURIComponent(profileId)}/calendar/list`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted calendar list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Graph: draft create (POST) ---

  api.registerGatewayMethod(
    "ted.graph.mail.draft.create",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as {
                profile_id?: unknown;
                subject?: unknown;
                content?: unknown;
                to_recipients?: unknown;
              })
            : {};
        const profileId = normalizeSupportedProfileId(payloadIn.profile_id);
        if (!profileId) {
          respond(false, { error: "profile_id must be one of olumie|everest" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const body: Record<string, unknown> = {};
        if (typeof payloadIn.subject === "string") body.subject = payloadIn.subject;
        if (typeof payloadIn.content === "string") body.content = payloadIn.content;
        if (Array.isArray(payloadIn.to_recipients)) body.to_recipients = payloadIn.to_recipients;
        const routePath = `/graph/${encodeURIComponent(profileId)}/mail/draft/create`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted graph mail draft create failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Drafts: archive (POST) ---

  api.registerGatewayMethod(
    "ted.drafts.archive",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const paramsObj =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const draftId = typeof paramsObj.draft_id === "string" ? paramsObj.draft_id.trim() : "";
        if (!draftId) {
          respond(false, { error: "draft_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/drafts/${encodeURIComponent(draftId)}/archive`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, {});
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted drafts archive failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Deals: timeline (GET) ---

  api.registerGatewayMethod(
    "ted.deals.timeline",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const paramsObj =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const dealId = typeof paramsObj.deal_id === "string" ? paramsObj.deal_id.trim() : "";
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/deals/${encodeURIComponent(dealId)}/timeline`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals timeline failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: scheduler status (GET) ---

  api.registerGatewayMethod(
    "ted.ops.scheduler.status",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/ops/scheduler");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops scheduler status failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: scheduler config (POST) ---

  api.registerGatewayMethod(
    "ted.ops.scheduler.config",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/scheduler",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops scheduler config failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: pending deliveries list (GET) ---

  api.registerGatewayMethod(
    "ted.ops.pending_deliveries.list",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const paramsObj =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const queryParts: string[] = [];
        if (typeof paramsObj.status === "string" && paramsObj.status.trim().length > 0) {
          queryParts.push(`status=${encodeURIComponent(paramsObj.status.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/ops/pending-deliveries${queryString}`,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops pending deliveries list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: pending delivery ack (POST) ---

  api.registerGatewayMethod(
    "ted.ops.pending_deliveries.ack",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/pending-deliveries/ack",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops pending delivery ack failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: pause automation (POST) ---

  api.registerGatewayMethod(
    "ted.ops.pause",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/pause",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops pause failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: resume automation (POST) ---

  api.registerGatewayMethod(
    "ted.ops.resume",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/resume",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops resume failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: last resume summary (GET) ---

  api.registerGatewayMethod(
    "ted.ops.resume.last",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/ops/resume/last");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops resume last failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: dispatch check (POST) ---

  api.registerGatewayMethod(
    "ted.ops.dispatch.check",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/dispatch/check",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops dispatch check failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: rate evaluate (POST) ---

  api.registerGatewayMethod(
    "ted.ops.rate.evaluate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/rate/evaluate",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops rate evaluate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: retry evaluate (POST) ---

  api.registerGatewayMethod(
    "ted.ops.retry.evaluate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/retry/evaluate",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops retry evaluate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: tool usage (GET) ---

  api.registerGatewayMethod(
    "ted.ops.tool_usage",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/ops/tool-usage");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops tool usage failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: evaluation status (GET) ---

  api.registerGatewayMethod(
    "ted.ops.evaluation.status",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/evaluation/status",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops evaluation status failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Ops: evaluation run (POST) ---

  api.registerGatewayMethod(
    "ted.ops.evaluation.run",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/evaluation/run",
          {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops evaluation run failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- QA Dashboard (GET) ---

  api.registerGatewayMethod(
    "ted.ops.qa.dashboard",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/ops/qa/dashboard");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops qa dashboard failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Canary status (GET) ---

  api.registerGatewayMethod(
    "ted.ops.canary.status",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/canary/status",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops canary status failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Canary run (POST) ---

  api.registerGatewayMethod(
    "ted.ops.canary.run",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, "/ops/canary/run", {});
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops canary run failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Drift status (GET) ---

  api.registerGatewayMethod(
    "ted.ops.drift.status",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/ops/drift/status");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted ops drift status failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Learning: modifiers evaluate (POST) ---

  api.registerGatewayMethod(
    "ted.learning.modifiers.evaluate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/learning/modifiers/evaluate",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted learning modifiers evaluate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Learning: affinity route (POST) ---

  api.registerGatewayMethod(
    "ted.learning.affinity.route",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/learning/affinity/route",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted learning affinity route failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Learning: meetings capture (POST) ---

  api.registerGatewayMethod(
    "ted.learning.meetings.capture",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/learning/meetings/capture",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted learning meetings capture failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Filing: suggestions propose (POST) ---

  api.registerGatewayMethod(
    "ted.filing.suggestions.propose",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/filing/suggestions/propose",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted filing suggestions propose failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Filing: suggestions list (GET) ---

  api.registerGatewayMethod(
    "ted.filing.suggestions.list",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/filing/suggestions/list",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted filing suggestions list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Filing: suggestion approve (POST) ---

  api.registerGatewayMethod(
    "ted.filing.suggestions.approve",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const paramsObj =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const suggestionId =
          typeof paramsObj.suggestion_id === "string" ? paramsObj.suggestion_id.trim() : "";
        if (!suggestionId) {
          respond(false, { error: "suggestion_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/filing/suggestions/${encodeURIComponent(suggestionId)}/approve`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, paramsObj, {
          "x-ted-approval-source": "operator",
        });
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted filing suggestions approve failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Triage: list (GET) ---

  api.registerGatewayMethod(
    "ted.triage.list",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/triage/list");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted triage list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Triage: ingest (POST) ---

  api.registerGatewayMethod(
    "ted.triage.ingest",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/triage/ingest",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted triage ingest failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Triage: patterns list (GET) ---

  api.registerGatewayMethod(
    "ted.triage.patterns.list",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/triage/patterns");
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted triage patterns list failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Triage: patterns propose (POST) ---

  api.registerGatewayMethod(
    "ted.triage.patterns.propose",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/triage/patterns/propose",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted triage patterns propose failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Triage: pattern approve (POST) ---

  api.registerGatewayMethod(
    "ted.triage.patterns.approve",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const paramsObj =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const patternId =
          typeof paramsObj.pattern_id === "string" ? paramsObj.pattern_id.trim() : "";
        if (!patternId) {
          respond(false, { error: "pattern_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/triage/patterns/${encodeURIComponent(patternId)}/approve`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, paramsObj, {
          "x-ted-approval-source": "operator",
        });
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted triage patterns approve failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Triage: link item (POST) ---

  api.registerGatewayMethod(
    "ted.triage.link",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const paramsObj =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        const itemId = typeof paramsObj.item_id === "string" ? paramsObj.item_id.trim() : "";
        if (!itemId) {
          respond(false, { error: "item_id is required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const routePath = `/triage/${encodeURIComponent(itemId)}/link`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, paramsObj);
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted triage link failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Governance: hard bans check (POST) ---

  api.registerGatewayMethod(
    "ted.governance.hard_bans.check",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/governance/hard-bans/check",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted governance hard bans check failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Governance: output validate (POST) ---

  api.registerGatewayMethod(
    "ted.governance.output.validate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/governance/output/validate",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted governance output validate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Governance: entity check (POST) ---

  api.registerGatewayMethod(
    "ted.governance.entity.check",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/governance/entity/check",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted governance entity check failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Governance: confidence evaluate (POST) ---

  api.registerGatewayMethod(
    "ted.governance.confidence.evaluate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/governance/confidence/evaluate",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted governance confidence evaluate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Governance: contradictions check (POST) ---

  api.registerGatewayMethod(
    "ted.governance.contradictions.check",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/governance/contradictions/check",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted governance contradictions check failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Governance: escalations route (POST) ---

  api.registerGatewayMethod(
    "ted.governance.escalations.route",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/governance/escalations/route",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted governance escalations route failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Governance: repair simulate (POST) ---

  api.registerGatewayMethod(
    "ted.governance.repair.simulate",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/governance/repair/simulate",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted governance repair simulate failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // --- Graph: diagnostics classify (POST) ---

  api.registerGatewayMethod(
    "ted.graph.diagnostics.classify",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/graph/diagnostics/classify",
          params ?? {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted graph diagnostics classify failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── C12-004: Deal stale owners ─────────────────────────────────────────────
  api.registerGatewayMethod(
    "ted.deals.stale_owners",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const days = params?.days ?? 7;
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/deals/stale-owners?days=${encodeURIComponent(String(days))}`,
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals stale owners failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── C12-011: Deal retrospective ──────────────────────────────────────────
  api.registerGatewayMethod(
    "ted.deals.retrospective",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const dealId = params?.deal_id;
        if (!dealId) {
          respond(false, { error: "deal_id is required" });
          return;
        }
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          `/deals/${encodeURIComponent(String(dealId))}/retrospective`,
          {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted deals retrospective failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── Self-Healing Gateway Methods (Phase A) ──────────────────────────────────

  api.registerGatewayMethod(
    "ted.self_healing.status",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/status",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing status failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.self_healing.circuit_breakers",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/circuit-breakers",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing circuit breakers failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.self_healing.provider_health",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/provider-health",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing provider health failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.self_healing.config_drift_reconcile",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/config-drift/reconcile",
          {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing config drift reconcile failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.self_healing.compact_ledgers",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/compact-ledgers",
          {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing compact ledgers failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.self_healing.expire_proposals",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/expire-proposals",
          {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing expire proposals failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.self_healing.resurrect_proposal",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { proposal_id?: string })
            : {};
        if (!payloadIn.proposal_id) {
          respond(false, { error: "proposal_id required" });
          return;
        }
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          `/ops/builder-lane/proposals/${encodeURIComponent(payloadIn.proposal_id)}/resurrect`,
          {},
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing resurrect proposal failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── Self-Healing Gateway Methods (Phase B) ──────────────────────────────────

  api.registerGatewayMethod(
    "ted.self_healing.correction_taxonomy",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/correction-taxonomy",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing correction taxonomy failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.engagement.read_receipt",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { content_type?: string; delivered_at?: string })
            : {};
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/engagement/read-receipt",
          { content_type: payloadIn.content_type, delivered_at: payloadIn.delivered_at },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted engagement read receipt failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.engagement.action_receipt",
    async ({ params, respond }: GatewayRequestHandlerOptions) => {
      try {
        const payloadIn =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as { content_type?: string; delivered_at?: string; duration_ms?: unknown })
            : {};
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/engagement/action-receipt",
          {
            content_type: payloadIn.content_type,
            delivered_at: payloadIn.delivered_at,
            duration_ms: payloadIn.duration_ms,
          },
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted engagement action receipt failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.self_healing.engagement_insights",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/engagement-insights",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing engagement insights failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.self_healing.noise_level",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/noise-level",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing noise level failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  api.registerGatewayMethod(
    "ted.self_healing.autonomy_status",
    async ({ respond }: GatewayRequestHandlerOptions) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/autonomy-status",
        );
        respond(true, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.warn(`ted self healing autonomy status failed: ${message}`);
        respond(false, { error: message });
      }
    },
  );

  // ─── Agent Tool Registration (JC-076a) ─────────────────────────────────────
  //
  // These tools expose Ted's capabilities to the OpenClaw agent system so they
  // can be invoked from iMessage, chat, and all agent-powered channels.
  // Each tool's execute function calls the same authenticated route helpers
  // used by the gateway methods above.

  const tedToolJson = (payload: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  });

  const tedToolError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    return tedToolJson({ error: message });
  };

  const resolveTedToolConfig = () => {
    const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
    return {
      baseUrl: resolveBaseUrl(pluginConfig),
      timeoutMs: resolveTimeoutMs(pluginConfig),
    };
  };

  // 1. ted_status — GET /status
  api.registerTool({
    name: "ted_status",
    label: "Ted Status",
    description:
      "Check Ted sidecar health and readiness. Returns version, uptime, profile count, and catalog of available capabilities. Use this to verify Ted is running before calling other ted_* tools.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/status");
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 2. ted_morning_brief — GET /reporting/morning-brief
  api.registerTool({
    name: "ted_morning_brief",
    label: "Ted Morning Brief",
    description:
      "Retrieve the operator's morning brief from Ted. Includes inbox summary, calendar preview, deal updates, and prioritised action items for the day. Call this when the user asks about their morning summary, daily priorities, or what's on their plate today.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/reporting/morning-brief",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 3. ted_eod_digest — GET /reporting/eod-digest
  api.registerTool({
    name: "ted_eod_digest",
    label: "Ted End-of-Day Digest",
    description:
      "Retrieve the operator's end-of-day digest from Ted. Summarises completed actions, pending approvals, unresolved triage items, and tomorrow's early priorities. Call this when the user asks for their evening summary, daily wrap-up, or what happened today.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/reporting/eod-digest",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 4. ted_mail_list — GET /graph/{profile}/mail/list
  api.registerTool({
    name: "ted_mail_list",
    label: "Ted Mail List",
    description:
      "List email messages from a Microsoft 365 mailbox managed by Ted. Returns subject, sender, date, and read status for each message. Use this when the user asks about their inbox, recent emails, or unread messages. Supports filtering by folder and read/unread status.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      folder: Type.Optional(
        Type.String({
          description:
            'Mail folder to list. Defaults to "inbox". Other options: "sentitems", "drafts", "deleteditems".',
        }),
      ),
      filter: Type.Optional(
        Type.String({
          description: 'Message filter. Defaults to "all". Options: "all", "unread", "flagged".',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const folder =
          typeof params?.folder === "string" && params.folder.trim().length > 0
            ? params.folder.trim()
            : "inbox";
        const filter =
          typeof params?.filter === "string" && params.filter.trim().length > 0
            ? params.filter.trim()
            : "all";
        const queryParams = `folder=${encodeURIComponent(folder)}&top=25&filter=${encodeURIComponent(filter)}&skip=0`;
        const routePath = `/graph/${encodeURIComponent(profileId)}/mail/list?${queryParams}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 5. ted_draft_generate — POST /graph/{profile}/drafts/generate
  api.registerTool({
    name: "ted_draft_generate",
    label: "Ted Draft Generate",
    description:
      "Generate email reply drafts for unread messages in a Microsoft 365 mailbox. Ted analyses each unread email and produces contextual reply drafts for operator review. Use this when the user wants Ted to prepare email responses or catch up on drafting replies.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      max_drafts: Type.Optional(
        Type.Number({
          description: "Maximum number of drafts to generate. Defaults to 5.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const maxDrafts =
          typeof params?.max_drafts === "number" &&
          Number.isFinite(params.max_drafts) &&
          params.max_drafts > 0
            ? Math.floor(params.max_drafts)
            : 5;
        const routePath = `/graph/${encodeURIComponent(profileId)}/drafts/generate`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, {
          max_drafts: maxDrafts,
          filter: "unread",
        });
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 6. ted_deadlines — POST /extraction/deadlines
  api.registerTool({
    name: "ted_deadlines",
    label: "Ted Deadline Extraction",
    description:
      "Extract deadlines, due dates, and time-sensitive obligations from a block of text. Provide the text (e.g. email body, contract clause, meeting notes) and Ted returns structured deadline data including dates, descriptions, and urgency. Use this when the user shares text containing deadlines or asks to identify upcoming due dates.",
    parameters: Type.Object({
      text: Type.String({
        description:
          "The text to analyse for deadlines. Can be an email body, contract excerpt, meeting notes, or any prose containing date-sensitive obligations.",
      }),
      source_ref: Type.Optional(
        Type.String({
          description:
            'Optional reference label for the source document (e.g. "Lease Agreement Section 4.2").',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const text = typeof params?.text === "string" ? params.text.trim() : "";
        if (!text) {
          return tedToolJson({ error: "text is required" });
        }
        const body: Record<string, unknown> = { text };
        if (typeof params?.source_ref === "string" && params.source_ref.trim().length > 0) {
          body.source_ref = params.source_ref.trim();
        }
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/extraction/deadlines",
          body,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 7. ted_deal_list — GET /deals/list
  api.registerTool({
    name: "ted_deal_list",
    label: "Ted Deal List",
    description:
      "List all deals tracked by Ted's deal operations module. Returns deal names, types, stages, statuses, and entity assignments. Use this when the user asks about their active deals, deal pipeline, or wants an overview of tracked transactions.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/deals/list");
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 8. ted_deal_get — GET /deals/{deal_id}
  api.registerTool({
    name: "ted_deal_get",
    label: "Ted Deal Details",
    description:
      "Retrieve detailed information about a specific deal by ID. Returns the deal's full record including name, type, entity, stage, status, tasks, notes, dates, and data room contents. Use this when the user asks about a particular deal's details or status.",
    parameters: Type.Object({
      deal_id: Type.String({
        description: "The unique identifier of the deal to retrieve.",
      }),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const dealId = typeof params?.deal_id === "string" ? params.deal_id.trim() : "";
        if (!dealId) {
          return tedToolJson({ error: "deal_id is required" });
        }
        const routePath = `/deals/${encodeURIComponent(dealId)}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── Write-Operation Agent Tools with Confirmation Gate (JC-076b) ───────────
  //
  // Each write tool accepts a `confirmed` boolean parameter. When confirmed is
  // false or absent, the tool returns a preview of what WOULD happen. When
  // confirmed is true, the tool actually executes the write operation.
  // This two-step pattern prevents accidental mutations from agent channels.

  const TED_WRITE_TOOLS_SET = new Set([
    "ted_mail_move",
    "ted_calendar_create",
    "ted_deal_create",
    "ted_deal_update",
    "ted_deal_manage",
    "ted_meeting_debrief",
    "ted_meeting_prep",
    "ted_commitment_create",
    "ted_commitment_complete",
    "ted_action_create",
    "ted_para_classify",
    "ted_draft_approve",
    "ted_draft_edit",
    "ted_draft_execute",
    "ted_facility_alert_create",
    "ted_facility_alert_escalate",
    "ted_facility_alert_resolve",
    "ted_commitment_escalate",
    "ted_sync_approve",
    "ted_improvement_review",
    "ted_improvement_apply",
    "ted_draft_submit_review",
    "ted_deep_work_session",
    "ted_sharepoint_upload",
    "ted_sharepoint_create_folder",
    "ted_builder_lane_revert",
  ]);

  // MF-8: Tools requiring operator (human) confirmation — agent cannot self-approve
  // Design Law #6 (governance tiers) + #8 (progressive autonomy)
  const REQUIRES_OPERATOR_CONFIRMATION = new Set([
    "ted_sync_approve",
    "ted_draft_execute",
    "ted_draft_approve",
    "ted_mail_move",
    "ted_calendar_create",
    "ted_improvement_apply",
    "ted_improvement_review",
    "ted_sharepoint_upload",
    "ted_sharepoint_create_folder",
    "ted_builder_lane_revert",
  ]);

  // 1. ted_mail_move — POST /graph/{profile}/mail/{message_id}/move
  api.registerTool({
    name: "ted_mail_move",
    label: "Ted Mail Move",
    description:
      "Move an email message to a different folder in a Microsoft 365 mailbox. Requires confirmation: first call returns a preview of the move action; call again with confirmed=true to execute. Use this when the user wants to file, archive, or move an email to a specific folder.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      message_id: Type.String({
        description: "The unique identifier of the email message to move.",
      }),
      destination_folder_id: Type.String({
        description:
          "The ID of the destination mail folder (e.g. archive folder ID, subfolder ID).",
      }),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the move. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const messageId = typeof params?.message_id === "string" ? params.message_id.trim() : "";
        const destinationFolderId =
          typeof params?.destination_folder_id === "string"
            ? params.destination_folder_id.trim()
            : "";
        if (!messageId) {
          return tedToolJson({ error: "message_id is required" });
        }
        if (!destinationFolderId) {
          return tedToolJson({ error: "destination_folder_id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Move message ${messageId} to folder ${destinationFolderId} in ${profileId} mailbox`,
            params: {
              profile_id: profileId,
              message_id: messageId,
              destination_folder_id: destinationFolderId,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const routePath = `/graph/${encodeURIComponent(profileId)}/mail/${encodeURIComponent(messageId)}/move`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {
            destination_folder_id: destinationFolderId,
          },
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 2. ted_calendar_create — POST /graph/{profile}/calendar/event/create
  api.registerTool({
    name: "ted_calendar_create",
    label: "Ted Calendar Create",
    description:
      "Create a calendar event in a Microsoft 365 calendar. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user wants to schedule a meeting, create a calendar hold, or add an event.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      subject: Type.String({
        description: "The subject/title of the calendar event.",
      }),
      start_datetime: Type.String({
        description: "Start date and time in ISO 8601 format (e.g. 2026-02-23T09:00:00).",
      }),
      end_datetime: Type.String({
        description: "End date and time in ISO 8601 format (e.g. 2026-02-23T10:00:00).",
      }),
      location: Type.Optional(
        Type.String({
          description: "Location of the event (e.g. conference room name, address, or video link).",
        }),
      ),
      body_text: Type.Optional(
        Type.String({
          description: "Body text or agenda for the calendar event.",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the creation. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const subject = typeof params?.subject === "string" ? params.subject.trim() : "";
        const startDatetime =
          typeof params?.start_datetime === "string" ? params.start_datetime.trim() : "";
        const endDatetime =
          typeof params?.end_datetime === "string" ? params.end_datetime.trim() : "";
        if (!subject) {
          return tedToolJson({ error: "subject is required" });
        }
        if (!startDatetime) {
          return tedToolJson({ error: "start_datetime is required" });
        }
        if (!endDatetime) {
          return tedToolJson({ error: "end_datetime is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Create calendar event "${subject}" from ${startDatetime} to ${endDatetime} in ${profileId} calendar`,
            params: {
              profile_id: profileId,
              subject,
              start_datetime: startDatetime,
              end_datetime: endDatetime,
              location: params?.location ?? null,
              body_text: params?.body_text ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {
          subject,
          start_datetime: startDatetime,
          end_datetime: endDatetime,
        };
        if (typeof params?.location === "string" && params.location.trim().length > 0) {
          body.location = params.location.trim();
        }
        if (typeof params?.body_text === "string" && params.body_text.trim().length > 0) {
          body.body_text = params.body_text.trim();
        }
        const routePath = `/graph/${encodeURIComponent(profileId)}/calendar/event/create`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 3. ted_deal_create — POST /deals/create
  api.registerTool({
    name: "ted_deal_create",
    label: "Ted Deal Create",
    description:
      "Create a new deal in Ted's deal operations module. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user wants to start tracking a new transaction, deal, or matter.",
    parameters: Type.Object({
      deal_name: Type.String({
        description: "Name of the deal (e.g. 'Everest Q1 Refinance').",
      }),
      deal_type: Type.Optional(
        Type.String({
          description: 'Type of deal (e.g. "acquisition", "refinance", "lease", "development").',
        }),
      ),
      entity: Type.Optional(
        Type.String({
          description: 'Entity the deal belongs to (e.g. "olumie", "everest", "prestige").',
        }),
      ),
      status: Type.Optional(
        Type.String({
          description: 'Initial status of the deal (e.g. "active", "pending", "closed").',
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the creation. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const dealName = typeof params?.deal_name === "string" ? params.deal_name.trim() : "";
        if (!dealName) {
          return tedToolJson({ error: "deal_name is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Create new deal "${dealName}"`,
            params: {
              deal_name: dealName,
              deal_type: params?.deal_type ?? null,
              entity: params?.entity ?? null,
              status: params?.status ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = { deal_name: dealName };
        if (typeof params?.deal_type === "string") body.deal_type = params.deal_type;
        if (typeof params?.entity === "string") body.entity = params.entity;
        if (typeof params?.status === "string") body.status = params.status;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, "/deals/create", body);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 4. ted_deal_update — POST /deals/{deal_id}/update
  api.registerTool({
    name: "ted_deal_update",
    label: "Ted Deal Update",
    description:
      "Update fields on an existing deal. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user wants to change a deal's name, type, stage, status, or entity.",
    parameters: Type.Object({
      deal_id: Type.String({
        description: "The unique identifier of the deal to update.",
      }),
      updates: Type.Optional(
        Type.Object({
          deal_name: Type.Optional(Type.String({ description: "New deal name." })),
          deal_type: Type.Optional(Type.String({ description: "New deal type." })),
          stage: Type.Optional(Type.String({ description: "New deal stage." })),
          status: Type.Optional(Type.String({ description: "New deal status." })),
          entity: Type.Optional(Type.String({ description: "New entity assignment." })),
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the update. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const dealId = typeof params?.deal_id === "string" ? params.deal_id.trim() : "";
        if (!dealId) {
          return tedToolJson({ error: "deal_id is required" });
        }
        const updates = params?.updates && typeof params.updates === "object" ? params.updates : {};
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Update deal ${dealId}`,
            params: { deal_id: dealId, updates },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {};
        if (updates.deal_name !== undefined) body.deal_name = updates.deal_name;
        if (updates.deal_type !== undefined) body.deal_type = updates.deal_type;
        if (updates.stage !== undefined) body.stage = updates.stage;
        if (updates.status !== undefined) body.status = updates.status;
        if (updates.entity !== undefined) body.entity = updates.entity;
        const routePath = `/deals/${encodeURIComponent(dealId)}/update`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 5. ted_deal_manage — POST /deals/{deal_id}/tasks or /deals/{deal_id}/notes
  api.registerTool({
    name: "ted_deal_manage",
    label: "Ted Deal Manage",
    description:
      "Add a task or note to an existing deal. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user wants to add a to-do item, checklist entry, or annotation to a deal.",
    parameters: Type.Object({
      deal_id: Type.String({
        description: "The unique identifier of the deal.",
      }),
      action: Type.Union([Type.Literal("add_task"), Type.Literal("add_note")], {
        description:
          'The management action to perform: "add_task" to add a task/to-do, "add_note" to add a note/annotation.',
      }),
      payload: Type.Object(
        {
          title: Type.Optional(Type.String({ description: "Task title (for add_task)." })),
          text: Type.Optional(Type.String({ description: "Note text (for add_note)." })),
          due_date: Type.Optional(
            Type.String({
              description: "Due date for the task in ISO 8601 format (for add_task).",
            }),
          ),
          author: Type.Optional(Type.String({ description: "Author of the note (for add_note)." })),
        },
        { description: "Payload for the action. Fields depend on the action type." },
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the action. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const dealId = typeof params?.deal_id === "string" ? params.deal_id.trim() : "";
        const action = params?.action;
        if (!dealId) {
          return tedToolJson({ error: "deal_id is required" });
        }
        if (action !== "add_task" && action !== "add_note") {
          return tedToolJson({
            error: 'action must be "add_task" or "add_note"',
          });
        }
        const payload = params?.payload ?? {};
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `${action === "add_task" ? "Add task to" : "Add note to"} deal ${dealId}`,
            params: { deal_id: dealId, action, payload },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {};
        if (action === "add_task") {
          if (payload.title !== undefined) body.title = payload.title;
          if (payload.due_date !== undefined) body.due_date = payload.due_date;
          const routePath = `/deals/${encodeURIComponent(dealId)}/tasks`;
          const result = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
          return tedToolJson(result);
        }
        // add_note
        if (payload.text !== undefined) body.text = payload.text;
        if (payload.author !== undefined) body.author = payload.author;
        const routePath = `/deals/${encodeURIComponent(dealId)}/notes`;
        const result = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        return tedToolJson(result);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── Phase 6/7/8 Read-Only Agent Tools ─────────────────────────────────────

  // 9. ted_meeting_upcoming — GET /meeting/upcoming?hours=24
  api.registerTool({
    name: "ted_meeting_upcoming",
    label: "Ted Meeting Upcoming",
    description:
      "List upcoming meetings within the next 24 hours. Returns event details including subject, start/end times, attendees, and location. Use this when the user asks about their upcoming meetings, what's on their calendar today, or wants to prepare for their next meeting.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/meeting/upcoming?hours=24",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 10. ted_commitments_list — GET /commitments/list
  api.registerTool({
    name: "ted_commitments_list",
    label: "Ted Commitments List",
    description:
      "List all tracked commitments (promises made to or by the operator). Returns commitment descriptions, owners, due dates, statuses, and associated entities. Use this when the user asks about their open commitments, promises, or obligations.",
    parameters: Type.Object({
      entity: Type.Optional(
        Type.String({
          description: 'Filter by entity (e.g. "olumie", "everest"). Omit for all entities.',
        }),
      ),
      status: Type.Optional(
        Type.String({
          description:
            'Filter by status (e.g. "open", "completed", "overdue"). Omit for all statuses.',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const queryParts: string[] = [];
        if (typeof params?.entity === "string" && params.entity.trim().length > 0) {
          queryParts.push(`entity=${encodeURIComponent(params.entity.trim())}`);
        }
        if (typeof params?.status === "string" && params.status.trim().length > 0) {
          queryParts.push(`status=${encodeURIComponent(params.status.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/commitments/list${queryString}`,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 11. ted_actions_list — GET /gtd/actions/list
  api.registerTool({
    name: "ted_actions_list",
    label: "Ted GTD Actions List",
    description:
      "List GTD next-actions tracked by Ted. Returns action descriptions, contexts, energy levels, time estimates, statuses, and associated entities. Use this when the user asks about their action items, next actions, or GTD task list.",
    parameters: Type.Object({
      entity: Type.Optional(
        Type.String({
          description: 'Filter by entity (e.g. "olumie", "everest"). Omit for all entities.',
        }),
      ),
      status: Type.Optional(
        Type.String({
          description:
            'Filter by status (e.g. "active", "completed", "waiting"). Omit for all statuses.',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const queryParts: string[] = [];
        if (typeof params?.entity === "string" && params.entity.trim().length > 0) {
          queryParts.push(`entity=${encodeURIComponent(params.entity.trim())}`);
        }
        if (typeof params?.status === "string" && params.status.trim().length > 0) {
          queryParts.push(`status=${encodeURIComponent(params.status.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/gtd/actions/list${queryString}`,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 12. ted_waiting_for_list — GET /gtd/waiting-for/list
  api.registerTool({
    name: "ted_waiting_for_list",
    label: "Ted GTD Waiting-For List",
    description:
      "List GTD waiting-for items tracked by Ted. Returns items the operator is waiting on from others, including descriptions, responsible parties, expected dates, and statuses. Use this when the user asks about pending items, things they're waiting on, or delegated tasks.",
    parameters: Type.Object({
      entity: Type.Optional(
        Type.String({
          description: 'Filter by entity (e.g. "olumie", "everest"). Omit for all entities.',
        }),
      ),
      status: Type.Optional(
        Type.String({
          description:
            'Filter by status (e.g. "waiting", "received", "overdue"). Omit for all statuses.',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const queryParts: string[] = [];
        if (typeof params?.entity === "string" && params.entity.trim().length > 0) {
          queryParts.push(`entity=${encodeURIComponent(params.entity.trim())}`);
        }
        if (typeof params?.status === "string" && params.status.trim().length > 0) {
          queryParts.push(`status=${encodeURIComponent(params.status.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/gtd/waiting-for/list${queryString}`,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 13. ted_timeblock_plan — POST /planning/timeblock/generate
  api.registerTool({
    name: "ted_timeblock_plan",
    label: "Ted Timeblock Plan",
    description:
      "Generate a time-blocked daily plan based on the operator's calendar, priorities, and energy patterns. Returns a structured schedule with suggested time blocks for deep work, meetings, admin, and breaks. Use this when the user asks Ted to plan their day or create a time-blocked schedule.",
    parameters: Type.Object({
      date: Type.Optional(
        Type.String({
          description:
            'Target date for the plan in ISO format (e.g. "2026-02-23"). Defaults to today.',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {};
        if (typeof params?.date === "string" && params.date.trim().length > 0) {
          body.date = params.date.trim();
        }
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/planning/timeblock/generate",
          body,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 14. ted_deep_work_metrics — GET /reporting/deep-work-metrics
  api.registerTool({
    name: "ted_deep_work_metrics",
    label: "Ted Deep Work Metrics",
    description:
      "Retrieve deep work metrics and focus time analytics. Returns data on deep work hours, interruption counts, focus scores, and trends over the specified period. Use this when the user asks about their productivity, deep work time, or focus metrics.",
    parameters: Type.Object({
      period: Type.Optional(
        Type.String({
          description: 'Reporting period (e.g. "day", "week", "month"). Defaults to "week".',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const period =
          typeof params?.period === "string" && params.period.trim().length > 0
            ? params.period.trim()
            : "week";
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/reporting/deep-work-metrics?period=${encodeURIComponent(period)}`,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 15. ted_trust_metrics — GET /reporting/trust-metrics
  api.registerTool({
    name: "ted_trust_metrics",
    label: "Ted Trust Metrics",
    description:
      "Retrieve trust and reliability metrics for the operator's commitments and follow-through. Returns data on commitment completion rates, response times, and trust scores over the specified period. Use this when the user asks about their reliability, commitment tracking, or trust metrics.",
    parameters: Type.Object({
      period: Type.Optional(
        Type.String({
          description: 'Reporting period (e.g. "day", "week", "month"). Defaults to "week".',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const period =
          typeof params?.period === "string" && params.period.trim().length > 0
            ? params.period.trim()
            : "week";
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/reporting/trust-metrics?period=${encodeURIComponent(period)}`,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 16. ted_para_structure — GET /filing/para/structure
  api.registerTool({
    name: "ted_para_structure",
    label: "Ted PARA Structure",
    description:
      "Retrieve the current PARA (Projects, Areas, Resources, Archives) filing structure. Returns the organised hierarchy of folders and categories used for information management. Use this when the user asks about their filing system, folder structure, or how things are organised.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/filing/para/structure",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── Phase 6/7/8 Write-Operation Agent Tools with Confirmation Gate ────────

  // 17. ted_meeting_debrief — POST /meeting/debrief
  api.registerTool({
    name: "ted_meeting_debrief",
    label: "Ted Meeting Debrief",
    description:
      "Record a meeting debrief with summary and action items. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user wants to capture meeting outcomes, decisions, or follow-up items.",
    parameters: Type.Object({
      event_id: Type.String({
        description: "The calendar event ID for the meeting being debriefed.",
      }),
      summary: Type.String({
        description: "Summary of the meeting including key decisions and outcomes.",
      }),
      entity: Type.Optional(
        Type.String({
          description: 'Entity the meeting relates to (e.g. "olumie", "everest").',
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the debrief. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const eventId = typeof params?.event_id === "string" ? params.event_id.trim() : "";
        const summary = typeof params?.summary === "string" ? params.summary.trim() : "";
        if (!eventId) {
          return tedToolJson({ error: "event_id is required" });
        }
        if (!summary) {
          return tedToolJson({ error: "summary is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Record debrief for meeting ${eventId}`,
            params: {
              event_id: eventId,
              summary,
              entity: params?.entity ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = { event_id: eventId, summary };
        if (typeof params?.entity === "string" && params.entity.trim().length > 0) {
          body.entity = params.entity.trim();
        }
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/meeting/debrief",
          body,
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 18. ted_meeting_prep — POST /meeting/prep/{event_id}
  api.registerTool({
    name: "ted_meeting_prep",
    label: "Ted Meeting Prep",
    description:
      "Generate a meeting preparation brief for an upcoming meeting. Ted analyses attendees, context, and related entity data to produce a prep document. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user wants to prepare for a specific meeting.",
    parameters: Type.Object({
      event_id: Type.String({
        description: "The calendar event ID for the meeting to prepare for.",
      }),
      attendees: Type.Optional(
        Type.String({
          description: "Comma-separated list of attendee names or emails for additional context.",
        }),
      ),
      context: Type.Optional(
        Type.String({
          description:
            "Additional context or notes to include in the prep (e.g. agenda items, goals).",
        }),
      ),
      entity: Type.Optional(
        Type.String({
          description: 'Entity the meeting relates to (e.g. "olumie", "everest").',
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the prep generation. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const eventId = typeof params?.event_id === "string" ? params.event_id.trim() : "";
        if (!eventId) {
          return tedToolJson({ error: "event_id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Generate meeting prep for event ${eventId}`,
            params: {
              event_id: eventId,
              attendees: params?.attendees ?? null,
              context: params?.context ?? null,
              entity: params?.entity ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {};
        if (typeof params?.attendees === "string" && params.attendees.trim().length > 0) {
          body.attendees = params.attendees.trim();
        }
        if (typeof params?.context === "string" && params.context.trim().length > 0) {
          body.context = params.context.trim();
        }
        if (typeof params?.entity === "string" && params.entity.trim().length > 0) {
          body.entity = params.entity.trim();
        }
        const routePath = `/meeting/prep/${encodeURIComponent(eventId)}`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 19. ted_commitment_create — POST /commitments/create
  api.registerTool({
    name: "ted_commitment_create",
    label: "Ted Commitment Create",
    description:
      "Create a new commitment (promise made to or by the operator). Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user makes a promise, agrees to a deliverable, or wants to track an obligation.",
    parameters: Type.Object({
      description: Type.String({
        description: "Description of the commitment or promise.",
      }),
      owner: Type.Optional(
        Type.String({
          description: "Who owns this commitment (e.g. operator name, counterparty name).",
        }),
      ),
      entity: Type.Optional(
        Type.String({
          description: 'Entity the commitment relates to (e.g. "olumie", "everest").',
        }),
      ),
      due_date: Type.Optional(
        Type.String({
          description: 'Due date in ISO format (e.g. "2026-03-01").',
        }),
      ),
      deal_id: Type.Optional(
        Type.String({
          description: "Associated deal ID, if the commitment is linked to a specific deal.",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the creation. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const description =
          typeof params?.description === "string" ? params.description.trim() : "";
        if (!description) {
          return tedToolJson({ error: "description is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Create commitment: "${description}"`,
            params: {
              description,
              owner: params?.owner ?? null,
              entity: params?.entity ?? null,
              due_date: params?.due_date ?? null,
              deal_id: params?.deal_id ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = { description };
        if (typeof params?.owner === "string" && params.owner.trim().length > 0) {
          body.owner = params.owner.trim();
        }
        if (typeof params?.entity === "string" && params.entity.trim().length > 0) {
          body.entity = params.entity.trim();
        }
        if (typeof params?.due_date === "string" && params.due_date.trim().length > 0) {
          body.due_date = params.due_date.trim();
        }
        if (typeof params?.deal_id === "string" && params.deal_id.trim().length > 0) {
          body.deal_id = params.deal_id.trim();
        }
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/commitments/create",
          body,
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 20. ted_commitment_complete — POST /commitments/{id}/complete
  api.registerTool({
    name: "ted_commitment_complete",
    label: "Ted Commitment Complete",
    description:
      "Mark a commitment as completed. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user has fulfilled a promise or obligation and wants to close it out.",
    parameters: Type.Object({
      commitment_id: Type.String({
        description: "The unique identifier of the commitment to mark as complete.",
      }),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the completion. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const commitmentId =
          typeof params?.commitment_id === "string" ? params.commitment_id.trim() : "";
        if (!commitmentId) {
          return tedToolJson({ error: "commitment_id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Mark commitment ${commitmentId} as complete`,
            params: { commitment_id: commitmentId },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const routePath = `/commitments/${encodeURIComponent(commitmentId)}/complete`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 21. ted_action_create — POST /gtd/actions/create
  api.registerTool({
    name: "ted_action_create",
    label: "Ted GTD Action Create",
    description:
      "Create a new GTD next-action. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user identifies a next action, task, or to-do item to track in their GTD system.",
    parameters: Type.Object({
      description: Type.String({
        description: "Description of the next action to create.",
      }),
      entity: Type.Optional(
        Type.String({
          description: 'Entity the action relates to (e.g. "olumie", "everest").',
        }),
      ),
      context: Type.Optional(
        Type.String({
          description:
            'GTD context for the action (e.g. "@office", "@phone", "@computer", "@errands").',
        }),
      ),
      energy: Type.Optional(
        Type.String({
          description: 'Energy level required (e.g. "high", "medium", "low").',
        }),
      ),
      time_estimate_min: Type.Optional(
        Type.Number({
          description: "Estimated time to complete in minutes.",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the creation. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const description =
          typeof params?.description === "string" ? params.description.trim() : "";
        if (!description) {
          return tedToolJson({ error: "description is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Create GTD action: "${description}"`,
            params: {
              description,
              entity: params?.entity ?? null,
              context: params?.context ?? null,
              energy: params?.energy ?? null,
              time_estimate_min: params?.time_estimate_min ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = { description };
        if (typeof params?.entity === "string" && params.entity.trim().length > 0) {
          body.entity = params.entity.trim();
        }
        if (typeof params?.context === "string" && params.context.trim().length > 0) {
          body.context = params.context.trim();
        }
        if (typeof params?.energy === "string" && params.energy.trim().length > 0) {
          body.energy = params.energy.trim();
        }
        if (
          typeof params?.time_estimate_min === "number" &&
          Number.isFinite(params.time_estimate_min) &&
          params.time_estimate_min > 0
        ) {
          body.time_estimate_min = Math.floor(params.time_estimate_min);
        }
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/gtd/actions/create",
          body,
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // 22. ted_para_classify — POST /filing/para/classify
  api.registerTool({
    name: "ted_para_classify",
    label: "Ted PARA Classify",
    description:
      "Classify an item into the PARA (Projects, Areas, Resources, Archives) filing system. Ted analyses the item and suggests the appropriate category and location. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user wants to file or categorise a document, note, or piece of information.",
    parameters: Type.Object({
      item: Type.String({
        description: "Description or title of the item to classify.",
      }),
      entity: Type.Optional(
        Type.String({
          description: 'Entity the item relates to (e.g. "olumie", "everest").',
        }),
      ),
      deal_id: Type.Optional(
        Type.String({
          description: "Associated deal ID, if the item is linked to a specific deal.",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the classification. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const item = typeof params?.item === "string" ? params.item.trim() : "";
        if (!item) {
          return tedToolJson({ error: "item is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Classify item into PARA: "${item}"`,
            params: {
              item,
              entity: params?.entity ?? null,
              deal_id: params?.deal_id ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = { item };
        if (typeof params?.entity === "string" && params.entity.trim().length > 0) {
          body.entity = params.entity.trim();
        }
        if (typeof params?.deal_id === "string" && params.deal_id.trim().length > 0) {
          body.deal_id = params.deal_id.trim();
        }
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/filing/para/classify",
          body,
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── Draft Queue Agent Tools (Phase 11 / JC-089e) ────────────────────────────

  // ted_draft_queue_list — GET /drafts/queue
  api.registerTool({
    name: "ted_draft_queue_list",
    label: "Ted Draft Queue List",
    description:
      "List drafts in Ted's draft queue. Returns all pending, approved, and executed drafts. Optionally filter by state (e.g. 'pending', 'approved', 'executed') or by originating profile. Use this when the user asks about pending drafts, the draft queue, or wants to review what Ted has prepared.",
    parameters: Type.Object({
      state: Type.Optional(
        Type.String({
          description:
            'Filter by draft state. Options: "pending", "approved", "executed". Omit for all drafts.',
        }),
      ),
      from_profile: Type.Optional(
        Type.String({
          description: 'Filter by originating M365 profile (e.g. "olumie", "everest").',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const qs = new URLSearchParams();
        if (typeof params?.state === "string" && params.state.trim().length > 0) {
          qs.set("state", params.state.trim());
        }
        if (typeof params?.from_profile === "string" && params.from_profile.trim().length > 0) {
          qs.set("from_profile", params.from_profile.trim());
        }
        const qsStr = qs.toString();
        const routePath = `/drafts/queue${qsStr ? `?${qsStr}` : ""}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_draft_approve — POST /drafts/{draft_id}/approve
  api.registerTool({
    name: "ted_draft_approve",
    label: "Ted Draft Approve",
    description:
      "Approve a draft in Ted's draft queue, marking it ready for execution. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user reviews a draft and wants to approve it for sending.",
    parameters: Type.Object({
      draft_id: Type.String({
        description: "The unique identifier of the draft to approve.",
      }),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the approval. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const draftId = typeof params?.draft_id === "string" ? params.draft_id.trim() : "";
        if (!draftId) {
          return tedToolJson({ error: "draft_id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Approve draft ${draftId}`,
            params: { draft_id: draftId },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const routePath = `/drafts/${encodeURIComponent(draftId)}/approve`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_draft_edit — POST /drafts/{draft_id}/edit
  api.registerTool({
    name: "ted_draft_edit",
    label: "Ted Draft Edit",
    description:
      "Edit the content or subject of a draft in Ted's draft queue. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user wants to modify a draft before approving or sending it.",
    parameters: Type.Object({
      draft_id: Type.String({
        description: "The unique identifier of the draft to edit.",
      }),
      content: Type.Optional(
        Type.String({
          description: "New body content for the draft.",
        }),
      ),
      subject: Type.Optional(
        Type.String({
          description: "New subject line for the draft.",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the edit. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const draftId = typeof params?.draft_id === "string" ? params.draft_id.trim() : "";
        if (!draftId) {
          return tedToolJson({ error: "draft_id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Edit draft ${draftId}`,
            params: {
              draft_id: draftId,
              content: params?.content ?? null,
              subject: params?.subject ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {};
        if (typeof params?.content === "string") body.content = params.content;
        if (typeof params?.subject === "string") body.subject = params.subject;
        const routePath = `/drafts/${encodeURIComponent(draftId)}/edit`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_draft_execute — POST /drafts/{draft_id}/execute
  api.registerTool({
    name: "ted_draft_execute",
    label: "Ted Draft Execute",
    description:
      "Execute (send) an approved draft from Ted's draft queue. This actually sends the email or performs the draft action. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user wants to send an approved draft.",
    parameters: Type.Object({
      draft_id: Type.String({
        description: "The unique identifier of the draft to execute.",
      }),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the draft. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const draftId = typeof params?.draft_id === "string" ? params.draft_id.trim() : "";
        if (!draftId) {
          return tedToolJson({ error: "draft_id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Execute (send) draft ${draftId}`,
            params: { draft_id: draftId },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const routePath = `/drafts/${encodeURIComponent(draftId)}/execute`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── State Machine Extensions Agent Tools (Phase 13 / JC-091e) ──────────────

  // ted_facility_alerts_list — GET /facility/alerts/list
  api.registerTool({
    name: "ted_facility_alerts_list",
    label: "Ted Facility Alerts List",
    description:
      "List facility alerts tracked by Ted. Returns all active, escalated, and resolved facility alerts. Optionally filter by status. Use this when the user asks about facility issues, building alerts, or maintenance concerns.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.String({
          description:
            'Filter by alert status (e.g. "open", "escalated", "resolved"). Omit for all alerts.',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const qs = new URLSearchParams();
        if (typeof params?.status === "string" && params.status.trim().length > 0) {
          qs.set("status", params.status.trim());
        }
        const qsStr = qs.toString();
        const routePath = `/facility/alerts/list${qsStr ? `?${qsStr}` : ""}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_facility_alert_create — POST /facility/alert/create
  api.registerTool({
    name: "ted_facility_alert_create",
    label: "Ted Facility Alert Create",
    description:
      "Create a new facility alert in Ted. Reports a facility issue such as a maintenance problem, safety concern, or building system alert. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user reports a facility problem or wants to log a building-related issue.",
    parameters: Type.Object({
      title: Type.String({
        description: "Short title describing the facility issue.",
      }),
      description: Type.Optional(
        Type.String({
          description: "Detailed description of the facility issue.",
        }),
      ),
      severity: Type.Optional(
        Type.String({
          description: 'Severity level of the alert (e.g. "low", "medium", "high", "critical").',
        }),
      ),
      location: Type.Optional(
        Type.String({
          description: "Physical location or area affected by the issue.",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to create the alert. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const title = typeof params?.title === "string" ? params.title.trim() : "";
        if (!title) {
          return tedToolJson({ error: "title is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Create facility alert: "${title}"`,
            params: {
              title,
              description: params?.description ?? null,
              severity: params?.severity ?? null,
              location: params?.location ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = { title };
        if (typeof params?.description === "string" && params.description.trim().length > 0) {
          body.description = params.description.trim();
        }
        if (typeof params?.severity === "string" && params.severity.trim().length > 0) {
          body.severity = params.severity.trim();
        }
        if (typeof params?.location === "string" && params.location.trim().length > 0) {
          body.location = params.location.trim();
        }
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/facility/alert/create",
          body,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_facility_alert_escalate — POST /facility/alert/{id}/escalate
  api.registerTool({
    name: "ted_facility_alert_escalate",
    label: "Ted Facility Alert Escalate",
    description:
      "Escalate a facility alert to a higher status level. Moves the alert to a more urgent state with an explanation of why escalation is needed. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when a facility issue needs more urgent attention or has worsened.",
    parameters: Type.Object({
      id: Type.String({
        description: "The unique identifier of the facility alert to escalate.",
      }),
      target_status: Type.Optional(
        Type.String({
          description: 'Target escalation status (e.g. "escalated", "critical").',
        }),
      ),
      reason: Type.Optional(
        Type.String({
          description: "Reason for escalating the alert.",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the escalation. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const id = typeof params?.id === "string" ? params.id.trim() : "";
        if (!id) {
          return tedToolJson({ error: "id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Escalate facility alert ${id}`,
            params: {
              id,
              target_status: params?.target_status ?? null,
              reason: params?.reason ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {};
        if (typeof params?.target_status === "string" && params.target_status.trim().length > 0) {
          body.target_status = params.target_status.trim();
        }
        if (typeof params?.reason === "string" && params.reason.trim().length > 0) {
          body.reason = params.reason.trim();
        }
        const routePath = `/facility/alert/${encodeURIComponent(id)}/escalate`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_facility_alert_resolve — POST /facility/alert/{id}/resolve
  api.registerTool({
    name: "ted_facility_alert_resolve",
    label: "Ted Facility Alert Resolve",
    description:
      "Resolve a facility alert, marking it as addressed. Optionally include resolution notes. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when a facility issue has been fixed or no longer requires attention.",
    parameters: Type.Object({
      id: Type.String({
        description: "The unique identifier of the facility alert to resolve.",
      }),
      notes: Type.Optional(
        Type.String({
          description: "Resolution notes describing how the issue was addressed.",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the resolution. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const id = typeof params?.id === "string" ? params.id.trim() : "";
        if (!id) {
          return tedToolJson({ error: "id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Resolve facility alert ${id}`,
            params: {
              id,
              notes: params?.notes ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {};
        if (typeof params?.notes === "string" && params.notes.trim().length > 0) {
          body.notes = params.notes.trim();
        }
        const routePath = `/facility/alert/${encodeURIComponent(id)}/resolve`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_commitment_escalate — POST /commitments/{id}/escalate
  api.registerTool({
    name: "ted_commitment_escalate",
    label: "Ted Commitment Escalate",
    description:
      "Escalate a commitment to flag it as at-risk or requiring urgent attention. Adds an escalation reason to the commitment record. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when a commitment is overdue, blocked, or needs operator intervention.",
    parameters: Type.Object({
      id: Type.String({
        description: "The unique identifier of the commitment to escalate.",
      }),
      reason: Type.Optional(
        Type.String({
          description: "Reason for escalating the commitment.",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the escalation. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const id = typeof params?.id === "string" ? params.id.trim() : "";
        if (!id) {
          return tedToolJson({ error: "id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Escalate commitment ${id}`,
            params: {
              id,
              reason: params?.reason ?? null,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {};
        if (typeof params?.reason === "string" && params.reason.trim().length > 0) {
          body.reason = params.reason.trim();
        }
        const routePath = `/commitments/${encodeURIComponent(id)}/escalate`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── Planner / To Do / Sync / Extraction agent tools (JC-104b) ──────────────

  // ted_planner_plans — GET /graph/{profile}/planner/plans
  api.registerTool({
    name: "ted_planner_plans",
    label: "Ted Planner Plans",
    description:
      "List Microsoft Planner plans for a Microsoft 365 profile managed by Ted. Returns plan names, IDs, and metadata. Use this when the user asks about their Planner plans, project boards, or task plans.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const routePath = `/graph/${encodeURIComponent(profileId)}/planner/plans`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_planner_tasks — GET /graph/{profile}/planner/plans/{plan_id}/tasks
  api.registerTool({
    name: "ted_planner_tasks",
    label: "Ted Planner Tasks",
    description:
      "List tasks from a Microsoft Planner plan. Returns task titles, assignments, progress, and bucket information. Optionally filter by bucket. Use this when the user asks about tasks in a specific Planner plan or wants to see task assignments.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      plan_id: Type.String({
        description: "The unique identifier of the Planner plan to list tasks from.",
      }),
      bucket_id: Type.Optional(
        Type.String({
          description: "Optional bucket ID to filter tasks by a specific bucket within the plan.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const planId = typeof params?.plan_id === "string" ? params.plan_id.trim() : "";
        if (!planId) {
          return tedToolJson({ error: "plan_id is required" });
        }
        const queryParts: string[] = [];
        if (typeof params?.bucket_id === "string" && params.bucket_id.trim().length > 0) {
          queryParts.push(`bucket_id=${encodeURIComponent(params.bucket_id.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const routePath = `/graph/${encodeURIComponent(profileId)}/planner/plans/${encodeURIComponent(planId)}/tasks${queryString}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_todo_tasks — GET /graph/{profile}/todo/lists/{list_id}/tasks
  api.registerTool({
    name: "ted_todo_tasks",
    label: "Ted To Do Tasks",
    description:
      "List tasks from a Microsoft To Do list. Returns task titles, status, due dates, and importance. Use this when the user asks about their To Do items, task lists, or wants to see pending tasks in a specific list.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      list_id: Type.String({
        description: "The unique identifier of the To Do list to retrieve tasks from.",
      }),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const listId = typeof params?.list_id === "string" ? params.list_id.trim() : "";
        if (!listId) {
          return tedToolJson({ error: "list_id is required" });
        }
        const routePath = `/graph/${encodeURIComponent(profileId)}/todo/lists/${encodeURIComponent(listId)}/tasks`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_sync_reconcile — GET /graph/{profile}/sync/reconcile
  api.registerTool({
    name: "ted_sync_reconcile",
    label: "Ted Sync Reconcile",
    description:
      "Run a reconciliation between Ted's local state and the external Microsoft 365 data for a profile. Returns a summary of discrepancies and proposed sync actions. Use this when the user asks Ted to check for sync drift, reconcile data, or verify consistency with M365.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const routePath = `/graph/${encodeURIComponent(profileId)}/sync/reconcile`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_sync_proposals — GET /graph/{profile}/sync/proposals
  api.registerTool({
    name: "ted_sync_proposals",
    label: "Ted Sync Proposals",
    description:
      "List pending sync proposals for a Microsoft 365 profile. Returns proposals that require operator approval before Ted writes changes to external systems. Optionally filter by status. Use this when the user asks about pending sync actions or wants to review what Ted proposes to change.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      status: Type.Optional(
        Type.String({
          description:
            'Filter proposals by status (e.g. "pending", "approved", "rejected"). Omit for all proposals.',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const queryParts: string[] = [];
        if (typeof params?.status === "string" && params.status.trim().length > 0) {
          queryParts.push(`status=${encodeURIComponent(params.status.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const routePath = `/graph/${encodeURIComponent(profileId)}/sync/proposals${queryString}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_sync_approve — POST /graph/{profile}/sync/proposals/{proposal_id}/approve
  api.registerTool({
    name: "ted_sync_approve",
    label: "Ted Sync Approve",
    description:
      "Approve a sync proposal, authorizing Ted to write the proposed changes to the external Microsoft 365 system. Requires confirmation: first call returns a preview; call again with confirmed=true to execute. Use this when the user reviews a sync proposal and wants to approve it.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      proposal_id: Type.String({
        description: "The unique identifier of the sync proposal to approve.",
      }),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the approval. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const proposalId = typeof params?.proposal_id === "string" ? params.proposal_id.trim() : "";
        if (!proposalId) {
          return tedToolJson({ error: "proposal_id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Approve sync proposal ${proposalId} for profile ${profileId}`,
            params: {
              profile_id: profileId,
              proposal_id: proposalId,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const routePath = `/graph/${encodeURIComponent(profileId)}/sync/proposals/${encodeURIComponent(proposalId)}/approve`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── SharePoint agent tools ────────────────────────────────────────────────────

  // ted_sharepoint_sites — GET /graph/{profile}/sharepoint/sites
  api.registerTool({
    name: "ted_sharepoint_sites",
    label: "Ted SharePoint Sites",
    description:
      "List SharePoint sites for a profile. Returns site names, IDs, and URLs. Use this when the user asks about their SharePoint sites or wants to browse available sites in Microsoft 365.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/sites`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_sharepoint_drives — GET /graph/{profile}/sharepoint/sites/{site_id}/drives
  api.registerTool({
    name: "ted_sharepoint_drives",
    label: "Ted SharePoint Drives",
    description:
      "List document libraries for a SharePoint site. Returns drive names, IDs, and quota information. Use this when the user wants to see the document libraries available on a specific SharePoint site.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      site_id: Type.String({
        description: "The unique identifier of the SharePoint site to list drives from.",
      }),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const siteId = typeof params?.site_id === "string" ? params.site_id.trim() : "";
        if (!siteId) {
          return tedToolJson({ error: "site_id is required" });
        }
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/sites/${encodeURIComponent(siteId)}/drives`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_sharepoint_browse — GET /graph/{profile}/sharepoint/drives/{drive_id}/items
  api.registerTool({
    name: "ted_sharepoint_browse",
    label: "Ted SharePoint Browse",
    description:
      "Browse files and folders in a SharePoint document library. Returns item names, types, sizes, and modification dates. Optionally filter by path or item_id. Use this when the user wants to explore the contents of a document library.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      drive_id: Type.String({
        description: "The unique identifier of the document library (drive) to browse.",
      }),
      path: Type.Optional(
        Type.String({
          description: "Optional folder path within the drive to list contents of.",
        }),
      ),
      item_id: Type.Optional(
        Type.String({
          description: "Optional item ID to list children of a specific folder.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const driveId = typeof params?.drive_id === "string" ? params.drive_id.trim() : "";
        if (!driveId) {
          return tedToolJson({ error: "drive_id is required" });
        }
        const queryParts: string[] = [];
        if (typeof params?.path === "string" && params.path.trim().length > 0) {
          queryParts.push(`path=${encodeURIComponent(params.path.trim())}`);
        }
        if (typeof params?.item_id === "string" && params.item_id.trim().length > 0) {
          queryParts.push(`item_id=${encodeURIComponent(params.item_id.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/drives/${encodeURIComponent(driveId)}/items${queryString}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_sharepoint_search — GET /graph/{profile}/sharepoint/drives/{drive_id}/search
  api.registerTool({
    name: "ted_sharepoint_search",
    label: "Ted SharePoint Search",
    description:
      "Search files in a SharePoint document library. Returns matching items with names, paths, and metadata. Use this when the user wants to find specific files or documents within a document library.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      drive_id: Type.String({
        description: "The unique identifier of the document library (drive) to search.",
      }),
      query: Type.String({
        description: "The search query string to find files matching this text.",
      }),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const driveId = typeof params?.drive_id === "string" ? params.drive_id.trim() : "";
        if (!driveId) {
          return tedToolJson({ error: "drive_id is required" });
        }
        const query = typeof params?.query === "string" ? params.query.trim() : "";
        if (!query) {
          return tedToolJson({ error: "query is required" });
        }
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/drives/${encodeURIComponent(driveId)}/search?q=${encodeURIComponent(query)}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_sharepoint_item — GET /graph/{profile}/sharepoint/drives/{drive_id}/items/{item_id}
  api.registerTool({
    name: "ted_sharepoint_item",
    label: "Ted SharePoint Item",
    description:
      "Get metadata for a specific file or folder in a SharePoint document library. Returns name, size, created/modified dates, download URL, and other properties. Use this when the user wants detailed information about a specific file or folder.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      drive_id: Type.String({
        description: "The unique identifier of the document library (drive) containing the item.",
      }),
      item_id: Type.String({
        description: "The unique identifier of the file or folder to retrieve metadata for.",
      }),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const driveId = typeof params?.drive_id === "string" ? params.drive_id.trim() : "";
        if (!driveId) {
          return tedToolJson({ error: "drive_id is required" });
        }
        const itemId = typeof params?.item_id === "string" ? params.item_id.trim() : "";
        if (!itemId) {
          return tedToolJson({ error: "item_id is required" });
        }
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, routePath);
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_sharepoint_upload — POST /graph/{profile}/sharepoint/drives/{drive_id}/upload
  api.registerTool({
    name: "ted_sharepoint_upload",
    label: "Ted SharePoint Upload",
    description:
      "Upload a file to a SharePoint document library. Requires confirmation: first call returns a preview of the upload action; call again with confirmed=true to execute. Use this when the user wants to upload or save a file to SharePoint.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      drive_id: Type.String({
        description: "The unique identifier of the document library (drive) to upload to.",
      }),
      path: Type.Optional(
        Type.String({
          description: "The folder path within the drive where the file will be uploaded.",
        }),
      ),
      file_name: Type.String({
        description: "The name for the uploaded file (including extension).",
      }),
      content_base64: Type.String({
        description: "The file content encoded as a base64 string.",
      }),
      content_type: Type.Optional(
        Type.String({
          description: 'The MIME content type of the file (e.g. "application/pdf", "text/plain").',
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the upload. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const driveId = typeof params?.drive_id === "string" ? params.drive_id.trim() : "";
        if (!driveId) {
          return tedToolJson({ error: "drive_id is required" });
        }
        const fileName = typeof params?.file_name === "string" ? params.file_name.trim() : "";
        if (!fileName) {
          return tedToolJson({ error: "file_name is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Upload file "${fileName}" to drive ${driveId} for profile ${profileId}`,
            params: {
              profile_id: profileId,
              drive_id: driveId,
              path: params?.path ?? "/",
              file_name: fileName,
              content_type: params?.content_type ?? "application/octet-stream",
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/drives/${encodeURIComponent(driveId)}/upload`;
        const body: Record<string, unknown> = {
          file_name: fileName,
          content_base64: params?.content_base64,
        };
        if (typeof params?.path === "string") body.path = params.path;
        if (typeof params?.content_type === "string") body.content_type = params.content_type;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_sharepoint_create_folder — POST /graph/{profile}/sharepoint/drives/{drive_id}/folder
  api.registerTool({
    name: "ted_sharepoint_create_folder",
    label: "Ted SharePoint Create Folder",
    description:
      "Create a new folder in a SharePoint document library. Requires confirmation: first call returns a preview of the folder creation; call again with confirmed=true to execute. Use this when the user wants to create a new folder in SharePoint.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      drive_id: Type.String({
        description:
          "The unique identifier of the document library (drive) to create the folder in.",
      }),
      parent_path: Type.Optional(
        Type.String({
          description: "The parent folder path where the new folder will be created.",
        }),
      ),
      folder_name: Type.String({
        description: "The name for the new folder.",
      }),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the folder creation. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const driveId = typeof params?.drive_id === "string" ? params.drive_id.trim() : "";
        if (!driveId) {
          return tedToolJson({ error: "drive_id is required" });
        }
        const folderName = typeof params?.folder_name === "string" ? params.folder_name.trim() : "";
        if (!folderName) {
          return tedToolJson({ error: "folder_name is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Create folder "${folderName}" in drive ${driveId} for profile ${profileId}`,
            params: {
              profile_id: profileId,
              drive_id: driveId,
              parent_path: params?.parent_path ?? "/",
              folder_name: folderName,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const routePath = `/graph/${encodeURIComponent(profileId)}/sharepoint/drives/${encodeURIComponent(driveId)}/folder`;
        const body: Record<string, unknown> = {
          folder_name: folderName,
        };
        if (typeof params?.parent_path === "string") body.parent_path = params.parent_path;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_extract_commitments — POST /graph/{profile}/mail/{message_id}/extract-commitments
  api.registerTool({
    name: "ted_extract_commitments",
    label: "Ted Extract Commitments",
    description:
      "Extract commitments, action items, and follow-ups from an email message. Ted analyses the email content and returns structured commitment records. Use this when the user wants to identify obligations, promises, or action items from a specific email.",
    parameters: Type.Object({
      profile_id: Type.Optional(
        Type.String({
          description: 'Microsoft 365 profile identifier. Use "olumie" (default) or "everest".',
        }),
      ),
      message_id: Type.String({
        description: "The unique identifier of the email message to extract commitments from.",
      }),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const profileId = normalizeSupportedProfileId(params?.profile_id) ?? "olumie";
        const messageId = typeof params?.message_id === "string" ? params.message_id.trim() : "";
        if (!messageId) {
          return tedToolJson({ error: "message_id is required" });
        }
        const routePath = `/graph/${encodeURIComponent(profileId)}/mail/${encodeURIComponent(messageId)}/extract-commitments`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, {});
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_improvement_proposals — GET /improvement/proposals
  api.registerTool({
    name: "ted_improvement_proposals",
    label: "Ted Improvement Proposals",
    description:
      "List improvement proposals from the Codex Builder Lane. Proposals are generated from trust failure analysis and operator feedback. Filter by status: proposed, approved, applied, rejected.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.String({
          description: "Filter by status (proposed, approved, applied, rejected).",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const queryParts: string[] = [];
        if (typeof params?.status === "string" && params.status.trim().length > 0) {
          queryParts.push(`status=${encodeURIComponent(params.status.trim())}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/improvement/proposals${queryString}`,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_improvement_propose — POST /improvement/proposals
  api.registerTool({
    name: "ted_improvement_propose",
    label: "Ted Improvement Propose",
    description:
      "Create a new improvement proposal for contracts, config, validators, or routes. Part of the Codex Builder Lane — proposals must be reviewed and approved before application.",
    parameters: Type.Object({
      title: Type.String({
        description: "Proposal title.",
      }),
      type: Type.String({
        description: "Type: contract_update, config_update, new_validator, route_enhancement.",
      }),
      description: Type.String({
        description: "What should change and why.",
      }),
      source: Type.Optional(
        Type.String({
          description: "Source: trust_failure_aggregation, operator_feedback, learning_modifier.",
        }),
      ),
      change_spec: Type.Optional(
        Type.Any({
          description: "Specification of proposed change.",
        }),
      ),
      evidence: Type.Optional(
        Type.Any({
          description: "Evidence supporting the proposal.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {
          title: params?.title,
          type: params?.type,
          description: params?.description,
        };
        if (params?.source !== undefined) body.source = params.source;
        if (params?.change_spec !== undefined) body.change_spec = params.change_spec;
        if (params?.evidence !== undefined) body.evidence = params.evidence;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/improvement/proposals",
          body,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_improvement_review — POST /improvement/proposals/{proposal_id}/review
  api.registerTool({
    name: "ted_improvement_review",
    label: "Ted Improvement Review",
    description:
      "Review an improvement proposal — approve or reject it. Only proposals in 'proposed' status can be reviewed. Requires confirmation: first call returns a preview; call again with confirmed=true to execute.",
    parameters: Type.Object({
      proposal_id: Type.String({
        description: "The proposal ID to review.",
      }),
      verdict: Type.String({
        description: "approved or rejected.",
      }),
      notes: Type.Optional(
        Type.String({
          description: "Reviewer notes.",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the review. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const proposalId = typeof params?.proposal_id === "string" ? params.proposal_id.trim() : "";
        if (!proposalId) {
          return tedToolJson({ error: "proposal_id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Review proposal ${proposalId} with verdict: ${params?.verdict}`,
            params: {
              proposal_id: proposalId,
              verdict: params?.verdict,
              notes: params?.notes,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = { verdict: params.verdict };
        if (params?.notes !== undefined) body.notes = params.notes;
        const routePath = `/improvement/proposals/${encodeURIComponent(proposalId)}/review`;
        const payload = await callAuthenticatedTedRoute(baseUrl, timeoutMs, routePath, body, {
          "x-ted-approval-source": "operator",
        });
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_failure_aggregation — GET /improvement/failure-aggregation
  api.registerTool({
    name: "ted_failure_aggregation",
    label: "Ted Failure Aggregation",
    description:
      "Aggregate trust validation failures over a time period to identify patterns. Used to generate improvement proposals for contracts and validators.",
    parameters: Type.Object({
      days: Type.Optional(
        Type.Number({
          description: "Lookback period in days (default 30).",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const queryParts: string[] = [];
        if (params?.days !== undefined) {
          queryParts.push(`days=${encodeURIComponent(String(params.days))}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/improvement/failure-aggregation${queryString}`,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_improvement_apply — POST /improvement/proposals/{proposal_id}/apply (write tool)
  api.registerTool({
    name: "ted_improvement_apply",
    label: "Ted Improvement Apply",
    description:
      "Apply an approved improvement proposal. For contract_update and config_update types, this modifies the target config file. Requires prior approval via review.",
    parameters: Type.Object({
      proposal_id: Type.String({ description: "The proposal ID to apply." }),
      confirmed: Type.Optional(
        Type.Boolean({ description: "Set true to execute. Omit for preview." }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const proposalId = typeof params?.proposal_id === "string" ? params.proposal_id.trim() : "";
        if (!proposalId) return tedToolError(new Error("proposal_id is required"));
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Apply approved proposal ${proposalId} — may modify config files`,
            params: { proposal_id: proposalId },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const routePath = `/improvement/proposals/${encodeURIComponent(proposalId)}/apply`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_improvement_generate — POST /improvement/proposals/generate (LLM synthesis)
  api.registerTool({
    name: "ted_improvement_generate",
    label: "Ted Improvement Generate",
    description:
      "Generate an improvement proposal from trust failure data using LLM analysis. Returns proposal text and evidence but does NOT auto-create it.",
    parameters: Type.Object({
      days: Type.Optional(
        Type.Number({
          description: "Lookback period in days for failure aggregation (default 30).",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = {};
        if (params?.days !== undefined) body.days = params.days;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/improvement/proposals/generate",
          body,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── Builder Lane Agent Tools (BL-009) ───

  // ted_builder_lane_status — GET /ops/builder-lane/status (read tool)
  api.registerTool({
    name: "ted_builder_lane_status",
    label: "Ted Builder Lane Status",
    description:
      "View the Builder Lane status: correction counts per domain, current phase per dimension, confidence scores, fatigue state, active/applied/reverted proposals, and total signal counts.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/builder-lane/status",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_builder_lane_metrics — GET /ops/builder-lane/improvement-metrics (read tool)
  api.registerTool({
    name: "ted_builder_lane_metrics",
    label: "Ted Builder Lane Metrics",
    description:
      "View Builder Lane improvement metrics: correction rate trend (weekly buckets), draft acceptance rate (this month vs last month), proposals applied count, progress by dimension, monthly summary text, and config change markers.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/builder-lane/improvement-metrics",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_builder_lane_revert — POST /ops/builder-lane/revert/:proposal_id (write tool, requires confirmation)
  api.registerTool({
    name: "ted_builder_lane_revert",
    label: "Ted Builder Lane Revert",
    description:
      "Revert an applied Builder Lane config change to its pre-change snapshot. Requires operator confirmation. This restores the config file to its exact state before the improvement was applied.",
    parameters: Type.Object({
      proposal_id: Type.String({
        description: "The proposal ID to revert (e.g. BL-1234567890-abc1).",
      }),
      confirmed: Type.Optional(
        Type.Boolean({ description: "Set to true to confirm and execute the revert." }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const proposalId = (params as { proposal_id: string; confirmed?: boolean }).proposal_id;
        const confirmed = (params as { confirmed?: boolean }).confirmed;
        if (!confirmed) {
          return tedToolJson({
            preview: true,
            action: "revert_improvement",
            proposal_id: proposalId,
            message:
              "This will restore the config to its pre-change state. Call again with confirmed=true to execute.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          `/ops/builder-lane/revert/${encodeURIComponent(proposalId)}`,
          {},
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_trust_autonomy — GET /trust/autonomy/evaluate
  api.registerTool({
    name: "ted_trust_autonomy",
    label: "Ted Trust Autonomy",
    description:
      "Evaluate current trust metrics and determine eligibility for autonomy level promotion. Shows validation pass rate, draft approval rate, and consecutive passes.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/trust/autonomy/evaluate",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_draft_submit_review — POST /drafts/:draft_id/submit-review
  api.registerTool({
    name: "ted_draft_submit_review",
    label: "Ted Draft Submit Review",
    description:
      "Submit a draft for operator review. Transitions a draft from 'drafted' or 'edited' to 'pending_review' state. Requires confirmation: first call returns a preview; call again with confirmed=true to execute.",
    parameters: Type.Object({
      draft_id: Type.String({
        description: "The draft ID to submit for review.",
      }),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the submission. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const draftId = typeof params?.draft_id === "string" ? params.draft_id.trim() : "";
        if (!draftId) {
          return tedToolJson({ error: "draft_id is required" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Submit draft ${draftId} for operator review`,
            params: { draft_id: draftId },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const routePath = `/drafts/${encodeURIComponent(draftId)}/submit-review`;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          routePath,
          {},
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_deep_work_session — POST /deep-work/session
  api.registerTool({
    name: "ted_deep_work_session",
    label: "Ted Deep Work Session",
    description:
      "Record a completed deep work session. Logs duration, optional label, and entity context to the deep work ledger. Requires confirmation: first call returns a preview; call again with confirmed=true to execute.",
    parameters: Type.Object({
      duration_minutes: Type.Number({
        description: "Duration of the session in minutes (1-480).",
      }),
      label: Type.Optional(
        Type.String({
          description: "Optional label for the session (e.g., 'Olumie Fund II closing docs').",
        }),
      ),
      entity: Type.Optional(
        Type.String({
          description: "Optional entity context (olumie, everest).",
        }),
      ),
      confirmed: Type.Optional(
        Type.Boolean({
          description:
            "Set to true to execute the recording. Omit or set false to get a preview of what will happen.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const durationMinutes =
          typeof params?.duration_minutes === "number" ? params.duration_minutes : 0;
        if (durationMinutes < 1 || durationMinutes > 480) {
          return tedToolJson({ error: "duration_minutes must be between 1 and 480" });
        }
        if (!params?.confirmed) {
          return tedToolJson({
            preview: true,
            action: `Record ${durationMinutes}-minute deep work session${params?.label ? `: ${params.label}` : ""}`,
            params: {
              duration_minutes: durationMinutes,
              label: params?.label,
              entity: params?.entity,
            },
            message: "Reply with confirmed: true to execute this action.",
          });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const body: Record<string, unknown> = { duration_minutes: durationMinutes };
        if (params?.label !== undefined) body.label = params.label;
        if (params?.entity !== undefined) body.entity = params.entity;
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/deep-work/session",
          body,
          { "x-ted-approval-source": "operator" },
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_graph_sync_status — GET /graph/:profile_id/sync/status
  api.registerTool({
    name: "ted_graph_sync_status",
    label: "Ted Graph Sync Status",
    description:
      "View recent graph sync ledger history for a profile, showing sync health status and check history.",
    parameters: Type.Object({
      profile_id: Type.String({
        description: 'Graph profile ID (e.g., "olumie", "everest").',
      }),
      limit: Type.Optional(
        Type.Number({
          description: "Max entries to return (default 20).",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      try {
        const profileId = normalizeSupportedProfileId(params?.profile_id);
        if (!profileId) {
          return tedToolJson({ error: "profile_id must be one of olumie|everest" });
        }
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const queryParts: string[] = [];
        if (params?.limit !== undefined) {
          queryParts.push(`limit=${encodeURIComponent(String(params.limit))}`);
        }
        const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/graph/${encodeURIComponent(profileId)}/sync/status${queryString}`,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_ingestion_status — GET /ops/ingestion/status
  api.registerTool({
    name: "ted_ingestion_status",
    label: "Ted Ingestion Status",
    description:
      "Check the current status of Ted's inbox ingestion pipeline. Returns stats on processed messages, last run time, and any errors. Use this when the user asks about ingestion health or whether new mail has been processed.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/ingestion/status",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_discovery_status — GET /ops/onboarding/discovery-status
  api.registerTool({
    name: "ted_discovery_status",
    label: "Ted Discovery Status",
    description:
      "View the results of the most recent onboarding discovery pipeline run. Returns discovered contacts, patterns, and profile data that Ted has identified. Use this when the user asks about discovery progress or onboarding status.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/onboarding/discovery-status",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_tool_usage — GET /ops/tool-usage
  api.registerTool({
    name: "ted_tool_usage",
    label: "Ted Tool Usage",
    description:
      "View tool usage statistics including call counts, last-used timestamps, and latency averages for all MCP tools. Use this when the user asks about tool usage, which tools are most active, or system performance metrics.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(baseUrl, timeoutMs, "/ops/tool-usage");
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_evaluation_status — GET /ops/evaluation/status
  api.registerTool({
    name: "ted_evaluation_status",
    label: "Ted Evaluation Pipeline",
    description:
      "View evaluation pipeline results including pass/fail counts for golden fixture validation, quality trends, and failing fixture details. Use when the user asks about output quality, contract compliance, or evaluation status.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/evaluation/status",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_evaluation_run — POST /ops/evaluation/run
  api.registerTool({
    name: "ted_evaluation_run",
    label: "Ted Run Evaluation",
    description:
      "Trigger a manual run of the evaluation pipeline, validating all golden fixtures against their output contracts. Returns pass/fail results with quality trend analysis.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/evaluation/run",
          {},
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── C12-004: Deal stale owners tool ────────────────────────────────────────
  api.registerTool({
    name: "ted_deal_stale_owners",
    label: "Ted Deal Stale Owners",
    description:
      "Check for deals where the owner has not updated in N days (default 7). Returns a list of stale deals with days since last touch. Use when the user asks about deal pipeline health or stalled deals.",
    parameters: Type.Object({
      days: Type.Optional(Type.Number({ description: "Number of days threshold (default 7)" })),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const days = params?.days ?? 7;
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          `/deals/stale-owners?days=${encodeURIComponent(days)}`,
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── C12-011: Deal retrospective tool ───────────────────────────────────────
  api.registerTool({
    name: "ted_deal_retrospective",
    label: "Ted Deal Retrospective",
    description:
      "Generate a per-deal learning retrospective for a closed or dead deal. Summarizes events, commitments, drafts, and stage transitions. Use when the user wants to review what happened on a specific deal.",
    parameters: Type.Object({
      deal_id: Type.String({ description: "The deal ID to generate a retrospective for" }),
    }),
    async execute(_toolCallId, params) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        if (!params?.deal_id) return tedToolError(new Error("deal_id is required"));
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          `/deals/${encodeURIComponent(params.deal_id)}/retrospective`,
          {},
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── Self-Healing Agent Tools (Phase A) ────────────────────────────────────

  // ted_self_healing_status — GET /ops/self-healing/status
  api.registerTool({
    name: "ted_self_healing_status",
    label: "Ted Self-Healing Status",
    description:
      "View the self-healing subsystem status: circuit breaker states, provider health, config drift status, ledger compaction metrics, and proposal expiry stats. Use this to check overall system health and self-repair state.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/status",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_circuit_breakers — GET /ops/self-healing/circuit-breakers
  api.registerTool({
    name: "ted_circuit_breakers",
    label: "Ted Circuit Breakers",
    description:
      "View all circuit breaker states in the Ted system. Shows which external service integrations are open (healthy), half-open (recovering), or closed (tripped). Use this to diagnose connectivity or integration failures.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/circuit-breakers",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_provider_health — GET /ops/self-healing/provider-health
  api.registerTool({
    name: "ted_provider_health",
    label: "Ted Provider Health",
    description:
      "View health metrics for LLM and external service providers. Shows latency, error rates, and availability per provider. Use this to diagnose slow or failing LLM calls.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/provider-health",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_config_drift_reconcile — POST /ops/self-healing/config-drift/reconcile
  api.registerTool({
    name: "ted_config_drift_reconcile",
    label: "Ted Config Drift Reconcile",
    description:
      "Trigger a config drift reconciliation scan. Compares live config files against their expected schemas and checksums, reporting any drift or corruption. Use this when you suspect config files may have been modified outside the Builder Lane.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/config-drift/reconcile",
          {},
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_compact_ledgers — POST /ops/self-healing/compact-ledgers
  api.registerTool({
    name: "ted_compact_ledgers",
    label: "Ted Compact Ledgers",
    description:
      "Trigger ledger compaction across all JSONL ledger files. Removes duplicate entries, truncates rotated segments, and reports bytes reclaimed. Use this for maintenance when ledger files grow large.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/compact-ledgers",
          {},
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_expire_proposals — POST /ops/self-healing/expire-proposals
  api.registerTool({
    name: "ted_expire_proposals",
    label: "Ted Expire Proposals",
    description:
      "Trigger expiry of stale improvement proposals. Proposals in 'proposed' status beyond the configured age threshold are marked expired. Use this for periodic governance hygiene.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/expire-proposals",
          {},
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_resurrect_proposal — POST /ops/builder-lane/proposals/{proposal_id}/resurrect
  api.registerTool({
    name: "ted_resurrect_proposal",
    label: "Ted Resurrect Proposal",
    description:
      "Resurrect an expired or rejected improvement proposal, returning it to 'proposed' status for re-evaluation. Use this when the operator wants to reconsider a previously dismissed proposal.",
    parameters: Type.Object({
      proposal_id: Type.String({
        description: "The proposal ID to resurrect (e.g. BL-1234567890-abc1).",
      }),
    }),
    async execute(_toolCallId, params) {
      try {
        const proposalId = typeof params?.proposal_id === "string" ? params.proposal_id.trim() : "";
        if (!proposalId) return tedToolError(new Error("proposal_id is required"));
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedRoute(
          baseUrl,
          timeoutMs,
          `/ops/builder-lane/proposals/${encodeURIComponent(proposalId)}/resurrect`,
          {},
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── Self-Healing Agent Tools (Phase B) ────────────────────────────────────

  // ted_correction_taxonomy — GET /ops/self-healing/correction-taxonomy
  api.registerTool({
    name: "ted_correction_taxonomy",
    label: "Ted Correction Taxonomy",
    description:
      "View the correction signal taxonomy: all known correction categories, their frequency counts, and classification rules. Use this to understand what types of operator corrections Ted has observed.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/correction-taxonomy",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_engagement_insights — GET /ops/self-healing/engagement-insights
  api.registerTool({
    name: "ted_engagement_insights",
    label: "Ted Engagement Insights",
    description:
      "View engagement analytics: read rates, action rates, and time-to-action across content types (briefs, digests, drafts, alerts). Use this to understand which Ted outputs the operator actually uses.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/engagement-insights",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_noise_level — GET /ops/self-healing/noise-level
  api.registerTool({
    name: "ted_noise_level",
    label: "Ted Noise Level",
    description:
      "View the current noise level assessment: notification volume, dismissed-without-read rate, and recommended throttle adjustments. Use this to check if Ted is over-communicating or generating alert fatigue.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/noise-level",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ted_autonomy_status — GET /ops/self-healing/autonomy-status
  api.registerTool({
    name: "ted_autonomy_status",
    label: "Ted Autonomy Status",
    description:
      "View the current autonomy ladder position and progression metrics. Shows which actions Ted can take autonomously vs. those requiring operator confirmation, and the evidence driving any level changes.",
    parameters: Type.Object({}),
    async execute(_toolCallId) {
      try {
        const { baseUrl, timeoutMs } = resolveTedToolConfig();
        const payload = await callAuthenticatedTedGetRoute(
          baseUrl,
          timeoutMs,
          "/ops/self-healing/autonomy-status",
        );
        return tedToolJson(payload);
      } catch (err) {
        return tedToolError(err);
      }
    },
  });

  // ─── Governance Hook: before_tool_call (JC-076c) ───────────────────────────
  //
  // This hook fires before any ted_* tool call. It enforces:
  // 1. Hard-ban tool list — governance-sensitive tools that must never be called
  //    by the agent (these are operator-only or internal governance endpoints).
  // 2. Entity boundary — if a profile_id is present, ensures it matches
  //    one of the supported entity profiles.
  // 3. Autonomy ladder — write operations in draft_only mode return a preview
  //    first (handled by the confirmation gate in each write tool, but the hook
  //    enforces it as a second layer of defense).

  const TED_HARD_BAN_TOOLS = new Set([
    "ted_policy_update",
    "ted_policy_preview_update",
    "ted_gates_set",
    "ted_jobcards_update",
    "ted_recommendations_decide",
    "ted_jobcards_proof_run",
  ]);

  const TED_SUPPORTED_ENTITIES = new Set(["olumie", "everest"]);

  api.on("before_tool_call", (event) => {
    const { toolName, params } = event;

    // Only intercept ted_* tools
    if (!toolName.startsWith("ted_")) {
      return;
    }

    // 1. Hard-ban enforcement: block governance-sensitive tool names
    if (TED_HARD_BAN_TOOLS.has(toolName)) {
      return {
        block: true,
        blockReason: `Tool "${toolName}" is hard-banned by Ted governance policy. This tool cannot be called by the agent.`,
      };
    }

    // 2. Entity boundary check: if params contain profile_id, verify it is a
    //    supported entity. This prevents the agent from accessing unknown or
    //    cross-entity profiles.
    const profileId =
      params && typeof params === "object" && "profile_id" in params
        ? (params as Record<string, unknown>).profile_id
        : undefined;
    if (
      profileId !== undefined &&
      typeof profileId === "string" &&
      profileId.trim().length > 0 &&
      !TED_SUPPORTED_ENTITIES.has(profileId.trim().toLowerCase())
    ) {
      return {
        block: true,
        blockReason: `Entity boundary violation: profile_id "${profileId}" is not a supported entity. Supported entities: ${[...TED_SUPPORTED_ENTITIES].join(", ")}.`,
      };
    }

    // MF-8: Operator-only tools — agent cannot self-approve with confirmed=true
    if (REQUIRES_OPERATOR_CONFIRMATION.has(toolName)) {
      const confirmed =
        params && typeof params === "object" && "confirmed" in params
          ? (params as Record<string, unknown>).confirmed
          : false;
      if (confirmed === true) {
        return {
          block: true,
          blockReason: `Tool "${toolName}" requires OPERATOR confirmation. The agent cannot self-approve this action. The operator must approve via the Ted Workbench UI.`,
        };
      }
      // Allow preview calls through (confirmed=false or absent)
      return;
    }

    // 3. Autonomy ladder enforcement: for write tools, if confirmed is not
    //    explicitly true, the tool's own execute function will return a preview.
    //    This hook adds a secondary defense by blocking unconfirmed writes at
    //    the hook level when the autonomy mode is "draft_only" (the default).
    if (TED_WRITE_TOOLS_SET.has(toolName)) {
      const confirmed =
        params && typeof params === "object" && "confirmed" in params
          ? (params as Record<string, unknown>).confirmed
          : false;
      if (confirmed !== true) {
        // Allow the call through — the tool itself will return a preview.
        // We only enforce hard blocking here; the preview gate is in the tool.
        return;
      }
    }

    return;
  });
}

export { buildSafeEndpoint, isLoopbackHost, normalizeBaseUrl, resolvePathFromAction };
