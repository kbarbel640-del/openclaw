import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { RoutingProfile } from "./types.js";
import { clearCache, getCached, isCacheable, makeCacheKey, setCached } from "./cache.js";
import { DEFAULT_PROVIDER_URLS, PROVIDER_ENV_VARS, SERVER_HOST, SERVER_PORT } from "./config.js";
import {
  clearInFlight,
  completeInFlight,
  failInFlight,
  isInFlight,
  makeDedupKey,
  registerInFlight,
  waitForInFlight,
} from "./dedup.js";
import { route } from "./router.js";
import { parseModelRef } from "./selector.js";
import { startCleanup, stopCleanup } from "./session.js";
import { recordCacheHit, recordCacheMiss, recordDedupHit } from "./stats.js";

type ProviderConfig = {
  baseUrl?: string;
  apiKey?: string;
};

type ServerOptions = {
  port?: number;
  host?: string;
  profile: RoutingProfile;
  providers: Record<string, ProviderConfig>;
  logger: { info: (msg: string) => void; error: (msg: string) => void };
};

let server: Server | null = null;
let activeProfile: RoutingProfile = "auto";
let providerConfigs: Record<string, ProviderConfig> = {};

// ---------------------------------------------------------------------------
// Extract prompt text from OpenAI-format messages
// ---------------------------------------------------------------------------

