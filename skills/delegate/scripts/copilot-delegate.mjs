#!/usr/bin/env node

import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
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

const DEFAULT_CONTEXT_MODE = "auto";
const DEFAULT_CONTEXT_MODEL_OPENAI = "gpt-5-mini";
const DEFAULT_CONTEXT_MODEL_ANTHROPIC = "claude-haiku-4.5";
const DEFAULT_CONTEXT_ROUNDS = 2;
const DEFAULT_CONTEXT_MAX_BYTES = 100000;
const DEFAULT_CONTEXT_MAX_FILE_BYTES = 50000;
const DEFAULT_CONTEXT_MAX_FILE_LINES = 400;
const DEFAULT_CONTEXT_TIMEOUT_MS = 8000;
const DEFAULT_CONTEXT_MAX_HINT_FILES = 5;
const DEFAULT_STREAM_TIMEOUT_MS = 120000;
const DEFAULT_STREAM_MAX_BYTES = 5000000;
const DEFAULT_HTTP_RETRIES = 2;
const DEFAULT_HTTP_RETRY_BASE_MS = 800;
const DEFAULT_STDIN_MAX_BYTES = 500000;
const DEFAULT_STDIN_TIMEOUT_MS = 4000;
const DEFAULT_SCRUB_MAX_BYTES = 300000;

const CONTEXT_ALLOWED_COMMANDS = new Map([
  ["pwd", ["pwd"]],
  ["ls", ["ls"]],
  ["ls -la", ["ls", "-la"]],
  ["git status --short", ["git", "status", "--short"]],
  ["git branch --show-current", ["git", "branch", "--show-current"]],
  ["git rev-parse --show-toplevel", ["git", "rev-parse", "--show-toplevel"]],
]);

const CONTEXT_BLOCKLIST = [
  /\.env($|\.)/i,
  /id_rsa/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.kdbx$/i,
  /credentials?/i,
  /secrets?/i,
  /token/i,
  /\.sqlite$/i,
  /node_modules/i,
  /\/dist\//i,
  /\/static\//i,
];

