import type { RuntimeEnv } from "openclaw/plugin-sdk";
import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type SignalBridgeOpts = {
  signalPhone: string;
  signalWsUrl: string;
  signalApiUrl: string;
  gatewayWsUrl: string;
  gatewayToken: string;
  sessionId: string;
  logFile?: string;
  pythonPath?: string;
  runtime?: RuntimeEnv;
};

export type SignalBridgeHandle = {
  pid?: number;
  stop: () => void;
  isRunning: () => boolean;
};

function buildBridgeEnv(opts: SignalBridgeOpts): Record<string, string> {
  return {
    SIGNAL_PHONE_NUMBER: opts.signalPhone,
    SIGNAL_WS_URL: opts.signalWsUrl,
    SIGNAL_API_URL: opts.signalApiUrl,
    GATEWAY_WS_URL: opts.gatewayWsUrl,
    GATEWAY_TOKEN: opts.gatewayToken,
    SESSION_ID: opts.sessionId,
    LOG_FILE: opts.logFile || "/tmp/openclaw-signal-bridge.log",
    PYTHONUNBUFFERED: "1",
  };
}

export function spawnSignalBridge(opts: SignalBridgeOpts): SignalBridgeHandle {
  const bridgeScriptPath = join(__dirname, "..", "bridge", "main.py");
  const pythonPath = opts.pythonPath || "python3";
  const env = { ...process.env, ...buildBridgeEnv(opts) };

  const log = opts.runtime?.log ?? (() => {});
  const error = opts.runtime?.error ?? (() => {});

  log(`[SignalBridge] Starting Python bridge: ${pythonPath} ${bridgeScriptPath}`);
  log(`[SignalBridge] Signal: ${opts.signalPhone}`);
  log(`[SignalBridge] Gateway: ${opts.gatewayWsUrl}`);

  const child = spawn(pythonPath, [bridgeScriptPath], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  let isRunning = true;

  child.stdout?.on("data", (data) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        log(`[SignalBridge] ${trimmed}`);
      }
    }
  });

  child.stderr?.on("data", (data) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        // Check if it's an error or just log
        if (/\b(ERROR|CRITICAL|EXCEPTION|FAILED)\b/i.test(trimmed)) {
          error(`[SignalBridge] ${trimmed}`);
        } else {
          log(`[SignalBridge] ${trimmed}`);
        }
      }
    }
  });

  child.on("error", (err) => {
    error(`[SignalBridge] Spawn error: ${String(err)}`);
    isRunning = false;
  });

  child.on("exit", (code) => {
    log(`[SignalBridge] Process exited with code ${code}`);
    isRunning = false;
  });

  return {
    pid: child.pid ?? undefined,
    isRunning: () => isRunning,
    stop: () => {
      if (isRunning && !child.killed) {
        log("[SignalBridge] Stopping...");
        child.kill("SIGTERM");
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!child.killed) {
            error("[SignalBridge] Force killing...");
            child.kill("SIGKILL");
          }
        }, 5000);
      }
    },
  };
}