function extractPromptText(messages: unknown[]): string {
  const parts: string[] = [];
  for (const msg of messages) {
    const m = msg as Record<string, unknown>;
    if (typeof m.content === "string") {
      parts.push(m.content);
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        const p = part as Record<string, unknown>;
        if (p.type === "text" && typeof p.text === "string") {
          parts.push(p.text);
        }
      }
    }
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Resolve API key for a provider
// ---------------------------------------------------------------------------

function resolveApiKey(provider: string): string | undefined {
  const config = providerConfigs[provider];
  if (config?.apiKey) {
    return config.apiKey;
  }

  const envVar = PROVIDER_ENV_VARS[provider];
  if (envVar) {
    return process.env[envVar];
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Resolve base URL for a provider
// ---------------------------------------------------------------------------

function resolveBaseUrl(provider: string): string {
  const config = providerConfigs[provider];
  if (config?.baseUrl) {
    let url = config.baseUrl;
    while (url.endsWith("/")) {
      url = url.slice(0, -1);
    }
    return url;
  }
  return DEFAULT_PROVIDER_URLS[provider] ?? DEFAULT_PROVIDER_URLS.openai;
}

// ---------------------------------------------------------------------------
// Anthropic format translation
// ---------------------------------------------------------------------------

function toAnthropicRequest(
  body: Record<string, unknown>,
  modelName: string,
): Record<string, unknown> {
  const messages = (body.messages as Array<Record<string, unknown>>) ?? [];
  let systemContent: string | undefined;
  const anthropicMessages: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemContent = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    } else {
      anthropicMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const result: Record<string, unknown> = {
    model: modelName,
    messages: anthropicMessages,
    max_tokens: (body.max_tokens as number) ?? 4096,
  };

  if (systemContent) {
    result.system = systemContent;
  }
  if (body.temperature !== undefined) {
    result.temperature = body.temperature;
  }
  if (body.top_p !== undefined) {
    result.top_p = body.top_p;
  }
  if (body.stream !== undefined) {
    result.stream = body.stream;
  }

  return result;
}

function fromAnthropicResponse(anthropicResp: Record<string, unknown>): Record<string, unknown> {
  const content = anthropicResp.content as Array<Record<string, unknown>> | undefined;
  let text = "";
  if (Array.isArray(content)) {
    text = content
      .filter((c) => c.type === "text")
      .map((c) => c.text as string)
      .join("");
  }

  return {
    id: anthropicResp.id ?? `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: anthropicResp.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason:
          anthropicResp.stop_reason === "end_turn" ? "stop" : (anthropicResp.stop_reason ?? "stop"),
      },
    ],
    usage: anthropicResp.usage,
  };
}

// ---------------------------------------------------------------------------
// Forward request to the real provider
// ---------------------------------------------------------------------------

async function forwardRequest(
  body: Record<string, unknown>,
  model: string,
  logger: ServerOptions["logger"],
): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
  const { provider, model: modelName } = parseModelRef(model);
  const isAnthropic = provider === "anthropic";
  const baseUrl = resolveBaseUrl(provider);
  const apiKey = resolveApiKey(provider);

  let url: string;
  let requestBody: Record<string, unknown>;
  const headers: Record<string, string> = { "content-type": "application/json" };

  if (isAnthropic) {
    url = `${baseUrl}/v1/messages`;
    requestBody = toAnthropicRequest(body, modelName);
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }
    headers["anthropic-version"] = "2023-06-01";
  } else {
    url = `${baseUrl}/chat/completions`;
    requestBody = { ...body, model: modelName };
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }
  }

  logger.info(`[clawback] forwarding to ${provider}/${modelName} via ${url}`);

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  const respHeaders: Record<string, string> = {};
  resp.headers.forEach((val, key) => {
    respHeaders[key] = val;
  });

  // Streaming: return raw response for passthrough
  if (body.stream === true) {
    const responseBody = await resp.text();
    return { status: resp.status, headers: respHeaders, body: responseBody };
  }

  const responseJson = (await resp.json()) as Record<string, unknown>;
  const finalBody = isAnthropic ? fromAnthropicResponse(responseJson) : responseJson;

  return { status: resp.status, headers: respHeaders, body: finalBody };
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  logger: ServerOptions["logger"],
): Promise<void> {
  // Only handle POST /v1/chat/completions
  if (req.method !== "POST" || !req.url?.startsWith("/v1/chat/completions")) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  // Parse request body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;

  const messages = body.messages as unknown[] | undefined;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "messages required" }));
    return;
  }

  // Extract session key from custom header
  const sessionKey = req.headers["x-clawback-session"] as string | undefined;

  // Extract prompt text for classification
  const promptText = extractPromptText(messages);

  // Route the request
  const decision = route(promptText, activeProfile, sessionKey);

  // Check cache (non-streaming only)
  if (isCacheable(body)) {
    const cacheKey = makeCacheKey(decision.model, messages, body.temperature as number | undefined);
    const cached = getCached(cacheKey);
    if (cached) {
      recordCacheHit();
      res.writeHead(200, {
        "content-type": "application/json",
        "x-clawback-tier": decision.tier,
        "x-clawback-model": decision.model,
        "x-clawback-cached": "true",
      });
      res.end(JSON.stringify(cached));
      return;
    }
    recordCacheMiss();

    // Check dedup
    const dedupKey = makeDedupKey(decision.model, messages, body.temperature as number | undefined);
    if (isInFlight(dedupKey)) {
      recordDedupHit();
      const result = await waitForInFlight(dedupKey);
      res.writeHead(200, {
        "content-type": "application/json",
        "x-clawback-tier": decision.tier,
        "x-clawback-model": decision.model,
        "x-clawback-deduped": "true",
      });
      res.end(JSON.stringify(result));
      return;
    }

    // Register this request as in-flight
    const { reject: rejectDedup } = registerInFlight(dedupKey);

    try {
      const result = await forwardRequest(body, decision.model, logger);

      res.writeHead(result.status, {
        "content-type": "application/json",
        "x-clawback-tier": decision.tier,
        "x-clawback-model": decision.model,
      });
      res.end(typeof result.body === "string" ? result.body : JSON.stringify(result.body));

      if (result.status === 200) {
        setCached(cacheKey, result.body);
        completeInFlight(dedupKey, result.body);
      } else {
        failInFlight(dedupKey, new Error(`Provider returned ${result.status}`));
      }
    } catch (err) {
      rejectDedup(err);
      failInFlight(dedupKey, err);
      throw err;
    }
    return;
  }

  // Streaming or tool-use: forward directly without cache/dedup
  try {
    const result = await forwardRequest(body, decision.model, logger);

    if (body.stream === true && typeof result.body === "string") {
      res.writeHead(result.status, {
        ...result.headers,
        "x-clawback-tier": decision.tier,
        "x-clawback-model": decision.model,
      });
      res.end(result.body);
    } else {
      res.writeHead(result.status, {
        "content-type": "application/json",
        "x-clawback-tier": decision.tier,
        "x-clawback-model": decision.model,
      });
      res.end(JSON.stringify(result.body));
    }
  } catch (err) {
    logger.error(`[clawback] forward error: ${err instanceof Error ? err.message : String(err)}`);
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to reach upstream provider" }));
  }
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

export function startServer(opts: ServerOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const port = opts.port ?? SERVER_PORT;
    const host = opts.host ?? SERVER_HOST;

    activeProfile = opts.profile;
    providerConfigs = opts.providers;

    startCleanup();

    server = createServer((req, res) => {
      handleRequest(req, res, opts.logger).catch((err) => {
        opts.logger.error(
          `[clawback] unhandled: ${err instanceof Error ? err.message : String(err)}`,
        );
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
    });

    server.on("error", (err) => {
      opts.logger.error(`[clawback] server error: ${err.message}`);
      reject(err);
    });

    server.listen(port, host, () => {
      opts.logger.info(`[clawback] proxy listening on ${host}:${port}`);
      resolve();
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    stopCleanup();
    clearCache();
    clearInFlight();

    if (!server) {
      resolve();
      return;
    }
    server.close(() => {
      server = null;
      resolve();
    });
  });
}

export function setProfile(profile: RoutingProfile): void {
  activeProfile = profile;
}
