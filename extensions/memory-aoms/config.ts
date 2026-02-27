export type AomsMemoryConfig = {
  baseUrl: string;
  timeoutMs: number;
  apiKey?: string;
};

export const DEFAULT_AOMS_BASE_URL = "http://localhost:9100";
export const DEFAULT_AOMS_TIMEOUT_MS = 10_000;

const ALLOWED_CONFIG_KEYS = ["baseUrl", "timeoutMs", "apiKey"] as const;

function assertAllowedKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) {
    return;
  }
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("baseUrl is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("baseUrl must be a valid URL");
  }
  return parsed.toString().replace(/\/$/, "");
}

export const aomsMemoryConfigSchema = {
  parse(value: unknown): AomsMemoryConfig {
    if (value === undefined) {
      return {
        baseUrl: DEFAULT_AOMS_BASE_URL,
        timeoutMs: DEFAULT_AOMS_TIMEOUT_MS,
      };
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("memory-aoms config must be an object");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(cfg, ALLOWED_CONFIG_KEYS, "memory-aoms config");

    const baseUrl =
      typeof cfg.baseUrl === "string" ? normalizeBaseUrl(cfg.baseUrl) : DEFAULT_AOMS_BASE_URL;

    const timeoutRaw = cfg.timeoutMs;
    const timeoutMs =
      typeof timeoutRaw === "number" && Number.isFinite(timeoutRaw)
        ? Math.trunc(timeoutRaw)
        : DEFAULT_AOMS_TIMEOUT_MS;
    if (timeoutMs < 500 || timeoutMs > 120_000) {
      throw new Error("timeoutMs must be between 500 and 120000");
    }

    const apiKeyRaw = typeof cfg.apiKey === "string" ? cfg.apiKey.trim() : "";
    const apiKey = apiKeyRaw ? resolveEnvVars(apiKeyRaw) : undefined;

    return {
      baseUrl,
      timeoutMs,
      apiKey,
    };
  },
  uiHints: {
    baseUrl: {
      label: "AOMS Base URL",
      placeholder: DEFAULT_AOMS_BASE_URL,
      help: "Base URL for the AOMS HTTP API.",
    },
    timeoutMs: {
      label: "Request Timeout (ms)",
      placeholder: String(DEFAULT_AOMS_TIMEOUT_MS),
      advanced: true,
    },
    apiKey: {
      label: "AOMS API Key",
      sensitive: true,
      help: "Optional bearer token (or use ${AOMS_API_KEY}).",
      advanced: true,
    },
  },
};
