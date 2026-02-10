import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, SimpleStreamOptions, Usage } from "@mariozechner/pi-ai";
import { Content, GoogleGenAI, Part } from "@google/genai";
import { streamSimple, createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../config/config.js";
import { log } from "./logger.js";

const OPENROUTER_APP_HEADERS: Record<string, string> = {
  "HTTP-Referer": "https://openclaw.ai",
  "X-Title": "OpenClaw",
};

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
  return modelConfig?.params || modelConfig?.streaming !== undefined
    ? { ...modelConfig.params, streaming: modelConfig.streaming }
    : undefined;
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

function createStreamFnWithExtraParams(
  baseStreamFn: StreamFn | undefined,
  extraParams: Record<string, unknown> | undefined,
  provider: string,
  model?: { project?: string; location?: string },
): StreamFn | undefined {
  const streamParams: CacheRetentionStreamOptions = {};

  if (extraParams && Object.keys(extraParams).length > 0) {
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
  }

  // Inject Vertex AI project and location from model config
  if (provider === "google-vertex" || provider === "google-antigravity") {
    if (model?.project) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (streamParams as any).project = model.project;
    }
    if (model?.location) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (streamParams as any).location = model.location;
    }
  }

  if (Object.keys(streamParams).length === 0) {
    return undefined;
  }

  log.debug(`creating streamFn wrapper with params: ${JSON.stringify(streamParams)}`);

  const underlying = baseStreamFn ?? streamSimple;
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
 * Helper to build a zero-cost Usage object with the given token counts.
 */
