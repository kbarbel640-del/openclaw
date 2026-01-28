/**
 * Provider configuration builders for the Claude Agent SDK.
 *
 * Supports multiple authentication methods:
 * - Anthropic API key (ANTHROPIC_API_KEY)
 * - Claude Code CLI OAuth (reuses ~/.claude credentials)
 * - z.AI subscription (via ANTHROPIC_AUTH_TOKEN or CLI auth)
 * - OpenRouter (Anthropic-compatible API)
 * - AWS Bedrock
 * - Google Vertex AI
 */

import type { SdkProviderConfig, SdkProviderEnv } from "./types.js";
import { readClaudeCliCredentialsCached } from "../cli-credentials.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("agents/claude-agent-sdk");

/**
 * Mask a token for logging - shows length and first/last 4 chars.
 */
function maskToken(token: string | undefined): string {
  if (!token) return "(empty)";
  if (token.length <= 12) return `${"*".repeat(token.length)} (length: ${token.length})`;
  const first = token.slice(0, 4);
  const last = token.slice(-4);
  return `${first}...${"*".repeat(Math.min(8, token.length - 8))}...${last} (length: ${token.length})`;
}

/**
 * Log the resolved provider config with masked credentials.
 */
function logProviderConfig(config: SdkProviderConfig, source: string): void {
  const envKeys = config.env ? Object.keys(config.env) : [];
  const maskedEnv: Record<string, string> = {};

  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      if (key.includes("KEY") || key.includes("TOKEN") || key.includes("SECRET")) {
        maskedEnv[key] = maskToken(value);
      } else {
        maskedEnv[key] = value ?? "(undefined)";
      }
    }
  }

  log.debug("[CCSDK-PROVIDER] Provider config resolved", {
    source,
    providerName: config.name,
    envKeys,
    maskedEnv,
    model: config.model,
    maxTurns: config.maxTurns,
  });
}

/**
 * Build provider config for direct Anthropic API access.
 */
export function buildAnthropicSdkProvider(apiKey: string): SdkProviderConfig {
  return {
    name: "Anthropic",
    env: {
      ANTHROPIC_API_KEY: apiKey,
    },
  };
}

/**
 * Build provider config for Claude Code CLI/subscription auth.
 *
 * This method reads credentials from the Claude Code CLI's keychain/file storage,
 * enabling subscription-based access (Claude Max, z.AI, etc.) without an API key.
 *
 * The SDK will automatically use these credentials when they're available in the
 * environment or via the CLI's native auth mechanism.
 */
export function buildClaudeCliSdkProvider(): SdkProviderConfig | null {
  log.debug("[CCSDK-PROVIDER] buildClaudeCliSdkProvider called");

  // Read cached credentials from Claude Code CLI
  const credentials = readClaudeCliCredentialsCached({
    allowKeychainPrompt: false,
    ttlMs: 60_000, // 1 minute cache
  });

  if (!credentials) {
    log.debug("[CCSDK-PROVIDER] No Claude CLI credentials found from cache");
    return null;
  }

  log.debug("[CCSDK-PROVIDER] Claude CLI credentials loaded", {
    type: credentials.type,
    provider: credentials.provider,
    expiresAt: new Date(credentials.expires).toISOString(),
    isExpired: credentials.expires < Date.now(),
    msUntilExpiry: credentials.expires - Date.now(),
  });

  // For OAuth credentials, use the access token as ANTHROPIC_AUTH_TOKEN
  if (credentials.type === "oauth") {
    // Check if token is expired
    if (credentials.expires < Date.now()) {
      log.warn("[CCSDK-PROVIDER] Claude CLI credentials EXPIRED", {
        expiresAt: new Date(credentials.expires).toISOString(),
        expiredAgo: Date.now() - credentials.expires,
      });
      // Still return the config - the SDK may handle refresh internally
    }

    const config: SdkProviderConfig = {
      name: "Claude CLI (subscription)",
      env: {
        ANTHROPIC_AUTH_TOKEN: credentials.access,
      },
    };
    logProviderConfig(config, "claude-cli-oauth");
    return config;
  }

  // For token-type credentials (less common)
  if (credentials.type === "token") {
    const config: SdkProviderConfig = {
      name: "Claude CLI (token)",
      env: {
        ANTHROPIC_AUTH_TOKEN: credentials.token,
      },
    };
    logProviderConfig(config, "claude-cli-token");
    return config;
  }

  log.debug("[CCSDK-PROVIDER] Unknown credential type", {
    type: (credentials as { type: string }).type,
  });
  return null;
}

