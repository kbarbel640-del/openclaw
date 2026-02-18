/**
 * LLM Stream Cache Wrapper
 * Caches LLM responses at the stream function level for optimal integration
 */

import { createHash } from "node:crypto";
import type {
  AssistantMessage,
  AssistantMessageEventStream,
  Context,
  Message,
  Model,
  StreamOptions,
} from "@mariozechner/pi-ai";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import { getLLMCache } from "./llm-cache.js";

export type StreamCacheConfig = {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  skipCacheForTools?: boolean;
};

export type StreamCacheWrapper = {
  wrapStreamFn: <TApi extends string>(
    streamFn: (
      model: Model<TApi>,
      context: Context,
      options?: StreamOptions,
    ) => AssistantMessageEventStream | Promise<AssistantMessageEventStream>,
  ) => (
    model: Model<TApi>,
    context: Context,
    options?: StreamOptions,
  ) => AssistantMessageEventStream | Promise<AssistantMessageEventStream>;
  getStats: () => {
    hits: number;
    misses: number;
    evictions: number;
    hitRate: string;
    size: number;
  };
  clear: () => void;
};

type MessageForCache = {
  role: string;
  content: string | Array<{ type: string; text?: string; data?: string }>;
};

function normalizeMessageForCache(msg: Message): MessageForCache {
  if (msg.role === "user") {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : msg.content.map((c) => ({
            type: c.type,
            text: c.type === "text" ? c.text : undefined,
            data: c.type === "image" ? c.data.slice(0, 100) : undefined,
          }));
    return { role: msg.role, content };
  }
  if (msg.role === "assistant") {
    const content = msg.content.map((c) => ({
      type: c.type,
      text: c.type === "text" ? c.text : c.type === "thinking" ? c.thinking : undefined,
    }));
    return { role: msg.role, content };
  }
  if (msg.role === "toolResult") {
    const content = msg.content.map((c) => ({
      type: c.type,
      text: c.type === "text" ? c.text : undefined,
    }));
    return { role: msg.role, content };
  }
  return { role: "unknown", content: "" };
}

function generateCacheKey(model: Model<string>, context: Context, options?: StreamOptions): string {
  const normalizedMessages = context.messages.map(normalizeMessageForCache);

  const keyData = {
    provider: model.provider,
    modelId: model.id,
    systemPrompt: context.systemPrompt?.slice(0, 500),
    messages: normalizedMessages,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  };

  return createHash("sha256").update(JSON.stringify(keyData)).digest("hex").slice(0, 32);
}

function shouldSkipCache(context: Context, config: StreamCacheConfig): boolean {
  if (!config.enabled) {
    return true;
  }
  if (config.skipCacheForTools && context.tools && context.tools.length > 0) {
    return true;
  }
  return false;
}

function createStreamFromCachedMessage(message: AssistantMessage): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  setImmediate(() => {
    stream.push({
      type: "start",
      partial: message,
    });

    let contentIndex = 0;
    for (const content of message.content) {
      if (content.type === "text") {
        stream.push({
          type: "text_start",
          contentIndex,
          partial: message,
        });
        stream.push({
          type: "text_delta",
          contentIndex,
          delta: content.text,
          partial: message,
        });
        stream.push({
          type: "text_end",
          contentIndex,
          content: content.text,
          partial: message,
        });
        contentIndex++;
      } else if (content.type === "thinking") {
        stream.push({
          type: "thinking_start",
          contentIndex,
          partial: message,
        });
        stream.push({
          type: "thinking_delta",
          contentIndex,
          delta: content.thinking,
          partial: message,
        });
        stream.push({
          type: "thinking_end",
          contentIndex,
          content: content.thinking,
          partial: message,
        });
        contentIndex++;
      } else if (content.type === "toolCall") {
        stream.push({
          type: "toolcall_start",
          contentIndex,
          partial: message,
        });
        stream.push({
          type: "toolcall_delta",
          contentIndex,
          delta: JSON.stringify(content.arguments),
          partial: message,
        });
        stream.push({
          type: "toolcall_end",
          contentIndex,
          toolCall: content,
          partial: message,
        });
        contentIndex++;
      }
    }

    stream.push({
      type: "done",
      reason:
        message.stopReason === "stop" ||
        message.stopReason === "length" ||
        message.stopReason === "toolUse"
          ? message.stopReason
          : "stop",
      message,
    });

    stream.end(message);
  });

  return stream;
}

export function createStreamCacheWrapper(config: StreamCacheConfig): StreamCacheWrapper {
  const cache = getLLMCache({
    enabled: config.enabled,
    ttl: config.ttl,
    maxSize: config.maxSize,
  });

  const wrapStreamFn: StreamCacheWrapper["wrapStreamFn"] = (streamFn) => {
    return (model, context, options) => {
      if (shouldSkipCache(context, config)) {
        return streamFn(model, context, options);
      }

      const cacheKey = generateCacheKey(model, context, options);

      const cachedEntry = cache.getCachedEntry(cacheKey);
      if (cachedEntry) {
        const cachedMessage = cachedEntry.response as AssistantMessage;
        return createStreamFromCachedMessage({
          ...cachedMessage,
          timestamp: Date.now(),
        });
      }

      const originalStreamOrPromise = streamFn(model, context, options);

      const wrappedStream = createAssistantMessageEventStream();

      void (async () => {
        try {
          const originalStream = await Promise.resolve(originalStreamOrPromise);
          let finalMessage: AssistantMessage | null = null;

          for await (const event of originalStream) {
            wrappedStream.push(event);

            if (event.type === "done") {
              finalMessage = event.message;
            } else if (event.type === "error") {
              finalMessage = event.error;
            }
          }

          if (finalMessage && finalMessage.stopReason === "stop") {
            cache.setCachedEntry(cacheKey, finalMessage);
          }

          wrappedStream.end(finalMessage ?? undefined);
        } catch {
          wrappedStream.end();
        }
      })();

      return wrappedStream;
    };
  };

  return {
    wrapStreamFn,
    getStats: () => cache.getStats(),
    clear: () => cache.clear(),
  };
}

let globalStreamCacheWrapper: StreamCacheWrapper | null = null;

export function getStreamCacheWrapper(config?: Partial<StreamCacheConfig>): StreamCacheWrapper {
  if (!globalStreamCacheWrapper) {
    globalStreamCacheWrapper = createStreamCacheWrapper({
      enabled: config?.enabled ?? true,
      ttl: config?.ttl ?? 3600000,
      maxSize: config?.maxSize ?? 1000,
      skipCacheForTools: config?.skipCacheForTools ?? true,
    });
  }
  return globalStreamCacheWrapper;
}
