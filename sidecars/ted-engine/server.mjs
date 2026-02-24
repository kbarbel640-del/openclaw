#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAuthStoreLabel,
  getTokenRecord,
  revokeTokenRecord,
  storeTokenRecord,
} from "./token_store.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = "127.0.0.1";
const PORT = 48080;
const STARTED_AT_MS = Date.now();
const VERSION = process.env.TED_ENGINE_VERSION?.trim() || "0.1.0";
const PROFILES_COUNT_RAW = Number.parseInt(process.env.TED_ENGINE_PROFILES_COUNT || "0", 10);
const PROFILES_COUNT =
  Number.isFinite(PROFILES_COUNT_RAW) && PROFILES_COUNT_RAW >= 0 ? PROFILES_COUNT_RAW : 0;
const GRAPH_ALLOWED_PROFILES = new Set(["olumie", "everest"]);

const logsDir = path.join(__dirname, "logs");
fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, "ted-engine.log");
// C10-033: Log stream with daily rotation
let logStream = fs.createWriteStream(logFile, { flags: "a" });
let _logStreamDate = new Date().toISOString().slice(0, 10);
let _rotateInProgress = false;
function rotateLogIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _logStreamDate && !_rotateInProgress) {
    _rotateInProgress = true;
    try {
      logStream.end();
      const rotatedName = path.join(logsDir, `ted-engine.${_logStreamDate}.log`);
      if (fs.existsSync(logFile)) {
        fs.renameSync(logFile, rotatedName);
      }
      logStream = fs.createWriteStream(logFile, { flags: "a" });
      _logStreamDate = today;
    } catch {
      // If rotation fails, keep writing to the current stream
      logStream = fs.createWriteStream(logFile, { flags: "a" });
      _logStreamDate = today;
    } finally {
      _rotateInProgress = false;
    }
  }
}
const artifactsDir = path.join(__dirname, "artifacts");
const dealsDir = path.join(artifactsDir, "deals");
const triageDir = path.join(artifactsDir, "triage");
const triageLedgerPath = path.join(triageDir, "triage.jsonl");
const patternsDir = path.join(artifactsDir, "patterns");
const patternsLedgerPath = path.join(patternsDir, "patterns.jsonl");
const filingDir = path.join(artifactsDir, "filing");
const filingSuggestionsPath = path.join(filingDir, "suggestions.jsonl");
const graphProfilesConfigPath = path.join(__dirname, "config", "graph.profiles.json");
const operatorProfileConfigPath = path.join(__dirname, "config", "operator_profile.json");
const hardBansConfigPath = path.join(__dirname, "config", "hard_bans.json");
const briefConfigPath = path.join(__dirname, "config", "brief_config.json");
const urgencyRulesConfigPath = path.join(__dirname, "config", "urgency_rules.json");
const draftStyleConfigPath = path.join(__dirname, "config", "draft_style.json");
const autonomyLadderConfigPath = path.join(__dirname, "config", "autonomy_ladder.json");
const llmProviderConfigPath = path.join(__dirname, "config", "llm_provider.json");
const notificationBudgetConfigPath = path.join(__dirname, "config", "notification_budget.json");
const onboardingRampConfigPath = path.join(__dirname, "config", "onboarding_ramp.json");
const planningPreferencesConfigPath = path.join(__dirname, "config", "planning_preferences.json");
const paraRulesConfigPath = path.join(__dirname, "config", "para_rules.json");
const outputContractsConfigPath = path.join(__dirname, "config", "output_contracts.json");
const schedulerConfigPath = path.join(__dirname, "config", "scheduler_config.json");
const schedulerDir = path.join(__dirname, "scheduler");
fs.mkdirSync(schedulerDir, { recursive: true });
const pendingDeliveryPath = path.join(schedulerDir, "pending_delivery.jsonl");
const schedulerStatePath = path.join(schedulerDir, "scheduler_state.json");
const meetingsDir = path.join(artifactsDir, "meetings");
const meetingsPrepPath = path.join(meetingsDir, "prep.jsonl");
const meetingsDebriefPath = path.join(meetingsDir, "debrief.jsonl");
const commitmentsDir = path.join(artifactsDir, "commitments");
const commitmentsLedgerPath = path.join(commitmentsDir, "commitments.jsonl");
const gtdDir = path.join(artifactsDir, "gtd");
const gtdActionsPath = path.join(gtdDir, "actions.jsonl");
const gtdWaitingForPath = path.join(gtdDir, "waiting_for.jsonl");
const planningDir = path.join(artifactsDir, "planning");
const planningLedgerPath = path.join(planningDir, "plans.jsonl");
const eventLogDir = path.join(artifactsDir, "event_log");
const eventLogPath = path.join(eventLogDir, "event_log.jsonl");
const auditDir = path.join(artifactsDir, "audit");
const auditLedgerPath = path.join(auditDir, "audit.jsonl");
const opsDir = path.join(artifactsDir, "ops");
const opsLedgerPath = path.join(opsDir, "ops.jsonl");
// Phase 10 — missing ledgers
const trustDir = path.join(artifactsDir, "trust");
const trustLedgerPath = path.join(trustDir, "trust.jsonl");
const policyDir = path.join(artifactsDir, "policy");
const policyLedgerPath = path.join(policyDir, "policy.jsonl");
const deepWorkDir = path.join(artifactsDir, "deep_work");
const deepWorkLedgerPath = path.join(deepWorkDir, "deep_work.jsonl");
const graphSyncDir = path.join(artifactsDir, "graph_sync");
const graphSyncLedgerPath = path.join(graphSyncDir, "sync.jsonl");
const mailDir = path.join(artifactsDir, "mail");
const mailLedgerPath = path.join(mailDir, "mail.jsonl");
const calendarDir = path.join(artifactsDir, "calendar");
const calendarLedgerPath = path.join(calendarDir, "calendar.jsonl");
const paraIndexPath = path.join(filingDir, "para_index.jsonl");
// Phase 11 — draft queue
const draftQueueDir = path.join(artifactsDir, "drafts");
const draftQueueLedgerPath = path.join(draftQueueDir, "draft_queue.jsonl");
// Phase 13 — facility alerts
const facilityDir = path.join(artifactsDir, "facility");
const facilityAlertsPath = path.join(facilityDir, "alerts.jsonl");
// Phase 14 — deal events
const dealsEventsPath = path.join(dealsDir, "deals_events.jsonl");
// Phase 16-21 — Planner + To Do + Sync
const plannerDir = path.join(artifactsDir, "planner");
const plannerLedgerPath = path.join(plannerDir, "planner.jsonl");
const todoDir = path.join(artifactsDir, "todo");
const todoLedgerPath = path.join(todoDir, "todo.jsonl");
const syncDir = path.join(artifactsDir, "sync");
const syncLedgerPath = path.join(syncDir, "sync_proposals.jsonl");
// Codex Builder Lane — improvement proposals + learning
const improvementDir = path.join(artifactsDir, "improvement");
const improvementLedgerPath = path.join(improvementDir, "proposals.jsonl");
const learningDir = path.join(artifactsDir, "learning");
const _learningLedgerPath = path.join(learningDir, "learning.jsonl");
fs.mkdirSync(meetingsDir, { recursive: true });
fs.mkdirSync(commitmentsDir, { recursive: true });
fs.mkdirSync(gtdDir, { recursive: true });
fs.mkdirSync(planningDir, { recursive: true });
fs.mkdirSync(eventLogDir, { recursive: true });
fs.mkdirSync(auditDir, { recursive: true });
fs.mkdirSync(opsDir, { recursive: true });
fs.mkdirSync(trustDir, { recursive: true });
fs.mkdirSync(policyDir, { recursive: true });
fs.mkdirSync(deepWorkDir, { recursive: true });
fs.mkdirSync(graphSyncDir, { recursive: true });
fs.mkdirSync(mailDir, { recursive: true });
fs.mkdirSync(calendarDir, { recursive: true });
fs.mkdirSync(draftQueueDir, { recursive: true });
fs.mkdirSync(facilityDir, { recursive: true });
fs.mkdirSync(plannerDir, { recursive: true });
fs.mkdirSync(todoDir, { recursive: true });
fs.mkdirSync(syncDir, { recursive: true });
if (!fs.existsSync(improvementDir)) {
  fs.mkdirSync(improvementDir, { recursive: true });
}
if (!fs.existsSync(learningDir)) {
  fs.mkdirSync(learningDir, { recursive: true });
}
// C9-010: Inbox ingestion ledger
const ingestionDir = path.join(artifactsDir, "ingestion");
const ingestionLedgerPath = path.join(ingestionDir, "ingestion.jsonl");
fs.mkdirSync(ingestionDir, { recursive: true });
// C9-020: First-run discovery ledger
const discoveryDir = path.join(artifactsDir, "discovery");
const discoveryLedgerPath = path.join(discoveryDir, "discovery.jsonl");
fs.mkdirSync(discoveryDir, { recursive: true });
// Builder Lane — correction signals + style deltas
const correctionSignalsDir = path.join(artifactsDir, "correction_signals");
const correctionSignalsPath = path.join(correctionSignalsDir, "correction_signals.jsonl");
const styleDeltasDir = path.join(artifactsDir, "style_deltas");
const styleDeltasPath = path.join(styleDeltasDir, "style_deltas.jsonl");
const builderLaneStatusDir = path.join(artifactsDir, "builder_lane");
const builderLaneStatusPath = path.join(builderLaneStatusDir, "builder_lane_status.jsonl");
const shadowEvalDir = path.join(artifactsDir, "shadow_eval");
const shadowEvalPath = path.join(shadowEvalDir, "shadow_eval.jsonl");
const configSnapshotsDir = path.join(__dirname, "config", "snapshots");
const builderLaneConfigPath = path.join(__dirname, "config", "builder_lane_config.json");
const configInteractionsPath = path.join(__dirname, "config", "config_interactions.json");
fs.mkdirSync(correctionSignalsDir, { recursive: true });
fs.mkdirSync(styleDeltasDir, { recursive: true });
fs.mkdirSync(builderLaneStatusDir, { recursive: true });
fs.mkdirSync(shadowEvalDir, { recursive: true });
fs.mkdirSync(configSnapshotsDir, { recursive: true });
const graphLastErrorByProfile = new Map();

// Ops state persisted to ops_ledger (JC-087d) — replay on startup
function replayOpsState() {
  const state = { paused: false, paused_at_ms: 0, reason: null, queued_non_critical: 0 };
  let lastResume = null;
  const lines = readJsonlLines(opsLedgerPath);
  for (const line of lines) {
    if (line.kind === "ops_pause") {
      state.paused = true;
      state.paused_at_ms = typeof line.paused_at_ms === "number" ? line.paused_at_ms : Date.now();
      state.reason = line.reason || null;
      state.queued_non_critical = 0;
    } else if (line.kind === "ops_resume") {
      state.paused = false;
      state.paused_at_ms = 0;
      state.reason = null;
      state.queued_non_critical = 0;
      lastResume = line.catch_up_summary || null;
    } else if (line.kind === "ops_dispatch_queued") {
      state.queued_non_critical = (state.queued_non_critical || 0) + 1;
    }
  }
  return { state, lastResume };
}
const opsReplay = replayOpsState();
let automationPauseState = opsReplay.state;
let lastCatchUpSummary = opsReplay.lastResume;

// JC-088b: Policy Ledger — snapshot config state on startup
function snapshotPolicyState() {
  try {
    const hardBans = readConfigFile(hardBansConfigPath);
    const autonomy = readConfigFile(autonomyLadderConfigPath);
    const llmProvider = readConfigFile(llmProviderConfigPath);
    const snapshot = {
      hard_bans_count: Array.isArray(hardBans?.hard_ban_strings)
        ? hardBans.hard_ban_strings.length
        : hardBans
          ? Object.keys(hardBans).length
          : 0,
      autonomy_level: autonomy?.default_mode || autonomy?.current_level || "unknown",
      llm_provider: llmProvider?.active_provider || llmProvider?.default_provider || "unknown",
    };
    appendJsonlLine(policyLedgerPath, {
      kind: "policy_snapshot",
      configs: snapshot,
      at: new Date().toISOString(),
    });
    appendEvent("policy.config.snapshot", "startup", snapshot);
  } catch (policyErr) {
    // Non-fatal — config files may not exist yet
    try {
      logLine(`POLICY_SNAPSHOT_ERROR: ${policyErr?.message || "unknown"}`);
    } catch {
      /* noop */
    }
  }
}
snapshotPolicyState();

// ── Self-Healing: Config Drift Reconciliation (SH-003/004) ──
const _configHashes = new Map();
const _selfHealingConfigDir = path.join(__dirname, "config");
const MONITORED_CONFIGS = [
  "hard_bans.json",
  "brief_config.json",
  "style_guide.json",
  "draft_style.json",
  "autonomy_ladder.json",
  "urgency_rules.json",
  "operator_profile.json",
  "builder_lane_config.json",
];

function hashConfigFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    /* intentional: file may not exist */ return null;
  }
}

function validateConfigSchema(_filePath, content) {
  try {
    JSON.parse(content);
    return { valid: true, errors: [] };
  } catch (e) {
    return { valid: false, errors: [e.message] };
  }
}

function initConfigHashes() {
  for (const name of MONITORED_CONFIGS) {
    const filePath = path.join(_selfHealingConfigDir, name);
    const hash = hashConfigFile(filePath);
    if (hash) {
      _configHashes.set(filePath, {
        hash,
        lastChecked: new Date().toISOString(),
        lastValid: fs.readFileSync(filePath, "utf8"),
      });
    }
  }
  logLine(`CONFIG_DRIFT: Initialized hashes for ${_configHashes.size} config files`);
}

function restoreConfigFromSnapshot(configPath) {
  const snapshotsDir = path.join(_selfHealingConfigDir, "snapshots");
  if (!fs.existsSync(snapshotsDir)) {
    return false;
  }
  const baseName = path.basename(configPath);
  const snapshots = fs
    .readdirSync(snapshotsDir)
    .filter((f) => f.includes(baseName))
    .toSorted()
    .toReversed();
  if (snapshots.length === 0) {
    return false;
  }
  const snapshotPath = path.join(snapshotsDir, snapshots[0]);
  try {
    const content = fs.readFileSync(snapshotPath, "utf8");
    const validation = validateConfigSchema(configPath, content);
    if (!validation.valid) {
      logLine(`CONFIG_RESTORE: Snapshot ${snapshots[0]} is invalid JSON, skipping`);
      return false;
    }
    // Atomic replacement: write-temp -> fsync -> rename -> fsync-dir
    const tmpPath = configPath + ".tmp." + Date.now();
    const fd = fs.openSync(tmpPath, "w");
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tmpPath, configPath);
    // fsync parent directory
    const dirFd = fs.openSync(path.dirname(configPath), "r");
    fs.fsyncSync(dirFd);
    fs.closeSync(dirFd);
    appendEvent("self_healing.config.restored_from_snapshot", "config", {
      path: configPath,
      snapshot: snapshots[0],
    });
    logLine(`CONFIG_RESTORE: Restored ${baseName} from snapshot ${snapshots[0]}`);
    return true;
  } catch (e) {
    logLine(`CONFIG_RESTORE: Failed to restore ${baseName}: ${e.message}`);
    return false;
  }
}

function checkConfigDrift() {
  let driftCount = 0;
  for (const name of MONITORED_CONFIGS) {
    const filePath = path.join(_selfHealingConfigDir, name);
    const stored = _configHashes.get(filePath);
    if (!fs.existsSync(filePath)) {
      logLine(`CONFIG_DRIFT: ${name} missing, attempting restore`);
      appendEvent("self_healing.config.drift_detected", "config", {
        file: name,
        reason: "missing",
      });
      const restored = restoreConfigFromSnapshot(filePath);
      if (restored) {
        const newHash = hashConfigFile(filePath);
        if (newHash) {
          _configHashes.set(filePath, {
            hash: newHash,
            lastChecked: new Date().toISOString(),
            lastValid: fs.readFileSync(filePath, "utf8"),
          });
        }
      }
      driftCount++;
      continue;
    }
    const currentHash = hashConfigFile(filePath);
    if (!currentHash) {
      continue;
    }
    if (stored && stored.hash !== currentHash) {
      driftCount++;
      const content = fs.readFileSync(filePath, "utf8");
      const validation = validateConfigSchema(filePath, content);
      if (!validation.valid) {
        appendEvent("self_healing.config.validation_failed", "config", {
          file: name,
          errors: validation.errors,
        });
        logLine(`CONFIG_DRIFT: ${name} changed but INVALID JSON — NOT reloading`);
        continue;
      }
      _configHashes.set(filePath, {
        hash: currentHash,
        lastChecked: new Date().toISOString(),
        lastValid: content,
      });
      appendEvent("self_healing.config.auto_reloaded", "config", {
        file: name,
        old_hash: stored.hash,
        new_hash: currentHash,
      });
      logLine(`CONFIG_DRIFT: ${name} reloaded (hash changed)`);
    } else if (stored) {
      stored.lastChecked = new Date().toISOString();
    } else {
      _configHashes.set(filePath, {
        hash: currentHash,
        lastChecked: new Date().toISOString(),
        lastValid: fs.readFileSync(filePath, "utf8"),
      });
    }
  }
  return { ok: true, drift_count: driftCount, files_checked: MONITORED_CONFIGS.length };
}

initConfigHashes();

// ── Self-Healing: HIPAA-Compliant Ledger Compaction (SH-005) ──
const archiveDir = path.join(artifactsDir, "archive");
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}
const archiveManifestPath = path.join(archiveDir, "manifest.jsonl");
let _compactionRunning = false;

function compactLedger(ledgerPath, maxAgeDays = 90) {
  if (!fs.existsSync(ledgerPath)) {
    return { archived: 0, retained: 0 };
  }
  const lines = readJsonlLines(ledgerPath);
  if (lines.length === 0) {
    return { archived: 0, retained: 0 };
  }
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const toArchive = [];
  const toRetain = [];
  for (const line of lines) {
    const ts = line._ts || line.timestamp || line.created_at;
    if (ts && new Date(ts).getTime() < cutoff) {
      toArchive.push(line);
    } else {
      toRetain.push(line);
    }
  }
  if (toArchive.length === 0) {
    return { archived: 0, retained: lines.length };
  }
  // Archive to JSONL file (HIPAA: 6-year retention in archive)
  const baseName = path.basename(ledgerPath, ".jsonl");
  const month = new Date().toISOString().slice(0, 7);
  const archivePath = path.join(archiveDir, `${baseName}_${month}.archived.jsonl`);
  for (const entry of toArchive) {
    fs.appendFileSync(archivePath, JSON.stringify(entry) + "\n");
  }
  // Atomic replacement of active file
  const tmpPath = ledgerPath + ".tmp." + Date.now();
  const fd = fs.openSync(tmpPath, "w");
  for (const entry of toRetain) {
    fs.writeSync(fd, JSON.stringify(entry) + "\n");
  }
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmpPath, ledgerPath);
  // Record in manifest
  const archiveHash = hashConfigFile(archivePath) || "unknown";
  appendJsonlLine(archiveManifestPath, {
    archive_path: archivePath,
    hash: archiveHash,
    archived_count: toArchive.length,
    created_at: new Date().toISOString(),
    retention_years: 6,
  });
  return {
    archived: toArchive.length,
    retained: toRetain.length,
    archive_path: archivePath,
    archive_hash: archiveHash,
  };
}

async function _runLedgerCompaction(_req, res) {
  if (_compactionRunning) {
    sendJson(res, 409, { ok: false, error: "Compaction already running" });
    return;
  }
  _compactionRunning = true;
  try {
    const results = [];
    // Enumerate known ledger files in artifacts directory tree
    const ledgerDirs = [
      artifactsDir,
      ...fs
        .readdirSync(artifactsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(artifactsDir, d.name)),
    ];
    for (const dir of ledgerDirs) {
      try {
        const dataFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
        for (const f of dataFiles) {
          const result = compactLedger(path.join(dir, f));
          if (result.archived > 0) {
            results.push({ ledger: f, ...result });
          }
        }
      } catch {
        /* intentional: skip dirs that can't be read */
      }
    }
    appendEvent("self_healing.ledger.compacted", "self_healing", {
      total_archived: results.reduce((s, r) => s + r.archived, 0),
      ledgers_compacted: results.length,
    });
    logLine(
      `COMPACTION: ${results.length} ledgers compacted, ${results.reduce((s, r) => s + r.archived, 0)} entries archived`,
    );
    sendJson(res, 200, { ok: true, results });
  } catch (e) {
    logLine(`COMPACTION_ERROR: ${e.message}`);
    sendJson(res, 500, { ok: false, error: e.message });
  } finally {
    _compactionRunning = false;
  }
}

const EXECUTION_MODE_VALUES = new Set(["DETERMINISTIC", "ADAPTIVE"]);
const EXEMPT_AUTH_ROUTES = new Set(["/status", "/doctor", "/auth/mint"]);
const OPERATOR_KEY = process.env.TED_ENGINE_OPERATOR_KEY?.trim() || "ted-local-operator";
const STATIC_BEARER_TOKEN = process.env.TED_ENGINE_AUTH_TOKEN?.trim() || "";
const AUTH_TTL_MS_RAW = Number.parseInt(process.env.TED_ENGINE_AUTH_TTL_MS || "3600000", 10);
const AUTH_TTL_MS =
  Number.isFinite(AUTH_TTL_MS_RAW) && AUTH_TTL_MS_RAW > 0 ? AUTH_TTL_MS_RAW : 3600000;
const mintedBearerTokens = new Map();
const IDEMPOTENCY_TTL_MS_RAW = Number.parseInt(
  process.env.TED_ENGINE_IDEMPOTENCY_TTL_MS || "3600000",
  10,
);
const IDEMPOTENCY_TTL_MS =
  Number.isFinite(IDEMPOTENCY_TTL_MS_RAW) && IDEMPOTENCY_TTL_MS_RAW > 0
    ? IDEMPOTENCY_TTL_MS_RAW
    : 3600000;
const idempotencyCache = new Map();
const VALID_DEAL_STAGES = [
  "deal_identified",
  "nda_signed",
  "data_room_access",
  "dd_active",
  "psa_in_progress",
  "investor_onboarding",
  "closing",
  "closed",
  "archived",
];
const VALID_DEAL_TYPES = new Set(["SNF_ALF", "SOFTWARE", "ANCILLARY_HEALTHCARE"]);
const VALID_DEAL_STATUSES = new Set(["active", "paused", "closed", "archived"]);
const DISCOVERABILITY_VERSION = "2026-02-20";

function logLine(message) {
  rotateLogIfNeeded();
  const line = `[${new Date().toISOString()}] ${message}\n`;
  logStream.write(line);
}

function buildPayload() {
  const catalog = {
    discoverability_version: DISCOVERABILITY_VERSION,
    commands: ["/ted doctor", "/ted status", "/ted catalog"],
    route_families: [
      "/deals/*",
      "/triage/*",
      "/filing/suggestions/*",
      "/governance/*",
      "/ops/*",
      "/learning/*",
      "/graph/*",
      "/extraction/*",
      "/reporting/*",
      "/meeting/*",
      "/commitments/*",
      "/gtd/*",
      "/planning/*",
      "/filing/para/*",
      "/reporting/deep-work-metrics",
      "/reporting/trust-metrics",
      "/mcp",
    ],
    governance_guards: [
      "draft_only_boundary",
      "approval_first",
      "single_operator",
      "fail_closed",
      "auth_non_health_required",
      "loopback_only",
    ],
    non_health_auth_required: true,
  };
  return {
    version: VERSION,
    uptime: Math.floor((Date.now() - STARTED_AT_MS) / 1000),
    profiles_count: PROFILES_COUNT,
    deals_count: listDeals().length,
    triage_open_count: listOpenTriageItems().length,
    catalog,
    operator: (() => {
      const cfg = getOperatorProfile();
      if (!cfg) {
        return null;
      }
      return {
        name: cfg.operator?.name || null,
        organization: cfg.operator?.organization || null,
        timezone: cfg.operator?.timezone || null,
        contexts: cfg.contexts?.list || [],
        default_context: cfg.contexts?.default_context || null,
        entity_count: cfg.contexts?.list?.length || 0,
      };
    })(),
  };
}

function sendJson(res, statusCode, body) {
  if (res.writableEnded) {
    return;
  } // guard: response already sent (e.g. 413 from body-size check)
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
  });
  res.end(json);
}

function sendJsonPretty(res, statusCode, body) {
  if (res.writableEnded) {
    return;
  } // guard: response already sent
  const json = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
  });
  res.end(json);
}

function classifyGraphErrorText(errorText) {
  const normalized = typeof errorText === "string" ? errorText.toLowerCase() : "";
  if (normalized.includes("selected user account does not exist in tenant")) {
    return {
      category: "USER_NOT_IN_TENANT",
      confidence: "HIGH",
      summary: "User account is not present in the target tenant.",
      next_actions: [
        "Use a user principal that exists in the target tenant",
        "Invite the operator as a guest in the tenant if appropriate",
        "Retry device-code auth after tenant access is confirmed",
      ],
    };
  }
  if (normalized.includes("does not meet the criteria to access this resource")) {
    return {
      category: "CONDITIONAL_ACCESS_BLOCK",
      confidence: "HIGH",
      summary: "Conditional Access policy is blocking the sign-in flow.",
      next_actions: [
        "Review tenant Conditional Access policies for this app and user",
        "Satisfy required controls (MFA, compliant device, trusted location)",
        "Retry device-code auth after policy requirements are met",
      ],
    };
  }
  if (normalized.includes("authorization_pending")) {
    return {
      category: "AUTH_PENDING",
      confidence: "HIGH",
      summary: "Device-code authorization is still pending user approval.",
      next_actions: [
        "Complete verification at the provided verification URL",
        "Continue polling at the configured interval",
      ],
    };
  }
  if (normalized.includes("insufficient privileges")) {
    return {
      category: "MISSING_SCOPES",
      confidence: "HIGH",
      summary: "The configured delegated scopes are insufficient.",
      next_actions: [
        "Add the missing delegated scopes in profile config",
        "Re-run device-code auth to refresh consent",
        "Retry the blocked Graph operation",
      ],
    };
  }
  if (normalized.includes("invalid_grant")) {
    return {
      category: "TOKEN_EXPIRED_OR_REVOKED",
      confidence: "MEDIUM",
      summary: "Stored auth material is expired, invalid, or revoked.",
      next_actions: [
        "Revoke local auth material for the profile",
        "Run device-code auth again for a fresh token",
        "Retry the operation after re-authentication",
      ],
    };
  }
  return {
    category: "UNKNOWN",
    confidence: "LOW",
    summary: "Unable to classify this auth error text.",
    next_actions: [
      "Inspect sidecar status last_error for additional context",
      "Capture full redacted Graph error details",
      "Retry auth flow and reclassify with updated error text",
    ],
  };
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isSlugSafe(value) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

// Generic state machine validator (JC-091a)
function validateStateTransition(currentState, newState, allowedTransitions) {
  if (!allowedTransitions[currentState]) {
    return { ok: false, reason: `unknown_current_state: ${currentState}` };
  }
  if (!allowedTransitions[currentState].includes(newState)) {
    return {
      ok: false,
      reason: `invalid_transition: ${currentState} -> ${newState}`,
      allowed: allowedTransitions[currentState],
    };
  }
  return { ok: true };
}

function isValidStageTransition(fromStage, toStage) {
  if (!VALID_DEAL_STAGES.includes(toStage)) {
    return { ok: false, reason: "invalid_stage" };
  }
  if (!fromStage) {
    return { ok: true, warning: null };
  }
  const fromIdx = VALID_DEAL_STAGES.indexOf(fromStage);
  if (fromIdx < 0) {
    return { ok: true, warning: null };
  }
  // Build allowedTransitions map: each stage can go to any valid stage (but warn on backward)
  const allowedTransitions = {};
  for (const stage of VALID_DEAL_STAGES) {
    allowedTransitions[stage] = [...VALID_DEAL_STAGES];
  }
  const result = validateStateTransition(fromStage, toStage, allowedTransitions);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  const toIdx = VALID_DEAL_STAGES.indexOf(toStage);
  if (toIdx < fromIdx) {
    return { ok: true, warning: `backward_transition_from_${fromStage}_to_${toStage}` };
  }
  return { ok: true, warning: null };
}

function getDealPath(dealId) {
  return path.join(dealsDir, `${dealId}.json`);
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    /* intentional: file may not exist, return null fallback */
    return null;
  }
}

function listDeals() {
  try {
    if (!fs.existsSync(dealsDir)) {
      return [];
    }
    const files = fs
      .readdirSync(dealsDir)
      .filter((name) => name.endsWith(".json"))
      .toSorted();
    const deals = [];
    for (const fileName of files) {
      const fullPath = path.join(dealsDir, fileName);
      const payload = readJsonFile(fullPath);
      if (!payload || typeof payload !== "object") {
        continue;
      }
      deals.push(payload);
    }
    return deals;
  } catch (err) {
    logLine(`LIST_DEALS_ERROR: ${err?.message || String(err)}`);
    return [];
  }
}

function appendTriageLine(record) {
  ensureDirectory(triageDir);
  fs.appendFileSync(triageLedgerPath, `${JSON.stringify(record)}\n`, "utf8");
  // Emit to event log (JC-087c, normalized JC-092b)
  if (record.kind === "triage_item") {
    appendEvent("triage.ingested", "/triage/ingest", normalizeTriageEvent(record, "ingested"));
  } else if (record.kind === "TRIAGE_LINK") {
    appendEvent("triage.linked", "/triage/link", {
      item_id: record.item_id,
      linked_to: record.linked_to,
    });
  }
}

function readTriageLines() {
  try {
    if (!fs.existsSync(triageLedgerPath)) {
      return [];
    }
    const raw = fs.readFileSync(triageLedgerPath, "utf8");
    if (!raw.trim()) {
      return [];
    }
    const out = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) {
        continue;
      }
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === "object") {
          out.push(parsed);
        }
      } catch {
        // Skip malformed lines to keep the sidecar fail-closed and resilient.
      }
    }
    return out;
  } catch (err) {
    logLine(`READ_TRIAGE_LINES_ERROR: ${err?.message || String(err)}`);
    return [];
  }
}

function triageStateFromLines(lines) {
  const all = new Map();
  const open = new Map();
  for (const line of lines) {
    // Skip legacy AUDIT entries (now in separate audit_ledger — JC-087b)
    if (line.kind === "AUDIT") {
      continue;
    }
    const itemId = typeof line.item_id === "string" ? line.item_id.trim() : "";
    if (!itemId) {
      continue;
    }
    all.set(itemId, line);
    const resolved =
      line.kind === "TRIAGE_LINK" ||
      line.kind === "TRIAGE_RESOLVED" ||
      line.resolved === true ||
      typeof line.resolved_at === "string";
    if (resolved) {
      open.delete(itemId);
      continue;
    }
    open.set(itemId, {
      item_id: itemId,
      created_at: typeof line.created_at === "string" ? line.created_at : null,
      source: typeof line.source === "string" ? line.source : null,
      source_type: typeof line.source_type === "string" ? line.source_type : null,
      source_ref: typeof line.source_ref === "string" ? line.source_ref : null,
      summary: typeof line.summary === "string" ? line.summary : null,
      suggested_deal_id:
        typeof line.suggested_deal_id === "string" ? line.suggested_deal_id : undefined,
      suggested_task_id:
        typeof line.suggested_task_id === "string" ? line.suggested_task_id : undefined,
      payload: line.payload && typeof line.payload === "object" ? line.payload : undefined,
    });
  }
  return { all, open };
}

function listOpenTriageItems() {
  const lines = readTriageLines();
  const state = triageStateFromLines(lines);
  return [...state.open.values()];
}

function appendAudit(action, details) {
  const record = {
    kind: "AUDIT",
    action,
    at: new Date().toISOString(),
    details,
  };
  // Write to dedicated audit ledger (Phase 9 — JC-087b)
  fs.appendFileSync(auditLedgerPath, JSON.stringify(record) + "\n", "utf8");
  // Emit to centralized event log
  appendEvent("audit.action", "appendAudit", { action, ...details });
}

// ─── Event Log Foundation (Phase 9 — JC-087a) ───
// Centralized append-only event log. Every domain write should call appendEvent()
// in addition to its domain-specific ledger write (dual-write strategy).
function appendEvent(eventType, source, payload, traceId) {
  const event = {
    event_id: crypto.randomUUID(),
    event_type: eventType,
    timestamp: new Date().toISOString(),
    source,
    trace_id: traceId || null,
    payload: payload && typeof payload === "object" ? payload : {},
  };
  fs.appendFileSync(eventLogPath, JSON.stringify(event) + "\n", "utf8");
  return event.event_id;
}

function readEventLog(options) {
  const lines = readJsonlLines(eventLogPath);
  if (!options) {
    return lines;
  }
  let filtered = lines;
  if (options.event_type) {
    filtered = filtered.filter((e) => e.event_type === options.event_type);
  }
  if (options.since) {
    filtered = filtered.filter((e) => e.timestamp >= options.since);
  }
  if (options.trace_id) {
    filtered = filtered.filter((e) => e.trace_id === options.trace_id);
  }
  if (typeof options.limit === "number" && options.limit > 0) {
    filtered = filtered.slice(-options.limit);
  }
  return filtered;
}

function getEventLogStats() {
  const lines = readJsonlLines(eventLogPath);
  const typeCounts = {};
  let lastTimestamp = null;
  for (const event of lines) {
    const t = event.event_type || "unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    if (event.timestamp) {
      lastTimestamp = event.timestamp;
    }
  }
  return {
    total_events: lines.length,
    last_event_at: lastTimestamp,
    event_type_counts: typeCounts,
  };
}

// Event normalizers (JC-092a)
function normalizeMailEvent(rawMail, action) {
  return {
    message_id: rawMail.id || rawMail.message_id || null,
    subject: rawMail.subject || null,
    from: rawMail.from?.emailAddress?.address || rawMail.from || null,
    received_at: rawMail.receivedDateTime || null,
    action,
  };
}

function normalizeCalendarEvent(rawEvent, action) {
  return {
    event_id: rawEvent.id || rawEvent.event_id || null,
    subject: rawEvent.subject || null,
    start: rawEvent.start?.dateTime || rawEvent.start || null,
    end: rawEvent.end?.dateTime || rawEvent.end || null,
    action,
  };
}

function normalizeDealEvent(dealAction, deal) {
  return {
    deal_id: deal.deal_id || deal.id || null,
    deal_name: deal.deal_name || deal.name || null,
    entity: deal.entity || null,
    stage: deal.stage || null,
    action: dealAction,
  };
}

function normalizeTriageEvent(item, action) {
  return {
    item_id: item.item_id || null,
    source_type: item.source_type || null,
    entity: item.entity || null,
    urgency: item.urgency || null,
    action,
  };
}

function normalizePlannerTaskEvent(task, action) {
  return {
    task_id: task.id || null,
    title: task.title || null,
    plan_id: task.planId || null,
    bucket_id: task.bucketId || null,
    assigned_to: task.assignments ? Object.keys(task.assignments) : [],
    percent_complete: task.percentComplete ?? null,
    due_date: task.dueDateTime || null,
    action,
  };
}

function normalizeTodoTaskEvent(task, action) {
  return {
    task_id: task.id || null,
    title: task.title || null,
    status: task.status || null,
    importance: task.importance || null,
    due_date: task.dueDateTime?.dateTime || null,
    list_id: task.parentListId || task.list_id || null,
    action,
  };
}

function blockedExplainability(reasonCode, blockedAction, nextSafeStep) {
  return {
    blocked: true,
    reason_code: reasonCode,
    blocked_action: blockedAction,
    next_safe_step: nextSafeStep,
  };
}

function normalizeRoutePolicyKey(route) {
  if (typeof route !== "string" || route.length === 0) {
    return "";
  }
  const dynamicPatterns = [
    [/^\/deals\/[^/]+$/, "/deals/{deal_id}"],
    [/^\/deals\/[^/]+\/update$/, "/deals/{deal_id}/update"],
    [/^\/deals\/[^/]+\/dates$/, "/deals/{deal_id}/dates"],
    [/^\/deals\/[^/]+\/investors$/, "/deals/{deal_id}/investors"],
    [/^\/deals\/[^/]+\/investors\/update$/, "/deals/{deal_id}/investors/update"],
    [/^\/deals\/[^/]+\/counsel$/, "/deals/{deal_id}/counsel"],
    [/^\/deals\/[^/]+\/counsel\/invoice$/, "/deals/{deal_id}/counsel/invoice"],
    [/^\/deals\/[^/]+\/tasks$/, "/deals/{deal_id}/tasks"],
    [/^\/deals\/[^/]+\/tasks\/update$/, "/deals/{deal_id}/tasks/update"],
    [/^\/deals\/[^/]+\/checklist$/, "/deals/{deal_id}/checklist"],
    [/^\/deals\/[^/]+\/notes$/, "/deals/{deal_id}/notes"],
    [/^\/deals\/[^/]+\/timeline$/, "/deals/{deal_id}/timeline"],
    [/^\/deals\/stale-owners$/, "/deals/stale-owners"],
    [/^\/deals\/[^/]+\/retrospective$/, "/deals/{deal_id}/retrospective"],
    [/^\/triage\/[^/]+\/link$/, "/triage/{item_id}/link"],
    [/^\/filing\/suggestions\/[^/]+\/approve$/, "/filing/suggestions/{suggestion_id}/approve"],
    [/^\/triage\/patterns\/[^/]+\/approve$/, "/triage/patterns/{pattern_id}/approve"],
    [/^\/graph\/[^/]+\/status$/, "/graph/{profile_id}/status"],
    [/^\/graph\/[^/]+\/calendar\/list$/, "/graph/{profile_id}/calendar/list"],
    [/^\/graph\/[^/]+\/auth\/device\/start$/, "/graph/{profile_id}/auth/device/start"],
    [/^\/graph\/[^/]+\/auth\/device\/poll$/, "/graph/{profile_id}/auth/device/poll"],
    [/^\/graph\/[^/]+\/auth\/revoke$/, "/graph/{profile_id}/auth/revoke"],
    [/^\/graph\/[^/]+\/mail\/draft\/create$/, "/graph/{profile_id}/mail/draft/create"],
    [/^\/graph\/[^/]+\/drafts\/generate$/, "/graph/{profile_id}/drafts/generate"],
    [/^\/graph\/[^/]+\/mail\/list$/, "/graph/{profile_id}/mail/list"],
    [/^\/graph\/[^/]+\/mail\/[^/]+\/move$/, "/graph/{profile_id}/mail/{message_id}/move"],
    [/^\/graph\/[^/]+\/calendar\/event\/create$/, "/graph/{profile_id}/calendar/event/create"],
    [/^\/graph\/[^/]+\/planner\/plans$/, "/graph/{profile_id}/planner/plans"],
    [
      /^\/graph\/[^/]+\/planner\/plans\/[^/]+\/buckets$/,
      "/graph/{profile_id}/planner/plans/{plan_id}/buckets",
    ],
    [
      /^\/graph\/[^/]+\/planner\/plans\/[^/]+\/tasks$/,
      "/graph/{profile_id}/planner/plans/{plan_id}/tasks",
    ],
    [/^\/graph\/[^/]+\/todo\/lists$/, "/graph/{profile_id}/todo/lists"],
    [
      /^\/graph\/[^/]+\/todo\/lists\/[^/]+\/tasks$/,
      "/graph/{profile_id}/todo/lists/{list_id}/tasks",
    ],
    [
      /^\/graph\/[^/]+\/mail\/[^/]+\/extract-commitments$/,
      "/graph/{profile_id}/mail/{message_id}/extract-commitments",
    ],
    [/^\/graph\/[^/]+\/sync\/reconcile$/, "/graph/{profile_id}/sync/reconcile"],
    [/^\/graph\/[^/]+\/sync\/proposals$/, "/graph/{profile_id}/sync/proposals"],
    [
      /^\/graph\/[^/]+\/sync\/proposals\/[^/]+\/approve$/,
      "/graph/{profile_id}/sync/proposals/{proposal_id}/approve",
    ],
    [
      /^\/graph\/[^/]+\/sync\/proposals\/[^/]+\/reject$/,
      "/graph/{profile_id}/sync/proposals/{proposal_id}/reject",
    ],
    // Codex Builder Lane
    [/^\/improvement\/proposals\/[^/]+\/review$/, "/improvement/proposals/{proposal_id}/review"],
    [/^\/improvement\/proposals\/[^/]+\/apply$/, "/improvement/proposals/{proposal_id}/apply"],
    [/^\/ops\/builder-lane\/revert\/[^/]+$/, "/ops/builder-lane/revert/{proposal_id}"],
    [/^\/ops\/builder-lane\/shadow\/[^/]+$/, "/ops/builder-lane/shadow/{proposal_id}"],
    // C11-003: Missing route normalization entries
    [/^\/drafts\/[^/]+\/submit-review$/, "/drafts/{draft_id}/submit-review"],
    [/^\/graph\/[^/]+\/sync\/status$/, "/graph/{profile_id}/sync/status"],
    // C11-010: Additional route normalization entries
    [/^\/commitments\/[^/]+\/complete$/, "/commitments/{commitment_id}/complete"],
    [/^\/commitments\/[^/]+\/escalate$/, "/commitments/{commitment_id}/escalate"],
    [
      /^\/deals\/[^/]+\/investors\/[^/]+\/oig-update$/,
      "/deals/{deal_id}/investors/{investor_name}/oig-update",
    ],
    [/^\/facility\/alert\/[^/]+\/escalate$/, "/facility/alert/{alert_id}/escalate"],
    [/^\/facility\/alert\/[^/]+\/resolve$/, "/facility/alert/{alert_id}/resolve"],
    [/^\/gtd\/actions\/[^/]+\/complete$/, "/gtd/actions/{action_id}/complete"],
    [/^\/meeting\/prep\/[^/]+$/, "/meeting/prep/{event_id}"],
    [/^\/drafts\/[^/]+$/, "/drafts/{draft_id}"],
    [/^\/drafts\/[^/]+\/edit$/, "/drafts/{draft_id}/edit"],
    [/^\/drafts\/[^/]+\/approve$/, "/drafts/{draft_id}/approve"],
    [/^\/drafts\/[^/]+\/archive$/, "/drafts/{draft_id}/archive"],
    [/^\/drafts\/[^/]+\/execute$/, "/drafts/{draft_id}/execute"],
    // SharePoint routes
    [/^\/graph\/[^/]+\/sharepoint\/sites$/, "/graph/{profile_id}/sharepoint/sites"],
    [
      /^\/graph\/[^/]+\/sharepoint\/sites\/[^/]+\/drives$/,
      "/graph/{profile_id}/sharepoint/sites/{site_id}/drives",
    ],
    [
      /^\/graph\/[^/]+\/sharepoint\/drives\/[^/]+\/items$/,
      "/graph/{profile_id}/sharepoint/drives/{drive_id}/items",
    ],
    [
      /^\/graph\/[^/]+\/sharepoint\/drives\/[^/]+\/items\/[^/]+$/,
      "/graph/{profile_id}/sharepoint/drives/{drive_id}/items/{item_id}",
    ],
    [
      /^\/graph\/[^/]+\/sharepoint\/drives\/[^/]+\/search$/,
      "/graph/{profile_id}/sharepoint/drives/{drive_id}/search",
    ],
    [
      /^\/graph\/[^/]+\/sharepoint\/drives\/[^/]+\/upload$/,
      "/graph/{profile_id}/sharepoint/drives/{drive_id}/upload",
    ],
    [
      /^\/graph\/[^/]+\/sharepoint\/drives\/[^/]+\/folder$/,
      "/graph/{profile_id}/sharepoint/drives/{drive_id}/folder",
    ],
    // Self-Healing routes (SH-001 through SH-011)
    [/^\/ops\/self-healing\/status$/, "/ops/self-healing/status"],
    [/^\/ops\/self-healing\/circuit-breakers$/, "/ops/self-healing/circuit-breakers"],
    [/^\/ops\/self-healing\/provider-health$/, "/ops/self-healing/provider-health"],
    [/^\/ops\/self-healing\/config-drift\/reconcile$/, "/ops/self-healing/config-drift/reconcile"],
    [/^\/ops\/self-healing\/compact-ledgers$/, "/ops/self-healing/compact-ledgers"],
    [/^\/ops\/self-healing\/expire-proposals$/, "/ops/self-healing/expire-proposals"],
    [/^\/ops\/self-healing\/correction-taxonomy$/, "/ops/self-healing/correction-taxonomy"],
    [/^\/ops\/self-healing\/engagement-insights$/, "/ops/self-healing/engagement-insights"],
    [/^\/ops\/self-healing\/noise-level$/, "/ops/self-healing/noise-level"],
    [/^\/ops\/self-healing\/autonomy-status$/, "/ops/self-healing/autonomy-status"],
    [/^\/ops\/engagement\/read-receipt$/, "/ops/engagement/read-receipt"],
    [/^\/ops\/engagement\/action-receipt$/, "/ops/engagement/action-receipt"],
    [
      /^\/ops\/builder-lane\/proposals\/[^/]+\/resurrect$/,
      "/ops/builder-lane/proposals/{proposal_id}/resurrect",
    ],
  ];
  for (const [pattern, key] of dynamicPatterns) {
    if (pattern.test(route)) {
      return key;
    }
  }
  return route;
}

// Phase 16-21 — Planner + To Do + Sync helpers
const upnToUserIdCache = new Map();
async function resolveUpnToUserId(profileId, upn) {
  if (upnToUserIdCache.has(upn)) {
    return upnToUserIdCache.get(upn);
  }
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return null;
  }
  // H-5: Use ensureValidToken to proactively refresh before Graph API calls
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    return null;
  }
  const accessToken = tokenResult.accessToken;
  try {
    const resp = await graphFetchWithRetry(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(upn)}?$select=id,displayName`,
      {
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
      },
      { maxRetries: 1, label: "resolve_upn" },
    );
    if (!resp.ok) {
      return null;
    }
    const data = await resp.json();
    if (data.id) {
      upnToUserIdCache.set(upn, data.id);
      return data.id;
    }
    return null;
  } catch (err) {
    logLine(`GRAPH_RESOLVE_UPN_ERROR: ${upn} -- ${err?.message || String(err)}`);
    return null;
  }
}

function getPlannerConfig(profileId) {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, "config", "graph.profiles.json"), "utf-8"),
    );
    return raw.profiles?.[profileId]?.planner || null;
  } catch {
    /* intentional: config may not exist */ return null;
  }
}

function getTodoConfig(profileId) {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, "config", "graph.profiles.json"), "utf-8"),
    );
    return raw.profiles?.[profileId]?.todo || null;
  } catch {
    /* intentional: config may not exist */ return null;
  }
}

function getUserMapping(profileId) {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, "config", "graph.profiles.json"), "utf-8"),
    );
    return raw.profiles?.[profileId]?.user_mapping || {};
  } catch {
    /* intentional: config may not exist */ return {};
  }
}

function _getSharePointConfig(profileId) {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, "config", "graph.profiles.json"), "utf-8"),
    );
    return raw.profiles?.[profileId]?.sharepoint || null;
  } catch {
    /* intentional: config may not exist */ return null;
  }
}

const executionBoundaryPolicy = new Map(
  [
    "/deals/create",
    "/deals/list",
    "/deals/{deal_id}",
    "/deals/{deal_id}/update",
    "/deals/{deal_id}/dates",
    "/deals/{deal_id}/investors",
    "/deals/{deal_id}/investors/update",
    "/deals/{deal_id}/counsel",
    "/deals/{deal_id}/counsel/invoice",
    "/deals/{deal_id}/tasks",
    "/deals/{deal_id}/tasks/update",
    "/deals/{deal_id}/checklist",
    "/deals/{deal_id}/notes",
    "/deals/{deal_id}/timeline",
    "/deals/stale-owners",
    "/deals/{deal_id}/retrospective",
    "/triage/list",
    "/triage/ingest",
    "/triage/{item_id}/link",
    "/governance/role-cards/validate",
    "/governance/hard-bans/check",
    "/governance/output/validate",
    "/governance/entity/check",
    "/governance/confidence/evaluate",
    "/governance/contradictions/check",
    "/governance/escalations/route",
    "/governance/repair/simulate",
    "/ops/pause",
    "/ops/dispatch/check",
    "/ops/resume",
    "/ops/resume/last",
    "/ops/rate/evaluate",
    "/ops/retry/evaluate",
    "/learning/modifiers/evaluate",
    "/learning/meetings/capture",
    "/filing/suggestions/propose",
    "/filing/suggestions/list",
    "/filing/suggestions/{suggestion_id}/approve",
    "/triage/patterns",
    "/triage/patterns/propose",
    "/triage/patterns/{pattern_id}/approve",
    "/graph/{profile_id}/status",
    "/graph/{profile_id}/calendar/list",
    "/graph/{profile_id}/auth/device/start",
    "/graph/{profile_id}/auth/device/poll",
    "/graph/{profile_id}/auth/revoke",
    "/graph/{profile_id}/mail/draft/create",
    "/graph/{profile_id}/drafts/generate",
    "/graph/{profile_id}/mail/list",
    "/graph/{profile_id}/mail/{message_id}/move",
    "/graph/{profile_id}/calendar/event/create",
    "/extraction/deadlines",
    "/reporting/morning-brief",
    "/reporting/eod-digest",
    "/graph/diagnostics/classify",
    "/graph/{profile_id}/planner/plans",
    "/graph/{profile_id}/planner/plans/{plan_id}/buckets",
    "/graph/{profile_id}/planner/plans/{plan_id}/tasks",
    "/graph/{profile_id}/todo/lists",
    "/graph/{profile_id}/todo/lists/{list_id}/tasks",
    "/graph/{profile_id}/mail/{message_id}/extract-commitments",
    "/graph/{profile_id}/sync/reconcile",
    "/graph/{profile_id}/sync/proposals",
    "/graph/{profile_id}/sync/proposals/{proposal_id}/approve",
    "/graph/{profile_id}/sync/proposals/{proposal_id}/reject",
  ].map((key) => [key, "WORKFLOW_ONLY"]),
);
executionBoundaryPolicy.set("/learning/affinity/route", "ADAPTIVE_ALLOWED");
executionBoundaryPolicy.set("/auth/mint", "WORKFLOW_ONLY");
// Codex Builder Lane — improvement proposals + trust autonomy
executionBoundaryPolicy.set("/improvement/proposals", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/improvement/proposals/{proposal_id}/review", "APPROVAL_FIRST");
executionBoundaryPolicy.set("/improvement/proposals/{proposal_id}/apply", "APPROVAL_FIRST");
executionBoundaryPolicy.set("/improvement/proposals/generate", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/improvement/failure-aggregation", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/trust/autonomy/evaluate", "WORKFLOW_ONLY");
// Builder Lane — pattern detection, generation, revert, status, metrics, calibration
executionBoundaryPolicy.set("/ops/builder-lane/patterns", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/builder-lane/generate", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/builder-lane/revert/{proposal_id}", "APPROVAL_FIRST");
executionBoundaryPolicy.set("/ops/builder-lane/status", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/builder-lane/improvement-metrics", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/builder-lane/calibration-response", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/builder-lane/shadow/{proposal_id}", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/builder-lane/amplify", "APPROVAL_FIRST");
executionBoundaryPolicy.set("/ops/onboarding/archetype-select", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/onboarding/voice-extract", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/onboarding/voice-extract-status", "WORKFLOW_ONLY");
// JC-110: Architecture closure routes
executionBoundaryPolicy.set("/drafts/{draft_id}/submit-review", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/deep-work/session", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/graph/{profile_id}/sync/status", "WORKFLOW_ONLY");
// MF-6: Scheduler routes
executionBoundaryPolicy.set("/ops/scheduler", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/pending-deliveries", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/pending-deliveries/ack", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/ingestion/run", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/ingestion/status", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/onboarding/discover", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/onboarding/discovery-status", "WORKFLOW_ONLY");
// C11-010: Missing route boundary policies
executionBoundaryPolicy.set("/ops/onboarding/activate", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/setup/validate", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/llm-provider", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/notification-budget", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/meeting/upcoming", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/meeting/prep/{event_id}", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/meeting/debrief", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/commitments/create", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/commitments/list", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/commitments/{commitment_id}/complete", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/commitments/{commitment_id}/escalate", "WORKFLOW_ONLY");
executionBoundaryPolicy.set(
  "/deals/{deal_id}/investors/{investor_name}/oig-update",
  "WORKFLOW_ONLY",
);
executionBoundaryPolicy.set("/facility/alert/create", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/facility/alerts/list", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/facility/alert/{alert_id}/escalate", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/facility/alert/{alert_id}/resolve", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/gtd/actions/create", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/gtd/actions/list", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/gtd/actions/{action_id}/complete", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/gtd/waiting-for/create", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/gtd/waiting-for/list", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/planning/timeblock/generate", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/filing/para/classify", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/filing/para/structure", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/reporting/deep-work-metrics", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/reporting/trust-metrics", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/events/stats", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/events/recent", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/drafts/queue", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/drafts/{draft_id}", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/drafts/{draft_id}/edit", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/drafts/{draft_id}/approve", "APPROVAL_FIRST");
executionBoundaryPolicy.set("/drafts/{draft_id}/archive", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/drafts/{draft_id}/execute", "APPROVAL_FIRST");
// SharePoint routes
executionBoundaryPolicy.set("/graph/{profile_id}/sharepoint/sites", "WORKFLOW_ONLY");
executionBoundaryPolicy.set(
  "/graph/{profile_id}/sharepoint/sites/{site_id}/drives",
  "WORKFLOW_ONLY",
);
executionBoundaryPolicy.set(
  "/graph/{profile_id}/sharepoint/drives/{drive_id}/items",
  "WORKFLOW_ONLY",
);
executionBoundaryPolicy.set(
  "/graph/{profile_id}/sharepoint/drives/{drive_id}/items/{item_id}",
  "WORKFLOW_ONLY",
);
executionBoundaryPolicy.set(
  "/graph/{profile_id}/sharepoint/drives/{drive_id}/search",
  "WORKFLOW_ONLY",
);
executionBoundaryPolicy.set(
  "/graph/{profile_id}/sharepoint/drives/{drive_id}/upload",
  "APPROVAL_FIRST",
);
executionBoundaryPolicy.set(
  "/graph/{profile_id}/sharepoint/drives/{drive_id}/folder",
  "APPROVAL_FIRST",
);
// Self-Healing routes (SH-001 through SH-006)
executionBoundaryPolicy.set("/ops/self-healing/status", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/self-healing/circuit-breakers", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/self-healing/provider-health", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/self-healing/config-drift/reconcile", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/self-healing/compact-ledgers", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/self-healing/expire-proposals", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/builder-lane/proposals/{proposal_id}/resurrect", "WORKFLOW_ONLY");
// Phase B Self-Healing routes (SH-007 through SH-011)
executionBoundaryPolicy.set("/ops/self-healing/correction-taxonomy", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/engagement/read-receipt", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/engagement/action-receipt", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/self-healing/engagement-insights", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/self-healing/noise-level", "WORKFLOW_ONLY");
executionBoundaryPolicy.set("/ops/self-healing/autonomy-status", "WORKFLOW_ONLY");

function requestedExecutionMode(req) {
  const raw = req.headers["x-ted-execution-mode"];
  const value =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim().toUpperCase() : "DETERMINISTIC";
  if (!EXECUTION_MODE_VALUES.has(value)) {
    return { ok: false, mode: value };
  }
  return { ok: true, mode: value };
}

function checkExecutionBoundary(routeKey, mode) {
  const policy = executionBoundaryPolicy.get(routeKey);
  if (!policy) {
    return {
      ok: false,
      status_code: 409,
      payload: blockedExplainability(
        "UNDECLARED_EXECUTION_BOUNDARY",
        "route_execution",
        "Declare route execution boundary before enabling this operation.",
      ),
    };
  }
  if (policy === "WORKFLOW_ONLY" && mode === "ADAPTIVE") {
    return {
      ok: false,
      status_code: 409,
      payload: blockedExplainability(
        "OUT_OF_CONTRACT_EXECUTION_MODE",
        "adaptive_execution",
        "Retry with deterministic execution mode for this route.",
      ),
    };
  }
  return { ok: true, policy };
}

function cleanupExpiredMintedTokens() {
  const now = Date.now();
  for (const [token, expiry] of mintedBearerTokens.entries()) {
    if (!Number.isFinite(expiry) || expiry <= now) {
      mintedBearerTokens.delete(token);
    }
  }
}

function cleanupExpiredIdempotencyEntries() {
  const now = Date.now();
  for (const [cacheKey, entry] of idempotencyCache.entries()) {
    if (!entry || !Number.isFinite(entry.expires_at_ms) || entry.expires_at_ms <= now) {
      idempotencyCache.delete(cacheKey);
    }
  }
}

function mintBearerToken() {
  const token = `ted-${Date.now().toString(36)}-${crypto.randomBytes(12).toString("hex")}`;
  const expiresAtMs = Date.now() + AUTH_TTL_MS;
  mintedBearerTokens.set(token, expiresAtMs);
  return { token, expires_at_ms: expiresAtMs };
}

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string") {
    return "";
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function isValidBearerToken(token) {
  if (!token) {
    return false;
  }
  if (STATIC_BEARER_TOKEN && token === STATIC_BEARER_TOKEN) {
    return true;
  }
  cleanupExpiredMintedTokens();
  const expiry = mintedBearerTokens.get(token);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    return false;
  }
  return true;
}

function idempotencyCacheKey(routeKey, key) {
  return `${routeKey}::${key}`;
}

function idempotencyKeyFromRequest(req) {
  const raw = req.headers["x-idempotency-key"];
  if (typeof raw !== "string") {
    return "";
  }
  const value = raw.trim();
  if (value.length === 0 || value.length > 128) {
    return "";
  }
  return value;
}

function getIdempotentReplay(routeKey, key) {
  cleanupExpiredIdempotencyEntries();
  const cacheKey = idempotencyCacheKey(routeKey, key);
  const cached = idempotencyCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  return cached;
}

function storeIdempotentReplay(routeKey, key, statusCode, responseBody) {
  const cacheKey = idempotencyCacheKey(routeKey, key);
  idempotencyCache.set(cacheKey, {
    status_code: statusCode,
    response_body: responseBody,
    expires_at_ms: Date.now() + IDEMPOTENCY_TTL_MS,
  });
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRoleCardPayload(roleCard) {
  if (!roleCard || typeof roleCard !== "object") {
    return {
      ok: false,
      reason_code: "INVALID_ROLE_CARD",
      blocked_action: "role_card_validation",
      next_safe_step: "Provide a JSON role card object.",
    };
  }

  const requiredStringFields = ["role_id", "domain"];
  for (const field of requiredStringFields) {
    if (!isNonEmptyString(roleCard[field])) {
      return {
        ok: false,
        reason_code: "ROLE_CARD_MISSING_REQUIRED_FIELD",
        blocked_action: "role_card_validation",
        next_safe_step: `Provide non-empty ${field}.`,
      };
    }
  }

  const requiredArrayFields = [
    "inputs",
    "outputs",
    "definition_of_done",
    "hard_bans",
    "escalation",
  ];
  for (const field of requiredArrayFields) {
    const value = roleCard[field];
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.some((item) => !isNonEmptyString(item))
    ) {
      return {
        ok: false,
        reason_code: "ROLE_CARD_INVALID_SECTION",
        blocked_action: "role_card_validation",
        next_safe_step: `Provide non-empty string items for ${field}.`,
      };
    }
  }

  return { ok: true };
}

function validateOutputContractPayload(output) {
  if (!output || typeof output !== "object") {
    return {
      ok: false,
      reason_code: "INVALID_OUTPUT_CONTRACT",
      blocked_action: "output_contract_validation",
      next_safe_step: "Provide a JSON output contract object.",
    };
  }

  const requiredFields = [
    "title",
    "summary",
    "recommended_actions",
    "questions",
    "citations",
    "entity_tag",
    "audience",
  ];
  for (const field of requiredFields) {
    if (!(field in output)) {
      return {
        ok: false,
        reason_code: "OUTPUT_CONTRACT_MISSING_FIELD",
        blocked_action: "output_contract_validation",
        next_safe_step: `Add missing required field ${field}.`,
      };
    }
  }

  if (!isNonEmptyString(output.title) || !isNonEmptyString(output.summary)) {
    return {
      ok: false,
      reason_code: "OUTPUT_CONTRACT_INVALID_TEXT",
      blocked_action: "output_contract_validation",
      next_safe_step: "Provide non-empty title and summary fields.",
    };
  }

  if (
    !Array.isArray(output.recommended_actions) ||
    !Array.isArray(output.questions) ||
    !Array.isArray(output.citations)
  ) {
    return {
      ok: false,
      reason_code: "OUTPUT_CONTRACT_INVALID_ARRAYS",
      blocked_action: "output_contract_validation",
      next_safe_step: "Ensure recommended_actions, questions, and citations are arrays.",
    };
  }

  if (!output.entity_tag || typeof output.entity_tag !== "object") {
    return {
      ok: false,
      reason_code: "OUTPUT_CONTRACT_INVALID_ENTITY_TAG",
      blocked_action: "output_contract_validation",
      next_safe_step: "Provide entity_tag object with required governance fields.",
    };
  }

  if (!isNonEmptyString(output.entity_tag.primary_entity)) {
    return {
      ok: false,
      reason_code: "OUTPUT_CONTRACT_INVALID_ENTITY_TAG",
      blocked_action: "output_contract_validation",
      next_safe_step: "Set entity_tag.primary_entity to a valid scoped entity.",
    };
  }

  if (!isNonEmptyString(output.audience)) {
    return {
      ok: false,
      reason_code: "OUTPUT_CONTRACT_INVALID_AUDIENCE",
      blocked_action: "output_contract_validation",
      next_safe_step: "Provide the target audience identifier.",
    };
  }

  return { ok: true };
}

function validateEntityProvenanceCheckPayload(body) {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      reason_code: "INVALID_ENTITY_CHECK_REQUEST",
      blocked_action: "entity_provenance_check",
      next_safe_step: "Provide objects array and optional target_entity in JSON body.",
    };
  }
  if (!Array.isArray(body.objects) || body.objects.length === 0) {
    return {
      ok: false,
      reason_code: "OBJECTS_REQUIRED",
      blocked_action: "entity_provenance_check",
      next_safe_step: "Provide at least one object with id/entity_tag/provenance.",
    };
  }
  if (typeof body.target_entity !== "undefined" && !isNonEmptyString(body.target_entity)) {
    return {
      ok: false,
      reason_code: "INVALID_TARGET_ENTITY",
      blocked_action: "entity_provenance_check",
      next_safe_step: "Use a non-empty target_entity when provided.",
    };
  }
  return { ok: true };
}

async function validateRoleCardEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const roleCard = body?.role_card;
  const result = validateRoleCardPayload(roleCard);
  if (!result.ok) {
    appendAudit("GOV_ROLE_CARD_BLOCK", {
      reason_code: result.reason_code,
      blocked_action: result.blocked_action,
    });
    sendJson(
      res,
      400,
      blockedExplainability(result.reason_code, result.blocked_action, result.next_safe_step),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  appendAudit("GOV_ROLE_CARD_PASS", { role_id: roleCard.role_id });
  sendJson(res, 200, { valid: true, role_id: roleCard.role_id });
  logLine(`POST ${route} -> 200`);
}

async function checkHardBansEndpoint(req, res, route) {
  const hardBansCfg = getHardBansConfig();
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_HARD_BAN_CHECK_REQUEST",
        "hard_ban_check",
        "Provide role_card and candidate_output in JSON body.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  const roleCardResult = validateRoleCardPayload(body.role_card);
  if (!roleCardResult.ok) {
    sendJson(
      res,
      400,
      blockedExplainability(
        roleCardResult.reason_code,
        "hard_ban_check",
        "Fix role_card structure before evaluating hard bans.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }

  const outputText =
    typeof body.candidate_output === "string" ? body.candidate_output.toLowerCase() : "";
  if (!outputText) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_CANDIDATE_OUTPUT",
        "hard_ban_check",
        "Provide non-empty candidate_output text.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }

  const matchedBans = body.role_card.hard_bans.filter((ban) =>
    outputText.includes(String(ban).toLowerCase()),
  );
  if (matchedBans.length > 0) {
    appendAudit("GOV_HARD_BAN_BLOCK", { matched_bans: matchedBans });
    sendJson(res, 409, {
      ...blockedExplainability(
        "HARD_BAN_VIOLATION",
        "candidate_output_release",
        "Revise candidate output to remove banned behavior and resubmit.",
      ),
      matched_bans: matchedBans,
    });
    logLine(`POST ${route} -> 409`);
    return;
  }

  // Also check config-level hard bans
  const configBans = hardBansCfg?.hard_ban_strings || [];
  if (configBans.length > 0 && typeof body.candidate_output === "string") {
    const configBlocked = [];
    for (const ban of configBans) {
      if (
        typeof ban === "string" &&
        body.candidate_output.toLowerCase().includes(ban.toLowerCase())
      ) {
        configBlocked.push({ ban, source: "operator_config" });
      }
    }
    if (configBlocked.length > 0) {
      appendAudit("HARD_BAN_CONFIG_BLOCK", { blocked_count: configBlocked.length });
      sendJson(res, 409, {
        status: "BLOCKED",
        blocked: configBlocked,
        source: "operator_config_hard_bans",
      });
      logLine(`POST ${route} -> 409`);
      return;
    }
  }

  appendAudit("GOV_HARD_BAN_PASS", { role_id: body.role_card.role_id });
  sendJson(res, 200, { allowed: true });
  logLine(`POST ${route} -> 200`);
}

async function validateOutputContractEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const output = body?.output;
  const result = validateOutputContractPayload(output);
  if (!result.ok) {
    appendAudit("GOV_OUTPUT_CONTRACT_BLOCK", {
      reason_code: result.reason_code,
      blocked_action: result.blocked_action,
    });
    sendJson(
      res,
      400,
      blockedExplainability(result.reason_code, result.blocked_action, result.next_safe_step),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  appendAudit("GOV_OUTPUT_CONTRACT_PASS", { audience: output.audience });
  sendJson(res, 200, { valid: true });
  logLine(`POST ${route} -> 200`);
}

async function checkEntityProvenanceEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const requestValidation = validateEntityProvenanceCheckPayload(body);
  if (!requestValidation.ok) {
    appendAudit("GOV_ENTITY_CHECK_BLOCK", {
      reason_code: requestValidation.reason_code,
      blocked_action: requestValidation.blocked_action,
    });
    sendJson(
      res,
      400,
      blockedExplainability(
        requestValidation.reason_code,
        requestValidation.blocked_action,
        requestValidation.next_safe_step,
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }

  const targetEntity = isNonEmptyString(body.target_entity) ? body.target_entity.trim() : null;
  const missingMetadataIds = [];
  const offendingObjectIds = [];

  for (const raw of body.objects) {
    const obj = raw && typeof raw === "object" ? raw : {};
    const objectId = isNonEmptyString(obj.id) ? obj.id.trim() : "unknown_object";
    const primaryEntity = obj?.entity_tag?.primary_entity;
    const sourceType = obj?.provenance?.source_type;
    const sourceId = obj?.provenance?.source_id;
    const retrievedAt = obj?.provenance?.retrieved_at;
    if (
      !isNonEmptyString(primaryEntity) ||
      !isNonEmptyString(sourceType) ||
      !isNonEmptyString(sourceId) ||
      !isNonEmptyString(retrievedAt)
    ) {
      missingMetadataIds.push(objectId);
      continue;
    }
    if (targetEntity && primaryEntity.trim() !== targetEntity) {
      offendingObjectIds.push(objectId);
    }
  }

  if (missingMetadataIds.length > 0) {
    appendAudit("GOV_ENTITY_CHECK_BLOCK", {
      reason_code: "MISSING_ENTITY_OR_PROVENANCE",
      object_ids: missingMetadataIds,
    });
    sendJson(res, 409, {
      ...blockedExplainability(
        "MISSING_ENTITY_OR_PROVENANCE",
        "entity_provenance_check",
        "Populate entity_tag.primary_entity and provenance fields for all objects.",
      ),
      object_ids: missingMetadataIds,
    });
    logLine(`POST ${route} -> 409`);
    return;
  }

  if (offendingObjectIds.length > 0) {
    appendAudit("GOV_ENTITY_CHECK_BLOCK", {
      reason_code: "CROSS_ENTITY_BLOCK",
      target_entity: targetEntity,
      object_ids: offendingObjectIds,
    });
    sendJson(res, 409, {
      ...blockedExplainability(
        "CROSS_ENTITY_BLOCK",
        "cross_entity_render",
        "Remove offending objects or route output to the matching entity audience.",
      ),
      target_entity: targetEntity,
      object_ids: offendingObjectIds,
    });
    logLine(`POST ${route} -> 409`);
    return;
  }

  appendAudit("GOV_ENTITY_CHECK_PASS", { target_entity: targetEntity });
  sendJson(res, 200, { allowed: true, target_entity: targetEntity });
  logLine(`POST ${route} -> 200`);
}

async function evaluateConfidenceEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const thresholdRaw = Number(body?.threshold ?? 0.8);
  const threshold = Number.isFinite(thresholdRaw) ? Math.max(0, Math.min(1, thresholdRaw)) : 0.8;
  const items = Array.isArray(body?.extracted_items) ? body.extracted_items : [];
  if (items.length === 0) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "EXTRACTED_ITEMS_REQUIRED",
        "confidence_evaluation",
        "Provide extracted_items with confidence scores and source references.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }

  const escalatedItems = [];
  const autoReadyItems = [];
  for (const raw of items) {
    const item = raw && typeof raw === "object" ? raw : {};
    const confidenceRaw = Number(item.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;
    const itemId = isNonEmptyString(item.item_id) ? item.item_id.trim() : "unknown_item";
    const sourceRefs = Array.isArray(item.source_refs) ? item.source_refs : [];
    const risky = item.risky === true;
    if (confidence < threshold) {
      escalatedItems.push({
        item_id: itemId,
        reason_code: "LOW_CONFIDENCE",
        confidence,
        source_refs: sourceRefs,
        question: "Please confirm extracted action before apply.",
      });
      continue;
    }
    autoReadyItems.push({
      item_id: itemId,
      confidence,
      source_refs: sourceRefs,
      requires_approval: risky,
    });
  }

  const escalationRequired = escalatedItems.length > 0;
  appendAudit("GOV_CONFIDENCE_EVALUATE", {
    threshold,
    escalated_count: escalatedItems.length,
    auto_ready_count: autoReadyItems.length,
  });
  sendJson(res, 200, {
    threshold,
    escalation_required: escalationRequired,
    escalated_items: escalatedItems,
    auto_ready_items: autoReadyItems,
  });
  logLine(`POST ${route} -> 200`);
}

async function checkContradictionsEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const candidate = body?.candidate_commitment;
  const priorCommitments = Array.isArray(body?.prior_commitments) ? body.prior_commitments : [];
  if (!candidate || typeof candidate !== "object" || priorCommitments.length === 0) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_CONTRADICTION_REQUEST",
        "contradiction_check",
        "Provide candidate_commitment and prior_commitments array.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  const candidateField = isNonEmptyString(candidate.field) ? candidate.field.trim() : "";
  const candidateValue = isNonEmptyString(candidate.value) ? candidate.value.trim() : "";
  if (!candidateField || !candidateValue) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_CANDIDATE_COMMITMENT",
        "contradiction_check",
        "Provide candidate_commitment.field and candidate_commitment.value.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }

  const contradictions = [];
  for (const raw of priorCommitments) {
    const prior = raw && typeof raw === "object" ? raw : {};
    const priorField = isNonEmptyString(prior.field) ? prior.field.trim() : "";
    const priorValue = isNonEmptyString(prior.value) ? prior.value.trim() : "";
    if (!priorField || !priorValue || priorField !== candidateField) {
      continue;
    }
    if (priorValue === candidateValue) {
      continue;
    }
    contradictions.push({
      field: candidateField,
      candidate_value: candidateValue,
      prior_value: priorValue,
      source_id: isNonEmptyString(prior.source_id) ? prior.source_id.trim() : null,
      citation: isNonEmptyString(prior.citation) ? prior.citation.trim() : null,
    });
  }

  if (contradictions.length > 0) {
    appendAudit("GOV_CONTRADICTION_BLOCK", {
      field: candidateField,
      contradiction_count: contradictions.length,
    });
    sendJson(res, 409, {
      ...blockedExplainability(
        "CONTRADICTION_DETECTED",
        "draft_commitment_release",
        "Resolve contradiction or escalate for operator certification.",
      ),
      contradictions,
    });
    logLine(`POST ${route} -> 409`);
    return;
  }

  appendAudit("GOV_CONTRADICTION_PASS", { field: candidateField });
  sendJson(res, 200, { contradictions_found: false });
  logLine(`POST ${route} -> 200`);
}

async function routeEscalationEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const riskLevel = isNonEmptyString(body?.risk_level) ? body.risk_level.trim().toUpperCase() : "";
  if (!["LOW", "MEDIUM", "HIGH"].includes(riskLevel)) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_RISK_LEVEL",
        "escalation_routing",
        "Set risk_level to LOW, MEDIUM, or HIGH.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  const reasons = Array.isArray(body?.reasons)
    ? body.reasons.filter((value) => isNonEmptyString(value))
    : [];
  const mustEscalate = riskLevel === "HIGH" || riskLevel === "MEDIUM" || reasons.length > 0;
  const routeTarget = mustEscalate ? "approval_queue" : "operator_review";
  appendAudit("GOV_ESCALATION_ROUTE", {
    risk_level: riskLevel,
    route_target: routeTarget,
    reasons_count: reasons.length,
    item_id: isNonEmptyString(body?.item_id) ? body.item_id.trim() : null,
  });
  sendJson(res, 200, {
    escalated: mustEscalate,
    route_target: routeTarget,
    no_execute: true,
    reason_codes: reasons,
  });
  logLine(`POST ${route} -> 200`);
}

async function pauseAutomationEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const reason = isNonEmptyString(body?.reason) ? body.reason.trim() : "operator_pause";
  automationPauseState = {
    ...automationPauseState,
    paused: true,
    paused_at_ms: Date.now(),
    reason,
  };
  appendJsonlLine(opsLedgerPath, {
    kind: "ops_pause",
    paused_at_ms: automationPauseState.paused_at_ms,
    reason,
    at: new Date().toISOString(),
  });
  appendEvent("ops.paused", "/ops/pause", { reason });
  appendAudit("OPS_AUTOMATION_PAUSE", { reason });
  sendJson(res, 200, {
    paused: true,
    reason,
    queued_non_critical: automationPauseState.queued_non_critical,
  });
  logLine(`POST ${route} -> 200`);
}

async function dispatchCheckEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const priority = isNonEmptyString(body?.priority) ? body.priority.trim().toUpperCase() : "";
  if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(priority)) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_PRIORITY",
        "dispatch_check",
        "Set priority to CRITICAL, HIGH, MEDIUM, or LOW.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }

  if (automationPauseState.paused && priority !== "CRITICAL") {
    automationPauseState = {
      ...automationPauseState,
      queued_non_critical: automationPauseState.queued_non_critical + 1,
    };
    appendJsonlLine(opsLedgerPath, {
      kind: "ops_dispatch_queued",
      priority,
      at: new Date().toISOString(),
    });
    appendEvent("ops.dispatch.queued", "/ops/dispatch", {
      priority,
      queued_non_critical: automationPauseState.queued_non_critical,
    });
    appendAudit("OPS_DISPATCH_QUEUED", {
      priority,
      reason_code: "PAUSE_ACTIVE",
      queued_non_critical: automationPauseState.queued_non_critical,
    });
    sendJson(res, 409, {
      ...blockedExplainability(
        "PAUSE_ACTIVE",
        "non_critical_dispatch",
        "Resume automation or run action manually if urgent.",
      ),
      queued_non_critical: automationPauseState.queued_non_critical,
    });
    logLine(`POST ${route} -> 409`);
    return;
  }

  appendAudit("OPS_DISPATCH_ALLOWED", { priority, paused: automationPauseState.paused });
  sendJson(res, 200, { allowed: true, priority });
  logLine(`POST ${route} -> 200`);
}

function resumeAutomationEndpoint(res, route) {
  const now = Date.now();
  const pausedSeconds =
    automationPauseState.paused && automationPauseState.paused_at_ms > 0
      ? Math.max(0, Math.floor((now - automationPauseState.paused_at_ms) / 1000))
      : 0;
  const catchUpSummary = {
    paused_seconds: pausedSeconds,
    queued_non_critical: automationPauseState.queued_non_critical,
    next_action: "Process queued non-critical work in priority order.",
    generated_at: new Date(now).toISOString(),
  };
  lastCatchUpSummary = catchUpSummary;
  appendJsonlLine(opsLedgerPath, {
    kind: "ops_resume",
    catch_up_summary: catchUpSummary,
    at: new Date().toISOString(),
  });
  appendEvent("ops.resumed", "/ops/resume", catchUpSummary);
  appendAudit("OPS_AUTOMATION_RESUME", catchUpSummary);
  automationPauseState = {
    paused: false,
    paused_at_ms: 0,
    reason: null,
    queued_non_critical: 0,
  };
  sendJson(res, 200, {
    resumed: true,
    catch_up_summary: catchUpSummary,
  });
  logLine(`POST ${route} -> 200`);
}

function getLastResumeSummaryEndpoint(res, route) {
  sendJson(res, 200, {
    available: !!lastCatchUpSummary,
    catch_up_summary: lastCatchUpSummary,
  });
  logLine(`GET ${route} -> 200`);
}

async function evaluateRatePolicyEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const quotaPercentRaw = Number(body?.quota_percent);
  const quotaPercent = Number.isFinite(quotaPercentRaw) ? quotaPercentRaw : NaN;
  const priority = isNonEmptyString(body?.priority) ? body.priority.trim().toUpperCase() : "";
  if (!Number.isFinite(quotaPercent) || quotaPercent < 0 || quotaPercent > 100) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_QUOTA_PERCENT",
        "rate_policy_evaluation",
        "Set quota_percent between 0 and 100.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(priority)) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_PRIORITY",
        "rate_policy_evaluation",
        "Set priority to CRITICAL, HIGH, MEDIUM, or LOW.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }

  let action = "ALLOW";
  let reasonCode = "WITHIN_BUDGET";
  if (quotaPercent > 80 && (priority === "LOW" || priority === "MEDIUM")) {
    action = "DEFER";
    reasonCode = "QUOTA_PRESSURE";
  }
  appendAudit("OPS_RATE_POLICY_EVALUATE", {
    quota_percent: quotaPercent,
    priority,
    action,
    reason_code: reasonCode,
  });
  sendJson(res, 200, {
    quota_percent: quotaPercent,
    priority,
    action,
    reason_code: reasonCode,
  });
  logLine(`POST ${route} -> 200`);
}

async function evaluateRetryPolicyEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const priority = isNonEmptyString(body?.priority) ? body.priority.trim().toUpperCase() : "";
  const attemptRaw = Number(body?.attempt);
  const attempt = Number.isFinite(attemptRaw) ? Math.floor(attemptRaw) : NaN;
  if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(priority)) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_PRIORITY",
        "retry_policy_evaluation",
        "Set priority to CRITICAL, HIGH, MEDIUM, or LOW.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!Number.isFinite(attempt) || attempt < 1 || attempt > 20) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_ATTEMPT",
        "retry_policy_evaluation",
        "Set attempt to an integer between 1 and 20.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  const maxByPriority = {
    CRITICAL: 6,
    HIGH: 5,
    MEDIUM: 4,
    LOW: 3,
  };
  const maxAttempts = maxByPriority[priority];
  const stopped = attempt >= maxAttempts;
  const baseBackoffMs = Math.min(60000, 1000 * 2 ** (attempt - 1));
  const multiplier = priority === "LOW" ? 2 : priority === "MEDIUM" ? 1.5 : 1;
  const retryAfterMs = Math.floor(baseBackoffMs * multiplier);
  const response = {
    priority,
    attempt,
    max_attempts: maxAttempts,
    action: stopped ? "STOP" : "RETRY",
    retry_after_ms: stopped ? null : retryAfterMs,
    reason_code: stopped ? "RETRY_LIMIT_REACHED" : "RETRY_ALLOWED",
  };
  appendAudit("OPS_RETRY_POLICY_EVALUATE", response);
  sendJson(res, 200, response);
  logLine(`POST ${route} -> 200`);
}

async function simulateFastRepairEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const proposalId = isNonEmptyString(body?.proposal_id) ? body.proposal_id.trim() : "";
  const correction = isNonEmptyString(body?.correction) ? body.correction.trim() : "";
  if (!proposalId || !correction) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_REPAIR_REQUEST",
        "fast_repair_simulation",
        "Provide proposal_id and correction text.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  // Deterministic simulated latency for repeatable proofing.
  const elapsedMs = 3200;
  const response = {
    proposal_id: proposalId,
    corrected: true,
    elapsed_ms: elapsedMs,
    explainability: {
      blocked_action: "proposal_execution",
      reason_code: "OPERATOR_CORRECTION_APPLIED",
      next_safe_step: "Review corrected proposal and certify when ready.",
    },
  };
  appendAudit("GOV_FAST_REPAIR_SIMULATION", {
    proposal_id: proposalId,
    elapsed_ms: elapsedMs,
  });
  sendJson(res, 200, response);
  logLine(`POST ${route} -> 200`);
}

function checksumText(text) {
  let sum = 0;
  for (let i = 0; i < text.length; i += 1) {
    sum = (sum + text.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return String(sum);
}

function deriveDeterministicModifiers(metrics) {
  const draftAcceptanceRateRaw = Number(metrics?.draft_acceptance_rate);
  const triageReductionRateRaw = Number(metrics?.triage_reduction_rate);
  const recurrenceRateRaw = Number(metrics?.recurrence_rate);
  const draftAcceptanceRate = Number.isFinite(draftAcceptanceRateRaw) ? draftAcceptanceRateRaw : 0;
  const triageReductionRate = Number.isFinite(triageReductionRateRaw) ? triageReductionRateRaw : 0;
  const recurrenceRate = Number.isFinite(recurrenceRateRaw) ? recurrenceRateRaw : 0;

  const modifiers = [];
  const reasons = [];
  if (draftAcceptanceRate >= 0.8) {
    modifiers.push("Favor concise draft structures that previously passed without edits.");
    reasons.push("DRAFT_ACCEPTANCE_HIGH");
  }
  if (triageReductionRate >= 0.2) {
    modifiers.push("Prefer routing patterns that reduced unresolved triage volume.");
    reasons.push("TRIAGE_REDUCTION_HIGH");
  }
  if (recurrenceRate >= 0.15) {
    modifiers.push("Escalate recurring error patterns before applying downstream actions.");
    reasons.push("ERROR_RECURRENCE_ELEVATED");
  }

  return {
    modifiers: modifiers.slice(0, 3),
    reasons: reasons.slice(0, 3),
    metrics_snapshot: {
      draft_acceptance_rate: draftAcceptanceRate,
      triage_reduction_rate: triageReductionRate,
      recurrence_rate: recurrenceRate,
    },
  };
}

async function evaluateLearningModifiersEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const roleId = isNonEmptyString(body?.role_id) ? body.role_id.trim() : "";
  if (!roleId) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_ROLE_ID",
        "learning_modifiers_evaluate",
        "Provide non-empty role_id.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  const derived = deriveDeterministicModifiers(body?.metrics || {});
  const signature = checksumText(
    JSON.stringify({ role_id: roleId, ...derived.metrics_snapshot, reasons: derived.reasons }),
  );
  appendAudit("LEARNING_MODIFIERS_EVALUATE", {
    role_id: roleId,
    reason_codes: derived.reasons,
    signature,
  });
  sendJson(res, 200, {
    role_id: roleId,
    modifiers: derived.modifiers,
    reason_codes: derived.reasons,
    reversible: true,
    deterministic_signature: signature,
    no_policy_override: true,
  });
  logLine(`POST ${route} -> 200`);
}

async function affinityRouteEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const enabled = body?.enabled !== false;
  const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
  if (candidates.length === 0) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "CANDIDATES_REQUIRED",
        "affinity_routing",
        "Provide candidates array with candidate_id and base_score.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  const affinityMap = new Map();
  if (Array.isArray(body?.affinities)) {
    for (const raw of body.affinities) {
      const item = raw && typeof raw === "object" ? raw : {};
      const candidateId = isNonEmptyString(item.candidate_id) ? item.candidate_id.trim() : "";
      const affinityRaw = Number(item.affinity);
      if (!candidateId || !Number.isFinite(affinityRaw)) {
        continue;
      }
      affinityMap.set(candidateId, Math.max(0, Math.min(1, affinityRaw)));
    }
  }

  const excluded = [];
  const ranked = [];
  for (const raw of candidates) {
    const candidate = raw && typeof raw === "object" ? raw : {};
    const candidateId = isNonEmptyString(candidate.candidate_id)
      ? candidate.candidate_id.trim()
      : "";
    const baseScoreRaw = Number(candidate.base_score);
    const baseScore = Number.isFinite(baseScoreRaw) ? baseScoreRaw : 0;
    if (!candidateId) {
      continue;
    }
    if (candidate.policy_blocked === true) {
      excluded.push({ candidate_id: candidateId, reason_code: "POLICY_BLOCKED" });
      continue;
    }
    const affinityScore = enabled ? affinityMap.get(candidateId) || 0 : 0;
    ranked.push({
      candidate_id: candidateId,
      score: baseScore + affinityScore * 0.1,
      base_score: baseScore,
      affinity_score: affinityScore,
    });
  }

  ranked.sort((a, b) => {
    if (b.score === a.score) {
      return a.candidate_id.localeCompare(b.candidate_id);
    }
    return b.score - a.score;
  });

  appendAudit("LEARNING_AFFINITY_ROUTE", {
    enabled,
    ranked_count: ranked.length,
    excluded_count: excluded.length,
  });
  sendJson(res, 200, {
    affinity_enabled: enabled,
    ordered_candidate_ids: ranked.map((item) => item.candidate_id),
    ranked_candidates: ranked,
    excluded,
    no_policy_override: true,
  });
  logLine(`POST ${route} -> 200`);
}

async function captureMeetingSummaryEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const meetingId = isNonEmptyString(body?.meeting_id) ? body.meeting_id.trim() : "";
  if (!meetingId) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "INVALID_MEETING_ID",
        "meeting_capture",
        "Provide non-empty meeting_id.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (body?.excluded === true) {
    appendAudit("MEETING_CAPTURE_SKIPPED", {
      meeting_id: meetingId,
      reason_code: "EXCLUDED_MEETING",
    });
    sendJson(res, 200, {
      meeting_id: meetingId,
      processed: false,
      status: "SKIPPED_EXCLUDED",
      reason_code: "EXCLUDED_MEETING",
    });
    logLine(`POST ${route} -> 200`);
    return;
  }

  const transcript = isNonEmptyString(body?.transcript) ? body.transcript.trim() : "";
  const lines = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const summary =
    lines.length > 0 ? lines[0].slice(0, 220) : "Meeting captured with no transcript details.";
  const actionItems = lines
    .filter((line) => line.toUpperCase().startsWith("ACTION:"))
    .map((line) => line.slice(7).trim())
    .filter(Boolean)
    .slice(0, 8);
  appendAudit("MEETING_CAPTURE_PROCESSED", {
    meeting_id: meetingId,
    action_items_count: actionItems.length,
    deal_id: isNonEmptyString(body?.deal_id) ? body.deal_id.trim() : null,
    task_id: isNonEmptyString(body?.task_id) ? body.task_id.trim() : null,
  });
  sendJson(res, 200, {
    meeting_id: meetingId,
    processed: true,
    summary,
    action_items: actionItems,
    linkage: {
      deal_id: isNonEmptyString(body?.deal_id) ? body.deal_id.trim() : null,
      task_id: isNonEmptyString(body?.task_id) ? body.task_id.trim() : null,
    },
  });
  logLine(`POST ${route} -> 200`);
}

function appendPatternEvent(event) {
  ensureDirectory(patternsDir);
  fs.appendFileSync(patternsLedgerPath, `${JSON.stringify(event)}\n`, "utf8");
  // Emit to event log (JC-087c)
  const eventType =
    event.kind === "pattern_proposed"
      ? "pattern.proposed"
      : event.kind === "pattern_approved"
        ? "pattern.approved"
        : "pattern.unknown";
  appendEvent(eventType, "appendPatternEvent", {
    pattern_id: event.pattern_id,
    pattern_type: event.pattern_type,
  });
}

function appendFilingSuggestionEvent(event) {
  ensureDirectory(filingDir);
  fs.appendFileSync(filingSuggestionsPath, `${JSON.stringify(event)}\n`, "utf8");
  // Emit to event log (JC-087c)
  const eventType =
    event.kind === "filing_suggestion_proposed"
      ? "filing.suggestion.proposed"
      : event.kind === "filing_suggestion_approved"
        ? "filing.suggestion.approved"
        : "filing.unknown";
  appendEvent(eventType, "appendFilingSuggestionEvent", { suggestion_id: event.suggestion_id });
}

function readPatternEvents() {
  try {
    if (!fs.existsSync(patternsLedgerPath)) {
      return [];
    }
    const raw = fs.readFileSync(patternsLedgerPath, "utf8");
    if (!raw.trim()) {
      return [];
    }
    const out = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) {
        continue;
      }
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === "object") {
          out.push(parsed);
        }
      } catch {
        /* intentional: skip malformed JSONL line */
      }
    }
    return out;
  } catch (err) {
    logLine(`READ_PATTERN_EVENTS_ERROR: ${err?.message || String(err)}`);
    return [];
  }
}

function readFilingSuggestionEvents() {
  try {
    if (!fs.existsSync(filingSuggestionsPath)) {
      return [];
    }
    const raw = fs.readFileSync(filingSuggestionsPath, "utf8");
    if (!raw.trim()) {
      return [];
    }
    const out = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) {
        continue;
      }
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === "object") {
          out.push(parsed);
        }
      } catch {
        /* intentional: skip malformed JSONL line */
      }
    }
    return out;
  } catch (err) {
    logLine(`READ_FILING_SUGGESTIONS_ERROR: ${err?.message || String(err)}`);
    return [];
  }
}

function buildFilingSuggestionState() {
  const state = new Map();
  for (const event of readFilingSuggestionEvents()) {
    const suggestionId = typeof event.suggestion_id === "string" ? event.suggestion_id.trim() : "";
    if (!suggestionId) {
      continue;
    }
    if (event.kind === "filing_suggestion_proposed") {
      state.set(suggestionId, {
        suggestion_id: suggestionId,
        status: "PROPOSED",
        deal_id: typeof event.deal_id === "string" ? event.deal_id : undefined,
        triage_item_id: typeof event.triage_item_id === "string" ? event.triage_item_id : undefined,
        source_type: typeof event.source_type === "string" ? event.source_type : "",
        source_ref: typeof event.source_ref === "string" ? event.source_ref : "",
        suggested_path: typeof event.suggested_path === "string" ? event.suggested_path : "",
        rationale: typeof event.rationale === "string" ? event.rationale : undefined,
        created_at: typeof event.at === "string" ? event.at : null,
      });
      continue;
    }
    if (event.kind === "filing_suggestion_approved") {
      const existing = state.get(suggestionId);
      if (!existing) {
        continue;
      }
      state.set(suggestionId, {
        ...existing,
        status: "APPROVED",
        approved_at: typeof event.at === "string" ? event.at : null,
        approved_by: typeof event.approved_by === "string" ? event.approved_by : "",
      });
    }
  }
  return [...state.values()];
}

function listFilingSuggestions(parsedUrl, res, route) {
  const includeApproved = parsedUrl.searchParams.get("include_approved") === "true";
  const all = buildFilingSuggestionState();
  const suggestions = includeApproved ? all : all.filter((s) => s.status === "PROPOSED");
  sendJson(res, 200, { suggestions });
  logLine(`GET ${route} -> 200`);
}

async function proposeFilingSuggestion(req, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const idempotencyKey = idempotencyKeyFromRequest(req);
  if (idempotencyKey) {
    const replay = getIdempotentReplay(routeKey, idempotencyKey);
    if (replay) {
      sendJson(res, replay.status_code, {
        ...replay.response_body,
        deduped: true,
        idempotency_key: idempotencyKey,
      });
      logLine(`POST ${route} -> ${replay.status_code}`);
      return;
    }
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const sourceType = typeof body.source_type === "string" ? body.source_type.trim() : "";
  const sourceRef = typeof body.source_ref === "string" ? body.source_ref.trim() : "";
  const dealId = typeof body.deal_id === "string" ? body.deal_id.trim() : "";
  const triageItemId = typeof body.triage_item_id === "string" ? body.triage_item_id.trim() : "";
  const suggestedPath = typeof body.suggested_path === "string" ? body.suggested_path.trim() : "";
  const rationale = typeof body.rationale === "string" ? body.rationale.trim() : "";

  if (!sourceType) {
    sendJson(res, 400, { error: "invalid_source_type" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!sourceRef) {
    sendJson(res, 400, { error: "invalid_source_ref" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!suggestedPath) {
    sendJson(res, 400, { error: "invalid_suggested_path" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!dealId && !triageItemId) {
    sendJson(res, 400, { error: "deal_id_or_triage_item_id_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (dealId && !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (triageItemId && !isSlugSafe(triageItemId)) {
    sendJson(res, 400, { error: "invalid_triage_item_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const now = new Date().toISOString();
  const rand = Math.random().toString(36).slice(2, 8);
  const suggestionId = `fs-${Date.now()}-${rand}`;
  appendFilingSuggestionEvent({
    kind: "filing_suggestion_proposed",
    suggestion_id: suggestionId,
    source_type: sourceType,
    source_ref: sourceRef,
    deal_id: dealId || undefined,
    triage_item_id: triageItemId || undefined,
    suggested_path: suggestedPath,
    rationale: rationale || undefined,
    at: now,
  });
  appendAudit("FILING_SUGGESTION_PROPOSE", {
    suggestion_id: suggestionId,
    deal_id: dealId || undefined,
    triage_item_id: triageItemId || undefined,
  });
  const responseBody = {
    proposed: true,
    suggestion_id: suggestionId,
    status: "PROPOSED",
    deduped: false,
    idempotency_key: idempotencyKey || undefined,
  };
  if (idempotencyKey) {
    storeIdempotentReplay(routeKey, idempotencyKey, 200, responseBody);
    sendJson(res, 200, responseBody);
    logLine(`POST ${route} -> 200`);
    return;
  }
  sendJson(res, 201, responseBody);
  logLine(`POST ${route} -> 201`);
}

async function approveFilingSuggestion(suggestionId, req, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const idempotencyKey = idempotencyKeyFromRequest(req);
  if (idempotencyKey) {
    const replay = getIdempotentReplay(routeKey, idempotencyKey);
    if (replay) {
      sendJson(res, replay.status_code, {
        ...replay.response_body,
        deduped: true,
        idempotency_key: idempotencyKey,
      });
      logLine(`POST ${route} -> ${replay.status_code}`);
      return;
    }
  }
  if (!suggestionId || !isSlugSafe(suggestionId)) {
    sendJson(res, 400, { error: "invalid_suggestion_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const approvedBy = typeof body?.approved_by === "string" ? body.approved_by.trim() : "";
  if (!approvedBy) {
    sendJson(res, 400, { error: "invalid_approved_by" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const all = buildFilingSuggestionState();
  const existing = all.find((s) => s.suggestion_id === suggestionId);
  if (!existing || existing.status !== "PROPOSED") {
    sendJson(res, 404, {
      error: "suggestion_not_found_or_not_proposed",
      suggestion_id: suggestionId,
    });
    logLine(`POST ${route} -> 404`);
    return;
  }

  const now = new Date().toISOString();
  appendFilingSuggestionEvent({
    kind: "filing_suggestion_approved",
    suggestion_id: suggestionId,
    approved_by: approvedBy,
    at: now,
  });
  appendAudit("FILING_SUGGESTION_APPROVE", {
    suggestion_id: suggestionId,
    approved_by: approvedBy,
  });
  const responseBody = {
    approved: true,
    suggestion_id: suggestionId,
    status: "APPROVED",
    deduped: false,
    idempotency_key: idempotencyKey || undefined,
  };
  if (idempotencyKey) {
    storeIdempotentReplay(routeKey, idempotencyKey, 200, responseBody);
  }
  sendJson(res, 200, responseBody);
  logLine(`POST ${route} -> 200`);
}

function buildPatternState() {
  const proposed = new Map();
  const active = new Map();
  for (const event of readPatternEvents()) {
    const patternId = typeof event.pattern_id === "string" ? event.pattern_id.trim() : "";
    if (!patternId) {
      continue;
    }
    if (event.kind === "pattern_proposed") {
      proposed.set(patternId, {
        pattern_id: patternId,
        pattern_type: typeof event.pattern_type === "string" ? event.pattern_type : "",
        match: event.match && typeof event.match === "object" ? event.match : {},
        suggest: event.suggest && typeof event.suggest === "object" ? event.suggest : {},
        notes: typeof event.notes === "string" ? event.notes : "",
        proposed_at: typeof event.at === "string" ? event.at : null,
      });
      continue;
    }
    if (event.kind === "pattern_approved") {
      const existing = proposed.get(patternId) || active.get(patternId);
      if (!existing) {
        continue;
      }
      active.set(patternId, {
        ...existing,
        approved_at: typeof event.at === "string" ? event.at : null,
        approved_by: typeof event.approved_by === "string" ? event.approved_by : "",
      });
      proposed.delete(patternId);
    }
  }
  return {
    active: [...active.values()],
    proposed: [...proposed.values()],
  };
}

function extractEmailDomainFromSourceRef(sourceRef) {
  if (typeof sourceRef !== "string") {
    return "";
  }
  const match = sourceRef.match(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  return (match?.[1] || "").toLowerCase();
}

function suggestFromActivePatterns(sourceRef) {
  const domain = extractEmailDomainFromSourceRef(sourceRef);
  if (!domain) {
    return {};
  }
  const activePatterns = buildPatternState().active;
  for (const pattern of activePatterns) {
    if (pattern.pattern_type !== "SENDER_DOMAIN_TO_DEAL") {
      continue;
    }
    const patternDomain =
      typeof pattern?.match?.domain === "string" ? pattern.match.domain.toLowerCase() : "";
    if (!patternDomain || patternDomain !== domain) {
      continue;
    }
    const suggestedDealId =
      typeof pattern?.suggest?.deal_id === "string" ? pattern.suggest.deal_id : "";
    const suggestedTaskId =
      typeof pattern?.suggest?.task_id === "string" ? pattern.suggest.task_id : "";
    return {
      suggested_deal_id: suggestedDealId || undefined,
      suggested_task_id: suggestedTaskId || undefined,
    };
  }
  return {};
}

function listPatternsEndpoint(res, route) {
  sendJson(res, 200, buildPatternState());
  logLine(`GET ${route} -> 200`);
}

async function proposePattern(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const patternType = typeof body.pattern_type === "string" ? body.pattern_type.trim() : "";
  const match = body.match && typeof body.match === "object" ? body.match : null;
  const suggest = body.suggest && typeof body.suggest === "object" ? body.suggest : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!patternType || !match || !suggest) {
    sendJson(res, 400, { error: "invalid_pattern_payload" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const now = new Date().toISOString();
  const rand = Math.random().toString(36).slice(2, 8);
  const patternId = `pat-${Date.now()}-${rand}`;
  appendPatternEvent({
    kind: "pattern_proposed",
    pattern_id: patternId,
    pattern_type: patternType,
    match,
    suggest,
    notes: notes || undefined,
    at: now,
  });
  appendAudit("PATTERN_PROPOSE", {
    pattern_type: body.pattern_type || "unknown",
    source_ref: body.source_ref || null,
  });
  sendJson(res, 201, { proposed: true, pattern_id: patternId });
  logLine(`POST ${route} -> 201`);
}

async function approvePattern(patternId, req, res, route) {
  if (!patternId || !isSlugSafe(patternId)) {
    sendJson(res, 400, { error: "invalid_pattern_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const approvedBy = typeof body?.approved_by === "string" ? body.approved_by.trim() : "";
  if (!approvedBy) {
    sendJson(res, 400, { error: "invalid_approved_by" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const state = buildPatternState();
  const proposed = state.proposed.find((p) => p.pattern_id === patternId);
  if (!proposed) {
    sendJson(res, 404, { error: "pattern_not_found", pattern_id: patternId });
    logLine(`POST ${route} -> 404`);
    return;
  }

  appendPatternEvent({
    kind: "pattern_approved",
    pattern_id: patternId,
    pattern_type: proposed.pattern_type,
    match: proposed.match,
    suggest: proposed.suggest,
    notes: proposed.notes || undefined,
    approved_by: approvedBy,
    at: new Date().toISOString(),
  });
  appendAudit("PATTERN_APPROVE", { pattern_id: patternId });
  sendJson(res, 200, { approved: true, pattern_id: patternId });
  logLine(`POST ${route} -> 200`);
}

async function createDeal(req, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const idempotencyKey = idempotencyKeyFromRequest(req);
  if (idempotencyKey) {
    const replay = getIdempotentReplay(routeKey, idempotencyKey);
    if (replay) {
      sendJson(res, replay.status_code, {
        ...replay.response_body,
        deduped: true,
        idempotency_key: idempotencyKey,
      });
      logLine(`POST ${route} -> ${replay.status_code}`);
      return;
    }
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const dealId = typeof body.deal_id === "string" ? body.deal_id.trim() : "";
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  ensureDirectory(dealsDir);
  const filePath = getDealPath(dealId);
  if (fs.existsSync(filePath)) {
    sendJson(res, 409, { error: "deal_exists", deal_id: dealId });
    logLine(`POST ${route} -> 409`);
    return;
  }

  const now = new Date().toISOString();
  const dealType =
    typeof body.deal_type === "string" && VALID_DEAL_TYPES.has(body.deal_type.trim())
      ? body.deal_type.trim()
      : null;
  const stage =
    typeof body.stage === "string" && VALID_DEAL_STAGES.includes(body.stage.trim())
      ? body.stage.trim()
      : "deal_identified";
  const entity =
    typeof body.entity === "string" && body.entity.trim().length > 0
      ? body.entity.trim()
      : "Olumie";
  const status =
    typeof body.status === "string" && VALID_DEAL_STATUSES.has(body.status.trim())
      ? body.status.trim()
      : "active";
  const dealName = typeof body.deal_name === "string" ? body.deal_name.trim() : "";

  const deal = {
    deal_id: dealId,
    deal_name: dealName,
    deal_type: dealType,
    entity,
    stage,
    status,
    important_dates: [],
    investors: [],
    outside_counsel: [],
    team_tasks: [],
    dd_checklist: [],
    notes: [],
    created_at: now,
    updated_at: now,
    // C12-004: Deal owner responsiveness tracking
    last_touched_by:
      typeof body.operator_name === "string" ? body.operator_name.trim() : "operator",
    last_touched_at: now,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_CREATE", { deal_id: dealId });
  // JC-092c: Normalized deal create events
  appendJsonlLine(dealsEventsPath, {
    kind: "deal_created",
    deal_id: dealId,
    ...normalizeDealEvent("created", deal),
    last_touched_by: deal.last_touched_by,
    last_touched_at: deal.last_touched_at,
    at: new Date().toISOString(),
  });
  appendEvent("deal.created", "/deals/create", normalizeDealEvent("created", deal));
  // C12-006: Auto-generate skeleton brief on deal creation
  try {
    const _briefConfig = JSON.parse(fs.readFileSync(briefConfigPath, "utf-8"));
    const skeletonBrief = {
      deal_id: dealId,
      deal_name: deal.deal_name || dealId,
      generated_at: new Date().toISOString(),
      source: "template",
      stage: deal.stage || "lead",
      sections: {
        overview: deal.description || "TBD — awaiting initial briefing",
        key_contacts: deal.contacts || [],
        stage_status: `Currently at ${deal.stage || "lead"} stage`,
        next_actions: "TBD — operator to define initial next steps",
        key_dates: deal.key_dates || [],
        risks_and_blockers: "TBD — awaiting initial assessment",
        financial_summary: "TBD — awaiting deal terms",
        regulatory_status: "TBD — awaiting jurisdictional review",
      },
    };
    const briefPath = path.join(dealsDir, dealId, "brief.json");
    fs.mkdirSync(path.join(dealsDir, dealId), { recursive: true });
    fs.writeFileSync(briefPath, JSON.stringify(skeletonBrief, null, 2));
    appendJsonlLine(dealsEventsPath, {
      kind: "deal_brief_auto_generated",
      deal_id: dealId,
      source: "template",
      at: new Date().toISOString(),
    });
    appendEvent("deal.brief.auto_generated", route, { deal_id: dealId, source: "template" });
    logLine(`  Auto-generated skeleton brief for deal ${dealId}`);
  } catch (briefErr) {
    logLine(
      `  WARN: Failed to auto-generate brief for deal ${dealId}: ${briefErr?.message || String(briefErr)}`,
    );
  }
  const responseBody = {
    created: true,
    deal_id: dealId,
    deduped: false,
    idempotency_key: idempotencyKey || undefined,
  };
  if (idempotencyKey) {
    storeIdempotentReplay(routeKey, idempotencyKey, 200, responseBody);
  }
  sendJson(res, 200, responseBody);
  logLine(`POST ${route} -> 200`);
}

async function updateDeal(req, res, route, dealId) {
  const _routeKey = normalizeRoutePolicyKey(route);
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }

  const warnings = [];
  const oldStage = deal.stage || null; // JC-092c: capture pre-mutation stage

  if (typeof body.deal_name === "string") {
    deal.deal_name = body.deal_name.trim();
  }
  if (typeof body.deal_type === "string") {
    if (VALID_DEAL_TYPES.has(body.deal_type.trim())) {
      deal.deal_type = body.deal_type.trim();
    } else {
      sendJson(res, 400, { error: "invalid_deal_type", valid: [...VALID_DEAL_TYPES] });
      logLine(`POST ${route} -> 400`);
      return;
    }
  }
  if (typeof body.stage === "string") {
    const transition = isValidStageTransition(deal.stage, body.stage.trim());
    if (!transition.ok) {
      sendJson(res, 400, {
        error: "invalid_stage_transition",
        reason: transition.reason,
        valid_stages: VALID_DEAL_STAGES,
      });
      logLine(`POST ${route} -> 400`);
      return;
    }
    if (transition.warning) {
      warnings.push(transition.warning);
    }
    deal.stage = body.stage.trim();
  }
  if (typeof body.status === "string") {
    if (VALID_DEAL_STATUSES.has(body.status.trim())) {
      deal.status = body.status.trim();
    } else {
      sendJson(res, 400, { error: "invalid_deal_status", valid: [...VALID_DEAL_STATUSES] });
      logLine(`POST ${route} -> 400`);
      return;
    }
  }
  if (typeof body.entity === "string" && body.entity.trim().length > 0) {
    deal.entity = body.entity.trim();
  }

  deal.updated_at = new Date().toISOString();
  // C12-004: Update deal owner responsiveness tracking on mutation
  deal.last_touched_by =
    typeof body.operator_name === "string"
      ? body.operator_name.trim()
      : deal.last_touched_by || "operator";
  deal.last_touched_at = deal.updated_at;
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_UPDATE", { deal_id: dealId, fields: Object.keys(body) });
  // JC-092c: Emit normalized deal stage change event when stage changed
  if (typeof body.stage === "string" && oldStage !== deal.stage) {
    appendJsonlLine(dealsEventsPath, {
      kind: "deal_stage_changed",
      deal_id: dealId,
      from_stage: oldStage,
      to_stage: deal.stage,
      last_touched_by: deal.last_touched_by,
      last_touched_at: deal.last_touched_at,
      at: new Date().toISOString(),
    });
    appendEvent("deal.stage.changed", "/deals/update", {
      deal_id: dealId,
      from_stage: oldStage,
      to_stage: deal.stage,
    });
  }
  sendJson(res, 200, { updated: true, deal_id: dealId, warnings });
  logLine(`POST ${route} -> 200`);
}

function getDeal(dealId, res, route) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`GET ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`GET ${route} -> 404`);
    return;
  }
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`GET ${route} -> 404`);
    return;
  }
  sendJson(res, 200, deal);
  logLine(`GET ${route} -> 200`);
}

function listDealsEndpoint(res, route) {
  const now = Date.now();
  const deals = listDeals()
    .map((deal) => {
      let nextMilestone = null;
      if (Array.isArray(deal.important_dates) && deal.important_dates.length > 0) {
        const sorted = deal.important_dates
          .filter((d) => d && typeof d.date === "string")
          .map((d) => ({ ...d, _ts: new Date(d.date).getTime() }))
          .filter((d) => !Number.isNaN(d._ts))
          .toSorted((a, b) => a._ts - b._ts);
        const future = sorted.find((d) => d._ts >= now);
        const pick = future || sorted[sorted.length - 1];
        if (pick) {
          nextMilestone = { label: pick.label, date: pick.date, type: pick.type };
        }
      }
      return {
        deal_id: typeof deal.deal_id === "string" ? deal.deal_id : null,
        deal_name: typeof deal.deal_name === "string" ? deal.deal_name : undefined,
        deal_type: typeof deal.deal_type === "string" ? deal.deal_type : null,
        stage: typeof deal.stage === "string" ? deal.stage : null,
        status: typeof deal.status === "string" ? deal.status : undefined,
        entity: typeof deal.entity === "string" ? deal.entity : undefined,
        next_milestone: nextMilestone,
        updated_at: typeof deal.updated_at === "string" ? deal.updated_at : undefined,
      };
    })
    .filter((deal) => typeof deal.deal_id === "string");
  sendJson(res, 200, { deals });
  logLine(`GET ${route} -> 200`);
}

// --- DW-004: Important dates ---
async function addDealDate(req, res, route, dealId) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const dateType = typeof body.type === "string" ? body.type.trim() : "custom";
  const validDateTypes = new Set([
    "deposit_deadline",
    "dd_period_end",
    "closing_date",
    "psa_milestone",
    "custom",
  ]);
  if (!label || !date) {
    sendJson(res, 400, { error: "missing_label_or_date" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!validDateTypes.has(dateType)) {
    sendJson(res, 400, { error: "invalid_date_type", valid: [...validDateTypes] });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!Array.isArray(deal.important_dates)) {
    deal.important_dates = [];
  }
  const existing = deal.important_dates.findIndex((d) => d.label === label);
  const entry = { label, date, type: dateType };
  if (existing >= 0) {
    deal.important_dates[existing] = entry;
  } else {
    deal.important_dates.push(entry);
  }
  deal.updated_at = new Date().toISOString();
  // C12-004: Update deal owner responsiveness tracking on mutation
  deal.last_touched_by =
    typeof body.operator_name === "string"
      ? body.operator_name.trim()
      : deal.last_touched_by || "operator";
  deal.last_touched_at = deal.updated_at;
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_DATE_ADD", { deal_id: dealId, label, date, type: dateType });
  appendJsonlLine(dealsEventsPath, {
    kind: "deal_date_added",
    deal_id: dealId,
    date_type: dateType,
    date_value: date,
    timestamp: new Date().toISOString(),
  });
  appendEvent("deal.date.added", route, { deal_id: dealId, date_type: dateType, date_value: date });
  sendJson(res, 200, { added: true, deal_id: dealId, date_entry: entry });
  logLine(`POST ${route} -> 200`);
}

// --- DW-005: Investors ---
async function addDealInvestor(req, res, route, dealId) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    sendJson(res, 400, { error: "missing_investor_name" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!Array.isArray(deal.investors)) {
    deal.investors = [];
  }
  if (deal.investors.some((inv) => inv.name === name)) {
    sendJson(res, 409, { error: "investor_exists", name });
    logLine(`POST ${route} -> 409`);
    return;
  }
  const investor = {
    name,
    oig_status: "pending",
    oig_checked_at: null,
    state_exclusion_status: "pending",
    state_exclusion_checked_at: null,
    disclosure_form_sent: false,
  };
  deal.investors.push(investor);
  deal.updated_at = new Date().toISOString();
  // C12-004: Update deal owner responsiveness tracking on mutation
  deal.last_touched_by =
    typeof body.operator_name === "string"
      ? body.operator_name.trim()
      : deal.last_touched_by || "operator";
  deal.last_touched_at = deal.updated_at;
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_INVESTOR_ADD", { deal_id: dealId, name });
  appendJsonlLine(dealsEventsPath, {
    kind: "deal_investor_added",
    deal_id: dealId,
    investor_name: name,
    timestamp: new Date().toISOString(),
  });
  // JC-092c: Normalized investor add event
  appendEvent("deal.investor.added", "/deals/investors/add", {
    deal_id: dealId,
    investor_name: name,
  });
  sendJson(res, 200, { added: true, deal_id: dealId, investor });
  logLine(`POST ${route} -> 200`);
}

async function updateDealInvestor(req, res, route, dealId) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    sendJson(res, 400, { error: "missing_investor_name" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!Array.isArray(deal.investors)) {
    sendJson(res, 404, { error: "investor_not_found", name });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const idx = deal.investors.findIndex((inv) => inv.name === name);
  if (idx < 0) {
    sendJson(res, 404, { error: "investor_not_found", name });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const validStatuses = new Set(["pending", "clear", "hit"]);
  const inv = deal.investors[idx];
  if (typeof body.oig_status === "string" && validStatuses.has(body.oig_status)) {
    inv.oig_status = body.oig_status;
    inv.oig_checked_at = new Date().toISOString();
  }
  if (
    typeof body.state_exclusion_status === "string" &&
    validStatuses.has(body.state_exclusion_status)
  ) {
    inv.state_exclusion_status = body.state_exclusion_status;
    inv.state_exclusion_checked_at = new Date().toISOString();
  }
  if (typeof body.disclosure_form_sent === "boolean") {
    inv.disclosure_form_sent = body.disclosure_form_sent;
  }
  deal.updated_at = new Date().toISOString();
  // C12-004: Update deal owner responsiveness tracking on mutation
  deal.last_touched_by =
    typeof body.operator_name === "string"
      ? body.operator_name.trim()
      : deal.last_touched_by || "operator";
  deal.last_touched_at = deal.updated_at;
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_INVESTOR_UPDATE", { deal_id: dealId, name, fields: Object.keys(body) });
  appendJsonlLine(dealsEventsPath, {
    kind: "deal_investor_updated",
    deal_id: dealId,
    investor_name: name,
    updates: Object.keys(body),
    timestamp: new Date().toISOString(),
  });
  appendEvent("deal.investor.updated", route, { deal_id: dealId, investor_name: name });
  sendJson(res, 200, { updated: true, deal_id: dealId, investor: inv });
  logLine(`POST ${route} -> 200`);
}

// --- DW-006: Outside counsel ---
async function addDealCounsel(req, res, route, dealId) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const firmName = typeof body.firm_name === "string" ? body.firm_name.trim() : "";
  const matter = typeof body.matter === "string" ? body.matter.trim() : "";
  if (!firmName) {
    sendJson(res, 400, { error: "missing_firm_name" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!Array.isArray(deal.outside_counsel)) {
    deal.outside_counsel = [];
  }
  if (deal.outside_counsel.some((c) => c.firm_name === firmName)) {
    sendJson(res, 409, { error: "counsel_exists", firm_name: firmName });
    logLine(`POST ${route} -> 409`);
    return;
  }
  const counsel = { firm_name: firmName, matter, total_spend: 0, invoices: [] };
  deal.outside_counsel.push(counsel);
  deal.updated_at = new Date().toISOString();
  // C12-004: Update deal owner responsiveness tracking on mutation
  deal.last_touched_by =
    typeof body.operator_name === "string"
      ? body.operator_name.trim()
      : deal.last_touched_by || "operator";
  deal.last_touched_at = deal.updated_at;
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_COUNSEL_ADD", { deal_id: dealId, firm_name: firmName });
  appendJsonlLine(dealsEventsPath, {
    kind: "deal_counsel_added",
    deal_id: dealId,
    firm_name: firmName,
    role: matter,
    timestamp: new Date().toISOString(),
  });
  appendEvent("deal.counsel.added", route, { deal_id: dealId, firm_name: firmName, role: matter });
  sendJson(res, 200, { added: true, deal_id: dealId, counsel });
  logLine(`POST ${route} -> 200`);
}

async function addCounselInvoice(req, res, route, dealId) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const firmName = typeof body.firm_name === "string" ? body.firm_name.trim() : "";
  const amount = typeof body.amount === "number" ? body.amount : 0;
  const date =
    typeof body.date === "string" ? body.date.trim() : new Date().toISOString().slice(0, 10);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!firmName) {
    sendJson(res, 400, { error: "missing_firm_name" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!Array.isArray(deal.outside_counsel)) {
    deal.outside_counsel = [];
  }
  const counselIdx = deal.outside_counsel.findIndex((c) => c.firm_name === firmName);
  if (counselIdx < 0) {
    sendJson(res, 404, { error: "counsel_not_found", firm_name: firmName });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const counsel = deal.outside_counsel[counselIdx];
  if (!Array.isArray(counsel.invoices)) {
    counsel.invoices = [];
  }
  const invoice = { amount, date, description };
  counsel.invoices.push(invoice);
  counsel.total_spend = counsel.invoices.reduce(
    (sum, inv) => sum + (typeof inv.amount === "number" ? inv.amount : 0),
    0,
  );
  deal.updated_at = new Date().toISOString();
  // C12-004: Update deal owner responsiveness tracking on mutation
  deal.last_touched_by =
    typeof body.operator_name === "string"
      ? body.operator_name.trim()
      : deal.last_touched_by || "operator";
  deal.last_touched_at = deal.updated_at;
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_COUNSEL_INVOICE", { deal_id: dealId, firm_name: firmName, amount });
  appendJsonlLine(dealsEventsPath, {
    kind: "deal_counsel_invoice_added",
    deal_id: dealId,
    counsel_firm: firmName,
    amount,
    timestamp: new Date().toISOString(),
  });
  appendEvent("deal.counsel.invoice.added", route, {
    deal_id: dealId,
    counsel_firm: firmName,
    amount,
  });
  sendJson(res, 200, {
    added: true,
    deal_id: dealId,
    firm_name: firmName,
    invoice,
    total_spend: counsel.total_spend,
  });
  logLine(`POST ${route} -> 200`);
}

// --- DW-007: Team tasks ---
async function addDealTask(req, res, route, dealId) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const task = typeof body.task === "string" ? body.task.trim() : "";
  const owner = typeof body.owner === "string" ? body.owner.trim() : "";
  const validOwners = new Set(["Clint", "Isaac", "Ted"]);
  if (!task) {
    sendJson(res, 400, { error: "missing_task" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!validOwners.has(owner)) {
    sendJson(res, 400, { error: "invalid_owner", valid: [...validOwners] });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!Array.isArray(deal.team_tasks)) {
    deal.team_tasks = [];
  }
  const entry = {
    task,
    owner,
    status: "open",
    due_date: typeof body.due_date === "string" ? body.due_date.trim() : null,
    created_at: new Date().toISOString(),
  };
  deal.team_tasks.push(entry);
  deal.updated_at = new Date().toISOString();
  // C12-004: Update deal owner responsiveness tracking on mutation
  deal.last_touched_by =
    typeof body.operator_name === "string"
      ? body.operator_name.trim()
      : deal.last_touched_by || "operator";
  deal.last_touched_at = deal.updated_at;
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_TASK_ADD", { deal_id: dealId, task, owner });
  appendJsonlLine(dealsEventsPath, {
    kind: "deal_task_added",
    deal_id: dealId,
    task_title: task,
    assignee: owner,
    timestamp: new Date().toISOString(),
  });
  appendEvent("deal.task.added", route, { deal_id: dealId, task_title: task, assignee: owner });
  sendJson(res, 200, {
    added: true,
    deal_id: dealId,
    task_entry: entry,
    task_index: deal.team_tasks.length - 1,
  });
  logLine(`POST ${route} -> 200`);
}

async function updateDealTask(req, res, route, dealId) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const taskIndex = typeof body.task_index === "number" ? body.task_index : -1;
  if (!Array.isArray(deal.team_tasks) || taskIndex < 0 || taskIndex >= deal.team_tasks.length) {
    sendJson(res, 404, { error: "task_not_found", task_index: taskIndex });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const entry = deal.team_tasks[taskIndex];
  const validStatuses = new Set(["open", "done"]);
  const validOwners = new Set(["Clint", "Isaac", "Ted"]);
  if (typeof body.status === "string" && validStatuses.has(body.status)) {
    entry.status = body.status;
  }
  if (typeof body.owner === "string" && validOwners.has(body.owner)) {
    entry.owner = body.owner;
  }
  if (typeof body.due_date === "string") {
    entry.due_date = body.due_date.trim() || null;
  }
  if (typeof body.task === "string" && body.task.trim()) {
    entry.task = body.task.trim();
  }
  deal.updated_at = new Date().toISOString();
  // C12-004: Update deal owner responsiveness tracking on mutation
  deal.last_touched_by =
    typeof body.operator_name === "string"
      ? body.operator_name.trim()
      : deal.last_touched_by || "operator";
  deal.last_touched_at = deal.updated_at;
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_TASK_UPDATE", {
    deal_id: dealId,
    task_index: taskIndex,
    fields: Object.keys(body),
  });
  appendJsonlLine(dealsEventsPath, {
    kind: "deal_task_updated",
    deal_id: dealId,
    task_id: taskIndex,
    updates: Object.keys(body),
    timestamp: new Date().toISOString(),
  });
  appendEvent("deal.task.updated", route, { deal_id: dealId, task_id: taskIndex });
  sendJson(res, 200, { updated: true, deal_id: dealId, task_entry: entry });
  logLine(`POST ${route} -> 200`);
}

// --- DW-008: DD checklist ---
async function manageDealChecklist(req, res, route, dealId) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!Array.isArray(deal.dd_checklist)) {
    deal.dd_checklist = [];
  }
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const validCheckStatuses = new Set(["pending", "complete", "na"]);

  if (action === "add") {
    const item = typeof body.item === "string" ? body.item.trim() : "";
    if (!item) {
      sendJson(res, 400, { error: "missing_checklist_item" });
      logLine(`POST ${route} -> 400`);
      return;
    }
    const entry = {
      item,
      status: "pending",
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
    };
    deal.dd_checklist.push(entry);
    deal.updated_at = new Date().toISOString();
    // C12-004: Update deal owner responsiveness tracking on mutation
    deal.last_touched_by =
      typeof body.operator_name === "string"
        ? body.operator_name.trim()
        : deal.last_touched_by || "operator";
    deal.last_touched_at = deal.updated_at;
    fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
    appendAudit("DEAL_CHECKLIST_ADD", { deal_id: dealId, item });
    appendJsonlLine(dealsEventsPath, {
      kind: "deal_checklist_item_added",
      deal_id: dealId,
      item_text: item,
      timestamp: new Date().toISOString(),
    });
    appendEvent("deal.checklist.item.added", route, { deal_id: dealId, item_text: item });
    sendJson(res, 200, {
      added: true,
      deal_id: dealId,
      checklist_entry: entry,
      item_index: deal.dd_checklist.length - 1,
    });
    logLine(`POST ${route} -> 200`);
    return;
  }

  if (action === "update") {
    const itemIndex = typeof body.item_index === "number" ? body.item_index : -1;
    if (itemIndex < 0 || itemIndex >= deal.dd_checklist.length) {
      sendJson(res, 404, { error: "checklist_item_not_found", item_index: itemIndex });
      logLine(`POST ${route} -> 404`);
      return;
    }
    const entry = deal.dd_checklist[itemIndex];
    if (typeof body.status === "string" && validCheckStatuses.has(body.status)) {
      entry.status = body.status;
    }
    if (typeof body.notes === "string") {
      entry.notes = body.notes.trim();
    }
    deal.updated_at = new Date().toISOString();
    // C12-004: Update deal owner responsiveness tracking on mutation
    deal.last_touched_by =
      typeof body.operator_name === "string"
        ? body.operator_name.trim()
        : deal.last_touched_by || "operator";
    deal.last_touched_at = deal.updated_at;
    fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
    appendAudit("DEAL_CHECKLIST_UPDATE", {
      deal_id: dealId,
      item_index: itemIndex,
      status: entry.status,
    });
    appendJsonlLine(dealsEventsPath, {
      kind: "deal_checklist_item_updated",
      deal_id: dealId,
      item_id: itemIndex,
      checked: entry.status,
      timestamp: new Date().toISOString(),
    });
    appendEvent("deal.checklist.item.updated", route, {
      deal_id: dealId,
      item_id: itemIndex,
      checked: entry.status,
    });
    sendJson(res, 200, { updated: true, deal_id: dealId, checklist_entry: entry });
    logLine(`POST ${route} -> 200`);
    return;
  }

  if (action === "remove") {
    const itemIndex = typeof body.item_index === "number" ? body.item_index : -1;
    if (itemIndex < 0 || itemIndex >= deal.dd_checklist.length) {
      sendJson(res, 404, { error: "checklist_item_not_found", item_index: itemIndex });
      logLine(`POST ${route} -> 404`);
      return;
    }
    const removed = deal.dd_checklist.splice(itemIndex, 1)[0];
    deal.updated_at = new Date().toISOString();
    // C12-004: Update deal owner responsiveness tracking on mutation
    deal.last_touched_by =
      typeof body.operator_name === "string"
        ? body.operator_name.trim()
        : deal.last_touched_by || "operator";
    deal.last_touched_at = deal.updated_at;
    fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
    appendAudit("DEAL_CHECKLIST_REMOVE", {
      deal_id: dealId,
      item_index: itemIndex,
      item: removed.item,
    });
    appendJsonlLine(dealsEventsPath, {
      kind: "deal_checklist_item_removed",
      deal_id: dealId,
      item_id: itemIndex,
      timestamp: new Date().toISOString(),
    });
    appendEvent("deal.checklist.item.removed", route, { deal_id: dealId, item_id: itemIndex });
    sendJson(res, 200, { removed: true, deal_id: dealId, removed_entry: removed });
    logLine(`POST ${route} -> 200`);
    return;
  }

  sendJson(res, 400, { error: "invalid_action", valid: ["add", "update", "remove"] });
  logLine(`POST ${route} -> 400`);
}

// --- DW-009: Notes + timeline ---
async function addDealNote(req, res, route, dealId) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    sendJson(res, 400, { error: "missing_note_text" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!Array.isArray(deal.notes)) {
    deal.notes = [];
  }
  const note = {
    text,
    author: typeof body.author === "string" ? body.author.trim() : "Clint",
    created_at: new Date().toISOString(),
  };
  deal.notes.push(note);
  deal.updated_at = new Date().toISOString();
  // C12-004: Update deal owner responsiveness tracking on mutation
  deal.last_touched_by =
    typeof body.operator_name === "string"
      ? body.operator_name.trim()
      : note.author || deal.last_touched_by || "operator";
  deal.last_touched_at = deal.updated_at;
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_NOTE_ADD", { deal_id: dealId, author: note.author });
  appendJsonlLine(dealsEventsPath, {
    kind: "deal_note_added",
    deal_id: dealId,
    note_preview: (text || "").slice(0, 100),
    timestamp: new Date().toISOString(),
  });
  appendEvent("deal.note.added", route, { deal_id: dealId });
  sendJson(res, 200, { added: true, deal_id: dealId, note });
  logLine(`POST ${route} -> 200`);
}

function getDealTimeline(dealId, res, route) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`GET ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`GET ${route} -> 404`);
    return;
  }
  try {
    const entries = [];
    // Read from audit ledger (where appendAudit writes deal audit records)
    const auditLines = readJsonlLines(auditLedgerPath);
    for (const entry of auditLines) {
      if (entry && entry.details && entry.details.deal_id === dealId) {
        entries.push({
          source: "audit",
          timestamp: entry.at,
          action: entry.action,
          details: entry.details,
        });
      }
    }
    // Read from event log for deal-related events (Phase 9 dual-write)
    const eventLines = readJsonlLines(eventLogPath);
    for (const evt of eventLines) {
      if (
        evt &&
        typeof evt.event_type === "string" &&
        evt.event_type.startsWith("deal.") &&
        evt.payload &&
        evt.payload.deal_id === dealId
      ) {
        entries.push({
          source: "event_log",
          timestamp: evt.timestamp,
          action: evt.event_type,
          details: evt.payload,
        });
      }
    }
    // Sort by timestamp descending (most recent first)
    entries.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    const last100 = entries.slice(0, 100);
    sendJson(res, 200, { deal_id: dealId, timeline: last100 });
    logLine(`GET ${route} -> 200`);
  } catch (err) {
    logLine(`DEAL_TIMELINE_ERROR: ${dealId} -- ${err?.message || String(err)}`);
    sendJson(res, 200, { deal_id: dealId, timeline: [] });
    logLine(`GET ${route} -> 200`);
  }
}

// C12-004: Deal owner responsiveness — stale deal detection
function checkStaleDealOwners(parsedUrl, res, route) {
  const staleDays = parseInt(parsedUrl.searchParams?.get("days") || "7", 10);
  const cutoff = new Date(Date.now() - staleDays * 86400000).toISOString();
  const deals = readJsonlLines(dealsEventsPath);
  // Build latest state per deal
  const dealMap = new Map();
  for (const evt of deals) {
    if (evt.kind === "deal_created") {
      dealMap.set(evt.deal_id, {
        deal_id: evt.deal_id,
        name: evt.name || evt.deal_id,
        stage: evt.stage || "lead",
        last_touched_by: evt.last_touched_by || "unknown",
        last_touched_at: evt.last_touched_at || evt.at,
      });
    } else if (evt.kind === "deal_stage_changed" || evt.kind === "deal_updated") {
      const d = dealMap.get(evt.deal_id);
      if (d) {
        d.stage = evt.to_stage || evt.stage || d.stage;
        d.last_touched_by = evt.last_touched_by || d.last_touched_by;
        d.last_touched_at = evt.at || d.last_touched_at;
      }
    } else if (evt.deal_id && evt.at) {
      const d = dealMap.get(evt.deal_id);
      if (d) {
        d.last_touched_at = evt.at;
        d.last_touched_by = evt.last_touched_by || d.last_touched_by;
      }
    }
  }
  const stale = [];
  for (const d of dealMap.values()) {
    if (d.stage !== "closed" && d.stage !== "dead" && d.last_touched_at < cutoff) {
      stale.push({
        ...d,
        days_since_touch: Math.floor(
          (Date.now() - new Date(d.last_touched_at).getTime()) / 86400000,
        ),
      });
    }
  }
  stale.sort((a, b) => b.days_since_touch - a.days_since_touch);
  appendEvent("deal.owner.stale_check", route, {
    stale_count: stale.length,
    threshold_days: staleDays,
  });
  appendAudit("DEAL_STALE_CHECK", { stale_count: stale.length, threshold_days: staleDays });
  sendJson(res, 200, {
    stale_deals: stale,
    threshold_days: staleDays,
    checked_at: new Date().toISOString(),
  });
  logLine(`GET ${route} -> 200 (${stale.length} stale)`);
}

// C12-011: Per-deal learning retrospective
async function generateDealRetrospective(dealId, _parsedUrl, req, res, route) {
  const _routeKey = normalizeRoutePolicyKey(route);
  const _modeCheck = requestedExecutionMode(req);
  const dealDir = path.join(dealsDir, dealId);
  if (!fs.existsSync(dealDir)) {
    sendJson(res, 404, { error: "Deal not found" });
    return;
  }

  // Gather deal events
  const allEvents = readJsonlLines(dealsEventsPath);
  const dealEvents = allEvents.filter((e) => e.deal_id === dealId);

  // Gather related commitments
  const commitments = readJsonlLines(commitmentsLedgerPath).filter((c) => c.deal_id === dealId);

  // Gather related draft queue items
  const drafts = readJsonlLines(draftQueueLedgerPath).filter((d) => d.deal_id === dealId);

  const retrospective = {
    deal_id: dealId,
    generated_at: new Date().toISOString(),
    source: "template",
    total_events: dealEvents.length,
    total_commitments: commitments.length,
    commitments_completed: commitments.filter((c) => c.status === "completed").length,
    commitments_open: commitments.filter((c) => c.status !== "completed").length,
    total_drafts: drafts.length,
    drafts_executed: drafts.filter((d) => d.status === "executed").length,
    drafts_archived: drafts.filter((d) => d.status === "archived").length,
    stage_transitions: dealEvents
      .filter((e) => e.kind === "deal_stage_changed")
      .map((e) => ({ from: e.from_stage, to: e.to_stage, at: e.at })),
    timeline_days:
      dealEvents.length > 0
        ? Math.floor(
            (Date.now() -
              new Date(dealEvents[0].at || dealEvents[0].timestamp || Date.now()).getTime()) /
              86400000,
          )
        : 0,
  };

  // Write retrospective
  const retroPath = path.join(dealDir, "retrospective.json");
  fs.writeFileSync(retroPath, JSON.stringify(retrospective, null, 2));
  appendJsonlLine(dealsEventsPath, {
    kind: "deal_retrospective_generated",
    deal_id: dealId,
    at: new Date().toISOString(),
  });
  appendEvent("deal.retrospective.generated", route, {
    deal_id: dealId,
    total_events: retrospective.total_events,
  });
  appendAudit("DEAL_RETROSPECTIVE", { deal_id: dealId });
  sendJson(res, 200, { ok: true, retrospective });
  logLine(`POST ${route} -> 200`);
}

function listTriageEndpoint(res, route) {
  sendJson(res, 200, { items: listOpenTriageItems() });
  logLine(`GET ${route} -> 200`);
}

async function ingestTriageItem(req, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const idempotencyKey = idempotencyKeyFromRequest(req);
  if (idempotencyKey) {
    const replay = getIdempotentReplay(routeKey, idempotencyKey);
    if (replay) {
      sendJson(res, replay.status_code, {
        ...replay.response_body,
        deduped: true,
        idempotency_key: idempotencyKey,
      });
      logLine(`POST ${route} -> ${replay.status_code}`);
      return;
    }
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const itemId = typeof body.item_id === "string" ? body.item_id.trim() : "";
  const sourceType = typeof body.source_type === "string" ? body.source_type.trim() : "";
  const sourceRef = typeof body.source_ref === "string" ? body.source_ref.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const inputSuggestedDealId =
    typeof body.suggested_deal_id === "string" ? body.suggested_deal_id.trim() : "";
  const inputSuggestedTaskId =
    typeof body.suggested_task_id === "string" ? body.suggested_task_id.trim() : "";

  if (!itemId || !isSlugSafe(itemId)) {
    sendJson(res, 400, { error: "invalid_item_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!sourceType) {
    sendJson(res, 400, { error: "invalid_source_type" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!sourceRef) {
    sendJson(res, 400, { error: "invalid_source_ref" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (!summary) {
    sendJson(res, 400, { error: "invalid_summary" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (inputSuggestedDealId && !isSlugSafe(inputSuggestedDealId)) {
    sendJson(res, 400, { error: "invalid_suggested_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (inputSuggestedTaskId && !isSlugSafe(inputSuggestedTaskId)) {
    sendJson(res, 400, { error: "invalid_suggested_task_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const state = triageStateFromLines(readTriageLines());
  if (state.open.has(itemId)) {
    sendJson(res, 409, { error: "ALREADY_EXISTS", item_id: itemId });
    logLine(`POST ${route} -> 409`);
    return;
  }

  const patternSuggestion = suggestFromActivePatterns(sourceRef);
  const patternConfidence = patternSuggestion.suggested_deal_id ? 1.0 : 0;
  let classificationSource = patternConfidence >= 0.8 ? "pattern" : "pattern";

  // LLM classification enhancement (JC-071d): when pattern confidence < 80%, try LLM
  let llmEntity = undefined;
  let llmDealId = undefined;
  let llmConfidence = 0;
  if (patternConfidence < 0.8) {
    try {
      const systemPrompt = buildSystemPrompt("triage_classify", null);
      const content = typeof body.content === "string" ? body.content.slice(0, 1000) : "";
      const userMessage = `Classify this triage item.\n\nItem ID: ${itemId}\nSource Type: ${sourceType}\nSource Ref: ${sourceRef}\nSummary: ${summary}\nContent: ${content}\n\nReturn a JSON object with: { "entity": "<entity_name>", "deal_id": "<deal_id_if_known>", "confidence": <0.0-1.0>, "reasoning": "<brief_reason>" }`;
      const llmResult = await routeLlmCall(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        null,
        "triage_classify",
      );
      if (llmResult.ok) {
        const validation = validateLlmOutputContract("triage_classify", llmResult.content, null);
        if (validation.valid) {
          try {
            const parsed = JSON.parse(llmResult.content);
            llmEntity = typeof parsed.entity === "string" ? parsed.entity : undefined;
            llmDealId = typeof parsed.deal_id === "string" ? parsed.deal_id : undefined;
            llmConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
            if (llmConfidence > patternConfidence) {
              classificationSource = "llm";
            }
          } catch {
            /* JSON parse failure, keep pattern */
          }
        }
      }
    } catch (llmErr) {
      logLine(`LLM_TRIAGE_CLASSIFY_ERROR: ${llmErr?.message || "unknown"}`);
    }
  }

  const createdAt = new Date().toISOString();
  const useLlm = classificationSource === "llm" && llmConfidence > patternConfidence;
  const finalSuggestedDealId =
    (useLlm && llmDealId) ||
    patternSuggestion.suggested_deal_id ||
    inputSuggestedDealId ||
    undefined;
  const finalSuggestedTaskId =
    patternSuggestion.suggested_task_id || inputSuggestedTaskId || undefined;
  const finalEntity = useLlm ? llmEntity : undefined;
  appendTriageLine({
    kind: "triage_item",
    item_id: itemId,
    source_type: sourceType,
    source_ref: sourceRef,
    summary,
    suggested_deal_id: finalSuggestedDealId,
    suggested_task_id: finalSuggestedTaskId,
    entity: finalEntity,
    status: "OPEN",
    created_at: createdAt,
  });
  appendTriageLine({
    kind: "audit",
    action: "TRIAGE_INGEST",
    at: createdAt,
    item_id: itemId,
    suggested_deal_id: finalSuggestedDealId,
    suggested_task_id: finalSuggestedTaskId,
    classification_source: classificationSource,
  });
  // JC-092b: Emit normalized classification event
  appendEvent(
    "triage.classified",
    "/triage/classify",
    normalizeTriageEvent(
      { item_id: itemId, source_type: sourceType, entity: finalEntity, urgency: undefined },
      "classified",
    ),
  );
  const responseBody = {
    ingested: true,
    item_id: itemId,
    status: "OPEN",
    suggested_deal_id: finalSuggestedDealId,
    suggested_task_id: finalSuggestedTaskId,
    entity: finalEntity,
    classification_source: classificationSource,
    deduped: false,
    idempotency_key: idempotencyKey || undefined,
  };
  if (idempotencyKey) {
    storeIdempotentReplay(routeKey, idempotencyKey, 200, responseBody);
    sendJson(res, 200, responseBody);
    logLine(`POST ${route} -> 200`);
    return;
  }
  sendJson(res, 201, responseBody);
  logLine(`POST ${route} -> 201`);
}

async function linkTriageItem(itemId, req, res, route) {
  if (!itemId || !isSlugSafe(itemId)) {
    sendJson(res, 400, { error: "invalid_item_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const dealId = typeof body.deal_id === "string" ? body.deal_id.trim() : "";
  const taskId = typeof body.task_id === "string" ? body.task_id.trim() : "";
  if (!dealId && !taskId) {
    sendJson(res, 400, { error: "deal_id_or_task_id_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (dealId && !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (taskId && !isSlugSafe(taskId)) {
    sendJson(res, 400, { error: "invalid_task_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  if (dealId && !fs.existsSync(getDealPath(dealId))) {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }

  const state = triageStateFromLines(readTriageLines());
  if (!state.open.has(itemId)) {
    if (state.all.has(itemId)) {
      sendJson(res, 409, { error: "triage_item_already_resolved", item_id: itemId });
      logLine(`POST ${route} -> 409`);
      return;
    }
    sendJson(res, 404, { error: "triage_item_not_found", item_id: itemId });
    logLine(`POST ${route} -> 404`);
    return;
  }

  const now = new Date().toISOString();
  const linkedTo = {
    deal_id: dealId || undefined,
    task_id: taskId || undefined,
  };
  // BL-001: Capture original suggested_deal_id before link for reclassification signal
  const originalItem = state.open.get(itemId) || {};
  const originalDealId = originalItem.suggested_deal_id || null;
  appendTriageLine({
    kind: "TRIAGE_LINK",
    item_id: itemId,
    resolved: true,
    resolved_at: now,
    linked_to: linkedTo,
    original_suggested_deal_id: originalDealId,
  });
  appendAudit("TRIAGE_LINK", {
    item_id: itemId,
    linked_to: linkedTo,
  });
  // BL-001: Record reclassify signal if operator linked to a different deal than Ted suggested
  if (dealId && originalDealId && dealId !== originalDealId) {
    appendCorrectionSignal("reclassify", "triage", 0.8, {
      context_bucket: {
        original_deal: originalDealId,
        corrected_deal: dealId,
        source_type: originalItem.source_type || null,
      },
      entity: originalItem.entity || null,
      source_id: itemId,
    });
  } else if (dealId) {
    appendCorrectionSignal("accept_verbatim", "triage", 0.0, {
      context_bucket: { deal_id: dealId, source_type: originalItem.source_type || null },
      entity: originalItem.entity || null,
      source_id: itemId,
    });
  }
  sendJson(res, 200, {
    linked: true,
    item_id: itemId,
    deal_id: dealId || undefined,
    task_id: taskId || undefined,
  });
  logLine(`POST ${route} -> 200`);
}

function readGraphProfilesConfig() {
  try {
    if (!fs.existsSync(graphProfilesConfigPath)) {
      return { profiles: null };
    }
    const raw = fs.readFileSync(graphProfilesConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.profiles !== "object") {
      return { profiles: null };
    }
    return { profiles: parsed.profiles };
  } catch {
    /* intentional: config may not exist */
    return { profiles: null };
  }
}

function readConfigFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    /* intentional: config file may not exist or be invalid */
    return null;
  }
}

function getOperatorProfile() {
  return readConfigFile(operatorProfileConfigPath);
}

function getHardBansConfig() {
  return readConfigFile(hardBansConfigPath);
}

function getBriefConfig() {
  return readConfigFile(briefConfigPath);
}

function getUrgencyRules() {
  return readConfigFile(urgencyRulesConfigPath);
}

function getDraftStyleConfig() {
  return readConfigFile(draftStyleConfigPath);
}

function getAutonomyLadder() {
  return readConfigFile(autonomyLadderConfigPath);
}

function getLlmProviderConfig() {
  return readConfigFile(llmProviderConfigPath);
}

function getNotificationBudget() {
  return readConfigFile(notificationBudgetConfigPath);
}

function getOnboardingRamp() {
  return readConfigFile(onboardingRampConfigPath);
}

function _getPlanningPreferences() {
  return readConfigFile(planningPreferencesConfigPath);
}

function _getParaRules() {
  return readConfigFile(paraRulesConfigPath);
}

// JC-090b: Configurable output contracts
const OUTPUT_CONTRACTS_DEFAULTS = {
  morning_brief: {
    required_sections: ["inbox_summary", "priorities", "calendar"],
    max_length: 5000,
    forbidden_patterns: [],
  },
  eod_digest: {
    required_sections: ["completed_today", "pending", "tomorrow_prep"],
    max_length: 5000,
    forbidden_patterns: [],
  },
  draft_email: {
    required_sections: [],
    max_length: 3000,
    forbidden_patterns: ["CONFIDENTIAL PLACEHOLDER", "TODO:", "FIXME"],
  },
  triage_classify: { required_sections: [], max_length: 1000, forbidden_patterns: [] },
  deadline_extract: { required_sections: [], max_length: 1000, forbidden_patterns: [] },
};

function getOutputContracts() {
  try {
    const cfg = readConfigFile(outputContractsConfigPath);
    return cfg || OUTPUT_CONTRACTS_DEFAULTS;
  } catch {
    /* intentional: fallback to defaults */
    return OUTPUT_CONTRACTS_DEFAULTS;
  }
}

// MF-9: Golden fixtures for startup validation (Plane B — Proof/Observability)
const GOLDEN_FIXTURES = {
  morning_brief: {
    input: "Test morning brief generation",
    expected_output:
      "## Priorities Today\nFocus on deal pipeline review and investor follow-up.\n## Calendar\nNo meetings today.\n## Commitments Due\nNone due today.\n## Inbox Summary\nInbox clear.",
  },
  eod_digest: {
    input: "Test EOD digest generation",
    expected_output:
      "## Completed Today\nReviewed deal pipeline.\n## Pending\nInvestor follow-up outstanding.\n## Tomorrow Prep\nPrepare board materials.",
  },
  draft_email: {
    input: "Test draft email generation",
    expected_output:
      "Subject: Follow-up on partnership discussion\n\nDear John,\n\nThank you for our discussion today. I wanted to follow up on the key points.\n\n[DRAFT FOR REVIEW]\n\n— Clint",
  },
  triage_classify: {
    input: "Test triage classification",
    expected_output:
      '{"classification":"action_needed","priority":"normal","reason":"Follow-up required"}',
  },
  deadline_extract: {
    input: "Please review the attached PSA and confirm deadline compliance by March 15, 2026.",
    expected_output:
      '{"deadlines":[{"description":"PSA deadline compliance review","date":"2026-03-15","source":"email","confidence":"high"}],"summary":"One deadline identified."}',
  },
  commitment_extract: {
    input: "I will send the term sheet by Friday.",
    expected_output:
      '[{"who_owes":"sender","who_to":"Clint","what":"Send the term sheet","due_date":"Friday","confidence":0.9,"source_text":"I will send the term sheet by Friday."}]',
  },
  improvement_proposal: {
    input: "Test improvement proposal generation",
    expected_output:
      '{"type":"contract_update","title":"Improve brief coverage","description":"Add deal status section","rationale":"Missing deal updates in daily brief"}',
  },
};

// JC-110f: Startup validation of output contracts (Plane B completeness)
function validateOutputContractsOnStartup() {
  const requiredIntents = [
    "morning_brief",
    "eod_digest",
    "draft_email",
    "triage_classify",
    "deadline_extract",
    "commitment_extract",
    "improvement_proposal",
  ];
  const contracts = getOutputContracts();
  const results = [];
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  for (const intent of requiredIntents) {
    const contract = contracts[intent];
    if (!contract) {
      results.push({ intent, status: "MISSING_CONTRACT" });
      failCount++;
      logLine(`OUTPUT CONTRACT: ${intent} — MISSING CONTRACT (using default)`);
      continue;
    }

    const fixture = GOLDEN_FIXTURES[intent];
    if (!fixture) {
      results.push({ intent, status: "NO_FIXTURE" });
      warnCount++;
      logLine(`OUTPUT CONTRACT: ${intent} — WARNING: no golden fixture`);
      continue;
    }

    // Run the fixture's expected_output through contract validation
    let validation;
    try {
      validation = validateLlmOutputContract(intent, fixture.expected_output, null);
    } catch (e) {
      results.push({ intent, status: "VALIDATION_ERROR", error: String(e) });
      warnCount++;
      logLine(
        `OUTPUT CONTRACT: ${intent} — VALIDATION_ERROR: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }
    if (validation.valid) {
      results.push({ intent, status: "PASS" });
      passCount++;
    } else {
      results.push({
        intent,
        status: "FAIL",
        missing_sections: validation.missing_sections,
        banned_phrases: validation.banned_phrases_found,
      });
      failCount++;
      logLine(
        `OUTPUT CONTRACT: ${intent} — FAIL: missing=${JSON.stringify(validation.missing_sections)}, banned=${JSON.stringify(validation.banned_phrases_found)}`,
      );
    }
  }

  logLine(
    `OUTPUT CONTRACT STARTUP: ${passCount} passed, ${failCount} failed, ${warnCount} warnings out of ${requiredIntents.length} intents`,
  );
  try {
    appendEvent("contracts.startup_validation", "startup", {
      passed: passCount,
      failed: failCount,
      warnings: warnCount,
      total: requiredIntents.length,
      details: results,
    });
  } catch {
    /* startup event write must not crash server */
  }

  return failCount === 0;
}
validateOutputContractsOnStartup();

// ── Self-Healing: LLM Provider Health (SH-002) ──
const _providerHealth = new Map();
const EWMA_TIME_BIAS_MS = 60000;
const PROVIDER_CB_FAIL_THRESHOLD = 3;
const PROVIDER_CB_WINDOW_MS = 60000;
const PROVIDER_CB_COOLDOWN_MS = 30000;

function _getProviderState(provider) {
  if (!_providerHealth.has(provider)) {
    _providerHealth.set(provider, {
      calls: [],
      ewmaLatency: 0,
      ewmaSuccessRate: 1.0,
      compositeScore: 1.0,
      circuitState: "closed",
      openedAt: null,
      consecutiveFailures: 0,
    });
  }
  return _providerHealth.get(provider);
}

function recordProviderResult(provider, success, latencyMs) {
  const ps = _getProviderState(provider);
  const now = Date.now();
  ps.calls.push({ ts: now, success, latencyMs });
  // Prune to 5-min window
  const cutoff = now - 5 * 60 * 1000;
  ps.calls = ps.calls.filter((c) => c.ts > cutoff);
  // EWMA update
  const alpha = 1 - Math.exp(-latencyMs / EWMA_TIME_BIAS_MS);
  ps.ewmaLatency =
    ps.ewmaLatency === 0 ? latencyMs : ps.ewmaLatency * (1 - alpha) + latencyMs * alpha;
  const successVal = success ? 1 : 0;
  ps.ewmaSuccessRate = ps.ewmaSuccessRate * (1 - 0.1) + successVal * 0.1;
  // Composite: (successRate^4) * (1 / normalizedLatency)
  const normalizedLatency = Math.max(ps.ewmaLatency / 5000, 0.1); // normalize to 5s baseline
  ps.compositeScore = Math.pow(ps.ewmaSuccessRate, 4) * (1 / normalizedLatency);
  // Per-provider circuit breaker
  if (success) {
    ps.consecutiveFailures = 0;
    if (ps.circuitState === "half-open") {
      ps.circuitState = "closed";
      appendEvent("self_healing.provider.recovered", "llm", { provider });
      logLine(`PROVIDER_HEALTH: ${provider} recovered`);
    }
  } else {
    ps.consecutiveFailures++;
    const recentFails = ps.calls.filter(
      (c) => c.ts > now - PROVIDER_CB_WINDOW_MS && !c.success,
    ).length;
    if (recentFails >= PROVIDER_CB_FAIL_THRESHOLD && ps.circuitState === "closed") {
      ps.circuitState = "open";
      ps.openedAt = now;
      appendEvent("self_healing.provider.fallback", "llm", {
        provider,
        reason: "circuit_open",
        consecutive_failures: ps.consecutiveFailures,
      });
      logLine(
        `PROVIDER_HEALTH: ${provider} circuit opened (${ps.consecutiveFailures} consecutive failures)`,
      );
    }
  }
  if (latencyMs > CB_SLOW_CALL_MS) {
    appendEvent("self_healing.provider.slow", "llm", { provider, latency_ms: latencyMs });
  }
}

function isProviderCircuitOpen(provider) {
  const ps = _getProviderState(provider);
  if (ps.circuitState === "closed") {
    return false;
  }
  if (ps.circuitState === "open" && Date.now() - ps.openedAt >= PROVIDER_CB_COOLDOWN_MS) {
    ps.circuitState = "half-open";
  }
  return ps.circuitState === "open";
}

function getProviderHealthSummary() {
  const result = [];
  for (const [provider, ps] of _providerHealth.entries()) {
    result.push({
      provider,
      ewma_latency_ms: Math.round(ps.ewmaLatency),
      ewma_success_rate: +ps.ewmaSuccessRate.toFixed(3),
      composite_score: +ps.compositeScore.toFixed(3),
      circuit_state: ps.circuitState,
      call_count: ps.calls.length,
      last_fallback_at:
        ps.circuitState !== "closed"
          ? ps.openedAt
            ? new Date(ps.openedAt).toISOString()
            : null
          : null,
    });
  }
  return result;
}

// ─── LLM Provider Infrastructure (JC-070b) ───

function selectLlmProvider(entityContext, jobId) {
  const cfg = getLlmProviderConfig();
  if (!cfg) {
    return { provider: null, reason: "llm_provider_config_missing" };
  }

  // Per-job override takes highest precedence
  if (jobId && cfg.per_job_overrides && cfg.per_job_overrides[jobId]) {
    const override = cfg.per_job_overrides[jobId];
    const providerName = override.provider;
    const providerCfg = cfg.providers?.[providerName];
    if (providerCfg?.enabled) {
      return { provider: providerName, config: providerCfg, reason: "per_job_override" };
    }
    return { provider: null, reason: `per_job_override_provider_disabled: ${providerName}` };
  }

  // Entity override takes second precedence (case-insensitive key lookup — profileId from URL is always lowercase)
  const entityKey = entityContext
    ? Object.keys(cfg.entity_overrides || {}).find(
        (k) => k.toLowerCase() === entityContext.toLowerCase(),
      )
    : null;
  if (entityKey && cfg.entity_overrides[entityKey]) {
    const override = cfg.entity_overrides[entityKey];
    const providerName = override.provider;
    if (providerName) {
      const providerCfg = cfg.providers?.[providerName];
      if (providerCfg?.enabled) {
        if (override.required_hipaa_cleared && !providerCfg.hipaa_cleared) {
          return {
            provider: null,
            reason: `hipaa_required_but_provider_not_cleared: ${providerName}`,
            entity: entityContext,
          };
        }
        return { provider: providerName, config: providerCfg, reason: "entity_override" };
      }
      return {
        provider: null,
        reason: `entity_override_provider_disabled: ${providerName}`,
        entity: entityContext,
      };
    }
  }

  // Default provider
  const defaultName = cfg.default_provider;
  if (defaultName === "disabled") {
    return { provider: null, reason: "llm_disabled_by_config" };
  }
  const defaultCfg = cfg.providers?.[defaultName];
  if (!defaultCfg?.enabled) {
    return { provider: null, reason: `default_provider_disabled: ${defaultName}` };
  }

  // HIPAA check: if entity requires HIPAA and default provider is not cleared, block
  if (entityKey && cfg.entity_overrides?.[entityKey]?.required_hipaa_cleared) {
    if (!defaultCfg.hipaa_cleared) {
      return {
        provider: null,
        reason: `hipaa_required_for_entity_but_default_not_cleared`,
        entity: entityContext,
      };
    }
  }

  return { provider: defaultName, config: defaultCfg, reason: "default" };
}

// SH-002: LLM provider fallback wrapper — uses provider health circuit breaker
function selectLlmProviderWithFallback(entity, intent) {
  const primary = selectLlmProvider(entity);
  if (!primary || !primary.provider) {
    return primary;
  }
  if (!isProviderCircuitOpen(primary.provider)) {
    return { ...primary, isFallback: false };
  }
  // Primary circuit open — try fallback
  const llmConfig = getLlmProviderConfig();
  if (!llmConfig || !llmConfig.providers) {
    return { ...primary, isFallback: false };
  }
  const providerEntries = Object.entries(llmConfig.providers);
  for (const [pName, pCfg] of providerEntries) {
    if (pName !== primary.provider && pCfg.enabled && !isProviderCircuitOpen(pName)) {
      logLine(
        `LLM_FALLBACK: ${primary.provider} circuit open, falling back to ${pName} for intent=${intent}`,
      );
      appendEvent("self_healing.provider.fallback", "llm", {
        from: primary.provider,
        to: pName,
        intent,
        reason: "primary_circuit_open",
      });
      return { provider: pName, config: pCfg, isFallback: true };
    }
  }
  // All circuits open — use primary anyway
  logLine(`LLM_FALLBACK: All providers degraded, using primary ${primary.provider}`);
  return { ...primary, isFallback: false };
}

// ──────────────────────────────────────────────────────────────────────────────
// PHI Redaction — Defense-in-Depth Layer (C12-001 documentation)
//
// CATCHES (regex-based):
//   - SSN patterns (###-##-####)
//   - DOB patterns (MM/DD/YYYY, YYYY-MM-DD with prefix like "DOB:", "date of birth")
//   - Room/bed numbers (room #123, rm 45B, bed 6)
//   - Medical Record Numbers (MRN #12345, medical record 67890)
//
// DOES NOT CATCH (requires clinical NER — future enhancement):
//   - Patient names, physician names
//   - Diagnosis codes (ICD-10, CPT)
//   - Clinical terminology and medical conditions
//   - Medication names with dosages
//   - Insurance plan numbers
//   - Facility-specific identifiers
//   - Context-dependent PHI (ages, dates without prefix, geographic data)
//
// SCOPE: Applied to all text before LLM calls. NOT applied to:
//   - SharePoint document content (currently metadata-only — no content ingestion)
//   - Event log payloads (contain metadata, not document content)
//   - Audit trail entries
//
// RECOMMENDATION: When document content reading is added (C12-009),
// route content through this function at minimum + evaluate clinical NER service.
// ──────────────────────────────────────────────────────────────────────────────
function redactPhiFromMessages(messages, entityContext) {
  const operatorCfg = getOperatorProfile();
  const entitySep = operatorCfg?.contexts?.entity_separation?.[entityContext];
  if (!entitySep?.phi_auto_redact) {
    return messages;
  }

  const phiFields = operatorCfg?.confidentiality?.phi_redaction_fields || [];
  if (phiFields.length === 0) {
    return messages;
  }

  return messages.map((msg) => {
    if (typeof msg.content !== "string") {
      return msg;
    }
    let content = msg.content;
    // Redact SSN patterns
    content = content.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED-SSN]");
    // Redact DOB patterns (MM/DD/YYYY, YYYY-MM-DD)
    content = content.replace(
      /\b(?:DOB|date of birth|born)\s*[:-]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
      "[REDACTED-DOB]",
    );
    // Redact room numbers in facility context
    content = content.replace(/\b(?:room|rm|bed)\s*#?\s*\d{1,4}[A-Za-z]?\b/gi, "[REDACTED-ROOM]");
    // Redact medical record numbers
    content = content.replace(/\b(?:MRN|medical record)\s*#?\s*\d{4,}\b/gi, "[REDACTED-MRN]");
    return { ...msg, content };
  });
}

function buildSystemPrompt(intent, entityContext) {
  const operatorCfg = getOperatorProfile();
  const hardBans = getHardBansConfig();
  const autonomy = getAutonomyLadder();
  const urgency = getUrgencyRules();
  const draftStyle = getDraftStyleConfig();
  const briefCfg = getBriefConfig();

  const parts = [];

  // Identity layer
  parts.push("## Identity");
  parts.push(
    `You are Ted, an operations assistant for ${operatorCfg?.operator?.name || "the operator"}.`,
  );
  parts.push(`Organization: ${operatorCfg?.operator?.organization || "Unknown"}`);
  parts.push(`Timezone: ${operatorCfg?.operator?.timezone || "UTC"}`);
  if (entityContext) {
    parts.push(`Current entity context: ${entityContext}`);
    const entityRules = operatorCfg?.contexts?.entity_separation?.[entityContext];
    if (entityRules?.special_rules) {
      parts.push("Entity-specific rules:");
      for (const rule of entityRules.special_rules) {
        parts.push(`- ${rule}`);
      }
    }
    if (entityRules?.never_mix_with) {
      parts.push(`NEVER reference data from: ${entityRules.never_mix_with.join(", ")}`);
    }
  }

  // Style layer (intent-specific)
  if (intent === "draft_email" && draftStyle) {
    parts.push("\n## Draft Style");
    parts.push(`Tone: ${draftStyle.preferred_tone || "Direct, concise, professional."}`);
    if (entityContext && draftStyle.style_rules) {
      const contextKey = entityContext === "Everest" ? "everest_owner_communications" : "business";
      parts.push(
        `Context tone: ${draftStyle.style_rules[contextKey] || draftStyle.style_rules.business}`,
      );
    }
    if (draftStyle.signature_conventions) {
      parts.push(`Signature: ${draftStyle.signature_conventions.business}`);
      parts.push(`Include disclaimer: ${draftStyle.signature_conventions.draft_disclaimer}`);
    }
    if (draftStyle.words_to_avoid?.length) {
      parts.push("NEVER use these phrases:");
      for (const word of draftStyle.words_to_avoid) {
        parts.push(`- "${word}"`);
      }
    }
  }

  if (intent === "morning_brief" && briefCfg) {
    parts.push("\n## Morning Brief Structure");
    parts.push("You MUST include ALL of the following sections:");
    const sections = briefCfg.daily_briefs?.work?.must_include || [];
    for (let i = 0; i < sections.length; i++) {
      parts.push(`${i + 1}. ${sections[i]}`);
    }
    parts.push(`Format: ${briefCfg.daily_briefs?.work?.format || "decision_ready"}`);
  }

  if (intent === "eod_digest" && briefCfg) {
    parts.push("\n## EOD Digest Structure (Isaac Nightly Report)");
    parts.push(`Tone: ${briefCfg.isaac_nightly_report?.tone || "Matter-of-fact."}`);
    parts.push("You MUST include ALL of the following sections:");
    const sections = briefCfg.isaac_nightly_report?.required_sections || [];
    for (let i = 0; i < sections.length; i++) {
      parts.push(`${i + 1}. ${sections[i]}`);
    }
  }

  if (intent === "triage_classify" && operatorCfg) {
    parts.push("\n## Triage Classification");
    parts.push(`Default rule: ${operatorCfg.contexts?.default_classification_rule || ""}`);
    parts.push("Return JSON: { entity, deal_id, confidence, reasoning }");
    const entityList = operatorCfg.contexts?.list || [];
    for (const ent of entityList) {
      const signals = operatorCfg.contexts?.entity_separation?.[ent]?.classification_signals || [];
      if (signals.length) {
        parts.push(`${ent} signals: ${signals.join(", ")}`);
      }
    }
  }

  if (intent === "deadline_extract") {
    parts.push("\n## Deadline Extraction");
    parts.push("Find ALL deadlines, due dates, and time-sensitive commitments in the text.");
    parts.push("Return JSON array: [{ date, context, confidence, source_text }]");
    parts.push("Include implicit deadlines (e.g., 'by end of week', 'next Friday').");
  }

  // Constraint layer
  if (hardBans?.hard_ban_strings?.length) {
    parts.push("\n## Hard Bans (NEVER violate)");
    for (const ban of hardBans.hard_ban_strings) {
      parts.push(`- ${ban}`);
    }
  }

  // Autonomy layer
  if (autonomy) {
    parts.push("\n## Autonomy");
    parts.push(`Default mode: ${autonomy.default_mode || "draft_only"}`);
    parts.push("All outputs are drafts for operator review unless explicitly stated otherwise.");
  }

  // Priority layer
  if (urgency?.error_tolerance) {
    parts.push("\n## Priority Guidance");
    parts.push(`Tradeoff: ${urgency.error_tolerance.tradeoff || "prefer_fewer_misses"}`);
    parts.push(`Notes: ${urgency.error_tolerance.notes || ""}`);
  }

  return parts.join("\n");
}

async function openaiDirectCall(messages, providerConfig) {
  const apiKey = process.env[providerConfig.api_key_env || "OPENAI_API_KEY"] || "";
  if (!apiKey) {
    return { ok: false, error: "api_key_not_set", env_var: providerConfig.api_key_env };
  }

  const model = providerConfig.model || "gpt-4.1";
  const endpoint = providerConfig.endpoint || "https://api.openai.com/v1/chat/completions";
  const cfg = getLlmProviderConfig();
  const timeoutMs = cfg?.timeout_ms || 12000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: "llm_api_error",
        status: response.status,
        detail: errBody?.error?.message || response.statusText,
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    return {
      ok: true,
      content,
      model: data?.model || model,
      usage: data?.usage || null,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, error: "llm_timeout", timeout_ms: timeoutMs };
    }
    return { ok: false, error: "llm_network_error", detail: err.message };
  }
}

async function azureOpenaiCall(messages, providerConfig) {
  const apiKey = process.env[providerConfig.api_key_env || "AZURE_OPENAI_API_KEY"] || "";
  const endpoint = process.env[providerConfig.endpoint_env || "AZURE_OPENAI_ENDPOINT"] || "";
  if (!apiKey || !endpoint) {
    return { ok: false, error: "azure_credentials_not_set" };
  }

  const model = providerConfig.model || "gpt-4.1";
  const apiVersion = providerConfig.api_version || "2024-12-01-preview";
  const url = `${endpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
  const cfg = getLlmProviderConfig();
  const timeoutMs = cfg?.timeout_ms || 12000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ messages, temperature: 0.3 }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: "azure_llm_api_error",
        status: response.status,
        detail: errBody?.error?.message || response.statusText,
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    return { ok: true, content, model: data?.model || model, usage: data?.usage || null };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, error: "azure_llm_timeout", timeout_ms: timeoutMs };
    }
    return { ok: false, error: "azure_llm_network_error", detail: err.message };
  }
}

async function routeLlmCall(messages, entityContext, jobId) {
  // SH-002: Use health-aware provider selection with fallback
  const selection = selectLlmProviderWithFallback(entityContext, jobId);

  if (!selection.provider) {
    logLine(
      `LLM_BLOCKED: ${selection.reason} entity=${entityContext || "none"} job=${jobId || "none"}`,
    );
    return {
      ok: false,
      ...blockedExplainability(
        selection.reason,
        "llm_call",
        selection.reason.includes("hipaa")
          ? "Configure Azure OpenAI with a BAA-covered deployment for Everest operations."
          : "Configure an LLM provider in config/llm_provider.json or set the required API key environment variable.",
      ),
    };
  }

  // PHI redaction for entities that require it
  const sanitizedMessages = redactPhiFromMessages(messages, entityContext);

  const startMs = Date.now();
  let result;

  if (selection.provider === "openai_direct") {
    result = await openaiDirectCall(sanitizedMessages, selection.config);
  } else if (selection.provider === "azure_openai") {
    result = await azureOpenaiCall(sanitizedMessages, selection.config);
  } else {
    result = { ok: false, error: `unsupported_provider: ${selection.provider}` };
  }

  const latencyMs = Date.now() - startMs;

  // SH-002: Record provider health metrics for EWMA scoring
  recordProviderResult(selection.provider, result.ok, latencyMs);

  appendAudit("LLM_CALL", {
    provider: selection.provider,
    reason: selection.reason,
    entity: entityContext || null,
    job_id: jobId || null,
    ok: result.ok,
    error: result.ok ? undefined : result.error,
    latency_ms: latencyMs,
    model: result.model || null,
    is_fallback: selection.isFallback || false,
  });

  return result;
}

// ─── LLM Output Contract Validation (JC-070e) ───

function validateLlmOutputContract(intent, llmOutput, entityContext) {
  const result = { valid: true, missing_sections: [], banned_phrases_found: [] };

  if (typeof llmOutput !== "string" || !llmOutput.trim()) {
    return { valid: false, missing_sections: ["entire_output"], banned_phrases_found: [] };
  }

  const outputLower = llmOutput.toLowerCase();

  // JC-090b+090c: Configurable output contracts — banned phrases for ALL intents
  const contracts = getOutputContracts();
  const intentContract = contracts[intent] || {};
  const contractForbidden = Array.isArray(intentContract.forbidden_patterns)
    ? intentContract.forbidden_patterns
    : [];
  for (const pattern of contractForbidden) {
    if (typeof pattern === "string" && pattern && outputLower.includes(pattern.toLowerCase())) {
      result.banned_phrases_found.push(pattern);
      result.valid = false;
      // JC-090c: Trust event for banned phrase detection
      try {
        appendEvent("governance.output_contract.blocked", "validateLlmOutputContract", {
          intent,
          reason: "banned_phrase",
          phrase: pattern,
        });
      } catch {
        /* non-fatal */
      }
    }
  }

  // JC-090b: Check configurable required_sections (supplements intent-specific checks below)
  const contractRequired = Array.isArray(intentContract.required_sections)
    ? intentContract.required_sections
    : [];
  for (const section of contractRequired) {
    const sectionLower = section.toLowerCase().replace(/_/g, " ");
    if (!outputLower.includes(sectionLower) && !outputLower.includes(section.toLowerCase())) {
      // Only add if not already tracked by intent-specific checks below
      if (!result.missing_sections.includes(section)) {
        result.missing_sections.push(`contract:${section}`);
        result.valid = false;
      }
    }
  }

  if (intent === "morning_brief") {
    const briefCfg = getBriefConfig();
    const sections = briefCfg?.daily_briefs?.work?.must_include || [];
    for (const section of sections) {
      // Check for key terms from each required section
      const keywords = section
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 3);
      const found = keywords.some((kw) => outputLower.includes(kw));
      if (!found) {
        result.missing_sections.push(section);
        result.valid = false;
      }
    }
  }

  if (intent === "eod_digest") {
    const briefCfg = getBriefConfig();
    const sections = briefCfg?.isaac_nightly_report?.required_sections || [];
    for (const section of sections) {
      const keywords = section
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 3);
      const found = keywords.some((kw) => outputLower.includes(kw));
      if (!found) {
        result.missing_sections.push(section);
        result.valid = false;
      }
    }
  }

  if (intent === "draft_email") {
    const draftStyle = getDraftStyleConfig();
    // Check signature
    if (!llmOutput.includes("— Clint") && !llmOutput.includes("-- Clint")) {
      result.missing_sections.push("signature");
      result.valid = false;
    }
    // Check disclaimer
    const disclaimerText = draftStyle?.signature_conventions?.draft_disclaimer || "";
    if (
      disclaimerText &&
      !llmOutput.includes(disclaimerText) &&
      !outputLower.includes("draft for review")
    ) {
      result.missing_sections.push("draft_disclaimer");
      result.valid = false;
    }
    // Check banned phrases
    const banned = draftStyle?.words_to_avoid || [];
    for (const phrase of banned) {
      if (outputLower.includes(phrase.toLowerCase())) {
        result.banned_phrases_found.push(phrase);
        result.valid = false;
      }
    }
  }

  if (intent === "triage_classify") {
    try {
      const parsed = typeof llmOutput === "string" ? JSON.parse(llmOutput) : llmOutput;
      if (!parsed.entity) {
        result.missing_sections.push("entity");
        result.valid = false;
      }
      if (parsed.confidence === undefined) {
        result.missing_sections.push("confidence");
        result.valid = false;
      }
    } catch {
      result.missing_sections.push("valid_json");
      result.valid = false;
    }
  }

  if (intent === "deadline_extract") {
    try {
      const parsed = typeof llmOutput === "string" ? JSON.parse(llmOutput) : llmOutput;
      const candidates = Array.isArray(parsed) ? parsed : parsed?.candidates || [];
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (!c.date && !c.parsed_date) {
          result.missing_sections.push(`candidate[${i}].date`);
        }
        if (!c.context) {
          result.missing_sections.push(`candidate[${i}].context`);
        }
        if (c.confidence === undefined) {
          result.missing_sections.push(`candidate[${i}].confidence`);
        }
      }
      if (result.missing_sections.length > 0) {
        result.valid = false;
      }
    } catch {
      result.missing_sections.push("valid_json");
      result.valid = false;
    }
  }

  if (intent === "commitment_extract") {
    try {
      const parsed =
        typeof llmOutput === "string"
          ? JSON.parse(llmOutput.replace(/^```json\s*/, "").replace(/```\s*$/, ""))
          : llmOutput;
      if (!Array.isArray(parsed)) {
        result.missing_sections.push("json_array");
        result.valid = false;
      } else {
        for (let i = 0; i < parsed.length; i++) {
          const c = parsed[i];
          if (!c || typeof c.what !== "string") {
            result.missing_sections.push(`commitment[${i}].what`);
          }
          if (
            c.confidence !== undefined &&
            (typeof c.confidence !== "number" || c.confidence < 0 || c.confidence > 1)
          ) {
            result.missing_sections.push(`commitment[${i}].confidence_range`);
          }
        }
        if (result.missing_sections.length > 0) {
          result.valid = false;
        }
      }
    } catch {
      result.missing_sections.push("valid_json");
      result.valid = false;
    }
  }

  // Entity boundary check
  if (entityContext) {
    const operatorCfg = getOperatorProfile();
    const neverMix =
      operatorCfg?.contexts?.entity_separation?.[entityContext]?.never_mix_with || [];
    for (const blocked of neverMix) {
      const blockedLower = blocked.toLowerCase();
      // Check for explicit entity name references (avoid false positives from common words)
      if (blockedLower !== "personal" && outputLower.includes(blockedLower)) {
        const emailDomains =
          operatorCfg?.contexts?.entity_separation?.[blocked]?.email_domains || [];
        const hasDomainRef = emailDomains.some((d) => outputLower.includes(d.toLowerCase()));
        if (hasDomainRef) {
          result.banned_phrases_found.push(`entity_boundary_violation: ${blocked}`);
          result.valid = false;
        }
      }
    }
  }

  // JC-088a: Trust ledger write — record every validation result + failure details (JC-110c)
  try {
    const trustRecord = {
      kind: "trust_validation",
      intent,
      passed: result.valid,
      entity: entityContext || null,
      timestamp: new Date().toISOString(),
    };
    if (!result.valid) {
      trustRecord.missing_sections = result.missing_sections;
      trustRecord.banned_phrases_found = result.banned_phrases_found;
    }
    appendJsonlLine(trustLedgerPath, trustRecord);
    appendEvent(
      result.valid ? "trust.validation.passed" : "trust.validation.failed",
      "validateLlmOutputContract",
      {
        intent,
        entity: entityContext || null,
        missing_sections: result.missing_sections,
        banned_phrases: result.banned_phrases_found,
      },
    );
  } catch (trustErr) {
    logLine(`TRUST_LEDGER_WRITE_ERROR: ${trustErr?.message || "unknown"}`);
  }

  return result;
}

// ─── Notification Budget Enforcement (JC-084a) ───

let dailyNotificationCount = 0;
let dailyNotificationDate = "";

function checkNotificationBudget(severity) {
  const budget = getNotificationBudget();
  if (!budget) {
    return { allowed: true, reason: "no_budget_config" };
  }

  // Crisis overrides always allowed
  if (severity === "critical" && budget.crisis_override) {
    return { allowed: true, reason: "crisis_override" };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (dailyNotificationDate !== today) {
    dailyNotificationCount = 0;
    dailyNotificationDate = today;
  }

  if (dailyNotificationCount >= (budget.daily_push_max || 3)) {
    return { allowed: false, reason: "daily_budget_exceeded", count: dailyNotificationCount };
  }

  // C10-020: Quiet hours check — use operator timezone
  if (budget.quiet_hours) {
    const now = new Date();
    let hours, minutes;
    try {
      const operatorCfg = getOperatorProfile();
      const tz = operatorCfg?.operator?.timezone;
      if (tz) {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });
        const parts = formatter.formatToParts(now);
        hours = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
        minutes = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
      } else {
        // No timezone configured — fall back to server local time
        hours = now.getHours();
        minutes = now.getMinutes();
      }
    } catch {
      // Intl fallback — use server local time
      hours = now.getHours();
      minutes = now.getMinutes();
    }
    const currentTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const start = budget.quiet_hours.start || "20:00";
    const end = budget.quiet_hours.end || "07:00";
    const inQuietHours =
      start > end
        ? currentTime >= start || currentTime < end
        : currentTime >= start && currentTime < end;
    if (inQuietHours && severity !== "critical") {
      return { allowed: false, reason: "quiet_hours" };
    }
  }

  return { allowed: true, reason: "within_budget" };
}

function recordNotificationSent() {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyNotificationDate !== today) {
    dailyNotificationCount = 0;
    dailyNotificationDate = today;
  }
  dailyNotificationCount += 1;
}

// ─── Onboarding Ramp Phase (JC-084a) ───

function getOnboardingPhase() {
  const ramp = getOnboardingRamp();
  if (!ramp || !ramp.start_date) {
    return { phase: null, features: ["full"], label: "No onboarding configured" };
  }

  const startDate = new Date(ramp.start_date);
  const now = new Date();
  const daysSinceStart =
    Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  for (const phase of ramp.phases || []) {
    const [start, end] = phase.days;
    if (daysSinceStart >= start && (end === null || daysSinceStart <= end)) {
      return {
        phase: phase.label,
        features: phase.features,
        push_max: phase.push_max,
        day: daysSinceStart,
      };
    }
  }

  return { phase: "full", features: ["full"], label: "Past all onboarding phases" };
}

function isFeatureEnabledByOnboarding(featureName) {
  const phase = getOnboardingPhase();
  if (!phase.features) {
    return true;
  }
  if (phase.features.includes("full")) {
    return true;
  }
  return phase.features.includes(featureName);
}

// MF-10: Onboarding activation endpoint
async function onboardingActivateEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const startDate = typeof body?.start_date === "string" ? body.start_date.trim() : "";
  if (!startDate) {
    sendJson(res, 400, { error: "start_date_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const ramp = getOnboardingRamp();
  if (ramp?.start_date) {
    sendJson(res, 200, {
      status: "already_activated",
      start_date: ramp.start_date,
      phase: getOnboardingPhase(),
    });
    logLine(`POST ${route} -> 200 already_activated`);
    return;
  }
  // Write start_date to onboarding_ramp.json
  try {
    const raw = fs.readFileSync(onboardingRampConfigPath, "utf8");
    const cfg = JSON.parse(raw);
    cfg.start_date = startDate;
    fs.writeFileSync(onboardingRampConfigPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  } catch (err) {
    sendJson(res, 500, { error: "config_write_failed", message: err?.message || "unknown" });
    logLine(`POST ${route} -> 500`);
    return;
  }
  appendEvent("onboarding.activated", route, { start_date: startDate });
  appendAudit("ONBOARDING_ACTIVATED", { start_date: startDate });
  sendJson(res, 200, { status: "activated", start_date: startDate, phase: getOnboardingPhase() });
  logLine(`POST ${route} -> 200`);
}

// MF-10: Setup validation endpoint
function setupValidateEndpoint(res, route) {
  const issues = [];
  const checks = {};

  // Config files check
  const requiredConfigs = [
    "graph.profiles.json",
    "autonomy_ladder.json",
    "brief_config.json",
    "hard_bans.json",
    "operator_profile.json",
    "style_guide.json",
    "urgency_rules.json",
  ];
  const configDir = path.join(__dirname, "config");
  for (const f of requiredConfigs) {
    const exists = fs.existsSync(path.join(configDir, f));
    checks[`config.${f}`] = exists ? "ok" : "missing";
    if (!exists) {
      issues.push({ severity: "error", message: `Missing config: ${f}` });
    }
  }

  // Graph profiles check
  for (const profileId of ["olumie", "everest"]) {
    const cfg = getGraphProfileConfig(profileId);
    checks[`graph.${profileId}.configured`] = cfg.ok ? "ok" : cfg.error;
    if (!cfg.ok) {
      issues.push({ severity: "warning", message: `Graph profile ${profileId}: ${cfg.error}` });
    }

    const tokenRecord = getTokenRecord(profileId);
    const authed = hasUsableAccessToken(tokenRecord);
    checks[`graph.${profileId}.authenticated`] = authed ? "ok" : "not_authenticated";
    if (!authed) {
      issues.push({
        severity: "warning",
        message: `Graph profile ${profileId}: not authenticated`,
      });
    }
  }

  // Onboarding check
  const phase = getOnboardingPhase();
  checks["onboarding.active"] = phase.phase ? "ok" : "not_activated";
  if (!phase.phase) {
    issues.push({
      severity: "info",
      message: "Onboarding not activated — run POST /ops/onboarding/activate",
    });
  }

  // Scheduler check
  const schedulerCfg = getSchedulerConfig();
  checks["scheduler"] = schedulerCfg?.enabled ? "enabled" : "disabled";

  const blockingIssues = issues.filter((i) => i.severity === "error");

  appendEvent("setup.validated", route, {
    checks_count: Object.keys(checks).length,
    issues_count: issues.length,
    blocking: blockingIssues.length,
  });
  sendJson(res, 200, {
    checks,
    issues,
    blocking_issues: blockingIssues,
    ready: blockingIssues.length === 0,
  });
  logLine(`GET ${route} -> 200`);
}

function setGraphLastError(profileId, message) {
  graphLastErrorByProfile.set(profileId, message);
}

function clearGraphLastError(profileId) {
  graphLastErrorByProfile.delete(profileId);
}

function getTokenAccessToken(tokenRecord) {
  if (!tokenRecord || typeof tokenRecord !== "object") {
    return null;
  }
  const accessToken =
    typeof tokenRecord.access_token === "string" ? tokenRecord.access_token.trim() : "";
  return accessToken || null;
}

function getTokenExpiryMs(tokenRecord) {
  if (!tokenRecord || typeof tokenRecord !== "object") {
    return null;
  }
  const issuedAt = Number(tokenRecord.stored_at_ms || tokenRecord.issued_at_ms || 0);
  const expiresInSec = Number(tokenRecord.expires_in || 0);
  if (
    !Number.isFinite(issuedAt) ||
    issuedAt <= 0 ||
    !Number.isFinite(expiresInSec) ||
    expiresInSec <= 0
  ) {
    return null;
  }
  return issuedAt + expiresInSec * 1000;
}

function hasUsableAccessToken(tokenRecord) {
  const token = getTokenAccessToken(tokenRecord);
  if (!token) {
    return false;
  }
  const expiryMs = getTokenExpiryMs(tokenRecord);
  if (!expiryMs) {
    return true;
  }
  return expiryMs > Date.now();
}

// MF-2: Token refresh — proactive refresh before expiry using offline_access refresh_token
const _refreshingProfiles = new Map(); // per-profile mutex to prevent concurrent refresh

async function refreshAccessToken(profileId, tokenRecord) {
  const refreshToken =
    typeof tokenRecord?.refresh_token === "string" ? tokenRecord.refresh_token.trim() : "";
  if (!refreshToken) {
    return { ok: false, reason: "no_refresh_token" };
  }

  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return { ok: false, reason: cfg.error };
  }

  const { tenant_id, client_id, delegated_scopes } = cfg.profile;
  const endpoint = `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`;
  const reqBody = new URLSearchParams();
  reqBody.set("client_id", client_id);
  reqBody.set("grant_type", "refresh_token");
  reqBody.set("refresh_token", refreshToken);
  reqBody.set("scope", delegated_scopes.join(" "));

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: reqBody,
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
      const newTokenRecord = { ...payload, stored_at_ms: Date.now() };
      const stored = storeTokenRecord(profileId, newTokenRecord);
      if (!stored) {
        return { ok: false, reason: "token_store_failed" };
      }
      logLine(`TOKEN_REFRESH: ${profileId} refreshed successfully`);
      try {
        appendEvent("graph.auth.refreshed", "refreshAccessToken", { profile_id: profileId });
      } catch {
        /* non-fatal */
      }
      return { ok: true, tokenRecord: newTokenRecord };
    }

    const errorCode = typeof payload.error === "string" ? payload.error : "refresh_failed";
    logLine(`TOKEN_REFRESH_FAILED: ${profileId} — ${errorCode}`);
    try {
      appendEvent("graph.auth.refresh_failed", "refreshAccessToken", {
        profile_id: profileId,
        error: errorCode,
      });
    } catch {
      /* non-fatal */
    }
    return { ok: false, reason: errorCode };
  } catch (err) {
    logLine(`TOKEN_REFRESH_ERROR: ${profileId} — ${err?.message || "unknown"}`);
    try {
      appendEvent("graph.auth.refresh_failed", "refreshAccessToken", {
        profile_id: profileId,
        error: err?.message || "network_error",
      });
    } catch {
      /* non-fatal */
    }
    return { ok: false, reason: "refresh_network_error" };
  }
}

async function ensureValidToken(profileId) {
  // Fast path: token is still valid
  const tokenRecord = getTokenRecord(profileId);
  if (hasUsableAccessToken(tokenRecord)) {
    return { ok: true, accessToken: getTokenAccessToken(tokenRecord), tokenRecord };
  }

  // No token at all
  if (!tokenRecord) {
    return { ok: false, reason: "no_token" };
  }

  // Per-profile mutex: only one refresh at a time
  if (_refreshingProfiles.has(profileId)) {
    // Wait for in-flight refresh
    try {
      const result = await _refreshingProfiles.get(profileId);
      if (result?.ok) {
        return {
          ok: true,
          accessToken: getTokenAccessToken(result.tokenRecord),
          tokenRecord: result.tokenRecord,
        };
      }
    } catch (err) {
      logLine(`TOKEN_CONCURRENT_REFRESH_ERROR: ${profileId} -- ${err?.message || String(err)}`);
    }
    return { ok: false, reason: "concurrent_refresh_failed" };
  }

  // Attempt refresh
  const refreshPromise = refreshAccessToken(profileId, tokenRecord);
  _refreshingProfiles.set(profileId, refreshPromise);
  try {
    const result = await refreshPromise;
    if (result.ok) {
      return {
        ok: true,
        accessToken: getTokenAccessToken(result.tokenRecord),
        tokenRecord: result.tokenRecord,
      };
    }
    return { ok: false, reason: result.reason };
  } finally {
    _refreshingProfiles.delete(profileId);
  }
}

// ── Self-Healing: Circuit Breaker (SH-001) ──
const _circuitBreakerState = new Map();
const CB_FAILURE_RATE_THRESHOLD = 0.5;
const CB_MIN_CALLS = 5;
const CB_WINDOW_MS = 10 * 60 * 1000;
const CB_DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const CB_SLOW_CALL_MS = 10000;

function classifyGraphWorkload(url) {
  if (/\/me\/todo\//i.test(url) || /\/todo\//i.test(url)) {
    return "todo";
  }
  if (/\/planner\//i.test(url) || /\/groups\/[^/]+\/planner/i.test(url)) {
    return "planner";
  }
  if (/\/sites\//i.test(url) || /\/drives\//i.test(url)) {
    return "sharepoint";
  }
  if (/\/teams\//i.test(url) || /\/chats\//i.test(url)) {
    return "teams";
  }
  if (/\/calendar\//i.test(url) || /\/events\//i.test(url) || /\/calendarView/i.test(url)) {
    return "outlook_calendar";
  }
  if (
    /\/messages\//i.test(url) ||
    /\/messages$/i.test(url) ||
    /\/mailFolders\//i.test(url) ||
    /\/sendMail/i.test(url)
  ) {
    return "outlook_mail";
  }
  return "users";
}

function _getCbState(group) {
  if (!_circuitBreakerState.has(group)) {
    _circuitBreakerState.set(group, {
      state: "closed",
      window: [],
      openedAt: null,
      cooldownMs: CB_DEFAULT_COOLDOWN_MS,
      probeInFlight: false,
    });
  }
  return _circuitBreakerState.get(group);
}

function _pruneWindow(cb) {
  const cutoff = Date.now() - CB_WINDOW_MS;
  cb.window = cb.window.filter((e) => e.ts > cutoff);
}

function isCircuitOpen(group) {
  const cb = _getCbState(group);
  if (cb.state === "closed") {
    return false;
  }
  if (cb.state === "open") {
    if (Date.now() - cb.openedAt >= cb.cooldownMs) {
      cb.state = "half-open";
      logLine(`CIRCUIT_BREAKER: ${group} transitioning to half-open`);
    }
    return cb.state === "open";
  }
  return false; // half-open allows probes
}

function tryHalfOpenProbe(group) {
  const cb = _getCbState(group);
  if (cb.state !== "half-open" || cb.probeInFlight) {
    return false;
  }
  cb.probeInFlight = true;
  return true;
}

function recordCircuitOutcome(group, success, latencyMs, retryAfterSec) {
  const cb = _getCbState(group);
  cb.window.push({ ts: Date.now(), success, latencyMs });
  _pruneWindow(cb);
  const isSlow = latencyMs > CB_SLOW_CALL_MS;
  if (isSlow) {
    appendEvent("self_healing.circuit_breaker.slow_call", "graph", {
      workload_group: group,
      latency_ms: latencyMs,
    });
  }
  if (cb.state === "half-open") {
    cb.probeInFlight = false;
    if (success) {
      cb.state = "closed";
      cb.window = [];
      appendEvent("self_healing.circuit_breaker.recovered", "graph", { workload_group: group });
      logLine(`CIRCUIT_BREAKER: ${group} recovered (probe succeeded)`);
    } else {
      cb.state = "open";
      cb.openedAt = Date.now();
      cb.cooldownMs = Math.min(cb.cooldownMs * 2, 30 * 60 * 1000);
      appendEvent("self_healing.circuit_breaker.tripped", "graph", {
        workload_group: group,
        reason: "half_open_probe_failed",
      });
    }
    return;
  }
  if (cb.state === "closed" && cb.window.length >= CB_MIN_CALLS) {
    const failures = cb.window.filter((e) => !e.success).length;
    const failureRate = failures / cb.window.length;
    if (failureRate >= CB_FAILURE_RATE_THRESHOLD) {
      cb.state = "open";
      cb.openedAt = Date.now();
      cb.cooldownMs = retryAfterSec
        ? Math.max(CB_DEFAULT_COOLDOWN_MS, retryAfterSec * 1000)
        : CB_DEFAULT_COOLDOWN_MS;
      appendEvent("self_healing.circuit_breaker.tripped", "graph", {
        workload_group: group,
        failure_rate: failureRate,
        call_count: cb.window.length,
        cooldown_ms: cb.cooldownMs,
      });
      logLine(
        `CIRCUIT_BREAKER: ${group} tripped (${(failureRate * 100).toFixed(0)}% failures, cooldown ${cb.cooldownMs}ms)`,
      );
    }
  }
}

// ── C9-002/C9-003: Graph fetch with retry, exponential backoff, and 429 rate-limit handling ──
async function graphFetchWithRetry(url, options, retryOpts = {}) {
  const maxRetries = retryOpts.maxRetries ?? 3;
  const baseDelayMs = retryOpts.baseDelayMs ?? 500;
  const label = retryOpts.label ?? "graph_fetch";
  let lastError = null;
  let lastResp = null;

  // SH-001: Circuit breaker integration
  const _cbGroup = classifyGraphWorkload(url);
  const _fetchStart = Date.now();
  if (isCircuitOpen(_cbGroup)) {
    if (!tryHalfOpenProbe(_cbGroup)) {
      throw new Error(`Circuit open for workload group ${_cbGroup}`);
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, options);
      lastResp = resp;

      // 429 rate-limit: respect Retry-After header
      if (resp.status === 429 && attempt < maxRetries) {
        const retryAfterSec = parseInt(resp.headers.get("retry-after") || "5", 10);
        const delayMs = Math.min(retryAfterSec * 1000, 30000);
        logLine(`GRAPH_RATE_LIMITED: ${label} attempt=${attempt} retry_after=${retryAfterSec}s`);
        appendEvent("graph.rate_limited", label, {
          attempt,
          retry_after_sec: retryAfterSec,
          url: url.toString().slice(0, 120),
        });
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      // 5xx server error: retry with exponential backoff
      if (resp.status >= 500 && attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
        logLine(
          `GRAPH_RETRY: ${label} attempt=${attempt} status=${resp.status} delay=${delayMs}ms`,
        );
        appendEvent("graph.retry", label, { attempt, status: resp.status, delay_ms: delayMs });
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      // SH-001: Record circuit outcome on final response
      recordCircuitOutcome(_cbGroup, resp.ok, Date.now() - _fetchStart, 0);
      return resp;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
        logLine(
          `GRAPH_NETWORK_RETRY: ${label} attempt=${attempt} error=${err?.message || "unknown"} delay=${delayMs}ms`,
        );
        appendEvent("graph.network_retry", label, {
          attempt,
          error: err?.message,
          delay_ms: delayMs,
        });
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  // SH-001: Record circuit failure on exhausted retries
  recordCircuitOutcome(_cbGroup, false, Date.now() - _fetchStart, 0);

  // All retries exhausted — return last response or throw last error
  if (lastResp) {
    return lastResp;
  }
  throw (
    lastError || new Error(`graphFetchWithRetry: all ${maxRetries} retries exhausted for ${label}`)
  );
}

// ── C9-001: Graph fetch with @odata.nextLink pagination ──
async function graphFetchAllPages(url, options, pageOpts = {}) {
  const maxPages = pageOpts.maxPages ?? 10;
  const label = pageOpts.label ?? "graph_pages";
  const allItems = [];
  let currentUrl = url;
  let pages = 0;
  let truncated = false;

  while (currentUrl && pages < maxPages) {
    const resp = await graphFetchWithRetry(currentUrl, options, { label: `${label}_p${pages}` });

    if (resp.status === 401 || resp.status === 403) {
      return {
        ok: false,
        items: allItems,
        totalPages: pages,
        truncated: false,
        error: "NOT_AUTHENTICATED",
      };
    }
    if (!resp.ok) {
      let errorDetail = `status_${resp.status}`;
      try {
        const body = await resp.json();
        errorDetail = body?.error?.code || errorDetail;
      } catch {
        /* intentional: body parse may fail on non-JSON error responses */
      }
      return {
        ok: false,
        items: allItems,
        totalPages: pages,
        truncated: false,
        error: errorDetail,
      };
    }

    let payload;
    try {
      payload = await resp.json();
    } catch {
      /* intentional: stop pagination on non-JSON response */ break;
    }

    const pageItems = Array.isArray(payload.value) ? payload.value : [];
    allItems.push(...pageItems);
    pages++;

    // Follow @odata.nextLink if present
    const nextLink = payload["@odata.nextLink"];
    if (typeof nextLink === "string" && nextLink.startsWith("http")) {
      currentUrl = nextLink;
    } else {
      currentUrl = null;
    }
  }

  if (currentUrl && pages >= maxPages) {
    truncated = true;
    logLine(
      `GRAPH_PAGINATION_TRUNCATED: ${label} stopped at ${maxPages} pages, ${allItems.length} items`,
    );
    appendEvent("graph.pagination.truncated", label, { pages: maxPages, items: allItems.length });
  }

  return { ok: true, items: allItems, totalPages: pages, truncated };
}

function isExampleGraphProfile(profile) {
  return (
    profile.tenant_id === "11111111-1111-1111-1111-111111111111" ||
    profile.tenant_id === "22222222-2222-2222-2222-222222222222" ||
    profile.client_id === "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" ||
    profile.client_id === "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
  );
}

function getGraphProfileConfig(profileId) {
  if (!GRAPH_ALLOWED_PROFILES.has(profileId)) {
    return { ok: false, status: 400, error: "unsupported_profile_id" };
  }
  const config = readGraphProfilesConfig();
  if (!config.profiles) {
    return { ok: false, status: 400, error: "graph_profile_config_missing" };
  }
  const profile = config.profiles?.[profileId];
  if (!profile || typeof profile !== "object") {
    return { ok: false, status: 400, error: "graph_profile_not_configured" };
  }
  const tenantId = typeof profile.tenant_id === "string" ? profile.tenant_id.trim() : "";
  const clientId = typeof profile.client_id === "string" ? profile.client_id.trim() : "";
  const scopes = Array.isArray(profile.delegated_scopes)
    ? profile.delegated_scopes.filter(
        (scope) => typeof scope === "string" && scope.trim().length > 0,
      )
    : [];
  if (!tenantId || !clientId || scopes.length === 0) {
    return { ok: false, status: 400, error: "graph_profile_incomplete" };
  }
  return {
    ok: true,
    profile: {
      tenant_id: tenantId,
      client_id: clientId,
      delegated_scopes: scopes,
    },
  };
}

function buildGraphStatusPayload(profileId) {
  const config = readGraphProfilesConfig();
  const profile = config.profiles?.[profileId];
  const configured = !!profile && typeof profile === "object";
  const tenantId =
    configured && typeof profile.tenant_id === "string" ? profile.tenant_id.trim() : "";
  const clientId =
    configured && typeof profile.client_id === "string" ? profile.client_id.trim() : "";
  const delegatedScopes =
    configured && Array.isArray(profile.delegated_scopes)
      ? profile.delegated_scopes.filter((scope) => typeof scope === "string")
      : [];
  const tokenRecord = getTokenRecord(profileId);
  const authState = hasUsableAccessToken(tokenRecord) ? "CONNECTED" : "DISCONNECTED";
  const authStore = getAuthStoreLabel(profileId);
  return {
    profile_id: profileId,
    configured,
    tenant_id_present: tenantId.length > 0,
    client_id_present: clientId.length > 0,
    delegated_scopes: delegatedScopes,
    auth_store: authStore,
    auth_state: authState,
    next_action: authState === "CONNECTED" ? "NONE" : "RUN_DEVICE_CODE_AUTH",
    last_error: graphLastErrorByProfile.get(profileId) || null,
  };
}

function toRecipientList(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .filter((v) => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map((address) => ({ emailAddress: { address } }));
}

async function createGraphDraft(profileId, req, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    logLine(`POST ${route} -> ${cfg.status}`);
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    logLine(`POST ${route} -> 409`);
    return;
  }

  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    setGraphLastError(profileId, "invalid_json_body");
    sendJson(res, 400, { profile_id: profileId, error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const toRecipients = toRecipientList(body.to);
  const ccRecipients = toRecipientList(body.cc);
  const bccRecipients = toRecipientList(body.bcc);
  if (!subject || toRecipients.length === 0) {
    setGraphLastError(profileId, "invalid_draft_payload");
    sendJson(res, 400, { profile_id: profileId, error: "invalid_draft_payload" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const bodyText = typeof body.body_text === "string" ? body.body_text : "";
  const bodyHtml = typeof body.body_html === "string" ? body.body_html : "";
  const graphBody = {
    contentType: bodyHtml ? "HTML" : "Text",
    content: bodyHtml || bodyText || "",
  };

  const accessToken = tokenResult.accessToken;
  const graphReq = {
    subject,
    toRecipients,
    ccRecipients,
    bccRecipients,
    body: graphBody,
  };

  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(graphReq),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      logLine(`POST ${route} -> 409`);
      return;
    }
    if (!response.ok) {
      const code =
        typeof payload?.error?.code === "string" ? payload.error.code : "graph_draft_create_failed";
      setGraphLastError(profileId, code);
      sendJson(res, 502, { profile_id: profileId, error: code });
      logLine(`POST ${route} -> 502`);
      return;
    }
    clearGraphLastError(profileId);
    appendAudit("DRAFT_CREATE", { profile_id: profileId, message_id: payload.id || null });
    appendJsonlLine(mailLedgerPath, {
      kind: "mail_draft_created",
      message_id: payload.id || null,
      subject,
      to: toRecipients,
      profile_id: profileId,
      timestamp: new Date().toISOString(),
    });
    // JC-092d: Normalized draft created event
    appendEvent("draft.created", "/graph/mail/draft/create", {
      profile_id: profileId,
      subject: subject || null,
    });
    sendJson(res, 200, {
      profile_id: profileId,
      draft_created: true,
      message_id: typeof payload.id === "string" ? payload.id : null,
      web_link: typeof payload.webLink === "string" ? payload.webLink : undefined,
      subject,
    });
    logLine(`POST ${route} -> 200`);
  } catch (err) {
    logLine(`GRAPH_DRAFT_ERROR: ${err?.message || String(err)}`);
    setGraphLastError(profileId, "graph_draft_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "graph_draft_network_error" });
    logLine(`POST ${route} -> 502`);
  }
}

async function listGraphCalendar(profileId, parsedUrl, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    logLine(`GET ${route} -> ${cfg.status}`);
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    logLine(`GET ${route} -> 409`);
    return;
  }

  const accessToken = tokenResult.accessToken;
  const daysRaw = Number.parseInt(parsedUrl.searchParams.get("days") || "7", 10);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 30 ? daysRaw : 7;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

  const endpoint = new URL("https://graph.microsoft.com/v1.0/me/calendarview");
  endpoint.searchParams.set("startDateTime", startDate.toISOString());
  endpoint.searchParams.set("endDateTime", endDate.toISOString());
  // C9-030: Enriched select with attendees, body, organizer
  endpoint.searchParams.set(
    "$select",
    "id,subject,start,end,location,attendees,body,organizer,isAllDay,showAs",
  );
  endpoint.searchParams.set("$top", "50");

  try {
    // C9-001: Use paginated fetch with retry
    const result = await graphFetchAllPages(
      endpoint.toString(),
      {
        method: "GET",
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
      },
      { maxPages: 5, label: "calendar_list" },
    );

    if (!result.ok && result.error === "NOT_AUTHENTICATED") {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      logLine(`GET ${route} -> 409`);
      return;
    }

    if (!result.ok) {
      setGraphLastError(profileId, result.error || "calendar_list_failed");
      sendJson(res, 502, { profile_id: profileId, error: result.error || "calendar_list_failed" });
      logLine(`GET ${route} -> 502`);
      return;
    }

    const events = result.items.map((event) => normalizeCalendarEventRich(event));
    clearGraphLastError(profileId);
    try {
      appendJsonlLine(calendarLedgerPath, {
        kind: "calendar_fetched",
        profile_id: profileId,
        count: events.length,
        truncated: result.truncated,
        at: new Date().toISOString(),
      });
      const calSummary = events.slice(0, 5).map((e) => normalizeCalendarEvent(e, "fetched"));
      appendEvent("calendar.fetched", "/graph/calendar/list", {
        profile_id: profileId,
        count: events.length,
        pages: result.totalPages,
        truncated: result.truncated,
        sample: calSummary,
      });
    } catch (err) {
      logLine(`CALENDAR_LEDGER_WRITE_ERROR: ${err?.message || String(err)}`);
    }
    sendJson(res, 200, {
      profile_id: profileId,
      read_only: true,
      days,
      events,
      truncated: result.truncated,
    });
    logLine(`GET ${route} -> 200`);
  } catch (err) {
    logLine(`GRAPH_CALENDAR_LIST_ERROR: ${err?.message || String(err)}`);
    setGraphLastError(profileId, "calendar_list_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "calendar_list_network_error" });
    logLine(`GET ${route} -> 502`);
  }
}

// C10-030: Robust HTML-to-plain-text stripping
function stripHtml(html) {
  if (typeof html !== "string") {
    return "";
  }
  let text = html;
  // 1. Remove script, style, head blocks entirely
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<head[\s\S]*?<\/head>/gi, "");
  // 2. Replace block-break tags with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  // 3. Strip remaining tags
  text = text.replace(/<[^>]*>/g, "");
  // 4. Decode HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&apos;/g, "'");
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  // 5. Collapse multiple blank lines to single blank line
  text = text.replace(/\n{3,}/g, "\n\n");
  // 6. Trim
  return text.trim();
}

// BL-001: Word-level edit distance — returns 0.0 (identical) to 1.0 (total rewrite)
function editDistance(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return 1.0;
  }
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  if (wordsA.length === 0 && wordsB.length === 0) {
    return 0.0;
  }
  if (wordsA.length === 0 || wordsB.length === 0) {
    return 1.0;
  }
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let shared = 0;
  for (const w of setA) {
    if (setB.has(w)) {
      shared++;
    }
  }
  const total = new Set([...wordsA, ...wordsB]).size;
  return total === 0 ? 0.0 : Math.round((1 - shared / total) * 100) / 100;
}

// BL-001: Append a correction signal to the Builder Lane correction signals ledger
function appendCorrectionSignal(signalType, domain, magnitude, opts = {}) {
  const record = {
    signal_type: signalType,
    domain,
    magnitude,
    latency_ms: opts.latency_ms || null,
    section_affected: opts.section_affected || null,
    context_bucket: opts.context_bucket || {},
    entity: opts.entity || null,
    source_id: opts.source_id || null,
    attributed_proposal_id: opts.attributed_proposal_id || null,
    timestamp: new Date().toISOString(),
  };
  appendJsonlLine(correctionSignalsPath, record);
  appendEvent("improvement.correction.recorded", "builder_lane", {
    signal_type: signalType,
    domain,
    magnitude,
  });
}

// ── Self-Healing: Correction Taxonomy Classifier (SH-007) ──
const CORRECTION_SUBCATEGORIES = {
  tone: ["tone.formality", "tone.cliche", "tone.verbosity"],
  content: ["content.missing", "content.redundant", "content.emphasis"],
  structure: ["structure.sentence", "structure.document", "structure.density"],
  factual: ["factual.data", "factual.outdated", "factual.attribution"],
};
const AI_CLICHE_PHRASES = [
  "i hope this finds you well",
  "i wanted to reach out",
  "please don't hesitate",
  "at the end of the day",
  "moving forward",
  "circle back",
  "touch base",
  "per our conversation",
  "as discussed",
  "just checking in",
  "loop in",
  "low-hanging fruit",
  "synergy",
  "paradigm shift",
  "leverage",
];

function _classifyCorrection(originalText, editedText, _context = {}) {
  if (!originalText || !editedText || originalText === editedText) {
    return {
      category: "content",
      subcategory: "content.missing",
      confidence: 0,
      evidence: "no_diff",
      spans: [],
    };
  }
  const origWords = originalText.split(/\s+/);
  const editWords = editedText.split(/\s+/);
  const origLower = originalText.toLowerCase();
  const editLower = editedText.toLowerCase();
  const spans = [];
  const lenRatio = editWords.length / Math.max(origWords.length, 1);

  // 1. Check for AI cliché removal
  for (const cliche of AI_CLICHE_PHRASES) {
    if (origLower.includes(cliche) && !editLower.includes(cliche)) {
      spans.push({ original: cliche, edited: "(removed)", reason: "cliche_removal" });
    }
  }
  if (spans.length > 0) {
    return {
      category: "tone",
      subcategory: "tone.cliche",
      confidence: 0.9,
      evidence: `Removed ${spans.length} stock phrase(s)`,
      spans,
    };
  }

  // 2. Formality changes (Hi→Dear, Hey→Mr./Ms.)
  const formalityPatterns = [
    { from: /\b(hi|hey|hiya)\b/i, to: /\b(dear|mr\.|ms\.|dr\.)\b/i },
    { from: /\b(thanks|thx)\b/i, to: /\b(thank you|sincerely|regards)\b/i },
  ];
  for (const fp of formalityPatterns) {
    if (fp.from.test(origLower) && fp.to.test(editLower)) {
      return {
        category: "tone",
        subcategory: "tone.formality",
        confidence: 0.85,
        evidence: "Salutation/closing formality changed",
        spans: [
          {
            original: origLower.match(fp.from)?.[0] || "",
            edited: editLower.match(fp.to)?.[0] || "",
            reason: "formality_upgrade",
          },
        ],
      };
    }
  }

  // 3. Verbosity: significant text removed, meaning preserved (>20% reduction)
  if (lenRatio < 0.8 && editWords.length > 5) {
    return {
      category: "tone",
      subcategory: "tone.verbosity",
      confidence: 0.75,
      evidence: `Word count reduced ${origWords.length}→${editWords.length} (${Math.round((1 - lenRatio) * 100)}% reduction)`,
      spans: [],
    };
  }

  // 4. Content added (>30% increase)
  if (lenRatio > 1.3) {
    return {
      category: "content",
      subcategory: "content.missing",
      confidence: 0.75,
      evidence: `Content added: ${editWords.length - origWords.length} words`,
      spans: [],
    };
  }

  // 5. Content removed (>40% reduction)
  if (lenRatio < 0.6) {
    return {
      category: "content",
      subcategory: "content.redundant",
      confidence: 0.7,
      evidence: `Content removed: ${origWords.length - editWords.length} words`,
      spans: [],
    };
  }

  // 6. Factual: numbers/dates changed
  const numberPattern = /\b\d[\d,.]+\b/g;
  const origNumbers = (origLower.match(numberPattern) || []).toSorted();
  const editNumbers = (editLower.match(numberPattern) || []).toSorted();
  if (origNumbers.length > 0 && JSON.stringify(origNumbers) !== JSON.stringify(editNumbers)) {
    return {
      category: "factual",
      subcategory: "factual.data",
      confidence: 0.85,
      evidence: `Numbers changed: [${origNumbers.join(",")}] → [${editNumbers.join(",")}]`,
      spans: origNumbers.map((n, i) => ({
        original: n,
        edited: editNumbers[i] || "(removed)",
        reason: "number_change",
      })),
    };
  }

  // 7. Structure: paragraph reordering
  const origParas = originalText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const editParas = editedText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (origParas.length > 1 && editParas.length > 1 && origParas.length === editParas.length) {
    let reordered = false;
    for (let i = 0; i < origParas.length; i++) {
      if (origParas[i] !== editParas[i] && editParas.includes(origParas[i])) {
        reordered = true;
        break;
      }
    }
    if (reordered) {
      return {
        category: "structure",
        subcategory: "structure.document",
        confidence: 0.8,
        evidence: "Paragraphs reordered",
        spans: [],
      };
    }
  }

  // Default: content emphasis change
  return {
    category: "content",
    subcategory: "content.emphasis",
    confidence: 0.5,
    evidence: "General content edit — emphasis/priority change inferred",
    spans: [],
  };
}

function getCorrectionTaxonomyBreakdown() {
  const signals = readJsonlLines(correctionSignalsPath);
  const breakdown = {};
  for (const cat of Object.keys(CORRECTION_SUBCATEGORIES)) {
    breakdown[cat] = { total: 0, subcategories: {} };
    for (const sub of CORRECTION_SUBCATEGORIES[cat]) {
      breakdown[cat].subcategories[sub] = 0;
    }
  }
  for (const s of signals) {
    const cls = s._classification;
    if (cls && cls.category && breakdown[cls.category]) {
      breakdown[cls.category].total++;
      if (cls.subcategory && breakdown[cls.category].subcategories[cls.subcategory] !== undefined) {
        breakdown[cls.category].subcategories[cls.subcategory]++;
      }
    }
  }
  return breakdown;
}

// ── Self-Healing: Engagement Tracking (SH-008) ──
const engagementLedgerPath = path.join(artifactsDir, "engagement.jsonl");

function recordEngagement(contentType, deliveredAt, readAt, actionAt, interactionDurationMs) {
  const now = new Date();
  const delivered = new Date(deliveredAt);
  const record = {
    _ts: now.toISOString(),
    content_type: contentType,
    delivered_at: delivered.toISOString(),
    read_at: readAt ? new Date(readAt).toISOString() : null,
    read_latency_ms: readAt ? new Date(readAt).getTime() - delivered.getTime() : null,
    action_at: actionAt ? new Date(actionAt).toISOString() : null,
    action_latency_ms: actionAt ? new Date(actionAt).getTime() - delivered.getTime() : null,
    duration_ms: interactionDurationMs || null,
    day_of_week: now.getDay(),
    hour: now.getHours(),
    engagement_type: actionAt ? "read_and_acted" : readAt ? "read_only" : "not_opened",
  };
  appendJsonlLine(engagementLedgerPath, record);
  appendEvent("self_healing.engagement.recorded", "engagement", {
    content_type: contentType,
    engagement_type: record.engagement_type,
  });
}

function computeEngagementWindow(contentType, lookbackDays = 14) {
  const lines = readJsonlLines(engagementLedgerPath);
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const relevant = lines.filter(
    (l) => l.content_type === contentType && l._ts && new Date(l._ts).getTime() > cutoff,
  );
  if (relevant.length === 0) {
    return {
      optimal_hour: null,
      confidence: 0,
      sample_size: 0,
      batch_preference: false,
      median_read_latency_ms: null,
      median_action_latency_ms: null,
    };
  }

  const byHour = {};
  const readLatencies = [];
  const actionLatencies = [];
  for (const r of relevant) {
    const h = r.hour ?? new Date(r._ts).getHours();
    if (!byHour[h]) {
      byHour[h] = [];
    }
    if (r.action_latency_ms != null) {
      byHour[h].push(r.action_latency_ms);
      actionLatencies.push(r.action_latency_ms);
    }
    if (r.read_latency_ms != null) {
      readLatencies.push(r.read_latency_ms);
    }
  }

  let optimalHour = null;
  let bestMedian = Infinity;
  for (const [hour, latencies] of Object.entries(byHour)) {
    if (latencies.length === 0) {
      continue;
    }
    latencies.sort((a, b) => a - b);
    const median = latencies[Math.floor(latencies.length / 2)];
    if (median < bestMedian) {
      bestMedian = median;
      optimalHour = parseInt(hour);
    }
  }

  // Detect batch preference: 3+ items read within 5 min
  let batchCount = 0;
  const sortedByRead = relevant
    .filter((r) => r.read_at)
    .toSorted((a, b) => (a.read_at || "").localeCompare(b.read_at || ""));
  for (let i = 0; i < sortedByRead.length - 2; i++) {
    const t1 = new Date(sortedByRead[i].read_at).getTime();
    const t3 = new Date(sortedByRead[i + 2].read_at).getTime();
    if (t3 - t1 < 5 * 60 * 1000) {
      batchCount++;
    }
  }

  readLatencies.sort((a, b) => a - b);
  actionLatencies.sort((a, b) => a - b);
  return {
    optimal_hour: optimalHour,
    confidence: +Math.min(relevant.length / 14, 1).toFixed(2),
    sample_size: relevant.length,
    batch_preference: batchCount >= 3,
    median_read_latency_ms:
      readLatencies.length > 0 ? readLatencies[Math.floor(readLatencies.length / 2)] : null,
    median_action_latency_ms:
      actionLatencies.length > 0 ? actionLatencies[Math.floor(actionLatencies.length / 2)] : null,
  };
}

function getEngagementInsights() {
  const contentTypes = ["morning_brief", "eod_digest", "meeting_prep", "triage_alert"];
  const insights = {};
  for (const ct of contentTypes) {
    insights[ct] = computeEngagementWindow(ct);
  }
  return insights;
}

// ── Self-Healing: Graduated Noise Reduction (SH-009) ──
let _noiseReductionLevel = 0;
let _noiseReductionDaysInState = 0;
let _noiseReductionLastAssessed = null;

function assessDisengagementLevel() {
  const engagement = readJsonlLines(engagementLedgerPath);
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const recent = engagement.filter((e) => e._ts && now - new Date(e._ts).getTime() < sevenDays);
  const triggerSignals = [];

  // Check fatigue from builder lane
  let fatigueDetected = false;
  let fatigueDays = 0;
  try {
    const blStatus = readJsonlLines(builderLaneStatusPath);
    const fatigueEntries = blStatus
      .filter((s) => s.kind === "fatigue_detected")
      .toSorted((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    if (fatigueEntries.length > 0) {
      fatigueDetected = true;
      fatigueDays = Math.floor(
        (now - new Date(fatigueEntries[0].timestamp).getTime()) / (24 * 60 * 60 * 1000),
      );
      triggerSignals.push(`fatigue_detected_${fatigueDays}d`);
    }
  } catch {
    /* intentional: ledger may not exist */
  }

  // Read latency analysis
  const readLatencies = recent
    .filter((e) => e.read_latency_ms != null)
    .map((e) => e.read_latency_ms);
  const medianReadLatency =
    readLatencies.length > 0
      ? readLatencies.toSorted((a, b) => a - b)[Math.floor(readLatencies.length / 2)]
      : null;
  if (medianReadLatency != null) {
    triggerSignals.push(`median_read_latency_${Math.round(medianReadLatency / 1000)}s`);
  }

  // Action rate
  const acted = recent.filter((e) => e.engagement_type === "read_and_acted").length;
  const total = recent.length;
  const actionRate = total > 0 ? acted / total : 0;
  triggerSignals.push(`action_rate_${Math.round(actionRate * 100)}pct`);

  // Determine level
  let level = 0;
  if (fatigueDetected && fatigueDays > 14) {
    level = 4;
  } else if (fatigueDetected && fatigueDays >= 7) {
    level = 3;
  } else if (fatigueDetected && fatigueDays > 0) {
    level = 2;
  } else if (medianReadLatency && medianReadLatency > 2 * 60 * 60 * 1000) {
    level = 1;
  }

  // Recovery: active engagement reduces level
  if (level >= 2 && actionRate > 0.5 && recent.length >= 6) {
    level = Math.max(level - 1, 0);
    triggerSignals.push("recovery_active_engagement");
  }

  if (level !== _noiseReductionLevel) {
    appendEvent("self_healing.disengagement.level_changed", "noise_reduction", {
      from_level: _noiseReductionLevel,
      to_level: level,
      trigger_signals: triggerSignals,
    });
    logLine(
      `NOISE_REDUCTION: Level ${_noiseReductionLevel} → ${level} (${triggerSignals.join(", ")})`,
    );
    _noiseReductionLevel = level;
    _noiseReductionDaysInState = 0;
  } else {
    _noiseReductionDaysInState++;
  }
  _noiseReductionLastAssessed = new Date().toISOString();

  return {
    level,
    days_in_state: _noiseReductionDaysInState,
    trigger_signals: triggerSignals,
    read_latency_ms: medianReadLatency,
    action_rate: +actionRate.toFixed(2),
  };
}

function _generateReengagementSummary() {
  const events = readJsonlLines(eventLogPath);
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const missed = events.filter(
    (e) =>
      e._ts &&
      new Date(e._ts).getTime() > cutoff &&
      (e.event_type || "").startsWith("scheduler.dispatch.success"),
  );
  const pendingActions = readJsonlLines(gtdActionsPath).filter((a) => a.status === "active").length;
  const pendingCommitments = readJsonlLines(commitmentLedgerPath).filter(
    (c) => c.status === "open" || c.status === "active",
  ).length;
  const keyItems = [];
  if (pendingActions > 0) {
    keyItems.push({
      type: "gtd_actions",
      summary: `${pendingActions} open action(s)`,
      priority: 1,
    });
  }
  if (pendingCommitments > 0) {
    keyItems.push({
      type: "commitments",
      summary: `${pendingCommitments} open commitment(s)`,
      priority: 1,
    });
  }
  keyItems.push({
    type: "briefs_missed",
    summary: `${missed.length} scheduled delivery/deliveries since last engagement`,
    priority: 2,
  });

  appendEvent("self_healing.reengagement.summary_generated", "noise_reduction", {
    missed_count: missed.length,
    key_items: keyItems.length,
  });
  return {
    title: "Here's what happened while you were away",
    missed_count: missed.length,
    key_items: keyItems,
    backlog_hours: Math.round(_noiseReductionDaysInState * 24 || 0),
  };
}

// ── Self-Healing: Dynamic Autonomy Ladder (SH-010) ──
const autonomyPerTaskPath = path.join(configDir, "autonomy_per_task.json");

function getAutonomyPerTask() {
  try {
    return JSON.parse(fs.readFileSync(autonomyPerTaskPath, "utf8"));
  } catch {
    const defaults = {
      draft_tone: { level: 1 },
      triage_classify: { level: 1 },
      meeting_prep: { level: 1 },
      commitment_extract: { level: 1 },
    };
    fs.writeFileSync(autonomyPerTaskPath, JSON.stringify(defaults, null, 2) + "\n", "utf8");
    return defaults;
  }
}

function saveAutonomyPerTask(data) {
  fs.writeFileSync(autonomyPerTaskPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function evaluateAutonomyEligibility(taskType) {
  const autonomy = getAutonomyPerTask();
  const current = autonomy[taskType] || { level: 1 };
  const corrections = readJsonlLines(correctionSignalsPath);
  const engagement = readJsonlLines(engagementLedgerPath);
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  const recentCorrections = corrections.filter(
    (c) =>
      c.timestamp &&
      now - new Date(c.timestamp).getTime() < thirtyDays &&
      (c.domain === taskType || c.context_bucket?.task_type === taskType),
  );
  const recentEngagement = engagement.filter(
    (e) => e._ts && now - new Date(e._ts).getTime() < thirtyDays && e.content_type === taskType,
  );
  const totalExecutions = recentEngagement.length;
  const correctionCount = recentCorrections.length;
  const correctionRate = totalExecutions > 0 ? (correctionCount / totalExecutions) * 100 : 100;
  const actedCount = recentEngagement.filter((e) => e.engagement_type === "read_and_acted").length;
  const engagementRate = totalExecutions > 0 ? (actedCount / totalExecutions) * 100 : 0;
  const factualCorrections = recentCorrections.filter(
    (c) => c._classification?.category === "factual",
  ).length;

  const blockingReasons = [];
  if (totalExecutions < 20) {
    blockingReasons.push("insufficient_executions");
  }
  if (correctionRate >= 5) {
    blockingReasons.push("correction_rate_too_high");
  }
  if (engagementRate < 70) {
    blockingReasons.push("engagement_rate_too_low");
  }
  if (factualCorrections > 0) {
    blockingReasons.push("factual_error_in_window");
  }
  if (_noiseReductionLevel >= 2) {
    blockingReasons.push("operator_fatigue_detected");
  }

  return {
    eligible: blockingReasons.length === 0 && current.level < 3,
    correction_rate: +correctionRate.toFixed(1),
    engagement_rate: +engagementRate.toFixed(1),
    executions: totalExecutions,
    current_level: current.level,
    proposed_level:
      blockingReasons.length === 0 && current.level < 3 ? current.level + 1 : current.level,
    blocking_reasons: blockingReasons,
    shadow_until: current.shadow_until || null,
    factual_corrections: factualCorrections,
  };
}

function _checkAutonomyDemotion(taskType) {
  const autonomy = getAutonomyPerTask();
  const current = autonomy[taskType];
  if (!current || current.level <= 1) {
    return { demoted: false, reason: "already_at_minimum" };
  }

  const corrections = readJsonlLines(correctionSignalsPath);
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const recentCorrections = corrections.filter(
    (c) =>
      c.timestamp &&
      now - new Date(c.timestamp).getTime() < thirtyDays &&
      (c.domain === taskType || c.context_bucket?.task_type === taskType),
  );
  const factualCorrections = recentCorrections.filter(
    (c) => c._classification?.category === "factual",
  );
  const recentSevenDay = recentCorrections.filter(
    (c) => now - new Date(c.timestamp).getTime() < sevenDays,
  );

  if (factualCorrections.length > 0) {
    const newLevel = Math.max(current.level - 1, 1);
    autonomy[taskType].level = newLevel;
    autonomy[taskType].demoted_at = new Date().toISOString();
    autonomy[taskType].demotion_reason = "factual_error";
    delete autonomy[taskType].shadow_until;
    saveAutonomyPerTask(autonomy);
    appendEvent("self_healing.autonomy.demotion_triggered", "autonomy", {
      task_type: taskType,
      reason: "factual_error",
      new_level: newLevel,
    });
    return { demoted: true, reason: "factual_error", new_level: newLevel };
  }

  if (current.promoted_at && recentSevenDay.length >= 3) {
    const promotedAt = new Date(current.promoted_at).getTime();
    const postPromotion = recentSevenDay.filter(
      (c) => new Date(c.timestamp).getTime() > promotedAt,
    );
    if (postPromotion.length >= 3) {
      const newLevel = Math.max(current.level - 1, 1);
      autonomy[taskType].level = newLevel;
      autonomy[taskType].demoted_at = new Date().toISOString();
      autonomy[taskType].demotion_reason = "post_promotion_corrections";
      delete autonomy[taskType].shadow_until;
      saveAutonomyPerTask(autonomy);
      appendEvent("self_healing.autonomy.demotion_triggered", "autonomy", {
        task_type: taskType,
        reason: "post_promotion_corrections",
        new_level: newLevel,
      });
      return { demoted: true, reason: "post_promotion_corrections", new_level: newLevel };
    }
  }

  return { demoted: false, reason: "no_demotion_trigger" };
}

function getAutonomyStatus() {
  const taskTypes = ["draft_tone", "triage_classify", "meeting_prep", "commitment_extract"];
  const status = {};
  for (const tt of taskTypes) {
    status[tt] = evaluateAutonomyEligibility(tt);
  }
  return status;
}

// ── Self-Healing: Zombie Draft Detection (SH-011) ──
const _ZOMBIE_DRAFT_MAX_RETRIES = 3;
const ZOMBIE_DRAFT_STALE_HOURS = 24;

function _classifyGraphError(statusCode) {
  if (statusCode === 202) {
    return { type: "ambiguous_success", should_retry: false };
  }
  if ([429, 500, 502, 503, 504].includes(statusCode)) {
    return { type: "transient", should_retry: true };
  }
  return { type: "non_transient", should_retry: false };
}

function detectZombieDrafts() {
  const drafts = buildDraftQueueState();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const staleMs = ZOMBIE_DRAFT_STALE_HOURS * 60 * 60 * 1000;
  const zombies = [];
  for (const d of drafts) {
    if (d.state !== "approved") {
      continue;
    }
    const age = now - new Date(d.updated_at || d.created_at).getTime();
    if (age < oneHour) {
      continue;
    }
    const ageHours = Math.round(age / (60 * 60 * 1000));
    if (age > staleMs) {
      zombies.push({ ...d, age_hours: ageHours, reason: "stale_draft" });
    } else if (!d.graph_message_id) {
      zombies.push({ ...d, age_hours: ageHours, reason: "no_graph_message_id" });
    }
  }
  return zombies;
}

async function retryZombieDraft(draft) {
  if (draft.reason === "stale_draft") {
    appendJsonlLine(draftQueueLedgerPath, {
      kind: "draft_state_changed",
      draft_id: draft.draft_id,
      new_state: "dead_lettered",
      _dead_letter_reason: "stale_draft",
      at: new Date().toISOString(),
    });
    appendEvent("self_healing.draft.dead_lettered", "scheduler", {
      draft_id: draft.draft_id,
      reason: "stale_draft",
      age_hours: draft.age_hours,
    });
    logLine(`ZOMBIE_DRAFT: ${draft.draft_id} dead-lettered (stale: ${draft.age_hours}h)`);
    return { success: false, new_status: "dead_lettered", reason: "stale_draft" };
  }
  if (!draft.graph_message_id) {
    appendJsonlLine(draftQueueLedgerPath, {
      kind: "draft_state_changed",
      draft_id: draft.draft_id,
      new_state: "dead_lettered",
      _dead_letter_reason: "no_graph_message_id",
      at: new Date().toISOString(),
    });
    appendEvent("self_healing.draft.dead_lettered", "scheduler", {
      draft_id: draft.draft_id,
      reason: "no_graph_message_id",
    });
    logLine(`ZOMBIE_DRAFT: ${draft.draft_id} dead-lettered (no graph_message_id)`);
    return { success: false, new_status: "dead_lettered", reason: "no_graph_message_id" };
  }
  appendEvent("self_healing.draft.zombie_detected", "scheduler", {
    draft_id: draft.draft_id,
    age_hours: draft.age_hours,
  });
  logLine(`ZOMBIE_DRAFT: Detected ${draft.draft_id} (${draft.age_hours}h old)`);
  return { success: false, new_status: "dead_lettered", reason: "retry_not_attempted_no_token" };
}

// C9-030: Normalize a Graph calendar event with rich fields (attendees, body, organizer)
function normalizeCalendarEventRich(event) {
  return {
    id: typeof event?.id === "string" ? event.id : null,
    subject: typeof event?.subject === "string" ? event.subject : "",
    start: event?.start || null,
    end: event?.end || null,
    location: typeof event?.location?.displayName === "string" ? event.location.displayName : null,
    attendees: Array.isArray(event?.attendees)
      ? event.attendees.map((a) => ({
          name: a?.emailAddress?.name || "",
          address: a?.emailAddress?.address || "",
          type: a?.type || "required",
          status: a?.status?.response || "none",
        }))
      : [],
    body_preview:
      typeof event?.body?.content === "string" ? stripHtml(event.body.content).slice(0, 500) : null,
    organizer: event?.organizer?.emailAddress
      ? {
          name: event.organizer.emailAddress.name || "",
          address: event.organizer.emailAddress.address || "",
        }
      : null,
    is_all_day: !!event?.isAllDay,
    show_as: event?.showAs || null,
  };
}

// C9-011: Internal calendar fetch for use by morning brief and meeting prep (no HTTP response)
async function fetchCalendarEventsInternal(profileId, startDate, endDate) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return { ok: false, events: [], error: cfg.error };
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    return { ok: false, events: [], error: "NOT_AUTHENTICATED" };
  }

  const endpoint = new URL("https://graph.microsoft.com/v1.0/me/calendarview");
  endpoint.searchParams.set("startDateTime", startDate.toISOString());
  endpoint.searchParams.set("endDateTime", endDate.toISOString());
  endpoint.searchParams.set(
    "$select",
    "id,subject,start,end,location,attendees,body,organizer,isAllDay,showAs",
  );
  endpoint.searchParams.set("$top", "50");

  try {
    const result = await graphFetchAllPages(
      endpoint.toString(),
      {
        method: "GET",
        headers: { authorization: `Bearer ${tokenResult.accessToken}`, accept: "application/json" },
      },
      { maxPages: 5, label: `calendar_internal_${profileId}` },
    );

    if (!result.ok) {
      return { ok: false, events: [], error: result.error, truncated: false };
    }

    const events = result.items.map((e) => normalizeCalendarEventRich(e));
    return { ok: true, events, truncated: result.truncated };
  } catch (err) {
    return { ok: false, events: [], error: err?.message || "calendar_fetch_error" };
  }
}

// ── C9-010: Inbox ingestion — fetch unread mail and auto-triage ──
async function fetchUnreadMailInternal(profileId, maxMessages = 25) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return { ok: false, messages: [], error: cfg.error };
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    return { ok: false, messages: [], error: "NOT_AUTHENTICATED" };
  }

  const endpoint = new URL("https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages");
  endpoint.searchParams.set(
    "$select",
    "id,subject,from,receivedDateTime,bodyPreview,hasAttachments,importance",
  );
  endpoint.searchParams.set("$filter", "isRead eq false");
  endpoint.searchParams.set("$orderby", "receivedDateTime desc");
  endpoint.searchParams.set("$top", String(Math.min(maxMessages, 50)));

  const result = await graphFetchAllPages(
    endpoint.toString(),
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${tokenResult.accessToken}`,
        accept: "application/json",
        consistencylevel: "eventual",
      },
    },
    { maxPages: 3, label: `inbox_ingestion_${profileId}` },
  );

  if (!result.ok) {
    return { ok: false, messages: [], error: result.error };
  }

  const messages = result.items
    .map((msg) => ({
      id: typeof msg?.id === "string" ? msg.id : null,
      subject: typeof msg?.subject === "string" ? msg.subject : "",
      from_name: msg?.from?.emailAddress?.name || "",
      from_address: msg?.from?.emailAddress?.address || "",
      received_at: msg?.receivedDateTime || null,
      body_preview: msg?.bodyPreview || "",
      has_attachments: !!msg?.hasAttachments,
      importance: msg?.importance || "normal",
    }))
    .filter((m) => m.id);

  return { ok: true, messages, truncated: result.truncated };
}

let _ingestionRunning = false;
async function runInboxIngestionCycle() {
  if (_ingestionRunning) {
    return { skipped: true, reason: "already_running" };
  }
  if (automationPauseState?.paused) {
    return { skipped: true, reason: "automation_paused" };
  }
  _ingestionRunning = true;
  try {
    return await _runInboxIngestionCycleInner();
  } finally {
    _ingestionRunning = false;
  }
}
async function _runInboxIngestionCycleInner() {
  const processed = [];
  const skipped = [];
  const errors = [];

  // Read already-ingested message IDs from ledger
  const ingestionLines = readJsonlLines(ingestionLedgerPath);
  const ingestedIds = new Set(
    ingestionLines.filter((l) => l.kind === "message_ingested").map((l) => l.message_id),
  );

  // Read triage state once before profile loop (avoid O(n*m) file reads)
  const triageState = triageStateFromLines(readTriageLines());

  for (const profileId of GRAPH_ALLOWED_PROFILES) {
    try {
      const result = await fetchUnreadMailInternal(profileId, 25);
      if (!result.ok) {
        errors.push({ profile_id: profileId, error: result.error });
        continue;
      }

      for (const msg of result.messages) {
        if (ingestedIds.has(msg.id)) {
          skipped.push(msg.id);
          continue;
        }

        // Check if triage item already exists
        const itemId = `inbox-${profileId}-${msg.id.slice(-12)}`;
        if (triageState.open.has(itemId) || triageState.all.has(itemId)) {
          skipped.push(msg.id);
          continue;
        }

        try {
          appendTriageLine({
            kind: "triage_item",
            item_id: itemId,
            source_type: "email",
            source_ref: msg.from_address,
            summary: `[${msg.from_name || msg.from_address}] ${msg.subject}`.slice(0, 300),
            content: msg.body_preview.slice(0, 500),
            profile_id: profileId,
            graph_message_id: msg.id,
            importance: msg.importance,
            has_attachments: msg.has_attachments,
            received_at: msg.received_at,
            created_at: new Date().toISOString(),
            auto_ingested: true,
          });

          appendJsonlLine(ingestionLedgerPath, {
            kind: "message_ingested",
            message_id: msg.id,
            profile_id: profileId,
            item_id: itemId,
            subject: msg.subject.slice(0, 100),
            from: msg.from_address,
            at: new Date().toISOString(),
          });
          appendEvent("triage.ingested", "inbox_ingestion", {
            item_id: itemId,
            profile_id: profileId,
            message_id: msg.id,
          });

          ingestedIds.add(msg.id);
          processed.push({ item_id: itemId, message_id: msg.id, profile_id: profileId });

          appendEvent("ingestion.message.processed", "inbox_ingestion", {
            profile_id: profileId,
            item_id: itemId,
            message_id: msg.id.slice(-12),
          });
        } catch (itemErr) {
          errors.push({ profile_id: profileId, message_id: msg.id, error: itemErr?.message });
        }
      }
    } catch (profileErr) {
      errors.push({ profile_id: profileId, error: profileErr?.message || "unknown" });
    }
  }

  const summary = {
    processed: processed.length,
    skipped: skipped.length,
    errors: errors.length,
    at: new Date().toISOString(),
  };
  appendEvent("ingestion.cycle.completed", "inbox_ingestion", summary);
  appendAudit("INBOX_INGESTION_CYCLE", summary);

  return { ...summary, processed, errors };
}

// ── C9-020: First-run discovery pipeline ──
let _discoveryRunning = false;
async function runDiscoveryPipeline(profileId, options = {}) {
  if (_discoveryRunning) {
    return { ok: false, error: "discovery_already_running" };
  }
  _discoveryRunning = true;
  try {
    return await _runDiscoveryPipelineInner(profileId, options);
  } finally {
    _discoveryRunning = false;
  }
}
async function _runDiscoveryPipelineInner(profileId, options = {}) {
  const daysBack = options.days_back ?? 90;
  const contacts = new Map();

  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return { ok: false, error: cfg.error };
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }
  const accessToken = tokenResult.accessToken;

  const emails = [];
  // Phase 1: Email discovery — scan inbox + sent
  for (const folder of ["inbox", "sentitems"]) {
    const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const endpoint = new URL(`https://graph.microsoft.com/v1.0/me/mailfolders/${folder}/messages`);
    endpoint.searchParams.set(
      "$select",
      "id,subject,from,toRecipients,receivedDateTime,bodyPreview",
    );
    endpoint.searchParams.set("$orderby", "receivedDateTime desc");
    endpoint.searchParams.set("$top", "50");
    endpoint.searchParams.set("$filter", `receivedDateTime ge ${sinceDate}`);

    try {
      const mailResult = await graphFetchAllPages(
        endpoint.toString(),
        {
          method: "GET",
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: "application/json",
            consistencylevel: "eventual",
          },
        },
        { maxPages: 5, label: `discovery_${folder}_${profileId}` },
      );

      if (mailResult.ok) {
        for (const msg of mailResult.items) {
          emails.push({
            id: msg.id,
            subject: msg.subject || "",
            from: msg.from?.emailAddress?.address || "",
            to: (msg.toRecipients || []).map((r) => r.emailAddress?.address).filter(Boolean),
            received_at: msg.receivedDateTime,
            body_preview: (msg.bodyPreview || "").slice(0, 200),
            folder,
          });
          const fromAddr = msg.from?.emailAddress?.address || "";
          if (fromAddr) {
            contacts.set(fromAddr, (contacts.get(fromAddr) || 0) + 1);
          }
          for (const r of msg.toRecipients || []) {
            const addr = r.emailAddress?.address;
            if (addr) {
              contacts.set(addr, (contacts.get(addr) || 0) + 1);
            }
          }
        }
      }
    } catch (err) {
      logLine(`DISCOVERY_MAIL_ERROR: ${profileId} -- ${err?.message || String(err)}`);
    }
  }

  // Phase 2: Calendar discovery (past 30 + next 30 days)
  let calendarEvents = [];
  try {
    const calResult = await fetchCalendarEventsInternal(
      profileId,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    );
    if (calResult.ok) {
      calendarEvents = calResult.events;
    }
  } catch (err) {
    logLine(`DISCOVERY_CALENDAR_ERROR: ${profileId} -- ${err?.message || String(err)}`);
  }

  // Phase 3: Planner discovery
  let plannerTasks = [];
  try {
    const plannerCfg = getPlannerConfig(profileId);
    const planId = plannerCfg?.plan_ids?.[profileId];
    if (planId) {
      const pResp = await graphFetchAllPages(
        `https://graph.microsoft.com/v1.0/planner/plans/${encodeURIComponent(planId)}/tasks`,
        { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } },
        { maxPages: 5, label: `discovery_planner_${profileId}` },
      );
      if (pResp.ok) {
        plannerTasks = pResp.items.map((t) => ({
          id: t.id,
          title: t.title,
          percent_complete: t.percentComplete,
          due: t.dueDateTime,
        }));
      }
    }
  } catch (err) {
    logLine(`DISCOVERY_PLANNER_ERROR: ${profileId} -- ${err?.message || String(err)}`);
  }

  // Phase 4: To Do discovery
  let todoTasks = [];
  try {
    const todoCfg = getTodoConfig(profileId);
    if (todoCfg?.list_id) {
      const tResp = await graphFetchAllPages(
        `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(todoCfg.list_id)}/tasks`,
        { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } },
        { maxPages: 3, label: `discovery_todo_${profileId}` },
      );
      if (tResp.ok) {
        todoTasks = tResp.items.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          due: t.dueDateTime?.dateTime,
        }));
      }
    }
  } catch (err) {
    logLine(`DISCOVERY_TODO_ERROR: ${profileId} -- ${err?.message || String(err)}`);
  }

  // Summarize
  const contactList = [...contacts.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([address, count]) => ({ address, message_count: count }));

  // Detect deal-related keywords
  const dealKeywords =
    /\b(NDA|LOI|PSA|DD|due diligence|term sheet|purchase agreement|closing|facility|acquisition|letter of intent|indemnification)\b/i;
  const dealCandidates = emails
    .filter((e) => dealKeywords.test(e.subject))
    .slice(0, 20)
    .map((e) => ({ subject: e.subject, from: e.from, received_at: e.received_at }));

  // Detect commitment keywords
  const commitKeywords =
    /\b(by|before|deadline|due|need.*by|please.*by|must.*by|send.*by|deliver|follow.?up)\b/i;
  const commitmentCandidates = emails
    .filter((e) => commitKeywords.test(e.body_preview))
    .slice(0, 20)
    .map((e) => ({
      subject: e.subject,
      from: e.from,
      received_at: e.received_at,
      snippet: e.body_preview.slice(0, 100),
    }));

  const discovery = {
    profile_id: profileId,
    emails_scanned: emails.length,
    calendar_events_found: calendarEvents.length,
    planner_tasks_found: plannerTasks.length,
    todo_tasks_found: todoTasks.length,
    top_contacts: contactList,
    deal_candidates: dealCandidates,
    commitment_candidates: commitmentCandidates,
    calendar_events_preview: calendarEvents.slice(0, 10).map((e) => ({
      subject: e.subject,
      start: e.start,
      attendee_count: e.attendees?.length || 0,
    })),
    planner_tasks_preview: plannerTasks.slice(0, 10),
    todo_tasks_preview: todoTasks.slice(0, 10),
    generated_at: new Date().toISOString(),
  };

  appendJsonlLine(discoveryLedgerPath, { kind: "discovery_completed", ...discovery });
  appendEvent("discovery.completed", "/ops/onboarding/discover", {
    profile_id: profileId,
    emails: emails.length,
    events: calendarEvents.length,
    deals: dealCandidates.length,
    commits: commitmentCandidates.length,
  });
  appendAudit("DISCOVERY_COMPLETED", { profile_id: profileId });

  return { ok: true, discovery };
}

async function readJsonBody(req) {
  const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
  const chunks = [];
  let totalLen = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalLen += buf.length;
    if (totalLen > MAX_BODY_BYTES) {
      req.destroy();
      const err = new Error("BODY_TOO_LARGE");
      err.code = "BODY_TOO_LARGE";
      throw err;
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

// Guarded wrapper: reads JSON body and returns 413 if oversized.
// Returns null if body is too large (after sending 413), null on parse error, or the parsed body.
async function readJsonBodyGuarded(req, res, route) {
  try {
    return await readJsonBody(req);
  } catch (err) {
    if (err && err.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, { error: "body_too_large", message: "Request body exceeds 1 MB limit" });
      logLine(`POST ${route} -> 413 body_too_large`);
      return null;
    }
    // M-2: Respond with 400 on any parse error so caller gets a response
    sendJson(res, 400, { error: "invalid_request_body", message: "Could not parse JSON body" });
    logLine(`POST ${route} -> 400 invalid_request_body`);
    return null;
  }
}

async function mintSidecarAuthToken(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const operatorKey = typeof body?.operator_key === "string" ? body.operator_key.trim() : "";
  if (!operatorKey || operatorKey !== OPERATOR_KEY) {
    sendJson(
      res,
      403,
      blockedExplainability(
        "OPERATOR_KEY_INVALID",
        "auth_token_mint",
        "Use the configured operator key to mint a sidecar auth token.",
      ),
    );
    logLine(`POST ${route} -> 403`);
    return;
  }
  const minted = mintBearerToken();
  appendAudit("AUTH_TOKEN_MINT", { token_prefix: minted.token.slice(0, 8) });
  sendJson(res, 200, {
    token: minted.token,
    token_type: "Bearer",
    expires_at: new Date(minted.expires_at_ms).toISOString(),
    auth_mode: STATIC_BEARER_TOKEN ? "STATIC_OR_MINTED" : "MINTED_ONLY",
  });
  logLine(`POST ${route} -> 200`);
}

async function startGraphDeviceCode(profileId, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    logLine(`POST ${route} -> ${cfg.status}`);
    return;
  }

  const { tenant_id, client_id, delegated_scopes } = cfg.profile;
  const reqBody = new URLSearchParams();
  reqBody.set("client_id", client_id);
  reqBody.set("scope", delegated_scopes.join(" "));
  const endpoint = `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/devicecode`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: reqBody,
    });

    if (response.ok) {
      const payload = await response.json();
      clearGraphLastError(profileId);
      appendAudit("GRAPH_DEVICE_CODE_START", { profile_id: profileId });
      // JC-088d: Graph auth started event
      try {
        appendEvent("graph.auth.started", "/graph/auth/device/start", { profile_id: profileId });
      } catch {
        /* non-fatal */
      }
      sendJson(res, 200, {
        profile_id: profileId,
        tenant_id,
        client_id,
        scopes: delegated_scopes,
        verification_uri: payload.verification_uri || "https://microsoft.com/devicelogin",
        user_code: payload.user_code || "",
        device_code: payload.device_code || "",
        expires_in: payload.expires_in || 0,
        interval: payload.interval || 5,
        message: payload.message || "Complete device-code authentication.",
      });
      logLine(`POST ${route} -> 200`);
      return;
    }

    const errorPayload = await response.json().catch(() => ({}));
    const errorCode =
      typeof errorPayload.error === "string" ? errorPayload.error : "device_start_failed";

    if (isExampleGraphProfile(cfg.profile)) {
      clearGraphLastError(profileId);
      sendJson(res, 200, {
        profile_id: profileId,
        tenant_id,
        client_id,
        scopes: delegated_scopes,
        verification_uri: "https://microsoft.com/devicelogin",
        user_code: `LOCAL-${profileId.toUpperCase()}`,
        device_code: `stub-${profileId}-${Date.now()}`,
        expires_in: 900,
        interval: 5,
        message: `Local placeholder challenge (upstream unavailable: ${errorCode}).`,
      });
      logLine(`POST ${route} -> 200`);
      return;
    }

    setGraphLastError(profileId, errorCode);
    sendJson(res, 502, { profile_id: profileId, error: errorCode });
    logLine(`POST ${route} -> 502`);
  } catch (err) {
    logLine(`GRAPH_DEVICE_START_ERROR: ${err?.message || String(err)}`);
    if (isExampleGraphProfile(cfg.profile)) {
      clearGraphLastError(profileId);
      sendJson(res, 200, {
        profile_id: profileId,
        tenant_id,
        client_id,
        scopes: delegated_scopes,
        verification_uri: "https://microsoft.com/devicelogin",
        user_code: `LOCAL-${profileId.toUpperCase()}`,
        device_code: `stub-${profileId}-${Date.now()}`,
        expires_in: 900,
        interval: 5,
        message: "Local placeholder challenge (network unavailable).",
      });
      logLine(`POST ${route} -> 200`);
      return;
    }

    setGraphLastError(profileId, "device_start_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "device_start_network_error" });
    logLine(`POST ${route} -> 502`);
  }
}

async function pollGraphDeviceCode(profileId, req, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    logLine(`POST ${route} -> ${cfg.status}`);
    return;
  }

  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const deviceCode = typeof body?.device_code === "string" ? body.device_code.trim() : "";
  if (!deviceCode) {
    setGraphLastError(profileId, "device_code_required");
    sendJson(res, 400, { profile_id: profileId, error: "device_code_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  if (deviceCode.startsWith("stub-")) {
    clearGraphLastError(profileId);
    sendJson(res, 200, {
      profile_id: profileId,
      stored: false,
      status: "PENDING",
      retry_after: 5,
    });
    logLine(`POST ${route} -> 200`);
    return;
  }

  const { tenant_id, client_id } = cfg.profile;
  const endpoint = `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`;
  const reqBody = new URLSearchParams();
  reqBody.set("client_id", client_id);
  reqBody.set("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
  reqBody.set("device_code", deviceCode);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: reqBody,
    });
    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
      const tokenRecord = {
        ...payload,
        stored_at_ms: Date.now(),
      };
      const stored = storeTokenRecord(profileId, tokenRecord);
      if (!stored) {
        setGraphLastError(profileId, "token_store_failed");
        sendJson(res, 500, { profile_id: profileId, error: "token_store_failed" });
        logLine(`POST ${route} -> 500`);
        return;
      }
      clearGraphLastError(profileId);
      appendAudit("GRAPH_DEVICE_CODE_COMPLETE", { profile_id: profileId });
      // JC-088d: Graph auth completed event
      try {
        appendEvent("graph.auth.completed", "/graph/auth/device/poll", { profile_id: profileId });
      } catch {
        /* non-fatal */
      }
      sendJson(res, 200, {
        profile_id: profileId,
        stored: true,
        expires_in: payload.expires_in || 0,
        scope: payload.scope || "",
        token_type: payload.token_type || "",
      });
      logLine(`POST ${route} -> 200`);
      return;
    }

    const errorCode = typeof payload.error === "string" ? payload.error : "token_poll_failed";
    if (errorCode === "authorization_pending" || errorCode === "slow_down") {
      clearGraphLastError(profileId);
      sendJson(res, 200, {
        profile_id: profileId,
        stored: false,
        status: errorCode === "slow_down" ? "SLOW_DOWN" : "PENDING",
        retry_after: errorCode === "slow_down" ? 10 : 5,
      });
      logLine(`POST ${route} -> 200`);
      return;
    }

    setGraphLastError(profileId, errorCode);
    sendJson(res, 502, { profile_id: profileId, error: errorCode });
    logLine(`POST ${route} -> 502`);
  } catch (err) {
    logLine(`GRAPH_TOKEN_POLL_ERROR: ${err?.message || String(err)}`);
    setGraphLastError(profileId, "token_poll_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "token_poll_network_error" });
    logLine(`POST ${route} -> 502`);
  }
}

async function listGraphMail(profileId, parsedUrl, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    logLine(`GET ${route} -> ${cfg.status}`);
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    logLine(`GET ${route} -> 409`);
    return;
  }

  const accessToken = tokenResult.accessToken;
  const folder = parsedUrl.searchParams.get("folder") || "inbox";
  const topRaw = Number.parseInt(parsedUrl.searchParams.get("top") || "25", 10);
  const top = Number.isFinite(topRaw) && topRaw > 0 && topRaw <= 50 ? topRaw : 25;
  const filter = parsedUrl.searchParams.get("filter") || "all";
  const skipRaw = Number.parseInt(parsedUrl.searchParams.get("skip") || "0", 10);
  const skip = Number.isFinite(skipRaw) && skipRaw >= 0 ? skipRaw : 0;

  const endpoint = new URL(
    `https://graph.microsoft.com/v1.0/me/mailfolders/${encodeURIComponent(folder)}/messages`,
  );
  endpoint.searchParams.set(
    "$select",
    "id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments,importance",
  );
  endpoint.searchParams.set("$orderby", "receivedDateTime desc");
  endpoint.searchParams.set("$top", String(top));
  endpoint.searchParams.set("$count", "true");
  if (skip > 0) {
    endpoint.searchParams.set("$skip", String(skip));
  }
  if (filter === "unread") {
    endpoint.searchParams.set("$filter", "isRead eq false");
  }

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        consistencylevel: "eventual",
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      logLine(`GET ${route} -> 409`);
      return;
    }

    if (!response.ok) {
      const code =
        typeof payload?.error?.code === "string" ? payload.error.code : "mail_list_failed";
      setGraphLastError(profileId, code);
      sendJson(res, 502, { profile_id: profileId, error: code });
      logLine(`GET ${route} -> 502`);
      return;
    }

    const rawMessages = Array.isArray(payload.value) ? payload.value : [];
    const messages = rawMessages.map((msg) => ({
      id: typeof msg?.id === "string" ? msg.id : null,
      subject: typeof msg?.subject === "string" ? msg.subject : "",
      from: {
        name: typeof msg?.from?.emailAddress?.name === "string" ? msg.from.emailAddress.name : "",
        address:
          typeof msg?.from?.emailAddress?.address === "string" ? msg.from.emailAddress.address : "",
      },
      received_at: typeof msg?.receivedDateTime === "string" ? msg.receivedDateTime : null,
      is_read: msg?.isRead === true,
      preview: typeof msg?.bodyPreview === "string" ? msg.bodyPreview : "",
      has_attachments: msg?.hasAttachments === true,
      importance: typeof msg?.importance === "string" ? msg.importance : "normal",
    }));

    const totalCount = typeof payload["@odata.count"] === "number" ? payload["@odata.count"] : null;

    clearGraphLastError(profileId);
    appendAudit("MAIL_LIST", {
      profile_id: profileId,
      folder,
      count: messages.length,
      filter,
    });
    // JC-088e: Mail ledger stub (enriched JC-092d)
    try {
      appendJsonlLine(mailLedgerPath, {
        kind: "mail_fetched",
        profile_id: profileId,
        count: messages.length,
        at: new Date().toISOString(),
      });
      const mailSummary = messages.slice(0, 5).map((m) =>
        normalizeMailEvent(
          {
            id: m.id,
            subject: m.subject,
            from: m.from?.address || m.from,
            receivedDateTime: m.received_at,
          },
          "fetched",
        ),
      );
      appendEvent("mail.fetched", "/graph/mail/list", {
        profile_id: profileId,
        count: messages.length,
        sample: mailSummary,
      });
    } catch (err) {
      logLine(`MAIL_LEDGER_WRITE_ERROR: ${err?.message || String(err)}`);
    }
    sendJson(res, 200, {
      profile_id: profileId,
      folder,
      messages,
      total_count: totalCount,
    });
    logLine(`GET ${route} -> 200`);
  } catch (err) {
    logLine(`GRAPH_MAIL_LIST_ERROR: ${err?.message || String(err)}`);
    setGraphLastError(profileId, "mail_list_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "mail_list_network_error" });
    logLine(`GET ${route} -> 502`);
  }
}

async function generateDraftsFromInbox(profileId, req, res, route) {
  const styleCfg = getDraftStyleConfig();
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    logLine(`POST ${route} -> ${cfg.status}`);
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    logLine(`POST ${route} -> 409`);
    return;
  }

  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const maxDraftsRaw = Number.parseInt(body?.max_drafts ?? "5", 10);
  const maxDrafts =
    Number.isFinite(maxDraftsRaw) && maxDraftsRaw > 0 && maxDraftsRaw <= 10 ? maxDraftsRaw : 5;
  const filter = typeof body?.filter === "string" ? body.filter.trim() : "unread";

  const accessToken = tokenResult.accessToken;

  // Step 1: Fetch inbox messages
  const inboxEndpoint = new URL("https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages");
  inboxEndpoint.searchParams.set("$select", "id,subject,from,bodyPreview,receivedDateTime");
  inboxEndpoint.searchParams.set("$top", String(maxDrafts));
  if (filter === "unread") {
    inboxEndpoint.searchParams.set("$filter", "isRead eq false");
  }

  let inboxMessages;
  try {
    const inboxResponse = await fetch(inboxEndpoint, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        consistencylevel: "eventual",
      },
    });
    const inboxPayload = await inboxResponse.json().catch(() => ({}));

    if (inboxResponse.status === 401 || inboxResponse.status === 403) {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      logLine(`POST ${route} -> 409`);
      return;
    }

    if (!inboxResponse.ok) {
      const code =
        typeof inboxPayload?.error?.code === "string"
          ? inboxPayload.error.code
          : "inbox_fetch_failed";
      setGraphLastError(profileId, code);
      sendJson(res, 502, { profile_id: profileId, error: code });
      logLine(`POST ${route} -> 502`);
      return;
    }

    inboxMessages = Array.isArray(inboxPayload.value) ? inboxPayload.value : [];
  } catch (err) {
    logLine(`GRAPH_INBOX_FETCH_ERROR: ${err?.message || String(err)}`);
    setGraphLastError(profileId, "inbox_fetch_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "inbox_fetch_network_error" });
    logLine(`POST ${route} -> 502`);
    return;
  }

  // Step 2: Generate draft replies for each message
  const drafts = [];
  const skipped = [];
  const candidatesEvaluated = inboxMessages.length;

  for (const msg of inboxMessages) {
    const originalSubject = typeof msg?.subject === "string" ? msg.subject : "";
    const fromName =
      typeof msg?.from?.emailAddress?.name === "string" ? msg.from.emailAddress.name : "";
    const fromAddress =
      typeof msg?.from?.emailAddress?.address === "string" ? msg.from.emailAddress.address : "";

    if (!fromAddress) {
      skipped.push(typeof msg?.id === "string" ? msg.id : "unknown");
      continue;
    }

    const draftSubject = `Re: ${originalSubject}`;
    const draftSignature = styleCfg?.signature_conventions?.business || "— Clint";
    const draftDisclaimer =
      styleCfg?.signature_conventions?.draft_disclaimer ||
      "(Generated as a draft for review; not sent)";
    const templateBody = `Hi ${fromName || "there"},\n\nThank you for your email regarding "${originalSubject}".\n\n${draftDisclaimer}\n\n${draftSignature}`;

    // LLM enhancement (JC-071a): attempt LLM-generated draft before falling back to template
    let draftBody = templateBody;
    let draftSource = "template";
    try {
      const systemPrompt = buildSystemPrompt("draft_email", profileId);
      const userMessage = `Write a draft reply to the following email.\n\nFrom: ${fromName || "Unknown"} <${fromAddress}>\nSubject: ${originalSubject}\nPreview: ${typeof msg?.bodyPreview === "string" ? msg.bodyPreview.slice(0, 500) : "(no preview)"}\n\nRequirements:\n- Address the sender by name\n- Reference the subject matter\n- Include the draft disclaimer: "${draftDisclaimer}"\n- End with the signature: "${draftSignature}"\n- Keep it concise and professional`;
      const llmResult = await routeLlmCall(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        profileId,
        "draft_generate",
      );
      if (llmResult.ok) {
        const validation = validateLlmOutputContract("draft_email", llmResult.content, profileId);
        if (validation.valid) {
          draftBody = llmResult.content;
          draftSource = "llm";
        } else if (
          validation.missing_sections.length > 0 &&
          validation.banned_phrases_found.length === 0
        ) {
          // Hybrid: inject missing parts from template into LLM output
          let hybridBody = llmResult.content;
          if (validation.missing_sections.includes("signature")) {
            hybridBody += `\n\n${draftSignature}`;
          }
          if (validation.missing_sections.includes("draft_disclaimer")) {
            hybridBody += `\n\n${draftDisclaimer}`;
          }
          draftBody = hybridBody;
          draftSource = "hybrid";
        }
        // If banned phrases found or fully invalid, keep template fallback
      }
      // If !llmResult.ok, keep template fallback
    } catch (llmErr) {
      logLine(`LLM_DRAFT_ERROR: ${llmErr?.message || "unknown"}`);
      // Keep template fallback
    }

    const graphReq = {
      subject: draftSubject,
      body: { contentType: "Text", content: draftBody },
      toRecipients: [{ emailAddress: { address: fromAddress } }],
      isDraft: true,
    };

    try {
      const draftResponse = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(graphReq),
      });
      const draftPayload = await draftResponse.json().catch(() => ({}));

      if (draftResponse.status === 401 || draftResponse.status === 403) {
        setGraphLastError(profileId, "NOT_AUTHENTICATED");
        sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
        logLine(`POST ${route} -> 409`);
        return;
      }

      if (!draftResponse.ok) {
        skipped.push(typeof msg?.id === "string" ? msg.id : "unknown");
        continue;
      }

      const queueDraftId = crypto.randomUUID();
      const graphMessageId = typeof draftPayload.id === "string" ? draftPayload.id : null;
      appendJsonlLine(draftQueueLedgerPath, {
        kind: "draft_created",
        draft_id: queueDraftId,
        draft_kind: "email",
        subject: draftSubject,
        to: fromAddress,
        content: draftBody,
        from_profile: profileId,
        entity: null,
        graph_message_id: graphMessageId,
        at: new Date().toISOString(),
      });
      appendEvent("draft.queued", "/drafts/generate", {
        draft_id: queueDraftId,
        from_profile: profileId,
      });

      drafts.push({
        message_id: typeof draftPayload.id === "string" ? draftPayload.id : null,
        draft_id: queueDraftId,
        subject: draftSubject,
        to: fromAddress,
        source: draftSource,
      });
    } catch (err) {
      logLine(
        `DRAFT_GENERATE_PER_MSG_ERROR: ${msg?.id || "unknown"} -- ${err?.message || String(err)}`,
      );
      skipped.push(typeof msg?.id === "string" ? msg.id : "unknown");
    }
  }

  clearGraphLastError(profileId);
  appendAudit("DRAFTS_GENERATED", {
    profile_id: profileId,
    drafts_created: drafts.length,
    candidates_evaluated: candidatesEvaluated,
    skipped_count: skipped.length,
  });
  sendJson(res, 200, {
    profile_id: profileId,
    drafts_created: drafts.length,
    candidates_evaluated: candidatesEvaluated,
    skipped,
    drafts,
  });
  logLine(`POST ${route} -> 200`);
}

async function moveGraphMessage(profileId, messageId, req, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    logLine(`POST ${route} -> ${cfg.status}`);
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    logLine(`POST ${route} -> 409`);
    return;
  }

  const routeKey = normalizeRoutePolicyKey(route);
  const idempotencyKey = idempotencyKeyFromRequest(req);
  if (idempotencyKey) {
    const replay = getIdempotentReplay(routeKey, idempotencyKey);
    if (replay) {
      sendJson(res, replay.status_code, {
        ...replay.response_body,
        deduped: true,
        idempotency_key: idempotencyKey,
      });
      logLine(`POST ${route} -> ${replay.status_code}`);
      return;
    }
  }

  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { profile_id: profileId, error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const destinationFolderId =
    typeof body.destination_folder_id === "string" ? body.destination_folder_id.trim() : "";
  if (!destinationFolderId) {
    sendJson(res, 400, { profile_id: profileId, error: "invalid_destination_folder_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const accessToken = tokenResult.accessToken;
  const graphEndpoint = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/move`;

  try {
    const response = await fetch(graphEndpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ destinationId: destinationFolderId }),
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      logLine(`POST ${route} -> 409`);
      return;
    }

    if (!response.ok) {
      const code =
        typeof payload?.error?.code === "string" ? payload.error.code : "mail_move_failed";
      setGraphLastError(profileId, code);
      sendJson(res, 502, { profile_id: profileId, error: code });
      logLine(`POST ${route} -> 502`);
      return;
    }

    clearGraphLastError(profileId);
    const responseBody = {
      profile_id: profileId,
      message_id: messageId,
      moved: true,
      destination_folder_id: destinationFolderId,
    };
    appendAudit("MAIL_MOVE", {
      profile_id: profileId,
      message_id: messageId,
      destination_folder_id: destinationFolderId,
    });
    appendJsonlLine(mailLedgerPath, {
      kind: "mail_moved",
      message_id: messageId,
      from_folder: "inbox",
      to_folder: destinationFolderId,
      profile_id: profileId,
      timestamp: new Date().toISOString(),
    });
    appendEvent("mail.moved", route, {
      message_id: messageId,
      from_folder: "inbox",
      to_folder: destinationFolderId,
      profile_id: profileId,
    });
    if (idempotencyKey) {
      storeIdempotentReplay(routeKey, idempotencyKey, 200, responseBody);
    }
    sendJson(res, 200, {
      ...responseBody,
      deduped: false,
      idempotency_key: idempotencyKey || undefined,
    });
    logLine(`POST ${route} -> 200`);
  } catch (err) {
    logLine(`GRAPH_MAIL_MOVE_ERROR: ${err?.message || String(err)}`);
    setGraphLastError(profileId, "mail_move_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "mail_move_network_error" });
    logLine(`POST ${route} -> 502`);
  }
}

async function createGraphCalendarEvent(profileId, req, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    logLine(`POST ${route} -> ${cfg.status}`);
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    logLine(`POST ${route} -> 409`);
    return;
  }

  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { profile_id: profileId, error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const startDatetime = typeof body.start_datetime === "string" ? body.start_datetime.trim() : "";
  const endDatetime = typeof body.end_datetime === "string" ? body.end_datetime.trim() : "";
  if (!subject || !startDatetime || !endDatetime) {
    sendJson(res, 400, {
      profile_id: profileId,
      error: "invalid_event_payload",
      required: ["subject", "start_datetime", "end_datetime"],
    });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const location = typeof body.location === "string" ? body.location.trim() : "";
  const bodyText = typeof body.body_text === "string" ? body.body_text : "";

  const accessToken = tokenResult.accessToken;
  const graphBody = {
    subject,
    start: { dateTime: startDatetime, timeZone: "UTC" },
    end: { dateTime: endDatetime, timeZone: "UTC" },
    showAs: "tentative",
  };
  if (location) {
    graphBody.location = { displayName: location };
  }
  if (bodyText) {
    graphBody.body = { contentType: "Text", content: bodyText };
  }

  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/events", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(graphBody),
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      logLine(`POST ${route} -> 409`);
      return;
    }

    if (!response.ok) {
      const code =
        typeof payload?.error?.code === "string"
          ? payload.error.code
          : "calendar_event_create_failed";
      setGraphLastError(profileId, code);
      sendJson(res, 502, { profile_id: profileId, error: code });
      logLine(`POST ${route} -> 502`);
      return;
    }

    clearGraphLastError(profileId);
    appendAudit("CALENDAR_EVENT_CREATE", {
      profile_id: profileId,
      event_id: typeof payload.id === "string" ? payload.id : null,
      subject,
      show_as: "tentative",
    });
    appendJsonlLine(calendarLedgerPath, {
      kind: "calendar_event_created",
      event_id: typeof payload.id === "string" ? payload.id : null,
      subject,
      start: startDatetime,
      end: endDatetime,
      profile_id: profileId,
      timestamp: new Date().toISOString(),
    });
    appendEvent("calendar.event.created", route, {
      event_id: typeof payload.id === "string" ? payload.id : null,
      subject,
      profile_id: profileId,
    });
    sendJson(res, 200, {
      profile_id: profileId,
      event_created: true,
      event_id: typeof payload.id === "string" ? payload.id : null,
      subject,
      show_as: "tentative",
    });
    logLine(`POST ${route} -> 200`);
  } catch (err) {
    logLine(`GRAPH_CALENDAR_CREATE_ERROR: ${err?.message || String(err)}`);
    setGraphLastError(profileId, "calendar_event_create_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "calendar_event_create_network_error" });
    logLine(`POST ${route} -> 502`);
  }
}

async function extractDeadlines(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    sendJson(
      res,
      400,
      blockedExplainability(
        "TEXT_REQUIRED",
        "deadline_extraction",
        "Provide non-empty text field containing content to scan for deadlines.",
      ),
    );
    logLine(`POST ${route} -> 400`);
    return;
  }

  const sourceRef = typeof body.source_ref === "string" ? body.source_ref.trim() : undefined;
  const candidates = [];

  const _keywordPattern = /(?:deadline|due|by|before|no later than|expires?)\s*[:-]?\s*/gi;
  const isoDatePattern = /\b(\d{4}-\d{2}-\d{2})\b/g;
  const writtenDatePattern =
    /\b((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\b/gi;
  const relativePattern =
    /\b(by end of (?:week|month|day|quarter|year)|by (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|due (?:next|this) (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|week|month))\b/gi;

  const monthMap = {
    january: "01",
    jan: "01",
    february: "02",
    feb: "02",
    march: "03",
    mar: "03",
    april: "04",
    apr: "04",
    may: "05",
    june: "06",
    jun: "06",
    july: "07",
    jul: "07",
    august: "08",
    aug: "08",
    september: "09",
    sep: "09",
    october: "10",
    oct: "10",
    november: "11",
    nov: "11",
    december: "12",
    dec: "12",
  };

  function parseWrittenDate(raw) {
    const cleaned = raw.replace(",", " ").replace(/\s+/g, " ").trim();
    const mdyMatch = cleaned.match(
      /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})$/i,
    );
    if (mdyMatch) {
      const month = monthMap[mdyMatch[1].toLowerCase()];
      const day = mdyMatch[2].padStart(2, "0");
      return `${mdyMatch[3]}-${month}-${day}`;
    }
    const dmyMatch = cleaned.match(
      /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i,
    );
    if (dmyMatch) {
      const month = monthMap[dmyMatch[2].toLowerCase()];
      const day = dmyMatch[1].padStart(2, "0");
      return `${dmyMatch[3]}-${month}-${day}`;
    }
    return null;
  }

  function extractContext(fullText, matchIndex, matchLength) {
    const contextRadius = 50;
    const start = Math.max(0, matchIndex - contextRadius);
    const end = Math.min(fullText.length, matchIndex + matchLength + contextRadius);
    return fullText.slice(start, end).replace(/\n/g, " ").trim();
  }

  const seenRawTexts = new Set();

  function hasNearbyKeyword(fullText, matchIndex) {
    const lookback = Math.max(0, matchIndex - 60);
    const preceding = fullText.slice(lookback, matchIndex).toLowerCase();
    return /(?:deadline|due|by|before|no later than|expires?)/.test(preceding);
  }

  let isoMatch;
  while ((isoMatch = isoDatePattern.exec(text)) !== null) {
    const raw = isoMatch[0];
    if (seenRawTexts.has(raw)) {
      continue;
    }
    seenRawTexts.add(raw);
    const confidence = hasNearbyKeyword(text, isoMatch.index) ? "HIGH" : "MEDIUM";
    candidates.push({
      raw_text: raw,
      parsed_date: raw,
      context: extractContext(text, isoMatch.index, raw.length),
      confidence,
    });
  }

  let writtenMatch;
  while ((writtenMatch = writtenDatePattern.exec(text)) !== null) {
    const raw = writtenMatch[0];
    if (seenRawTexts.has(raw)) {
      continue;
    }
    seenRawTexts.add(raw);
    const parsedDate = parseWrittenDate(raw);
    const confidence = hasNearbyKeyword(text, writtenMatch.index) ? "HIGH" : "MEDIUM";
    candidates.push({
      raw_text: raw,
      parsed_date: parsedDate,
      context: extractContext(text, writtenMatch.index, raw.length),
      confidence,
    });
  }

  let relMatch;
  while ((relMatch = relativePattern.exec(text)) !== null) {
    const raw = relMatch[0];
    if (seenRawTexts.has(raw)) {
      continue;
    }
    seenRawTexts.add(raw);
    candidates.push({
      raw_text: raw,
      parsed_date: null,
      context: extractContext(text, relMatch.index, raw.length),
      confidence: "LOW",
    });
  }

  let kwMatch;
  const keywordWithDatePattern =
    /(?:deadline|due|by|before|no later than|expires?)\s*[:-]?\s*(\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/gi;
  while ((kwMatch = keywordWithDatePattern.exec(text)) !== null) {
    const raw = kwMatch[0];
    if (seenRawTexts.has(raw)) {
      continue;
    }
    seenRawTexts.add(raw);
    const dateStr = kwMatch[1];
    let parsedDate = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      parsedDate = dateStr;
    } else {
      parsedDate = parseWrittenDate(dateStr);
    }
    candidates.push({
      raw_text: raw,
      parsed_date: parsedDate,
      context: extractContext(text, kwMatch.index, raw.length),
      confidence: "HIGH",
    });
  }

  // LLM semantic deadline discovery (JC-071e): merge LLM-found deadlines with regex results
  let extractionSource = "regex";
  try {
    const systemPrompt = buildSystemPrompt("deadline_extract", null);
    const userMessage = `Find ALL deadlines, due dates, and time-sensitive commitments in this text. Include implicit deadlines like "by end of week" or "next Friday".\n\nText:\n${text.slice(0, 3000)}\n\nReturn a JSON array: [{ "date": "YYYY-MM-DD or description", "context": "surrounding context", "confidence": 0.0-1.0, "source_text": "exact text from document" }]`;
    const llmResult = await routeLlmCall(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      null,
      "deadline_extract",
    );
    if (llmResult.ok) {
      const validation = validateLlmOutputContract("deadline_extract", llmResult.content, null);
      if (validation.valid) {
        try {
          const parsed =
            typeof llmResult.content === "string"
              ? JSON.parse(llmResult.content)
              : llmResult.content;
          const llmCandidates = Array.isArray(parsed) ? parsed : parsed?.candidates || [];
          // Deduplicate by parsed_date/date: only add LLM candidates not already found by regex
          const existingDates = new Set(candidates.map((c) => c.parsed_date).filter(Boolean));
          const existingRawTexts = new Set(
            candidates.map((c) => c.raw_text?.toLowerCase()).filter(Boolean),
          );
          for (const lc of llmCandidates) {
            const lcDate = lc.date || lc.parsed_date || null;
            const lcSourceText = (lc.source_text || lc.raw_text || "").toLowerCase();
            // Skip if we already have this date from regex
            if (lcDate && existingDates.has(lcDate)) {
              continue;
            }
            if (lcSourceText && existingRawTexts.has(lcSourceText)) {
              continue;
            }
            candidates.push({
              raw_text: lc.source_text || lc.raw_text || lcDate || "",
              parsed_date: lcDate,
              context: lc.context || "",
              confidence:
                typeof lc.confidence === "number"
                  ? lc.confidence >= 0.8
                    ? "HIGH"
                    : lc.confidence >= 0.5
                      ? "MEDIUM"
                      : "LOW"
                  : "MEDIUM",
              source: "llm",
            });
          }
          if (llmCandidates.length > 0) {
            extractionSource = "regex+llm";
          }
        } catch (err) {
          logLine(
            `DEADLINE_LLM_PARSE_ERROR: ${err?.message || String(err)}`,
          ); /* keep regex-only results */
        }
      }
    }
  } catch (llmErr) {
    logLine(`LLM_DEADLINE_EXTRACT_ERROR: ${llmErr?.message || "unknown"}`);
  }

  appendAudit("DEADLINE_EXTRACTION", {
    candidate_count: candidates.length,
    source_ref: sourceRef || null,
    extraction_source: extractionSource,
  });
  sendJson(res, 200, { candidates, source_ref: sourceRef, extraction_source: extractionSource });
  logLine(`POST ${route} -> 200`);
}

function listFilingSuggestionsFromLedger() {
  return buildFilingSuggestionState();
}

async function generateMorningBrief(_parsedUrl, res, route) {
  const briefCfg = getBriefConfig();
  const operatorCfg = getOperatorProfile();
  const now = new Date();
  const generatedAt = now.toISOString();

  const openTriageItems = listOpenTriageItems();
  const deals = listDeals();
  const allFilingSuggestions = listFilingSuggestionsFromLedger();
  const pendingFilingSuggestions = allFilingSuggestions.filter((s) => s.status === "PROPOSED");

  const twentyFourHoursAgoMs = now.getTime() - 24 * 60 * 60 * 1000;
  const allTriageLines = readTriageLines();
  const recentAudit = allTriageLines
    .filter((line) => {
      if (line.kind !== "AUDIT") {
        return false;
      }
      const lineTime = typeof line.at === "string" ? new Date(line.at).getTime() : 0;
      return Number.isFinite(lineTime) && lineTime >= twentyFourHoursAgoMs;
    })
    .map((line) => ({
      action: line.action || "UNKNOWN",
      at: line.at || null,
      summary: line.details
        ? typeof line.details === "object"
          ? JSON.stringify(line.details).slice(0, 200)
          : String(line.details).slice(0, 200)
        : null,
    }));

  const dealsSummary = deals.map((d) => ({
    deal_id: typeof d.deal_id === "string" ? d.deal_id : null,
    deal_name: typeof d.deal_name === "string" ? d.deal_name : undefined,
    status: typeof d.status === "string" ? d.status : undefined,
  }));

  const recommendations = [];
  if (openTriageItems.length > 0) {
    recommendations.push(
      `Review ${openTriageItems.length} open triage item${openTriageItems.length === 1 ? "" : "s"}.`,
    );
  }
  if (pendingFilingSuggestions.length > 0) {
    recommendations.push(
      `Approve or dismiss ${pendingFilingSuggestions.length} pending filing suggestion${pendingFilingSuggestions.length === 1 ? "" : "s"}.`,
    );
  }
  if (automationPauseState.paused) {
    recommendations.push("Automation is paused. Resume when ready to process queued work.");
  }
  if (deals.length === 0) {
    recommendations.push("No active deals. Create a deal to begin tracking.");
  }
  // JC-091d: Facility alerts in morning brief (moved before headline computation)
  const activeAlerts = buildFacilityAlertState().filter((a) =>
    ["monitoring", "warning", "crisis", "escalated"].includes(a.status),
  );
  if (activeAlerts.length > 0) {
    recommendations.push(
      `${activeAlerts.length} active facility alert${activeAlerts.length === 1 ? "" : "s"} requiring attention.`,
    );
  }

  // Progressive disclosure (JC-086a): headline + summary for iMessage/mobile
  const urgentCount = recommendations.length;
  const headline = `${now.toLocaleDateString("en-US", { weekday: "long" })} brief: ${openTriageItems.length} triage open, ${deals.length} deals active, ${pendingFilingSuggestions.length} filing pending${urgentCount > 0 ? `, ${urgentCount} action${urgentCount === 1 ? "" : "s"} recommended` : ""}.`;
  const summaryLines = [];
  if (openTriageItems.length > 0) {
    summaryLines.push(
      `[TRIAGE] ${openTriageItems.length} open item${openTriageItems.length === 1 ? "" : "s"} needing review`,
    );
  }
  for (const rec of recommendations.slice(0, 5)) {
    summaryLines.push(`[ACTION] ${rec}`);
  }
  for (const deal of dealsSummary.slice(0, 5)) {
    summaryLines.push(`[DEAL] ${deal.deal_name || deal.deal_id}: ${deal.status || "unknown"}`);
  }
  const summaryText = summaryLines.join("\n");

  // C9-011: Fetch calendar + commitments + actions BEFORE LLM call so narrative can reference them
  const commitmentLines080 = readJsonlLines(commitmentsLedgerPath);
  const commitmentMap080 = new Map();
  for (const cl of commitmentLines080) {
    if (cl.kind === "commitment_create") {
      commitmentMap080.set(cl.id, { ...cl });
    } else if (cl.kind === "commitment_complete" && commitmentMap080.has(cl.id)) {
      commitmentMap080.get(cl.id).status = "completed";
    }
  }
  const activeCommitments080 = [...commitmentMap080.values()].filter(
    (c) => c.status === "active" || c.status === "overdue",
  );
  const clintOverdue = activeCommitments080.filter(
    (c) => c.who_owes === "Clint" && c.due_date && new Date(c.due_date) < now,
  ).length;
  const clintDueToday = activeCommitments080.filter(
    (c) =>
      c.who_owes === "Clint" && c.due_date && c.due_date.startsWith(now.toISOString().slice(0, 10)),
  ).length;
  const othersOverdue = activeCommitments080.filter(
    (c) => c.who_owes !== "Clint" && c.due_date && new Date(c.due_date) < now,
  ).length;

  const actionLines080 = readJsonlLines(gtdActionsPath);
  const actionMap080 = new Map();
  for (const al of actionLines080) {
    if (al.kind === "action_create") {
      actionMap080.set(al.id, { ...al });
    } else if (al.kind === "action_complete" && actionMap080.has(al.id)) {
      actionMap080.get(al.id).status = "completed";
    }
  }
  const activeActions080 = [...actionMap080.values()].filter((a) => a.status === "active");
  const highPriorityToday = activeActions080.filter(
    (a) =>
      a.energy === "high" && a.due_date && a.due_date.startsWith(now.toISOString().slice(0, 10)),
  ).length;

  const wfLines080 = readJsonlLines(gtdWaitingForPath);
  const wfMap080 = new Map();
  for (const wl of wfLines080) {
    if (wl.kind === "waiting_create") {
      wfMap080.set(wl.id, { ...wl });
    } else if (wl.kind === "waiting_received" && wfMap080.has(wl.id)) {
      wfMap080.get(wl.id).status = "received";
    }
  }
  const waitingForOverdue = [...wfMap080.values()].filter(
    (w) => w.status === "waiting" && w.expected_by && new Date(w.expected_by) < now,
  ).length;

  // Read meeting prep status
  const prepLines080 = readJsonlLines(meetingsPrepPath);
  const prepByEventId080 = new Map(
    prepLines080.filter((l) => l.kind === "meeting_prep").map((l) => [l.event_id, l]),
  );

  // C9-011: Fetch REAL calendar events from Graph (fall back to sample data)
  let meetings_today = [];
  let calendarSource = "none";
  for (const profileId of GRAPH_ALLOWED_PROFILES) {
    try {
      // C10-031: Use operator timezone for calendar day boundaries
      const opTz = operatorCfg?.operator?.timezone || null;
      let todayStart, todayEnd;
      if (opTz) {
        try {
          const dayFmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: opTz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          const localDate = dayFmt.format(now); // YYYY-MM-DD
          // Compute UTC offset for the operator's midnight
          const _localMidnight = new Date(localDate + "T00:00:00");
          const utcMidnightGuess = new Date(localDate + "T00:00:00Z");
          const fmtCheck = new Intl.DateTimeFormat("en-US", {
            timeZone: opTz,
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          });
          const checkParts = fmtCheck.formatToParts(utcMidnightGuess);
          const checkHour = parseInt(checkParts.find((p) => p.type === "hour")?.value || "0", 10);
          const checkMinute = parseInt(
            checkParts.find((p) => p.type === "minute")?.value || "0",
            10,
          );
          const totalMinutes =
            checkHour > 12 ? (checkHour - 24) * 60 + checkMinute : checkHour * 60 + checkMinute;
          todayStart = new Date(utcMidnightGuess.getTime() - totalMinutes * 60 * 1000);
          todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        } catch {
          todayStart = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
          todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        }
      } else {
        todayStart = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
        todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      }
      const calResult = await fetchCalendarEventsInternal(profileId, todayStart, todayEnd);
      if (calResult.ok && calResult.events.length > 0) {
        calendarSource = "graph";
        for (const evt of calResult.events) {
          meetings_today.push({
            event_id: evt.id,
            title: evt.subject,
            time: evt.start?.dateTime
              ? new Date(evt.start.dateTime + "Z").toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: operatorCfg?.operator?.timezone || "America/Indiana/Indianapolis",
                })
              : "TBD",
            profile_id: profileId,
            location: evt.location || null,
            attendee_count: evt.attendees?.length || 0,
            prep_ready: prepByEventId080.has(evt.id),
            key_decision: evt.body_preview
              ? evt.body_preview.slice(0, 100)
              : "Review open items with attendees.",
          });
        }
      }
    } catch (calErr) {
      logLine(`BRIEF_CALENDAR_FETCH_ERROR: ${profileId} -- ${calErr?.message || "unknown"}`);
    }
  }
  if (meetings_today.length === 0) {
    calendarSource = "sample";
    meetings_today = [
      {
        event_id: "cal-sample-001",
        title: "Deal Review — Sunrise SNF",
        time: "09:00",
        prep_ready: prepByEventId080.has("cal-sample-001"),
        key_decision: "Review deal status",
        source: "sample",
      },
      {
        event_id: "cal-sample-002",
        title: "Everest Board Update",
        time: "14:00",
        prep_ready: prepByEventId080.has("cal-sample-002"),
        key_decision: "Board presentation review",
        source: "sample",
      },
    ];
  }

  // LLM narrative enhancement (JC-071b): attempt LLM-generated narrative
  let narrative = null;
  let briefSource = "template";
  try {
    const systemPrompt = buildSystemPrompt("morning_brief", null);
    const briefData = {
      date: generatedAt,
      triage_open: openTriageItems.length,
      deals_active: deals.length,
      deals_summary: dealsSummary.slice(0, 10),
      filing_pending: pendingFilingSuggestions.length,
      automation_paused: automationPauseState.paused,
      recommendations,
      recent_activity: recentAudit.slice(-20),
      // C9-011/C9-034: Real calendar + commitment data for LLM
      meetings_today_summary: meetings_today.slice(0, 10).map((m) => ({
        title: m.title,
        time: m.time,
        attendee_count: m.attendee_count || 0,
        profile_id: m.profile_id || null,
      })),
      calendar_source: calendarSource,
      commitments_active: activeCommitments080.length,
      clint_overdue: clintOverdue,
      clint_due_today: clintDueToday,
      actions_active: activeActions080.length,
      waiting_for_overdue: waitingForOverdue,
      // C9-034: Email ingestion data
      emails_ingested_today: (() => {
        try {
          const lines = readJsonlLines(ingestionLedgerPath);
          return lines.filter(
            (l) =>
              l.kind === "message_ingested" &&
              typeof l.at === "string" &&
              l.at.startsWith(now.toISOString().slice(0, 10)),
          ).length;
        } catch {
          return 0;
        }
      })(),
      recent_email_subjects: (() => {
        try {
          const lines = readJsonlLines(ingestionLedgerPath);
          return lines
            .filter((l) => l.kind === "message_ingested")
            .slice(-10)
            .map((l) => `${l.from}: ${l.subject}`);
        } catch {
          return [];
        }
      })(),
    };
    const userMessage = `Generate the morning brief narrative for today.\n\nStructured data:\n${JSON.stringify(briefData, null, 2)}\n\nYou MUST include all required sections from the system prompt. Write a concise, decision-ready narrative.`;
    const llmResult = await routeLlmCall(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      null,
      "morning_brief",
    );
    if (llmResult.ok) {
      const validation = validateLlmOutputContract("morning_brief", llmResult.content, null);
      if (validation.valid) {
        narrative = llmResult.content;
        briefSource = "llm";
      } else if (validation.missing_sections.length > 0) {
        // Hybrid: inject missing section stubs from template data
        let hybridNarrative = llmResult.content;
        for (const missing of validation.missing_sections) {
          hybridNarrative += `\n\n## ${missing}\n(No data available for this section.)`;
        }
        narrative = hybridNarrative;
        briefSource = "hybrid";
        // JC-110b: Event log for hybrid mode activation (Plane B observability)
        appendEvent("governance.output_contract.hybrid", "/reporting/morning-brief", {
          missing_sections: validation.missing_sections,
          banned_phrases: validation.banned_phrases_found,
        });
      }
    }
  } catch (llmErr) {
    logLine(`LLM_MORNING_BRIEF_ERROR: ${llmErr?.message || "unknown"}`);
  }

  // JC-090a: Template fallback — NEVER return null narrative
  if (!narrative) {
    narrative = [
      "## Inbox Summary",
      `${openTriageItems.length} open triage item${openTriageItems.length === 1 ? "" : "s"} awaiting review. No LLM analysis available — review inbox manually.`,
      "## Priority Actions",
      recommendations.length > 0
        ? recommendations.map((r) => `- ${r}`).join("\n")
        : "No urgent actions identified. Check commitments and deadlines.",
      "## Calendar",
      "Review today's calendar for meetings and prep requirements.",
      "## Commitments Due",
      "Check commitment ledger for items due today or overdue.",
      "## Deals Overview",
      `${deals.length} active deal${deals.length === 1 ? "" : "s"}.` +
        (dealsSummary.length > 0
          ? " " +
            dealsSummary
              .slice(0, 5)
              .map((d) => `${d.deal_name || d.deal_id} (${d.status || "unknown"})`)
              .join(", ") +
            "."
          : ""),
    ].join("\n\n");
    briefSource = "template";
  }

  appendAudit("MORNING_BRIEF_GENERATED", {
    triage_open: openTriageItems.length,
    deals_active: deals.length,
    filing_pending_count: pendingFilingSuggestions.length,
    facility_alerts_active: activeAlerts.length,
  });
  sendJson(res, 200, {
    generated_at: generatedAt,
    headline,
    summary: summaryText,
    narrative,
    detail: {
      triage_open: openTriageItems.length,
      deals_active: deals.length,
      filing_pending_count: pendingFilingSuggestions.length,
      automation_paused: automationPauseState.paused,
    },
    deals_summary: dealsSummary,
    recent_activity: recentAudit.slice(-50),
    recommendations,
    meetings_today,
    commitments_snapshot: {
      clint_overdue: clintOverdue,
      clint_due_today: clintDueToday,
      others_overdue: othersOverdue,
      total_active: activeCommitments080.length,
    },
    actions_snapshot: {
      high_priority_today: highPriorityToday,
      total_active: activeActions080.length,
      waiting_for_overdue: waitingForOverdue,
    },
    facility_alerts_snapshot: {
      active_count: activeAlerts.length,
      alerts: activeAlerts.slice(0, 10).map((a) => ({
        alert_id: a.alert_id,
        facility: a.facility,
        status: a.status,
        severity: a.severity || "low",
      })),
    },
    operator_brief_sections: briefCfg?.daily_briefs?.work?.must_include || [],
    operator_timezone: operatorCfg?.operator?.timezone || "UTC",
    entity_contexts: operatorCfg?.contexts?.list || [],
    source: briefSource,
    calendar_source: calendarSource,
    // C9-034: Email ingestion snapshot
    email_ingestion_snapshot: (() => {
      try {
        const lines = readJsonlLines(ingestionLedgerPath);
        const ingested = lines.filter((l) => l.kind === "message_ingested");
        const todayIngested = ingested.filter(
          (l) => typeof l.at === "string" && l.at.startsWith(now.toISOString().slice(0, 10)),
        );
        return {
          today_count: todayIngested.length,
          total_count: ingested.length,
          recent: ingested
            .slice(-5)
            .map((l) => ({ from: l.from, subject: l.subject, profile_id: l.profile_id })),
        };
      } catch {
        return { today_count: 0, total_count: 0, recent: [] };
      }
    })(),
  });
  logLine(`GET ${route} -> 200`);
}

async function generateEodDigest(_parsedUrl, res, route) {
  const _briefCfg = getBriefConfig();
  const operatorCfg = getOperatorProfile();
  const now = new Date();
  const generatedAt = now.toISOString();
  // C10-031: Use operator timezone for EOD date boundary
  let todayDateStr;
  let midnightMs;
  const opTz = operatorCfg?.operator?.timezone || null;
  if (opTz) {
    try {
      const dayFmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: opTz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      todayDateStr = dayFmt.format(now); // YYYY-MM-DD in operator tz
      const utcMidnightGuess = new Date(todayDateStr + "T00:00:00Z");
      const fmtCheck = new Intl.DateTimeFormat("en-US", {
        timeZone: opTz,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
      const checkParts = fmtCheck.formatToParts(utcMidnightGuess);
      const checkHour = parseInt(checkParts.find((p) => p.type === "hour")?.value || "0", 10);
      const checkMinute = parseInt(checkParts.find((p) => p.type === "minute")?.value || "0", 10);
      const totalMinutes =
        checkHour > 12 ? (checkHour - 24) * 60 + checkMinute : checkHour * 60 + checkMinute;
      midnightMs = utcMidnightGuess.getTime() - totalMinutes * 60 * 1000;
    } catch {
      todayDateStr = now.toISOString().slice(0, 10);
      midnightMs = new Date(`${todayDateStr}T00:00:00.000Z`).getTime();
    }
  } else {
    todayDateStr = now.toISOString().slice(0, 10);
    midnightMs = new Date(`${todayDateStr}T00:00:00.000Z`).getTime();
  }

  const allTriageLines = readTriageLines();
  const todayAuditLines = allTriageLines.filter((line) => {
    if (line.kind !== "AUDIT") {
      return false;
    }
    const lineTime = typeof line.at === "string" ? new Date(line.at).getTime() : 0;
    return Number.isFinite(lineTime) && lineTime >= midnightMs;
  });

  const actionCounts = new Map();
  let approvalsCount = 0;
  let blocksCount = 0;
  for (const line of todayAuditLines) {
    const action = typeof line.action === "string" ? line.action : "UNKNOWN";
    actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    if (action.includes("APPROVE") || action.includes("PASS")) {
      approvalsCount += 1;
    }
    if (action.includes("BLOCK") || action.includes("BAN")) {
      blocksCount += 1;
    }
  }

  const triageState = triageStateFromLines(allTriageLines);
  const openTriageItems = [...triageState.open.values()];

  const todayTriageResolved = allTriageLines.filter((line) => {
    if (line.kind !== "TRIAGE_LINK" && line.kind !== "TRIAGE_RESOLVED") {
      return false;
    }
    const lineTime =
      typeof line.resolved_at === "string" ? new Date(line.resolved_at).getTime() : 0;
    return Number.isFinite(lineTime) && lineTime >= midnightMs;
  }).length;

  const allFilingSuggestions = listFilingSuggestionsFromLedger();
  const filingApproved = allFilingSuggestions.filter((s) => {
    if (s.status !== "APPROVED") {
      return false;
    }
    const approvedTime = typeof s.approved_at === "string" ? new Date(s.approved_at).getTime() : 0;
    return Number.isFinite(approvedTime) && approvedTime >= midnightMs;
  }).length;
  const filingPending = allFilingSuggestions.filter((s) => s.status === "PROPOSED").length;

  const activityLog = [...actionCounts.entries()]
    .map(([action, count]) => ({ action, count }))
    .toSorted((a, b) => b.count - a.count);

  const unresolved = [];
  if (openTriageItems.length > 0) {
    unresolved.push({
      type: "triage",
      count: openTriageItems.length,
      items: openTriageItems.slice(0, 20).map((item) => ({
        item_id: item.item_id,
        summary: item.summary || null,
      })),
    });
  }
  if (filingPending > 0) {
    const pendingItems = allFilingSuggestions
      .filter((s) => s.status === "PROPOSED")
      .slice(0, 20)
      .map((s) => ({
        suggestion_id: s.suggestion_id,
        source_ref: s.source_ref || null,
      }));
    unresolved.push({
      type: "filing_suggestions",
      count: filingPending,
      items: pendingItems,
    });
  }

  // Progressive disclosure (JC-086a): headline + summary for iMessage/mobile
  const eodHeadline = `EOD ${todayDateStr}: ${todayAuditLines.length} actions, ${approvalsCount} approvals, ${blocksCount} blocks${unresolved.length > 0 ? `, ${unresolved.reduce((sum, u) => sum + u.count, 0)} unresolved` : ""}.`;
  const eodSummaryLines = [];
  eodSummaryLines.push(
    `[DONE] ${todayAuditLines.length} actions completed, ${approvalsCount} approved, ${blocksCount} blocked`,
  );
  if (todayTriageResolved > 0) {
    eodSummaryLines.push(
      `[TRIAGE] ${todayTriageResolved} resolved today, ${openTriageItems.length} still open`,
    );
  }
  if (filingApproved > 0) {
    eodSummaryLines.push(`[FILING] ${filingApproved} approved today, ${filingPending} pending`);
  }
  for (const u of unresolved) {
    eodSummaryLines.push(`[OPEN] ${u.count} ${u.type} item${u.count === 1 ? "" : "s"} unresolved`);
  }
  // C9-035: Email ingestion summary in EOD
  try {
    const il = readJsonlLines(ingestionLedgerPath);
    const tc = il.filter(
      (l) =>
        l.kind === "message_ingested" && typeof l.at === "string" && l.at.startsWith(todayDateStr),
    ).length;
    if (tc > 0) {
      eodSummaryLines.push(`[MAIL] ${tc} email${tc === 1 ? "" : "s"} ingested and triaged today`);
    }
  } catch (err) {
    logLine(`EOD_INGESTION_READ_ERROR: ${err?.message || String(err)}`);
  }
  const eodSummaryText = eodSummaryLines.join("\n");

  // C10-013: Compute commitment/action/waiting-for stats BEFORE LLM call
  // so the narrative can reference real numbers
  const eodCommitmentLines = readJsonlLines(commitmentsLedgerPath);
  const eodTodayStr = todayDateStr;
  const commitmentsCompletedToday = eodCommitmentLines.filter(
    (l) =>
      l.kind === "commitment_complete" && l.completed_at && l.completed_at.startsWith(eodTodayStr),
  ).length;
  const commitmentsCreatedToday = eodCommitmentLines.filter(
    (l) => l.kind === "commitment_create" && l.created_at && l.created_at.startsWith(eodTodayStr),
  ).length;

  const eodActionLines = readJsonlLines(gtdActionsPath);
  const actionsCompletedToday = eodActionLines.filter(
    (l) => l.kind === "action_complete" && l.completed_at && l.completed_at.startsWith(eodTodayStr),
  ).length;

  const eodWfLines = readJsonlLines(gtdWaitingForPath);
  const waitingForReceivedToday = eodWfLines.filter(
    (l) => l.kind === "waiting_received" && l.received_at && l.received_at.startsWith(eodTodayStr),
  ).length;

  const eodDebriefLines = readJsonlLines(meetingsDebriefPath);
  const meetingsDebriefed = eodDebriefLines.filter(
    (l) => l.kind === "meeting_debrief" && l.generated_at && l.generated_at.startsWith(eodTodayStr),
  ).length;

  // LLM narrative enhancement (JC-071c): attempt LLM-generated EOD narrative
  let eodNarrative = null;
  let eodNextDayPriorities = null;
  let eodSource = "template";
  try {
    const systemPrompt = buildSystemPrompt("eod_digest", null);
    // C9-035: Include email ingestion data in digest
    const todayIngestedCount = (() => {
      try {
        const lines = readJsonlLines(ingestionLedgerPath);
        return lines.filter(
          (l) =>
            l.kind === "message_ingested" &&
            typeof l.at === "string" &&
            l.at.startsWith(todayDateStr),
        ).length;
      } catch {
        return 0;
      }
    })();
    const digestData = {
      date: todayDateStr,
      actions_count: todayAuditLines.length,
      approvals_count: approvalsCount,
      blocks_count: blocksCount,
      triage_resolved: todayTriageResolved,
      triage_still_open: openTriageItems.length,
      filing_approved: filingApproved,
      filing_pending: filingPending,
      activity_log: activityLog.slice(0, 20),
      unresolved,
      emails_ingested_today: todayIngestedCount,
      commitments_completed_today: commitmentsCompletedToday,
      commitments_created_today: commitmentsCreatedToday,
      actions_completed_today: actionsCompletedToday,
      waiting_for_received_today: waitingForReceivedToday,
      meetings_debriefed: meetingsDebriefed,
    };
    const userMessage = `Generate the end-of-day digest narrative for ${todayDateStr}.\n\nStructured data:\n${JSON.stringify(digestData, null, 2)}\n\nYou MUST include all required sections from the system prompt. Also provide a "NEXT DAY PRIORITIES" section listing 3-5 items for tomorrow. Write in a matter-of-fact tone.`;
    const llmResult = await routeLlmCall(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      null,
      "eod_digest",
    );
    if (llmResult.ok) {
      const validation = validateLlmOutputContract("eod_digest", llmResult.content, null);
      if (validation.valid) {
        eodNarrative = llmResult.content;
        eodSource = "llm";
        // Extract next_day_priorities if present in narrative
        const prioritiesMatch = llmResult.content.match(
          /(?:NEXT DAY PRIORITIES|PRIORITIES FOR TOMORROW)[:\s]*\n([\s\S]*?)(?:\n##|\n---|Z)/i,
        );
        if (prioritiesMatch) {
          eodNextDayPriorities = prioritiesMatch[1]
            .trim()
            .split("\n")
            .filter((l) => l.trim())
            .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim());
        }
      } else if (validation.missing_sections.length > 0) {
        let hybridNarrative = llmResult.content;
        for (const missing of validation.missing_sections) {
          hybridNarrative += `\n\n## ${missing}\n(No data available for this section.)`;
        }
        eodNarrative = hybridNarrative;
        eodSource = "hybrid";
        // JC-110b: Event log for hybrid mode activation (Plane B observability)
        appendEvent("governance.output_contract.hybrid", "/reporting/eod-digest", {
          missing_sections: validation.missing_sections,
          banned_phrases: validation.banned_phrases_found,
        });
      }
    }
  } catch (llmErr) {
    logLine(`LLM_EOD_DIGEST_ERROR: ${llmErr?.message || "unknown"}`);
  }

  // JC-090a: Template fallback — NEVER return null narrative for EOD
  if (!eodNarrative) {
    eodNarrative = [
      "## Completed Today",
      `${todayAuditLines.length} actions processed: ${approvalsCount} approved, ${blocksCount} blocked.`,
      "## Triage Status",
      `${todayTriageResolved} triage item${todayTriageResolved === 1 ? "" : "s"} resolved today. ${openTriageItems.length} still open.`,
      "## Filing",
      `${filingApproved} filing suggestion${filingApproved === 1 ? "" : "s"} approved. ${filingPending} pending review.`,
      "## Pending Items",
      unresolved.length > 0
        ? unresolved
            .map((u) => `- ${u.count} ${u.type} item${u.count === 1 ? "" : "s"} unresolved`)
            .join("\n")
        : "No unresolved items.",
      "## Tomorrow Prep",
      "Review open triage items and pending commitments. No LLM analysis available.",
    ].join("\n\n");
    eodSource = "template";
  }

  appendAudit("EOD_DIGEST_GENERATED", {
    date: todayDateStr,
    actions_count: todayAuditLines.length,
    approvals_count: approvalsCount,
    blocks_count: blocksCount,
  });
  // BL-012: Proactive calibration — EOD digest prompt
  const eodBlConfig = getBuilderLaneConfig();
  const eodCalLimit = eodBlConfig?.calibration?.max_per_day ?? 3;
  const eodTodayCals = readJsonlLines(correctionSignalsPath).filter(
    (s) => s.signal_type === "calibration_response" && s.recorded_at?.startsWith(todayDateStr),
  ).length;
  const eodCalibrationPrompt =
    eodTodayCals < eodCalLimit
      ? {
          prompt_id: `cal-eod-${todayDateStr}`,
          moment: "eod_review",
          domain: "detail_level",
          question: "Was today's digest at the right level of detail for your needs? (1-5)",
          response_url: "/ops/builder-lane/calibration-response",
        }
      : null;

  sendJson(res, 200, {
    generated_at: generatedAt,
    date: todayDateStr,
    headline: eodHeadline,
    summary: eodSummaryText,
    narrative: eodNarrative,
    next_day_priorities: eodNextDayPriorities,
    detail: {
      actions_count: todayAuditLines.length,
      approvals_count: approvalsCount,
      blocks_count: blocksCount,
      triage_resolved: todayTriageResolved,
      triage_still_open: openTriageItems.length,
      filing_approved: filingApproved,
      filing_pending: filingPending,
    },
    activity_log: activityLog,
    unresolved,
    commitments_completed_today: commitmentsCompletedToday,
    commitments_created_today: commitmentsCreatedToday,
    actions_completed_today: actionsCompletedToday,
    waiting_for_received_today: waitingForReceivedToday,
    meetings_debriefed: meetingsDebriefed,
    operator_timezone: operatorCfg?.operator?.timezone || "UTC",
    source: eodSource,
    calibration_prompt: eodCalibrationPrompt,
  });
  logLine(`GET ${route} -> 200`);
}

// ─── JSONL Helpers (JC-077+) ───

function readJsonlLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        // C10-040: Log corrupt JSONL lines instead of silently dropping them
        logLine(`JSONL_PARSE_WARNING: corrupt line in ${filePath}: ${line.slice(0, 100)}`);
        return null;
      }
    })
    .filter(Boolean);
}

function appendJsonlLine(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
}

// ─── Phase 11: Draft Queue State Machine (JC-089) ───
//
// Formal lifecycle (Design Law #11):
//   drafted → pending_review → edited → approved → executed
//                                ↓         ↓         ↓
//                                └─→ archived ←──────┘
//
// Valid transitions:
//   drafted:        → pending_review, archived
//   pending_review: → edited, approved, archived
//   edited:         → edited (idempotent), pending_review, approved, archived
//   approved:       → executed, archived
//   executed:       → archived (terminal otherwise)
//   archived:       (terminal, no transitions)
//
// Route handlers:
//   POST /drafts/{id}/submit-review   drafted|edited → pending_review
//   POST /drafts/{id}/edit            pending_review|edited → edited
//   POST /drafts/{id}/approve         pending_review|edited → approved
//   POST /drafts/{id}/execute         approved → executed
//   POST /drafts/{id}/archive         any non-terminal → archived
//
// Events emitted per transition:
//   draft.created, draft.queued, draft.pending_review, draft.edited,
//   draft.approved, draft.archived, draft.executed
const DRAFT_TRANSITIONS = {
  drafted: ["pending_review", "archived"],
  pending_review: ["edited", "approved", "archived"],
  edited: ["edited", "pending_review", "approved", "archived"],
  approved: ["executed", "archived", "retry_pending", "dead_lettered"],
  retry_pending: ["executed", "dead_lettered"],
  executed: ["archived"],
  dead_lettered: [],
  archived: [],
};

function buildDraftQueueState() {
  const lines = readJsonlLines(draftQueueLedgerPath);
  const drafts = {};
  for (const line of lines) {
    if (line.kind === "draft_created") {
      drafts[line.draft_id] = {
        draft_id: line.draft_id,
        draft_kind: line.draft_kind || "email",
        state: "drafted",
        subject: line.subject || "",
        to: line.to || "",
        content: line.content || "",
        from_profile: line.from_profile || null,
        related_deal_id: line.related_deal_id || null,
        related_meeting_id: line.related_meeting_id || null,
        entity: line.entity || null,
        graph_message_id: line.graph_message_id || null,
        created_at: line.at || line.created_at,
        updated_at: line.at || line.created_at,
      };
    } else if (line.kind === "draft_state_changed" && drafts[line.draft_id]) {
      drafts[line.draft_id].state = line.new_state;
      drafts[line.draft_id].updated_at = line.at;
      if (line.content) {
        drafts[line.draft_id].content = line.content;
      }
      if (line.subject) {
        drafts[line.draft_id].subject = line.subject;
      }
    }
  }
  return Object.values(drafts);
}

function draftQueueList(parsedUrl, res, route) {
  const allDrafts = buildDraftQueueState();
  const stateFilter = parsedUrl.searchParams.get("state") || null;
  const profileFilter = parsedUrl.searchParams.get("from_profile") || null;
  let drafts = allDrafts;
  if (stateFilter) {
    drafts = drafts.filter((d) => d.state === stateFilter);
  }
  if (profileFilter) {
    drafts = drafts.filter((d) => d.from_profile === profileFilter);
  }
  drafts.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  sendJson(res, 200, { drafts, count: drafts.length });
  logLine(`GET ${route} -> 200`);
}

function draftQueueGet(draftId, res, route) {
  const allDrafts = buildDraftQueueState();
  const draft = allDrafts.find((d) => d.draft_id === draftId);
  if (!draft) {
    sendJson(res, 404, { error: "draft_not_found", draft_id: draftId });
    logLine(`GET ${route} -> 404`);
    return;
  }
  sendJson(res, 200, draft);
  logLine(`GET ${route} -> 200`);
}

async function draftQueueSubmitForReview(draftId, _req, res, route) {
  const allDrafts = buildDraftQueueState();
  const draft = allDrafts.find((d) => d.draft_id === draftId);
  if (!draft) {
    sendJson(res, 404, { error: "draft_not_found", draft_id: draftId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const transition = validateStateTransition(draft.state, "pending_review", DRAFT_TRANSITIONS);
  if (!transition.ok) {
    sendJson(res, 409, {
      error: "invalid_state_transition",
      reason: transition.reason,
      allowed: transition.allowed || [],
    });
    logLine(`POST ${route} -> 409`);
    return;
  }
  const now = new Date().toISOString();
  appendJsonlLine(draftQueueLedgerPath, {
    kind: "draft_state_changed",
    draft_id: draftId,
    new_state: "pending_review",
    at: now,
  });
  appendEvent("draft.pending_review", `/drafts/${draftId}/submit-review`, {
    draft_id: draftId,
    previous_state: draft.state,
  });
  draft.state = "pending_review";
  draft.updated_at = now;
  sendJson(res, 200, draft);
  logLine(`POST ${route} -> 200`);
}

async function draftQueueEdit(draftId, req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const content = typeof body.content === "string" ? body.content : undefined;
  const subject = typeof body.subject === "string" ? body.subject : undefined;
  if (content === undefined && subject === undefined) {
    sendJson(res, 400, { error: "content_or_subject_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const allDrafts = buildDraftQueueState();
  const draft = allDrafts.find((d) => d.draft_id === draftId);
  if (!draft) {
    sendJson(res, 404, { error: "draft_not_found", draft_id: draftId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const transition = validateStateTransition(draft.state, "edited", DRAFT_TRANSITIONS);
  if (!transition.ok) {
    sendJson(res, 409, {
      error: "invalid_state_transition",
      reason: transition.reason,
      allowed: transition.allowed || [],
    });
    logLine(`POST ${route} -> 409`);
    return;
  }
  const now = new Date().toISOString();
  // BL-001: Capture original content before edit for correction signal
  const originalContent = draft.content || "";
  const originalSubject = draft.subject || "";
  const record = {
    kind: "draft_state_changed",
    draft_id: draftId,
    new_state: "edited",
    at: now,
    original_content: originalContent,
    original_subject: originalSubject,
  };
  if (content !== undefined) {
    record.content = content;
  }
  if (subject !== undefined) {
    record.subject = subject;
  }
  appendJsonlLine(draftQueueLedgerPath, record);
  appendEvent("draft.edited", `/drafts/${draftId}/edit`, {
    draft_id: draftId,
    previous_state: draft.state,
  });
  // BL-001: Record correction signal — edit delta
  const editedContent = content !== undefined ? content : originalContent;
  const magnitude = editDistance(originalContent, editedContent);
  const latencyMs = draft.created_at ? Date.now() - new Date(draft.created_at).getTime() : null;
  appendCorrectionSignal("edit", "draft_email", magnitude, {
    latency_ms: latencyMs,
    section_affected:
      content !== undefined && subject !== undefined
        ? "full"
        : content !== undefined
          ? "body"
          : "subject",
    context_bucket: {
      recipient_type: draft.to || null,
      task_type: draft.draft_kind || "email",
      entity: draft.entity || null,
    },
    entity: draft.entity || null,
    source_id: draftId,
  });
  // BL-001: Record style delta for voice/style drift tracking
  appendJsonlLine(styleDeltasPath, {
    draft_id: draftId,
    original: originalContent,
    edited: editedContent,
    original_subject: originalSubject,
    edited_subject: subject !== undefined ? subject : originalSubject,
    recipient_type: draft.to || null,
    task_type: draft.draft_kind || "email",
    entity: draft.entity || null,
    magnitude,
    timestamp: now,
  });
  // Return updated draft
  draft.state = "edited";
  draft.updated_at = now;
  if (content !== undefined) {
    draft.content = content;
  }
  if (subject !== undefined) {
    draft.subject = subject;
  }
  sendJson(res, 200, draft);
  logLine(`POST ${route} -> 200`);
}

async function draftQueueApprove(draftId, req, res, route) {
  const allDrafts = buildDraftQueueState();
  const draft = allDrafts.find((d) => d.draft_id === draftId);
  if (!draft) {
    sendJson(res, 404, { error: "draft_not_found", draft_id: draftId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const transition = validateStateTransition(draft.state, "approved", DRAFT_TRANSITIONS);
  if (!transition.ok) {
    sendJson(res, 409, {
      error: "invalid_state_transition",
      reason: transition.reason,
      allowed: transition.allowed || [],
    });
    logLine(`POST ${route} -> 409`);
    return;
  }
  // MF-8: Require operator approval source
  const approvalSource = req.headers["x-ted-approval-source"];
  if (approvalSource !== "operator") {
    sendJson(res, 403, {
      error: "OPERATOR_APPROVAL_REQUIRED",
      message: "Draft approval requires operator confirmation via the Ted Workbench UI.",
    });
    appendEvent("governance.operator_required.blocked", route, {
      action: "draft_approve",
      approval_source: approvalSource || "none",
    });
    logLine(`POST ${route} -> 403 OPERATOR_APPROVAL_REQUIRED`);
    return;
  }
  const now = new Date().toISOString();
  appendJsonlLine(draftQueueLedgerPath, {
    kind: "draft_state_changed",
    draft_id: draftId,
    new_state: "approved",
    at: now,
  });
  appendEvent("draft.approved", `/drafts/${draftId}/approve`, {
    draft_id: draftId,
    previous_state: draft.state,
  });
  draft.state = "approved";
  draft.updated_at = now;
  sendJson(res, 200, draft);
  logLine(`POST ${route} -> 200`);
}

async function draftQueueArchive(draftId, _req, res, route) {
  const allDrafts = buildDraftQueueState();
  const draft = allDrafts.find((d) => d.draft_id === draftId);
  if (!draft) {
    sendJson(res, 404, { error: "draft_not_found", draft_id: draftId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const transition = validateStateTransition(draft.state, "archived", DRAFT_TRANSITIONS);
  if (!transition.ok) {
    sendJson(res, 409, {
      error: "invalid_state_transition",
      reason: transition.reason,
      allowed: transition.allowed || [],
    });
    logLine(`POST ${route} -> 409`);
    return;
  }
  const now = new Date().toISOString();
  appendJsonlLine(draftQueueLedgerPath, {
    kind: "draft_state_changed",
    draft_id: draftId,
    new_state: "archived",
    at: now,
  });
  appendEvent("draft.archived", `/drafts/${draftId}/archive`, {
    draft_id: draftId,
    previous_state: draft.state,
  });
  // BL-001: Record reject signal — draft was discarded without sending
  appendCorrectionSignal("reject", "draft_email", 1.0, {
    latency_ms: draft.created_at ? Date.now() - new Date(draft.created_at).getTime() : null,
    context_bucket: {
      recipient_type: draft.to || null,
      task_type: draft.draft_kind || "email",
      entity: draft.entity || null,
    },
    entity: draft.entity || null,
    source_id: draftId,
  });
  draft.state = "archived";
  draft.updated_at = now;
  sendJson(res, 200, draft);
  logLine(`POST ${route} -> 200`);
}

async function draftQueueExecute(draftId, req, res, route) {
  const allDrafts = buildDraftQueueState();
  const draft = allDrafts.find((d) => d.draft_id === draftId);
  if (!draft) {
    sendJson(res, 404, { error: "draft_not_found", draft_id: draftId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const transition = validateStateTransition(draft.state, "executed", DRAFT_TRANSITIONS);
  if (!transition.ok) {
    sendJson(res, 409, {
      error: "invalid_state_transition",
      reason: transition.reason,
      allowed: transition.allowed || [],
    });
    logLine(`POST ${route} -> 409`);
    return;
  }
  // MF-8: Require operator approval source
  const approvalSource = req.headers["x-ted-approval-source"];
  if (approvalSource !== "operator") {
    sendJson(res, 403, {
      error: "OPERATOR_APPROVAL_REQUIRED",
      message: "Draft execution requires operator confirmation via the Ted Workbench UI.",
    });
    appendEvent("governance.operator_required.blocked", route, {
      action: "draft_execute",
      approval_source: approvalSource || "none",
    });
    logLine(`POST ${route} -> 403 OPERATOR_APPROVAL_REQUIRED`);
    return;
  }

  // MF-3: Actually send the email via Graph API
  const graphMessageId = draft.graph_message_id;
  if (!graphMessageId) {
    sendJson(res, 409, {
      error: "no_graph_message_id",
      message: "Draft has no linked Graph message — cannot send.",
      draft_id: draftId,
    });
    logLine(`POST ${route} -> 409 no_graph_message_id`);
    return;
  }

  const fromProfile = draft.from_profile;
  if (!fromProfile) {
    sendJson(res, 409, {
      error: "no_from_profile",
      message: "Draft has no from_profile — cannot determine which account to send from.",
      draft_id: draftId,
    });
    logLine(`POST ${route} -> 409 no_from_profile`);
    return;
  }

  // Get auth token via ensureValidToken (proactive refresh)
  const tokenResult = await ensureValidToken(fromProfile);
  if (!tokenResult.ok) {
    setGraphLastError(fromProfile, "NOT_AUTHENTICATED");
    sendJson(res, 409, {
      error: "NOT_AUTHENTICATED",
      next_action: "RUN_DEVICE_CODE_AUTH",
      draft_id: draftId,
    });
    logLine(`POST ${route} -> 409 NOT_AUTHENTICATED`);
    return;
  }
  const accessToken = tokenResult.accessToken;

  // Call Graph API to send the message
  try {
    const sendResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(graphMessageId)}/send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-length": "0",
        },
      },
    );

    if (sendResp.status === 202 || sendResp.ok) {
      // Success — transition state
      const now = new Date().toISOString();
      appendJsonlLine(draftQueueLedgerPath, {
        kind: "draft_state_changed",
        draft_id: draftId,
        new_state: "executed",
        at: now,
      });
      appendEvent("draft.executed", `/drafts/${draftId}/execute`, {
        draft_id: draftId,
        previous_state: draft.state,
        graph_message_id: graphMessageId,
        send_status: "sent",
      });
      // BL-001: Record accept_verbatim if draft was sent without being edited
      const wasEdited = draft.state === "edited";
      appendCorrectionSignal(
        wasEdited ? "accept_after_edit" : "accept_verbatim",
        "draft_email",
        0.0,
        {
          latency_ms: draft.created_at ? Date.now() - new Date(draft.created_at).getTime() : null,
          context_bucket: {
            recipient_type: draft.to || null,
            task_type: draft.draft_kind || "email",
            entity: draft.entity || null,
          },
          entity: draft.entity || null,
          source_id: draftId,
        },
      );
      draft.state = "executed";
      draft.updated_at = now;
      clearGraphLastError(fromProfile);

      // BL-012: Proactive calibration — post-draft-send prompt
      const blCfg = getBuilderLaneConfig();
      const calLim = blCfg?.calibration?.max_per_day ?? 3;
      const todayCal = new Date().toISOString().slice(0, 10);
      const todayCals = readJsonlLines(correctionSignalsPath).filter(
        (s) => s.signal_type === "calibration_response" && s.recorded_at?.startsWith(todayCal),
      ).length;
      const draftCalPrompt =
        todayCals < calLim
          ? {
              prompt_id: `cal-draft-${draftId}`,
              moment: "post_draft_send",
              domain: "tone",
              question: "How well did the draft match your intended tone? (1-5)",
              response_url: "/ops/builder-lane/calibration-response",
            }
          : null;

      sendJson(res, 200, { ...draft, send_status: "sent", calibration_prompt: draftCalPrompt });
      logLine(`POST ${route} -> 200 (email sent)`);
      return;
    }

    if (sendResp.status === 404) {
      // Graph draft was deleted externally
      appendEvent("draft.execute_failed", `/drafts/${draftId}/execute`, {
        draft_id: draftId,
        graph_message_id: graphMessageId,
        error: "graph_draft_not_found",
      });
      sendJson(res, 409, {
        error: "graph_draft_not_found",
        message:
          "The Outlook draft no longer exists — it may have been sent or deleted externally.",
        draft_id: draftId,
      });
      logLine(`POST ${route} -> 409 graph_draft_not_found`);
      return;
    }

    // Other error — do NOT transition state
    const errPayload = await sendResp.json().catch(() => ({}));
    const errCode = errPayload?.error?.code || `send_failed_${sendResp.status}`;
    appendEvent("draft.execute_failed", `/drafts/${draftId}/execute`, {
      draft_id: draftId,
      graph_message_id: graphMessageId,
      error: errCode,
      status: sendResp.status,
    });
    sendJson(res, 502, {
      error: errCode,
      message: "Failed to send email via Graph API.",
      draft_id: draftId,
      graph_status: sendResp.status,
    });
    logLine(`POST ${route} -> 502 ${errCode}`);
  } catch (err) {
    appendEvent("draft.execute_failed", `/drafts/${draftId}/execute`, {
      draft_id: draftId,
      graph_message_id: graphMessageId,
      error: err?.message || "network_error",
    });
    sendJson(res, 502, {
      error: "send_network_error",
      message: "Network error sending email.",
      draft_id: draftId,
    });
    logLine(`POST ${route} -> 502 send_network_error`);
  }
}

// ─── Phase 6: Meeting Lifecycle (JC-077) ───

async function meetingUpcoming(parsedUrl, res, route) {
  const hours = parseInt(parsedUrl.searchParams.get("hours") || "24", 10);
  const now = new Date();
  const cutoff = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const _operatorCfg = getOperatorProfile();

  // Read existing prep packets to determine prep_ready status
  const prepLines = readJsonlLines(meetingsPrepPath);
  const prepByEventId = new Map(
    prepLines.filter((l) => l.kind === "meeting_prep").map((l) => [l.event_id, l]),
  );

  // Read commitments for attendee enrichment
  const commitmentLines = readJsonlLines(commitmentsLedgerPath);
  const activeCommitments = commitmentLines.filter(
    (l) => l.kind === "commitment_create" && l.status === "active",
  );

  // C10-021: Fetch real Graph calendar events (fall back to sample data)
  const meetings = [];
  let calendarSource = "none";
  for (const profileId of GRAPH_ALLOWED_PROFILES) {
    try {
      const calResult = await fetchCalendarEventsInternal(profileId, now, cutoff);
      if (calResult.ok && calResult.events.length > 0) {
        calendarSource = "graph";
        for (const evt of calResult.events) {
          const attendeeEntities = new Set();
          for (const a of evt.attendees || []) {
            const domain = (a.address || "").split("@")[1] || "";
            if (domain.includes("olumie")) {
              attendeeEntities.add("olumie");
            } else if (domain.includes("everest")) {
              attendeeEntities.add("everest");
            }
          }
          const entity = attendeeEntities.size === 1 ? [...attendeeEntities][0] : profileId;
          meetings.push({
            event_id: evt.id,
            title: evt.subject,
            start_time: evt.start?.dateTime
              ? new Date(evt.start.dateTime + "Z").toISOString()
              : now.toISOString(),
            end_time: evt.end?.dateTime
              ? new Date(evt.end.dateTime + "Z").toISOString()
              : cutoff.toISOString(),
            attendees: (evt.attendees || []).map((a) => ({
              name: a.name || "",
              email: a.address || "",
              entity: profileId,
            })),
            entity,
            profile_id: profileId,
            prep_ready: prepByEventId.has(evt.id),
            open_commitments: activeCommitments.filter((c) => c.entity === entity).length,
          });
        }
      }
    } catch (calErr) {
      logLine(`MEETING_UPCOMING_GRAPH_ERROR: ${profileId} -- ${calErr?.message || "unknown"}`);
    }
  }

  // Fallback to sample data if Graph returned nothing
  if (meetings.length === 0) {
    calendarSource = "sample";
    meetings.push(
      {
        event_id: "cal-sample-001",
        title: "Deal Review — Sunrise SNF",
        start_time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        attendees: [{ name: "Isaac", email: "isaac@olumiecapital.com", entity: "olumie" }],
        entity: "olumie",
        prep_ready: prepByEventId.has("cal-sample-001"),
        open_commitments: activeCommitments.filter((c) => c.entity === "olumie").length,
      },
      {
        event_id: "cal-sample-002",
        title: "Everest Board Update",
        start_time: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        attendees: [{ name: "Board", email: "board@everesthh.com", entity: "everest" }],
        entity: "everest",
        prep_ready: prepByEventId.has("cal-sample-002"),
        open_commitments: activeCommitments.filter((c) => c.entity === "everest").length,
      },
    );
  }

  appendAudit("MEETING_UPCOMING_LIST", {
    hours,
    meeting_count: meetings.length,
    calendar_source: calendarSource,
  });
  sendJson(res, 200, {
    meetings,
    generated_at: now.toISOString(),
    hours_window: hours,
    calendar_source: calendarSource,
  });
  logLine(`GET ${route} -> 200`);
}

async function meetingPrepGenerate(eventId, req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const entity = typeof body.entity === "string" ? body.entity : "olumie";
  const profileId = typeof body.profile_id === "string" ? body.profile_id : entity;

  // C9-031: Fetch real calendar event from Graph (graceful fallback to body-provided data)
  let graphEvent = null;
  let graphAttendees = [];
  let calendarSource = "manual";
  try {
    const cfg = getGraphProfileConfig(profileId);
    if (cfg.ok) {
      const tokenResult = await ensureValidToken(profileId);
      if (tokenResult.ok) {
        const eventUrl = `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}?$select=id,subject,start,end,location,attendees,body,organizer`;
        const resp = await graphFetchWithRetry(
          eventUrl,
          {
            method: "GET",
            headers: {
              authorization: `Bearer ${tokenResult.accessToken}`,
              accept: "application/json",
            },
          },
          { label: "meeting_prep_event" },
        );
        if (resp.ok) {
          graphEvent = await resp.json();
          graphAttendees = Array.isArray(graphEvent.attendees)
            ? graphEvent.attendees.map((a) => ({
                name: a?.emailAddress?.name || "",
                address: a?.emailAddress?.address || "",
                type: a?.type || "required",
                status: a?.status?.response || "none",
              }))
            : [];
          calendarSource = "graph";
        }
      }
    }
  } catch (err) {
    logLine(`MEETING_PREP_GRAPH_ERROR: ${err?.message || "unknown"}`);
  }

  const attendees =
    graphAttendees.length > 0
      ? graphAttendees
      : Array.isArray(body.attendees)
        ? body.attendees
        : [];
  const context = graphEvent?.body?.content
    ? stripHtml(graphEvent.body.content).slice(0, 500)
    : typeof body.context === "string"
      ? body.context
      : "";
  const graphSubject = graphEvent?.subject || null;

  // Read related deals and commitments for enrichment
  const deals = listDeals();

  // C9-031: Domain-based deal matching from attendee emails
  const attendeeDomains = new Set(
    attendees.map((a) => (a.address || "").split("@")[1]).filter(Boolean),
  );
  const domainMatchedDeals = deals.filter((d) => {
    const dealContacts = Array.isArray(d.contacts) ? d.contacts : [];
    return dealContacts.some((c) => attendeeDomains.has((c.email || "").split("@")[1]));
  });
  const entityDeals = deals.filter((d) => d.entity === entity || d.status === "active").slice(0, 5);
  const relatedDeals = domainMatchedDeals.length > 0 ? domainMatchedDeals.slice(0, 5) : entityDeals;

  const commitmentLines = readJsonlLines(commitmentsLedgerPath);
  const openCommitments = commitmentLines.filter(
    (l) => l.kind === "commitment_create" && l.status === "active" && l.entity === entity,
  );

  const prepPacket = {
    kind: "meeting_prep",
    event_id: eventId,
    entity,
    calendar_source: calendarSource,
    graph_subject: graphSubject,
    date: new Date().toISOString().slice(0, 10),
    attendees,
    related_deals: relatedDeals.map((d) => d.deal_id),
    open_commitments: openCommitments.map((c) => ({
      id: c.id,
      what: c.what,
      due_date: c.due_date,
    })),
    prep_packet: {
      agenda_suggestion: context
        ? `Review: ${context.slice(0, 200)}`
        : "No specific agenda provided — review open items with attendees.",
      key_decisions_needed:
        relatedDeals.length > 0
          ? relatedDeals.slice(0, 3).map((d) => `Review ${d.deal_name || d.deal_id} status`)
          : ["No active deals linked to this meeting"],
      background_summary: `Meeting with ${attendees.length} attendee(s)${graphSubject ? ` — "${graphSubject}"` : ""}. ${openCommitments.length} open commitment(s) for ${entity}. ${relatedDeals.length} related deal(s)${domainMatchedDeals.length > 0 ? ` (${domainMatchedDeals.length} matched by attendee domain)` : ""}.`,
    },
    generated_at: new Date().toISOString(),
  };

  appendJsonlLine(meetingsPrepPath, prepPacket);
  appendEvent("meeting.prep.generated", "/meeting/prep", {
    event_id: eventId,
    entity,
    attendee_count: attendees.length,
    calendar_source: calendarSource,
  });
  appendAudit("MEETING_PREP_GENERATED", {
    event_id: eventId,
    entity,
    attendee_count: attendees.length,
    calendar_source: calendarSource,
  });
  sendJson(res, 200, prepPacket);
  logLine(`POST ${route} -> 200`);
}

async function meetingDebrief(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const eventId = typeof body.event_id === "string" ? body.event_id.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  if (!eventId || !summary) {
    sendJson(res, 400, { error: "event_id_and_summary_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const entity = typeof body.entity === "string" ? body.entity : "olumie";
  const fromProfile = typeof body.from_profile === "string" ? body.from_profile : entity;

  // Simple heuristic deliverable extraction from summary text
  const deliverables = { ted_owned: [], clint_owned: [] };
  const sentences = summary
    .split(/[.!;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let delCounter = 0;
  for (const sentence of sentences) {
    delCounter++;
    const _lowerSentence = sentence.toLowerCase();
    // Check if it's something Ted can do (draft, send, prepare, generate)
    const tedOwned = /(?:draft|send|prepare|generate|schedule|create|email|calendar)/i.test(
      sentence,
    );
    const item = {
      id: `del-${eventId}-${String(delCounter).padStart(3, "0")}`,
      description: sentence.slice(0, 200),
      due: null,
      status: "pending",
    };
    // Try to extract due date mentions
    const dueMatch = sentence.match(
      /(?:by|before|due|until)\s+((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|next week|end of (?:day|week)))/i,
    );
    if (dueMatch) {
      item.due = dueMatch[1];
    }

    if (tedOwned) {
      deliverables.ted_owned.push(item);
    } else {
      deliverables.clint_owned.push(item);
    }
  }

  const debriefRecord = {
    kind: "meeting_debrief",
    event_id: eventId,
    entity,
    from_profile: fromProfile,
    summary,
    deliverables,
    commitments_extracted: [],
    generated_at: new Date().toISOString(),
  };

  // Auto-create commitments from extracted deliverables
  for (const del of [...deliverables.ted_owned, ...deliverables.clint_owned]) {
    const commitmentId = `commit-${eventId}-${del.id.split("-").pop()}`;
    const commitment = {
      kind: "commitment_create",
      id: commitmentId,
      who_owes: deliverables.ted_owned.includes(del) ? "Ted" : "Clint",
      who_to: deliverables.ted_owned.includes(del) ? "Clint" : "counterparty",
      what: del.description,
      entity,
      source_type: "meeting_debrief",
      source_ref: eventId,
      due_date: del.due || null,
      status: "active",
      follow_up_count: 0,
      created_at: new Date().toISOString(),
    };
    appendJsonlLine(commitmentsLedgerPath, commitment);
    appendEvent("commitment.created", "/meeting/debrief", {
      commitment_id: commitmentId,
      entity,
      source_type: "meeting_debrief",
    });
    debriefRecord.commitments_extracted.push(commitmentId);
  }

  // Phase 11 (JC-089d): Create draft queue entries for email-related ted_owned deliverables
  const draftQueueIds = [];
  for (const del of deliverables.ted_owned) {
    if (/(?:draft|send|email)/i.test(del.description)) {
      const draftId = crypto.randomUUID();
      appendJsonlLine(draftQueueLedgerPath, {
        kind: "draft_created",
        draft_id: draftId,
        draft_kind: "follow_up",
        subject: `Follow-up: ${typeof body.meeting_subject === "string" ? body.meeting_subject : eventId}`,
        to: "",
        content: del.description,
        related_meeting_id: eventId,
        entity: entity || null,
        at: new Date().toISOString(),
      });
      appendEvent("draft.queued", "/meeting/debrief", { draft_id: draftId, source: "debrief" });
      draftQueueIds.push(draftId);
    }
  }
  debriefRecord.draft_queue_ids = draftQueueIds;

  appendJsonlLine(meetingsDebriefPath, debriefRecord);
  appendEvent("meeting.debrief.processed", "/meeting/debrief", {
    event_id: eventId,
    entity,
    deliverable_count: deliverables.ted_owned.length + deliverables.clint_owned.length,
  });
  appendAudit("MEETING_DEBRIEF_PROCESSED", {
    event_id: eventId,
    entity,
    deliverable_count: deliverables.ted_owned.length + deliverables.clint_owned.length,
  });

  // BL-012: Proactive calibration — post-meeting prompt (3-5x weight of passive correction)
  const blConfig = getBuilderLaneConfig();
  const calLimit = blConfig?.calibration?.max_per_day ?? 3;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCalibrations = readJsonlLines(correctionSignalsPath).filter(
    (s) => s.signal_type === "calibration_response" && s.recorded_at?.startsWith(todayKey),
  ).length;
  const calibrationPrompt =
    todayCalibrations < calLimit
      ? {
          prompt_id: `cal-debrief-${eventId}`,
          moment: "post_meeting",
          domain: "structure",
          question: "How well did the meeting summary capture the key takeaways? (1-5)",
          response_url: "/ops/builder-lane/calibration-response",
        }
      : null;

  sendJson(res, 200, { ...debriefRecord, calibration_prompt: calibrationPrompt });
  logLine(`POST ${route} -> 200`);
}

// ─── Phase 6: Commitment Tracking (JC-078) ───

// Commitment lifecycle transitions (JC-091b)
const COMMITMENT_TRANSITIONS = {
  active: ["completed", "overdue", "pending_review", "escalated"],
  pending_review: ["active", "completed"],
  escalated: ["active", "completed"],
  overdue: ["completed", "escalated"],
  completed: [],
};

async function commitmentCreate(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    sendJson(res, 400, { error: "description_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const commitmentId = `commit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    kind: "commitment_create",
    id: commitmentId,
    who_owes: typeof body.owner === "string" ? body.owner : "unspecified",
    who_to: typeof body.who_to === "string" ? body.who_to : "Clint",
    what: description,
    entity: typeof body.entity === "string" ? body.entity : "olumie",
    deal_id: typeof body.deal_id === "string" ? body.deal_id : null,
    source_type: typeof body.source === "string" ? body.source : "manual",
    source_ref: typeof body.source_ref === "string" ? body.source_ref : null,
    due_date: typeof body.due_date === "string" ? body.due_date : null,
    status: "active",
    follow_up_count: 0,
    created_at: new Date().toISOString(),
  };
  appendJsonlLine(commitmentsLedgerPath, record);
  appendEvent("commitment.created", "/commitments/create", {
    commitment_id: commitmentId,
    entity: record.entity,
    who_owes: record.who_owes,
  });
  appendAudit("COMMITMENT_CREATED", { commitment_id: commitmentId, entity: record.entity });
  sendJson(res, 200, { commitment_id: commitmentId, ...record });
  logLine(`POST ${route} -> 200`);
}

function commitmentList(parsedUrl, res, route) {
  const lines = readJsonlLines(commitmentsLedgerPath);
  const statusFilter = parsedUrl.searchParams.get("status") || null;
  const entityFilter = parsedUrl.searchParams.get("entity") || null;

  // Build current state by replaying ledger
  const commitmentMap = new Map();
  for (const line of lines) {
    if (line.kind === "commitment_create") {
      commitmentMap.set(line.id, { ...line });
    } else if (line.kind === "commitment_update" && commitmentMap.has(line.id)) {
      Object.assign(commitmentMap.get(line.id), line);
    } else if (line.kind === "commitment_complete" && commitmentMap.has(line.id)) {
      commitmentMap.get(line.id).status = "completed";
      commitmentMap.get(line.id).completed_at = line.completed_at || new Date().toISOString();
    }
  }

  let commitments = [...commitmentMap.values()];
  if (statusFilter) {
    commitments = commitments.filter((c) => c.status === statusFilter);
  }
  if (entityFilter) {
    commitments = commitments.filter((c) => c.entity === entityFilter);
  }

  // Mark overdue
  const now = new Date();
  for (const c of commitments) {
    if (c.status === "active" && c.due_date) {
      const dueDate = new Date(c.due_date);
      if (!isNaN(dueDate.getTime()) && dueDate < now) {
        c.status = "overdue";
      }
    }
  }

  sendJson(res, 200, { commitments, total_count: commitments.length });
  logLine(`GET ${route} -> 200`);
}

async function commitmentComplete(commitmentId, _req, res, route) {
  // Replay ledger to find current status (JC-091b)
  const lines = readJsonlLines(commitmentsLedgerPath);
  const commitmentMap = new Map();
  for (const line of lines) {
    if (line.kind === "commitment_create") {
      commitmentMap.set(line.id, { ...line });
    } else if (line.kind === "commitment_update" && commitmentMap.has(line.id)) {
      Object.assign(commitmentMap.get(line.id), line);
    } else if (line.kind === "commitment_complete" && commitmentMap.has(line.id)) {
      commitmentMap.get(line.id).status = "completed";
    } else if (line.kind === "commitment_escalate" && commitmentMap.has(line.id)) {
      commitmentMap.get(line.id).status = "escalated";
    }
  }
  const commitment = commitmentMap.get(commitmentId);
  if (!commitment) {
    sendJson(res, 404, { error: "commitment_not_found", commitment_id: commitmentId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  // Mark overdue if applicable
  const now = new Date();
  let currentStatus = commitment.status || "active";
  if (currentStatus === "active" && commitment.due_date) {
    const dueDate = new Date(commitment.due_date);
    if (!isNaN(dueDate.getTime()) && dueDate < now) {
      currentStatus = "overdue";
    }
  }
  const transition = validateStateTransition(currentStatus, "completed", COMMITMENT_TRANSITIONS);
  if (!transition.ok) {
    sendJson(res, 409, {
      error: "invalid_state_transition",
      reason: transition.reason,
      allowed: transition.allowed || [],
    });
    logLine(`POST ${route} -> 409`);
    return;
  }
  const record = {
    kind: "commitment_complete",
    id: commitmentId,
    completed_at: now.toISOString(),
  };
  appendJsonlLine(commitmentsLedgerPath, record);
  appendEvent("commitment.completed", "/commitments/complete", { commitment_id: commitmentId });
  appendAudit("COMMITMENT_COMPLETED", { commitment_id: commitmentId });
  // BL-001: Record commitment acceptance signal (operator confirmed commitment was valid)
  appendCorrectionSignal("accept_verbatim", "commitment", 0.0, {
    context_bucket: {
      entity: commitment.entity || null,
      source_type: commitment.source_type || null,
    },
    entity: commitment.entity || null,
    source_id: commitmentId,
  });
  sendJson(res, 200, {
    commitment_id: commitmentId,
    status: "completed",
    completed_at: record.completed_at,
  });
  logLine(`POST ${route} -> 200`);
}

async function commitmentEscalate(commitmentId, req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const reason = body && typeof body.reason === "string" ? body.reason.trim() : "";

  // Replay ledger to find current status
  const lines = readJsonlLines(commitmentsLedgerPath);
  const commitmentMap = new Map();
  for (const line of lines) {
    if (line.kind === "commitment_create") {
      commitmentMap.set(line.id, { ...line });
    } else if (line.kind === "commitment_update" && commitmentMap.has(line.id)) {
      Object.assign(commitmentMap.get(line.id), line);
    } else if (line.kind === "commitment_complete" && commitmentMap.has(line.id)) {
      commitmentMap.get(line.id).status = "completed";
    } else if (line.kind === "commitment_escalate" && commitmentMap.has(line.id)) {
      commitmentMap.get(line.id).status = "escalated";
    }
  }
  const commitment = commitmentMap.get(commitmentId);
  if (!commitment) {
    sendJson(res, 404, { error: "commitment_not_found", commitment_id: commitmentId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  // Mark overdue if applicable
  const now = new Date();
  let currentStatus = commitment.status || "active";
  if (currentStatus === "active" && commitment.due_date) {
    const dueDate = new Date(commitment.due_date);
    if (!isNaN(dueDate.getTime()) && dueDate < now) {
      currentStatus = "overdue";
    }
  }
  const transition = validateStateTransition(currentStatus, "escalated", COMMITMENT_TRANSITIONS);
  if (!transition.ok) {
    sendJson(res, 409, {
      error: "invalid_state_transition",
      reason: transition.reason,
      allowed: transition.allowed || [],
    });
    logLine(`POST ${route} -> 409`);
    return;
  }
  const record = {
    kind: "commitment_escalate",
    id: commitmentId,
    reason,
    escalated_at: now.toISOString(),
  };
  appendJsonlLine(commitmentsLedgerPath, record);
  appendEvent("commitment.escalated", "/commitments/escalate", {
    commitment_id: commitmentId,
    reason,
  });
  appendAudit("COMMITMENT_ESCALATED", { commitment_id: commitmentId, reason });
  sendJson(res, 200, {
    commitment_id: commitmentId,
    status: "escalated",
    reason,
    escalated_at: record.escalated_at,
  });
  logLine(`POST ${route} -> 200`);
}

// ─── Phase 13: Investor OIG Compliance State Machine (JC-091c) ───

const INVESTOR_OIG_TRANSITIONS = {
  pending: ["checking", "flagged"],
  checking: ["verified", "flagged"],
  verified: ["cleared"],
  flagged: ["escalated", "cleared"],
  escalated: ["cleared", "flagged"],
  cleared: [],
};

async function investorOigUpdate(dealId, investorName, req, res, route) {
  if (!dealId || !isSlugSafe(dealId)) {
    sendJson(res, 400, { error: "invalid_deal_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const filePath = getDealPath(dealId);
  const deal = readJsonFile(filePath);
  if (!deal || typeof deal !== "object") {
    sendJson(res, 404, { error: "deal_not_found", deal_id: dealId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  if (!Array.isArray(deal.investors)) {
    sendJson(res, 404, {
      error: "investor_not_found",
      deal_id: dealId,
      investor_name: investorName,
    });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const idx = deal.investors.findIndex((inv) => inv.name === investorName);
  if (idx < 0) {
    sendJson(res, 404, {
      error: "investor_not_found",
      deal_id: dealId,
      investor_name: investorName,
    });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const newStatus = typeof body.new_status === "string" ? body.new_status.trim() : "";
  if (!newStatus) {
    sendJson(res, 400, { error: "new_status_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const currentOigStatus = deal.investors[idx].oig_status || "pending";
  const transition = validateStateTransition(currentOigStatus, newStatus, INVESTOR_OIG_TRANSITIONS);
  if (!transition.ok) {
    sendJson(res, 409, {
      error: "invalid_state_transition",
      reason: transition.reason,
      allowed: transition.allowed || [],
    });
    logLine(`POST ${route} -> 409`);
    return;
  }
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  deal.investors[idx].oig_status = newStatus;
  deal.investors[idx].oig_checked_at = new Date().toISOString();
  if (notes) {
    deal.investors[idx].oig_notes = notes;
  }
  deal.updated_at = new Date().toISOString();
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendEvent("deal.investor.oig_updated", "/deals/investors/oig-update", {
    deal_id: dealId,
    investor_name: investorName,
    from_status: currentOigStatus,
    to_status: newStatus,
  });
  appendAudit("DEAL_INVESTOR_OIG_UPDATE", {
    deal_id: dealId,
    investor_name: investorName,
    from_status: currentOigStatus,
    to_status: newStatus,
  });
  sendJson(res, 200, {
    deal_id: dealId,
    investor_name: investorName,
    oig_status: newStatus,
    previous_status: currentOigStatus,
    notes: notes || undefined,
  });
  logLine(`POST ${route} -> 200`);
}

// ─── Phase 13: Facility Alert System (JC-091d) ───

const FACILITY_ALERT_TRANSITIONS = {
  monitoring: ["warning", "crisis"],
  warning: ["crisis", "resolved", "monitoring"],
  crisis: ["resolved", "escalated"],
  escalated: ["resolved"],
  resolved: ["archived", "monitoring"],
  archived: [],
};

function buildFacilityAlertState() {
  const lines = readJsonlLines(facilityAlertsPath);
  const alerts = {};
  for (const line of lines) {
    if (line.kind === "facility_alert_created") {
      alerts[line.alert_id] = { ...line, status: "monitoring" };
    } else if (line.kind === "facility_alert_status_changed") {
      if (alerts[line.alert_id]) {
        alerts[line.alert_id].status = line.new_status;
      }
    }
  }
  return Object.values(alerts);
}

async function facilityAlertCreate(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const facility = typeof body.facility === "string" ? body.facility.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!facility || !description) {
    sendJson(res, 400, { error: "facility_and_description_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const record = {
    kind: "facility_alert_created",
    alert_id: alertId,
    facility,
    description,
    severity: typeof body.severity === "string" ? body.severity.trim() : "low",
    entity: typeof body.entity === "string" ? body.entity.trim() : "olumie",
    created_at: now,
  };
  appendJsonlLine(facilityAlertsPath, record);
  appendEvent("facility.alert.created", "/facility/alert/create", {
    alert_id: alertId,
    facility,
    severity: record.severity,
  });
  appendAudit("FACILITY_ALERT_CREATED", { alert_id: alertId, facility });
  sendJson(res, 200, { alert_id: alertId, status: "monitoring", ...record });
  logLine(`POST ${route} -> 200`);
}

function facilityAlertsList(parsedUrl, res, route) {
  const statusFilter = parsedUrl.searchParams.get("status") || null;
  const alerts = buildFacilityAlertState();
  const filtered = statusFilter ? alerts.filter((a) => a.status === statusFilter) : alerts;
  sendJson(res, 200, { alerts: filtered, total_count: filtered.length });
  logLine(`GET ${route} -> 200`);
}

async function facilityAlertEscalate(alertId, req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const reason = body && typeof body.reason === "string" ? body.reason.trim() : "";
  const targetStatus =
    body &&
    typeof body.target_status === "string" &&
    ["escalated", "crisis"].includes(body.target_status)
      ? body.target_status
      : "escalated";

  const alerts = buildFacilityAlertState();
  const alert = alerts.find((a) => a.alert_id === alertId);
  if (!alert) {
    sendJson(res, 404, { error: "alert_not_found", alert_id: alertId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const transition = validateStateTransition(
    alert.status,
    targetStatus,
    FACILITY_ALERT_TRANSITIONS,
  );
  if (!transition.ok) {
    sendJson(res, 409, {
      error: "invalid_state_transition",
      reason: transition.reason,
      allowed: transition.allowed || [],
    });
    logLine(`POST ${route} -> 409`);
    return;
  }
  const now = new Date().toISOString();
  appendJsonlLine(facilityAlertsPath, {
    kind: "facility_alert_status_changed",
    alert_id: alertId,
    new_status: targetStatus,
    reason,
    changed_at: now,
  });
  appendEvent("facility.alert.escalated", "/facility/alert/escalate", {
    alert_id: alertId,
    from_status: alert.status,
    to_status: targetStatus,
    reason,
  });
  appendAudit("FACILITY_ALERT_ESCALATED", {
    alert_id: alertId,
    from_status: alert.status,
    to_status: targetStatus,
  });
  sendJson(res, 200, {
    alert_id: alertId,
    status: targetStatus,
    previous_status: alert.status,
    reason: reason || undefined,
    changed_at: now,
  });
  logLine(`POST ${route} -> 200`);
}

async function facilityAlertResolve(alertId, req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const resolution = body && typeof body.resolution === "string" ? body.resolution.trim() : "";

  const alerts = buildFacilityAlertState();
  const alert = alerts.find((a) => a.alert_id === alertId);
  if (!alert) {
    sendJson(res, 404, { error: "alert_not_found", alert_id: alertId });
    logLine(`POST ${route} -> 404`);
    return;
  }
  const transition = validateStateTransition(alert.status, "resolved", FACILITY_ALERT_TRANSITIONS);
  if (!transition.ok) {
    sendJson(res, 409, {
      error: "invalid_state_transition",
      reason: transition.reason,
      allowed: transition.allowed || [],
    });
    logLine(`POST ${route} -> 409`);
    return;
  }
  const now = new Date().toISOString();
  appendJsonlLine(facilityAlertsPath, {
    kind: "facility_alert_status_changed",
    alert_id: alertId,
    new_status: "resolved",
    resolution,
    resolved_at: now,
  });
  appendEvent("facility.alert.resolved", "/facility/alert/resolve", {
    alert_id: alertId,
    from_status: alert.status,
    resolution,
  });
  appendAudit("FACILITY_ALERT_RESOLVED", { alert_id: alertId, from_status: alert.status });
  sendJson(res, 200, {
    alert_id: alertId,
    status: "resolved",
    previous_status: alert.status,
    resolution: resolution || undefined,
    resolved_at: now,
  });
  logLine(`POST ${route} -> 200`);
}

// ─── Phase 6: GTD Action Management (JC-079) ───

async function gtdActionCreate(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    sendJson(res, 400, { error: "description_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const actionId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    kind: "action_create",
    id: actionId,
    description,
    entity: typeof body.entity === "string" ? body.entity : "olumie",
    deal_id: typeof body.deal_id === "string" ? body.deal_id : null,
    source_type: typeof body.source_type === "string" ? body.source_type : "manual",
    source_ref: typeof body.source_ref === "string" ? body.source_ref : null,
    context: typeof body.context === "string" ? body.context : null,
    energy: typeof body.energy === "string" ? body.energy : "medium",
    time_estimate_min: typeof body.time_estimate_min === "number" ? body.time_estimate_min : null,
    due_date: typeof body.due_date === "string" ? body.due_date : null,
    status: "active",
    created_at: new Date().toISOString(),
  };
  appendJsonlLine(gtdActionsPath, record);
  appendEvent("gtd.action.created", "/gtd/actions/create", {
    action_id: actionId,
    entity: record.entity,
    context: record.context,
  });
  appendAudit("GTD_ACTION_CREATED", { action_id: actionId, entity: record.entity });
  sendJson(res, 200, { action_id: actionId, ...record });
  logLine(`POST ${route} -> 200`);
}

function gtdActionsList(parsedUrl, res, route) {
  const lines = readJsonlLines(gtdActionsPath);
  const statusFilter = parsedUrl.searchParams.get("status") || null;
  const entityFilter = parsedUrl.searchParams.get("entity") || null;

  const actionMap = new Map();
  for (const line of lines) {
    if (line.kind === "action_create") {
      actionMap.set(line.id, { ...line });
    } else if (line.kind === "action_complete" && actionMap.has(line.id)) {
      actionMap.get(line.id).status = "completed";
      actionMap.get(line.id).completed_at = line.completed_at || new Date().toISOString();
    } else if (line.kind === "action_delegate" && actionMap.has(line.id)) {
      actionMap.get(line.id).status = "delegated";
      actionMap.get(line.id).delegated_at = line.delegated_at || new Date().toISOString();
    }
  }

  let actions = [...actionMap.values()];
  if (statusFilter) {
    actions = actions.filter((a) => a.status === statusFilter);
  }
  if (entityFilter) {
    actions = actions.filter((a) => a.entity === entityFilter);
  }

  sendJson(res, 200, { actions, total_count: actions.length });
  logLine(`GET ${route} -> 200`);
}

async function gtdActionComplete(actionId, _req, res, route) {
  // M-1: Verify action exists before completing
  const lines = readJsonlLines(gtdActionsPath);
  const exists = lines.some((l) => l.kind === "action_create" && l.id === actionId);
  if (!exists) {
    sendJson(res, 404, { error: "action_not_found", action_id: actionId });
    logLine(`POST ${route} -> 404 action_not_found`);
    return;
  }
  appendJsonlLine(gtdActionsPath, {
    kind: "action_complete",
    id: actionId,
    completed_at: new Date().toISOString(),
  });
  appendEvent("gtd.action.completed", "/gtd/actions/complete", { action_id: actionId });
  appendAudit("GTD_ACTION_COMPLETED", { action_id: actionId });
  sendJson(res, 200, { action_id: actionId, status: "completed" });
  logLine(`POST ${route} -> 200`);
}

function gtdWaitingForList(parsedUrl, res, route) {
  const lines = readJsonlLines(gtdWaitingForPath);
  const statusFilter = parsedUrl.searchParams.get("status") || null;
  const entityFilter = parsedUrl.searchParams.get("entity") || null;

  const wfMap = new Map();
  for (const line of lines) {
    if (line.kind === "waiting_create") {
      wfMap.set(line.id, { ...line });
    } else if (line.kind === "waiting_received" && wfMap.has(line.id)) {
      wfMap.get(line.id).status = "received";
      wfMap.get(line.id).received_at = line.received_at || new Date().toISOString();
    }
  }

  let items = [...wfMap.values()];
  // Mark overdue
  const now = new Date();
  for (const item of items) {
    if (item.status === "waiting" && item.expected_by) {
      const expectedDate = new Date(item.expected_by);
      if (!isNaN(expectedDate.getTime()) && expectedDate < now) {
        item.status = "overdue";
      }
    }
  }

  if (statusFilter) {
    items = items.filter((i) => i.status === statusFilter);
  }
  if (entityFilter) {
    items = items.filter((i) => i.entity === entityFilter);
  }

  sendJson(res, 200, { waiting_for: items, total_count: items.length });
  logLine(`GET ${route} -> 200`);
}

async function gtdWaitingForCreate(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    sendJson(res, 400, { error: "description_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const wfId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    kind: "waiting_create",
    id: wfId,
    description,
    delegated_to: typeof body.delegated_to === "string" ? body.delegated_to : "unspecified",
    entity: typeof body.entity === "string" ? body.entity : "olumie",
    deal_id: typeof body.deal_id === "string" ? body.deal_id : null,
    expected_by: typeof body.expected_by === "string" ? body.expected_by : null,
    status: "waiting",
    follow_up_count: 0,
    created_at: new Date().toISOString(),
  };
  appendJsonlLine(gtdWaitingForPath, record);
  appendEvent("gtd.waiting_for.created", "/gtd/waiting-for/create", {
    waiting_for_id: wfId,
    entity: record.entity,
    who: record.who,
  });
  appendAudit("GTD_WAITING_FOR_CREATED", { waiting_for_id: wfId, entity: record.entity });
  sendJson(res, 200, { waiting_for_id: wfId, ...record });
  logLine(`POST ${route} -> 200`);
}

// ─── Phase 7: Time-Block Planning (JC-081) ───

async function timeblockGenerate(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const date = typeof body.date === "string" ? body.date : new Date().toISOString().slice(0, 10);
  const planningCfg = readConfigFile(planningPreferencesConfigPath) || {
    default_deep_work_hours_target: 4,
    default_work_start: "07:30",
    default_work_end: "17:30",
    deep_work_minimum_minutes: 60,
    shallow_batch_maximum_minutes: 45,
  };

  // Read active actions to schedule
  const actionLines = readJsonlLines(gtdActionsPath);
  const actionMap = new Map();
  for (const al of actionLines) {
    if (al.kind === "action_create") {
      actionMap.set(al.id, { ...al });
    } else if (al.kind === "action_complete" && actionMap.has(al.id)) {
      actionMap.get(al.id).status = "completed";
    }
  }
  const activeActions = [...actionMap.values()].filter((a) => a.status === "active");

  // Read active commitments
  const commitmentLines = readJsonlLines(commitmentsLedgerPath);
  const commitmentMap = new Map();
  for (const cl of commitmentLines) {
    if (cl.kind === "commitment_create") {
      commitmentMap.set(cl.id, { ...cl });
    } else if (cl.kind === "commitment_complete" && commitmentMap.has(cl.id)) {
      commitmentMap.get(cl.id).status = "completed";
    }
  }
  const activeCommitments = [...commitmentMap.values()].filter((c) => c.status === "active");

  // Generate time blocks
  const blocks = [];
  let deepWorkMinutes = 0;
  const workStart = planningCfg.default_work_start || "07:30";
  const _deepTarget = (planningCfg.default_deep_work_hours_target || 4) * 60;

  // Deep work block
  const deepActions = activeActions.filter((a) => a.energy === "high").slice(0, 3);
  if (deepActions.length > 0) {
    const blockMinutes = Math.max(
      planningCfg.deep_work_minimum_minutes || 60,
      deepActions.reduce((sum, a) => sum + (a.time_estimate_min || 45), 0),
    );
    blocks.push({
      block_id: `block-${date}-001`,
      type: "deep_work",
      start: `${date}T${workStart}:00`,
      duration_minutes: Math.min(blockMinutes, 120),
      tasks: deepActions.map((a) => ({ action_id: a.id, description: a.description })),
      show_as: planningCfg.deep_work_show_as || "busy",
    });
    deepWorkMinutes += Math.min(blockMinutes, 120);
  }

  // Shallow batch block
  const shallowActions = activeActions.filter((a) => a.energy !== "high").slice(0, 5);
  if (shallowActions.length > 0) {
    blocks.push({
      block_id: `block-${date}-002`,
      type: "shallow_batch",
      start: `${date}T10:00:00`,
      duration_minutes: planningCfg.shallow_batch_maximum_minutes || 45,
      tasks: shallowActions.map((a) => ({ action_id: a.id, description: a.description })),
      show_as: planningCfg.shallow_show_as || "tentative",
    });
  }

  // Commitment review block
  if (activeCommitments.length > 0) {
    blocks.push({
      block_id: `block-${date}-003`,
      type: "commitment_review",
      start: `${date}T15:00:00`,
      duration_minutes: 30,
      tasks: activeCommitments.slice(0, 5).map((c) => ({ commitment_id: c.id, what: c.what })),
      show_as: "tentative",
    });
  }

  const planId = `plan-${date}-${Math.random().toString(36).slice(2, 8)}`;
  const plan = {
    plan_id: planId,
    date,
    blocks,
    deep_work_hours: Math.round((deepWorkMinutes / 60) * 10) / 10,
    deep_work_target: planningCfg.default_deep_work_hours_target || 4,
    actions_scheduled: activeActions.length,
    commitments_pending: activeCommitments.length,
    generated_at: new Date().toISOString(),
  };

  appendJsonlLine(planningLedgerPath, { kind: "plan_generated", ...plan });
  appendEvent("planning.timeblock.generated", "/planning/timeblock/generate", {
    plan_id: planId,
    date,
    block_count: blocks.length,
  });
  appendAudit("TIMEBLOCK_PLAN_GENERATED", { plan_id: planId, date, block_count: blocks.length });
  sendJson(res, 200, plan);
  logLine(`POST ${route} -> 200`);
}

// ─── Phase 7: PARA Filing Classification (JC-082) ───

async function paraClassify(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const item = typeof body.item === "string" ? body.item.trim() : "";
  if (!item) {
    sendJson(res, 400, { error: "item_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const entity = typeof body.entity === "string" ? body.entity : "olumie";
  const dealId = typeof body.deal_id === "string" ? body.deal_id : null;

  const paraRules = readConfigFile(paraRulesConfigPath) || { classification_rules: [] };
  const deals = listDeals();

  // Apply classification rules
  let category = "resource"; // default
  let confidence = 0.5;
  const lowerItem = item.toLowerCase();

  // Check for active deal match
  if (dealId) {
    const dealExists = deals.some((d) => d.deal_id === dealId && d.status === "active");
    if (dealExists) {
      category = "project";
      confidence += 0.3;
    }
  } else {
    // Check for deal keywords in item text
    const matchedDeal = deals.find((d) =>
      lowerItem.includes((d.deal_name || d.deal_id || "").toLowerCase()),
    );
    if (matchedDeal && matchedDeal.status === "active") {
      category = "project";
      confidence += 0.25;
    } else if (
      matchedDeal &&
      (matchedDeal.status === "closed" || matchedDeal.status === "archived")
    ) {
      category = "archive";
      confidence += 0.4;
    }
  }

  // Check for entity context match
  if (category !== "project" && entity) {
    category = "area";
    confidence += 0.2;
  }

  // Check for reference keywords
  const referenceKeywords = [
    "template",
    "checklist",
    "guide",
    "methodology",
    "policy",
    "procedure",
    "manual",
  ];
  if (referenceKeywords.some((kw) => lowerItem.includes(kw))) {
    category = "resource";
    confidence = Math.max(confidence, 0.7);
  }

  confidence = Math.min(confidence, 1.0);

  const folderTemplate =
    paraRules.folder_template || "/{entity}/{para_category}/{deal_or_topic}/{document_type}";
  const suggestedPath = folderTemplate
    .replace("{entity}", entity)
    .replace("{para_category}", category)
    .replace("{deal_or_topic}", dealId || "general")
    .replace("{document_type}", "document");

  appendAudit("PARA_CLASSIFY", { item: item.slice(0, 100), category, confidence, entity });
  // JC-088f: PARA index ledger write
  try {
    appendJsonlLine(paraIndexPath, {
      kind: "para_classified",
      item: item.slice(0, 200),
      category,
      area: entity,
      at: new Date().toISOString(),
    });
    appendEvent("filing.para.classified", "/filing/para/classify", { category, area: entity });
  } catch (err) {
    logLine(`PARA_LEDGER_WRITE_ERROR: ${err?.message || String(err)}`);
  }
  sendJson(res, 200, {
    item,
    para_category: category,
    confidence: Math.round(confidence * 100) / 100,
    entity,
    deal_id: dealId,
    suggested_path: suggestedPath,
    classification_rules_applied: paraRules.classification_rules?.length || 0,
  });
  logLine(`POST ${route} -> 200`);
}

function paraStructure(res, route) {
  const deals = listDeals();
  const structure = {
    projects: deals
      .filter((d) => d.status === "active")
      .map((d) => ({
        deal_id: d.deal_id,
        deal_name: d.deal_name || d.deal_id,
        entity: d.entity || "olumie",
      })),
    areas: [
      { entity: "olumie", description: "Olumie Capital operations" },
      { entity: "everest", description: "Everest Healthcare Holdings" },
    ],
    resources: [
      { type: "templates", description: "Document templates and checklists" },
      { type: "guides", description: "Process guides and methodologies" },
    ],
    archives: deals
      .filter((d) => d.status === "closed" || d.status === "archived")
      .map((d) => ({
        deal_id: d.deal_id,
        deal_name: d.deal_name || d.deal_id,
      })),
  };

  // JC-088f: Supplement structure with PARA index classification history
  let recentClassifications = [];
  try {
    const indexLines = readJsonlLines(paraIndexPath);
    const classLines = indexLines.filter((l) => l.kind === "para_classified");
    // Count classifications by category
    const categoryCounts = {};
    for (const cl of classLines) {
      const cat = cl.category || "unknown";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    recentClassifications = classLines.slice(-20).map((l) => ({
      item: l.item || "",
      category: l.category || "unknown",
      area: l.area || null,
      at: l.at || null,
    }));
    structure.classification_stats = { total: classLines.length, by_category: categoryCounts };
  } catch (err) {
    logLine(`PARA_INDEX_READ_ERROR: ${err?.message || String(err)}`);
  }

  sendJson(res, 200, {
    structure,
    recent_classifications: recentClassifications,
    generated_at: new Date().toISOString(),
  });
  logLine(`GET ${route} -> 200`);
}

// ─── Phase 7: Deep Work Metrics (JC-083) ───

function deepWorkMetrics(parsedUrl, res, route) {
  const period = parsedUrl.searchParams.get("period") || "week";
  const now = new Date();
  let lookbackDays = 7;
  if (period === "month") {
    lookbackDays = 30;
  }
  if (period === "day") {
    lookbackDays = 1;
  }

  const cutoffMs = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
  const planLines = readJsonlLines(planningLedgerPath);
  const recentPlans = planLines.filter(
    (l) =>
      l.kind === "plan_generated" &&
      l.generated_at &&
      new Date(l.generated_at).getTime() >= cutoffMs,
  );

  // Aggregate deep work hours from plans
  const totalDeepWorkHours = recentPlans.reduce((sum, p) => sum + (p.deep_work_hours || 0), 0);
  const planningCfg = readConfigFile(planningPreferencesConfigPath) || {
    default_deep_work_hours_target: 4,
  };
  const targetHours = (planningCfg.default_deep_work_hours_target || 4) * lookbackDays;

  // Count completed actions in period
  const actionLines = readJsonlLines(gtdActionsPath);
  const completedActions = actionLines.filter(
    (l) =>
      l.kind === "action_complete" &&
      l.completed_at &&
      new Date(l.completed_at).getTime() >= cutoffMs,
  ).length;

  // JC-088c: Supplement with deep work ledger sessions
  let ledgerSessionCount = 0;
  let ledgerSessionMinutes = 0;
  try {
    const dwLines = readJsonlLines(deepWorkLedgerPath);
    const recentSessions = dwLines.filter(
      (l) => l.kind === "deep_work_session" && l.at && new Date(l.at).getTime() >= cutoffMs,
    );
    ledgerSessionCount = recentSessions.length;
    ledgerSessionMinutes = recentSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  } catch (err) {
    logLine(`DEEP_WORK_LEDGER_READ_ERROR: ${err?.message || String(err)}`);
  }

  // Persist this metrics snapshot to deep work ledger + event log
  const metricsSnapshot = {
    period,
    deep_work_hours: Math.round(totalDeepWorkHours * 10) / 10,
    adherence_pct: targetHours > 0 ? Math.round((totalDeepWorkHours / targetHours) * 100) : 0,
    plans_generated: recentPlans.length,
    actions_completed: completedActions,
    ledger_sessions: ledgerSessionCount,
  };
  try {
    appendJsonlLine(deepWorkLedgerPath, {
      kind: "deep_work_metrics_query",
      ...metricsSnapshot,
      at: now.toISOString(),
    });
    appendEvent("deep_work.metrics.queried", "/deep-work/metrics", metricsSnapshot);
  } catch (err) {
    logLine(`DEEP_WORK_LEDGER_WRITE_ERROR: ${err?.message || String(err)}`);
  }

  sendJson(res, 200, {
    period,
    lookback_days: lookbackDays,
    deep_work_hours: Math.round(totalDeepWorkHours * 10) / 10,
    target_hours: targetHours,
    adherence_pct: targetHours > 0 ? Math.round((totalDeepWorkHours / targetHours) * 100) : 0,
    plans_generated: recentPlans.length,
    actions_completed: completedActions,
    ledger_sessions: ledgerSessionCount,
    ledger_session_minutes: ledgerSessionMinutes,
    generated_at: now.toISOString(),
  });
  logLine(`GET ${route} -> 200`);
}

// ─── JC-110d: Deep Work Session Recording ───

async function recordDeepWorkSession(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const durationMinutes = typeof body.duration_minutes === "number" ? body.duration_minutes : 0;
  const label = typeof body.label === "string" ? body.label.slice(0, 200) : "Deep work";
  const entity = typeof body.entity === "string" ? body.entity : null;
  if (durationMinutes <= 0 || durationMinutes > 480) {
    sendJson(res, 400, { error: "invalid_duration", detail: "duration_minutes must be 1-480" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const now = new Date().toISOString();
  const session = {
    kind: "deep_work_session",
    duration_minutes: durationMinutes,
    label,
    entity,
    at: now,
  };
  appendJsonlLine(deepWorkLedgerPath, session);
  appendEvent("reporting.deep_work.session.recorded", route, {
    duration_minutes: durationMinutes,
    label,
    entity,
  });
  sendJson(res, 200, { recorded: true, session });
  logLine(`POST ${route} -> 200`);
}

// ─── Phase 8: Trust Metrics (JC-085) ───

function trustMetrics(parsedUrl, res, route) {
  const period = parsedUrl.searchParams.get("period") || "week";
  const now = new Date();
  let lookbackDays = 7;
  if (period === "month") {
    lookbackDays = 30;
  }
  if (period === "day") {
    lookbackDays = 1;
  }

  const cutoffMs = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
  const triageLines = readTriageLines();
  const recentAudit = triageLines.filter(
    (l) => l.kind === "AUDIT" && l.at && new Date(l.at).getTime() >= cutoffMs,
  );

  // Calculate approval rate
  let approvalCount = 0;
  let totalDecisions = 0;
  let editCount = 0;
  for (const line of recentAudit) {
    const action = typeof line.action === "string" ? line.action : "";
    if (action.includes("APPROVE") || action.includes("PASS")) {
      approvalCount++;
      totalDecisions++;
    } else if (action.includes("BLOCK") || action.includes("REJECT")) {
      totalDecisions++;
    } else if (action.includes("EDIT") || action.includes("MODIFY")) {
      editCount++;
      totalDecisions++;
    }
  }
  const approvalRate = totalDecisions > 0 ? Math.round((approvalCount / totalDecisions) * 100) : 0;

  // Time saved estimate: ~15 min per approval, ~5 min per triage classification
  const classificationCount = recentAudit.filter((l) =>
    (l.action || "").includes("CLASSIF"),
  ).length;
  const timeSavedMinutes = approvalCount * 15 + classificationCount * 5;
  const timeSavedHours = Math.round((timeSavedMinutes / 60) * 10) / 10;

  // Completed actions in period
  const actionLines = readJsonlLines(gtdActionsPath);
  const actionsCompleted = actionLines.filter(
    (l) =>
      l.kind === "action_complete" &&
      l.completed_at &&
      new Date(l.completed_at).getTime() >= cutoffMs,
  ).length;

  // Commitments in period
  const commitmentLines = readJsonlLines(commitmentsLedgerPath);
  const commitmentsCompleted = commitmentLines.filter(
    (l) =>
      l.kind === "commitment_complete" &&
      l.completed_at &&
      new Date(l.completed_at).getTime() >= cutoffMs,
  ).length;

  // JC-088a: Supplement trust metrics with trust ledger validation history
  let trustValidationsPassed = 0;
  let trustValidationsFailed = 0;
  try {
    const trustLines = readJsonlLines(trustLedgerPath);
    const recentTrust = trustLines.filter(
      (l) =>
        l.kind === "trust_validation" && l.timestamp && new Date(l.timestamp).getTime() >= cutoffMs,
    );
    for (const tl of recentTrust) {
      if (tl.passed) {
        trustValidationsPassed++;
      } else {
        trustValidationsFailed++;
      }
    }
  } catch (err) {
    logLine(`TRUST_LEDGER_READ_ERROR: ${err?.message || String(err)}`);
  }
  const trustValidationTotal = trustValidationsPassed + trustValidationsFailed;
  const trustPassRate =
    trustValidationTotal > 0
      ? Math.round((trustValidationsPassed / trustValidationTotal) * 100)
      : null;

  // JC-110c: Aggregate failure reasons for actionable trust metrics
  const failureReasons = {};
  try {
    const trustLines = readJsonlLines(trustLedgerPath);
    const recentFailures = trustLines.filter(
      (l) =>
        l.kind === "trust_validation" &&
        !l.passed &&
        l.timestamp &&
        new Date(l.timestamp).getTime() >= cutoffMs,
    );
    for (const f of recentFailures) {
      const intent = f.intent || "unknown";
      if (!failureReasons[intent]) {
        failureReasons[intent] = { count: 0, missing_sections: {}, banned_phrases: {} };
      }
      failureReasons[intent].count++;
      if (Array.isArray(f.missing_sections)) {
        for (const s of f.missing_sections) {
          failureReasons[intent].missing_sections[s] =
            (failureReasons[intent].missing_sections[s] || 0) + 1;
        }
      }
      if (Array.isArray(f.banned_phrases_found)) {
        for (const p of f.banned_phrases_found) {
          failureReasons[intent].banned_phrases[p] =
            (failureReasons[intent].banned_phrases[p] || 0) + 1;
        }
      }
    }
  } catch (err) {
    logLine(`TRUST_FAILURE_REASONS_ERROR: ${err?.message || String(err)}`);
  }

  sendJson(res, 200, {
    period,
    lookback_days: lookbackDays,
    approval_rate: approvalRate,
    total_decisions: totalDecisions,
    approvals: approvalCount,
    edits: editCount,
    time_saved_estimate: `${timeSavedHours} hours`,
    time_saved_minutes: timeSavedMinutes,
    actions_completed: actionsCompleted,
    commitments_completed: commitmentsCompleted,
    total_audit_events: recentAudit.length,
    trust_validations: {
      passed: trustValidationsPassed,
      failed: trustValidationsFailed,
      total: trustValidationTotal,
      pass_rate: trustPassRate,
      failure_reasons: failureReasons,
    },
    generated_at: now.toISOString(),
  });
  logLine(`GET ${route} -> 200`);
}

// ─── JC-110e: Graph Sync Ledger Status ───

function graphSyncStatus(profileId, parsedUrl, res, route) {
  const limit = parseInt(parsedUrl.searchParams.get("limit") || "20", 10);
  const lines = readJsonlLines(graphSyncLedgerPath);
  const profileLines = profileId ? lines.filter((l) => l.profile_id === profileId) : lines;
  const recent = profileLines.slice(-Math.min(limit, 100)).toReversed();
  sendJson(res, 200, { profile_id: profileId || "all", entries: recent, count: recent.length });
  logLine(`GET ${route} -> 200`);
}

// ─── Phase 16-21: Planner + To Do + Sync Routes ───

async function listPlannerPlans(profileId, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    return;
  }
  const plannerCfg = getPlannerConfig(profileId);
  if (!plannerCfg || !plannerCfg.group_id) {
    sendJson(res, 400, {
      error: "planner_not_configured",
      detail: "Set planner.group_id in graph.profiles.json",
    });
    return;
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    return;
  }
  const accessToken = tokenResult.accessToken;
  try {
    const url = `https://graph.microsoft.com/v1.0/groups/${encodeURIComponent(plannerCfg.group_id)}/planner/plans`;
    const resp = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    if (resp.status === 401 || resp.status === 403) {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      return;
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const code = data?.error?.code || "planner_plans_failed";
      setGraphLastError(profileId, code);
      sendJson(res, 502, { profile_id: profileId, error: code });
      return;
    }
    const plans = (data.value || []).map((p) => ({
      plan_id: p.id,
      title: p.title,
      entity:
        Object.entries(plannerCfg.plan_ids || {}).find(([, pid]) => pid === p.id)?.[0] || null,
      buckets: [],
      tasks_total: 0,
      tasks_complete: 0,
    }));
    // Enrich each plan with bucket + task counts
    for (const plan of plans) {
      try {
        const bResp = await fetch(
          `https://graph.microsoft.com/v1.0/planner/plans/${encodeURIComponent(plan.plan_id)}/buckets`,
          { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } },
        );
        if (bResp.ok) {
          const bData = await bResp.json();
          plan.buckets = (bData.value || []).map((b) => ({
            id: b.id,
            name: b.name,
            plan_id: b.planId,
            tasks_count: 0,
          }));
        }
        const tResp = await fetch(
          `https://graph.microsoft.com/v1.0/planner/plans/${encodeURIComponent(plan.plan_id)}/tasks?$select=id,percentComplete,bucketId`,
          { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } },
        );
        if (tResp.ok) {
          const tData = await tResp.json();
          const tasks = tData.value || [];
          plan.tasks_total = tasks.length;
          plan.tasks_complete = tasks.filter((t) => t.percentComplete === 100).length;
          for (const b of plan.buckets) {
            b.tasks_count = tasks.filter((t) => t.bucketId === b.id).length;
          }
        }
      } catch (err) {
        logLine(
          `PLANNER_ENRICH_ERROR: ${plan?.plan_id || "unknown"} -- ${err?.message || String(err)}`,
        ); /* non-fatal */
      }
    }
    clearGraphLastError(profileId);
    appendAudit("PLANNER_PLANS_LIST", { profile_id: profileId, plan_count: plans.length });
    appendEvent("planner.plan.discovered", route, {
      profile_id: profileId,
      plans: plans.map((p) => ({ plan_id: p.plan_id, title: p.title })),
    });
    appendJsonlLine(plannerLedgerPath, {
      kind: "plans_listed",
      profile_id: profileId,
      plans: plans.map((p) => p.plan_id),
      at: new Date().toISOString(),
    });
    sendJson(res, 200, { profile_id: profileId, plans, generated_at: new Date().toISOString() });
  } catch {
    setGraphLastError(profileId, "planner_plans_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "planner_plans_network_error" });
  }
}

async function listPlannerTasks(profileId, planId, parsedUrl, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    return;
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    return;
  }
  const accessToken = tokenResult.accessToken;
  const bucketFilter = parsedUrl.searchParams.get("bucket_id") || null;
  try {
    const url = `https://graph.microsoft.com/v1.0/planner/plans/${encodeURIComponent(planId)}/tasks`;
    const resp = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    if (resp.status === 401 || resp.status === 403) {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      return;
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const code = data?.error?.code || "planner_tasks_failed";
      setGraphLastError(profileId, code);
      sendJson(res, 502, { profile_id: profileId, error: code });
      return;
    }
    let tasks = (data.value || []).map((t) => ({
      id: t.id,
      title: t.title,
      plan_id: t.planId,
      bucket_id: t.bucketId,
      bucket_name: null,
      assigned_to: t.assignments ? Object.keys(t.assignments) : [],
      percent_complete: t.percentComplete,
      priority: t.priority,
      due_date: t.dueDateTime || null,
      start_date: t.startDateTime || null,
      etag: t["@odata.etag"] || "",
      entity: profileId,
      deal_id: null,
      created_at: t.createdDateTime || null,
    }));
    if (bucketFilter) {
      tasks = tasks.filter((t) => t.bucket_id === bucketFilter);
    }
    // Store ETags for later PATCH operations
    for (const t of tasks) {
      appendJsonlLine(plannerLedgerPath, {
        kind: "task_etag",
        task_id: t.id,
        etag: t.etag,
        at: new Date().toISOString(),
      });
    }
    clearGraphLastError(profileId);
    appendAudit("PLANNER_TASKS_LIST", {
      profile_id: profileId,
      plan_id: planId,
      task_count: tasks.length,
    });
    appendEvent("planner.task.listed", route, {
      profile_id: profileId,
      plan_id: planId,
      count: tasks.length,
    });
    sendJson(res, 200, {
      profile_id: profileId,
      plan_id: planId,
      bucket_id: bucketFilter,
      tasks,
      total_count: tasks.length,
    });
  } catch {
    setGraphLastError(profileId, "planner_tasks_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "planner_tasks_network_error" });
  }
}

async function listTodoLists(profileId, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    return;
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    return;
  }
  const accessToken = tokenResult.accessToken;
  try {
    const resp = await fetch("https://graph.microsoft.com/v1.0/me/todo/lists", {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    if (resp.status === 401 || resp.status === 403) {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      return;
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const code = data?.error?.code || "todo_lists_failed";
      setGraphLastError(profileId, code);
      sendJson(res, 502, { profile_id: profileId, error: code });
      return;
    }
    const lists = (data.value || []).map((l) => ({
      id: l.id,
      display_name: l.displayName,
      is_owner: l.isOwner ?? true,
      tasks_count: 0,
    }));
    clearGraphLastError(profileId);
    appendAudit("TODO_LISTS", { profile_id: profileId, list_count: lists.length });
    appendEvent("todo.list.discovered", route, { profile_id: profileId, count: lists.length });
    sendJson(res, 200, { profile_id: profileId, lists });
  } catch {
    setGraphLastError(profileId, "todo_lists_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "todo_lists_network_error" });
  }
}

async function listTodoTasks(profileId, listId, _parsedUrl, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    return;
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    return;
  }
  const accessToken = tokenResult.accessToken;
  try {
    const url = new URL(
      `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(listId)}/tasks`,
    );
    url.searchParams.set(
      "$select",
      "id,title,body,status,importance,dueDateTime,createdDateTime,lastModifiedDateTime",
    );
    url.searchParams.set("$top", "100");
    url.searchParams.set("$orderby", "createdDateTime desc");
    const resp = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    if (resp.status === 401 || resp.status === 403) {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      return;
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const code = data?.error?.code || "todo_tasks_failed";
      setGraphLastError(profileId, code);
      sendJson(res, 502, { profile_id: profileId, error: code });
      return;
    }
    const tasks = (data.value || []).map((t) => ({
      id: t.id,
      title: t.title,
      body: t.body?.content || null,
      status: t.status || "notStarted",
      importance: t.importance || "normal",
      due_date: t.dueDateTime?.dateTime || null,
      list_id: listId,
      list_name: null,
      linked_resources: [],
      created_at: t.createdDateTime || null,
      last_modified_at: t.lastModifiedDateTime || null,
    }));
    clearGraphLastError(profileId);
    appendAudit("TODO_TASKS_LIST", { profile_id: profileId, list_id: listId, count: tasks.length });
    appendEvent("todo.task.listed", route, {
      profile_id: profileId,
      list_id: listId,
      count: tasks.length,
    });
    appendJsonlLine(todoLedgerPath, {
      kind: "tasks_listed",
      profile_id: profileId,
      list_id: listId,
      count: tasks.length,
      at: new Date().toISOString(),
    });
    sendJson(res, 200, {
      profile_id: profileId,
      list_id: listId,
      list_name: null,
      tasks,
      total_count: tasks.length,
    });
  } catch {
    setGraphLastError(profileId, "todo_tasks_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "todo_tasks_network_error" });
  }
}

async function _discoverTodoList(profileId, listName) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return null;
  }
  const tokenRecord = getTokenRecord(profileId);
  if (!hasUsableAccessToken(tokenRecord)) {
    return null;
  }
  const accessToken = getTokenAccessToken(tokenRecord);
  try {
    const resp = await fetch("https://graph.microsoft.com/v1.0/me/todo/lists", {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    if (!resp.ok) {
      return null;
    }
    const data = await resp.json();
    const match = (data.value || []).find((l) => l.displayName === listName);
    return match ? match.id : null;
  } catch (err) {
    logLine(`GRAPH_TODO_LIST_DISCOVER_ERROR: ${profileId} -- ${err?.message || String(err)}`);
    return null;
  }
}

async function extractCommitmentsFromEmail(profileId, messageId, _req, res, route) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    setGraphLastError(profileId, cfg.error);
    sendJson(res, cfg.status, { profile_id: profileId, error: cfg.error });
    return;
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    return;
  }
  const accessToken = tokenResult.accessToken;
  try {
    // Fetch email body
    const mailUrl = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}?$select=id,subject,from,body,receivedDateTime`;
    const mailResp = await fetch(mailUrl, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    if (mailResp.status === 401 || mailResp.status === 403) {
      setGraphLastError(profileId, "NOT_AUTHENTICATED");
      sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
      return;
    }
    const mailData = await mailResp.json().catch(() => ({}));
    if (!mailResp.ok) {
      sendJson(res, 502, { error: mailData?.error?.code || "mail_fetch_failed" });
      return;
    }

    const emailBody = mailData.body?.content || "";
    const emailSubject = mailData.subject || "";
    const emailFrom = mailData.from?.emailAddress?.address || "unknown";

    // Strip HTML tags for LLM
    const plainBody = stripHtml(emailBody).replace(/\s+/g, " ").trim().slice(0, 4000);

    const entityContext = profileId;
    const systemPrompt = `You are an executive assistant AI analyzing an email for actionable commitments.
Extract any promises, obligations, deadlines, or action items from this email.
For each commitment found, return a JSON array of objects with these fields:
- who_owes: the person making the commitment (name or email)
- who_to: the person it's owed to (name or email)
- what: brief description of the commitment
- due_date: ISO-8601 date if mentioned, null if not
- confidence: 0.0-1.0 how confident you are this is a real commitment
- source_text: the exact sentence(s) from the email that evidence this commitment

Return ONLY a JSON array. If no commitments found, return [].`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Subject: ${emailSubject}\nFrom: ${emailFrom}\n\n${plainBody}` },
    ];

    const llmResult = await routeLlmCall(messages, entityContext, "commitment_extract");
    let detected = [];
    let extractionSource = "llm";
    let extractionStatus = "ok";

    // JC-110a: Never-dark fallback (Design Law #2) — guard on llmResult.ok
    if (!llmResult.ok) {
      extractionSource = "fallback";
      extractionStatus = "extraction_failed";
      appendEvent("extraction.commitment.blocked", route, {
        profile_id: profileId,
        message_id: messageId,
        reason: llmResult.error || "llm_unavailable",
      });
    } else {
      // Contract validation — aligns commitment_extract with all other LLM synthesis routes
      const validation = validateLlmOutputContract(
        "commitment_extract",
        llmResult.content,
        profileId,
      );
      if (!validation.valid && validation.banned_phrases_found.length > 0) {
        extractionSource = "fallback";
        extractionStatus = "extraction_failed";
        appendEvent("governance.output_contract.blocked", route, {
          intent: "commitment_extract",
          banned_phrases: validation.banned_phrases_found,
        });
      } else {
        try {
          const parsed = JSON.parse(
            llmResult.content.replace(/^```json\s*/, "").replace(/```\s*$/, ""),
          );
          if (Array.isArray(parsed)) {
            detected = parsed
              .filter((c) => c && typeof c.what === "string")
              .map((c) => ({
                who_owes: String(c.who_owes || "unknown"),
                who_to: String(c.who_to || "Clint"),
                what: String(c.what),
                due_date: typeof c.due_date === "string" ? c.due_date : null,
                confidence:
                  typeof c.confidence === "number" ? Math.min(1, Math.max(0, c.confidence)) : 0.5,
                source_text: String(c.source_text || ""),
              }));
          }
          if (detected.length === 0) {
            extractionStatus = "none_found";
          }
        } catch (err) {
          logLine(`COMMITMENT_EXTRACT_PARSE_ERROR: ${err?.message || String(err)}`);
          extractionSource = "fallback";
          extractionStatus = "extraction_failed";
        }
      }
    }

    clearGraphLastError(profileId);
    appendAudit("COMMITMENT_EXTRACT", {
      profile_id: profileId,
      message_id: messageId,
      detected_count: detected.length,
    });
    appendEvent("extraction.commitment.detected", route, {
      profile_id: profileId,
      message_id: messageId,
      count: detected.length,
    });
    sendJson(res, 200, {
      profile_id: profileId,
      source_email_id: messageId,
      source_subject: emailSubject,
      detected,
      extraction_source: extractionSource,
      extraction_status: extractionStatus,
      generated_at: new Date().toISOString(),
    });
  } catch {
    setGraphLastError(profileId, "commitment_extract_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "commitment_extract_network_error" });
  }
}

async function createPlannerTask(
  profileId,
  { planId, bucketId, title, assignmentUserIds, dueDateTime, priority },
) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return { ok: false, error: cfg.error };
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }
  const accessToken = tokenResult.accessToken;
  const body = { planId, title };
  if (bucketId) {
    body.bucketId = bucketId;
  }
  if (dueDateTime) {
    body.dueDateTime = dueDateTime;
  }
  if (typeof priority === "number") {
    body.priority = priority;
  }
  if (Array.isArray(assignmentUserIds) && assignmentUserIds.length > 0) {
    body.assignments = {};
    for (const uid of assignmentUserIds) {
      body.assignments[uid] = {
        "@odata.type": "#microsoft.graph.plannerAssignment",
        orderHint: " !",
      };
    }
  }
  try {
    const resp = await fetch("https://graph.microsoft.com/v1.0/planner/tasks", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: data?.error?.code || "planner_task_create_failed" };
    }
    appendEvent(
      "planner.task.created",
      "createPlannerTask",
      normalizePlannerTaskEvent(data, "created"),
    );
    appendJsonlLine(plannerLedgerPath, {
      kind: "task_created",
      task_id: data.id,
      plan_id: planId,
      title,
      at: new Date().toISOString(),
    });
    return { ok: true, task_id: data.id, etag: data["@odata.etag"] || "" };
  } catch {
    return { ok: false, error: "planner_task_create_network_error" };
  }
}

async function updatePlannerTask(profileId, taskId, etag, updates) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return { ok: false, error: cfg.error };
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }
  const accessToken = tokenResult.accessToken;
  try {
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/planner/tasks/${encodeURIComponent(taskId)}`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          accept: "application/json",
          "if-match": etag,
        },
        body: JSON.stringify(updates),
      },
    );
    if (resp.status === 412 || resp.status === 409) {
      appendEvent("sync.conflict.detected", "updatePlannerTask", { task_id: taskId, etag });
      return { ok: false, error: "etag_conflict", detail: "Re-read task and retry" };
    }
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { ok: false, error: data?.error?.code || "planner_task_update_failed" };
    }
    appendEvent("planner.task.updated", "updatePlannerTask", { task_id: taskId });
    appendJsonlLine(plannerLedgerPath, {
      kind: "task_updated",
      task_id: taskId,
      updates,
      at: new Date().toISOString(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "planner_task_update_network_error" };
  }
}

async function _createPlannerBucket(profileId, planId, name) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return { ok: false, error: cfg.error };
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }
  const accessToken = tokenResult.accessToken;
  try {
    const resp = await fetch("https://graph.microsoft.com/v1.0/planner/buckets", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ planId, name, orderHint: " !" }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: data?.error?.code || "planner_bucket_create_failed" };
    }
    appendEvent("planner.bucket.discovered", "createPlannerBucket", {
      bucket_id: data.id,
      plan_id: planId,
      name,
    });
    return { ok: true, bucket_id: data.id };
  } catch {
    return { ok: false, error: "planner_bucket_create_network_error" };
  }
}

async function createTodoTask(profileId, listId, { title, body, dueDateTime, importance }) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return { ok: false, error: cfg.error };
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }
  const accessToken = tokenResult.accessToken;
  const reqBody = { title };
  if (body) {
    reqBody.body = { content: body, contentType: "text" };
  }
  if (dueDateTime) {
    reqBody.dueDateTime = { dateTime: dueDateTime, timeZone: "UTC" };
  }
  if (importance) {
    reqBody.importance = importance;
  }
  try {
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(listId)}/tasks`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(reqBody),
      },
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: data?.error?.code || "todo_task_create_failed" };
    }
    appendEvent("todo.task.created", "createTodoTask", normalizeTodoTaskEvent(data, "created"));
    appendJsonlLine(todoLedgerPath, {
      kind: "task_created",
      task_id: data.id,
      list_id: listId,
      title,
      at: new Date().toISOString(),
    });
    return { ok: true, task_id: data.id };
  } catch {
    return { ok: false, error: "todo_task_create_network_error" };
  }
}

async function updateTodoTask(profileId, listId, taskId, updates) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return { ok: false, error: cfg.error };
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }
  const accessToken = tokenResult.accessToken;
  try {
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(updates),
      },
    );
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { ok: false, error: data?.error?.code || "todo_task_update_failed" };
    }
    appendEvent("todo.task.updated", "updateTodoTask", { task_id: taskId, list_id: listId });
    return { ok: true };
  } catch {
    return { ok: false, error: "todo_task_update_network_error" };
  }
}

async function addTodoLinkedResource(
  profileId,
  listId,
  taskId,
  { webUrl, displayName, externalId },
) {
  const cfg = getGraphProfileConfig(profileId);
  if (!cfg.ok) {
    return { ok: false, error: cfg.error };
  }
  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }
  const accessToken = tokenResult.accessToken;
  try {
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}/linkedResources`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ webUrl, applicationName: "TED OpenClaw", displayName, externalId }),
      },
    );
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { ok: false, error: data?.error?.code || "todo_linked_resource_failed" };
    }
    appendEvent("todo.linked_resource.created", "addTodoLinkedResource", {
      task_id: taskId,
      external_id: externalId,
    });
    return { ok: true };
  } catch (err) {
    logLine(`GRAPH_TODO_LINK_ERROR: ${err?.message || String(err)}`);
    return { ok: false, error: "todo_linked_resource_network_error" };
  }
}

async function reconcile(profileId, _parsedUrl, res, route) {
  appendEvent("sync.reconciliation.started", route, { profile_id: profileId });

  // Read local ledgers
  const commitmentLines = readJsonlLines(commitmentsLedgerPath);
  const commitmentMap = new Map();
  for (const line of commitmentLines) {
    if (line.kind === "commitment_create") {
      commitmentMap.set(line.id, { ...line });
    } else if (line.kind === "commitment_complete" && commitmentMap.has(line.id)) {
      commitmentMap.get(line.id).status = "completed";
    } else if (line.kind === "commitment_update" && commitmentMap.has(line.id)) {
      Object.assign(commitmentMap.get(line.id), line);
    } else if (line.kind === "commitment_escalate" && commitmentMap.has(line.id)) {
      commitmentMap.get(line.id).status = "escalated";
    }
  }
  const localCommitments = [...commitmentMap.values()].filter(
    (c) => c.entity === profileId && c.status !== "completed",
  );

  const actionLines = readJsonlLines(gtdActionsPath);
  const actionMap = new Map();
  for (const line of actionLines) {
    if (line.kind === "action_create") {
      actionMap.set(line.id, { ...line });
    } else if (line.kind === "action_complete" && actionMap.has(line.id)) {
      actionMap.get(line.id).status = "completed";
    }
  }
  const localActions = [...actionMap.values()].filter(
    (a) => a.entity === profileId && a.status === "active",
  );

  // Read remote state
  const plannerCfg = getPlannerConfig(profileId);
  const todoCfg = getTodoConfig(profileId);
  let remotePlannerTasks = [];
  let remoteTodoTasks = [];
  let plannerFetchOk = false;
  let todoFetchOk = false;

  const cfg = getGraphProfileConfig(profileId);
  if (cfg.ok) {
    // H-5: Use ensureValidToken to proactively refresh before Graph API calls
    const tokenResult = await ensureValidToken(profileId);
    const accessToken = tokenResult.ok ? tokenResult.accessToken : null;
    if (accessToken) {
      // Planner tasks
      if (plannerCfg?.plan_ids?.[profileId]) {
        try {
          const pResp = await fetch(
            `https://graph.microsoft.com/v1.0/planner/plans/${encodeURIComponent(plannerCfg.plan_ids[profileId])}/tasks`,
            {
              headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
            },
          );
          if (pResp.ok) {
            const pData = await pResp.json();
            remotePlannerTasks = pData.value || [];
            plannerFetchOk = true;
          } else {
            appendEvent("sync.reconciliation.service_failed", route, {
              service: "planner",
              status: pResp.status,
            });
          }
        } catch (err) {
          appendEvent("sync.reconciliation.service_failed", route, {
            service: "planner",
            error: String(err),
          });
        }
      }
      // To Do tasks
      if (todoCfg?.list_id) {
        try {
          const tResp = await fetch(
            `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(todoCfg.list_id)}/tasks?$top=200`,
            {
              headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
            },
          );
          if (tResp.ok) {
            const tData = await tResp.json();
            remoteTodoTasks = tData.value || [];
            todoFetchOk = true;
          } else {
            appendEvent("sync.reconciliation.service_failed", route, {
              service: "todo",
              status: tResp.status,
            });
          }
        } catch (err) {
          appendEvent("sync.reconciliation.service_failed", route, {
            service: "todo",
            error: String(err),
          });
        }
      }
    }
  }

  // MF-7: Build dedup set from existing pending proposals
  const existingProposalLines = readJsonlLines(syncLedgerPath);
  const existingProposalSet = new Set();
  const proposalStateMap = new Map();
  for (const line of existingProposalLines) {
    if (line.kind === "proposal_created") {
      proposalStateMap.set(line.proposal_id, "pending");
      existingProposalSet.add(`${line.local_id}:${line.target_system}`);
    } else if (line.kind === "proposal_approved") {
      proposalStateMap.set(line.proposal_id, "approved");
    } else if (line.kind === "proposal_rejected") {
      proposalStateMap.set(line.proposal_id, "rejected");
    } else if (line.kind === "proposal_executed") {
      proposalStateMap.set(line.proposal_id, "executed");
    }
  }
  // Remove completed/rejected from dedup set (allow re-proposals for those)
  for (const [pid, status] of proposalStateMap) {
    if (status === "rejected" || status === "executed") {
      // Find the local_id:target for this proposal and remove from set
      for (const line of existingProposalLines) {
        if (line.kind === "proposal_created" && line.proposal_id === pid) {
          existingProposalSet.delete(`${line.local_id}:${line.target_system}`);
          break;
        }
      }
    }
  }
  let dedupSkipped = 0;
  const failedServices = [];

  // Compare: commitments vs Planner tasks
  const driftItems = [];
  const proposedWrites = [];

  if (plannerFetchOk) {
    for (const commit of localCommitments) {
      const match = remotePlannerTasks.find(
        (t) => t.title && t.title.toLowerCase().includes(commit.what.toLowerCase().slice(0, 30)),
      );
      if (!match) {
        const dedupKey = `${commit.id}:planner`;
        if (existingProposalSet.has(dedupKey)) {
          dedupSkipped++;
          continue;
        }
        const proposalId = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        driftItems.push({
          source: "ted_commitments",
          target: "planner",
          local_id: commit.id,
          remote_id: null,
          field: "existence",
          local_value: commit.what,
          remote_value: null,
          recommendation: "Create Planner task",
        });
        proposedWrites.push({
          proposal_id: proposalId,
          target_system: "planner",
          action: "create",
          entity: profileId,
          local_id: commit.id,
          title: commit.what,
          payload: { title: commit.what, who_owes: commit.who_owes, due_date: commit.due_date },
          status: "pending",
          created_at: new Date().toISOString(),
          resolved_at: null,
        });
      }
    }
  } else {
    failedServices.push("planner");
    driftItems.push({
      source: "planner",
      target: "ted_commitments",
      local_id: null,
      remote_id: null,
      field: "service_status",
      local_value: null,
      remote_value: null,
      recommendation: "Planner API fetch failed — skipping comparison",
    });
  }

  // Compare: GTD actions vs To Do tasks
  if (todoFetchOk) {
    for (const action of localActions) {
      const match = remoteTodoTasks.find(
        (t) =>
          t.title && t.title.toLowerCase().includes(action.description.toLowerCase().slice(0, 30)),
      );
      if (!match) {
        const dedupKey = `${action.id}:todo`;
        if (existingProposalSet.has(dedupKey)) {
          dedupSkipped++;
          continue;
        }
        const proposalId = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        driftItems.push({
          source: "ted_gtd_actions",
          target: "todo",
          local_id: action.id,
          remote_id: null,
          field: "existence",
          local_value: action.description,
          remote_value: null,
          recommendation: "Create To Do task",
        });
        proposedWrites.push({
          proposal_id: proposalId,
          target_system: "todo",
          action: "create",
          entity: profileId,
          local_id: action.id,
          title: action.description,
          payload: {
            title: action.description,
            context: action.context,
            due_date: action.due_date,
            energy: action.energy,
          },
          status: "pending",
          created_at: new Date().toISOString(),
          resolved_at: null,
        });
      }
    }
  } else {
    failedServices.push("todo");
    driftItems.push({
      source: "todo",
      target: "ted_gtd_actions",
      local_id: null,
      remote_id: null,
      field: "service_status",
      local_value: null,
      remote_value: null,
      recommendation: "To Do API fetch failed — skipping comparison",
    });
  }

  // Check for items in remote not in local (orphans)
  if (plannerFetchOk) {
    for (const pt of remotePlannerTasks) {
      if (pt.percentComplete === 100) {
        continue;
      }
      const matchLocal = localCommitments.find(
        (c) => pt.title && pt.title.toLowerCase().includes(c.what.toLowerCase().slice(0, 30)),
      );
      if (!matchLocal) {
        driftItems.push({
          source: "planner",
          target: "ted_commitments",
          local_id: null,
          remote_id: pt.id,
          field: "existence",
          local_value: null,
          remote_value: pt.title,
          recommendation: "Planner task has no matching TED commitment",
        });
      }
    }
  }

  // Save proposals to ledger
  for (const p of proposedWrites) {
    appendJsonlLine(syncLedgerPath, { kind: "proposal_created", ...p });
    appendEvent("sync.write.proposed", route, {
      proposal_id: p.proposal_id,
      target: p.target_system,
      action: p.action,
      title: p.title,
    });
  }

  const reconciliationStatus = failedServices.length > 0 ? "partial" : "complete";
  appendEvent("sync.reconciliation.completed", route, {
    profile_id: profileId,
    status: reconciliationStatus,
    failed_services: failedServices,
    drift_count: driftItems.length,
    proposal_count: proposedWrites.length,
    dedup_skipped: dedupSkipped,
  });
  appendAudit("SYNC_RECONCILIATION", {
    profile_id: profileId,
    drift_count: driftItems.length,
    proposal_count: proposedWrites.length,
  });

  sendJson(res, 200, {
    profile_id: profileId,
    status: reconciliationStatus,
    failed_services: failedServices,
    drift_items: driftItems,
    proposed_writes: proposedWrites,
    dedup_skipped: dedupSkipped,
    local_counts: {
      commitments: localCommitments.length,
      gtd_actions: localActions.length,
      deal_tasks: 0,
    },
    remote_counts: { planner_tasks: remotePlannerTasks.length, todo_tasks: remoteTodoTasks.length },
    generated_at: new Date().toISOString(),
  });
}

function syncListProposals(profileId, parsedUrl, res, _route) {
  const statusFilter = parsedUrl.searchParams.get("status") || null;
  const lines = readJsonlLines(syncLedgerPath);
  const proposalMap = new Map();
  for (const line of lines) {
    if (line.kind === "proposal_created") {
      proposalMap.set(line.proposal_id, { ...line });
    } else if (line.kind === "proposal_approved" && proposalMap.has(line.proposal_id)) {
      proposalMap.get(line.proposal_id).status = "approved";
      proposalMap.get(line.proposal_id).resolved_at = line.at;
    } else if (line.kind === "proposal_executed" && proposalMap.has(line.proposal_id)) {
      proposalMap.get(line.proposal_id).status = "executed";
      proposalMap.get(line.proposal_id).resolved_at = line.at;
    } else if (line.kind === "proposal_rejected" && proposalMap.has(line.proposal_id)) {
      proposalMap.get(line.proposal_id).status = "rejected";
      proposalMap.get(line.proposal_id).resolved_at = line.at;
    } else if (line.kind === "proposal_conflict" && proposalMap.has(line.proposal_id)) {
      proposalMap.get(line.proposal_id).status = "conflict";
    }
  }
  let proposals = [...proposalMap.values()].filter((p) => p.entity === profileId);
  if (statusFilter) {
    proposals = proposals.filter((p) => p.status === statusFilter);
  }
  proposals.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  sendJson(res, 200, { profile_id: profileId, proposals, total_count: proposals.length });
}

async function syncApprove(profileId, proposalId, req, res, route) {
  const lines = readJsonlLines(syncLedgerPath);
  const proposal = lines
    .filter((l) => l.proposal_id === proposalId)
    .reduce((acc, l) => {
      if (l.kind === "proposal_created") {
        return { ...l };
      }
      if (acc && l.kind === "proposal_approved") {
        return { ...acc, status: "approved" };
      }
      if (acc && l.kind === "proposal_rejected") {
        return { ...acc, status: "rejected" };
      }
      if (acc && l.kind === "proposal_executed") {
        return { ...acc, status: "executed" };
      }
      return acc;
    }, null);
  if (!proposal) {
    sendJson(res, 404, { error: "proposal_not_found" });
    return;
  }
  if (proposal.status !== "pending") {
    sendJson(res, 400, { error: "proposal_not_pending", current_status: proposal.status });
    return;
  }

  // MF-8: Require operator approval source
  const approvalSource = req.headers["x-ted-approval-source"];
  if (approvalSource !== "operator") {
    sendJson(res, 403, {
      error: "OPERATOR_APPROVAL_REQUIRED",
      message: "This action requires operator confirmation via the Ted Workbench UI.",
    });
    appendEvent("governance.operator_required.blocked", route, {
      action: "sync_approve",
      approval_source: approvalSource || "none",
    });
    logLine(`POST ${route} -> 403 OPERATOR_APPROVAL_REQUIRED`);
    return;
  }

  appendJsonlLine(syncLedgerPath, {
    kind: "proposal_approved",
    proposal_id: proposalId,
    at: new Date().toISOString(),
  });
  appendEvent("sync.write.approved", route, {
    proposal_id: proposalId,
    target: proposal.target_system,
    action: proposal.action,
  });
  appendAudit("SYNC_APPROVE", { proposal_id: proposalId, target: proposal.target_system });

  // Execute the write
  let result;
  if (proposal.target_system === "planner") {
    const plannerCfg = getPlannerConfig(profileId);
    const planId = plannerCfg?.plan_ids?.[profileId] || "";
    if (proposal.action === "create") {
      const userMapping = getUserMapping(profileId);
      const assignee = proposal.payload?.who_owes ? userMapping[proposal.payload.who_owes] : null;
      const assignmentUserIds = [];
      if (assignee) {
        const uid = await resolveUpnToUserId(profileId, assignee);
        if (uid) {
          assignmentUserIds.push(uid);
        }
      }
      result = await createPlannerTask(profileId, {
        planId,
        bucketId: null,
        title: proposal.title,
        assignmentUserIds,
        dueDateTime: proposal.payload?.due_date || null,
        priority: 5,
      });
    } else if (proposal.action === "update") {
      const latestEtag =
        lines
          .filter((l) => l.kind === "task_etag" && l.task_id === proposal.payload?.remote_task_id)
          .pop()?.etag || "";
      result = await updatePlannerTask(
        profileId,
        proposal.payload?.remote_task_id,
        latestEtag,
        proposal.payload?.updates || {},
      );
    } else if (proposal.action === "complete") {
      const latestEtag =
        lines
          .filter((l) => l.kind === "task_etag" && l.task_id === proposal.payload?.remote_task_id)
          .pop()?.etag || "";
      result = await updatePlannerTask(profileId, proposal.payload?.remote_task_id, latestEtag, {
        percentComplete: 100,
      });
    }
  } else if (proposal.target_system === "todo") {
    const todoCfg = getTodoConfig(profileId);
    const listId = todoCfg?.list_id || "";
    if (proposal.action === "create") {
      result = await createTodoTask(profileId, listId, {
        title: proposal.title,
        body: proposal.payload?.context || null,
        dueDateTime: proposal.payload?.due_date || null,
        importance: "normal",
      });
      // Add linked resource backlink
      if (result?.ok && result.task_id) {
        await addTodoLinkedResource(profileId, listId, result.task_id, {
          webUrl: `ted://action/${proposal.local_id}`,
          displayName: proposal.title,
          externalId: proposal.local_id,
        });
      }
    } else if (proposal.action === "update") {
      result = await updateTodoTask(
        profileId,
        todoCfg?.list_id || "",
        proposal.payload?.remote_task_id,
        proposal.payload?.updates || {},
      );
    } else if (proposal.action === "complete") {
      result = await updateTodoTask(
        profileId,
        todoCfg?.list_id || "",
        proposal.payload?.remote_task_id,
        { status: "completed" },
      );
    }
  }

  if (result?.ok) {
    appendJsonlLine(syncLedgerPath, {
      kind: "proposal_executed",
      proposal_id: proposalId,
      at: new Date().toISOString(),
    });
    appendEvent("sync.write.executed", route, {
      proposal_id: proposalId,
      target: proposal.target_system,
    });
    sendJson(res, 200, { approved: true, executed: true, proposal_id: proposalId, result });
  } else if (result?.error === "etag_conflict") {
    appendJsonlLine(syncLedgerPath, {
      kind: "proposal_conflict",
      proposal_id: proposalId,
      at: new Date().toISOString(),
    });
    sendJson(res, 409, {
      approved: true,
      executed: false,
      error: "etag_conflict",
      detail: "Re-run reconciliation to get fresh ETags",
    });
  } else {
    sendJson(res, 502, {
      approved: true,
      executed: false,
      error: result?.error || "sync_write_failed",
    });
  }
}

async function syncReject(_profileId, proposalId, req, res, route) {
  const lines = readJsonlLines(syncLedgerPath);
  const exists = lines.some((l) => l.proposal_id === proposalId && l.kind === "proposal_created");
  if (!exists) {
    sendJson(res, 404, { error: "proposal_not_found" });
    return;
  }
  // M-3: Require operator approval source for reject (governance parity with approve)
  const approvalSource = req.headers["x-ted-approval-source"];
  if (approvalSource !== "operator") {
    sendJson(res, 403, {
      error: "OPERATOR_APPROVAL_REQUIRED",
      message: "Sync proposal rejection requires operator confirmation via the Ted Workbench UI.",
    });
    appendEvent("governance.operator_required.blocked", route, {
      action: "sync_reject",
      approval_source: approvalSource || "none",
    });
    logLine(`POST ${route} -> 403 OPERATOR_APPROVAL_REQUIRED`);
    return;
  }
  appendJsonlLine(syncLedgerPath, {
    kind: "proposal_rejected",
    proposal_id: proposalId,
    at: new Date().toISOString(),
  });
  appendEvent("sync.write.rejected", route, { proposal_id: proposalId });
  appendAudit("SYNC_REJECT", { proposal_id: proposalId });
  sendJson(res, 200, { rejected: true, proposal_id: proposalId });
}

// ─── SharePoint Integration ───

function normalizeSharePointItem(item) {
  return {
    id: item.id || "",
    name: item.name || "",
    size: item.size || 0,
    lastModifiedDateTime: item.lastModifiedDateTime || "",
    webUrl: item.webUrl || "",
    isFolder: !!item.folder,
    mimeType: item.file?.mimeType || null,
    createdBy: item.createdBy?.user?.displayName || null,
    lastModifiedBy: item.lastModifiedBy?.user?.displayName || null,
    parentPath: item.parentReference?.path || null,
  };
}

async function sharePointListSites(profileId, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const modeCheck = requestedExecutionMode({ headers: {} });
  const boundaryCheck = checkExecutionBoundary(routeKey, modeCheck.mode);
  if (!boundaryCheck.ok) {
    sendJson(res, boundaryCheck.status_code, boundaryCheck.payload);
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    sendJson(res, 401, { error: "auth_required", message: "No valid token for profile" });
    return;
  }

  try {
    const resp = await graphFetchWithRetry(
      "https://graph.microsoft.com/v1.0/sites?search=*&$select=id,displayName,webUrl,name&$top=50",
      {
        headers: { authorization: `Bearer ${tokenResult.accessToken}`, accept: "application/json" },
      },
      { maxRetries: 2, label: "sharepoint_list_sites" },
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      sendJson(res, resp.status, {
        error: "graph_error",
        message: `Graph API returned ${resp.status}`,
        detail: errBody,
      });
      return;
    }
    const data = await resp.json();
    const sites = (data.value || []).map((s) => ({
      id: s.id || "",
      displayName: s.displayName || "",
      webUrl: s.webUrl || "",
      name: s.name || "",
    }));
    appendEvent("sharepoint.sites.listed", route, { profile_id: profileId, count: sites.length });
    appendAudit("SHAREPOINT_SITES_LIST", { profile_id: profileId, count: sites.length });
    sendJson(res, 200, { profile_id: profileId, sites, generated_at: new Date().toISOString() });
  } catch (err) {
    logLine(`SHAREPOINT_SITES_ERROR: ${err?.message || String(err)}`);
    sendJson(res, 502, { error: "graph_fetch_failed", message: err?.message || String(err) });
  }
}

async function sharePointListDrives(profileId, siteId, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const modeCheck = requestedExecutionMode({ headers: {} });
  const boundaryCheck = checkExecutionBoundary(routeKey, modeCheck.mode);
  if (!boundaryCheck.ok) {
    sendJson(res, boundaryCheck.status_code, boundaryCheck.payload);
    return;
  }

  if (!isSlugSafe(siteId)) {
    sendJson(res, 400, {
      error: "invalid_site_id",
      message: "site_id contains invalid characters",
    });
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    sendJson(res, 401, { error: "auth_required", message: "No valid token for profile" });
    return;
  }

  try {
    const resp = await graphFetchWithRetry(
      `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,driveType,webUrl,description`,
      {
        headers: { authorization: `Bearer ${tokenResult.accessToken}`, accept: "application/json" },
      },
      { maxRetries: 2, label: "sharepoint_list_drives" },
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      sendJson(res, resp.status, {
        error: "graph_error",
        message: `Graph API returned ${resp.status}`,
        detail: errBody,
      });
      return;
    }
    const data = await resp.json();
    const drives = (data.value || []).map((d) => ({
      id: d.id || "",
      name: d.name || "",
      driveType: d.driveType || "",
      webUrl: d.webUrl || "",
      description: d.description || null,
    }));
    appendEvent("sharepoint.drives.listed", route, {
      profile_id: profileId,
      site_id: siteId,
      count: drives.length,
    });
    appendAudit("SHAREPOINT_DRIVES_LIST", {
      profile_id: profileId,
      site_id: siteId,
      count: drives.length,
    });
    sendJson(res, 200, {
      profile_id: profileId,
      site_id: siteId,
      drives,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    logLine(`SHAREPOINT_DRIVES_ERROR: ${err?.message || String(err)}`);
    sendJson(res, 502, { error: "graph_fetch_failed", message: err?.message || String(err) });
  }
}

async function sharePointListItems(profileId, driveId, parsedUrl, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const modeCheck = requestedExecutionMode({ headers: {} });
  const boundaryCheck = checkExecutionBoundary(routeKey, modeCheck.mode);
  if (!boundaryCheck.ok) {
    sendJson(res, boundaryCheck.status_code, boundaryCheck.payload);
    return;
  }

  if (!isSlugSafe(driveId)) {
    sendJson(res, 400, {
      error: "invalid_drive_id",
      message: "drive_id contains invalid characters",
    });
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    sendJson(res, 401, { error: "auth_required", message: "No valid token for profile" });
    return;
  }

  const itemId = parsedUrl.searchParams.get("item_id") || "";
  const folderPath = parsedUrl.searchParams.get("path") || "";

  let graphUrl;
  if (itemId) {
    graphUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children?$select=id,name,size,lastModifiedDateTime,webUrl,folder,file,createdBy,lastModifiedBy,parentReference&$top=200`;
  } else if (folderPath) {
    graphUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodeURIComponent(folderPath)}:/children?$select=id,name,size,lastModifiedDateTime,webUrl,folder,file,createdBy,lastModifiedBy,parentReference&$top=200`;
  } else {
    graphUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root/children?$select=id,name,size,lastModifiedDateTime,webUrl,folder,file,createdBy,lastModifiedBy,parentReference&$top=200`;
  }

  try {
    const resp = await graphFetchWithRetry(
      graphUrl,
      {
        headers: { authorization: `Bearer ${tokenResult.accessToken}`, accept: "application/json" },
      },
      { maxRetries: 2, label: "sharepoint_list_items" },
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      sendJson(res, resp.status, {
        error: "graph_error",
        message: `Graph API returned ${resp.status}`,
        detail: errBody,
      });
      return;
    }
    const data = await resp.json();
    const items = (data.value || []).map(normalizeSharePointItem);
    const displayPath = folderPath || (itemId ? `item:${itemId}` : "/");
    appendEvent("sharepoint.items.listed", route, {
      profile_id: profileId,
      drive_id: driveId,
      path: displayPath,
      count: items.length,
    });
    appendAudit("SHAREPOINT_ITEMS_LIST", {
      profile_id: profileId,
      drive_id: driveId,
      path: displayPath,
      count: items.length,
    });
    sendJson(res, 200, {
      profile_id: profileId,
      drive_id: driveId,
      path: displayPath,
      items,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    logLine(`SHAREPOINT_ITEMS_ERROR: ${err?.message || String(err)}`);
    sendJson(res, 502, { error: "graph_fetch_failed", message: err?.message || String(err) });
  }
}

async function sharePointGetItem(profileId, driveId, itemId, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const modeCheck = requestedExecutionMode({ headers: {} });
  const boundaryCheck = checkExecutionBoundary(routeKey, modeCheck.mode);
  if (!boundaryCheck.ok) {
    sendJson(res, boundaryCheck.status_code, boundaryCheck.payload);
    return;
  }

  if (!isSlugSafe(driveId) || !isSlugSafe(itemId)) {
    sendJson(res, 400, {
      error: "invalid_id",
      message: "drive_id or item_id contains invalid characters",
    });
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    sendJson(res, 401, { error: "auth_required", message: "No valid token for profile" });
    return;
  }

  try {
    const resp = await graphFetchWithRetry(
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,size,lastModifiedDateTime,webUrl,folder,file,createdBy,lastModifiedBy,parentReference`,
      {
        headers: { authorization: `Bearer ${tokenResult.accessToken}`, accept: "application/json" },
      },
      { maxRetries: 2, label: "sharepoint_get_item" },
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      sendJson(res, resp.status, {
        error: "graph_error",
        message: `Graph API returned ${resp.status}`,
        detail: errBody,
      });
      return;
    }
    const data = await resp.json();
    const item = normalizeSharePointItem(data);
    appendEvent("sharepoint.item.metadata", route, {
      profile_id: profileId,
      drive_id: driveId,
      item_id: itemId,
    });
    appendAudit("SHAREPOINT_ITEM_GET", {
      profile_id: profileId,
      drive_id: driveId,
      item_id: itemId,
      name: item.name,
    });
    sendJson(res, 200, {
      profile_id: profileId,
      drive_id: driveId,
      item,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    logLine(`SHAREPOINT_ITEM_ERROR: ${err?.message || String(err)}`);
    sendJson(res, 502, { error: "graph_fetch_failed", message: err?.message || String(err) });
  }
}

async function sharePointSearch(profileId, driveId, parsedUrl, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const modeCheck = requestedExecutionMode({ headers: {} });
  const boundaryCheck = checkExecutionBoundary(routeKey, modeCheck.mode);
  if (!boundaryCheck.ok) {
    sendJson(res, boundaryCheck.status_code, boundaryCheck.payload);
    return;
  }

  if (!isSlugSafe(driveId)) {
    sendJson(res, 400, {
      error: "invalid_drive_id",
      message: "drive_id contains invalid characters",
    });
    return;
  }

  const query = (parsedUrl.searchParams.get("q") || "").trim();
  if (!query) {
    sendJson(res, 400, { error: "missing_query", message: "q query parameter is required" });
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    sendJson(res, 401, { error: "auth_required", message: "No valid token for profile" });
    return;
  }

  try {
    const resp = await graphFetchWithRetry(
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root/search(q='${encodeURIComponent(query)}')?$select=id,name,size,lastModifiedDateTime,webUrl,folder,file,createdBy,lastModifiedBy,parentReference&$top=50`,
      {
        headers: { authorization: `Bearer ${tokenResult.accessToken}`, accept: "application/json" },
      },
      { maxRetries: 2, label: "sharepoint_search" },
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      sendJson(res, resp.status, {
        error: "graph_error",
        message: `Graph API returned ${resp.status}`,
        detail: errBody,
      });
      return;
    }
    const data = await resp.json();
    const results = (data.value || []).map(normalizeSharePointItem);
    appendEvent("sharepoint.search.executed", route, {
      profile_id: profileId,
      drive_id: driveId,
      query,
      count: results.length,
    });
    appendAudit("SHAREPOINT_SEARCH", {
      profile_id: profileId,
      drive_id: driveId,
      query,
      count: results.length,
    });
    sendJson(res, 200, {
      profile_id: profileId,
      drive_id: driveId,
      query,
      results,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    logLine(`SHAREPOINT_SEARCH_ERROR: ${err?.message || String(err)}`);
    sendJson(res, 502, { error: "graph_fetch_failed", message: err?.message || String(err) });
  }
}

async function sharePointUpload(profileId, driveId, req, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const modeCheck = requestedExecutionMode(req);
  const boundaryCheck = checkExecutionBoundary(routeKey, modeCheck.mode);
  if (!boundaryCheck.ok) {
    sendJson(res, boundaryCheck.status_code, boundaryCheck.payload);
    return;
  }

  // Operator approval guard
  const approvalSource = req.headers["x-ted-approval-source"];
  if (approvalSource !== "operator") {
    sendJson(
      res,
      403,
      blockedExplainability(
        "OPERATOR_APPROVAL_REQUIRED",
        "sharepoint_upload",
        "SharePoint file upload requires operator approval via the Ted Workbench UI.",
      ),
    );
    return;
  }

  // C12-009: DATA ROOM QUARANTINE GATE (future)
  // When file content reading is implemented, add PHI scanning here:
  // 1. Route content through redactPhiFromMessages() at minimum
  // 2. For healthcare documents (census, staffing, incident reports),
  //    evaluate clinical NER service (AWS Comprehend Medical / Azure Health Text Analytics)
  // 3. Block upload if PHI detected and entity requires HIPAA clearance
  // See: 51_COUNCIL_EXTERNAL_PANEL_REVIEW_CYCLE_012.md, finding C12-009

  if (!isSlugSafe(driveId)) {
    sendJson(res, 400, {
      error: "invalid_drive_id",
      message: "drive_id contains invalid characters",
    });
    return;
  }

  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }

  const filePath = typeof body.path === "string" ? body.path.trim() : "";
  const fileName = typeof body.file_name === "string" ? body.file_name.trim() : "";
  const contentBase64 = typeof body.content_base64 === "string" ? body.content_base64 : "";
  const contentType =
    typeof body.content_type === "string" ? body.content_type.trim() : "application/octet-stream";

  if (!filePath && !fileName) {
    sendJson(res, 400, { error: "missing_path", message: "path or file_name is required" });
    return;
  }
  if (!contentBase64) {
    sendJson(res, 400, { error: "missing_content", message: "content_base64 is required" });
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    sendJson(res, 401, { error: "auth_required", message: "No valid token for profile" });
    return;
  }

  const uploadPath = filePath ? `${filePath}/${fileName || "upload"}` : fileName;

  try {
    const fileBuffer = Buffer.from(contentBase64, "base64");
    const resp = await graphFetchWithRetry(
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodeURIComponent(uploadPath)}:/content`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${tokenResult.accessToken}`,
          "content-type": contentType,
          "content-length": String(fileBuffer.length),
        },
        body: fileBuffer,
      },
      { maxRetries: 1, label: "sharepoint_upload" },
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      sendJson(res, resp.status, {
        error: "graph_upload_error",
        message: `Graph API returned ${resp.status}`,
        detail: errBody,
      });
      return;
    }
    const data = await resp.json();
    const item = normalizeSharePointItem(data);
    appendEvent("sharepoint.file.uploaded", route, {
      profile_id: profileId,
      drive_id: driveId,
      path: uploadPath,
      item_id: item.id,
    });
    appendAudit("SHAREPOINT_UPLOAD", {
      profile_id: profileId,
      drive_id: driveId,
      path: uploadPath,
      item_id: item.id,
      size: fileBuffer.length,
    });
    sendJson(res, 200, {
      ok: true,
      item,
      message: `Uploaded ${uploadPath} (${fileBuffer.length} bytes)`,
    });
  } catch (err) {
    logLine(`SHAREPOINT_UPLOAD_ERROR: ${err?.message || String(err)}`);
    sendJson(res, 502, { error: "graph_upload_failed", message: err?.message || String(err) });
  }
}

async function sharePointCreateFolder(profileId, driveId, req, res, route) {
  const routeKey = normalizeRoutePolicyKey(route);
  const modeCheck = requestedExecutionMode(req);
  const boundaryCheck = checkExecutionBoundary(routeKey, modeCheck.mode);
  if (!boundaryCheck.ok) {
    sendJson(res, boundaryCheck.status_code, boundaryCheck.payload);
    return;
  }

  // Operator approval guard
  const approvalSource = req.headers["x-ted-approval-source"];
  if (approvalSource !== "operator") {
    sendJson(
      res,
      403,
      blockedExplainability(
        "OPERATOR_APPROVAL_REQUIRED",
        "sharepoint_create_folder",
        "SharePoint folder creation requires operator approval via the Ted Workbench UI.",
      ),
    );
    return;
  }

  if (!isSlugSafe(driveId)) {
    sendJson(res, 400, {
      error: "invalid_drive_id",
      message: "drive_id contains invalid characters",
    });
    return;
  }

  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }

  const parentPath = typeof body.parent_path === "string" ? body.parent_path.trim() : "";
  const folderName = typeof body.folder_name === "string" ? body.folder_name.trim() : "";

  if (!folderName) {
    sendJson(res, 400, { error: "missing_folder_name", message: "folder_name is required" });
    return;
  }

  const tokenResult = await ensureValidToken(profileId);
  if (!tokenResult.ok) {
    sendJson(res, 401, { error: "auth_required", message: "No valid token for profile" });
    return;
  }

  const parentUrl = parentPath
    ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodeURIComponent(parentPath)}:/children`
    : `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root/children`;

  try {
    const resp = await graphFetchWithRetry(
      parentUrl,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${tokenResult.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: folderName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "fail",
        }),
      },
      { maxRetries: 1, label: "sharepoint_create_folder" },
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      sendJson(res, resp.status, {
        error: "graph_folder_error",
        message: `Graph API returned ${resp.status}`,
        detail: errBody,
      });
      return;
    }
    const data = await resp.json();
    const item = normalizeSharePointItem(data);
    const fullPath = parentPath ? `${parentPath}/${folderName}` : folderName;
    appendEvent("sharepoint.folder.created", route, {
      profile_id: profileId,
      drive_id: driveId,
      path: fullPath,
      item_id: item.id,
    });
    appendAudit("SHAREPOINT_FOLDER_CREATE", {
      profile_id: profileId,
      drive_id: driveId,
      path: fullPath,
      item_id: item.id,
    });
    sendJson(res, 200, {
      ok: true,
      item,
      message: `Created folder "${folderName}" at ${fullPath}`,
    });
  } catch (err) {
    logLine(`SHAREPOINT_FOLDER_ERROR: ${err?.message || String(err)}`);
    sendJson(res, 502, { error: "graph_folder_failed", message: err?.message || String(err) });
  }
}

// ─── Improvement Proposals (Codex Builder Lane) ───

function aggregateTrustFailures(parsedUrl, res, route) {
  const days = parseInt(parsedUrl.searchParams?.get("days") || "30", 10);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const entries = readJsonlLines(trustLedgerPath).filter(
    (e) => e.kind === "trust_validation" && !e.valid && e.timestamp >= cutoff,
  );
  const failureByIntent = {};
  const bannedPhrases = {};
  const missingSections = {};
  for (const e of entries) {
    failureByIntent[e.intent || "unknown"] = (failureByIntent[e.intent || "unknown"] || 0) + 1;
    for (const p of e.banned_phrases_found || []) {
      bannedPhrases[p] = (bannedPhrases[p] || 0) + 1;
    }
    for (const s of e.missing_sections || []) {
      missingSections[s] = (missingSections[s] || 0) + 1;
    }
  }
  const topBanned = Object.entries(bannedPhrases)
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
  const topMissing = Object.entries(missingSections)
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
  let recommendation = "No action needed.";
  if (entries.length > 10) {
    recommendation = `High failure count (${entries.length}). Consider tightening contracts or adding validators.`;
  } else if (entries.length > 3) {
    recommendation = `Moderate failure count (${entries.length}). Review top failing intents.`;
  }
  const aggregation = {
    period_start: cutoff,
    period_end: new Date().toISOString(),
    total_failures: entries.length,
    failure_by_intent: failureByIntent,
    top_banned_phrases: topBanned,
    top_missing_sections: topMissing,
    recommendation,
  };
  appendEvent("improvement.failure.aggregated", route, { days, total_failures: entries.length });
  appendAudit("IMPROVEMENT_FAILURE_AGGREGATION", { days, total_failures: entries.length });
  sendJson(res, 200, { ok: true, aggregation, generated_at: new Date().toISOString() });
}

// ── Self-Healing: Proposal Auto-Expiry (SH-006) ──
function expireStaleProposals() {
  if (!fs.existsSync(improvementLedgerPath)) {
    return { expired: 0 };
  }
  const proposals = readJsonlLines(improvementLedgerPath);
  let expiredCount = 0;
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  for (const p of proposals) {
    if (
      p.status === "proposed" &&
      (p._ts || p.created_at) &&
      now - new Date(p._ts || p.created_at).getTime() > thirtyDaysMs
    ) {
      p.status = "expired";
      p._expired_at = new Date().toISOString();
      p._expired_reason = "auto_expiry_30d";
      expiredCount++;
      appendEvent("self_healing.proposal.auto_expired", "self_healing", {
        proposal_id: p.proposal_id || p.id || p._id,
        days_old: Math.floor(
          (now - new Date(p._ts || p.created_at).getTime()) / (24 * 60 * 60 * 1000),
        ),
      });
    }
  }
  if (expiredCount > 0) {
    const tmpPath = improvementLedgerPath + ".tmp." + Date.now();
    const fd = fs.openSync(tmpPath, "w");
    for (const p of proposals) {
      fs.writeSync(fd, JSON.stringify(p) + "\n");
    }
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tmpPath, improvementLedgerPath);
    logLine(`PROPOSAL_EXPIRY: ${expiredCount} proposals expired`);
  }
  return { expired: expiredCount };
}

function resurrectProposal(proposalId) {
  if (!fs.existsSync(improvementLedgerPath)) {
    return null;
  }
  const proposals = readJsonlLines(improvementLedgerPath);
  const proposal = proposals.find((p) => (p.proposal_id || p.id || p._id) === proposalId);
  if (!proposal) {
    return null;
  }
  if (proposal.status !== "expired") {
    return { error: "Proposal is not expired", status: proposal.status };
  }
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  if (
    proposal._expired_at &&
    Date.now() - new Date(proposal._expired_at).getTime() > fourteenDaysMs
  ) {
    return { error: "Grace period expired (>14 days since expiry)" };
  }
  proposal.status = "proposed";
  proposal._resurrected_at = new Date().toISOString();
  delete proposal._expired_at;
  delete proposal._expired_reason;
  const tmpPath = improvementLedgerPath + ".tmp." + Date.now();
  const fd = fs.openSync(tmpPath, "w");
  for (const p of proposals) {
    fs.writeSync(fd, JSON.stringify(p) + "\n");
  }
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmpPath, improvementLedgerPath);
  appendEvent("self_healing.proposal.resurrected", "self_healing", { proposal_id: proposalId });
  logLine(`PROPOSAL_RESURRECT: ${proposalId} resurrected`);
  return { ok: true, proposal_id: proposalId };
}

function listImprovementProposals(parsedUrl, res, _route) {
  const statusFilter = parsedUrl.searchParams?.get("status") || null;
  let proposals = readJsonlLines(improvementLedgerPath);
  if (statusFilter) {
    proposals = proposals.filter((p) => p.status === statusFilter);
  }
  // C12-007: Flag stale proposals (>14 days old, still in "proposed" status)
  const staleCutoff = new Date(Date.now() - 14 * 86400000).toISOString();
  proposals = proposals.map((p) => {
    if (p.status === "proposed" && p.created_at && p.created_at < staleCutoff) {
      return {
        ...p,
        _stale: true,
        _days_old: Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000),
      };
    }
    return p;
  });
  proposals.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  appendAudit("IMPROVEMENT_PROPOSALS_LIST", {
    count: proposals.length,
    status_filter: statusFilter,
  });
  sendJson(res, 200, { ok: true, proposals, total: proposals.length });
}

async function createImprovementProposal(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  if (!body.title || !body.type || !body.description) {
    return sendJson(res, 400, {
      ok: false,
      error: "missing_fields",
      message: "title, type, and description are required",
    });
  }
  const validTypes = ["contract_update", "config_update", "new_validator", "route_enhancement"];
  if (!validTypes.includes(body.type)) {
    return sendJson(res, 400, { ok: false, error: "invalid_type", valid_types: validTypes });
  }
  const proposal = {
    proposal_id: crypto.randomUUID(),
    kind: "improvement_proposal",
    type: body.type,
    title: body.title,
    description: body.description,
    source: body.source || "operator_feedback",
    status: "proposed",
    created_at: new Date().toISOString(),
    change_spec: body.change_spec || {},
    evidence: body.evidence || { failure_count: 0, failure_rate: 0, sample_failures: [] },
  };
  appendJsonlLine(improvementLedgerPath, proposal);
  appendEvent("improvement.proposal.created", route, {
    proposal_id: proposal.proposal_id,
    type: proposal.type,
    title: proposal.title,
  });
  appendAudit("IMPROVEMENT_PROPOSAL_CREATE", {
    proposal_id: proposal.proposal_id,
    title: proposal.title,
  });
  sendJson(res, 201, { ok: true, proposal });
}

// BL-002: Constitution check — validates proposal against hard_bans.json governance constraints
function validateProposalAgainstConstitution(changeSpec) {
  try {
    const hardBans = JSON.parse(fs.readFileSync(hardBansConfigPath, "utf8"));
    const updates = changeSpec.updates || {};
    // Rule 1: words_to_avoid entries can only be ADDED, never removed
    if (changeSpec.config_file === "draft_style" && updates.words_to_avoid) {
      try {
        const currentStyle = JSON.parse(fs.readFileSync(draftStyleConfigPath, "utf8"));
        const currentWords = currentStyle.words_to_avoid || [];
        const proposedWords = Array.isArray(updates.words_to_avoid) ? updates.words_to_avoid : [];
        for (const word of currentWords) {
          if (!proposedWords.includes(word)) {
            return {
              valid: false,
              reason: "blocked_by_constitution",
              details: `Cannot remove words_to_avoid entry: "${word}"`,
            };
          }
        }
      } catch {
        /* config read failure — allow, non-fatal */
      }
    }
    // Rule 2: Urgency thresholds cannot drop below minimum floor
    if (changeSpec.config_file === "urgency_rules" && updates.minimum_urgency_score !== undefined) {
      const floor = hardBans.minimum_urgency_floor || 3;
      if (
        typeof updates.minimum_urgency_score === "number" &&
        updates.minimum_urgency_score < floor
      ) {
        return {
          valid: false,
          reason: "blocked_by_constitution",
          details: `Urgency threshold ${updates.minimum_urgency_score} below governance floor ${floor}`,
        };
      }
    }
    // Rule 3: Cannot modify any hard_ban entries via config update
    if (hardBans.banned_actions && Array.isArray(hardBans.banned_actions)) {
      for (const ban of hardBans.banned_actions) {
        if (typeof ban === "string" && updates[ban] !== undefined) {
          return {
            valid: false,
            reason: "blocked_by_constitution",
            details: `Cannot modify banned action: "${ban}"`,
          };
        }
      }
    }
    return { valid: true };
  } catch (err) {
    // If hard_bans.json can't be read, BLOCK the proposal (fail-safe)
    return {
      valid: false,
      reason: "constitution_check_failed",
      details: `Cannot read hard_bans.json: ${err.message}`,
    };
  }
}

// BL-003: Snapshot config file before any AI-applied change (for one-click revert)
function snapshotConfig(configFile, proposalId) {
  const allowedConfigs = {
    urgency_rules: path.join(__dirname, "config", "urgency_rules.json"),
    style_guide: path.join(__dirname, "config", "style_guide.json"),
    draft_style: draftStyleConfigPath,
    brief_config: briefConfigPath,
  };
  const targetPath = allowedConfigs[configFile];
  if (!targetPath || !fs.existsSync(targetPath)) {
    return;
  }
  try {
    const raw = fs.readFileSync(targetPath, "utf8");
    const snapshotFile = path.join(
      configSnapshotsDir,
      `${configFile}_${proposalId}_${Date.now()}.json`,
    );
    fs.writeFileSync(snapshotFile, raw, "utf8");
    appendEvent("improvement.config.snapshot", "builder_lane", {
      config_file: configFile,
      proposal_id: proposalId,
      snapshot_path: snapshotFile,
    });
  } catch (err) {
    logLine(`CONFIG_SNAPSHOT_ERROR: ${err.message}`);
  }
}

async function reviewImprovementProposal(proposalId, req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const proposals = readJsonlLines(improvementLedgerPath);
  const existing = proposals
    .filter((p) => p.proposal_id === proposalId && p.kind === "improvement_proposal")
    .pop();
  if (!existing) {
    return sendJson(res, 404, { ok: false, error: "not_found" });
  }
  if (existing.status !== "proposed") {
    return sendJson(res, 409, {
      ok: false,
      error: "invalid_state",
      current_status: existing.status,
    });
  }
  const verdict = body.verdict; // "approved" or "rejected"
  if (!["approved", "rejected"].includes(verdict)) {
    return sendJson(res, 400, {
      ok: false,
      error: "invalid_verdict",
      valid: ["approved", "rejected"],
    });
  }
  const record = {
    proposal_id: proposalId,
    kind: "improvement_proposal_reviewed",
    status: verdict,
    reviewer_notes: body.notes || "",
    reviewed_at: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  };
  appendJsonlLine(improvementLedgerPath, record);
  const eventType =
    verdict === "approved" ? "improvement.proposal.approved" : "improvement.proposal.rejected";
  appendEvent(eventType, route, { proposal_id: proposalId, verdict });
  appendAudit("IMPROVEMENT_PROPOSAL_REVIEW", { proposal_id: proposalId, verdict });
  sendJson(res, 200, {
    ok: true,
    proposal_id: proposalId,
    status: verdict,
    reviewed_at: record.reviewed_at,
  });
}

async function applyImprovementProposal(proposalId, _req, res, route) {
  const proposals = readJsonlLines(improvementLedgerPath);
  const reviewed = proposals.filter((p) => p.proposal_id === proposalId).pop();
  if (!reviewed) {
    return sendJson(res, 404, { ok: false, error: "not_found" });
  }
  if (reviewed.status !== "approved") {
    return sendJson(res, 409, {
      ok: false,
      error: "not_approved",
      current_status: reviewed.status,
    });
  }

  // Resolve the original proposal record for change_spec and type
  const original = proposals
    .filter((p) => p.proposal_id === proposalId && p.kind === "improvement_proposal")
    .pop();
  const proposalType = original?.type || reviewed.type || "unknown";
  const changeSpec = original?.change_spec || reviewed.change_spec || {};

  let configApplied = false;
  let configKey = null;
  let configError = null;

  // Apply config changes based on proposal type
  if (
    proposalType === "contract_update" &&
    changeSpec.intent &&
    typeof changeSpec.updates === "object"
  ) {
    // Modify output_contracts.json — merge updates into the specified intent
    try {
      const raw = fs.readFileSync(outputContractsConfigPath, "utf8");
      const contracts = JSON.parse(raw);
      if (!contracts[changeSpec.intent]) {
        contracts[changeSpec.intent] = {};
      }
      Object.assign(contracts[changeSpec.intent], changeSpec.updates);
      fs.writeFileSync(
        outputContractsConfigPath,
        JSON.stringify(contracts, null, 2) + "\n",
        "utf8",
      );
      configKey = `output_contracts.${changeSpec.intent}`;
      configApplied = true;
      appendJsonlLine(policyLedgerPath, {
        kind: "policy_config_changed",
        config_key: configKey,
        changed_by: "improvement_apply",
        proposal_id: proposalId,
        timestamp: new Date().toISOString(),
      });
      appendEvent("policy.config.changed", route, {
        config_key: configKey,
        proposal_id: proposalId,
      });
    } catch (err) {
      configError = `contract_update failed: ${err.message}`;
    }
  } else if (
    proposalType === "config_update" &&
    changeSpec.config_file &&
    typeof changeSpec.updates === "object"
  ) {
    // BL-002: SAFETY FIX — hard_bans and autonomy_ladder REMOVED. Ted can NEVER modify governance constraints.
    const allowedConfigs = {
      urgency_rules: path.join(__dirname, "config", "urgency_rules.json"),
      style_guide: path.join(__dirname, "config", "style_guide.json"),
      draft_style: draftStyleConfigPath,
      brief_config: briefConfigPath,
    };
    const targetPath = allowedConfigs[changeSpec.config_file];
    if (!targetPath) {
      configError = `config_file "${changeSpec.config_file}" not in allowed list (hard_bans, autonomy_ladder are governance-protected)`;
    } else {
      // BL-002: Constitution check — validate proposal doesn't contradict hard_bans
      const constitutionResult = validateProposalAgainstConstitution(changeSpec);
      if (!constitutionResult.valid) {
        appendEvent("improvement.proposal.blocked_by_constitution", route, {
          proposal_id: proposalId,
          reason: constitutionResult.reason,
          details: constitutionResult.details,
        });
        appendJsonlLine(improvementLedgerPath, {
          proposal_id: proposalId,
          kind: "improvement_proposal_blocked",
          status: "blocked_by_constitution",
          reason: constitutionResult.reason,
          timestamp: new Date().toISOString(),
        });
        return sendJson(res, 409, {
          ok: false,
          error: "blocked_by_constitution",
          reason: constitutionResult.reason,
          details: constitutionResult.details,
        });
      }
      // BL-002: Check for overlapping pending proposals on same config dimension
      const pendingOnSameConfig = readJsonlLines(improvementLedgerPath).filter(
        (p) =>
          p.kind === "improvement_proposal" &&
          p.status === "approved" &&
          p.change_spec?.config_file === changeSpec.config_file &&
          p.proposal_id !== proposalId,
      );
      const _overlapWarning =
        pendingOnSameConfig.length > 0
          ? `${pendingOnSameConfig.length} other approved proposal(s) modify ${changeSpec.config_file}`
          : null;
      // BL-003: Snapshot config before writing
      snapshotConfig(changeSpec.config_file, proposalId);
      try {
        const raw = fs.readFileSync(targetPath, "utf8");
        const cfg = JSON.parse(raw);
        for (const [key, value] of Object.entries(changeSpec.updates)) {
          cfg[key] = value;
        }
        fs.writeFileSync(targetPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
        configKey = changeSpec.config_file;
        configApplied = true;
        appendJsonlLine(policyLedgerPath, {
          kind: "policy_config_changed",
          config_key: configKey,
          changed_by: "improvement_apply",
          proposal_id: proposalId,
          timestamp: new Date().toISOString(),
        });
        appendEvent("policy.config.changed", route, {
          config_key: configKey,
          proposal_id: proposalId,
        });
      } catch (err) {
        configError = `config_update failed: ${err.message}`;
      }
    }
  }
  // "new_validator" and "route_enhancement" types require code changes — record as applied without config modification

  // BL-002: Resolve affected routes from config_interactions.json
  let affectedRoutes = [];
  if (configKey) {
    try {
      const interactionsRaw = fs.readFileSync(configInteractionsPath, "utf8");
      const interactions = JSON.parse(interactionsRaw);
      affectedRoutes = interactions[configKey] || [];
    } catch {
      /* config_interactions.json not found or invalid — non-fatal */
    }
  }

  // BL-015: Change attribution tag — records provenance of every config change
  const attribution = {
    source: original?.source || "builder_lane",
    proposal_id: proposalId,
    confidence: original?.confidence ?? null,
    pattern_domain: original?.domain || changeSpec.domain || null,
    signal_count: original?.signal_count ?? null,
    applied_by: "builder_lane_auto",
    applied_at: new Date().toISOString(),
  };

  const record = {
    proposal_id: proposalId,
    kind: "improvement_proposal_applied",
    status: "applied",
    config_applied: configApplied,
    config_key: configKey,
    config_error: configError,
    affected_routes: affectedRoutes,
    attribution,
    applied_at: attribution.applied_at,
    timestamp: attribution.applied_at,
  };
  appendJsonlLine(improvementLedgerPath, record);
  appendEvent("improvement.proposal.applied", route, {
    proposal_id: proposalId,
    config_applied: configApplied,
    config_key: configKey,
    affected_routes: affectedRoutes,
    attribution,
  });
  appendAudit("IMPROVEMENT_PROPOSAL_APPLY", {
    proposal_id: proposalId,
    config_applied: configApplied,
    attribution,
  });
  sendJson(res, 200, {
    ok: true,
    proposal_id: proposalId,
    status: "applied",
    config_applied: configApplied,
    config_key: configKey,
    config_error: configError,
    affected_routes: affectedRoutes,
    attribution,
    applied_at: record.applied_at,
  });
}

// ─── LLM-Driven Improvement Proposal Generation ───

async function generateImprovementProposal(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const days = body.days || 30;

  // Aggregate trust failures as evidence
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const entries = readJsonlLines(trustLedgerPath).filter(
    (e) => e.kind === "trust_validation" && !e.valid && e.timestamp >= cutoff,
  );
  if (entries.length === 0) {
    return sendJson(res, 200, {
      ok: true,
      generated: false,
      reason: "no_failures_in_period",
      days,
    });
  }
  const failureByIntent = {};
  const topMissing = {};
  const topBanned = {};
  for (const e of entries) {
    failureByIntent[e.intent || "unknown"] = (failureByIntent[e.intent || "unknown"] || 0) + 1;
    for (const s of e.missing_sections || []) {
      topMissing[s] = (topMissing[s] || 0) + 1;
    }
    for (const p of e.banned_phrases_found || []) {
      topBanned[p] = (topBanned[p] || 0) + 1;
    }
  }
  const sampleFailures = entries.slice(0, 5).map((e) => ({
    intent: e.intent,
    missing: e.missing_sections,
    banned: e.banned_phrases_found,
    ts: e.timestamp,
  }));

  const systemPrompt = `You are a system reliability engineer analyzing trust validation failures in an executive assistant AI.
Generate an improvement proposal with exactly these markdown sections:
## Problem Statement
Describe the pattern of failures based on the evidence data.
## Proposed Change
Recommend specific, actionable config or contract changes to reduce the failure rate.
## Evidence
Summarize the failure data with specific numbers.

Return ONLY the markdown proposal. Do not include code fences.`;

  const userMessage = `Trust failure data (last ${days} days):
- Total failures: ${entries.length}
- By intent: ${JSON.stringify(failureByIntent)}
- Top missing sections: ${JSON.stringify(
    Object.entries(topMissing)
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 5),
  )}
- Top banned phrases: ${JSON.stringify(
    Object.entries(topBanned)
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 5),
  )}
- Sample failures: ${JSON.stringify(sampleFailures)}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const llmResult = await routeLlmCall(messages, null, "improvement_proposal");
  let proposalText = null;
  let source = "llm";

  if (!llmResult.ok) {
    // Never-dark fallback: generate template proposal from data
    const topIntent = Object.entries(failureByIntent).toSorted((a, b) => b[1] - a[1])[0];
    proposalText = `## Problem Statement\n${entries.length} trust validation failures detected in the last ${days} days. Top failing intent: ${topIntent?.[0] || "unknown"} (${topIntent?.[1] || 0} failures).\n\n## Proposed Change\nReview and update output contracts for ${topIntent?.[0] || "the top failing intent"} to reduce false-positive validation failures.\n\n## Evidence\n- Total failures: ${entries.length}\n- By intent: ${Object.entries(
      failureByIntent,
    )
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ")}\n- Top missing sections: ${Object.entries(topMissing)
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ")}`;
    source = "template";
  } else {
    const validation = validateLlmOutputContract("improvement_proposal", llmResult.content, null);
    if (validation.valid) {
      proposalText = llmResult.content;
    } else if (
      validation.banned_phrases_found.length === 0 &&
      validation.missing_sections.length > 0
    ) {
      // Hybrid: inject missing section stubs
      let hybrid = llmResult.content;
      for (const missing of validation.missing_sections) {
        const sectionName = missing.replace(/^contract:/, "").replace(/_/g, " ");
        hybrid += `\n\n## ${sectionName}\n(Auto-generated stub — please review.)`;
      }
      proposalText = hybrid;
      source = "hybrid";
      appendEvent("governance.output_contract.hybrid", route, {
        intent: "improvement_proposal",
        missing_sections: validation.missing_sections,
      });
    } else {
      // Banned phrases found — fall back to template
      const topIntent = Object.entries(failureByIntent).toSorted((a, b) => b[1] - a[1])[0];
      proposalText = `## Problem Statement\n${entries.length} trust validation failures in last ${days} days. Top: ${topIntent?.[0] || "unknown"} (${topIntent?.[1] || 0}).\n\n## Proposed Change\nReview output contracts for top failing intents.\n\n## Evidence\n- Total: ${entries.length}\n- By intent: ${Object.entries(
        failureByIntent,
      )
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(", ")}`;
      source = "template";
    }
  }

  appendEvent("improvement.proposal.created", route, {
    source,
    days,
    total_failures: entries.length,
  });
  appendAudit("IMPROVEMENT_PROPOSAL_GENERATE", { source, days, total_failures: entries.length });
  sendJson(res, 200, {
    ok: true,
    generated: true,
    source,
    proposal_text: proposalText,
    evidence: {
      total_failures: entries.length,
      failure_by_intent: failureByIntent,
      top_missing: topMissing,
      top_banned: topBanned,
      sample_failures: sampleFailures,
    },
    days,
  });
}

// ─── Builder Lane: Pattern Detection Engine (BL-005/006/007) ───

// BL-005: Read builder_lane_config.json with fallback defaults
function getBuilderLaneConfig() {
  try {
    return JSON.parse(fs.readFileSync(builderLaneConfigPath, "utf8"));
  } catch {
    return {
      phases: {
        silent: { min_corrections: 0, max_corrections: 5 },
        observation: { min_corrections: 5, max_corrections: 10 },
        proposal: { min_corrections: 10, max_corrections: 25 },
        auto_apply: { min_corrections: 25, max_corrections: 50 },
        mature: { min_corrections: 50 },
      },
      confidence_threshold: 0.8,
      time_decay: { half_life_days: 30, conflict_window_days: 14 },
      fatigue_detection: { correction_rate_drop_threshold: 0.5, fatigue_window_days: 7 },
      rubber_stamping: {
        approval_rate_threshold: 0.95,
        max_decision_time_ms: 30000,
        consecutive_days_threshold: 14,
      },
      max_proposals_per_scan: 3,
    };
  }
}

// BL-005: Determine which phase a correction count puts us in
function getPhaseForCount(count, config) {
  const phases = config.phases || {};
  if (count >= (phases.mature?.min_corrections || 50)) {
    return "mature";
  }
  if (count >= (phases.auto_apply?.min_corrections || 25)) {
    return "auto_apply";
  }
  if (count >= (phases.proposal?.min_corrections || 10)) {
    return "proposal";
  }
  if (count >= (phases.observation?.min_corrections || 5)) {
    return "observation";
  }
  return "silent";
}

// BL-005: Compute exponential time-decay weight for a correction signal
function timeDecayWeight(timestamp, halfLifeDays) {
  const daysSince = (Date.now() - new Date(timestamp).getTime()) / 86400000;
  return Math.exp(-daysSince / (halfLifeDays || 30));
}

// BL-005: Core pattern detection — reads correction signals, groups by domain+context, applies time decay
function detectCorrectionPatterns() {
  const config = getBuilderLaneConfig();
  const halfLifeDays = config.time_decay?.half_life_days || 30;
  const signals = readJsonlLines(correctionSignalsPath);
  if (signals.length === 0) {
    return { patterns: [], confidence_scores: {}, fatigue_state: {} };
  }

  // Group signals by domain
  const byDomain = {};
  for (const sig of signals) {
    const domain = sig.domain || "unknown";
    if (!byDomain[domain]) {
      byDomain[domain] = [];
    }
    byDomain[domain].push(sig);
  }

  const patterns = [];
  const confidenceScores = {};
  const fatigueState = {};

  for (const [domain, domainSignals] of Object.entries(byDomain)) {
    // Sub-group by context bucket key
    const byContext = {};
    for (const sig of domainSignals) {
      const bucketKey = sig.context_bucket ? JSON.stringify(sig.context_bucket) : "_default";
      if (!byContext[bucketKey]) {
        byContext[bucketKey] = [];
      }
      byContext[bucketKey].push(sig);
    }

    for (const [bucketKey, contextSignals] of Object.entries(byContext)) {
      const edits = contextSignals.filter(
        (s) =>
          s.signal_type === "edit" ||
          s.signal_type === "reclassify" ||
          s.signal_type === "override",
      );
      const accepts = contextSignals.filter(
        (s) => s.signal_type === "accept_verbatim" || s.signal_type === "accept_after_edit",
      );
      const rejects = contextSignals.filter((s) => s.signal_type === "reject");

      // Weighted correction count (time-decay)
      const weightedEdits = edits.reduce(
        (sum, s) => sum + timeDecayWeight(s.timestamp, halfLifeDays),
        0,
      );
      const totalCorrections = edits.length + rejects.length;
      const totalSignals = contextSignals.length;
      const phase = getPhaseForCount(totalCorrections, config);

      // BL-005: Confidence accumulator — consecutive accepts per domain
      let consecutiveAccepts = 0;
      const sorted = [...contextSignals].toSorted((a, b) =>
        (a.timestamp || "").localeCompare(b.timestamp || ""),
      );
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (
          sorted[i].signal_type === "accept_verbatim" ||
          sorted[i].signal_type === "accept_after_edit"
        ) {
          consecutiveAccepts++;
        } else {
          break;
        }
      }
      // Logistic curve: confidence = 1 / (1 + e^(-0.15 * (consecutiveAccepts - 10)))
      const confidence = 1 / (1 + Math.exp(-0.15 * (consecutiveAccepts - 10)));
      confidenceScores[`${domain}:${bucketKey}`] = {
        confidence: Math.round(confidence * 100) / 100,
        consecutive_accepts: consecutiveAccepts,
      };

      // BL-005: Fatigue monitor — compare recent 7d vs prior 7d correction rates
      const now = Date.now();
      const recent7d = edits.filter(
        (s) => now - new Date(s.timestamp).getTime() < 7 * 86400000,
      ).length;
      const prior7d = edits.filter((s) => {
        const age = now - new Date(s.timestamp).getTime();
        return age >= 7 * 86400000 && age < 14 * 86400000;
      }).length;
      let fatigueStatus = "healthy_learning";
      if (
        prior7d > 0 &&
        recent7d / prior7d < (config.fatigue_detection?.correction_rate_drop_threshold || 0.5)
      ) {
        // Corrections dropped significantly — but is Ted improving or is operator fatigued?
        const recentRejects = rejects.filter(
          (s) => now - new Date(s.timestamp).getTime() < 7 * 86400000,
        ).length;
        const priorRejects = rejects.filter((s) => {
          const age = now - new Date(s.timestamp).getTime();
          return age >= 7 * 86400000 && age < 14 * 86400000;
        }).length;
        if (priorRejects > 0 && recentRejects <= priorRejects) {
          fatigueStatus = "confirmed_improvement";
        } else {
          fatigueStatus = "suspected_fatigue";
        }
      }
      fatigueState[`${domain}:${bucketKey}`] = {
        status: fatigueStatus,
        recent_7d: recent7d,
        prior_7d: prior7d,
      };

      // Detect time-decay contradiction: recent corrections contradict older ones
      let driftDetected = false;
      const conflictWindow = config.time_decay?.conflict_window_days || 14;
      const recentEdits = edits.filter(
        (s) => now - new Date(s.timestamp).getTime() < conflictWindow * 86400000,
      );
      const olderEdits = edits.filter(
        (s) => now - new Date(s.timestamp).getTime() >= conflictWindow * 86400000,
      );
      if (recentEdits.length >= 3 && olderEdits.length >= 3) {
        const recentAvgMag =
          recentEdits.reduce((s, e) => s + (e.magnitude || 0), 0) / recentEdits.length;
        const olderAvgMag =
          olderEdits.reduce((s, e) => s + (e.magnitude || 0), 0) / olderEdits.length;
        if (Math.abs(recentAvgMag - olderAvgMag) > 0.3) {
          driftDetected = true;
        }
      }

      // Only report patterns that have enough corrections
      if (totalCorrections > 0) {
        patterns.push({
          domain,
          context_bucket: bucketKey === "_default" ? {} : JSON.parse(bucketKey),
          correction_count: totalCorrections,
          weighted_count: Math.round(weightedEdits * 100) / 100,
          accept_count: accepts.length,
          reject_count: rejects.length,
          total_signals: totalSignals,
          phase,
          confidence: confidenceScores[`${domain}:${bucketKey}`].confidence,
          fatigue_status: fatigueStatus,
          drift_detected: driftDetected,
          avg_magnitude:
            edits.length > 0
              ? Math.round(
                  (edits.reduce((s, e) => s + (e.magnitude || 0), 0) / edits.length) * 100,
                ) / 100
              : 0,
          target_config:
            domain === "draft_email"
              ? "draft_style"
              : domain === "triage"
                ? "urgency_rules"
                : domain === "commitment"
                  ? "brief_config"
                  : "style_guide",
        });
      }
    }
  }

  // Sort by weighted correction count descending
  patterns.sort((a, b) => b.weighted_count - a.weighted_count);
  return { patterns, confidence_scores: confidenceScores, fatigue_state: fatigueState };
}

// BL-006: Generate a proposal from a detected correction pattern via LLM
async function generatePatternProposal(pattern) {
  const config = getBuilderLaneConfig();
  // Validation: check pattern meets proposal phase
  if (
    pattern.phase !== "proposal" &&
    pattern.phase !== "auto_apply" &&
    pattern.phase !== "mature"
  ) {
    return { ok: false, reason: "below_proposal_threshold", phase: pattern.phase };
  }
  // Skip if confidence > 0.90 (dimension is already working well)
  if (pattern.confidence > 0.9) {
    return { ok: false, reason: "confidence_high_enough", confidence: pattern.confidence };
  }

  // Read the relevant style deltas for evidence
  const styleDeltaLines = readJsonlLines(styleDeltasPath);
  const relevantDeltas = styleDeltaLines
    .filter((d) => {
      if (pattern.domain === "draft_email" && d.draft_id) {
        return true;
      }
      return false;
    })
    .slice(-20); // Last 20 most recent

  // Read current config
  const allowedConfigs = {
    urgency_rules: path.join(__dirname, "config", "urgency_rules.json"),
    style_guide: path.join(__dirname, "config", "style_guide.json"),
    draft_style: draftStyleConfigPath,
    brief_config: briefConfigPath,
  };
  const targetPath = allowedConfigs[pattern.target_config];
  let currentConfig = {};
  if (targetPath) {
    try {
      currentConfig = JSON.parse(fs.readFileSync(targetPath, "utf8"));
    } catch {
      /* empty */
    }
  }

  const systemPrompt = `You are an executive assistant configuration optimizer. Based on operator correction evidence, propose a specific config change. Return a valid JSON object with:
{
  "title": "Brief description of the change",
  "config_file": "${pattern.target_config}",
  "updates": { "key_to_change": "new_value" },
  "evidence_summary": "Based on N corrections over M days where the operator consistently...",
  "before_after": { "before": "current value", "after": "proposed value" },
  "confidence": 0.0-1.0
}
Return ONLY the JSON object. No explanations.`;

  const evidenceSummary = relevantDeltas
    .map(
      (d) =>
        `Original: "${(d.original || "").slice(0, 100)}" → Edited: "${(d.edited || "").slice(0, 100)}" (magnitude: ${d.magnitude})`,
    )
    .join("\n");

  const userMessage = `Pattern: ${pattern.domain} corrections
Context: ${JSON.stringify(pattern.context_bucket)}
Corrections: ${pattern.correction_count} (weighted: ${pattern.weighted_count})
Average magnitude: ${pattern.avg_magnitude}
Current config (${pattern.target_config}): ${JSON.stringify(currentConfig, null, 2).slice(0, 1000)}

Recent correction evidence:
${evidenceSummary || "No detailed deltas available — use aggregate statistics."}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
  const llmResult = await routeLlmCall(messages, null, "improvement_proposal");

  if (!llmResult.ok) {
    return { ok: false, reason: "llm_call_failed", error: llmResult.error || "unknown" };
  }

  let proposal;
  try {
    proposal = JSON.parse(llmResult.content);
  } catch {
    return { ok: false, reason: "llm_response_not_json" };
  }

  // Validate proposal
  if (!proposal.config_file || !proposal.updates || typeof proposal.updates !== "object") {
    return { ok: false, reason: "invalid_proposal_structure" };
  }
  if (!allowedConfigs[proposal.config_file]) {
    return { ok: false, reason: "config_not_in_allowed_list", config_file: proposal.config_file };
  }
  // BL-002: Constitution check
  const constitutionResult = validateProposalAgainstConstitution({
    config_file: proposal.config_file,
    updates: proposal.updates,
  });
  if (!constitutionResult.valid) {
    appendEvent("improvement.proposal.blocked_by_constitution", "builder_lane", {
      reason: constitutionResult.reason,
      pattern_domain: pattern.domain,
    });
    return { ok: false, reason: "blocked_by_constitution", details: constitutionResult.details };
  }
  // BL-002: Config interactions — resolve affected routes
  let affectedRoutes = [];
  try {
    const interactions = JSON.parse(fs.readFileSync(configInteractionsPath, "utf8"));
    affectedRoutes = interactions[proposal.config_file] || [];
  } catch {
    /* non-fatal */
  }

  // Confidence threshold check
  if (
    typeof proposal.confidence === "number" &&
    proposal.confidence < (config.confidence_threshold || 0.8)
  ) {
    return {
      ok: false,
      reason: "below_confidence_threshold",
      proposal_confidence: proposal.confidence,
      threshold: config.confidence_threshold,
    };
  }

  // Create improvement proposal record
  const proposalId = `BL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const record = {
    kind: "improvement_proposal",
    proposal_id: proposalId,
    title: proposal.title || `Builder Lane: ${pattern.domain} tuning`,
    type: "config_update",
    change_spec: { config_file: proposal.config_file, updates: proposal.updates },
    status: "proposed",
    source: "builder_lane_pattern_detection",
    evidence_summary:
      proposal.evidence_summary || `Based on ${pattern.correction_count} corrections`,
    before_after: proposal.before_after || null,
    affected_routes: affectedRoutes,
    pattern_domain: pattern.domain,
    pattern_context: pattern.context_bucket,
    correction_count: pattern.correction_count,
    weighted_count: pattern.weighted_count,
    confidence: proposal.confidence || pattern.confidence,
    created_at: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  };
  appendJsonlLine(improvementLedgerPath, record);
  appendEvent("improvement.proposal.generated_from_pattern", "builder_lane", {
    proposal_id: proposalId,
    domain: pattern.domain,
    corrections: pattern.correction_count,
    affected_routes: affectedRoutes,
  });
  return { ok: true, proposal_id: proposalId, proposal: record };
}

// BL-007: Revert an applied improvement proposal from its config snapshot
function revertImprovement(proposalId, res, route) {
  // Find the snapshot file
  let snapshotFiles;
  try {
    snapshotFiles = fs.readdirSync(configSnapshotsDir).filter((f) => f.includes(`_${proposalId}_`));
  } catch {
    return sendJson(res, 500, { ok: false, error: "cannot_read_snapshots_dir" });
  }
  if (snapshotFiles.length === 0) {
    return sendJson(res, 404, { ok: false, error: "snapshot_not_found", proposal_id: proposalId });
  }
  const snapshotFile = path.join(configSnapshotsDir, snapshotFiles[0]);
  const configFileKey = snapshotFiles[0].split("_")[0]; // e.g. "draft_style" from "draft_style_BL-123_1234.json"
  // Actually parse the filename more carefully — format: configKey_proposalId_timestamp.json
  // configKey could contain underscores, so match up to the proposal prefix
  const match = snapshotFiles[0].match(/^(.+?)_BL-/);
  const resolvedConfigKey = match ? match[1] : configFileKey;
  const allowedConfigs = {
    urgency_rules: path.join(__dirname, "config", "urgency_rules.json"),
    style_guide: path.join(__dirname, "config", "style_guide.json"),
    draft_style: draftStyleConfigPath,
    brief_config: briefConfigPath,
  };
  const targetPath = allowedConfigs[resolvedConfigKey];
  if (!targetPath) {
    return sendJson(res, 409, {
      ok: false,
      error: "config_not_in_allowed_list",
      config_key: resolvedConfigKey,
    });
  }
  try {
    const snapshotContent = fs.readFileSync(snapshotFile, "utf8");
    fs.writeFileSync(targetPath, snapshotContent, "utf8");
    appendJsonlLine(improvementLedgerPath, {
      proposal_id: proposalId,
      kind: "improvement_proposal_reverted",
      status: "reverted",
      reverted_at: new Date().toISOString(),
      config_key: resolvedConfigKey,
      timestamp: new Date().toISOString(),
    });
    appendEvent("improvement.proposal.reverted", route, {
      proposal_id: proposalId,
      config_key: resolvedConfigKey,
    });
    appendAudit("IMPROVEMENT_PROPOSAL_REVERT", {
      proposal_id: proposalId,
      config_key: resolvedConfigKey,
    });
    sendJson(res, 200, {
      ok: true,
      proposal_id: proposalId,
      reverted: true,
      config_key: resolvedConfigKey,
    });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: "revert_failed", message: err.message });
  }
}

// BL-007: Builder Lane status — correction counts, phases, confidence, fatigue, applied proposals
function builderLaneStatus(res, _route) {
  const detection = detectCorrectionPatterns();
  const proposals = readJsonlLines(improvementLedgerPath);
  const appliedProposals = proposals.filter(
    (p) => p.status === "applied" && p.source === "builder_lane_pattern_detection",
  );
  const revertedProposals = proposals.filter((p) => p.status === "reverted");
  const pendingProposals = proposals.filter(
    (p) => p.status === "proposed" && p.source === "builder_lane_pattern_detection",
  );

  // Read builder lane status for fatigue/calibration history
  const statusEntries = readJsonlLines(builderLaneStatusPath);

  sendJson(res, 200, {
    ok: true,
    patterns: detection.patterns,
    confidence_scores: detection.confidence_scores,
    fatigue_state: detection.fatigue_state,
    active_proposals: pendingProposals.length,
    applied_proposals: appliedProposals.length,
    reverted_proposals: revertedProposals.length,
    total_correction_signals: readJsonlLines(correctionSignalsPath).length,
    total_style_deltas: readJsonlLines(styleDeltasPath).length,
    status_history_count: statusEntries.length,
  });
}

// BL-007: Improvement metrics for dashboard — correction rate trend, acceptance rate, monthly summary
function builderLaneImprovementMetrics(res, _route) {
  const signals = readJsonlLines(correctionSignalsPath);
  const now = Date.now();

  // Weekly buckets for last 30 days (4 weeks)
  const weekBuckets = [0, 0, 0, 0]; // [this week, last week, 2 weeks ago, 3 weeks ago]
  const weekAccepts = [0, 0, 0, 0];
  for (const sig of signals) {
    const age = now - new Date(sig.timestamp).getTime();
    const weekIdx = Math.min(3, Math.floor(age / (7 * 86400000)));
    if (
      sig.signal_type === "edit" ||
      sig.signal_type === "reject" ||
      sig.signal_type === "reclassify" ||
      sig.signal_type === "override"
    ) {
      weekBuckets[weekIdx]++;
    }
    if (sig.signal_type === "accept_verbatim" || sig.signal_type === "accept_after_edit") {
      weekAccepts[weekIdx]++;
    }
  }

  // Draft acceptance rate
  const draftSignals = signals.filter((s) => s.domain === "draft_email");
  const thisMonth = draftSignals.filter(
    (s) => now - new Date(s.timestamp).getTime() < 30 * 86400000,
  );
  const lastMonth = draftSignals.filter((s) => {
    const age = now - new Date(s.timestamp).getTime();
    return age >= 30 * 86400000 && age < 60 * 86400000;
  });
  const thisMonthAccepts = thisMonth.filter((s) => s.signal_type === "accept_verbatim").length;
  const lastMonthAccepts = lastMonth.filter((s) => s.signal_type === "accept_verbatim").length;
  const thisMonthTotal = thisMonth.length || 1;
  const lastMonthTotal = lastMonth.length || 1;
  const thisMonthRate = Math.round((thisMonthAccepts / thisMonthTotal) * 100);
  const lastMonthRate = Math.round((lastMonthAccepts / lastMonthTotal) * 100);

  // Applied proposals count
  const proposals = readJsonlLines(improvementLedgerPath);
  const appliedCount = proposals.filter(
    (p) => p.status === "applied" && p.source === "builder_lane_pattern_detection",
  ).length;
  const appliedRecently = proposals.filter(
    (p) =>
      p.status === "applied" &&
      p.source === "builder_lane_pattern_detection" &&
      p.applied_at &&
      now - new Date(p.applied_at).getTime() < 30 * 86400000,
  );

  // Config change markers (for sparkline overlay)
  const changeMarkers = appliedRecently.map((p) => ({
    proposal_id: p.proposal_id,
    applied_at: p.applied_at,
    config_key: p.config_key,
  }));

  // Progress by dimension
  const detection = detectCorrectionPatterns();
  const config = getBuilderLaneConfig();
  const progressByDimension = detection.patterns.map((p) => {
    const nextPhaseMin =
      p.phase === "silent"
        ? config.phases?.observation?.min_corrections || 5
        : p.phase === "observation"
          ? config.phases?.proposal?.min_corrections || 10
          : p.phase === "proposal"
            ? config.phases?.auto_apply?.min_corrections || 25
            : config.phases?.mature?.min_corrections || 50;
    return {
      domain: p.domain,
      context: p.context_bucket,
      phase: p.phase,
      corrections: p.correction_count,
      next_phase_at: nextPhaseMin,
      remaining: Math.max(0, nextPhaseMin - p.correction_count),
    };
  });

  // Monthly summary text
  const monthlySummary = `${thisMonth.length} draft interactions, ${thisMonthAccepts} sent without edits (${thisMonthRate}%${lastMonthRate > 0 ? `, ${thisMonthRate > lastMonthRate ? "up" : "down"} from ${lastMonthRate}%` : ""}).`;

  sendJson(res, 200, {
    ok: true,
    correction_rate_trend: weekBuckets,
    accept_rate_trend: weekAccepts,
    draft_acceptance_rate: { this_month: thisMonthRate, last_month: lastMonthRate },
    proposals_applied_count: appliedCount,
    config_change_markers: changeMarkers,
    progress_by_dimension: progressByDimension,
    monthly_summary: monthlySummary,
  });
}

// BL-007: Record operator calibration response
async function builderLaneCalibrationResponse(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    return;
  }
  const promptId = typeof body.prompt_id === "string" ? body.prompt_id : `cal-${Date.now()}`;
  const response = typeof body.response === "string" ? body.response : "";
  const domain = typeof body.domain === "string" ? body.domain : "general";
  if (!response) {
    sendJson(res, 400, { error: "response_required" });
    return;
  }
  // Calibration responses are high-signal: weight = 3-5x passive correction
  appendCorrectionSignal("calibration_response", domain, 0.0, {
    source_id: promptId,
    context_bucket: { calibration_moment: body.moment || "manual", response_text: response },
  });
  appendJsonlLine(builderLaneStatusPath, {
    kind: "calibration_response",
    prompt_id: promptId,
    domain,
    response,
    moment: body.moment || "manual",
    timestamp: new Date().toISOString(),
  });
  appendEvent("improvement.calibration.response", route, {
    prompt_id: promptId,
    domain,
    moment: body.moment,
  });
  sendJson(res, 200, { ok: true, prompt_id: promptId, recorded: true });
}

// ─── BL-013: Shadow Mode Engine ───
// Shadow mode evaluates a proposed config change in parallel for a configurable window
// (default 7 days). During shadow, both production and shadow configs exist; outputs
// from shadow are recorded but never applied to production.

async function startShadowRun(proposalId, _req, res, route) {
  const proposals = readJsonlLines(improvementProposalsLedgerPath);
  const proposal = proposals.filter((p) => p.proposal_id === proposalId).pop();
  if (!proposal) {
    sendJson(res, 404, { error: "proposal_not_found", proposal_id: proposalId });
    return;
  }
  if (proposal.status !== "approved") {
    sendJson(res, 409, { error: "proposal_must_be_approved", current_status: proposal.status });
    return;
  }
  // Check if a shadow run is already active for this proposal
  const existing = readJsonlLines(shadowEvalPath).filter(
    (e) =>
      e.proposal_id === proposalId &&
      e.kind === "shadow_started" &&
      !readJsonlLines(shadowEvalPath).some(
        (c) => c.proposal_id === proposalId && c.kind === "shadow_completed",
      ),
  );
  if (existing.length > 0) {
    sendJson(res, 409, { error: "shadow_already_active", proposal_id: proposalId });
    return;
  }

  const blConfig = getBuilderLaneConfig();
  const shadowDurationDays = blConfig?.phases?.auto_apply?.shadow_duration_days ?? 7;
  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + shadowDurationDays * 86400000).toISOString();

  // Snapshot the proposed config change for shadow comparison
  const shadowRecord = {
    kind: "shadow_started",
    proposal_id: proposalId,
    config_file: proposal.change_spec?.config_file || null,
    proposed_changes: proposal.change_spec || {},
    started_at: startedAt,
    expires_at: expiresAt,
    duration_days: shadowDurationDays,
    eval_count: 0,
    match_count: 0,
  };

  appendJsonlLine(shadowEvalPath, shadowRecord);
  appendEvent("improvement.shadow.started", route, {
    proposal_id: proposalId,
    duration_days: shadowDurationDays,
    expires_at: expiresAt,
  });
  sendJson(res, 200, { ok: true, ...shadowRecord });
}

async function completeShadowRun(proposalId, _req, res, route) {
  const shadowEntries = readJsonlLines(shadowEvalPath);
  const startEntry = shadowEntries
    .filter((e) => e.proposal_id === proposalId && e.kind === "shadow_started")
    .pop();
  if (!startEntry) {
    sendJson(res, 404, { error: "no_shadow_run_found", proposal_id: proposalId });
    return;
  }
  const alreadyCompleted = shadowEntries.some(
    (e) => e.proposal_id === proposalId && e.kind === "shadow_completed",
  );
  if (alreadyCompleted) {
    sendJson(res, 409, { error: "shadow_already_completed", proposal_id: proposalId });
    return;
  }

  // Count shadow evaluations for this proposal
  const evals = shadowEntries.filter(
    (e) => e.proposal_id === proposalId && e.kind === "shadow_eval",
  );
  const evalCount = evals.length;
  const matchCount = evals.filter((e) => e.shadow_matched).length;
  const matchRate = evalCount > 0 ? matchCount / evalCount : 0;
  const verdict =
    matchRate >= 0.85 ? "shadow_pass" : matchRate >= 0.5 ? "shadow_marginal" : "shadow_fail";

  const completionRecord = {
    kind: "shadow_completed",
    proposal_id: proposalId,
    completed_at: new Date().toISOString(),
    started_at: startEntry.started_at,
    eval_count: evalCount,
    match_count: matchCount,
    match_rate: matchRate,
    verdict,
  };

  appendJsonlLine(shadowEvalPath, completionRecord);
  appendEvent("improvement.shadow.completed", route, {
    proposal_id: proposalId,
    verdict,
    match_rate: matchRate,
    eval_count: evalCount,
  });
  sendJson(res, 200, { ok: true, ...completionRecord });
}

function getShadowStatus(proposalId, res, _route) {
  const shadowEntries = readJsonlLines(shadowEvalPath);
  const startEntry = shadowEntries
    .filter((e) => e.proposal_id === proposalId && e.kind === "shadow_started")
    .pop();
  if (!startEntry) {
    sendJson(res, 404, { error: "no_shadow_run_found", proposal_id: proposalId });
    return;
  }
  const completionEntry = shadowEntries
    .filter((e) => e.proposal_id === proposalId && e.kind === "shadow_completed")
    .pop();
  const evals = shadowEntries.filter(
    (e) => e.proposal_id === proposalId && e.kind === "shadow_eval",
  );
  const evalCount = evals.length;
  const matchCount = evals.filter((e) => e.shadow_matched).length;
  const matchRate = evalCount > 0 ? matchCount / evalCount : 0;
  const isExpired = new Date() > new Date(startEntry.expires_at);

  sendJson(res, 200, {
    ok: true,
    proposal_id: proposalId,
    status: completionEntry ? "completed" : isExpired ? "expired" : "active",
    started_at: startEntry.started_at,
    expires_at: startEntry.expires_at,
    eval_count: evalCount,
    match_count: matchCount,
    match_rate: matchRate,
    verdict: completionEntry?.verdict || null,
    completed_at: completionEntry?.completed_at || null,
  });
}

// Record a shadow evaluation data point (called internally during LLM calls if shadow active)
function _recordShadowEval(proposalId, domain, productionOutput, shadowOutput) {
  const shadowMatched = productionOutput === shadowOutput;
  appendJsonlLine(shadowEvalPath, {
    kind: "shadow_eval",
    proposal_id: proposalId,
    domain,
    shadow_matched: shadowMatched,
    evaluated_at: new Date().toISOString(),
  });
}

// ─── BL-014: Correction Amplification + Rule Promotion ───

// Amplify a correction dimension: operator explicitly confirms a pattern,
// multiplying signal weight for faster convergence.
async function amplifyCorrection(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    return;
  }
  const domain = typeof body.domain === "string" ? body.domain : "";
  const contextBucket = body.context_bucket || {};
  const multiplier = typeof body.multiplier === "number" ? Math.min(body.multiplier, 5) : 3;
  if (!domain) {
    sendJson(res, 400, { error: "domain_required" });
    return;
  }

  // Read correction signals for this domain, amplify their weight
  const signals = readJsonlLines(correctionSignalsPath).filter((s) => s.domain === domain);
  if (signals.length === 0) {
    sendJson(res, 404, { error: "no_signals_for_domain", domain });
    return;
  }

  // Record amplification event as a high-weight correction signal
  appendCorrectionSignal("correction_amplified", domain, 0.0, {
    multiplier,
    context_bucket: contextBucket,
    original_signal_count: signals.length,
    source: "operator_amplification",
  });

  appendEvent("improvement.correction.amplified", route, {
    domain,
    multiplier,
    signal_count: signals.length,
  });

  // Check for rule promotion eligibility
  const detection = detectCorrectionPatterns();
  const pattern = (detection.patterns || []).find((p) => p.domain === domain);
  const promotionResult = pattern && pattern.confidence >= 0.9 ? checkRulePromotion(pattern) : null;

  sendJson(res, 200, {
    ok: true,
    domain,
    multiplier,
    signals_amplified: signals.length,
    promotion_check: promotionResult,
  });
}

// Check if a pattern qualifies for rule promotion (permanent config change)
function checkRulePromotion(pattern) {
  if (!pattern || pattern.confidence < 0.9) {
    return { eligible: false, reason: "confidence_below_threshold" };
  }

  // Check if shadow evaluation passed (if one exists)
  const shadowEntries = readJsonlLines(shadowEvalPath);
  const shadowCompletions = shadowEntries.filter(
    (e) => e.kind === "shadow_completed" && e.verdict === "shadow_pass",
  );
  // Look for any shadow pass on proposals related to this domain
  const proposals = readJsonlLines(improvementProposalsLedgerPath).filter(
    (p) => p.domain === pattern.domain && p.status === "applied",
  );

  const hasShadowPass = proposals.some((p) =>
    shadowCompletions.some((s) => s.proposal_id === p.proposal_id),
  );

  // Rule promotion requires: confidence >= 0.90, at least 10 signals, and no active fatigue
  if (pattern.signal_count < 10) {
    return { eligible: false, reason: "insufficient_signals", signal_count: pattern.signal_count };
  }
  if (pattern.fatigue_state === "suspected_fatigue") {
    return { eligible: false, reason: "fatigue_detected" };
  }

  return {
    eligible: true,
    domain: pattern.domain,
    confidence: pattern.confidence,
    signal_count: pattern.signal_count,
    shadow_validated: hasShadowPass,
    recommendation: hasShadowPass
      ? "Ready for permanent rule promotion — shadow evaluation passed."
      : "Eligible for promotion but no shadow evaluation on record. Consider running a shadow first.",
  };
}

// ─── BL-016: Cold-Start Archetype Selection + Voice Extraction ───

async function selectArchetype(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    return;
  }
  const archetypeId = typeof body.archetype_id === "string" ? body.archetype_id : "";
  const blConfig = getBuilderLaneConfig();
  const archetypes = blConfig?.cold_start?.archetypes || {};
  if (!archetypeId || !archetypes[archetypeId]) {
    sendJson(res, 400, { error: "invalid_archetype_id", available: Object.keys(archetypes) });
    return;
  }

  const archetype = archetypes[archetypeId];

  // Apply archetype config as initial draft_style.json values
  try {
    const raw = fs.readFileSync(draftStyleConfigPath, "utf8");
    const draftStyle = JSON.parse(raw);

    // Merge archetype config into draft_style
    if (archetype.config) {
      for (const [key, value] of Object.entries(archetype.config)) {
        draftStyle[key] = value;
      }
    }

    // BL-015: Attribution tag for archetype-sourced config
    draftStyle._attribution = {
      source: "cold_start_archetype",
      archetype_id: archetypeId,
      archetype_name: archetype.name || archetypeId,
      applied_at: new Date().toISOString(),
    };

    fs.writeFileSync(draftStyleConfigPath, JSON.stringify(draftStyle, null, 2) + "\n", "utf8");
    appendEvent("improvement.archetype.applied", route, {
      archetype_id: archetypeId,
      config_keys: Object.keys(archetype.config || {}),
    });
    appendJsonlLine(policyLedgerPath, {
      kind: "policy_config_changed",
      config_key: "draft_style",
      changed_by: "archetype_selection",
      archetype_id: archetypeId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    sendJson(res, 500, { error: "archetype_apply_failed", details: err.message });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    archetype_id: archetypeId,
    archetype_name: archetype.name || archetypeId,
    applied_config: archetype.config || {},
    message: `Archetype "${archetype.name || archetypeId}" applied as Day 0 baseline. Ted will refine from here.`,
  });
}

// Voice extraction — scan sent emails to learn operator writing patterns
let _voiceExtractRunning = false;
async function startVoiceExtraction(req, res, route) {
  if (_voiceExtractRunning) {
    sendJson(res, 409, { error: "voice_extraction_already_running" });
    return;
  }
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json_body" });
    return;
  }
  const profileId = typeof body.profile_id === "string" ? body.profile_id : "olumie";
  const maxEmails = typeof body.max_emails === "number" ? Math.min(body.max_emails, 200) : 50;

  // Start extraction in background
  _voiceExtractRunning = true;
  const extractionId = `voice-${Date.now()}`;
  appendJsonlLine(styleDeltasPath, {
    kind: "voice_extraction_started",
    extraction_id: extractionId,
    profile_id: profileId,
    max_emails: maxEmails,
    started_at: new Date().toISOString(),
  });
  appendEvent("improvement.voice_extraction.started", route, {
    extraction_id: extractionId,
    profile_id: profileId,
    max_emails: maxEmails,
  });
  sendJson(res, 202, {
    ok: true,
    extraction_id: extractionId,
    status: "started",
    message:
      "Voice extraction running in background. Check status via GET /ops/onboarding/voice-extract-status.",
  });

  // Background extraction (non-blocking)
  (async () => {
    try {
      const tokenResult = await ensureValidToken(profileId);
      if (!tokenResult.ok) {
        appendJsonlLine(styleDeltasPath, {
          kind: "voice_extraction_failed",
          extraction_id: extractionId,
          error: "not_authenticated",
          completed_at: new Date().toISOString(),
        });
        return;
      }
      // Fetch sent items from last 90 days
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const sentUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=${maxEmails}&$filter=sentDateTime ge ${since}&$select=subject,body,sentDateTime,toRecipients&$orderby=sentDateTime desc`;
      const sentResp = await graphFetchWithRetry(sentUrl, {
        headers: { authorization: `Bearer ${tokenResult.accessToken}` },
      });
      if (!sentResp.ok) {
        appendJsonlLine(styleDeltasPath, {
          kind: "voice_extraction_failed",
          extraction_id: extractionId,
          error: `graph_error_${sentResp.status}`,
          completed_at: new Date().toISOString(),
        });
        return;
      }
      const sentData = await sentResp.json();
      const messages = sentData.value || [];

      // Extract writing patterns from email bodies
      const patterns = {
        avg_sentence_length: 0,
        avg_paragraph_length: 0,
        greeting_styles: {},
        closing_styles: {},
        formality_score: 0,
        total_emails_analyzed: messages.length,
      };

      let totalSentences = 0;
      let totalWords = 0;
      let totalParagraphs = 0;
      let totalParagraphWords = 0;
      let formalCount = 0;

      for (const msg of messages) {
        const bodyText = stripHtml(msg.body?.content || "");
        if (!bodyText || bodyText.length < 20) {
          continue;
        }

        // Sentence analysis
        const sentences = bodyText.split(/[.!?]+/).filter((s) => s.trim().length > 3);
        for (const s of sentences) {
          const words = s.trim().split(/\s+/).length;
          totalWords += words;
          totalSentences++;
        }

        // Paragraph analysis
        const paragraphs = bodyText.split(/\n\s*\n/).filter((p) => p.trim());
        for (const p of paragraphs) {
          totalParagraphWords += p.split(/\s+/).length;
          totalParagraphs++;
        }

        // Greeting detection
        const firstLine = bodyText.split("\n")[0]?.trim() || "";
        const greetingMatch = firstLine.match(
          /^(Hi|Hello|Hey|Dear|Good morning|Good afternoon|Good evening)\b/i,
        );
        if (greetingMatch) {
          const greeting = greetingMatch[1].toLowerCase();
          patterns.greeting_styles[greeting] = (patterns.greeting_styles[greeting] || 0) + 1;
        }

        // Closing detection
        const lastLines = bodyText.trim().split("\n").slice(-3).join(" ");
        const closingMatch = lastLines.match(
          /(Best|Regards|Thanks|Thank you|Cheers|Sincerely|Best regards|Kind regards)\b/i,
        );
        if (closingMatch) {
          const closing = closingMatch[1].toLowerCase();
          patterns.closing_styles[closing] = (patterns.closing_styles[closing] || 0) + 1;
        }

        // Formality heuristic
        const formalIndicators =
          /\b(pursuant|regarding|accordingly|herein|aforementioned|respectfully)\b/i;
        if (formalIndicators.test(bodyText)) {
          formalCount++;
        }
      }

      patterns.avg_sentence_length =
        totalSentences > 0 ? Math.round(totalWords / totalSentences) : 0;
      patterns.avg_paragraph_length =
        totalParagraphs > 0 ? Math.round(totalParagraphWords / totalParagraphs) : 0;
      patterns.formality_score =
        messages.length > 0 ? Math.round((formalCount / messages.length) * 100) : 0;

      // Store extracted patterns
      appendJsonlLine(styleDeltasPath, {
        kind: "voice_extraction_completed",
        extraction_id: extractionId,
        profile_id: profileId,
        patterns,
        completed_at: new Date().toISOString(),
      });
      appendEvent("improvement.voice_extraction.completed", route, {
        extraction_id: extractionId,
        emails_analyzed: messages.length,
      });
    } catch (err) {
      appendJsonlLine(styleDeltasPath, {
        kind: "voice_extraction_failed",
        extraction_id: extractionId,
        error: err.message,
        completed_at: new Date().toISOString(),
      });
      logLine(`VOICE_EXTRACTION_ERROR: ${err.message}`);
    } finally {
      _voiceExtractRunning = false;
    }
  })().catch((err) => {
    logLine(`VOICE_EXTRACTION_UNHANDLED: ${err.message}`);
    _voiceExtractRunning = false;
  });
}

function getVoiceExtractionStatus(res, _route) {
  const entries = readJsonlLines(styleDeltasPath);
  const started = entries.filter((e) => e.kind === "voice_extraction_started").pop();
  const completed = entries.filter((e) => e.kind === "voice_extraction_completed").pop();
  const failed = entries.filter((e) => e.kind === "voice_extraction_failed").pop();

  if (!started) {
    sendJson(res, 200, {
      ok: true,
      status: "not_started",
      message: "No voice extraction has been run yet.",
    });
    return;
  }

  const latestEnd = completed?.completed_at || failed?.completed_at || null;
  const isRunning = _voiceExtractRunning;

  sendJson(res, 200, {
    ok: true,
    status: isRunning ? "running" : completed ? "completed" : failed ? "failed" : "started",
    extraction_id: started.extraction_id,
    profile_id: started.profile_id,
    started_at: started.started_at,
    completed_at: latestEnd,
    patterns: completed?.patterns || null,
    error: failed?.error || null,
  });
}

// ─── Trust-Driven Autonomy Evaluation ───

function evaluateTrustAutonomy(_parsedUrl, res, route) {
  const ladderConfig = getAutonomyLadder();
  const currentLevel = ladderConfig.default_mode || "draft_only";
  const trustEntries = readJsonlLines(trustLedgerPath);
  const recentTrust = trustEntries.filter((e) => e.kind === "trust_validation");
  const totalValidations = recentTrust.length;
  const passed = recentTrust.filter((e) => e.valid).length;
  const passRate = totalValidations > 0 ? passed / totalValidations : 0;

  // Count consecutive passes from most recent
  let consecutivePasses = 0;
  for (let i = recentTrust.length - 1; i >= 0; i--) {
    if (recentTrust[i].valid) {
      consecutivePasses++;
    } else {
      break;
    }
  }

  // Read draft approval metrics from draft queue
  const draftEntries = readJsonlLines(draftQueueLedgerPath);
  const approvedDrafts = draftEntries.filter(
    (e) => e.kind === "draft_state_changed" && e.new_state === "approved",
  ).length;
  const totalDrafts = draftEntries.filter((e) => e.kind === "draft_created").length;
  const draftApprovalRate = totalDrafts > 0 ? approvedDrafts / totalDrafts : 0;

  const promotionThreshold = {
    min_validations: 50,
    min_pass_rate: 0.9,
    min_consecutive_passes: 20,
    min_draft_approval_rate: 0.85,
  };

  const eligible =
    totalValidations >= promotionThreshold.min_validations &&
    passRate >= promotionThreshold.min_pass_rate &&
    consecutivePasses >= promotionThreshold.min_consecutive_passes &&
    draftApprovalRate >= promotionThreshold.min_draft_approval_rate;

  let recommendation = "Insufficient data for promotion.";
  if (eligible) {
    recommendation = `Eligible for promotion from '${currentLevel}' to next autonomy tier. Operator approval required.`;
  } else if (totalValidations >= 20 && passRate >= 0.8) {
    recommendation = "Trending positive — continue building trust. Not yet eligible.";
  } else if (totalValidations < 20) {
    recommendation = `Only ${totalValidations} validations recorded. Need ${promotionThreshold.min_validations} minimum.`;
  } else {
    recommendation = `Pass rate ${(passRate * 100).toFixed(1)}% below threshold (${promotionThreshold.min_pass_rate * 100}%).`;
  }

  const evaluation = {
    current_level: currentLevel,
    eligible_for_promotion: eligible,
    metrics: {
      validation_pass_rate: Math.round(passRate * 1000) / 1000,
      draft_approval_rate: Math.round(draftApprovalRate * 1000) / 1000,
      total_validations: totalValidations,
      total_drafts_approved: approvedDrafts,
      consecutive_passes: consecutivePasses,
    },
    promotion_threshold: promotionThreshold,
    recommendation,
  };

  appendJsonlLine(trustLedgerPath, {
    kind: "trust_autonomy_evaluated",
    ...evaluation,
    timestamp: new Date().toISOString(),
  });
  appendEvent("trust.autonomy.evaluated", route, {
    eligible,
    pass_rate: passRate,
    current_level: currentLevel,
  });
  appendAudit("TRUST_AUTONOMY_EVALUATE", { eligible, current_level: currentLevel });
  sendJson(res, 200, { ok: true, evaluation, generated_at: new Date().toISOString() });
}

// ─── MCP Server (JC-073) ───
// Model Context Protocol: Streamable HTTP transport via POST /mcp
// JSON-RPC 2.0 handler — no npm dependencies needed.

/**
 * Make an internal HTTP call to the sidecar itself (loopback).
 * This lets MCP tools reuse existing route handlers without duplication.
 */
async function mcpCallInternal(method, path, authToken, body, extraHeaders) {
  const url = `http://127.0.0.1:${PORT}${path}`;
  const opts = {
    method,
    headers: {
      authorization: `Bearer ${authToken}`,
      "x-ted-execution-mode": "DETERMINISTIC",
      "content-type": "application/json",
      ...extraHeaders,
    },
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const response = await fetch(url, opts);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `mcpCallInternal ${method} ${path} -> ${response.status}: ${payload?.error || "unknown"}`,
    );
  }
  return payload;
}

// ─── MCP Tool Registry (JC-073b + JC-073d) ───

const MCP_TOOLS = [
  // Read-only tools (JC-073b)
  {
    name: "ted_status",
    description:
      "Returns Ted sidecar status including uptime, deal count, triage count, operator profile, and catalog of available routes.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, _authToken) => {
      return buildPayload();
    },
  },
  {
    name: "ted_morning_brief",
    description:
      "Generates the operator morning brief with triage summary, deal activity, filing status, automation state, and recommendations.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/reporting/morning-brief", authToken);
    },
  },
  {
    name: "ted_eod_digest",
    description:
      "Generates the end-of-day digest with actions taken, approvals, blocks, triage resolved/open, and unresolved items.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/reporting/eod-digest", authToken);
    },
  },
  {
    name: "ted_deals_list",
    description: "Lists all deals with their current stage, status, type, and key dates.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, _authToken) => {
      const deals = listDeals();
      return { deals, total_count: deals.length };
    },
  },
  {
    name: "ted_deal_detail",
    description:
      "Returns full detail for a specific deal by ID, including investors, counsel, tasks, checklist, notes, and timeline.",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "The deal identifier (slug)" },
      },
      required: ["deal_id"],
    },
    execute: async (args, _authToken) => {
      const dealId = typeof args.deal_id === "string" ? args.deal_id.trim() : "";
      if (!dealId) {
        return { error: "deal_id_required" };
      }
      if (!isSlugSafe(dealId)) {
        return { error: "invalid_deal_id" };
      }
      const filePath = getDealPath(dealId);
      if (!fs.existsSync(filePath)) {
        return { error: "deal_not_found", deal_id: dealId };
      }
      const deal = readJsonFile(filePath);
      if (!deal) {
        return { error: "deal_not_found", deal_id: dealId };
      }
      return deal;
    },
  },
  {
    name: "ted_mail_list",
    description:
      "Lists email messages from a Graph-connected mailbox. Returns subject, from, received date, read status, and preview.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (default: olumie)" },
        folder: { type: "string", description: "Mail folder to read (default: inbox)" },
        filter: { type: "string", description: "OData filter expression (optional)" },
      },
      required: [],
    },
    execute: async (args, authToken) => {
      const profileId = typeof args.profile_id === "string" ? args.profile_id.trim() : "olumie";
      const params = new URLSearchParams();
      if (args.folder) {
        params.set("folder", args.folder);
      }
      if (args.filter) {
        params.set("filter", args.filter);
      }
      const qs = params.toString();
      const path = `/graph/${encodeURIComponent(profileId)}/mail/list${qs ? `?${qs}` : ""}`;
      return mcpCallInternal("GET", path, authToken);
    },
  },
  {
    name: "ted_triage_list",
    description:
      "Lists all open triage items with their classification, confidence, entity context, and linked deal.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, _authToken) => {
      const items = listOpenTriageItems();
      return { items, total_count: items.length };
    },
  },

  // Write tools with governance gating (JC-073d)
  {
    name: "ted_draft_email",
    description:
      "Creates a draft email in a Graph-connected mailbox. Subject to governance controls (hard bans, draft style, autonomy ladder).",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (default: olumie)" },
        subject: { type: "string", description: "Email subject line" },
        to: {
          type: "array",
          items: { type: "string" },
          description: "Array of recipient email addresses",
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "Array of CC email addresses (optional)",
        },
        bcc: {
          type: "array",
          items: { type: "string" },
          description: "Array of BCC email addresses (optional)",
        },
        body_text: { type: "string", description: "Plain-text email body" },
        body_html: {
          type: "string",
          description: "HTML email body (optional, overrides body_text)",
        },
      },
      required: ["subject", "to", "body_text"],
    },
    execute: async (args, authToken) => {
      const profileId = typeof args.profile_id === "string" ? args.profile_id.trim() : "olumie";
      const body = {
        subject: args.subject,
        to: args.to,
        cc: args.cc || [],
        bcc: args.bcc || [],
        body_text: args.body_text,
      };
      if (args.body_html) {
        body.body_html = args.body_html;
      }
      return mcpCallInternal(
        "POST",
        `/graph/${encodeURIComponent(profileId)}/mail/draft/create`,
        authToken,
        body,
      );
    },
  },
  {
    name: "ted_draft_generate",
    description:
      "Generates draft email replies from unread inbox messages using LLM or template-based generation. Subject to governance controls.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (default: olumie)" },
        max_drafts: {
          type: "number",
          description: "Maximum number of drafts to generate (optional)",
        },
        filter: { type: "string", description: "OData filter for inbox messages (optional)" },
      },
      required: [],
    },
    execute: async (args, authToken) => {
      const profileId = typeof args.profile_id === "string" ? args.profile_id.trim() : "olumie";
      const body = {};
      if (typeof args.max_drafts === "number") {
        body.max_drafts = args.max_drafts;
      }
      if (typeof args.filter === "string") {
        body.filter = args.filter;
      }
      return mcpCallInternal(
        "POST",
        `/graph/${encodeURIComponent(profileId)}/drafts/generate`,
        authToken,
        body,
      );
    },
  },
  {
    name: "ted_calendar_event_create",
    description:
      "Creates a calendar event in a Graph-connected calendar. Subject to governance controls.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (default: olumie)" },
        subject: { type: "string", description: "Event subject/title" },
        start_datetime: { type: "string", description: "Start date-time in ISO 8601 format" },
        end_datetime: { type: "string", description: "End date-time in ISO 8601 format" },
        location: { type: "string", description: "Event location (optional)" },
        body_text: { type: "string", description: "Event body/notes (optional)" },
      },
      required: ["subject", "start_datetime", "end_datetime"],
    },
    execute: async (args, authToken) => {
      const profileId = typeof args.profile_id === "string" ? args.profile_id.trim() : "olumie";
      const body = {
        subject: args.subject,
        start_datetime: args.start_datetime,
        end_datetime: args.end_datetime,
      };
      if (args.location) {
        body.location = args.location;
      }
      if (args.body_text) {
        body.body_text = args.body_text;
      }
      return mcpCallInternal(
        "POST",
        `/graph/${encodeURIComponent(profileId)}/calendar/event/create`,
        authToken,
        body,
      );
    },
  },
  {
    name: "ted_extraction_deadlines",
    description:
      "Extracts deadline candidates from text using regex and LLM analysis. Returns structured deadline objects with confidence scores.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to extract deadlines from" },
        source_ref: { type: "string", description: "Source reference for traceability (optional)" },
      },
      required: ["text"],
    },
    execute: async (args, authToken) => {
      const body = { text: args.text };
      if (args.source_ref) {
        body.source_ref = args.source_ref;
      }
      return mcpCallInternal("POST", "/extraction/deadlines", authToken, body);
    },
  },

  // Phase 6: Meeting lifecycle tools
  {
    name: "ted_meeting_upcoming",
    description:
      "Lists upcoming meetings within the next N hours (default 24). Returns meeting subject, time, attendees, prep readiness, and open commitments.",
    inputSchema: {
      type: "object",
      properties: {
        hours: { type: "number", description: "Look-ahead window in hours (default: 24)" },
      },
      required: [],
    },
    execute: async (args, authToken) => {
      const hours = typeof args.hours === "number" ? args.hours : 24;
      return mcpCallInternal("GET", `/meeting/upcoming?hours=${hours}`, authToken);
    },
  },
  {
    name: "ted_meeting_prep",
    description:
      "Generates meeting preparation notes for a specific calendar event. Returns attendee context, related deals, open commitments, and suggested talking points.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "Calendar event identifier" },
      },
      required: ["event_id"],
    },
    execute: async (args, authToken) => {
      const eventId = typeof args.event_id === "string" ? args.event_id.trim() : "";
      if (!eventId) {
        return { error: "event_id_required" };
      }
      return mcpCallInternal("POST", `/meeting/prep/${encodeURIComponent(eventId)}`, authToken, {});
    },
  },
  {
    name: "ted_meeting_debrief",
    description:
      "Records a post-meeting debrief with outcomes, action items, and follow-ups. Extracts commitments and next actions automatically.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "Calendar event identifier" },
        notes: { type: "string", description: "Debrief notes / meeting outcomes" },
        action_items: {
          type: "array",
          items: { type: "string" },
          description: "Action items identified",
        },
      },
      required: ["event_id", "notes"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal("POST", "/meeting/debrief", authToken, args);
    },
  },

  // Phase 6: Commitment lifecycle tools
  {
    name: "ted_commitments_list",
    description:
      "Lists all tracked commitments with status, who owes whom, entity, due dates, and overdue detection.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/commitments/list", authToken);
    },
  },
  {
    name: "ted_commitment_create",
    description:
      "Creates a new commitment tracking entry. Records who committed to what, for whom, by when.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "What was committed" },
        who_owes: { type: "string", description: "Person who made the commitment" },
        who_to: { type: "string", description: "Person the commitment is owed to" },
        entity: { type: "string", description: "Related entity/deal (optional)" },
        due_date: { type: "string", description: "Due date in ISO 8601 format (optional)" },
        source: { type: "string", description: "Where this commitment originated (optional)" },
      },
      required: ["description", "who_owes", "who_to"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal("POST", "/commitments/create", authToken, args);
    },
  },
  {
    name: "ted_commitment_complete",
    description: "Marks a commitment as completed by ID.",
    inputSchema: {
      type: "object",
      properties: {
        commitment_id: { type: "string", description: "The commitment identifier" },
      },
      required: ["commitment_id"],
    },
    execute: async (args, authToken) => {
      const id = typeof args.commitment_id === "string" ? args.commitment_id.trim() : "";
      if (!id) {
        return { error: "commitment_id_required" };
      }
      return mcpCallInternal(
        "POST",
        `/commitments/${encodeURIComponent(id)}/complete`,
        authToken,
        {},
      );
    },
  },

  // Phase 6: GTD tools
  {
    name: "ted_gtd_actions_list",
    description:
      "Lists all GTD next actions with energy level, time estimates, contexts, due dates, and overdue detection.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/gtd/actions/list", authToken);
    },
  },
  {
    name: "ted_gtd_action_create",
    description:
      "Creates a new GTD next action with optional energy level, time estimate, context, and due date.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Action description" },
        entity: { type: "string", description: "Related entity/deal (optional)" },
        energy: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Energy level required (optional)",
        },
        time_estimate_min: {
          type: "number",
          description: "Estimated minutes to complete (optional)",
        },
        context: { type: "string", description: "GTD context tag (optional)" },
        due_date: { type: "string", description: "Due date in ISO 8601 format (optional)" },
      },
      required: ["description"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal("POST", "/gtd/actions/create", authToken, args);
    },
  },
  {
    name: "ted_gtd_action_complete",
    description: "Marks a GTD next action as completed by ID.",
    inputSchema: {
      type: "object",
      properties: {
        action_id: { type: "string", description: "The action identifier" },
      },
      required: ["action_id"],
    },
    execute: async (args, authToken) => {
      const id = typeof args.action_id === "string" ? args.action_id.trim() : "";
      if (!id) {
        return { error: "action_id_required" };
      }
      return mcpCallInternal(
        "POST",
        `/gtd/actions/${encodeURIComponent(id)}/complete`,
        authToken,
        {},
      );
    },
  },
  {
    name: "ted_gtd_waiting_for_list",
    description:
      "Lists all delegated items in the GTD waiting-for list with who, expected date, and overdue status.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/gtd/waiting-for/list", authToken);
    },
  },
  {
    name: "ted_gtd_waiting_for_create",
    description: "Creates a new waiting-for entry tracking a delegated item.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "What was delegated" },
        delegated_to: { type: "string", description: "Person responsible" },
        entity: { type: "string", description: "Related entity/deal (optional)" },
        expected_date: {
          type: "string",
          description: "Expected completion date in ISO 8601 format (optional)",
        },
      },
      required: ["description", "delegated_to"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal("POST", "/gtd/waiting-for/create", authToken, args);
    },
  },

  // Phase 7: Planning and productivity tools
  {
    name: "ted_timeblock_generate",
    description:
      "Generates a time-blocked daily plan based on active commitments, GTD actions, meetings, and deep work targets.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date to plan for in ISO format (default: today)" },
        deep_work_hours: {
          type: "number",
          description: "Target deep work hours (default: from config)",
        },
      },
      required: [],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal("POST", "/planning/timeblock/generate", authToken, args);
    },
  },
  {
    name: "ted_para_classify",
    description:
      "Classifies a deal or entity into the PARA taxonomy (Project, Area, Resource, Archive) based on status and activity.",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal identifier to classify" },
      },
      required: ["deal_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal("POST", "/filing/para/classify", authToken, args);
    },
  },
  {
    name: "ted_para_structure",
    description:
      "Returns the current PARA structure across all deals — categorized as projects, areas, resources, or archive.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/filing/para/structure", authToken);
    },
  },
  {
    name: "ted_deep_work_metrics",
    description:
      "Returns deep work metrics including hours tracked, target adherence, plans generated, and actions completed.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["day", "week", "month"],
          description: "Reporting period (default: week)",
        },
      },
      required: [],
    },
    execute: async (args, authToken) => {
      const period = typeof args.period === "string" ? args.period : "week";
      return mcpCallInternal(
        "GET",
        `/reporting/deep-work-metrics?period=${encodeURIComponent(period)}`,
        authToken,
      );
    },
  },

  // Phase 8: Trust and reporting tools
  {
    name: "ted_trust_metrics",
    description:
      "Returns operator trust metrics including approval rate, estimated time saved, actions/commitments completed, and audit trail stats.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["day", "week", "month"],
          description: "Reporting period (default: week)",
        },
      },
      required: [],
    },
    execute: async (args, authToken) => {
      const period = typeof args.period === "string" ? args.period : "week";
      return mcpCallInternal(
        "GET",
        `/reporting/trust-metrics?period=${encodeURIComponent(period)}`,
        authToken,
      );
    },
  },

  // Phase 11: Draft Queue MCP tools (JC-089g)
  {
    name: "ted_draft_queue_list",
    description: "List drafts in the queue with optional state/profile filter.",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          description:
            "Filter by draft state (drafted, pending_review, edited, approved, executed, archived)",
        },
        from_profile: { type: "string", description: "Filter by originating Graph profile ID" },
      },
      required: [],
    },
    execute: async (args, authToken) => {
      const params = new URLSearchParams();
      if (args.state) {
        params.set("state", args.state);
      }
      if (args.from_profile) {
        params.set("from_profile", args.from_profile);
      }
      const qs = params.toString();
      return mcpCallInternal("GET", `/drafts/queue${qs ? `?${qs}` : ""}`, authToken);
    },
  },
  {
    name: "ted_draft_approve",
    description: "Approve a draft for execution.",
    inputSchema: {
      type: "object",
      properties: {
        draft_id: { type: "string", description: "The draft ID to approve" },
      },
      required: ["draft_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "POST",
        `/drafts/${encodeURIComponent(args.draft_id)}/approve`,
        authToken,
        {},
        { "x-ted-approval-source": "operator" },
      );
    },
  },
  {
    name: "ted_draft_submit_review",
    description:
      "Submit a draft for operator review. Transitions from 'drafted' or 'edited' to 'pending_review'.",
    inputSchema: {
      type: "object",
      properties: {
        draft_id: { type: "string", description: "The draft ID to submit for review." },
      },
      required: ["draft_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "POST",
        `/drafts/${encodeURIComponent(args.draft_id)}/submit-review`,
        authToken,
        {},
      );
    },
  },
  {
    name: "ted_draft_edit",
    description: "Edit a draft's content or subject.",
    inputSchema: {
      type: "object",
      properties: {
        draft_id: { type: "string", description: "The draft ID to edit" },
        content: { type: "string", description: "New content for the draft body" },
        subject: { type: "string", description: "New subject line for the draft" },
      },
      required: ["draft_id"],
    },
    execute: async (args, authToken) => {
      const body = {};
      if (args.content) {
        body.content = args.content;
      }
      if (args.subject) {
        body.subject = args.subject;
      }
      return mcpCallInternal(
        "POST",
        `/drafts/${encodeURIComponent(args.draft_id)}/edit`,
        authToken,
        body,
      );
    },
  },
  {
    name: "ted_draft_execute",
    description: "Execute an approved draft (send to Outlook).",
    inputSchema: {
      type: "object",
      properties: {
        draft_id: { type: "string", description: "The draft ID to execute" },
      },
      required: ["draft_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "POST",
        `/drafts/${encodeURIComponent(args.draft_id)}/execute`,
        authToken,
        {},
        { "x-ted-approval-source": "operator" },
      );
    },
  },

  // Phase 16-21: Planner + To Do + Sync MCP tools
  {
    name: "ted_planner_plans",
    description:
      "List Microsoft Planner plans for a Graph profile, including bucket and task counts.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (e.g., 'ted-us-039')" },
      },
      required: ["profile_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/planner/plans`,
        authToken,
      );
    },
  },
  {
    name: "ted_planner_tasks",
    description: "List tasks from a Microsoft Planner plan, optionally filtered by bucket.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID" },
        plan_id: { type: "string", description: "The Planner plan ID" },
        bucket_id: { type: "string", description: "Optional bucket ID to filter tasks" },
      },
      required: ["profile_id", "plan_id"],
    },
    execute: async (args, authToken) => {
      const params = new URLSearchParams();
      if (args.bucket_id) {
        params.set("bucket_id", args.bucket_id);
      }
      const qs = params.toString();
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/planner/plans/${encodeURIComponent(args.plan_id)}/tasks${qs ? `?${qs}` : ""}`,
        authToken,
      );
    },
  },
  {
    name: "ted_todo_lists",
    description: "List Microsoft To Do task lists for a Graph profile.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID" },
      },
      required: ["profile_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/todo/lists`,
        authToken,
      );
    },
  },
  {
    name: "ted_todo_tasks",
    description: "List tasks from a Microsoft To Do list.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID" },
        list_id: { type: "string", description: "The To Do list ID" },
      },
      required: ["profile_id", "list_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/todo/lists/${encodeURIComponent(args.list_id)}/tasks`,
        authToken,
      );
    },
  },
  {
    name: "ted_extract_commitments",
    description: "Extract actionable commitments from an email using LLM analysis.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID" },
        message_id: { type: "string", description: "The Outlook message ID to analyze" },
      },
      required: ["profile_id", "message_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "POST",
        `/graph/${encodeURIComponent(args.profile_id)}/mail/${encodeURIComponent(args.message_id)}/extract-commitments`,
        authToken,
        {},
      );
    },
  },
  {
    name: "ted_sync_reconcile",
    description:
      "Run reconciliation between TED local state (commitments, GTD actions) and remote systems (Planner, To Do). Returns drift items and proposed writes.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID" },
      },
      required: ["profile_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/sync/reconcile`,
        authToken,
      );
    },
  },
  {
    name: "ted_sync_proposals",
    description:
      "List sync proposals with optional status filter. Approve or reject proposals to sync TED state with Planner/To Do.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID" },
        status: {
          type: "string",
          description:
            "Filter by proposal status (pending, approved, executed, rejected, conflict)",
        },
      },
      required: ["profile_id"],
    },
    execute: async (args, authToken) => {
      const params = new URLSearchParams();
      if (args.status) {
        params.set("status", args.status);
      }
      const qs = params.toString();
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/sync/proposals${qs ? `?${qs}` : ""}`,
        authToken,
      );
    },
  },
  // Codex Builder Lane — improvement proposals + trust autonomy
  {
    name: "ted_improvement_proposals",
    description:
      "List improvement proposals (Codex Builder Lane). Filter by status: proposed, approved, applied, rejected.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status" },
      },
    },
    execute: async (args, authToken) => {
      const params = new URLSearchParams();
      if (args.status) {
        params.set("status", args.status);
      }
      const qs = params.toString();
      return mcpCallInternal("GET", `/improvement/proposals${qs ? `?${qs}` : ""}`, authToken);
    },
  },
  {
    name: "ted_improvement_propose",
    description:
      "Create an improvement proposal based on trust failure analysis or operator feedback.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        type: {
          type: "string",
          enum: ["contract_update", "config_update", "new_validator", "route_enhancement"],
        },
        description: { type: "string" },
        source: { type: "string" },
        change_spec: { type: "object" },
        evidence: { type: "object" },
      },
      required: ["title", "type", "description"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal("POST", "/improvement/proposals", authToken, args);
    },
  },
  {
    name: "ted_failure_aggregation",
    description:
      "Aggregate trust validation failures over a time period to identify patterns for improvement.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Lookback period in days (default 30)" },
      },
    },
    execute: async (args, authToken) => {
      const params = new URLSearchParams();
      if (args.days) {
        params.set("days", String(args.days));
      }
      const qs = params.toString();
      return mcpCallInternal(
        "GET",
        `/improvement/failure-aggregation${qs ? `?${qs}` : ""}`,
        authToken,
      );
    },
  },
  {
    name: "ted_trust_autonomy",
    description:
      "Evaluate current trust metrics and determine eligibility for autonomy level promotion.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/trust/autonomy/evaluate", authToken);
    },
  },
  {
    name: "ted_deep_work_session",
    description: "Record a deep work session with duration and optional label/entity.",
    inputSchema: {
      type: "object",
      properties: {
        duration_minutes: {
          type: "number",
          description: "Duration of the session in minutes (1-480).",
        },
        label: { type: "string", description: "Optional label for the session." },
        entity: { type: "string", description: "Optional entity context (olumie, everest)." },
      },
      required: ["duration_minutes"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal("POST", "/deep-work/session", authToken, args);
    },
  },
  {
    name: "ted_graph_sync_status",
    description:
      "View recent graph sync ledger entries for a profile, showing sync health history.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (e.g. olumie, everest)." },
        limit: { type: "number", description: "Max entries to return (default 20)." },
      },
      required: ["profile_id"],
    },
    execute: async (args, authToken) => {
      const qs = args.limit ? `?limit=${args.limit}` : "";
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/sync/status${qs}`,
        authToken,
      );
    },
  },
  // SharePoint tools
  {
    name: "ted_sharepoint_sites",
    description:
      "List SharePoint sites accessible to a Microsoft 365 profile managed by Ted. Returns site names, IDs, and URLs.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (e.g. olumie, everest)." },
      },
      required: ["profile_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/sharepoint/sites`,
        authToken,
      );
    },
  },
  {
    name: "ted_sharepoint_drives",
    description:
      "List document libraries (drives) for a SharePoint site. Returns drive names, types, and URLs.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (e.g. olumie, everest)." },
        site_id: { type: "string", description: "SharePoint site ID." },
      },
      required: ["profile_id", "site_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/sharepoint/sites/${encodeURIComponent(args.site_id)}/drives`,
        authToken,
      );
    },
  },
  {
    name: "ted_sharepoint_browse",
    description:
      "Browse files and folders in a SharePoint document library. Can browse root, a specific folder by path, or by item ID. Returns file/folder names, sizes, dates, and URLs.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (e.g. olumie, everest)." },
        drive_id: { type: "string", description: "SharePoint drive (document library) ID." },
        path: {
          type: "string",
          description: "Optional folder path to browse (e.g. 'Deals/Project Alpha').",
        },
        item_id: { type: "string", description: "Optional folder item ID to browse." },
      },
      required: ["profile_id", "drive_id"],
    },
    execute: async (args, authToken) => {
      const queryParts = [];
      if (args.path) {
        queryParts.push(`path=${encodeURIComponent(args.path)}`);
      }
      if (args.item_id) {
        queryParts.push(`item_id=${encodeURIComponent(args.item_id)}`);
      }
      const qs = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/sharepoint/drives/${encodeURIComponent(args.drive_id)}/items${qs}`,
        authToken,
      );
    },
  },
  {
    name: "ted_sharepoint_search",
    description:
      "Search for files in a SharePoint document library by keyword. Returns matching files with names, sizes, dates, and URLs.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (e.g. olumie, everest)." },
        drive_id: { type: "string", description: "SharePoint drive (document library) ID." },
        query: { type: "string", description: "Search query string." },
      },
      required: ["profile_id", "drive_id", "query"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "GET",
        `/graph/${encodeURIComponent(args.profile_id)}/sharepoint/drives/${encodeURIComponent(args.drive_id)}/search?q=${encodeURIComponent(args.query)}`,
        authToken,
      );
    },
  },
  {
    name: "ted_sharepoint_upload",
    description:
      "Upload a file to SharePoint. REQUIRES OPERATOR APPROVAL. Provide file content as base64-encoded string.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (e.g. olumie, everest)." },
        drive_id: { type: "string", description: "SharePoint drive ID." },
        path: { type: "string", description: "Destination folder path in the drive." },
        file_name: { type: "string", description: "Name for the uploaded file." },
        content_base64: { type: "string", description: "File content encoded as base64." },
        content_type: {
          type: "string",
          description: "MIME type (e.g. application/pdf). Defaults to application/octet-stream.",
        },
      },
      required: ["profile_id", "drive_id", "file_name", "content_base64"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "POST",
        `/graph/${encodeURIComponent(args.profile_id)}/sharepoint/drives/${encodeURIComponent(args.drive_id)}/upload`,
        authToken,
        {
          path: args.path || "",
          file_name: args.file_name,
          content_base64: args.content_base64,
          content_type: args.content_type || "application/octet-stream",
        },
        { "x-ted-approval-source": "operator" },
      );
    },
  },
  {
    name: "ted_sharepoint_create_folder",
    description:
      "Create a new folder in a SharePoint document library. REQUIRES OPERATOR APPROVAL.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: { type: "string", description: "Graph profile ID (e.g. olumie, everest)." },
        drive_id: { type: "string", description: "SharePoint drive ID." },
        parent_path: { type: "string", description: "Parent folder path. Empty for root." },
        folder_name: { type: "string", description: "Name of the new folder." },
      },
      required: ["profile_id", "drive_id", "folder_name"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "POST",
        `/graph/${encodeURIComponent(args.profile_id)}/sharepoint/drives/${encodeURIComponent(args.drive_id)}/folder`,
        authToken,
        {
          parent_path: args.parent_path || "",
          folder_name: args.folder_name,
        },
        { "x-ted-approval-source": "operator" },
      );
    },
  },
  // ── Self-Healing MCP Tools (SH-001 through SH-006) ──
  {
    name: "ted_self_healing_status",
    description:
      "Get the overall self-healing status including circuit breakers, provider health, config drift, and compaction state.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/ops/self-healing/status", authToken);
    },
  },
  {
    name: "ted_circuit_breakers",
    description:
      "Get Graph API circuit breaker states for all workload groups (outlook_mail, outlook_calendar, planner, todo, sharepoint, teams, users).",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/ops/self-healing/circuit-breakers", authToken);
    },
  },
  {
    name: "ted_provider_health",
    description:
      "Get LLM provider health metrics including EWMA latency, success rate, composite score, and circuit state.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/ops/self-healing/provider-health", authToken);
    },
  },
  {
    name: "ted_config_drift_reconcile",
    description:
      "Run config drift reconciliation — checks all monitored config files for changes, validates JSON, and auto-restores from snapshots if needed.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("POST", "/ops/self-healing/config-drift/reconcile", authToken);
    },
  },
  {
    name: "ted_compact_ledgers",
    description:
      "Run HIPAA-compliant ledger compaction. Archives entries older than 90 days to compressed archive with integrity manifest.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("POST", "/ops/self-healing/compact-ledgers", authToken);
    },
  },
  {
    name: "ted_expire_proposals",
    description:
      "Expire stale improvement proposals that have been in 'proposed' status for more than 30 days.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("POST", "/ops/self-healing/expire-proposals", authToken);
    },
  },
  {
    name: "ted_resurrect_proposal",
    description: "Resurrect an expired improvement proposal (within 14-day grace period).",
    inputSchema: {
      type: "object",
      properties: { proposal_id: { type: "string", description: "The proposal ID to resurrect." } },
      required: ["proposal_id"],
    },
    execute: async (args, authToken) => {
      return mcpCallInternal(
        "POST",
        `/ops/builder-lane/proposals/${encodeURIComponent(args.proposal_id)}/resurrect`,
        authToken,
      );
    },
  },
  // ── Phase B Self-Healing MCP Tools (SH-007 through SH-011) ──
  {
    name: "ted_correction_taxonomy",
    description:
      "Get correction classification breakdown by subcategory (tone, content, structure, factual).",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/ops/self-healing/correction-taxonomy", authToken);
    },
  },
  {
    name: "ted_engagement_insights",
    description:
      "Get engagement analysis with optimal delivery windows, batch preference, and latency metrics per content type.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/ops/self-healing/engagement-insights", authToken);
    },
  },
  {
    name: "ted_noise_level",
    description:
      "Get current noise reduction / disengagement level (0=engaged to 4=health ping) with trigger signals.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/ops/self-healing/noise-level", authToken);
    },
  },
  {
    name: "ted_autonomy_status",
    description:
      "Get per-task-type autonomy eligibility with dual-signal metrics (correction rate + engagement rate).",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute: async (_args, authToken) => {
      return mcpCallInternal("GET", "/ops/self-healing/autonomy-status", authToken);
    },
  },
];

// ─── MCP Resource Registry (JC-073c) ───

const MCP_RESOURCES = [
  {
    uri: "ted://config/operator_profile",
    name: "Operator Profile",
    description: "Operator identity, organization, timezone, entity contexts, and default context.",
    mimeType: "application/json",
    read: () => {
      const cfg = readConfigFile(operatorProfileConfigPath);
      return cfg ? JSON.stringify(cfg) : JSON.stringify({ error: "not_configured" });
    },
  },
  {
    uri: "ted://config/hard_bans",
    name: "Hard Bans",
    description: "Words, phrases, and patterns that must never appear in any Ted-generated output.",
    mimeType: "application/json",
    read: () => {
      const cfg = readConfigFile(hardBansConfigPath);
      return cfg ? JSON.stringify(cfg) : JSON.stringify({ error: "not_configured" });
    },
  },
  {
    uri: "ted://config/autonomy_ladder",
    name: "Autonomy Ladder",
    description:
      "Progressive autonomy levels defining what Ted can do independently vs. requiring operator approval.",
    mimeType: "application/json",
    read: () => {
      const cfg = readConfigFile(autonomyLadderConfigPath);
      return cfg ? JSON.stringify(cfg) : JSON.stringify({ error: "not_configured" });
    },
  },
  {
    uri: "ted://config/brief_config",
    name: "Brief Configuration",
    description:
      "Morning brief and EOD digest configuration: required sections, tone, must-include headings.",
    mimeType: "application/json",
    read: () => {
      const cfg = readConfigFile(briefConfigPath);
      return cfg ? JSON.stringify(cfg) : JSON.stringify({ error: "not_configured" });
    },
  },
  {
    uri: "ted://config/draft_style",
    name: "Draft Style",
    description:
      "Email draft generation style: tone, signature, disclaimer, banned phrases, formality level.",
    mimeType: "application/json",
    read: () => {
      const cfg = readConfigFile(draftStyleConfigPath);
      return cfg ? JSON.stringify(cfg) : JSON.stringify({ error: "not_configured" });
    },
  },
  {
    uri: "ted://audit/recent",
    name: "Recent Audit Log",
    description:
      "Last 50 AUDIT entries from the triage ledger, showing recent system actions and governance events.",
    mimeType: "application/json",
    read: () => {
      try {
        if (!fs.existsSync(triageLedgerPath)) {
          return JSON.stringify({ entries: [] });
        }
        const raw = fs.readFileSync(triageLedgerPath, "utf8").trim();
        if (!raw) {
          return JSON.stringify({ entries: [] });
        }
        const lines = raw.split("\n");
        const auditEntries = [];
        for (let i = lines.length - 1; i >= 0 && auditEntries.length < 50; i--) {
          try {
            const entry = JSON.parse(lines[i]);
            if (entry.kind === "AUDIT") {
              auditEntries.push(entry);
            }
          } catch {
            /* skip malformed lines */
          }
        }
        return JSON.stringify({ entries: auditEntries.toReversed() });
      } catch {
        return JSON.stringify({ entries: [], error: "read_failed" });
      }
    },
  },
];

/**
 * Handle a JSON-RPC 2.0 MCP request.
 * Routes: tools/list, tools/call, resources/list, resources/read
 */
async function handleMcpRequest(req, res, route) {
  const authToken = extractBearerToken(req);

  // Read and parse JSON-RPC body
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err && err.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, { error: "body_too_large", message: "Request body exceeds 1 MB limit" });
      logLine(`POST ${route} -> 413 body_too_large`);
      return;
    }
    sendJson(res, 200, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error: invalid JSON" },
    });
    logLine(`POST ${route} -> 200 (JSON-RPC parse error)`);
    return;
  }

  // Validate JSON-RPC 2.0 structure
  if (
    !body ||
    typeof body !== "object" ||
    body.jsonrpc !== "2.0" ||
    typeof body.method !== "string" ||
    body.id === undefined
  ) {
    sendJson(res, 200, {
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: {
        code: -32600,
        message: "Invalid request: must be JSON-RPC 2.0 with jsonrpc, method, and id",
      },
    });
    logLine(`POST ${route} -> 200 (JSON-RPC invalid request)`);
    return;
  }

  const rpcId = body.id;
  const rpcMethod = body.method;
  const rpcParams = body.params || {};

  appendAudit("MCP_REQUEST", { method: rpcMethod, id: rpcId });

  try {
    // ─── tools/list ───
    if (rpcMethod === "tools/list") {
      const toolDefs = MCP_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      sendJson(res, 200, { jsonrpc: "2.0", id: rpcId, result: { tools: toolDefs } });
      logLine(`POST ${route} tools/list -> 200 (${toolDefs.length} tools)`);
      return;
    }

    // ─── tools/call ───
    if (rpcMethod === "tools/call") {
      const toolName = typeof rpcParams.name === "string" ? rpcParams.name : "";
      const toolArgs = rpcParams.arguments || {};
      const tool = MCP_TOOLS.find((t) => t.name === toolName);
      if (!tool) {
        sendJson(res, 200, {
          jsonrpc: "2.0",
          id: rpcId,
          error: { code: -32602, message: `Unknown tool: ${toolName}` },
        });
        logLine(`POST ${route} tools/call ${toolName} -> 200 (unknown tool)`);
        return;
      }
      const result = await tool.execute(toolArgs, authToken);
      sendJson(res, 200, {
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        },
      });
      appendAudit("MCP_TOOL_CALL", { tool: toolName, success: true });
      logLine(`POST ${route} tools/call ${toolName} -> 200`);
      return;
    }

    // ─── resources/list ───
    if (rpcMethod === "resources/list") {
      const resourceDefs = MCP_RESOURCES.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }));
      sendJson(res, 200, { jsonrpc: "2.0", id: rpcId, result: { resources: resourceDefs } });
      logLine(`POST ${route} resources/list -> 200 (${resourceDefs.length} resources)`);
      return;
    }

    // ─── resources/read ───
    if (rpcMethod === "resources/read") {
      const uri = typeof rpcParams.uri === "string" ? rpcParams.uri : "";
      const resource = MCP_RESOURCES.find((r) => r.uri === uri);
      if (!resource) {
        sendJson(res, 200, {
          jsonrpc: "2.0",
          id: rpcId,
          error: { code: -32602, message: `Unknown resource URI: ${uri}` },
        });
        logLine(`POST ${route} resources/read ${uri} -> 200 (unknown resource)`);
        return;
      }
      const text = resource.read();
      sendJson(res, 200, {
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          contents: [{ uri: resource.uri, mimeType: resource.mimeType, text }],
        },
      });
      logLine(`POST ${route} resources/read ${uri} -> 200`);
      return;
    }

    // ─── Unknown method ───
    sendJson(res, 200, {
      jsonrpc: "2.0",
      id: rpcId,
      error: { code: -32601, message: `Method not found: ${rpcMethod}` },
    });
    logLine(`POST ${route} ${rpcMethod} -> 200 (method not found)`);
  } catch (err) {
    sendJson(res, 200, {
      jsonrpc: "2.0",
      id: rpcId,
      error: { code: -32603, message: `Internal error: ${err.message}` },
    });
    logLine(`POST ${route} ${rpcMethod} -> 200 (internal error: ${err.message})`);
  }
}

// ─── MF-6: Scheduled Delivery System ───

function getSchedulerConfig() {
  try {
    const raw = fs.readFileSync(schedulerConfigPath, "utf8");
    return JSON.parse(raw);
  } catch {
    /* intentional: fallback to defaults if config missing */
    return {
      enabled: false,
      tick_interval_ms: 60000,
      max_consecutive_failures: 3,
      failure_backoff_minutes: 15,
      delivery_mode: "pending_ledger",
    };
  }
}

function getSchedulerState() {
  try {
    const raw = fs.readFileSync(schedulerStatePath, "utf8");
    return JSON.parse(raw);
  } catch {
    /* intentional: fallback to empty state if file missing */
    return {
      last_run: {},
      consecutive_failures: {},
      daily_notification_count: 0,
      daily_notification_date: "",
    };
  }
}

function saveSchedulerState(state) {
  try {
    fs.writeFileSync(schedulerStatePath, JSON.stringify(state, null, 2) + "\n", "utf8");
  } catch (err) {
    logLine(`SCHEDULER_STATE_SAVE_ERROR: ${err?.message || "unknown"}`);
  }
}

// C10-032: Cron field matcher with comma, step, range, and combined support
function cronFieldMatches(field, value) {
  if (field === "*") {
    return true;
  }
  // Handle comma-separated lists: "1,3,5" or "1-5,10"
  const parts = field.split(",");
  for (const part of parts) {
    // Handle step with optional range: "*/5", "1-10/2"
    if (part.includes("/")) {
      const [rangePart, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      if (!Number.isFinite(step) || step <= 0) {
        continue;
      }
      if (rangePart === "*") {
        if (value % step === 0) {
          return true;
        }
      } else if (rangePart.includes("-")) {
        const [lo, hi] = rangePart.split("-").map(Number);
        if (value >= lo && value <= hi && (value - lo) % step === 0) {
          return true;
        }
      }
      continue;
    }
    // Handle range: "1-5"
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      if (value >= lo && value <= hi) {
        return true;
      }
      continue;
    }
    // Exact match
    if (parseInt(part, 10) === value) {
      return true;
    }
  }
  return false;
}

function cronMatchesNow(cronExpr, timezone) {
  if (!cronExpr || typeof cronExpr !== "string") {
    return false;
  }
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) {
    return false;
  }

  // Get current time in the specified timezone
  let nowDate;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const formatted = formatter.formatToParts(new Date());
    const get = (type) => formatted.find((p) => p.type === type)?.value || "";
    const hour = parseInt(get("hour"), 10);
    const minute = parseInt(get("minute"), 10);
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayOfWeek = dayMap[get("weekday")] ?? new Date().getDay();
    const dayOfMonth = parseInt(get("day"), 10);
    const month = parseInt(get("month"), 10);
    nowDate = { minute, hour, dayOfWeek, dayOfMonth, month };
  } catch {
    const now = new Date();
    nowDate = {
      minute: now.getMinutes(),
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      dayOfMonth: now.getDate(),
      month: now.getMonth() + 1,
    };
  }

  const [cronMinute, cronHour, cronDom, cronMonth, cronDow] = parts;

  if (!cronFieldMatches(cronMinute, nowDate.minute)) {
    return false;
  }
  if (!cronFieldMatches(cronHour, nowDate.hour)) {
    return false;
  }
  if (!cronFieldMatches(cronDom, nowDate.dayOfMonth)) {
    return false;
  }
  if (!cronFieldMatches(cronMonth, nowDate.month)) {
    return false;
  }
  // Standard cron: 7 is alias for Sunday (0)
  const normalizedDow = cronDow.replace(/\b7\b/g, "0");
  if (!cronFieldMatches(normalizedDow, nowDate.dayOfWeek)) {
    return false;
  }

  return true;
}

let schedulerInterval = null;
let _tickRunning = false;

async function schedulerTick() {
  if (_tickRunning) {
    return;
  }
  _tickRunning = true;
  try {
    await _schedulerTickInner();
  } catch (err) {
    logLine("SCHEDULER_TICK_ERROR: " + (err?.message || String(err)));
    try {
      appendEvent("scheduler.tick.error", "scheduler", { error: err?.message });
    } catch {
      /* non-fatal */
    }
  } finally {
    _tickRunning = false;
  }
}

async function _schedulerTickInner() {
  const config = getSchedulerConfig();
  if (!config.enabled) {
    return;
  }

  // Check global pause
  if (automationPauseState?.paused) {
    appendEvent("scheduler.tick.paused", "scheduler", { reason: "automation_paused" });
    return;
  }

  const state = getSchedulerState();
  const nowKey = new Date().toISOString().slice(0, 16); // "2026-02-23T07:00" — minute precision dedup

  // Persist daily notification count across restarts
  const today = new Date().toISOString().slice(0, 10);
  if (state.daily_notification_date !== today) {
    state.daily_notification_count = 0;
    state.daily_notification_date = today;
  }

  // Load cron jobs from ted_agent.json
  let cronJobs;
  try {
    const raw = fs.readFileSync(path.join(__dirname, "config", "ted_agent.json"), "utf8");
    const agentCfg = JSON.parse(raw);
    cronJobs = agentCfg.cron_jobs || {};
  } catch {
    logLine("SCHEDULER: Failed to read ted_agent.json");
    return;
  }

  for (const [jobId, job] of Object.entries(cronJobs)) {
    if (!job || typeof job.schedule !== "string") {
      continue;
    }

    // a. Does cron match now?
    if (!cronMatchesNow(job.schedule, job.timezone)) {
      continue;
    }

    // b. Already ran this minute? (dedup)
    const lastRunKey = state.last_run?.[jobId] || "";
    if (lastRunKey === nowKey) {
      continue;
    }

    // c. Onboarding gate
    const featureMap = {
      morning_brief: "morning_brief",
      eod_digest: "eod_digest",
      daily_plan: "daily_plan",
    };
    const featureName = featureMap[jobId] || jobId;
    if (!isFeatureEnabledByOnboarding(featureName)) {
      appendEvent("scheduler.job.skipped", "scheduler", {
        job_id: jobId,
        reason: "onboarding_gate",
        feature: featureName,
      });
      continue;
    }

    // d. Notification budget
    const budgetCheck = checkNotificationBudget("normal");
    if (!budgetCheck.allowed) {
      appendEvent("scheduler.job.skipped", "scheduler", {
        job_id: jobId,
        reason: budgetCheck.reason,
      });
      continue;
    }

    // e. Failure backoff
    const failures = state.consecutive_failures?.[jobId] || 0;
    if (failures >= (config.max_consecutive_failures || 3)) {
      appendEvent("scheduler.job.skipped", "scheduler", {
        job_id: jobId,
        reason: "failure_backoff",
        failures,
      });
      continue;
    }

    // f. Execute
    appendEvent("scheduler.job.started", "scheduler", { job_id: jobId });
    logLine(`SCHEDULER: Executing ${jobId}`);

    try {
      let content = null;
      const minted = mintBearerToken();
      const dispatchToken = minted.token;

      // C9-012: Actually invoke route handlers internally via loopback
      if (jobId === "morning_brief") {
        try {
          const result = await mcpCallInternal("GET", "/reporting/morning-brief", dispatchToken);
          content = {
            type: "morning_brief",
            dispatched: true,
            headline: result?.headline || null,
            narrative_length: result?.narrative?.length || 0,
            calendar_source: result?.calendar_source || null,
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.success", "scheduler", {
            job_id: jobId,
            has_narrative: !!result?.narrative,
          });
        } catch (dispatchErr) {
          logLine(
            `SCHEDULER_DISPATCH_ERROR: morning_brief -- ${dispatchErr?.message || "unknown"}`,
          );
          content = {
            type: "morning_brief",
            dispatched: false,
            dispatch_error: dispatchErr?.message || "unknown",
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.failed", "scheduler", {
            job_id: jobId,
            error: dispatchErr?.message,
          });
        }
      } else if (jobId === "eod_digest") {
        try {
          const result = await mcpCallInternal("GET", "/reporting/eod-digest", dispatchToken);
          content = {
            type: "eod_digest",
            dispatched: true,
            headline: result?.headline || null,
            narrative_length: result?.narrative?.length || 0,
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.success", "scheduler", { job_id: jobId });
        } catch (dispatchErr) {
          logLine(`SCHEDULER_DISPATCH_ERROR: eod_digest -- ${dispatchErr?.message || "unknown"}`);
          content = {
            type: "eod_digest",
            dispatched: false,
            dispatch_error: dispatchErr?.message || "unknown",
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.failed", "scheduler", {
            job_id: jobId,
            error: dispatchErr?.message,
          });
        }
      } else if (jobId === "daily_plan") {
        try {
          const result = await mcpCallInternal("GET", "/planning/timeblock", dispatchToken);
          content = {
            type: "daily_plan",
            dispatched: true,
            result_keys: Object.keys(result || {}),
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.success", "scheduler", { job_id: jobId });
        } catch (dispatchErr) {
          content = {
            type: "daily_plan",
            dispatched: false,
            dispatch_error: dispatchErr?.message || "unknown",
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.failed", "scheduler", {
            job_id: jobId,
            error: dispatchErr?.message,
          });
        }
      } else if (jobId === "inbox_ingestion") {
        try {
          const result = await runInboxIngestionCycle();
          content = {
            type: "inbox_ingestion",
            dispatched: true,
            processed: result?.processed?.length || 0,
            errors: result?.errors?.length || 0,
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.success", "scheduler", {
            job_id: jobId,
            processed: result?.processed?.length || 0,
          });
        } catch (dispatchErr) {
          content = {
            type: "inbox_ingestion",
            dispatched: false,
            dispatch_error: dispatchErr?.message || "unknown",
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.failed", "scheduler", {
            job_id: jobId,
            error: dispatchErr?.message,
          });
        }
      } else if (jobId === "builder_lane_scan") {
        // BL-007: Weekly pattern detection — detect patterns, generate proposals for those meeting threshold
        try {
          const blConfig = getBuilderLaneConfig();
          const detection = detectCorrectionPatterns();
          const proposalPhasePatterns = detection.patterns.filter(
            (p) => p.phase === "proposal" || p.phase === "auto_apply" || p.phase === "mature",
          );
          let generated = 0;
          for (const pattern of proposalPhasePatterns.slice(
            0,
            blConfig.max_proposals_per_scan || 3,
          )) {
            if (pattern.confidence > 0.9) {
              continue;
            } // Skip high-confidence dimensions
            const result = await generatePatternProposal(pattern);
            if (result.ok) {
              generated++;
            }
          }
          // Check for fatigue across all domains
          for (const [key, state] of Object.entries(detection.fatigue_state)) {
            if (state.status === "suspected_fatigue") {
              appendEvent("improvement.fatigue.suspected", "builder_lane", {
                dimension: key,
                recent_7d: state.recent_7d,
                prior_7d: state.prior_7d,
              });
              appendJsonlLine(builderLaneStatusPath, {
                kind: "fatigue_detected",
                dimension: key,
                ...state,
                timestamp: new Date().toISOString(),
              });
            }
          }
          content = {
            type: "builder_lane_scan",
            dispatched: true,
            patterns_found: detection.patterns.length,
            proposals_generated: generated,
            fatigue_flags: Object.values(detection.fatigue_state).filter(
              (s) => s.status === "suspected_fatigue",
            ).length,
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.success", "scheduler", {
            job_id: jobId,
            patterns: detection.patterns.length,
            generated,
          });
        } catch (dispatchErr) {
          content = {
            type: "builder_lane_scan",
            dispatched: false,
            dispatch_error: dispatchErr?.message || "unknown",
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.failed", "scheduler", {
            job_id: jobId,
            error: dispatchErr?.message,
          });
        }
      } else if (jobId === "self_healing_maintenance") {
        // SH: Periodic self-healing maintenance — config drift check, proposal expiry, zombie drafts, noise assessment
        try {
          const driftResult = checkConfigDrift();
          const expiryResult = expireStaleProposals();
          // SH-011: Detect and handle zombie drafts
          const zombies = detectZombieDrafts();
          let zombieHandled = 0;
          for (const z of zombies) {
            try {
              await retryZombieDraft(z);
              zombieHandled++;
            } catch (zErr) {
              logLine(`ZOMBIE_DRAFT_ERROR: ${z.draft_id} — ${zErr?.message || "unknown"}`);
            }
          }
          // SH-009: Assess disengagement level
          const noiseLevel = assessDisengagementLevel();
          content = {
            type: "self_healing_maintenance",
            dispatched: true,
            drift_count: driftResult.drift_count,
            expired_proposals: expiryResult.expired,
            zombie_drafts_handled: zombieHandled,
            noise_level: noiseLevel.level,
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.success", "scheduler", {
            job_id: jobId,
            drift: driftResult.drift_count,
            expired: expiryResult.expired,
            zombies: zombieHandled,
            noise_level: noiseLevel.level,
          });
        } catch (dispatchErr) {
          content = {
            type: "self_healing_maintenance",
            dispatched: false,
            dispatch_error: dispatchErr?.message || "unknown",
            job_id: jobId,
          };
          appendEvent("scheduler.dispatch.failed", "scheduler", {
            job_id: jobId,
            error: dispatchErr?.message,
          });
        }
      } else {
        content = { type: jobId, message: `Scheduled ${jobId} for ${today}`, job_id: jobId };
      }

      // Write to pending delivery ledger
      const deliveryId = `del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      appendJsonlLine(pendingDeliveryPath, {
        kind: "delivery_pending",
        delivery_id: deliveryId,
        job_id: jobId,
        content,
        channel: job.delivery_channel || "imessage",
        status: "pending",
        created_at: new Date().toISOString(),
      });

      recordNotificationSent();
      state.daily_notification_count = (state.daily_notification_count || 0) + 1;

      // Update state
      if (!state.last_run) {
        state.last_run = {};
      }
      state.last_run[jobId] = nowKey;
      if (!state.consecutive_failures) {
        state.consecutive_failures = {};
      }
      state.consecutive_failures[jobId] = 0;

      appendEvent("scheduler.job.completed", "scheduler", {
        job_id: jobId,
        delivery_id: deliveryId,
      });
      logLine(`SCHEDULER: ${jobId} completed -> ${deliveryId}`);
    } catch (err) {
      if (!state.consecutive_failures) {
        state.consecutive_failures = {};
      }
      state.consecutive_failures[jobId] = (state.consecutive_failures[jobId] || 0) + 1;
      if (!state.last_run) {
        state.last_run = {};
      }
      state.last_run[jobId] = nowKey;
      appendEvent("scheduler.job.failed", "scheduler", {
        job_id: jobId,
        error: err?.message || "unknown",
        failures: state.consecutive_failures[jobId],
      });
      logLine(`SCHEDULER_ERROR: ${jobId} — ${err?.message || "unknown"}`);
    }
  }

  saveSchedulerState(state);
}

// Scheduler control endpoints
function schedulerStatusEndpoint(res, route) {
  const config = getSchedulerConfig();
  const state = getSchedulerState();

  let cronJobs;
  try {
    const raw = fs.readFileSync(path.join(__dirname, "config", "ted_agent.json"), "utf8");
    const agentCfg = JSON.parse(raw);
    cronJobs = agentCfg.cron_jobs || {};
  } catch (err) {
    logLine(`SCHEDULER_STATUS_CONFIG_ERROR: ${err?.message || String(err)}`);
    cronJobs = {};
  }

  const jobs = Object.entries(cronJobs).map(([id, job]) => ({
    job_id: id,
    schedule: job.schedule,
    timezone: job.timezone,
    channel: job.delivery_channel,
    last_run: state.last_run?.[id] || null,
    consecutive_failures: state.consecutive_failures?.[id] || 0,
  }));

  sendJson(res, 200, {
    enabled: config.enabled,
    tick_interval_ms: config.tick_interval_ms,
    paused: automationPauseState?.paused || false,
    jobs,
    daily_notification_count: state.daily_notification_count || 0,
    daily_notification_date: state.daily_notification_date || null,
  });
  logLine(`GET ${route} -> 200`);
}

async function schedulerConfigEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;
  if (enabled === null) {
    sendJson(res, 400, { error: "enabled_boolean_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  try {
    const config = getSchedulerConfig();
    config.enabled = enabled;
    fs.writeFileSync(schedulerConfigPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  } catch (err) {
    sendJson(res, 500, { error: "config_write_failed", message: err?.message });
    logLine(`POST ${route} -> 500`);
    return;
  }

  // Start or stop the interval
  if (enabled && !schedulerInterval) {
    const config = getSchedulerConfig();
    schedulerInterval = setInterval(() => schedulerTick(), config.tick_interval_ms || 60000);
    schedulerInterval.unref();
    appendEvent("scheduler.started", route, { tick_interval_ms: config.tick_interval_ms || 60000 });
    logLine("SCHEDULER: Started");
  } else if (!enabled && schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    appendEvent("scheduler.stopped", route, {});
    logLine("SCHEDULER: Stopped");
  }

  appendEvent("scheduler.config.changed", route, { enabled });
  sendJson(res, 200, { enabled, message: enabled ? "Scheduler enabled" : "Scheduler disabled" });
  logLine(`POST ${route} -> 200`);
}

function pendingDeliveriesEndpoint(parsedUrl, res, route) {
  const lines = readJsonlLines(pendingDeliveryPath);
  const deliveryMap = new Map();
  for (const line of lines) {
    if (line.kind === "delivery_pending") {
      deliveryMap.set(line.delivery_id, { ...line });
    } else if (line.kind === "delivery_acknowledged" && deliveryMap.has(line.delivery_id)) {
      deliveryMap.get(line.delivery_id).status = "acknowledged";
      deliveryMap.get(line.delivery_id).acknowledged_at = line.at;
    }
  }

  const statusFilter = parsedUrl?.searchParams?.get("status") || null;
  let deliveries = [...deliveryMap.values()];
  if (statusFilter) {
    deliveries = deliveries.filter((d) => d.status === statusFilter);
  }
  deliveries.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  sendJson(res, 200, { deliveries, total_count: deliveries.length });
  logLine(`GET ${route} -> 200`);
}

async function pendingDeliveryAckEndpoint(req, res, route) {
  const body = await readJsonBodyGuarded(req, res, route);
  if (!body) {
    return;
  }
  const deliveryId = typeof body?.delivery_id === "string" ? body.delivery_id.trim() : "";
  if (!deliveryId) {
    sendJson(res, 400, { error: "delivery_id_required" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  appendJsonlLine(pendingDeliveryPath, {
    kind: "delivery_acknowledged",
    delivery_id: deliveryId,
    at: new Date().toISOString(),
  });
  appendEvent("delivery.acknowledged", route, { delivery_id: deliveryId });
  sendJson(res, 200, { delivery_id: deliveryId, status: "acknowledged" });
  logLine(`POST ${route} -> 200`);
}

const server = http.createServer(async (req, res) => {
  try {
    const method = (req.method || "").toUpperCase();
    const parsed = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const route = parsed.pathname;
    const routeKey = normalizeRoutePolicyKey(route);

    // Early reject: if Content-Length header declares a body larger than 1 MB, reject before buffering
    const MAX_BODY_BYTES = 1 * 1024 * 1024;
    const declaredLength = parseInt(req.headers["content-length"], 10);
    if (method === "POST" && declaredLength > MAX_BODY_BYTES) {
      sendJson(res, 413, { error: "body_too_large", message: "Request body exceeds 1 MB limit" });
      logLine(`POST ${route} -> 413 content-length ${declaredLength}`);
      req.destroy();
      return;
    }

    if (method === "POST" && route === "/auth/mint") {
      await mintSidecarAuthToken(req, res, route);
      return;
    }

    if (method !== "GET" && method !== "POST") {
      sendJson(res, 405, { error: "method_not_allowed" });
      logLine(`${method} ${route} -> 405`);
      return;
    }

    if (!EXEMPT_AUTH_ROUTES.has(route)) {
      const token = extractBearerToken(req);
      if (!isValidBearerToken(token)) {
        appendAudit("AUTH_BLOCK", {
          reason_code: "MISSING_OR_INVALID_AUTH",
          route: routeKey,
        });
        sendJson(
          res,
          401,
          blockedExplainability(
            "MISSING_OR_INVALID_AUTH",
            "sidecar_route_execution",
            "Mint a token via /auth/mint and retry with Authorization: Bearer <token>.",
          ),
        );
        logLine(`${method} ${route} -> 401`);
        return;
      }
    }

    if (executionBoundaryPolicy.has(routeKey)) {
      const modeResult = requestedExecutionMode(req);
      if (!modeResult.ok) {
        sendJson(
          res,
          400,
          blockedExplainability(
            "INVALID_EXECUTION_MODE",
            "route_execution",
            "Set x-ted-execution-mode to DETERMINISTIC or ADAPTIVE.",
          ),
        );
        logLine(`${method} ${route} -> 400`);
        return;
      }
      const boundaryCheck = checkExecutionBoundary(routeKey, modeResult.mode);
      if (!boundaryCheck.ok) {
        appendAudit("BOUNDARY_BLOCK", {
          route: routeKey,
          mode: modeResult.mode,
          reason_code: boundaryCheck.payload.reason_code,
        });
        sendJson(res, boundaryCheck.status_code, boundaryCheck.payload);
        logLine(`${method} ${route} -> ${boundaryCheck.status_code}`);
        return;
      }
    }

    if (method === "POST" && route === "/deals/create") {
      await createDeal(req, res, route);
      return;
    }

    if (method === "GET" && route === "/deals/list") {
      listDealsEndpoint(res, route);
      return;
    }

    // C12-004: Stale deal owner responsiveness check
    if (method === "GET" && route === "/deals/stale-owners") {
      return checkStaleDealOwners(parsed, res, route);
    }

    const dealByIdMatch = route.match(/^\/deals\/([^/]+)$/);
    if (method === "GET" && dealByIdMatch) {
      const dealId = decodeURIComponent(dealByIdMatch[1] || "").trim();
      getDeal(dealId, res, route);
      return;
    }

    const dealUpdateMatch = route.match(/^\/deals\/([^/]+)\/update$/);
    if (method === "POST" && dealUpdateMatch) {
      const dealId = decodeURIComponent(dealUpdateMatch[1] || "").trim();
      await updateDeal(req, res, route, dealId);
      return;
    }

    const dealDatesMatch = route.match(/^\/deals\/([^/]+)\/dates$/);
    if (method === "POST" && dealDatesMatch) {
      const dealId = decodeURIComponent(dealDatesMatch[1] || "").trim();
      await addDealDate(req, res, route, dealId);
      return;
    }

    const dealInvestorsMatch = route.match(/^\/deals\/([^/]+)\/investors$/);
    if (method === "POST" && dealInvestorsMatch) {
      const dealId = decodeURIComponent(dealInvestorsMatch[1] || "").trim();
      await addDealInvestor(req, res, route, dealId);
      return;
    }

    const dealInvestorsUpdateMatch = route.match(/^\/deals\/([^/]+)\/investors\/update$/);
    if (method === "POST" && dealInvestorsUpdateMatch) {
      const dealId = decodeURIComponent(dealInvestorsUpdateMatch[1] || "").trim();
      await updateDealInvestor(req, res, route, dealId);
      return;
    }

    const dealCounselMatch = route.match(/^\/deals\/([^/]+)\/counsel$/);
    if (method === "POST" && dealCounselMatch) {
      const dealId = decodeURIComponent(dealCounselMatch[1] || "").trim();
      await addDealCounsel(req, res, route, dealId);
      return;
    }

    const dealCounselInvoiceMatch = route.match(/^\/deals\/([^/]+)\/counsel\/invoice$/);
    if (method === "POST" && dealCounselInvoiceMatch) {
      const dealId = decodeURIComponent(dealCounselInvoiceMatch[1] || "").trim();
      await addCounselInvoice(req, res, route, dealId);
      return;
    }

    const dealTasksMatch = route.match(/^\/deals\/([^/]+)\/tasks$/);
    if (method === "POST" && dealTasksMatch) {
      const dealId = decodeURIComponent(dealTasksMatch[1] || "").trim();
      await addDealTask(req, res, route, dealId);
      return;
    }

    const dealTasksUpdateMatch = route.match(/^\/deals\/([^/]+)\/tasks\/update$/);
    if (method === "POST" && dealTasksUpdateMatch) {
      const dealId = decodeURIComponent(dealTasksUpdateMatch[1] || "").trim();
      await updateDealTask(req, res, route, dealId);
      return;
    }

    const dealChecklistMatch = route.match(/^\/deals\/([^/]+)\/checklist$/);
    if (method === "POST" && dealChecklistMatch) {
      const dealId = decodeURIComponent(dealChecklistMatch[1] || "").trim();
      await manageDealChecklist(req, res, route, dealId);
      return;
    }

    const dealNotesMatch = route.match(/^\/deals\/([^/]+)\/notes$/);
    if (method === "POST" && dealNotesMatch) {
      const dealId = decodeURIComponent(dealNotesMatch[1] || "").trim();
      await addDealNote(req, res, route, dealId);
      return;
    }

    const dealTimelineMatch = route.match(/^\/deals\/([^/]+)\/timeline$/);
    if (method === "GET" && dealTimelineMatch) {
      const dealId = decodeURIComponent(dealTimelineMatch[1] || "").trim();
      getDealTimeline(dealId, res, route);
      return;
    }

    // C12-011: Per-deal learning retrospective
    const dealRetroMatch = route.match(/^\/deals\/([^/]+)\/retrospective$/);
    if (method === "POST" && dealRetroMatch) {
      const dealId = decodeURIComponent(dealRetroMatch[1] || "").trim();
      await generateDealRetrospective(dealId, parsed, req, res, route);
      return;
    }

    if (method === "GET" && route === "/triage/list") {
      listTriageEndpoint(res, route);
      return;
    }

    if (method === "POST" && route === "/triage/ingest") {
      await ingestTriageItem(req, res, route);
      return;
    }

    if (method === "POST" && route === "/governance/role-cards/validate") {
      await validateRoleCardEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/governance/hard-bans/check") {
      await checkHardBansEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/governance/output/validate") {
      await validateOutputContractEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/governance/entity/check") {
      await checkEntityProvenanceEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/governance/confidence/evaluate") {
      await evaluateConfidenceEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/governance/contradictions/check") {
      await checkContradictionsEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/governance/escalations/route") {
      await routeEscalationEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/governance/repair/simulate") {
      await simulateFastRepairEndpoint(req, res, route);
      return;
    }

    // MF-10: Setup and onboarding routes
    if (method === "POST" && route === "/ops/onboarding/activate") {
      await onboardingActivateEndpoint(req, res, route);
      return;
    }
    if (method === "GET" && route === "/ops/setup/validate") {
      setupValidateEndpoint(res, route);
      return;
    }

    // MF-6: Scheduler routes
    if (method === "GET" && route === "/ops/scheduler") {
      schedulerStatusEndpoint(res, route);
      return;
    }
    if (method === "POST" && route === "/ops/scheduler") {
      await schedulerConfigEndpoint(req, res, route);
      return;
    }
    if (method === "GET" && route === "/ops/pending-deliveries") {
      pendingDeliveriesEndpoint(parsed, res, route);
      return;
    }
    if (method === "POST" && route === "/ops/pending-deliveries/ack") {
      await pendingDeliveryAckEndpoint(req, res, route);
      return;
    }

    // C9-010: Inbox ingestion routes
    if (method === "POST" && route === "/ops/ingestion/run") {
      try {
        const result = await runInboxIngestionCycle();
        sendJson(res, 200, result);
        logLine(`POST ${route} -> 200`);
      } catch (err) {
        sendJson(res, 500, { error: "ingestion_cycle_failed", detail: err?.message });
        logLine(`POST ${route} -> 500`);
      }
      return;
    }
    if (method === "GET" && route === "/ops/ingestion/status") {
      const lines = readJsonlLines(ingestionLedgerPath);
      const ingested = lines.filter((l) => l.kind === "message_ingested");
      sendJson(res, 200, {
        total_ingested: ingested.length,
        by_profile: Object.fromEntries(
          [...GRAPH_ALLOWED_PROFILES].map((p) => [
            p,
            ingested.filter((l) => l.profile_id === p).length,
          ]),
        ),
        last_cycle: ingested.length > 0 ? ingested[ingested.length - 1].at : null,
      });
      logLine(`GET ${route} -> 200`);
      return;
    }

    // C9-020: First-run discovery routes
    if (method === "POST" && route === "/ops/onboarding/discover") {
      const body = await readJsonBodyGuarded(req, res, route);
      if (!body) {
        return;
      }
      const profileId = typeof body.profile_id === "string" ? body.profile_id.trim() : "olumie";
      if (!GRAPH_ALLOWED_PROFILES.has(profileId)) {
        sendJson(res, 400, { error: "unsupported_profile_id" });
        logLine(`POST ${route} -> 400`);
        return;
      }
      try {
        const result = await runDiscoveryPipeline(profileId, body);
        sendJson(res, 200, result);
        logLine(`POST ${route} -> 200`);
      } catch (err) {
        sendJson(res, 500, { error: "discovery_failed", detail: err?.message });
        logLine(`POST ${route} -> 500`);
      }
      return;
    }
    if (method === "GET" && route === "/ops/onboarding/discovery-status") {
      const lines = readJsonlLines(discoveryLedgerPath);
      const completed = lines.filter((l) => l.kind === "discovery_completed");
      sendJson(res, 200, {
        discoveries: completed.map((d) => ({
          profile_id: d.profile_id,
          emails_scanned: d.emails_scanned,
          calendar_events_found: d.calendar_events_found,
          planner_tasks_found: d.planner_tasks_found,
          todo_tasks_found: d.todo_tasks_found,
          deal_candidates: d.deal_candidates?.length || 0,
          commitment_candidates: d.commitment_candidates?.length || 0,
          generated_at: d.generated_at,
        })),
      });
      logLine(`GET ${route} -> 200`);
      return;
    }

    if (method === "POST" && route === "/ops/pause") {
      await pauseAutomationEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/ops/dispatch/check") {
      await dispatchCheckEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/ops/resume") {
      resumeAutomationEndpoint(res, route);
      return;
    }

    if (method === "GET" && route === "/ops/resume/last") {
      getLastResumeSummaryEndpoint(res, route);
      return;
    }

    if (method === "POST" && route === "/ops/rate/evaluate") {
      await evaluateRatePolicyEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/ops/retry/evaluate") {
      await evaluateRetryPolicyEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/learning/modifiers/evaluate") {
      await evaluateLearningModifiersEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/learning/affinity/route") {
      await affinityRouteEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/learning/meetings/capture") {
      await captureMeetingSummaryEndpoint(req, res, route);
      return;
    }

    if (method === "POST" && route === "/filing/suggestions/propose") {
      await proposeFilingSuggestion(req, res, route);
      return;
    }

    if (method === "GET" && route === "/filing/suggestions/list") {
      listFilingSuggestions(parsed, res, route);
      return;
    }

    const filingSuggestionApproveMatch = route.match(/^\/filing\/suggestions\/([^/]+)\/approve$/);
    if (method === "POST" && filingSuggestionApproveMatch) {
      const suggestionId = decodeURIComponent(filingSuggestionApproveMatch[1] || "").trim();
      await approveFilingSuggestion(suggestionId, req, res, route);
      return;
    }

    if (method === "GET" && route === "/triage/patterns") {
      listPatternsEndpoint(res, route);
      return;
    }

    if (method === "POST" && route === "/triage/patterns/propose") {
      await proposePattern(req, res, route);
      return;
    }

    const triagePatternApproveMatch = route.match(/^\/triage\/patterns\/([^/]+)\/approve$/);
    if (method === "POST" && triagePatternApproveMatch) {
      const patternId = decodeURIComponent(triagePatternApproveMatch[1] || "").trim();
      await approvePattern(patternId, req, res, route);
      return;
    }

    const triageLinkMatch = route.match(/^\/triage\/([^/]+)\/link$/);
    if (method === "POST" && triageLinkMatch) {
      const itemId = decodeURIComponent(triageLinkMatch[1] || "").trim();
      await linkTriageItem(itemId, req, res, route);
      return;
    }

    if (method === "GET" && (route === "/status" || route === "/doctor")) {
      const payload = buildPayload();
      sendJson(res, 200, payload);
      logLine(`${method} ${route} -> 200`);
      return;
    }

    const graphStatusMatch = route.match(/^\/graph\/([^/]+)\/status$/);
    if (method === "GET" && graphStatusMatch) {
      const profileId = decodeURIComponent(graphStatusMatch[1] || "").trim();
      if (!profileId) {
        sendJson(res, 400, { error: "invalid_profile_id" });
        logLine(`${method} ${route} -> 400`);
        return;
      }
      if (!GRAPH_ALLOWED_PROFILES.has(profileId)) {
        sendJson(res, 400, { error: "unsupported_profile_id" });
        logLine(`${method} ${route} -> 400`);
        return;
      }
      const graphStatusResult = buildGraphStatusPayload(profileId);
      // JC-088d: Graph sync ledger write
      try {
        appendJsonlLine(graphSyncLedgerPath, {
          kind: "graph_status_check",
          profile_id: profileId,
          status: graphStatusResult.auth_state,
          at: new Date().toISOString(),
        });
        appendEvent("graph.sync.completed", "/graph/status", { profile_id: profileId });
      } catch (err) {
        logLine(`GRAPH_SYNC_LEDGER_WRITE_ERROR: ${err?.message || String(err)}`);
      }
      sendJson(res, 200, graphStatusResult);
      logLine(`${method} ${route} -> 200`);
      return;
    }

    const graphCalendarListMatch = route.match(/^\/graph\/([^/]+)\/calendar\/list$/);
    if (method === "GET" && graphCalendarListMatch) {
      const profileId = decodeURIComponent(graphCalendarListMatch[1] || "").trim();
      await listGraphCalendar(profileId, parsed, res, route);
      return;
    }

    const graphDeviceStartMatch = route.match(/^\/graph\/([^/]+)\/auth\/device\/start$/);
    if (method === "POST" && graphDeviceStartMatch) {
      const profileId = decodeURIComponent(graphDeviceStartMatch[1] || "").trim();
      await startGraphDeviceCode(profileId, res, route);
      return;
    }

    const graphDevicePollMatch = route.match(/^\/graph\/([^/]+)\/auth\/device\/poll$/);
    if (method === "POST" && graphDevicePollMatch) {
      const profileId = decodeURIComponent(graphDevicePollMatch[1] || "").trim();
      await pollGraphDeviceCode(profileId, req, res, route);
      return;
    }

    const graphRevokeMatch = route.match(/^\/graph\/([^/]+)\/auth\/revoke$/);
    if (method === "POST" && graphRevokeMatch) {
      const profileId = decodeURIComponent(graphRevokeMatch[1] || "").trim();
      if (!GRAPH_ALLOWED_PROFILES.has(profileId)) {
        setGraphLastError(profileId, "unsupported_profile_id");
        sendJson(res, 400, { profile_id: profileId, error: "unsupported_profile_id" });
        logLine(`${method} ${route} -> 400`);
        return;
      }
      revokeTokenRecord(profileId);
      clearGraphLastError(profileId);
      appendAudit("GRAPH_AUTH_REVOKE", { profile_id: profileId });
      // JC-088d: Graph auth revoked event
      try {
        appendEvent("graph.auth.revoked", "/graph/auth/revoke", { profile_id: profileId });
      } catch {
        /* non-fatal */
      }
      sendJson(res, 200, { profile_id: profileId, revoked: true });
      logLine(`${method} ${route} -> 200`);
      return;
    }

    const graphDraftCreateMatch = route.match(/^\/graph\/([^/]+)\/mail\/draft\/create$/);
    if (method === "POST" && graphDraftCreateMatch) {
      const profileId = decodeURIComponent(graphDraftCreateMatch[1] || "").trim();
      await createGraphDraft(profileId, req, res, route);
      return;
    }

    const graphDraftsGenerateMatch = route.match(/^\/graph\/([^/]+)\/drafts\/generate$/);
    if (method === "POST" && graphDraftsGenerateMatch) {
      const profileId = decodeURIComponent(graphDraftsGenerateMatch[1] || "").trim();
      await generateDraftsFromInbox(profileId, req, res, route);
      return;
    }

    const graphMailListMatch = route.match(/^\/graph\/([^/]+)\/mail\/list$/);
    if (method === "GET" && graphMailListMatch) {
      const profileId = decodeURIComponent(graphMailListMatch[1] || "").trim();
      await listGraphMail(profileId, parsed, res, route);
      return;
    }

    const graphMailMoveMatch = route.match(/^\/graph\/([^/]+)\/mail\/([^/]+)\/move$/);
    if (method === "POST" && graphMailMoveMatch) {
      const profileId = decodeURIComponent(graphMailMoveMatch[1] || "").trim();
      const messageId = decodeURIComponent(graphMailMoveMatch[2] || "").trim();
      await moveGraphMessage(profileId, messageId, req, res, route);
      return;
    }

    const graphCalendarEventCreateMatch = route.match(
      /^\/graph\/([^/]+)\/calendar\/event\/create$/,
    );
    if (method === "POST" && graphCalendarEventCreateMatch) {
      const profileId = decodeURIComponent(graphCalendarEventCreateMatch[1] || "").trim();
      await createGraphCalendarEvent(profileId, req, res, route);
      return;
    }

    // ─── Phase 16-21: Planner + To Do + Sync Dispatch ───

    const graphPlannerPlansMatch = route.match(/^\/graph\/([^/]+)\/planner\/plans$/);
    if (method === "GET" && graphPlannerPlansMatch) {
      const profileId = decodeURIComponent(graphPlannerPlansMatch[1] || "").trim();
      await listPlannerPlans(profileId, res, route);
      return;
    }

    const graphPlannerTasksMatch = route.match(
      /^\/graph\/([^/]+)\/planner\/plans\/([^/]+)\/tasks$/,
    );
    if (method === "GET" && graphPlannerTasksMatch) {
      const profileId = decodeURIComponent(graphPlannerTasksMatch[1] || "").trim();
      const planId = decodeURIComponent(graphPlannerTasksMatch[2] || "").trim();
      await listPlannerTasks(profileId, planId, parsed, res, route);
      return;
    }

    const graphTodoListsMatch = route.match(/^\/graph\/([^/]+)\/todo\/lists$/);
    if (method === "GET" && graphTodoListsMatch) {
      const profileId = decodeURIComponent(graphTodoListsMatch[1] || "").trim();
      await listTodoLists(profileId, res, route);
      return;
    }

    const graphTodoTasksMatch = route.match(/^\/graph\/([^/]+)\/todo\/lists\/([^/]+)\/tasks$/);
    if (method === "GET" && graphTodoTasksMatch) {
      const profileId = decodeURIComponent(graphTodoTasksMatch[1] || "").trim();
      const listId = decodeURIComponent(graphTodoTasksMatch[2] || "").trim();
      await listTodoTasks(profileId, listId, parsed, res, route);
      return;
    }

    const graphExtractCommitmentsMatch = route.match(
      /^\/graph\/([^/]+)\/mail\/([^/]+)\/extract-commitments$/,
    );
    if (method === "POST" && graphExtractCommitmentsMatch) {
      const profileId = decodeURIComponent(graphExtractCommitmentsMatch[1] || "").trim();
      const messageId = decodeURIComponent(graphExtractCommitmentsMatch[2] || "").trim();
      await extractCommitmentsFromEmail(profileId, messageId, req, res, route);
      return;
    }

    const graphSyncReconcileMatch = route.match(/^\/graph\/([^/]+)\/sync\/reconcile$/);
    if (method === "GET" && graphSyncReconcileMatch) {
      const profileId = decodeURIComponent(graphSyncReconcileMatch[1] || "").trim();
      await reconcile(profileId, parsed, res, route);
      return;
    }

    const graphSyncProposalsMatch = route.match(/^\/graph\/([^/]+)\/sync\/proposals$/);
    if (method === "GET" && graphSyncProposalsMatch) {
      const profileId = decodeURIComponent(graphSyncProposalsMatch[1] || "").trim();
      syncListProposals(profileId, parsed, res, route);
      return;
    }

    const graphSyncApproveMatch = route.match(
      /^\/graph\/([^/]+)\/sync\/proposals\/([^/]+)\/approve$/,
    );
    if (method === "POST" && graphSyncApproveMatch) {
      const profileId = decodeURIComponent(graphSyncApproveMatch[1] || "").trim();
      const proposalId = decodeURIComponent(graphSyncApproveMatch[2] || "").trim();
      await syncApprove(profileId, proposalId, req, res, route);
      return;
    }

    const graphSyncRejectMatch = route.match(
      /^\/graph\/([^/]+)\/sync\/proposals\/([^/]+)\/reject$/,
    );
    if (method === "POST" && graphSyncRejectMatch) {
      const profileId = decodeURIComponent(graphSyncRejectMatch[1] || "").trim();
      const proposalId = decodeURIComponent(graphSyncRejectMatch[2] || "").trim();
      await syncReject(profileId, proposalId, req, res, route);
      return;
    }

    // ─── SharePoint Routes ───

    const spSitesMatch = route.match(/^\/graph\/([^/]+)\/sharepoint\/sites$/);
    if (method === "GET" && spSitesMatch) {
      const profileId = decodeURIComponent(spSitesMatch[1] || "").trim();
      if (!isSlugSafe(profileId)) {
        sendJson(res, 400, { error: "invalid_profile_id" });
        return;
      }
      await sharePointListSites(profileId, res, route);
      return;
    }

    const spDrivesMatch = route.match(/^\/graph\/([^/]+)\/sharepoint\/sites\/([^/]+)\/drives$/);
    if (method === "GET" && spDrivesMatch) {
      const profileId = decodeURIComponent(spDrivesMatch[1] || "").trim();
      const siteId = decodeURIComponent(spDrivesMatch[2] || "").trim();
      if (!isSlugSafe(profileId)) {
        sendJson(res, 400, { error: "invalid_profile_id" });
        return;
      }
      await sharePointListDrives(profileId, siteId, res, route);
      return;
    }

    const spItemsMatch = route.match(/^\/graph\/([^/]+)\/sharepoint\/drives\/([^/]+)\/items$/);
    if (method === "GET" && spItemsMatch) {
      const profileId = decodeURIComponent(spItemsMatch[1] || "").trim();
      const driveId = decodeURIComponent(spItemsMatch[2] || "").trim();
      if (!isSlugSafe(profileId)) {
        sendJson(res, 400, { error: "invalid_profile_id" });
        return;
      }
      await sharePointListItems(profileId, driveId, parsed, res, route);
      return;
    }

    const spItemMatch = route.match(
      /^\/graph\/([^/]+)\/sharepoint\/drives\/([^/]+)\/items\/([^/]+)$/,
    );
    if (method === "GET" && spItemMatch) {
      const profileId = decodeURIComponent(spItemMatch[1] || "").trim();
      const driveId = decodeURIComponent(spItemMatch[2] || "").trim();
      const itemId = decodeURIComponent(spItemMatch[3] || "").trim();
      if (!isSlugSafe(profileId)) {
        sendJson(res, 400, { error: "invalid_profile_id" });
        return;
      }
      await sharePointGetItem(profileId, driveId, itemId, res, route);
      return;
    }

    const spSearchMatch = route.match(/^\/graph\/([^/]+)\/sharepoint\/drives\/([^/]+)\/search$/);
    if (method === "GET" && spSearchMatch) {
      const profileId = decodeURIComponent(spSearchMatch[1] || "").trim();
      const driveId = decodeURIComponent(spSearchMatch[2] || "").trim();
      if (!isSlugSafe(profileId)) {
        sendJson(res, 400, { error: "invalid_profile_id" });
        return;
      }
      await sharePointSearch(profileId, driveId, parsed, res, route);
      return;
    }

    const spUploadMatch = route.match(/^\/graph\/([^/]+)\/sharepoint\/drives\/([^/]+)\/upload$/);
    if (method === "POST" && spUploadMatch) {
      const profileId = decodeURIComponent(spUploadMatch[1] || "").trim();
      const driveId = decodeURIComponent(spUploadMatch[2] || "").trim();
      if (!isSlugSafe(profileId)) {
        sendJson(res, 400, { error: "invalid_profile_id" });
        return;
      }
      await sharePointUpload(profileId, driveId, req, res, route);
      return;
    }

    const spFolderMatch = route.match(/^\/graph\/([^/]+)\/sharepoint\/drives\/([^/]+)\/folder$/);
    if (method === "POST" && spFolderMatch) {
      const profileId = decodeURIComponent(spFolderMatch[1] || "").trim();
      const driveId = decodeURIComponent(spFolderMatch[2] || "").trim();
      if (!isSlugSafe(profileId)) {
        sendJson(res, 400, { error: "invalid_profile_id" });
        return;
      }
      await sharePointCreateFolder(profileId, driveId, req, res, route);
      return;
    }

    // Improvement Proposals (Codex Builder Lane)
    if (method === "GET" && /^\/improvement\/proposals$/.test(route)) {
      return listImprovementProposals(parsed, res, "/improvement/proposals");
    }
    if (method === "POST" && route === "/improvement/proposals") {
      return createImprovementProposal(req, res, "/improvement/proposals/create");
    }
    const improvementReviewMatch = route.match(/^\/improvement\/proposals\/([^/]+)\/review$/);
    if (improvementReviewMatch && method === "POST") {
      return reviewImprovementProposal(
        improvementReviewMatch[1],
        req,
        res,
        "/improvement/proposals/review",
      );
    }
    const improvementApplyMatch = route.match(/^\/improvement\/proposals\/([^/]+)\/apply$/);
    if (improvementApplyMatch && method === "POST") {
      return applyImprovementProposal(
        improvementApplyMatch[1],
        req,
        res,
        "/improvement/proposals/apply",
      );
    }
    if (method === "POST" && route === "/improvement/proposals/generate") {
      return generateImprovementProposal(req, res, "/improvement/proposals/generate");
    }
    if (method === "GET" && /^\/improvement\/failure-aggregation$/.test(route)) {
      return aggregateTrustFailures(parsed, res, "/improvement/failure-aggregation");
    }

    // Builder Lane routes (BL-007)
    if (method === "GET" && route === "/ops/builder-lane/patterns") {
      const detection = detectCorrectionPatterns();
      sendJson(res, 200, { ok: true, ...detection });
      logLine(`GET ${route} -> 200`);
      return;
    }
    if (method === "POST" && route === "/ops/builder-lane/generate") {
      const body = await readJsonBodyGuarded(req, res, route);
      if (!body) {
        return;
      }
      const domain = typeof body.domain === "string" ? body.domain : null;
      const contextBucket = body.context_bucket || {};
      if (!domain) {
        sendJson(res, 400, { error: "domain_required" });
        return;
      }
      const detection = detectCorrectionPatterns();
      const pattern = detection.patterns.find(
        (p) =>
          p.domain === domain && JSON.stringify(p.context_bucket) === JSON.stringify(contextBucket),
      );
      if (!pattern) {
        sendJson(res, 404, { error: "pattern_not_found", domain });
        return;
      }
      const result = await generatePatternProposal(pattern);
      sendJson(res, result.ok ? 200 : 409, result);
      logLine(`POST ${route} -> ${result.ok ? 200 : 409}`);
      return;
    }
    const builderLaneRevertMatch = route.match(/^\/ops\/builder-lane\/revert\/([^/]+)$/);
    if (method === "POST" && builderLaneRevertMatch) {
      const proposalId = decodeURIComponent(builderLaneRevertMatch[1] || "").trim();
      // Require operator approval for revert
      const approvalSource = req.headers["x-ted-approval-source"];
      if (approvalSource !== "operator") {
        sendJson(res, 403, {
          error: "OPERATOR_APPROVAL_REQUIRED",
          message: "Reverting a config change requires operator confirmation.",
        });
        appendEvent("governance.operator_required.blocked", route, {
          action: "builder_lane_revert",
          approval_source: approvalSource || "none",
        });
        return;
      }
      revertImprovement(proposalId, res, route);
      return;
    }
    if (method === "GET" && route === "/ops/builder-lane/status") {
      builderLaneStatus(res, route);
      return;
    }
    if (method === "GET" && route === "/ops/builder-lane/improvement-metrics") {
      builderLaneImprovementMetrics(res, route);
      return;
    }
    if (method === "POST" && route === "/ops/builder-lane/calibration-response") {
      await builderLaneCalibrationResponse(req, res, route);
      return;
    }
    // BL-013: Shadow mode routes (POST=start or complete, GET=status)
    if (/^\/ops\/builder-lane\/shadow\/[^/]+$/.test(route)) {
      const shadowProposalId = route.split("/").pop();
      if (method === "POST") {
        const body = await readJsonBodyGuarded(req, res, route);
        if (!body) {
          return;
        }
        if (body.action === "complete") {
          await completeShadowRun(shadowProposalId, req, res, route);
        } else {
          await startShadowRun(shadowProposalId, req, res, route);
        }
        return;
      }
      if (method === "GET") {
        getShadowStatus(shadowProposalId, res, route);
        return;
      }
    }
    // BL-014: Correction amplification
    if (method === "POST" && route === "/ops/builder-lane/amplify") {
      await amplifyCorrection(req, res, route);
      return;
    }
    // BL-016: Cold-start archetype selection + voice extraction
    if (method === "POST" && route === "/ops/onboarding/archetype-select") {
      await selectArchetype(req, res, route);
      return;
    }
    if (method === "POST" && route === "/ops/onboarding/voice-extract") {
      await startVoiceExtraction(req, res, route);
      return;
    }
    if (method === "GET" && route === "/ops/onboarding/voice-extract-status") {
      getVoiceExtractionStatus(res, route);
      return;
    }

    // ─── Self-Healing Routes (SH-001 through SH-006) ───
    if (method === "GET" && route === "/ops/self-healing/status") {
      const cbStates = [];
      for (const [group, cb] of _circuitBreakerState.entries()) {
        _pruneWindow(cb);
        const failures = cb.window.filter((e) => !e.success).length;
        const slowCalls = cb.window.filter((e) => e.latencyMs > CB_SLOW_CALL_MS).length;
        cbStates.push({
          workload_group: group,
          state: cb.state,
          failure_rate: cb.window.length > 0 ? +(failures / cb.window.length).toFixed(3) : 0,
          call_count: cb.window.length,
          slow_call_count: slowCalls,
          opened_at: cb.openedAt ? new Date(cb.openedAt).toISOString() : null,
          cooldown_ms: cb.cooldownMs,
          probe_in_flight: cb.probeInFlight,
        });
      }
      const providerHealth = getProviderHealthSummary();
      const configDriftStatus = [];
      for (const name of MONITORED_CONFIGS) {
        const filePath = path.join(_selfHealingConfigDir, name);
        const stored = _configHashes.get(filePath);
        configDriftStatus.push({
          file: name,
          hash: stored?.hash || null,
          last_checked: stored?.lastChecked || null,
          exists: fs.existsSync(filePath),
        });
      }
      sendJson(res, 200, {
        circuit_breakers: cbStates,
        provider_health: providerHealth,
        config_drift: { files_monitored: MONITORED_CONFIGS.length, status: configDriftStatus },
        compaction: { archive_dir: archiveDir, archive_exists: fs.existsSync(archiveDir) },
        proposal_expiry: { enabled: true, max_age_days: 30, resurrection_grace_days: 14 },
      });
      logLine(`GET ${route} -> 200`);
      return;
    }
    if (method === "GET" && route === "/ops/self-healing/circuit-breakers") {
      const result = [];
      for (const [group, cb] of _circuitBreakerState.entries()) {
        _pruneWindow(cb);
        const failures = cb.window.filter((e) => !e.success).length;
        const slowCalls = cb.window.filter((e) => e.latencyMs > CB_SLOW_CALL_MS).length;
        result.push({
          workload_group: group,
          state: cb.state,
          failure_rate: cb.window.length > 0 ? +(failures / cb.window.length).toFixed(3) : 0,
          call_count: cb.window.length,
          slow_call_count: slowCalls,
          opened_at: cb.openedAt ? new Date(cb.openedAt).toISOString() : null,
          cooldown_ms: cb.cooldownMs,
          probe_in_flight: cb.probeInFlight,
        });
      }
      sendJson(res, 200, { circuit_breakers: result });
      logLine(`GET ${route} -> 200`);
      return;
    }
    if (method === "GET" && route === "/ops/self-healing/provider-health") {
      sendJson(res, 200, { providers: getProviderHealthSummary() });
      logLine(`GET ${route} -> 200`);
      return;
    }
    if (method === "POST" && route === "/ops/self-healing/config-drift/reconcile") {
      const result = checkConfigDrift();
      sendJson(res, 200, result);
      logLine(`POST ${route} -> 200 drift_count=${result.drift_count}`);
      return;
    }
    if (method === "POST" && route === "/ops/self-healing/compact-ledgers") {
      if (_compactionRunning) {
        sendJson(res, 409, { error: "compaction_already_running" });
        logLine(`POST ${route} -> 409`);
        return;
      }
      _compactionRunning = true;
      try {
        const dirs = [artifactsDir];
        const results = [];
        for (const dir of dirs) {
          if (!fs.existsSync(dir)) {
            continue;
          }
          const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
          for (const f of files) {
            const result = compactLedger(path.join(dir, f));
            if (result.archived > 0) {
              results.push({ file: f, ...result });
            }
          }
        }
        appendEvent("self_healing.ledger.compacted", "self_healing", {
          total_archived: results.reduce((s, r) => s + r.archived, 0),
          ledgers_compacted: results.length,
        });
        sendJson(res, 200, { ok: true, compacted: results });
        logLine(`POST ${route} -> 200 compacted=${results.length}`);
      } finally {
        _compactionRunning = false;
      }
      return;
    }
    if (method === "POST" && route === "/ops/self-healing/expire-proposals") {
      const result = expireStaleProposals();
      sendJson(res, 200, { ok: true, ...result });
      logLine(`POST ${route} -> 200 expired=${result.expired}`);
      return;
    }
    const resurrectMatch = route.match(/^\/ops\/builder-lane\/proposals\/([^/]+)\/resurrect$/);
    if (method === "POST" && resurrectMatch) {
      const proposalId = decodeURIComponent(resurrectMatch[1]);
      const result = resurrectProposal(proposalId);
      if (!result) {
        sendJson(res, 404, { error: "proposal_not_found" });
        logLine(`POST ${route} -> 404`);
      } else if (result.error) {
        sendJson(res, 400, result);
        logLine(`POST ${route} -> 400 ${result.error}`);
      } else {
        sendJson(res, 200, result);
        logLine(`POST ${route} -> 200`);
      }
      return;
    }

    // ─── Phase B Self-Healing Routes (SH-007 through SH-011) ───
    if (method === "GET" && route === "/ops/self-healing/correction-taxonomy") {
      const breakdown = getCorrectionTaxonomyBreakdown();
      sendJson(res, 200, { taxonomy: breakdown, subcategories: CORRECTION_SUBCATEGORIES });
      logLine(`GET ${route} -> 200`);
      return;
    }
    if (method === "POST" && route === "/ops/engagement/read-receipt") {
      const body = await readJsonBodyGuarded(req, res, route);
      if (!body) {
        return;
      }
      recordEngagement(
        body.content_type,
        body.delivered_at || new Date().toISOString(),
        new Date().toISOString(),
        null,
        null,
      );
      sendJson(res, 200, { recorded: true, engagement_type: "read_only" });
      logLine(`POST ${route} -> 200`);
      return;
    }
    if (method === "POST" && route === "/ops/engagement/action-receipt") {
      const body = await readJsonBodyGuarded(req, res, route);
      if (!body) {
        return;
      }
      const actionAt = new Date();
      const deliveredAt = body.delivered_at || actionAt.toISOString();
      recordEngagement(
        body.content_type,
        deliveredAt,
        deliveredAt,
        actionAt.toISOString(),
        body.duration_ms || null,
      );
      const actionLatency = actionAt.getTime() - new Date(deliveredAt).getTime();
      sendJson(res, 200, { recorded: true, action_latency_ms: actionLatency });
      logLine(`POST ${route} -> 200`);
      return;
    }
    if (method === "GET" && route === "/ops/self-healing/engagement-insights") {
      sendJson(res, 200, getEngagementInsights());
      logLine(`GET ${route} -> 200`);
      return;
    }
    if (method === "GET" && route === "/ops/self-healing/noise-level") {
      const level = assessDisengagementLevel();
      sendJson(res, 200, level);
      logLine(`GET ${route} -> 200 level=${level.level}`);
      return;
    }
    if (method === "GET" && route === "/ops/self-healing/autonomy-status") {
      sendJson(res, 200, getAutonomyStatus());
      logLine(`GET ${route} -> 200`);
      return;
    }

    // Trust Autonomy
    if (method === "GET" && /^\/trust\/autonomy\/evaluate$/.test(route)) {
      return evaluateTrustAutonomy(parsed, res, "/trust/autonomy/evaluate");
    }

    if (method === "POST" && route === "/extraction/deadlines") {
      await extractDeadlines(req, res, route);
      return;
    }

    if (method === "GET" && route === "/reporting/morning-brief") {
      await generateMorningBrief(parsed, res, route);
      return;
    }

    if (method === "GET" && route === "/reporting/eod-digest") {
      await generateEodDigest(parsed, res, route);
      return;
    }

    // ─── LLM Provider Management (JC-070c) ───

    if (method === "GET" && route === "/ops/llm-provider") {
      const cfg = getLlmProviderConfig();
      if (!cfg) {
        sendJson(res, 500, { error: "llm_provider_config_missing" });
        logLine(`GET ${route} -> 500`);
        return;
      }
      // Sanitize: never return API keys
      const sanitized = JSON.parse(JSON.stringify(cfg));
      for (const [, providerCfg] of Object.entries(sanitized.providers || {})) {
        if (providerCfg.api_key_env) {
          providerCfg.api_key_set = !!process.env[providerCfg.api_key_env];
          delete providerCfg.api_key_env;
        }
        if (providerCfg.endpoint_env) {
          providerCfg.endpoint_set = !!process.env[providerCfg.endpoint_env];
          delete providerCfg.endpoint_env;
        }
      }
      sendJson(res, 200, sanitized);
      logLine(`GET ${route} -> 200`);
      return;
    }

    if (method === "POST" && route === "/ops/llm-provider") {
      const body = await readJsonBodyGuarded(req, res, route);
      if (!body || typeof body !== "object") {
        sendJson(res, 400, { error: "invalid_json_body" });
        logLine(`POST ${route} -> 400`);
        return;
      }
      const cfg = getLlmProviderConfig();
      if (!cfg) {
        sendJson(res, 500, { error: "llm_provider_config_missing" });
        logLine(`POST ${route} -> 500`);
        return;
      }
      let updated = false;
      if (typeof body.default_provider === "string") {
        const validProviders = [...Object.keys(cfg.providers || {}), "disabled"];
        if (!validProviders.includes(body.default_provider)) {
          sendJson(res, 400, { error: "invalid_provider", valid: validProviders });
          logLine(`POST ${route} -> 400`);
          return;
        }
        cfg.default_provider = body.default_provider;
        updated = true;
      }
      if (body.per_job_overrides && typeof body.per_job_overrides === "object") {
        cfg.per_job_overrides = { ...cfg.per_job_overrides, ...body.per_job_overrides };
        updated = true;
      }
      if (updated) {
        try {
          fs.writeFileSync(llmProviderConfigPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
          appendAudit("LLM_PROVIDER_UPDATE", {
            default_provider: cfg.default_provider,
            per_job_count: Object.keys(cfg.per_job_overrides || {}).length,
          });
          appendJsonlLine(policyLedgerPath, {
            kind: "policy_config_changed",
            config_key: "llm_provider",
            changed_by: "operator",
            timestamp: new Date().toISOString(),
          });
          appendEvent("policy.config.changed", route, { config_key: "llm_provider" });
        } catch (err) {
          sendJson(res, 500, { error: "config_write_failed", detail: err.message });
          logLine(`POST ${route} -> 500`);
          return;
        }
      }
      sendJson(res, 200, { updated, default_provider: cfg.default_provider });
      logLine(`POST ${route} -> 200`);
      return;
    }

    // ─── Notification Budget Status (JC-084a) ───

    if (method === "GET" && route === "/ops/notification-budget") {
      const budget = getNotificationBudget();
      const onboarding = getOnboardingPhase();
      sendJson(res, 200, {
        budget: budget || { error: "not_configured" },
        onboarding,
        today_count: dailyNotificationCount,
        today_date: dailyNotificationDate,
      });
      logLine(`GET ${route} -> 200`);
      return;
    }

    if (method === "POST" && route === "/graph/diagnostics/classify") {
      const body = await readJsonBodyGuarded(req, res, route);
      if (!body) {
        return;
      }
      const errorText = typeof body?.error_text === "string" ? body.error_text : "";
      if (!errorText.trim()) {
        sendJsonPretty(res, 400, { error: "error_text_required" });
        logLine(`${method} ${route} -> 400`);
        return;
      }
      const result = classifyGraphErrorText(errorText);
      sendJsonPretty(res, 200, result);
      logLine(`${method} ${route} -> 200`);
      return;
    }

    // ─── Phase 6: Meeting Lifecycle (JC-077) ───
    if (method === "GET" && route === "/meeting/upcoming") {
      await meetingUpcoming(parsed, res, route);
      return;
    }

    const meetingPrepMatch = route.match(/^\/meeting\/prep\/([^/]+)$/);
    if (method === "POST" && meetingPrepMatch) {
      const eventId = decodeURIComponent(meetingPrepMatch[1] || "").trim();
      await meetingPrepGenerate(eventId, req, res, route);
      return;
    }

    if (method === "POST" && route === "/meeting/debrief") {
      await meetingDebrief(req, res, route);
      return;
    }

    // ─── Phase 6: Commitment Tracking (JC-078) ───
    if (method === "POST" && route === "/commitments/create") {
      await commitmentCreate(req, res, route);
      return;
    }

    if (method === "GET" && route === "/commitments/list") {
      commitmentList(parsed, res, route);
      return;
    }

    const commitmentCompleteMatch = route.match(/^\/commitments\/([^/]+)\/complete$/);
    if (method === "POST" && commitmentCompleteMatch) {
      const commitmentId = decodeURIComponent(commitmentCompleteMatch[1] || "").trim();
      await commitmentComplete(commitmentId, req, res, route);
      return;
    }

    // ─── Phase 6: GTD Actions (JC-079) ───
    if (method === "POST" && route === "/gtd/actions/create") {
      await gtdActionCreate(req, res, route);
      return;
    }

    if (method === "GET" && route === "/gtd/actions/list") {
      gtdActionsList(parsed, res, route);
      return;
    }

    const gtdActionCompleteMatch = route.match(/^\/gtd\/actions\/([^/]+)\/complete$/);
    if (method === "POST" && gtdActionCompleteMatch) {
      const actionId = decodeURIComponent(gtdActionCompleteMatch[1] || "").trim();
      await gtdActionComplete(actionId, req, res, route);
      return;
    }

    if (method === "POST" && route === "/gtd/waiting-for/create") {
      await gtdWaitingForCreate(req, res, route);
      return;
    }

    if (method === "GET" && route === "/gtd/waiting-for/list") {
      gtdWaitingForList(parsed, res, route);
      return;
    }

    // ─── Phase 7: Time-Block Planning (JC-081) ───
    if (method === "POST" && route === "/planning/timeblock/generate") {
      await timeblockGenerate(req, res, route);
      return;
    }

    // ─── Phase 7: PARA Filing (JC-082) ───
    if (method === "POST" && route === "/filing/para/classify") {
      await paraClassify(req, res, route);
      return;
    }

    if (method === "GET" && route === "/filing/para/structure") {
      paraStructure(res, route);
      return;
    }

    // ─── Phase 7: Deep Work Metrics (JC-083) ───
    if (method === "GET" && route === "/reporting/deep-work-metrics") {
      deepWorkMetrics(parsed, res, route);
      return;
    }

    // ─── Phase 8: Trust Metrics (JC-085) ───
    if (method === "GET" && route === "/reporting/trust-metrics") {
      trustMetrics(parsed, res, route);
      return;
    }

    // ─── Event Log Stats (JC-087e) ───
    if (method === "GET" && route === "/events/stats") {
      const stats = getEventLogStats();
      sendJson(res, 200, stats);
      logLine(`GET ${route} -> 200`);
      return;
    }

    if (method === "GET" && route === "/events/recent") {
      const limit = parseInt(parsed.searchParams.get("limit") || "50", 10);
      const eventType = parsed.searchParams.get("event_type") || undefined;
      const events = readEventLog({ event_type: eventType, limit: Math.min(limit, 200) });
      sendJson(res, 200, { events, count: events.length });
      logLine(`GET ${route} -> 200`);
      return;
    }

    // ─── JC-110d: Deep Work Session Route ───
    if (method === "POST" && route === "/deep-work/session") {
      await recordDeepWorkSession(req, res, route);
      return;
    }

    // ─── JC-110e: Graph Sync Status Route ───
    const graphSyncStatusMatch = route.match(/^\/graph\/([^/]+)\/sync\/status$/);
    if (method === "GET" && graphSyncStatusMatch) {
      const profileId = decodeURIComponent(graphSyncStatusMatch[1] || "").trim();
      graphSyncStatus(profileId, parsed, res, route);
      return;
    }

    // ─── Phase 11: Draft Queue Routes (JC-089) ───

    if (method === "GET" && route === "/drafts/queue") {
      draftQueueList(parsed, res, route);
      return;
    }
    const draftGetMatch = route.match(/^\/drafts\/([^/]+)$/);
    if (method === "GET" && draftGetMatch && !route.includes("/queue")) {
      const draftId = decodeURIComponent(draftGetMatch[1] || "").trim();
      draftQueueGet(draftId, res, route);
      return;
    }
    const draftSubmitReviewMatch = route.match(/^\/drafts\/([^/]+)\/submit-review$/);
    if (method === "POST" && draftSubmitReviewMatch) {
      const draftId = decodeURIComponent(draftSubmitReviewMatch[1] || "").trim();
      await draftQueueSubmitForReview(draftId, req, res, route);
      return;
    }
    const draftEditMatch = route.match(/^\/drafts\/([^/]+)\/edit$/);
    if (method === "POST" && draftEditMatch) {
      const draftId = decodeURIComponent(draftEditMatch[1] || "").trim();
      await draftQueueEdit(draftId, req, res, route);
      return;
    }
    const draftApproveMatch = route.match(/^\/drafts\/([^/]+)\/approve$/);
    if (method === "POST" && draftApproveMatch) {
      const draftId = decodeURIComponent(draftApproveMatch[1] || "").trim();
      await draftQueueApprove(draftId, req, res, route);
      return;
    }
    const draftArchiveMatch = route.match(/^\/drafts\/([^/]+)\/archive$/);
    if (method === "POST" && draftArchiveMatch) {
      const draftId = decodeURIComponent(draftArchiveMatch[1] || "").trim();
      await draftQueueArchive(draftId, req, res, route);
      return;
    }
    const draftExecuteMatch = route.match(/^\/drafts\/([^/]+)\/execute$/);
    if (method === "POST" && draftExecuteMatch) {
      const draftId = decodeURIComponent(draftExecuteMatch[1] || "").trim();
      await draftQueueExecute(draftId, req, res, route);
      return;
    }

    // ─── Phase 13: State Machine + Facility Routes (JC-091) ───

    const commitmentEscalateMatch = route.match(/^\/commitments\/([^/]+)\/escalate$/);
    if (method === "POST" && commitmentEscalateMatch) {
      const commitmentId = decodeURIComponent(commitmentEscalateMatch[1] || "").trim();
      await commitmentEscalate(commitmentId, req, res, route);
      return;
    }

    const investorOigMatch = route.match(/^\/deals\/([^/]+)\/investors\/([^/]+)\/oig-update$/);
    if (method === "POST" && investorOigMatch) {
      const dealId = decodeURIComponent(investorOigMatch[1] || "").trim();
      const investorName = decodeURIComponent(investorOigMatch[2] || "").trim();
      await investorOigUpdate(dealId, investorName, req, res, route);
      return;
    }

    if (method === "POST" && route === "/facility/alert/create") {
      await facilityAlertCreate(req, res, route);
      return;
    }
    if (method === "GET" && route === "/facility/alerts/list") {
      facilityAlertsList(parsed, res, route);
      return;
    }
    const facilityEscalateMatch = route.match(/^\/facility\/alert\/([^/]+)\/escalate$/);
    if (method === "POST" && facilityEscalateMatch) {
      const alertId = decodeURIComponent(facilityEscalateMatch[1] || "").trim();
      await facilityAlertEscalate(alertId, req, res, route);
      return;
    }
    const facilityResolveMatch = route.match(/^\/facility\/alert\/([^/]+)\/resolve$/);
    if (method === "POST" && facilityResolveMatch) {
      const alertId = decodeURIComponent(facilityResolveMatch[1] || "").trim();
      await facilityAlertResolve(alertId, req, res, route);
      return;
    }

    // ─── MCP Endpoint (JC-073a) ───
    if (method === "POST" && route === "/mcp") {
      await handleMcpRequest(req, res, route);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
    logLine(`${method} ${route} -> 404`);
  } catch (err) {
    logLine("UNHANDLED: " + (err && err.message ? err.message : String(err)));
    try {
      appendEvent("server.unhandled_error", req.url || "/unknown", {
        error: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : undefined,
      });
    } catch {
      /* event log write must not throw */
    }
    if (!res.headersSent) {
      try {
        sendJson(res, 500, { error: "internal_server_error" });
      } catch {
        res.end();
      }
    }
  }
});

server.listen(PORT, HOST, () => {
  logLine(`ted-engine listening on http://${HOST}:${PORT}`);
  process.stdout.write(`ted-engine listening on http://${HOST}:${PORT}\n`);
  // MF-6: Start scheduler if enabled
  const schedulerCfg = getSchedulerConfig();
  if (schedulerCfg.enabled) {
    schedulerInterval = setInterval(() => schedulerTick(), schedulerCfg.tick_interval_ms || 60000);
    schedulerInterval.unref();
    logLine(`SCHEDULER: Auto-started (tick=${schedulerCfg.tick_interval_ms || 60000}ms)`);
    try {
      appendEvent("scheduler.started", "startup", {
        tick_interval_ms: schedulerCfg.tick_interval_ms || 60000,
      });
    } catch {
      /* non-fatal */
    }
  }
  // C12-003: Startup recovery — check for incomplete scheduled deliveries
  try {
    const pendingDeliveries = readJsonlLines(pendingDeliveryPath);
    const incomplete = pendingDeliveries.filter(
      (d) => d.status === "dispatched" && !d.completed_at,
    );
    if (incomplete.length > 0) {
      logLine(
        `STARTUP_RECOVERY: Found ${incomplete.length} incomplete scheduled delivery/deliveries`,
      );
      appendEvent("server.startup_recovery", "startup", {
        incomplete_deliveries: incomplete.length,
        job_ids: incomplete.map((d) => d.job_id),
      });
    }
  } catch {
    /* non-fatal — pending_delivery may not exist yet */
  }
});

server.on("error", (err) => {
  logLine(`server_error ${err.message}`);
  process.stderr.write(`ted-engine error: ${err.message}\n`);
  process.exitCode = 1;
});

const shutdown = () => {
  logLine("shutdown");
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  server.close(() => {
    logStream.end();
    process.exit(0);
  });
  setTimeout(() => {
    logStream.end();
    process.exit(1);
  }, 2000).unref();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("unhandledRejection", (reason) => {
  logLine("UNHANDLED_REJECTION: " + String(reason));
  try {
    appendEvent("server.unhandled_rejection", "process", { reason: String(reason) });
  } catch {
    /* non-fatal */
  }
});

process.on("uncaughtException", (err) => {
  logLine("UNCAUGHT_EXCEPTION: " + (err && err.message ? err.message : String(err)));
  try {
    appendEvent("server.uncaught_exception", "process", {
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : undefined,
    });
  } catch {
    /* non-fatal */
  }
  // C10-034: Exit after uncaught exception — delay allows log stream to flush
  setTimeout(() => process.exit(1), 200);
});
