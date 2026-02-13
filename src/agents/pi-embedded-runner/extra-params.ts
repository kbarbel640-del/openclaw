import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { SimpleStreamOptions } from "@mariozechner/pi-ai";
import { streamSimple } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../config/config.js";
import { log } from "./logger.js";

const OPENROUTER_APP_HEADERS: Record<string, string> = {
  "HTTP-Referer": "https://openclaw.ai",
  "X-Title": "OpenClaw",
};

/**
 * Anthropic beta header required for fast mode.
 * @see https://docs.anthropic.com/en/docs/about-claude/models#fast-mode
 */
const ANTHROPIC_FAST_MODE_BETA = "fast-mode-2026-02-01";

/**
 * Resolve provider-specific extra params from model config.
 * Used to pass through stream params like temperature/maxTokens.
 *
 * @internal Exported for testing only
 */
export function resolveExtraParams(params: {
  cfg: OpenClawConfig | undefined;
  provider: string;
  modelId: string;
}): Record<string, unknown> | undefined {
  const modelKey = `${params.provider}/${params.modelId}`;
  const modelConfig = params.cfg?.agents?.defaults?.models?.[modelKey];
  return modelConfig?.params ? { ...modelConfig.params } : undefined;
}

type CacheRetention = "none" | "short" | "long";
type CacheRetentionStreamOptions = Partial<SimpleStreamOptions> & {
  cacheRetention?: CacheRetention;
};

/**
 * Resolve cacheRetention from extraParams, supporting both new `cacheRetention`
 * and legacy `cacheControlTtl` values for backwards compatibility.
 *
 * Mapping: "5m" → "short", "1h" → "long"
 *
 * Only applies to Anthropic provider (OpenRouter uses openai-completions API
 * with hardcoded cache_control, not the cacheRetention stream option).
 */
function resolveCacheRetention(
  extraParams: Record<string, unknown> | undefined,
  provider: string,
): CacheRetention | undefined {
  if (provider !== "anthropic") {
    return undefined;
  }

  // Prefer new cacheRetention if present
  const newVal = extraParams?.cacheRetention;
  if (newVal === "none" || newVal === "short" || newVal === "long") {
    return newVal;
  }

  // Fall back to legacy cacheControlTtl with mapping
  const legacy = extraParams?.cacheControlTtl;
  if (legacy === "5m") {
    return "short";
  }
  if (legacy === "1h") {
    return "long";
  }
  return undefined;
}

/**
 * Resolve Anthropic speed mode from extraParams.
 * Only applies to the Anthropic provider.
 *
 * @see https://docs.anthropic.com/en/docs/about-claude/models#fast-mode
 */
function resolveAnthropicSpeed(
  extraParams: Record<string, unknown> | undefined,
  provider: string,
): "fast" | undefined {
  if (provider !== "anthropic") {
    return undefined;
  }
  if (extraParams?.speed === "fast") {
    return "fast";
  }
  return undefined;
}

/**
 * Append a beta feature to an existing anthropic-beta header value.
 * Avoids duplicates and preserves existing betas.
 *
 * @internal Exported for testing
 */
export function appendAnthropicBeta(existingHeader: string | undefined, newBeta: string): string {
  if (!existingHeader?.trim()) {
    return newBeta;
  }
  const existing = existingHeader.split(",").map((s) => s.trim());
  if (existing.includes(newBeta)) {
    return existingHeader;
  }
  return `${existingHeader},${newBeta}`;
}

