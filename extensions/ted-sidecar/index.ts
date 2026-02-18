import fs from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

const DEFAULT_BASE_URL = "http://127.0.0.1:48080";
const DEFAULT_TIMEOUT_MS = 5000;
const ALLOWED_PATHS = new Set(["/status", "/doctor"]);
const DEFAULT_HEALTH_CHECK_RETRIES = 20;
const DEFAULT_HEALTH_CHECK_DELAY_MS = 250;

type TedSidecarPluginConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  autostart?: boolean;
  sidecarPath?: string;
};

type TedHealthPayload = {
  version: string;
  uptime: number;
  profiles_count: number;
};

let sidecarProcess: ChildProcess | null = null;
let sidecarLastError: string | null = null;

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function normalizeBaseUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid ted-sidecar baseUrl");
  }

  if (!isLoopbackHost(parsed.hostname)) {
    throw new Error("ted-sidecar baseUrl must be loopback-only");
  }

  if (parsed.username || parsed.password) {
    throw new Error("ted-sidecar baseUrl must not include credentials");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("ted-sidecar baseUrl must use http or https");
  }

  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

function resolveBaseUrl(pluginConfig: TedSidecarPluginConfig | undefined): URL {
  const fromPlugin = typeof pluginConfig?.baseUrl === "string" ? pluginConfig.baseUrl.trim() : "";
  const fromEnv = process.env.TED_SIDECAR_BASE_URL?.trim() || "";
  const selected = fromPlugin || fromEnv || DEFAULT_BASE_URL;
  return normalizeBaseUrl(selected);
}

