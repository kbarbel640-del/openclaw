#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = "127.0.0.1";
const PORT = 48080;
const STARTED_AT_MS = Date.now();
const VERSION = process.env.TED_ENGINE_VERSION?.trim() || "0.1.0";
const PROFILES_COUNT_RAW = Number.parseInt(process.env.TED_ENGINE_PROFILES_COUNT || "0", 10);
const PROFILES_COUNT =
  Number.isFinite(PROFILES_COUNT_RAW) && PROFILES_COUNT_RAW >= 0 ? PROFILES_COUNT_RAW : 0;

const logsDir = path.join(__dirname, "logs");
fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, "ted-engine.log");
const logStream = fs.createWriteStream(logFile, { flags: "a" });
const graphProfilesConfigPath = path.join(__dirname, "config", "graph.profiles.json");

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
  return {
    profile_id: profileId,
    configured,
    tenant_id_present: tenantId.length > 0,
    client_id_present: clientId.length > 0,
    delegated_scopes: delegatedScopes,
    auth_state: "DISCONNECTED",
    next_action: "RUN_DEVICE_CODE_AUTH",
    last_error: null,
  };
}

const server = http.createServer((req, res) => {
  const method = (req.method || "").toUpperCase();
  const parsed = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const route = parsed.pathname;

  if (method !== "GET") {
    sendJson(res, 405, { error: "method_not_allowed" });
    logLine(`${method} ${route} -> 405`);
    return;
  }

  if (route === "/status" || route === "/doctor") {
    const payload = buildPayload();
    sendJson(res, 200, payload);
    logLine(`${method} ${route} -> 200`);
    return;
  }

  const graphStatusMatch = route.match(/^\/graph\/([^/]+)\/status$/);
  if (graphStatusMatch) {
    const profileId = decodeURIComponent(graphStatusMatch[1] || "").trim();
    if (!profileId) {
      sendJson(res, 400, { error: "invalid_profile_id" });
      logLine(`${method} ${route} -> 400`);
      return;
    }
    sendJson(res, 200, buildGraphStatusPayload(profileId));
    logLine(`${method} ${route} -> 200`);
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