/**
 * Build provider config for z.AI subscription access.
 *
 * z.AI uses Anthropic-compatible API with a different base URL.
 */
export function buildZaiSdkProvider(
  authToken: string,
  options?: {
    baseUrl?: string;
    defaultModel?: string;
    haikuModel?: string;
    sonnetModel?: string;
    opusModel?: string;
  },
): SdkProviderConfig {
  const env: SdkProviderEnv = {
    ANTHROPIC_AUTH_TOKEN: authToken,
  };

  // Set base URL if provided (z.AI may use a custom endpoint)
  if (options?.baseUrl) {
    env.ANTHROPIC_BASE_URL = options.baseUrl;
  }

  // Set model tier defaults for z.AI
  if (options?.haikuModel) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = options.haikuModel;
  }
  if (options?.sonnetModel) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = options.sonnetModel;
  }
  if (options?.opusModel) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = options.opusModel;
  }

  const config: SdkProviderConfig = {
    name: "z.AI",
    env,
    model: options?.defaultModel,
  };

  log.debug("[CCSDK-PROVIDER] Built z.AI provider config", {
    hasBaseUrl: Boolean(options?.baseUrl),
    baseUrl: options?.baseUrl ?? "(default)",
    defaultModel: options?.defaultModel ?? "(sdk default)",
    haikuModel: options?.haikuModel ?? "(sdk default)",
    sonnetModel: options?.sonnetModel ?? "(sdk default)",
    opusModel: options?.opusModel ?? "(sdk default)",
    authTokenMasked: maskToken(authToken),
  });

  return config;
}

/**
 * Build provider config for OpenRouter (Anthropic-compatible).
 *
 * OpenRouter requires explicit model names since their model IDs differ
 * from Anthropic's native IDs.
 */
export function buildOpenRouterSdkProvider(
  apiKey: string,
  options?: {
    baseUrl?: string;
    defaultModel?: string;
    haikuModel?: string;
    sonnetModel?: string;
    opusModel?: string;
  },
): SdkProviderConfig {
  const env: SdkProviderEnv = {
    ANTHROPIC_BASE_URL: options?.baseUrl ?? "https://openrouter.ai/api/v1",
    ANTHROPIC_API_KEY: apiKey,
  };

  // OpenRouter uses different model naming - set explicit model IDs
  // Default OpenRouter model names for Anthropic models:
  // - anthropic/claude-3-5-haiku-20241022
  // - anthropic/claude-sonnet-4-20250514
  // - anthropic/claude-opus-4-20250514
  if (options?.haikuModel) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = options.haikuModel;
  }
  if (options?.sonnetModel) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = options.sonnetModel;
  }
  if (options?.opusModel) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = options.opusModel;
  }

  const config: SdkProviderConfig = {
    name: "OpenRouter (Anthropic-compatible)",
    env,
    model: options?.defaultModel,
  };

  log.debug("[CCSDK-PROVIDER] Built OpenRouter provider config", {
    baseUrl: env.ANTHROPIC_BASE_URL,
    defaultModel: options?.defaultModel ?? "(sdk default)",
    haikuModel: options?.haikuModel ?? "(sdk default)",
    sonnetModel: options?.sonnetModel ?? "(sdk default)",
    opusModel: options?.opusModel ?? "(sdk default)",
    apiKeyMasked: maskToken(apiKey),
  });

  return config;
}

/**
 * Build provider config for AWS Bedrock.
 *
 * AWS credentials should be configured via standard AWS mechanisms
 * (environment variables, shared credentials file, IAM role, etc.).
 */
export function buildBedrockSdkProvider(): SdkProviderConfig {
  return {
    name: "AWS Bedrock",
    env: {
      CLAUDE_CODE_USE_BEDROCK: "1",
    },
  };
}

/**
 * Build provider config for Google Vertex AI.
 *
 * Google Cloud credentials should be configured via standard GCP mechanisms
 * (GOOGLE_APPLICATION_CREDENTIALS, default credentials, etc.).
 */
export function buildVertexSdkProvider(): SdkProviderConfig {
  return {
    name: "Google Vertex AI",
    env: {
      CLAUDE_CODE_USE_VERTEX: "1",
    },
  };
}

