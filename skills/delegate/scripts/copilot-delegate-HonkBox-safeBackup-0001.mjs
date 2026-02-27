#!/usr/bin/env node

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import process from "process";

const DEFAULT_MODELS = ["gemini-3-pro-preview", "claude-opus-4.5", "gpt-5.2-codex"];
const DEFAULT_API = "openai";
const DEFAULT_BASE_URL = "http://localhost:4000";
const DEFAULT_TOOL_MAX_STEPS = 4;
const QUALITY_FIRST_SYSTEM = [
  "Quality-first operation:",
  "- Use all available time and resources to maximize correctness and depth.",
  "- Prefer thorough, rigorous, and complete responses over brevity.",
  "- Do not truncate analysis; expand with supporting reasoning and evidence.",
  "- If context seems missing, state assumptions explicitly and proceed with best effort.",
].join("\n");

function parseArgs(argv) {
  const args = {
    api: null,
    baseUrl: null,
    listModels: false,
    models: [],
    json: false,
    prompt: null,
    out: null,
    reportModel: "claude-opus-4.5",
    stream: false,
    toolsJson: null,
    toolsFile: null,
    toolChoice: null,
    toolMaxSteps: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--model") {
      args.models.push(argv[i + 1]);
      i += 1;
    } else if (arg === "--models") {
      args.models.push(
        ...argv[i + 1]
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
      );
      i += 1;
    } else if (arg === "--api") {
      args.api = argv[i + 1];
      i += 1;
    } else if (arg === "--base-url") {
      args.baseUrl = argv[i + 1];
      i += 1;
    } else if (arg === "--prompt") {
      args.prompt = argv[i + 1];
      i += 1;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--stream") {
      args.stream = true;
    } else if (arg === "--tools-json") {
      args.toolsJson = argv[i + 1];
      i += 1;
    } else if (arg === "--tools-file") {
      args.toolsFile = argv[i + 1];
      i += 1;
    } else if (arg === "--tool-choice") {
      args.toolChoice = argv[i + 1];
      i += 1;
    } else if (arg === "--tool-max-steps") {
      args.toolMaxSteps = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--list-models") {
      args.listModels = true;
    } else if (arg === "--out") {
      args.out = argv[i + 1];
      i += 1;
    } else if (arg === "--report-model") {
      args.reportModel = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data.trim()));
  });
}

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

function parseTools(args) {
  const raw = args.toolsJson || process.env.LM_PROXY_TOOLS_JSON;
  const file = args.toolsFile || process.env.LM_PROXY_TOOLS_FILE;
  if (raw) {
    return JSON.parse(raw);
  }
  if (file) {
    return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  }
  return null;
}

