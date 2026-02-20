#!/usr/bin/env node
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
const logStream = fs.createWriteStream(logFile, { flags: "a" });
const artifactsDir = path.join(__dirname, "artifacts");
const dealsDir = path.join(artifactsDir, "deals");
const triageDir = path.join(artifactsDir, "triage");
const triageLedgerPath = path.join(triageDir, "triage.jsonl");
const patternsDir = path.join(artifactsDir, "patterns");
const patternsLedgerPath = path.join(patternsDir, "patterns.jsonl");
const filingDir = path.join(artifactsDir, "filing");
const filingSuggestionsPath = path.join(filingDir, "suggestions.jsonl");
const graphProfilesConfigPath = path.join(__dirname, "config", "graph.profiles.json");
const graphLastErrorByProfile = new Map();
let automationPauseState = {
  paused: false,
  paused_at_ms: 0,
  reason: null,
  queued_non_critical: 0,
};

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  logStream.write(line);
}

function buildPayload() {
  return {
    version: VERSION,
    uptime: Math.floor((Date.now() - STARTED_AT_MS) / 1000),
    profiles_count: PROFILES_COUNT,
    deals_count: listDeals().length,
    triage_open_count: listOpenTriageItems().length,
  };
}

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
  });
  res.end(json);
}

function sendJsonPretty(res, statusCode, body) {
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

function getDealPath(dealId) {
  return path.join(dealsDir, `${dealId}.json`);
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
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
  } catch {
    return [];
  }
}

function appendTriageLine(record) {
  ensureDirectory(triageDir);
  fs.appendFileSync(triageLedgerPath, `${JSON.stringify(record)}\n`, "utf8");
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
  } catch {
    return [];
  }
}

function triageStateFromLines(lines) {
  const all = new Map();
  const open = new Map();
  for (const line of lines) {
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
  appendTriageLine({
    kind: "AUDIT",
    action,
    at: new Date().toISOString(),
    details,
  });
}

function blockedExplainability(reasonCode, blockedAction, nextSafeStep) {
  return {
    blocked: true,
    reason_code: reasonCode,
    blocked_action: blockedAction,
    next_safe_step: nextSafeStep,
  };
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
  const body = await readJsonBody(req).catch(() => null);
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
  const body = await readJsonBody(req).catch(() => null);
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

  appendAudit("GOV_HARD_BAN_PASS", { role_id: body.role_card.role_id });
  sendJson(res, 200, { allowed: true });
  logLine(`POST ${route} -> 200`);
}

async function validateOutputContractEndpoint(req, res, route) {
  const body = await readJsonBody(req).catch(() => null);
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
  const body = await readJsonBody(req).catch(() => null);
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
  const body = await readJsonBody(req).catch(() => null);
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
  const body = await readJsonBody(req).catch(() => null);
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
  const body = await readJsonBody(req).catch(() => null);
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
  const body = await readJsonBody(req).catch(() => null);
  const reason = isNonEmptyString(body?.reason) ? body.reason.trim() : "operator_pause";
  automationPauseState = {
    ...automationPauseState,
    paused: true,
    paused_at_ms: Date.now(),
    reason,
  };
  appendAudit("OPS_AUTOMATION_PAUSE", { reason });
  sendJson(res, 200, {
    paused: true,
    reason,
    queued_non_critical: automationPauseState.queued_non_critical,
  });
  logLine(`POST ${route} -> 200`);
}

async function dispatchCheckEndpoint(req, res, route) {
  const body = await readJsonBody(req).catch(() => null);
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
  };
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

async function evaluateRatePolicyEndpoint(req, res, route) {
  const body = await readJsonBody(req).catch(() => null);
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
  const body = await readJsonBody(req).catch(() => null);
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
  const body = await readJsonBody(req).catch(() => null);
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
  const body = await readJsonBody(req).catch(() => null);
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
}

function appendFilingSuggestionEvent(event) {
  ensureDirectory(filingDir);
  fs.appendFileSync(filingSuggestionsPath, `${JSON.stringify(event)}\n`, "utf8");
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
        // Skip malformed lines.
      }
    }
    return out;
  } catch {
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
        // Skip malformed lines.
      }
    }
    return out;
  } catch {
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
  const body = await readJsonBody(req).catch(() => null);
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
  sendJson(res, 201, { proposed: true, suggestion_id: suggestionId, status: "PROPOSED" });
  logLine(`POST ${route} -> 201`);
}