/**
 * Resolve provider configuration based on available credentials.
 *
 * Priority order:
 * 1. Explicit API key from config/env
 * 2. Claude Code CLI credentials (subscription auth)
 * 3. Environment variables (fallback)
 */
export function resolveProviderConfig(options?: {
  apiKey?: string;
  authToken?: string;
  baseUrl?: string;
  useCliCredentials?: boolean;
}): SdkProviderConfig {
  log.debug("[CCSDK-PROVIDER] resolveProviderConfig called", {
    hasApiKey: Boolean(options?.apiKey),
    apiKeyMasked: maskToken(options?.apiKey),
    hasAuthToken: Boolean(options?.authToken),
    authTokenMasked: maskToken(options?.authToken),
    baseUrl: options?.baseUrl ?? "(default)",
    useCliCredentials: options?.useCliCredentials ?? true,
  });

  // 1. Explicit API key takes precedence
  if (options?.apiKey) {
    log.debug("[CCSDK-PROVIDER] Using explicit API key");
    const config = buildAnthropicSdkProvider(options.apiKey);
    if (options.baseUrl && config.env) {
      config.env.ANTHROPIC_BASE_URL = options.baseUrl;
    }
    logProviderConfig(config, "explicit-api-key");
    return config;
  }

  // 2. Explicit auth token (OAuth/subscription)
  if (options?.authToken) {
    log.debug("[CCSDK-PROVIDER] Using explicit auth token");
    const env: SdkProviderEnv = {
      ANTHROPIC_AUTH_TOKEN: options.authToken,
    };
    if (options.baseUrl) {
      env.ANTHROPIC_BASE_URL = options.baseUrl;
    }
    const config: SdkProviderConfig = {
      name: "Anthropic (auth token)",
      env,
    };
    logProviderConfig(config, "explicit-auth-token");
    return config;
  }

  // 3. Try Claude CLI credentials if enabled (default: true)
  if (options?.useCliCredentials !== false) {
    log.debug("[CCSDK-PROVIDER] Attempting Claude CLI credentials");
    const cliConfig = buildClaudeCliSdkProvider();
    if (cliConfig) {
      log.debug("[CCSDK-PROVIDER] Using Claude CLI credentials", {
        providerName: cliConfig.name,
      });
      if (options?.baseUrl && cliConfig.env) {
        cliConfig.env.ANTHROPIC_BASE_URL = options.baseUrl;
      }
      return cliConfig;
    }
    log.debug("[CCSDK-PROVIDER] Claude CLI credentials not available");
  }

  // 4. Check environment variables
  const envApiKey = process.env.ANTHROPIC_API_KEY;
  const envAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;

  log.debug("[CCSDK-PROVIDER] Checking environment variables", {
    hasEnvApiKey: Boolean(envApiKey),
    envApiKeyMasked: maskToken(envApiKey),
    hasEnvAuthToken: Boolean(envAuthToken),
    envAuthTokenMasked: maskToken(envAuthToken),
    hasEnvBaseUrl: Boolean(process.env.ANTHROPIC_BASE_URL),
  });

  if (envApiKey) {
    const config: SdkProviderConfig = {
      name: "Anthropic (env)",
      env: {
        ANTHROPIC_API_KEY: envApiKey,
        ANTHROPIC_BASE_URL: options?.baseUrl ?? process.env.ANTHROPIC_BASE_URL,
      },
    };
    logProviderConfig(config, "env-api-key");
    return config;
  }

  if (envAuthToken) {
    const config: SdkProviderConfig = {
      name: "Anthropic (env auth token)",
      env: {
        ANTHROPIC_AUTH_TOKEN: envAuthToken,
        ANTHROPIC_BASE_URL: options?.baseUrl ?? process.env.ANTHROPIC_BASE_URL,
      },
    };
    logProviderConfig(config, "env-auth-token");
    return config;
  }

  // 5. Return empty config - SDK will use its own credential resolution
  log.warn("[CCSDK-PROVIDER] No credentials found - SDK will use native auth (may fail)", {
    triedCliCredentials: options?.useCliCredentials !== false,
    triedEnvVars: true,
  });
  const config: SdkProviderConfig = {
    name: "Anthropic (SDK native)",
    env: {},
  };
  logProviderConfig(config, "sdk-native-fallback");
  return config;
}
