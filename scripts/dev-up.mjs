#!/usr/bin/env node
/**
 * Zero-friction dev launcher for Moltbot.
 *
 * Usage:
 *   pnpm dev:up           # Start gateway + TUI
 *   pnpm dev:up --reset   # Clear persisted session model before starting
 *
 * This script:
 * 1. Automatically finds and changes to the repo root
 * 2. Loads .env from repo root (belt-and-suspenders with existing dotenv)
 * 3. Spawns gateway:dev and waits for ready signal
 * 4. Spawns tui:dev when gateway is ready
 * 5. Handles Ctrl+C gracefully
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const GATEWAY_READY_PATTERNS = [
  /listening on ws:\/\/127\.0\.0\.1:19001/,
  /Health: OK/,
];
const GATEWAY_TIMEOUT_MS = 60_000;
const KILL_GRACE_MS = 3000;

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Find repo root by locating package.json with name "moltbot".
 */
function findRepoRoot(startDir = process.cwd()) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, "package.json");
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.name === "moltbot" && pkg.scripts?.["gateway:dev"]) {
        return dir;
      }
    } catch {
      // Continue searching
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Load .env file into process.env (simple key=value parser).
 */
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const vars = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

/**
 * Print a banner with key/value info.
 */
function printBanner(title, lines) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}`);
  for (const [key, value] of lines) {
    console.log(`  ${key.padEnd(20)} ${value}`);
  }
  console.log(`${"─".repeat(60)}\n`);
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

const args = process.argv.slice(2);
const doReset = args.includes("--reset");

// 1. Find repo root
const repoRoot = findRepoRoot();
if (!repoRoot) {
  console.error("ERROR: Cannot find moltbot repo root (package.json with name=moltbot).");
  process.exit(1);
}
process.chdir(repoRoot);
console.log(`[dev-up] Repo root: ${repoRoot}`);

// 2. Load .env
const envPath = path.join(repoRoot, ".env");
const envVars = loadEnvFile(envPath);
const mergedEnv = { ...process.env, ...envVars };

// Pin workspace to repo root so stale moltbot.json defaults (e.g. ~/clawd-dev) are ignored.
// Only set if the user hasn't already exported CLAWDBOT_WORKSPACE themselves.
if (!mergedEnv.CLAWDBOT_WORKSPACE) {
  mergedEnv.CLAWDBOT_WORKSPACE = repoRoot;
  console.log(`[dev-up] CLAWDBOT_WORKSPACE=${repoRoot} (auto)`);
}

// Print env diagnostics (no secrets)
const envKeys = Object.keys(envVars);
const hasKeys = {
  MOONSHOT_API_KEY: !!mergedEnv.MOONSHOT_API_KEY?.trim(),
  ANTHROPIC_API_KEY: !!mergedEnv.ANTHROPIC_API_KEY?.trim(),
  OPENAI_API_KEY: !!mergedEnv.OPENAI_API_KEY?.trim(),
  CLAWDBOT_GATEWAY_TOKEN: !!mergedEnv.CLAWDBOT_GATEWAY_TOKEN?.trim(),
};
console.log(`[dev-up] Loaded ${envKeys.length} vars from .env`);
console.log(`[dev-up] API keys present: ${Object.entries(hasKeys).filter(([,v]) => v).map(([k]) => k).join(", ") || "(none)"}`);

// Determine effective default based on presence of MOONSHOT_API_KEY
// Model ID must match MOONSHOT_DEFAULT_MODEL_ID (kimi-k2-0905-preview)
const effectiveProvider = hasKeys.MOONSHOT_API_KEY ? "moonshot" : "ollama";
const effectiveModel = effectiveProvider === "moonshot" ? "kimi-k2-0905-preview" : "llama3:chat";
console.log(`[dev-up] Effective default: ${effectiveProvider}/${effectiveModel}`);

// Child process handles
let gatewayProc = null;
let tuiProc = null;
let shuttingDown = false;

/**
 * Kill child processes gracefully, then forcefully.
 */
async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n[dev-up] Shutting down...");

  const procs = [tuiProc, gatewayProc].filter(Boolean);
  for (const proc of procs) {
    try {
      proc.kill("SIGTERM");
    } catch {
      // ignore
    }
  }

  // Wait for grace period
  await new Promise((resolve) => setTimeout(resolve, KILL_GRACE_MS));

  // Force kill any remaining
  for (const proc of procs) {
    try {
      proc.kill("SIGKILL");
    } catch {
      // ignore
    }
  }

  process.exit(exitCode);
}

// Handle Ctrl+C
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// 3. Start gateway
console.log("[dev-up] Starting gateway...");

const gatewayCmd = doReset ? "gateway:dev:reset" : "gateway:dev";
gatewayProc = spawn("pnpm", [gatewayCmd], {
  cwd: repoRoot,
  env: mergedEnv,
  stdio: ["ignore", "pipe", "pipe"],
});

let gatewayReady = false;
let gatewayOutput = "";

const checkGatewayReady = (data) => {
  const text = data.toString();
  gatewayOutput += text;
  process.stdout.write(text);

  for (const pattern of GATEWAY_READY_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
};

gatewayProc.stdout.on("data", (data) => {
  if (checkGatewayReady(data)) gatewayReady = true;
});

gatewayProc.stderr.on("data", (data) => {
  const text = data.toString();
  process.stderr.write(text);
  // Also check stderr for ready patterns (some logs go there)
  for (const pattern of GATEWAY_READY_PATTERNS) {
    if (pattern.test(text)) {
      gatewayReady = true;
    }
  }
});

gatewayProc.on("error", (err) => {
  console.error(`[dev-up] Gateway error: ${err.message}`);
  shutdown(1);
});

gatewayProc.on("exit", (code, signal) => {
  if (!shuttingDown) {
    console.log(`[dev-up] Gateway exited (code=${code}, signal=${signal})`);
    shutdown(code ?? 1);
  }
});

// 4. Wait for gateway ready with timeout
const startTime = Date.now();
await new Promise((resolve, reject) => {
  const checkInterval = setInterval(() => {
    if (gatewayReady) {
      clearInterval(checkInterval);
      resolve();
      return;
    }
    if (Date.now() - startTime > GATEWAY_TIMEOUT_MS) {
      clearInterval(checkInterval);
      reject(new Error("Gateway startup timeout"));
    }
  }, 500);
}).catch((err) => {
  console.error(`[dev-up] ${err.message}`);
  console.error("[dev-up] Hint: Check if another gateway is running on port 19001");
  console.error("[dev-up] Hint: Run 'pnpm dev:down' to kill existing processes");
  shutdown(1);
});

console.log("[dev-up] Gateway ready!");

// 5. Start TUI
console.log("[dev-up] Starting TUI...");

tuiProc = spawn("pnpm", ["tui:dev"], {
  cwd: repoRoot,
  env: mergedEnv,
  stdio: "inherit",
});

tuiProc.on("error", (err) => {
  console.error(`[dev-up] TUI error: ${err.message}`);
  shutdown(1);
});

tuiProc.on("exit", (code, signal) => {
  if (!shuttingDown) {
    console.log(`[dev-up] TUI exited (code=${code}, signal=${signal})`);
    shutdown(code ?? 0);
  }
});

// Print ready banner
printBanner("MOLTBOT DEV READY", [
  ["Gateway", "ws://127.0.0.1:19001"],
  ["Provider", effectiveProvider],
  ["Model", effectiveModel],
  ["Profile", "dev"],
  ["Config", "~/.clawdbot-dev"],
]);