function parseToolChoice(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function buildToolImplMap(tools) {
  const map = new Map();
  if (!Array.isArray(tools)) return map;
  for (const tool of tools) {
    const name = tool?.function?.name || tool?.name;
    if (!name) continue;
    if (tool?.["x-exec"]) {
      map.set(name, { exec: tool["x-exec"] });
    }
  }
  return map;
}

async function runExec(execDef, argsObj) {
  const cmd = execDef?.cmd;
  if (!cmd) throw new Error("x-exec missing cmd");
  const argv = Array.isArray(execDef?.args) ? execDef.args.map(String) : [];
  const timeoutMs = execDef?.timeoutMs ?? 60000;
  const input = execDef?.stdin === true ? JSON.stringify(argsObj ?? {}) : null;

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, { stdio: ["pipe", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`tool exec timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const output = stdout + (stderr ? `\n${stderr}` : "");
      if (code && code !== 0) {
        reject(new Error(output.trim() || `tool exec failed (${code})`));
        return;
      }
      resolve(output.trim());
    });
    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function executeToolCall(toolMap, call) {
  const name = call?.function?.name || call?.name;
  const rawArgs = call?.function?.arguments || call?.arguments || "{}";
  let argsObj = {};
  try {
    argsObj = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    argsObj = { __raw: rawArgs };
  }
  const impl = toolMap.get(name);
  if (!impl) {
    return { name, output: `Error: no tool implementation for ${name}` };
  }
  if (impl.exec) {
    const output = await runExec(impl.exec, argsObj);
    return { name, output };
  }
  return { name, output: `Error: unsupported tool implementation for ${name}` };
}

function formatToolCalls(toolCalls) {
  if (!toolCalls || toolCalls.length === 0) return "";
  const lines = toolCalls.map((call) => {
    const name = call?.function?.name || call?.name || "unknown";
    const args = call?.function?.arguments || call?.arguments || "";
    return `[tool_call] ${name}\n${args}`.trim();
  });
  return `\n${lines.join("\n")}`;
}

async function streamOpenAIChat(url, body, onToken) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";
  const toolCalls = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = json?.choices?.[0]?.delta;
      const text = delta?.content;
      if (text) {
        content += text;
        if (onToken) onToken(text);
      }
      const calls = delta?.tool_calls;
      if (Array.isArray(calls)) {
        for (const call of calls) {
          const key = call?.id || call?.index;
          if (key === undefined) continue;
          const existing = toolCalls.get(key) || { function: { name: "", arguments: "" } };
          if (call?.function?.name) existing.function.name = call.function.name;
          if (call?.function?.arguments) {
            existing.function.arguments =
              (existing.function.arguments || "") + call.function.arguments;
          }
          toolCalls.set(key, existing);
        }
      }
    }
  }

  return { content, toolCalls: Array.from(toolCalls.values()) };
}

async function streamAnthropic(url, body, onToken) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";
  const toolUses = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      if (json?.type === "content_block_delta" && json?.delta?.text) {
        const text = json.delta.text;
        content += text;
        if (onToken) onToken(text);
      }
      if (json?.type === "content_block_start" && json?.content_block?.type === "tool_use") {
        const block = json.content_block;
        toolUses.set(block.id, { name: block.name, input: "" });
      }
      if (json?.type === "content_block_delta" && json?.delta?.type === "input_json_delta") {
        const target = toolUses.get(json?.content_block?.id);
        if (target) {
          target.input += json.delta.partial_json || "";
        }
      }
    }
  }

  const toolCalls = Array.from(toolUses.values()).map((item) => ({
    name: item.name,
    arguments: item.input,
  }));
  return { content, toolCalls };
}

async function listModels(apiType, baseUrl) {
  const modelsUrl = withV1(baseUrl, "/models");
  const payload = await fetchJson(modelsUrl, { method: "GET" });
  if (!payload) return [];
  if (Array.isArray(payload.data)) {
    return payload.data.map((item) => item.id || item.model || item.name).filter(Boolean);
  }
  if (Array.isArray(payload.models)) {
    return payload.models.map((item) => item.id || item.model || item.name).filter(Boolean);
  }
  return [];
}

async function runModel(apiType, baseUrl, model, prompt, options) {
  const resolvedModel = normalizeModelName(model);
  const tools = options?.tools || null;
  const toolChoice = options?.toolChoice || null;
  const stream = Boolean(options?.stream);
  const onToken = options?.onToken || null;
  const messages = options?.messages || [
    { role: "system", content: QUALITY_FIRST_SYSTEM },
    { role: "user", content: prompt },
  ];
  if (apiType === "openai") {
    const url = withV1(baseUrl, "/chat/completions");
    const body = {
      model: resolvedModel,
      stream,
      messages,
    };
    if (tools) body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;
    if (stream) {
      const result = await streamOpenAIChat(url, body, onToken);
      const content = result.content || "";
      return {
        model: resolvedModel,
        content,
        rawContent: content,
        toolCalls: result.toolCalls || [],
      };
    }
    const payload = await fetchJson(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const message = payload?.choices?.[0]?.message || {};
    const content = message.content || "";
    const toolCalls = message.tool_calls || [];
    return { model: resolvedModel, content, rawContent: content, toolCalls };
  }

  const url = withV1(baseUrl, "/messages");
  const body = {
    model: resolvedModel,
    max_tokens: 4096,
    messages,
    stream,
  };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;
  if (stream) {
    const result = await streamAnthropic(url, body, onToken);
    const content = result.content || "";
    return {
      model: resolvedModel,
      content,
      rawContent: content,
      toolCalls: result.toolCalls || [],
    };
  }
  const payload = await fetchJson(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const parts = Array.isArray(payload?.content) ? payload.content : [];
  const content = parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  const toolCalls = parts
    .filter((part) => part?.type === "tool_use")
    .map((part) => ({
      id: part.id,
      name: part.name,
      arguments: JSON.stringify(part.input ?? {}),
    }));
  return { model: resolvedModel, content, rawContent: content, toolCalls };
}

async function runModelWithTools(apiType, baseUrl, model, prompt, options) {
  const toolMap = buildToolImplMap(options?.tools);
  const maxSteps = Number.isFinite(options?.toolMaxSteps)
    ? options.toolMaxSteps
    : DEFAULT_TOOL_MAX_STEPS;
  const messages =
    apiType === "openai"
      ? [
          { role: "system", content: QUALITY_FIRST_SYSTEM },
          { role: "user", content: prompt },
        ]
      : [
          { role: "system", content: QUALITY_FIRST_SYSTEM },
          { role: "user", content: prompt },
        ];
  let content = "";
  let lastToolCalls = [];

  for (let step = 0; step <= maxSteps; step += 1) {
    const result = await runModel(apiType, baseUrl, model, prompt, {
      ...options,
      messages,
      stream: false,
    });
    content = result.content || "";
    lastToolCalls = result.toolCalls || [];
    if (!lastToolCalls.length || toolMap.size === 0) break;

    const toolResults = [];
    for (const call of lastToolCalls) {
      const toolResult = await executeToolCall(toolMap, call);
      toolResults.push({ call, toolResult });
    }

    if (apiType === "openai") {
      const assistantToolCalls = lastToolCalls.map((call, index) => ({
        id: call.id || `call_${step}_${index}`,
        type: "function",
        function: {
          name: call.function?.name || call.name,
          arguments: call.function?.arguments || call.arguments || "{}",
        },
      }));
      messages.push({
        role: "assistant",
        content: result.rawContent || "",
        tool_calls: assistantToolCalls,
      });
      for (const [index, { toolResult }] of toolResults.entries()) {
        messages.push({
          role: "tool",
          tool_call_id: assistantToolCalls[index].id,
          content: toolResult.output,
        });
      }
    } else {
      const toolBlocks = lastToolCalls.map((call, index) => ({
        type: "tool_use",
        id: call.id || `tool_${step}_${index}`,
        name: call.name || call.function?.name || "tool",
        input: call.arguments ? JSON.parse(call.arguments) : {},
      }));
      messages.push({
        role: "assistant",
        content: [{ type: "text", text: result.rawContent || "" }, ...toolBlocks],
      });
      messages.push({
        role: "user",
        content: toolBlocks.map((block, index) => ({
          type: "tool_result",
          tool_use_id: block.id,
          content: toolResults[index].toolResult.output,
        })),
      });
    }
  }

  return { model: normalizeModelName(model), content: content + formatToolCalls(lastToolCalls) };
}

async function main() {
  const args = parseArgs(process.argv);
  const stdin = await readStdin();
  const prompt = args.prompt ?? stdin;
  const apiType = normalizeApi(args.api || process.env.LM_PROXY_API);
  const baseUrl = resolveApiBaseUrl(apiType, args.baseUrl);
  const tools = parseTools(args);
  const toolChoice = parseToolChoice(
    args.toolChoice || process.env.LM_PROXY_TOOL_CHOICE || (tools ? "auto" : null),
  );
  const toolMaxSteps = Number.isFinite(args.toolMaxSteps)
    ? args.toolMaxSteps
    : Number.isFinite(Number(process.env.LM_PROXY_TOOL_MAX_STEPS))
      ? Number(process.env.LM_PROXY_TOOL_MAX_STEPS)
      : DEFAULT_TOOL_MAX_STEPS;

  if (args.listModels) {
    const models = await listModels(apiType, baseUrl);
    const output = models.length ? models.join("\n") : "No models returned.";
    if (args.out) {
      fs.writeFileSync(path.resolve(args.out), output);
    } else {
      console.log(output);
    }
    return;
  }

  if (!prompt) {
    console.error("Provide a prompt via --prompt or stdin.");
    process.exit(1);
  }

  const models =
    args.models.length > 0
      ? args.models
      : process.env.LM_PROXY_MODELS || process.env.COPILOT_SDK_MODELS
        ? (process.env.LM_PROXY_MODELS || process.env.COPILOT_SDK_MODELS)
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean)
        : DEFAULT_MODELS;

  const results = [];
  for (const model of models) {
    const modelHeader = args.stream ? `=== ${model} ===\n` : "";
    if (args.stream) process.stdout.write(modelHeader);
    const result = tools
      ? await runModelWithTools(apiType, baseUrl, model, prompt, {
          tools,
          toolChoice,
          toolMaxSteps,
          stream: false,
        })
      : await runModel(apiType, baseUrl, model, prompt, {
          tools,
          toolChoice,
          stream: args.stream,
          onToken: args.stream ? (text) => process.stdout.write(text) : null,
        });
    if (args.stream) process.stdout.write("\n\n");
    results.push(result);
  }

  const reportPrompt = `You are Opus 4.5. Summarize what each model said.\n\n${results
    .map((r) => `Model: ${r.model}\nResponse:\n${r.content}`)
    .join("\n\n")}`;

  const report = tools
    ? await runModelWithTools(apiType, baseUrl, args.reportModel, reportPrompt, {
        tools,
        toolChoice,
        toolMaxSteps,
        stream: false,
      })
    : await runModel(apiType, baseUrl, args.reportModel, reportPrompt, {
        tools,
        toolChoice,
        stream: false,
      });
  const payload = { prompt, results, report: report.content };

  if (args.json) {
    const jsonOut = JSON.stringify(payload, null, 2);
    if (args.out) {
      fs.writeFileSync(path.resolve(args.out), jsonOut);
    } else {
      console.log(jsonOut);
    }
    return;
  }

  const lines = [];
  if (!args.stream) {
    for (const result of results) {
      lines.push(`=== ${result.model} ===`);
      lines.push(result.content.trim());
      lines.push("");
    }
  }
  lines.push("=== Opus 4.5 report ===");
  lines.push(report.content.trim());

  const output = lines.join("\n").trim();
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), output);
  } else {
    console.log(output);
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