function buildUsage(input = 0, output = 0, totalTokens = 0): Usage {
  return {
    input,
    output,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: totalTokens || input + output,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

/**
 * Creates a non-streaming wrapper for Vertex AI that returns a proper AssistantMessageEventStream.
 * Used for models that don't support streaming (e.g., Claude 4.5 / Codestral on Vertex).
 */
function createNonStreamingVertexWrapper(modelInfo?: {
  project?: string;
  location?: string;
}): StreamFn {
  return (model, context, options) => {
    const stream = createAssistantMessageEventStream();

    // Run the actual API call async, pushing events into the stream
    (async () => {
      const project = modelInfo?.project || process.env.GOOGLE_CLOUD_PROJECT;
      const location = modelInfo?.location || process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
      const timestamp = Date.now();

      // Build a partial AssistantMessage shell for event payloads
      const partial: AssistantMessage = {
        role: "assistant",
        content: [],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: buildUsage(),
        stopReason: "stop",
        timestamp,
      };

      try {
        log.debug(`Non-streaming Vertex AI wrapper started for ${model.id}`);
        log.debug(`location=${location}, project=${project}`);

        // Import google-auth-library dynamically
        const { GoogleAuth } = await import("google-auth-library");
        const auth = new GoogleAuth({
          scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });

        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        if (!accessToken.token) {
          throw new Error("Failed to obtain access token for Vertex AI");
        }

        // Determine publisher and model name from the full model id
        let publisher = "anthropic";
        let modelName = model.id;
        if (model.id.includes("publishers/") && model.id.includes("/models/")) {
          const parts = model.id.split("/");
          publisher = parts[parts.indexOf("publishers") + 1];
          const modelsIdx = parts.indexOf("models");
          modelName = parts.slice(modelsIdx + 1).join("/");
        } else {
          modelName = model.id.split("/").pop() || model.id;
          if (
            modelName.toLowerCase().includes("codestral") ||
            modelName.toLowerCase().includes("mistral")
          ) {
            publisher = "mistralai";
          }
        }

        const isClaude = publisher === "anthropic";
        log.debug(`publisher=${publisher}, modelName=${modelName}, isClaude=${isClaude}`);

        // Convert messages to provider-compatible format
        const messages = context.messages.map((msg) => {
          let content: any = msg.content;
          if (Array.isArray(msg.content)) {
            content = msg.content.map((block) => {
              if (block.type === "text") {
                return { type: "text", text: block.text };
              }
              return block as any;
            });
          } else if (isClaude && typeof msg.content === "string") {
            content = [{ type: "text", text: msg.content }];
          }
          // Mistral handles plain strings fine

          return {
            role: msg.role === "assistant" ? "assistant" : "user",
            content,
          };
        });

        // Build the request body (Anthropic Messages vs. Mistral Chat Completions)
        const requestBody: any = isClaude
          ? {
              anthropic_version: "vertex-2023-10-16",
              messages,
              max_tokens: options?.maxTokens || 4096,
              ...(context.systemPrompt && { system: context.systemPrompt }),
              ...(options?.temperature !== undefined && { temperature: options.temperature }),
            }
          : {
              model: modelName,
              messages,
              max_tokens: options?.maxTokens || 4096,
              ...(context.systemPrompt && {
                messages: [{ role: "system", content: context.systemPrompt }, ...messages],
              }),
              ...(options?.temperature !== undefined && { temperature: options.temperature }),
            };

        // For Mistral, system prompt goes as first message, not a separate field
        if (!isClaude && context.systemPrompt) {
          requestBody.messages = [{ role: "system", content: context.systemPrompt }, ...messages];
        }

        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/${publisher}/models/${modelName}:rawPredict`;
        log.debug(`rawPredict → ${endpoint}`);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          log.error(`rawPredict HTTP ${response.status}: ${errorText}`);
          throw new Error(`Vertex AI rawPredict failed: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        const text = isClaude
          ? result.content?.[0]?.text || ""
          : result.choices?.[0]?.message?.content || "";

        // Build usage from response
        const usage = result.usage
          ? buildUsage(
              result.usage.prompt_tokens || result.usage.input_tokens || 0,
              result.usage.completion_tokens || result.usage.output_tokens || 0,
              result.usage.total_tokens || 0,
            )
          : buildUsage();

        log.debug(`Response OK. text.length=${text.length} usage=${JSON.stringify(usage)}`);

        // Build the final AssistantMessage
        const finalMessage: AssistantMessage = {
          ...partial,
          content: [{ type: "text", text }],
          usage,
          stopReason: "stop",
        };

        // Push events into the stream in the correct order
        stream.push({ type: "start", partial: { ...partial, usage } });
        stream.push({ type: "text_start", contentIndex: 0, partial: { ...partial, usage } });
        stream.push({
          type: "text_delta",
          contentIndex: 0,
          delta: text,
          partial: { ...partial, content: [{ type: "text", text }], usage },
        });
        stream.push({ type: "text_end", contentIndex: 0, content: text, partial: finalMessage });
        stream.push({ type: "done", reason: "stop", message: finalMessage });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(`Non-streaming Vertex AI error: ${errorMsg}`);

        // Build error AssistantMessage with proper fields so PI doesn't crash
        const errorMessage: AssistantMessage = {
          ...partial,
          stopReason: "error",
          errorMessage: errorMsg,
          usage: buildUsage(),
        };
        stream.push({ type: "error", reason: "error", error: errorMessage });
      }
    })();

    return stream;
  };
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
  model?: { project?: string; location?: string },
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

  // Check for disabled streaming first
  if (
    merged.streaming === false &&
    (provider === "google-vertex" || provider === "google-antigravity")
  ) {
    log.debug(`Applying non-streaming wrapper for ${provider}/${modelId}`);
    // Merge location/project from extraParams (e.g., params.location in openclaw.json) into modelInfo
    const mergedModelInfo = {
      project: (merged.project as string) || model?.project,
      location: (merged.location as string) || model?.location,
    };
    agent.streamFn = createNonStreamingVertexWrapper(mergedModelInfo);
    return;
  }

  const wrappedStreamFn = createStreamFnWithExtraParams(agent.streamFn, merged, provider, model);

  if (wrappedStreamFn) {
    log.debug(`applying extraParams to agent streamFn for ${provider}/${modelId}`);
    agent.streamFn = wrappedStreamFn;
  }

  if (provider === "openrouter") {
    log.debug(`applying OpenRouter app attribution headers for ${provider}/${modelId}`);
    agent.streamFn = createOpenRouterHeadersWrapper(agent.streamFn);
  }
}