function resolveTimeoutMs(pluginConfig: TedSidecarPluginConfig | undefined): number {
  const raw = pluginConfig?.timeoutMs;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return DEFAULT_TIMEOUT_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePathFromAction(action: string): string {
  const normalized = action.trim().toLowerCase();
  if (normalized === "doctor" || normalized === "") {
    return "/doctor";
  }
  if (normalized === "status") {
    return "/status";
  }
  throw new Error("Usage: /ted doctor | /ted status");
}

function buildSafeEndpoint(baseUrl: URL, targetPath: string): URL {
  if (!ALLOWED_PATHS.has(targetPath)) {
    throw new Error(`Path blocked by allowlist: ${targetPath}`);
  }
  const endpoint = new URL(targetPath, baseUrl);
  if (!isLoopbackHost(endpoint.hostname)) {
    throw new Error("Resolved endpoint is not loopback");
  }
  if (!ALLOWED_PATHS.has(endpoint.pathname)) {
    throw new Error(`Path blocked by allowlist: ${endpoint.pathname}`);
  }
  return endpoint;
}

function formatPayload(action: string, payload: TedHealthPayload): string {
  const title = action === "status" ? "Ted sidecar status" : "Ted sidecar doctor";
  return [
    `${title}:`,
    `- version: ${payload.version}`,
    `- uptime: ${payload.uptime}`,
    `- profiles_count: ${payload.profiles_count}`,
  ].join("\n");
}

async function fetchTedPayload(endpoint: URL, timeoutMs: number): Promise<TedHealthPayload> {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Sidecar request failed (${response.status})`);
  }

  const body = (await response.json()) as Partial<TedHealthPayload>;
  if (
    typeof body.version !== "string" ||
    typeof body.uptime !== "number" ||
    typeof body.profiles_count !== "number"
  ) {
    throw new Error("Sidecar returned invalid payload");
  }

  return {
    version: body.version,
    uptime: body.uptime,
    profiles_count: body.profiles_count,
  };
}

async function probeTedSidecar(baseUrl: URL, timeoutMs: number): Promise<{
  ok: boolean;
  status?: TedHealthPayload;
  doctor?: TedHealthPayload;
  error?: string;
}> {
  try {
    const [status, doctor] = await Promise.all([
      fetchTedPayload(buildSafeEndpoint(baseUrl, "/status"), timeoutMs),
      fetchTedPayload(buildSafeEndpoint(baseUrl, "/doctor"), timeoutMs),
    ]);
    sidecarLastError = null;
    return { ok: true, status, doctor };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    sidecarLastError = message;
    return { ok: false, error: message };
  }
}

async function waitForTedSidecarHealthy(
  baseUrl: URL,
  timeoutMs: number,
  retries = DEFAULT_HEALTH_CHECK_RETRIES,
): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i < retries; i += 1) {
    const probe = await probeTedSidecar(baseUrl, timeoutMs);
    if (probe.ok) {
      return { ok: true };
    }
    await sleep(DEFAULT_HEALTH_CHECK_DELAY_MS);
  }
  return { ok: false, error: sidecarLastError ?? "ted sidecar did not become healthy" };
}

function stopTedSidecarProcess() {
  const active = sidecarProcess;
  sidecarProcess = null;
  if (!active) {
    return;
  }
  try {
    active.kill("SIGTERM");
  } catch {
    // ignore
  }
  setTimeout(() => {
    if (active.exitCode == null) {
      try {
        active.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
  }, 2_000).unref();
}

function resolveSidecarPaths(
  api: OpenClawPluginApi,
  pluginConfig: TedSidecarPluginConfig | undefined,
): { entry: string; logsDir: string } | null {
  const configuredPath =
    typeof pluginConfig?.sidecarPath === "string" ? pluginConfig.sidecarPath.trim() : "";
  const candidates: string[] = [];

  if (configuredPath) {
    candidates.push(api.resolvePath(configuredPath));
  }
  candidates.push(api.resolvePath("sidecars/ted-engine/server.mjs"));

  if (fs.existsSync(api.source)) {
    const pluginDir = path.dirname(api.source);
    candidates.push(path.resolve(pluginDir, "../../sidecars/ted-engine/server.mjs"));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return {
        entry: candidate,
        logsDir: path.join(path.dirname(candidate), "logs"),
      };
    }
  }
  return null;
}

export default function register(api: OpenClawPluginApi) {
  api.registerService({
    id: "ted-engine",
    start: async () => {
      const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
      if (pluginConfig.autostart === false) {
        api.logger.info("ted-sidecar: autostart disabled via config");
        return;
      }

      const baseUrl = resolveBaseUrl(pluginConfig);
      const timeoutMs = resolveTimeoutMs(pluginConfig);
      const sidecar = resolveSidecarPaths(api, pluginConfig);
      if (!sidecar) {
        sidecarLastError = "ted sidecar entry not found (set ted-sidecar.config.sidecarPath)";
        api.logger.warn(`ted-sidecar: ${sidecarLastError}`);
        return;
      }
      const sidecarEntry = sidecar.entry;
      const logsDir = sidecar.logsDir;

      fs.mkdirSync(logsDir, { recursive: true });
      stopTedSidecarProcess();

      const child = spawn(process.execPath, [sidecarEntry], {
        cwd: path.dirname(sidecarEntry),
        env: process.env,
        stdio: "ignore",
      });
      sidecarProcess = child;
      child.on("exit", (code, signal) => {
        if (sidecarProcess === child) {
          sidecarProcess = null;
        }
        if (code !== 0) {
          sidecarLastError = `ted sidecar exited (code=${String(code)}, signal=${String(signal ?? "")})`;
          api.logger.warn(`ted-sidecar: ${sidecarLastError}`);
        }
      });

      const healthy = await waitForTedSidecarHealthy(baseUrl, timeoutMs);
      if (!healthy.ok) {
        api.logger.warn(
          `ted-sidecar: started but unhealthy (${healthy.error ?? "unknown reason"}); /ted doctor and /ted status remain available`,
        );
      } else {
        api.logger.info("ted-sidecar: sidecar healthy");
      }
    },
    stop: async () => {
      stopTedSidecarProcess();
    },
  });

  api.registerCommand({
    name: "ted",
    description: "Ted sidecar health checks (/ted doctor, /ted status).",
    acceptsArgs: true,
    handler: async (ctx) => {
      try {
        const pluginConfig = (api.pluginConfig ?? {}) as TedSidecarPluginConfig;
        const baseUrl = resolveBaseUrl(pluginConfig);
        const timeoutMs = resolveTimeoutMs(pluginConfig);
        const action = ctx.args?.trim().toLowerCase() ?? "doctor";
        if (action !== "doctor" && action !== "status") {
          const probe = await probeTedSidecar(baseUrl, timeoutMs);
          if (!probe.ok) {
            return {
              text:
                "Ted sidecar is unhealthy. Only /ted doctor and /ted status are allowed until it recovers.",
            };
          }
          return { text: "Usage: /ted doctor | /ted status" };
        }
        const targetPath = resolvePathFromAction(action);
        const endpoint = buildSafeEndpoint(baseUrl, targetPath);

        const payload = await fetchTedPayload(endpoint, timeoutMs);
        return { text: formatPayload(action || "doctor", payload) };
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        api.logger.warn(`ted-sidecar command failed: ${message}`);
        return { text: `Ted command failed: ${message}` };
      }
    },
  });
}

export {
  buildSafeEndpoint,
  isLoopbackHost,
  normalizeBaseUrl,
  resolvePathFromAction,
};