async function approveFilingSuggestion(suggestionId, req, res, route) {
  if (!suggestionId || !isSlugSafe(suggestionId)) {
    sendJson(res, 400, { error: "invalid_suggestion_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const body = await readJsonBody(req).catch(() => null);
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
  sendJson(res, 200, { approved: true, suggestion_id: suggestionId, status: "APPROVED" });
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
  const body = await readJsonBody(req).catch(() => null);
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
  sendJson(res, 201, { proposed: true, pattern_id: patternId });
  logLine(`POST ${route} -> 201`);
}

async function approvePattern(patternId, req, res, route) {
  if (!patternId || !isSlugSafe(patternId)) {
    sendJson(res, 400, { error: "invalid_pattern_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }

  const body = await readJsonBody(req).catch(() => null);
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
  sendJson(res, 200, { approved: true, pattern_id: patternId });
  logLine(`POST ${route} -> 200`);
}

async function createDeal(req, res, route) {
  const body = await readJsonBody(req).catch(() => null);
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
  const deal = {
    deal_id: dealId,
    deal_name: typeof body.deal_name === "string" ? body.deal_name : undefined,
    entity: typeof body.entity === "string" ? body.entity : undefined,
    phase: typeof body.phase === "string" ? body.phase : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    created_at: now,
    updated_at: now,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(deal, null, 2)}\n`, "utf8");
  appendAudit("DEAL_CREATE", { deal_id: dealId });
  sendJson(res, 200, { created: true, deal_id: dealId });
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
  const deals = listDeals()
    .map((deal) => ({
      deal_id: typeof deal.deal_id === "string" ? deal.deal_id : null,
      deal_name: typeof deal.deal_name === "string" ? deal.deal_name : undefined,
      status: typeof deal.status === "string" ? deal.status : undefined,
      phase: typeof deal.phase === "string" ? deal.phase : undefined,
      entity: typeof deal.entity === "string" ? deal.entity : undefined,
      updated_at: typeof deal.updated_at === "string" ? deal.updated_at : undefined,
    }))
    .filter((deal) => typeof deal.deal_id === "string");
  sendJson(res, 200, { deals });
  logLine(`GET ${route} -> 200`);
}

function listTriageEndpoint(res, route) {
  sendJson(res, 200, { items: listOpenTriageItems() });
  logLine(`GET ${route} -> 200`);
}

async function ingestTriageItem(req, res, route) {
  const body = await readJsonBody(req).catch(() => null);
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
  const createdAt = new Date().toISOString();
  const finalSuggestedDealId =
    patternSuggestion.suggested_deal_id || inputSuggestedDealId || undefined;
  const finalSuggestedTaskId =
    patternSuggestion.suggested_task_id || inputSuggestedTaskId || undefined;
  appendTriageLine({
    kind: "triage_item",
    item_id: itemId,
    source_type: sourceType,
    source_ref: sourceRef,
    summary,
    suggested_deal_id: finalSuggestedDealId,
    suggested_task_id: finalSuggestedTaskId,
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
  });
  sendJson(res, 201, {
    ingested: true,
    item_id: itemId,
    status: "OPEN",
    suggested_deal_id: finalSuggestedDealId,
    suggested_task_id: finalSuggestedTaskId,
  });
  logLine(`POST ${route} -> 201`);
}

async function linkTriageItem(itemId, req, res, route) {
  if (!itemId || !isSlugSafe(itemId)) {
    sendJson(res, 400, { error: "invalid_item_id" });
    logLine(`POST ${route} -> 400`);
    return;
  }
  const body = await readJsonBody(req).catch(() => null);
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
  appendTriageLine({
    kind: "TRIAGE_LINK",
    item_id: itemId,
    resolved: true,
    resolved_at: now,
    linked_to: linkedTo,
  });
  appendAudit("TRIAGE_LINK", {
    item_id: itemId,
    linked_to: linkedTo,
  });
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
    return { profiles: null };
  }
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

  const tokenRecord = getTokenRecord(profileId);
  if (!hasUsableAccessToken(tokenRecord)) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    logLine(`POST ${route} -> 409`);
    return;
  }

  const body = await readJsonBody(req).catch(() => null);
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

  const accessToken = getTokenAccessToken(tokenRecord);
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
    sendJson(res, 200, {
      profile_id: profileId,
      draft_created: true,
      message_id: typeof payload.id === "string" ? payload.id : null,
      web_link: typeof payload.webLink === "string" ? payload.webLink : undefined,
      subject,
    });
    logLine(`POST ${route} -> 200`);
  } catch {
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

  const tokenRecord = getTokenRecord(profileId);
  if (!hasUsableAccessToken(tokenRecord)) {
    setGraphLastError(profileId, "NOT_AUTHENTICATED");
    sendJson(res, 409, { error: "NOT_AUTHENTICATED", next_action: "RUN_DEVICE_CODE_AUTH" });
    logLine(`GET ${route} -> 409`);
    return;
  }

  const accessToken = getTokenAccessToken(tokenRecord);
  const daysRaw = Number.parseInt(parsedUrl.searchParams.get("days") || "7", 10);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 30 ? daysRaw : 7;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

  const endpoint = new URL("https://graph.microsoft.com/v1.0/me/calendarview");
  endpoint.searchParams.set("startDateTime", startDate.toISOString());
  endpoint.searchParams.set("endDateTime", endDate.toISOString());
  endpoint.searchParams.set("$select", "id,subject,start,end,location");
  endpoint.searchParams.set("$top", "200");

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
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
        typeof payload?.error?.code === "string" ? payload.error.code : "calendar_list_failed";
      setGraphLastError(profileId, code);
      sendJson(res, 502, { profile_id: profileId, error: code });
      logLine(`GET ${route} -> 502`);
      return;
    }

    const rawEvents = Array.isArray(payload.value) ? payload.value : [];
    const events = rawEvents.map((event) => ({
      id: typeof event?.id === "string" ? event.id : null,
      subject: typeof event?.subject === "string" ? event.subject : "",
      start: event?.start || null,
      end: event?.end || null,
      location:
        typeof event?.location?.displayName === "string" ? event.location.displayName : null,
    }));
    clearGraphLastError(profileId);
    sendJson(res, 200, {
      profile_id: profileId,
      read_only: true,
      days,
      events,
    });
    logLine(`GET ${route} -> 200`);
  } catch {
    setGraphLastError(profileId, "calendar_list_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "calendar_list_network_error" });
    logLine(`GET ${route} -> 502`);
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
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
  } catch {
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

  const body = await readJsonBody(req).catch(() => null);
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
  } catch {
    setGraphLastError(profileId, "token_poll_network_error");
    sendJson(res, 502, { profile_id: profileId, error: "token_poll_network_error" });
    logLine(`POST ${route} -> 502`);
  }
}

const server = http.createServer(async (req, res) => {
  const method = (req.method || "").toUpperCase();
  const parsed = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const route = parsed.pathname;

  if (method === "POST" && route === "/deals/create") {
    await createDeal(req, res, route);
    return;
  }

  if (method === "GET" && route === "/deals/list") {
    listDealsEndpoint(res, route);
    return;
  }

  const dealByIdMatch = route.match(/^\/deals\/([^/]+)$/);
  if (method === "GET" && dealByIdMatch) {
    const dealId = decodeURIComponent(dealByIdMatch[1] || "").trim();
    getDeal(dealId, res, route);
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

  if (method === "POST" && route === "/ops/rate/evaluate") {
    await evaluateRatePolicyEndpoint(req, res, route);
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
    sendJson(res, 200, buildGraphStatusPayload(profileId));
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

  if (method === "POST" && route === "/graph/diagnostics/classify") {
    const body = await readJsonBody(req).catch(() => null);
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

  if (method !== "GET" && method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" });
    logLine(`${method} ${route} -> 405`);
    return;
  }

  sendJson(res, 404, { error: "not_found" });
  logLine(`${method} ${route} -> 404`);
});

server.listen(PORT, HOST, () => {
  logLine(`ted-engine listening on http://${HOST}:${PORT}`);
  process.stdout.write(`ted-engine listening on http://${HOST}:${PORT}\n`);
});

server.on("error", (err) => {
  logLine(`server_error ${err.message}`);
  process.stderr.write(`ted-engine error: ${err.message}\n`);
  process.exitCode = 1;
});

const shutdown = () => {
  logLine("shutdown");
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
