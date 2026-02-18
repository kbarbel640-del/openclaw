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
const graphProfilesConfigPath = path.join(__dirname, "config", "graph.profiles.json");
const graphLastErrorByProfile = new Map();

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  logStream.write(line);
}

function buildPayload() {
  return {
    version: VERSION,
    uptime: Math.floor((Date.now() - STARTED_AT_MS) / 1000),
    profiles_count: PROFILES_COUNT,
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
