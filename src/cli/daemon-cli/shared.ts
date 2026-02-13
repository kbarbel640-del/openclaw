import { resolveGatewayWindowsTaskName } from "../../daemon/constants.js";
import { pickPrimaryLanIPv4 } from "../../gateway/net.js";
import { getResolvedLoggerSettings } from "../../logging.js";
import { formatCliCommand } from "../command-format.js";

export function parsePort(raw: unknown): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const value =
    typeof raw === "string"
      ? raw
      : typeof raw === "number" || typeof raw === "bigint"
        ? raw.toString()
        : null;
  if (value === null) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function parsePortFromArgs(programArguments: string[] | undefined): number | null {
  if (!programArguments?.length) {
    return null;
  }
  for (let i = 0; i < programArguments.length; i += 1) {
    const arg = programArguments[i];
    if (arg === "--port") {
      const next = programArguments[i + 1];
      const parsed = parsePort(next);
      if (parsed) {
        return parsed;
      }
    }
    if (arg?.startsWith("--port=")) {
      const parsed = parsePort(arg.split("=", 2)[1]);
      if (parsed) {
        return parsed;
      }
    }
  }
  return null;
}

export function pickProbeHostForBind(
  bindMode: string,
  tailnetIPv4: string | undefined,
  customBindHost?: string,
) {
  if (bindMode === "custom" && customBindHost?.trim()) {
    return customBindHost.trim();
  }
  if (bindMode === "tailnet") {
    return tailnetIPv4 ?? "127.0.0.1";
  }
  if (bindMode === "lan") {
    return pickPrimaryLanIPv4() ?? "127.0.0.1";
  }
  return "127.0.0.1";
}

const SAFE_DAEMON_ENV_KEYS = [
  "OPENCLAW_PROFILE",
  "OPENCLAW_STATE_DIR",
  "OPENCLAW_CONFIG_PATH",
  "OPENCLAW_GATEWAY_PORT",
  "OPENCLAW_NIX_MODE",
];

export function filterDaemonEnv(env: Record<string, string> | undefined): Record<string, string> {
  if (!env) {
    return {};
  }
  const filtered: Record<string, string> = {};
  for (const key of SAFE_DAEMON_ENV_KEYS) {
    const value = env[key];
    if (!value?.trim()) {
      continue;
    }
    filtered[key] = value.trim();
  }
  return filtered;
}

export function safeDaemonEnv(env: Record<string, string> | undefined): string[] {
  const filtered = filterDaemonEnv(env);
  return Object.entries(filtered).map(([key, value]) => `${key}=${value}`);
}

export function normalizeListenerAddress(raw: string): string {
  let value = raw.trim();
  if (!value) {
    return value;
  }
  value = value.replace(/^TCP\s+/i, "");
  value = value.replace(/\s+\(LISTEN\)\s*$/i, "");
  return value.trim();
}

export function formatRuntimeStatus(
  runtime:
    | {
        status?: string;
        state?: string;
        subState?: string;
        pid?: number;
        detail?: string;
      }
    | undefined,
) {
  if (!runtime) {
    return null;
  }
  const status = runtime.status ?? "unknown";
  const details: string[] = [];
  if (runtime.pid) {
    details.push(`pid ${runtime.pid}`);
  }
  if (runtime.state && runtime.state.toLowerCase() !== status) {
    details.push(`state ${runtime.state}`);
  }
  if (runtime.subState) {
    details.push(`sub ${runtime.subState}`);
  }
  if (runtime.detail) {
    details.push(runtime.detail);
  }
  return details.length > 0 ? `${status} (${details.join(", ")})` : status;
}

export function renderRuntimeHints(
  runtime: { missingUnit?: boolean; status?: string } | undefined,
): string[] {
  if (!runtime) {
    return [];
  }
  const hints: string[] = [];
  const fileLog = (() => {
    try {
      return getResolvedLoggerSettings().file;
    } catch {
      return null;
    }
  })();
  
  if (runtime.missingUnit) {
    hints.push(`Service not installed. Run: ${formatCliCommand("openclaw gateway install")}`);
  }
  
  if (fileLog) {
    hints.push(`File logs: ${fileLog}`);
  }
  
  if (runtime.status === "stopped") {
    const task = resolveGatewayWindowsTaskName(process.env.OPENCLAW_PROFILE);
    hints.push(`Task status: schtasks /Query /TN "${task}" /V /FO LIST`);
  }
  return hints;
}

export function renderGatewayServiceStartHints(): string {
  return formatCliCommand("openclaw gateway");
}
