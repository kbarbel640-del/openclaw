import http from "node:http";
import fs from "node:fs";
import { URL } from "node:url";

function loadDotEnv(filePath = ".env") {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, "$1");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const port = Number(process.env.PORT || 3300);
const gatewayBaseUrl = process.env.OPENCLAW_GATEWAY_BASE_URL || "http://127.0.0.1:18789";
const upstreamPath = process.env.OPENCLAW_UPSTREAM_PATH || "/v1/chat/completions";
const upstreamTimeoutMs = Number(process.env.OPENCLAW_UPSTREAM_TIMEOUT_MS || 90000);
const defaultAgentId = process.env.OPENCLAW_AGENT_ID || "main";
const upstreamBearer = process.env.OPENCLAW_GATEWAY_BEARER || "";

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function parseAgentFromModel(model) {
  if (typeof model !== "string") return null;
  const trimmed = model.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("openclaw:")) return trimmed.slice("openclaw:".length) || null;
  if (trimmed.startsWith("agent:")) return trimmed.slice("agent:".length) || null;
  return null;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleChatCompletions(req, res) {
  const rawBody = await collectBody(req);
  let payload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    sendJson(res, 400, { error: "invalid_json", message: "Request body must be valid JSON" });
    return;
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    sendJson(res, 400, { error: "invalid_request", message: "messages is required" });
    return;
  }

  const agentId = parseAgentFromModel(payload.model) || defaultAgentId;
  const upstreamUrl = new URL(`${normalizeBaseUrl(gatewayBaseUrl)}${upstreamPath}`);

  const headers = {
    "Content-Type": "application/json",
    Accept: payload.stream ? "text/event-stream" : "application/json",
    "x-openclaw-agent-id": agentId
  };
  if (upstreamBearer) headers.Authorization = `Bearer ${upstreamBearer}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  let upstreamRes;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    const message =
      error && error.name === "AbortError"
        ? `Upstream timeout after ${upstreamTimeoutMs}ms`
        : error instanceof Error
          ? error.message
          : "Upstream request failed";
    sendJson(res, 502, { error: "upstream_unreachable", message });
    return;
  }
  clearTimeout(timeout);

  if (!upstreamRes.body) {
    sendJson(res, 502, { error: "upstream_error", message: "Upstream returned empty body" });
    return;
  }

  if (payload.stream) {
    res.writeHead(upstreamRes.status, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    for await (const chunk of upstreamRes.body) {
      res.write(chunk);
    }
    res.end();
    return;
  }

  const body = await upstreamRes.text();
  res.writeHead(upstreamRes.status, {
    "Content-Type": upstreamRes.headers.get("content-type") || "application/json"
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { status: "ok", service: "openclaw-bridge" });
      return;
    }

    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      await handleChatCompletions(req, res);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    sendJson(res, 500, { error: "internal_error", message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[openclaw-bridge] listening on 0.0.0.0:${port}`);
});