function createStreamFnWithExtraParams(
  baseStreamFn: StreamFn | undefined,
  extraParams: Record<string, unknown> | undefined,
  provider: string,
): StreamFn | undefined {
  if (!extraParams || Object.keys(extraParams).length === 0) {
    return undefined;
  }

  const streamParams: CacheRetentionStreamOptions = {};
  if (typeof extraParams.temperature === "number") {
    streamParams.temperature = extraParams.temperature;
  }
  if (typeof extraParams.maxTokens === "number") {
    streamParams.maxTokens = extraParams.maxTokens;
  }
  const cacheRetention = resolveCacheRetention(extraParams, provider);
  if (cacheRetention) {
    streamParams.cacheRetention = cacheRetention;
  }

  const speed = resolveAnthropicSpeed(extraParams, provider);

  if (Object.keys(streamParams).length === 0 && !speed) {
    return undefined;
  }

  log.debug(
    `creating streamFn wrapper with params: ${JSON.stringify(streamParams)}${speed ? `, speed: ${speed}` : ""}`,
  );

  const underlying = baseStreamFn ?? streamSimple;

  if (speed) {
    // For Anthropic speed mode, we need to:
    // 1. Inject `speed` into the API request body via the onPayload callback
    //    (pi-ai's buildParams doesn't handle `speed` yet)
    // 2. Append the fast-mode beta header to the existing anthropic-beta header
    //    without overwriting pi-ai's default betas (interleaved-thinking, etc.)
    const wrappedStreamFn: StreamFn = (model, context, options) => {
      // Append fast-mode beta to existing header on the model (non-destructive copy)
      const existingBeta =
        options?.headers?.["anthropic-beta"] ?? model.headers?.["anthropic-beta"];
      const betaHeader = appendAnthropicBeta(existingBeta, ANTHROPIC_FAST_MODE_BETA);

      // Chain onPayload to inject `speed` into the request body
      const originalOnPayload = options?.onPayload;
      const onPayload = (payload: unknown) => {
        if (payload && typeof payload === "object") {
          (payload as Record<string, unknown>).speed = speed;
        }
        originalOnPayload?.(payload);
      };

      return underlying(model, context, {
        ...streamParams,
        ...options,
        headers: {
          ...options?.headers,
          "anthropic-beta": betaHeader,
        },
        onPayload,
      });
    };
    return wrappedStreamFn;
  }

  const wrappedStreamFn: StreamFn = (model, context, options) =>
    underlying(model, context, {
      ...streamParams,
      ...options,
    });

  return wrappedStreamFn;
}

/**
 * Create a streamFn wrapper that adds OpenRouter app attribution headers.
 * These headers allow OpenClaw to appear on OpenRouter's leaderboard.
 */
function createOpenRouterHeadersWrapper(baseStreamFn: StreamFn | undefined): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) =>
    underlying(model, context, {
      ...options,
      headers: {
        ...OPENROUTER_APP_HEADERS,
        ...options?.headers,
      },
    });
}

/**
 * Apply extra params (like temperature) to an agent's streamFn.
 * Also adds OpenRouter app attribution headers when using the OpenRouter provider.
 *
 * @internal Exported for testing
 */
export function applyExtraParamsToAgent(
  agent: { streamFn?: StreamFn },
  cfg: OpenClawConfig | undefined,
  provider: string,
  modelId: string,
  extraParamsOverride?: Record<string, unknown>,
): void {
  const extraParams = resolveExtraParams({
    cfg,
    provider,
    modelId,
  });
  const override =
    extraParamsOverride && Object.keys(extraParamsOverride).length > 0
      ? Object.fromEntries(
          Object.entries(extraParamsOverride).filter(([, value]) => value !== undefined),
        )
      : undefined;
  const merged = Object.assign({}, extraParams, override);
  const wrappedStreamFn = createStreamFnWithExtraParams(agent.streamFn, merged, provider);

  if (wrappedStreamFn) {
    log.debug(`applying extraParams to agent streamFn for ${provider}/${modelId}`);
    agent.streamFn = wrappedStreamFn;
  }

  if (provider === "openrouter") {
    log.debug(`applying OpenRouter app attribution headers for ${provider}/${modelId}`);
    agent.streamFn = createOpenRouterHeadersWrapper(agent.streamFn);
  }
}