const CONTEXT_SCOUT_SYSTEM = [
  "You are a context scout for a delegate script.",
  "Decide if more context is needed to answer the user's request.",
  "Only request files or commands that are strictly necessary.",
  "Return JSON only with this schema:",
  '{"status":"enough"} OR {"status":"need", "files":[...], "commands":[...], "questions":[...]}',
  "Use only the allowed commands list provided.",
  "Prefer files over commands when possible.",
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
    contextMode: null,
    contextModel: null,
    contextRounds: null,
    contextMaxBytes: null,
    contextMaxFileBytes: null,
    contextMaxFileLines: null,
    contextDebug: false,
  };
  let i = 2;
  const nextValue = (flag) => {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("-")) {
      throw new Error(`Missing value for ${flag}`);
    }
    i += 1;
    return value;
  };
  const nextNumber = (flag) => {
    const raw = nextValue(flag);
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid numeric value for ${flag}: ${raw}`);
    }
    return value;
  };
  for (; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--model") {
      args.models.push(nextValue(arg));
    } else if (arg === "--models") {
      args.models.push(
        ...nextValue(arg)
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
      );
    } else if (arg === "--api") {
      args.api = nextValue(arg);
    } else if (arg === "--base-url") {
      args.baseUrl = nextValue(arg);
    } else if (arg === "--prompt") {
      args.prompt = nextValue(arg);
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--stream") {
      args.stream = true;
    } else if (arg === "--tools-json") {
      args.toolsJson = nextValue(arg);
    } else if (arg === "--tools-file") {
      args.toolsFile = nextValue(arg);
    } else if (arg === "--tool-choice") {
      args.toolChoice = nextValue(arg);
    } else if (arg === "--tool-max-steps") {
      args.toolMaxSteps = nextNumber(arg);
    } else if (arg === "--context") {
      args.contextMode = nextValue(arg);
    } else if (arg === "--context-model") {
      args.contextModel = nextValue(arg);
    } else if (arg === "--context-rounds") {
      args.contextRounds = nextNumber(arg);
    } else if (arg === "--context-max-bytes") {
      args.contextMaxBytes = nextNumber(arg);
    } else if (arg === "--context-max-file-bytes") {
      args.contextMaxFileBytes = nextNumber(arg);
    } else if (arg === "--context-max-file-lines") {
      args.contextMaxFileLines = nextNumber(arg);
    } else if (arg === "--context-debug") {
      args.contextDebug = true;
    } else if (arg === "--list-models") {
      args.listModels = true;
    } else if (arg === "--out") {
      args.out = nextValue(arg);
    } else if (arg === "--report-model") {
      args.reportModel = nextValue(arg);
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
    const maxBytes = Number.isFinite(Number(process.env.DELEGATE_STDIN_MAX_BYTES))
      ? Number(process.env.DELEGATE_STDIN_MAX_BYTES)
      : DEFAULT_STDIN_MAX_BYTES;
    const timeoutMs = Number.isFinite(Number(process.env.DELEGATE_STDIN_TIMEOUT_MS))
      ? Number(process.env.DELEGATE_STDIN_TIMEOUT_MS)
      : DEFAULT_STDIN_TIMEOUT_MS;
    let totalBytes = 0;
    const chunks = [];
    let settled = false;
    let timer = null;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.off("error", onError);
    };
    const finish = (text) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(text);
    };
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => finish(chunks.join("").trim() + (chunks.length ? "\n...[truncated]" : "")),
        timeoutMs,
      );
    };
    process.stdin.setEncoding("utf8");
    const onData = (chunk) => {
      resetTimer();
      totalBytes += Buffer.byteLength(chunk, "utf8");
      if (maxBytes && totalBytes > maxBytes) {
        chunks.push(chunk);
        process.stdin.pause();
        finish(chunks.join("").trim() + "\n...[truncated]");
        return;
      }
      chunks.push(chunk);
    };
    const onError = () => finish("");
    const onEnd = () => finish(chunks.join("").trim());
    process.stdin.on("data", onData);
    process.stdin.on("error", onError);
    process.stdin.on("end", onEnd);
    resetTimer();
  });
}

function parseNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeContextMode(value) {
  if (!value) return DEFAULT_CONTEXT_MODE;
  const normalized = String(value).trim().toLowerCase();
  if (["none", "off", "false", "0"].includes(normalized)) return "none";
  if (["auto", "ask", "on", "true", "1"].includes(normalized)) return "auto";
  return "auto";
}

function resolveContextModel(apiType, explicit) {
  if (explicit) return explicit;
  if (apiType === "openai") return DEFAULT_CONTEXT_MODEL_OPENAI;
  return DEFAULT_CONTEXT_MODEL_ANTHROPIC;
}

function resolveUserPath(raw) {
  if (!raw) return raw;
  if (raw.startsWith("~/")) {
    return path.join(os.homedir(), raw.slice(2));
  }
  return raw;
}

function findGitRoot(startDir) {
  let dir = startDir;
  let depth = 0;
  while (dir && dir !== path.dirname(dir) && depth < 100) {
    if (fs.existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    dir = path.dirname(dir);
    depth += 1;
  }
  return null;
}

function scrubSecrets(text, maxLen = DEFAULT_SCRUB_MAX_BYTES) {
  if (!text) return "";
  let out = text;
  if (Number.isFinite(maxLen) && maxLen > 0 && out.length > maxLen) {
    out = out.slice(0, maxLen);
  }
  const keyValuePattern =
    /((?:password|token|secret|api[_-]?key))\s*([:=])\s*(?:"[^"\\]{0,2000}"|'[^'\\]{0,2000}'|`[^`\\]{0,2000}`|[^\s'"]{1,2000})/gi;
  out = out.replace(keyValuePattern, (_match, key, sep) => `${key}${sep}[REDACTED]`);
  const patterns = [
    /sk-[a-zA-Z0-9]{10,}/g,
    /AKIA[0-9A-Z]{16}/g,
    /ASIA[0-9A-Z]{16}/g,
    /ghp_[A-Za-z0-9]{30,}/g,
    /xox[baprs]-[A-Za-z0-9-]{10,}/g,
    /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g,
    /(bearer\s+)[a-zA-Z0-9\-._~+\/]+=*/gi,
  ];
  for (const pattern of patterns) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

function truncateLines(text, maxLines) {
  if (!Number.isFinite(maxLines) || maxLines <= 0) return text;
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + "\n...[truncated]";
}

function truncateBytes(text, maxBytes) {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return text;
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return text;
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  return buf.subarray(0, end).toString("utf8") + "\n...[truncated]";
}

function isBlockedPath(filePath) {
  return CONTEXT_BLOCKLIST.some((re) => re.test(filePath));
}

function isWithinRoots(filePath, roots) {
  const resolved = path.resolve(filePath);
  return roots.some((root) => {
    if (!root) return false;
    const rootResolved = path.resolve(root);
    return resolved === rootResolved || resolved.startsWith(rootResolved + path.sep);
  });
}

function readTextFileSafe(filePath, options) {
  const resolved = path.resolve(resolveUserPath(filePath));
  if (!isWithinRoots(resolved, options.roots)) {
    return { error: `blocked (outside roots): ${resolved}` };
  }
  if (isBlockedPath(resolved)) {
    return { error: `blocked (sensitive path): ${resolved}` };
  }
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (err) {
    return { error: `missing file: ${resolved}` };
  }
  if (!stat.isFile()) {
    return { error: `not a file: ${resolved}` };
  }
  const maxBytes = Math.min(options.maxBytes, stat.size || options.maxBytes);
  let buffer = Buffer.alloc(0);
  try {
    const temp = Buffer.alloc(maxBytes);
    const fd = fs.openSync(resolved, "r");
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync(fd, temp, 0, maxBytes, 0);
    } finally {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    buffer = temp.subarray(0, bytesRead);
  } catch (err) {
    return { error: `read failed: ${resolved}` };
  }
  let text = "";
  if (buffer.includes(0)) {
    const nullCount = buffer.reduce((acc, byte) => acc + (byte === 0 ? 1 : 0), 0);
    const ratio = nullCount / Math.max(1, buffer.length);
    const utf8Text = buffer.toString("utf8");
    const utf8Repl = (utf8Text.match(/\uFFFD/g) || []).length;
    if (ratio > 0.2) {
      text = buffer.toString("utf16le");
    } else if (utf8Repl / Math.max(1, utf8Text.length) > 0.2) {
      return { error: `binary file skipped: ${resolved}` };
    } else {
      text = utf8Text;
    }
  } else {
    text = buffer.toString("utf8");
  }
  const scrubLimit = Math.min(
    Math.max(options.maxBytes, DEFAULT_SCRUB_MAX_BYTES),
    DEFAULT_SCRUB_MAX_BYTES,
  );
  text = scrubSecrets(text, scrubLimit);
  text = truncateBytes(text, options.maxBytes);
  text = truncateLines(text, options.maxLines);
  text = scrubSecrets(text, scrubLimit);
  return { content: text, path: resolved };
}

async function runCommand(argv, timeoutMs, maxOutputBytes = DEFAULT_CONTEXT_MAX_FILE_BYTES) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(argv[0], argv.slice(1), {
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });
    } catch (err) {
      reject(err);
      return;
    }
    let settled = false;
    let timer;
    const maxBytes = Number.isFinite(maxOutputBytes)
      ? maxOutputBytes
      : DEFAULT_CONTEXT_MAX_FILE_BYTES;
    const stdoutChunks = [];
    const stderrChunks = [];
    let totalBytes = 0;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        if (process.platform !== "win32" && child.pid) {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
        } else {
          child.kill("SIGKILL");
        }
      } catch {}
      reject(err);
    };
    const onChunk = (chunk, target) => {
      if (settled) return;
      if (maxBytes && totalBytes + chunk.length > maxBytes) {
        fail(new Error(`command output exceeded ${maxBytes} bytes`));
        return;
      }
      totalBytes += chunk.length;
      target.push(chunk);
    };
    timer = setTimeout(() => {
      fail(new Error(`command timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      onChunk(chunk, stdoutChunks);
    });
    child.stderr.on("data", (chunk) => {
      onChunk(chunk, stderrChunks);
    });
    child.on("error", (err) => {
      fail(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();
      const output = (stdout + (stderr ? `\n${stderr}` : "")).trim();
      if (code && code !== 0) {
        reject(new Error(output || `command failed (${code})`));
        return;
      }
      resolve(output);
    });
  });
}

function findJsonCandidate(text) {
  const limit = Math.min(text.length, 200000);
  for (let i = 0; i < limit; i += 1) {
    const start = text[i];
    if (start !== "{" && start !== "[") continue;
    const stack = [start];
    let inString = false;
    let escape = false;
    for (let j = i + 1; j < limit; j += 1) {
      const char = text[j];
      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (char === "\\") {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{" || char === "[") {
        stack.push(char);
        continue;
      }
      if (char === "}" || char === "]") {
        stack.pop();
        if (stack.length === 0) {
          const candidate = text.slice(i, j + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

function extractJson(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }
  return findJsonCandidate(trimmed);
}

function normalizeContextRequest(raw) {
  if (!raw || typeof raw !== "object") return null;
  const statusRaw = String(raw.status || raw.state || "").toLowerCase();
  const files = Array.isArray(raw.files) ? raw.files.map(String).filter(Boolean) : [];
  const commands = Array.isArray(raw.commands) ? raw.commands.map(String).filter(Boolean) : [];
  const questions = Array.isArray(raw.questions) ? raw.questions.map(String).filter(Boolean) : [];
  if (statusRaw === "enough") return { status: "enough", files: [], commands: [], questions: [] };
  if (statusRaw === "need") return { status: "need", files, commands, questions };
  if (files.length || commands.length || questions.length) {
    return { status: "need", files, commands, questions };
  }
  return { status: "enough", files: [], commands: [], questions: [] };
}

function buildContextScoutPrompt(params) {
  const lines = [
    "User request:",
    params.prompt,
    "",
    "Already gathered:",
    params.summary || "(none)",
    "",
    "Allowed commands (exact):",
    params.allowedCommands.map((cmd) => `- ${cmd}`).join("\n") || "(none)",
    "",
    "Allowed roots:",
    params.allowedRoots.map((root) => `- ${root}`).join("\n") || "(none)",
  ];
  if (params.projectMarkers && params.projectMarkers.length) {
    lines.push("", "Project markers:", params.projectMarkers.map((m) => `- ${m}`).join("\n"));
  }
  return lines.join("\n");
}

function findProjectMarkers(root) {
  if (!root) return [];
  const markers = [
    "package.json",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lockb",
    "pyproject.toml",
    "requirements.txt",
    "Pipfile",
    "Cargo.toml",
    "go.mod",
    "README.md",
  ];
  return markers.filter((name) => fs.existsSync(path.join(root, name)));
}

function extractPromptFileHints(prompt) {
  if (!prompt) return [];
  const matches = new Set();
  const regex =
    /(?:^|[\s"'`])((?:~\/|\.{1,2}\/|\/)?[\w./-]+\.(?:md|mdx|txt|json|yaml|yml|toml|js|mjs|cjs|ts|tsx|jsx|py|rs|go|sh|bash|zsh|css|html))(?=$|[\s"'`])/g;
  let match;
  while ((match = regex.exec(prompt))) {
    matches.add(match[1]);
  }
  return Array.from(matches).slice(0, DEFAULT_CONTEXT_MAX_HINT_FILES);
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
  const timeoutMs = options.timeoutMs || 90000;
  const maxRetries = Number.isFinite(options.retries) ? options.retries : DEFAULT_HTTP_RETRIES;
  const baseDelay = Number.isFinite(options.retryBaseMs)
    ? options.retryBaseMs
    : DEFAULT_HTTP_RETRY_BASE_MS;
  let attempt = 0;
  let lastErr = null;
  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
        const err = new Error(`${message} (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return payload;
    } catch (err) {
      lastErr = err;
      const status = err?.status;
      const retriable = status === 429 || (typeof status === "number" && status >= 500);
      if (!retriable || attempt >= maxRetries) {
        throw err;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      clearTimeout(timeout);
    }
    attempt += 1;
  }
  throw lastErr || new Error("Request failed");
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

async function streamOpenAIChat(
  url,
  body,
  onToken,
  timeoutMs = DEFAULT_STREAM_TIMEOUT_MS,
  maxBytes = DEFAULT_STREAM_MAX_BYTES,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";
  let contentBytes = 0;
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
        contentBytes += Buffer.byteLength(text, "utf8");
        if (maxBytes && contentBytes > maxBytes) {
          controller.abort();
          throw new Error(`stream response exceeded ${maxBytes} bytes`);
        }
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

async function streamAnthropic(
  url,
  body,
  onToken,
  timeoutMs = DEFAULT_STREAM_TIMEOUT_MS,
  maxBytes = DEFAULT_STREAM_MAX_BYTES,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";
  let contentBytes = 0;
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
        contentBytes += Buffer.byteLength(text, "utf8");
        if (maxBytes && contentBytes > maxBytes) {
          controller.abort();
          throw new Error(`stream response exceeded ${maxBytes} bytes`);
        }
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
  const streamTimeoutMs = options?.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS;
  const streamMaxBytes = options?.streamMaxBytes ?? DEFAULT_STREAM_MAX_BYTES;
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
      const result = await streamOpenAIChat(url, body, onToken, streamTimeoutMs, streamMaxBytes);
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
    const result = await streamAnthropic(url, body, onToken, streamTimeoutMs, streamMaxBytes);
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

async function gatherContextLoop(params) {
  const scriptPath = path.resolve(process.argv[1] || "");
  const cwd = process.cwd();
  const gitRoot = findGitRoot(cwd);
  const roots = [cwd, gitRoot, path.dirname(scriptPath)].filter(Boolean);
  const allowedCommands = Array.from(CONTEXT_ALLOWED_COMMANDS.keys());
  const chunks = [];
  let totalBytes = 0;
  const seenFiles = new Set();
  const seenCommands = new Set();
  const notes = [];

  const debug = (...args) => {
    if (params.debug) {
      console.error("[delegate:context]", ...args);
    }
  };

  const addChunk = (title, body) => {
    const chunk = `## ${title}\n${body}`;
    const bytes = Buffer.byteLength(chunk, "utf8");
    if (totalBytes + bytes > params.maxBytes) {
      debug(`context budget reached (${totalBytes} >= ${params.maxBytes})`);
      return false;
    }
    totalBytes += bytes;
    chunks.push(chunk);
    return true;
  };

  const hash = (() => {
    try {
      const src = fs.readFileSync(scriptPath, "utf8");
      return crypto.createHash("sha256").update(src).digest("hex");
    } catch {
      return "unknown";
    }
  })();

  const baseLines = [
    `script: ${scriptPath}`,
    `script_sha256: ${hash}`,
    `cwd: ${cwd}`,
    `node: ${process.version}`,
    `os: ${os.platform()} ${os.release()}`,
    gitRoot ? `git_root: ${gitRoot}` : "git_root: (none)",
  ];
  addChunk("runtime", baseLines.join("\n"));

  const scriptRead = readTextFileSafe(scriptPath, {
    roots,
    maxBytes: params.maxFileBytes,
    maxLines: params.maxFileLines,
  });
  if (scriptRead.content && addChunk("script_source", scriptRead.content)) {
    seenFiles.add(scriptPath);
  }

  if (gitRoot) {
    for (const cmd of ["git branch --show-current", "git status --short"]) {
      const argv = CONTEXT_ALLOWED_COMMANDS.get(cmd);
      if (!argv) continue;
      try {
        const output = await runCommand(argv, DEFAULT_CONTEXT_TIMEOUT_MS, params.maxFileBytes);
        if (
          addChunk(
            `command: ${cmd}`,
            scrubSecrets(truncateBytes(output, params.maxFileBytes)) || "(no output)",
          )
        ) {
          seenCommands.add(cmd);
        }
      } catch (err) {
        notes.push(`command ${cmd}: ${err?.message || String(err)}`);
      }
    }
  }

  const markers = findProjectMarkers(gitRoot || cwd);
  if (markers.length) {
    addChunk("project_markers", markers.join("\n"));
  }

  const promptHints = extractPromptFileHints(params.prompt);
  for (const file of promptHints) {
    if (seenFiles.has(file)) continue;
    const read = readTextFileSafe(file, {
      roots,
      maxBytes: params.maxFileBytes,
      maxLines: params.maxFileLines,
    });
    if (read.error) {
      notes.push(`file ${file}: ${read.error}`);
      continue;
    }
    if (addChunk(`file: ${read.path}`, read.content)) {
      seenFiles.add(read.path);
    }
  }

  let summary = [
    `files: ${Array.from(seenFiles).join(", ") || "none"}`,
    `commands: ${Array.from(seenCommands).join(", ") || "none"}`,
  ].join("\n");

  for (let round = 0; round < params.rounds; round += 1) {
    const scoutPrompt = buildContextScoutPrompt({
      prompt: params.prompt,
      summary,
      allowedCommands,
      allowedRoots: roots,
      projectMarkers: markers,
    });
    debug(`context scout round ${round + 1}/${params.rounds}`);
    const scoutMessages = [
      { role: "system", content: CONTEXT_SCOUT_SYSTEM },
      { role: "user", content: scoutPrompt },
    ];
    const scoutResult = await runModel(params.apiType, params.baseUrl, params.model, scoutPrompt, {
      messages: scoutMessages,
      stream: false,
    });
    const request = normalizeContextRequest(extractJson(scoutResult.content));
    if (!request || request.status === "enough") {
      debug("context scout reports enough context");
      break;
    }

    let added = 0;

    for (const file of request.files) {
      if (seenFiles.has(file)) continue;
      const read = readTextFileSafe(file, {
        roots,
        maxBytes: params.maxFileBytes,
        maxLines: params.maxFileLines,
      });
      if (read.error) {
        notes.push(`file ${file}: ${read.error}`);
        continue;
      }
      if (addChunk(`file: ${read.path}`, read.content)) {
        seenFiles.add(read.path);
        added += 1;
      }
    }

    for (const command of request.commands) {
      if (seenCommands.has(command)) continue;
      const argv = CONTEXT_ALLOWED_COMMANDS.get(command);
      if (!argv) {
        notes.push(`command ${command}: not allowed`);
        continue;
      }
      try {
        const output = await runCommand(argv, DEFAULT_CONTEXT_TIMEOUT_MS, params.maxFileBytes);
        const cleaned = scrubSecrets(truncateBytes(output, params.maxFileBytes));
        if (addChunk(`command: ${command}`, cleaned || "(no output)")) {
          seenCommands.add(command);
          added += 1;
        }
      } catch (err) {
        notes.push(`command ${command}: ${err?.message || String(err)}`);
      }
    }

    if (request.questions.length) {
      notes.push(`questions: ${request.questions.join(" | ")}`);
    }

    if (added === 0) {
      debug("no new context added; stopping");
      break;
    }

    summary = [
      `files: ${Array.from(seenFiles).join(", ") || "none"}`,
      `commands: ${Array.from(seenCommands).join(", ") || "none"}`,
      `notes: ${notes.length}`,
    ].join("\n");
  }

  if (notes.length) {
    addChunk("notes", notes.join("\n"));
  }

  if (!chunks.length) {
    return { context: "", meta: { files: [], commands: [], notes: [] } };
  }

  const context = `# Auto-collected context (delegate)\n\n${chunks.join("\n\n")}`.trim();
  return {
    context,
    meta: {
      files: Array.from(seenFiles),
      commands: Array.from(seenCommands),
      notes,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const stdin = await readStdin();
  const prompt = args.prompt ?? stdin;
  const apiType = normalizeApi(args.api || process.env.LM_PROXY_API);
  const baseUrl = resolveApiBaseUrl(apiType, args.baseUrl);
  const tools = parseTools(args);
  const contextMode = normalizeContextMode(args.contextMode || process.env.DELEGATE_CONTEXT_MODE);
  const contextModel = resolveContextModel(
    apiType,
    args.contextModel || process.env.DELEGATE_CONTEXT_MODEL,
  );
  const contextRounds = parseNumber(
    args.contextRounds ?? process.env.DELEGATE_CONTEXT_ROUNDS,
    DEFAULT_CONTEXT_ROUNDS,
  );
  const contextMaxBytes = parseNumber(
    args.contextMaxBytes ?? process.env.DELEGATE_CONTEXT_MAX_BYTES,
    DEFAULT_CONTEXT_MAX_BYTES,
  );
  const contextMaxFileBytes = parseNumber(
    args.contextMaxFileBytes ?? process.env.DELEGATE_CONTEXT_MAX_FILE_BYTES,
    DEFAULT_CONTEXT_MAX_FILE_BYTES,
  );
  const contextMaxFileLines = parseNumber(
    args.contextMaxFileLines ?? process.env.DELEGATE_CONTEXT_MAX_FILE_LINES,
    DEFAULT_CONTEXT_MAX_FILE_LINES,
  );
  const contextDebug = Boolean(args.contextDebug || process.env.DELEGATE_CONTEXT_DEBUG === "1");
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

  let effectivePrompt = prompt;
  let contextBundle = null;
  if (contextMode !== "none") {
    contextBundle = await gatherContextLoop({
      prompt,
      apiType,
      baseUrl,
      model: contextModel,
      rounds: Math.max(1, contextRounds),
      maxBytes: Math.max(1000, contextMaxBytes),
      maxFileBytes: Math.max(1000, contextMaxFileBytes),
      maxFileLines: Math.max(20, contextMaxFileLines),
      debug: contextDebug,
    });
    if (contextBundle && contextBundle.context) {
      effectivePrompt = `${contextBundle.context}\n\nUser request:\n${prompt}`;
    }
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
      ? await runModelWithTools(apiType, baseUrl, model, effectivePrompt, {
          tools,
          toolChoice,
          toolMaxSteps,
          stream: false,
        })
      : await runModel(apiType, baseUrl, model, effectivePrompt, {
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
  const payload = {
    prompt,
    effectivePrompt,
    context: contextBundle?.context || null,
    results,
    report: report.content,
  };

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
