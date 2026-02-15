/**
 * Ngrok Process Manager
 *
 * Starts ngrok once and keeps it running for OAuth callbacks.
 * Kills stale processes, health-checks via ngrok's local API,
 * and auto-restarts on crash.
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";

let ngrokProcess: ChildProcess | null = null;
let ngrokReady = false;

export type NgrokConfig = {
  authToken: string;
  domain: string;
  port: number;
};

let savedConfig: NgrokConfig | null = null;

/**
 * Kill any existing ngrok processes (including orphans from previous runs).
 */
function killStaleNgrok(): void {
  try {
    execSync("pkill -f 'ngrok http' 2>/dev/null || true", { stdio: "ignore" });
  } catch {
    // ignore — no ngrok running
  }
}

/**
 * Health check via ngrok's local API (port 4040).
 * Returns true if ngrok tunnel is live.
 */
async function healthCheck(domain: string): Promise<boolean> {
  try {
    const resp = await fetch("http://127.0.0.1:4040/api/tunnels", {
      signal: AbortSignal.timeout(2000),
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as { tunnels?: Array<{ public_url?: string }> };
    return (data.tunnels ?? []).some((t) => t.public_url?.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Start ngrok tunnel if not already running.
 * Returns the public URL when ready.
 */
export async function startNgrok(
  config: NgrokConfig,
): Promise<{ url: string } | { error: string }> {
  savedConfig = config;

  // Already running — verify with health check
  if (ngrokProcess && ngrokReady) {
    const healthy = await healthCheck(config.domain);
    if (healthy) {
      return { url: `https://${config.domain}` };
    }
    // Stale — kill and restart
    ngrokProcess.kill("SIGTERM");
    ngrokProcess = null;
    ngrokReady = false;
  }

  // Kill any orphan ngrok processes
  killStaleNgrok();
  await new Promise((r) => setTimeout(r, 500));

  return new Promise((resolve) => {
    // Set auth token (idempotent, fast)
    try {
      execSync(`ngrok config add-authtoken ${config.authToken}`, { stdio: "ignore" });
    } catch (err) {
      resolve({ error: `ngrok not installed or auth token failed: ${String(err)}` });
      return;
    }

    // Start the tunnel
    ngrokProcess = spawn("ngrok", ["http", config.port.toString(), `--domain=${config.domain}`], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    let errorOutput = "";

    ngrokProcess.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });

    ngrokProcess.on("error", (err) => {
      ngrokProcess = null;
      ngrokReady = false;
      resolve({ error: `Failed to start ngrok: ${err.message}` });
    });

    ngrokProcess.on("close", (code) => {
      const wasReady = ngrokReady;
      ngrokProcess = null;
      ngrokReady = false;
      if (wasReady && code !== 0) {
        // Unexpected crash — auto-restart after a delay
        console.error(`[2fa-github] ngrok crashed (code ${code}), restarting in 3s...`);
        setTimeout(() => {
          if (savedConfig && !ngrokProcess) {
            startNgrok(savedConfig).catch(() => {});
          }
        }, 3000);
      }
    });

    // Wait for tunnel to be ready via health check (up to 5 seconds)
    let attempts = 0;
    const checkReady = async () => {
      attempts++;
      const healthy = await healthCheck(config.domain);
      if (healthy) {
        ngrokReady = true;
        resolve({ url: `https://${config.domain}` });
        return;
      }
      if (attempts >= 10) {
        // Give up after 5 seconds
        if (ngrokProcess) {
          // Process is running but tunnel not verified — trust it
          ngrokReady = true;
          resolve({ url: `https://${config.domain}` });
        } else {
          resolve({ error: `ngrok failed to start: ${errorOutput || "unknown error"}` });
        }
        return;
      }
      setTimeout(checkReady, 500);
    };
    setTimeout(checkReady, 500);
  });
}

/**
 * Stop ngrok tunnel.
 */
export async function stopNgrok(): Promise<void> {
  if (ngrokProcess) {
    ngrokProcess.kill("SIGTERM");
    ngrokProcess = null;
    ngrokReady = false;
    await new Promise((r) => setTimeout(r, 500));
  }
  killStaleNgrok();
}

/**
 * Check if ngrok is currently running and ready.
 */
export function isNgrokRunning(): boolean {
  return ngrokProcess !== null && ngrokReady;
}
