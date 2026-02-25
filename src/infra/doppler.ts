import { execFileSync } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BUFFER_BYTES = 4 * 1024 * 1024;

export type DopplerConfig = {
  enabled?: boolean;
  required?: boolean;
  project?: string;
  config?: string;
  timeoutMs?: number;
};

export type DopplerResult =
  | { ok: true; applied: string[]; skippedReason?: never }
  | { ok: true; applied: []; skippedReason: "disabled" | "no-token" | "not-installed" }
  | { ok: false; error: string; applied: [] };

export type DopplerOptions = {
  env: NodeJS.ProcessEnv;
  logger?: Pick<typeof console, "warn">;
  dopplerConfig?: DopplerConfig;
  exec?: typeof execFileSync;
};

export function shouldAutoEnableDoppler(env: NodeJS.ProcessEnv): boolean {
  const token = env.DOPPLER_TOKEN?.trim();
  return typeof token === "string" && token.length > 0;
}

function resolveDopplerTimeoutMs(
  dopplerConfig: DopplerConfig | undefined,
  env: NodeJS.ProcessEnv,
): number {
  if (
    typeof dopplerConfig?.timeoutMs === "number" &&
    Number.isFinite(dopplerConfig.timeoutMs)
  ) {
    return Math.max(0, dopplerConfig.timeoutMs);
  }
  const raw = env.OPENCLAW_DOPPLER_TIMEOUT_MS?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }
  return DEFAULT_TIMEOUT_MS;
}

function isDopplerInstalled(exec: typeof execFileSync): boolean {
  try {
    exec("doppler", ["--version"], {
      encoding: "utf8",
      timeout: 5_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

export function loadDopplerSecrets(opts: DopplerOptions): DopplerResult {
  const logger = opts.logger ?? console;
  const exec = opts.exec ?? execFileSync;
  const dopplerConfig = opts.dopplerConfig;
  const isRequired = dopplerConfig?.required === true;

  // Explicit disable takes priority
  if (dopplerConfig?.enabled === false) {
    if (isRequired) {
      throw new Error("[openclaw] Doppler is required but explicitly disabled in config.");
    }
    return { ok: true, applied: [], skippedReason: "disabled" };
  }

  // Determine if we should run: explicit enable OR auto-detect via DOPPLER_TOKEN
  const hasToken = shouldAutoEnableDoppler(opts.env);
  const explicitlyEnabled = dopplerConfig?.enabled === true;

  if (!hasToken && !explicitlyEnabled) {
    if (isRequired) {
      throw new Error(
        "[openclaw] Doppler is required but DOPPLER_TOKEN is not set and env.doppler.enabled is not true.",
      );
    }
    return { ok: true, applied: [], skippedReason: "no-token" };
  }

  // Check CLI availability
  if (!isDopplerInstalled(exec)) {
    if (isRequired) {
      throw new Error("[openclaw] Doppler is required but the CLI is not installed.");
    }
    if (explicitlyEnabled) {
      logger.warn("[openclaw] Doppler is enabled in config but the CLI is not installed.");
    }
    return { ok: true, applied: [], skippedReason: "not-installed" };
  }

  const timeoutMs = resolveDopplerTimeoutMs(dopplerConfig, opts.env);

  const args = ["secrets", "download", "--json", "--no-file"];
  if (dopplerConfig?.project) {
    args.push("--project", dopplerConfig.project);
  }
  if (dopplerConfig?.config) {
    args.push("--config", dopplerConfig.config);
  }

  let stdout: string;
  try {
    stdout = exec("doppler", args, {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: DEFAULT_MAX_BUFFER_BYTES,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
    }) as string;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isRequired) {
      throw new Error(`[openclaw] Doppler is required but secrets fetch failed: ${msg}`);
    }
    logger.warn(`[openclaw] Doppler secrets fetch failed: ${msg}`);
    return { ok: false, error: msg, applied: [] };
  }

  let secrets: Record<string, string>;
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    secrets = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        secrets[key] = value;
      } else if (
        typeof value === "object" &&
        value !== null &&
        "computed" in value &&
        typeof (value as { computed?: unknown }).computed === "string"
      ) {
        secrets[key] = (value as { computed: string }).computed;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isRequired) {
      throw new Error(`[openclaw] Doppler is required but secrets parse failed: ${msg}`);
    }
    logger.warn(`[openclaw] Doppler secrets parse failed: ${msg}`);
    return { ok: false, error: msg, applied: [] };
  }

  const applied: string[] = [];
  for (const [key, value] of Object.entries(secrets)) {
    // Skip Doppler internal keys
    if (key === "DOPPLER_PROJECT" || key === "DOPPLER_CONFIG" || key === "DOPPLER_ENVIRONMENT") {
      continue;
    }
    // No-override: skip keys where env already has a truthy value
    if (opts.env[key]?.trim()) {
      continue;
    }
    if (!value.trim()) {
      continue;
    }
    opts.env[key] = value;
    applied.push(key);
  }

  return { ok: true, applied };
}
