#!/usr/bin/env node

import http from "http";

const PORT = Number(process.env.COPILOT_SERVER_PORT || 3210);
const HOST = process.env.COPILOT_SERVER_HOST || "0.0.0.0";
const DEFAULT_MODELS = ["gemini-3-pro-preview", "claude-opus-4.5", "gpt-5.2-codex"];
const DEFAULT_API = "openai";
const DEFAULT_BASE_URL = "http://localhost:4000";

let isShuttingDown = false;

function normalizeModelName(model) {
  const normalized = model.trim().toLowerCase();
  const map = {
    "gemini 3 pro preview": "gemini-3-pro-preview",
    "gemini-3-pro-preview": "gemini-3-pro-preview",
    "opus 4.5": "claude-opus-4.5",
    "claude-opus-4.5": "claude-opus-4.5",
    "gpt-5.2-codex": "gpt-5.2-codex",
    "gpt5.2-codex": "gpt-5.2-codex",
  };
  return map[normalized] ?? model.trim();
}

function normalizeApi(value) {
  if (!value) return DEFAULT_API;
  const normalized = value.trim().toLowerCase();
  if (["openai", "anthropic", "claude", "claude-code", "claude_code"].includes(normalized)) {
    if (normalized === "claude-code" || normalized === "claude_code") return "claude";
    return normalized;
  }
  throw new Error(`Unknown API type: ${value}`);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function resolveApiBaseUrl(apiType, baseUrl) {
  const raw = normalizeBaseUrl(baseUrl || process.env.LM_PROXY_BASE_URL || DEFAULT_BASE_URL);
  const lower = raw.toLowerCase();
  const apiPath =
    apiType === "openai" ? "/openai" : apiType === "anthropic" ? "/anthropic" : "/anthropic/claude";
  if (lower.endsWith(apiPath) || lower.includes(`${apiPath}/v1`)) {
    return raw;
  }
  return `${raw}${apiPath}`;
}

function withV1(baseUrl, suffix) {
  const base = normalizeBaseUrl(baseUrl);
  if (base.endsWith("/v1") || base.includes("/v1/")) {
    return `${base}${suffix}`;
  }
  return `${base}/v1${suffix}`;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 90000);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!res.ok) {
      const message =
        payload?.error?.message || payload?.error || res.statusText || "Request failed";
      throw new Error(`${message} (${res.status})`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function runModel(apiType, baseUrl, model, prompt) {
  const resolvedModel = normalizeModelName(model);
  if (apiType === "openai") {
    const url = withV1(baseUrl, "/chat/completions");
    const payload = await fetchJson(url, {
      method: "POST",
      body: JSON.stringify({
        model: resolvedModel,
        stream: false,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const content = payload?.choices?.[0]?.message?.content || "";
    return { model: resolvedModel, content };
  }

  const url = withV1(baseUrl, "/messages");
  const payload = await fetchJson(url, {
    method: "POST",
    body: JSON.stringify({
      model: resolvedModel,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const parts = Array.isArray(payload?.content) ? payload.content : [];
  const content = parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  return { model: resolvedModel, content };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error("payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true, uptime: process.uptime() });
  }

  if (req.method === "POST" && req.url === "/delegate") {
    try {
      const raw = await collectBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const prompt = body.prompt || "";
      if (!prompt) return sendJson(res, 400, { error: "prompt required" });

      const apiType = normalizeApi(body.api || process.env.LM_PROXY_API);
      const baseUrl = resolveApiBaseUrl(apiType, body.baseUrl);
      const models =
        Array.isArray(body.models) && body.models.length
          ? body.models.map(normalizeModelName)
          : DEFAULT_MODELS;
      const reportModel = normalizeModelName(body.reportModel || "claude-opus-4.5");

      const results = [];
      for (const model of models) {
        results.push(await runModel(apiType, baseUrl, model, prompt));
      }

      const reportPrompt = `You are Opus 4.5. Summarize what each model said.\n\n${results
        .map((r) => `Model: ${r.model}\nResponse:\n${r.content}`)
        .join("\n\n")}`;

      const report = await runModel(apiType, baseUrl, reportModel, reportPrompt);
      return sendJson(res, 200, { prompt, results, report: report.content });
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || String(err) });
    }
  }

  return sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`copilot-delegate-server listening on http://${HOST}:${PORT}`);
});

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
