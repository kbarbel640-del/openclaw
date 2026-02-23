import type { AcpRuntimeEvent } from "../../acp/runtime/types.js";
import { EmbeddedBlockChunker } from "../../agents/pi-embedded-block-chunker.js";
import type { OpenClawConfig } from "../../config/config.js";
import type { ReplyPayload } from "../types.js";
import { createBlockReplyPipeline } from "./block-reply-pipeline.js";
import {
  resolveBlockStreamingChunking,
  resolveBlockStreamingCoalescing,
} from "./block-streaming.js";
import type { ReplyDispatchKind } from "./reply-dispatcher.js";

const DEFAULT_ACP_STREAM_BATCH_MS = 350;
const DEFAULT_ACP_STREAM_MAX_CHUNK_CHARS = 1800;
const ACP_BLOCK_REPLY_TIMEOUT_MS = 15_000;

function clampPositiveInteger(
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  if (rounded < bounds.min) {
    return bounds.min;
  }
  if (rounded > bounds.max) {
    return bounds.max;
  }
  return rounded;
}

function resolveAcpStreamBatchMs(cfg: OpenClawConfig): number {
  return clampPositiveInteger(cfg.acp?.stream?.batchMs, DEFAULT_ACP_STREAM_BATCH_MS, {
    min: 0,
    max: 5_000,
  });
}

function resolveAcpStreamMaxChunkChars(cfg: OpenClawConfig): number {
  return clampPositiveInteger(cfg.acp?.stream?.maxChunkChars, DEFAULT_ACP_STREAM_MAX_CHUNK_CHARS, {
    min: 50,
    max: 4_000,
  });
}

function resolveAcpStreamingConfig(params: {
  cfg: OpenClawConfig;
  provider?: string;
  accountId?: string;
}): {
  chunking: {
    minChars: number;
    maxChars: number;
    breakPreference: "paragraph" | "newline" | "sentence";
    flushOnParagraph?: boolean;
  };
  coalescing: {
    minChars: number;
    maxChars: number;
    idleMs: number;
    joiner: string;
    flushOnEnqueue?: boolean;
  };
} {
  const batchMs = resolveAcpStreamBatchMs(params.cfg);
  const configuredMaxChars = resolveAcpStreamMaxChunkChars(params.cfg);
  const chunkingDefaults = resolveBlockStreamingChunking(
    params.cfg,
    params.provider,
    params.accountId,
  );
  const chunkingMax = Math.max(1, Math.min(chunkingDefaults.maxChars, configuredMaxChars));
  const chunkingMin = Math.min(chunkingDefaults.minChars, chunkingMax);
  const chunking = {
    ...chunkingDefaults,
    minChars: chunkingMin,
    maxChars: chunkingMax,
  };
  const coalescingDefaults = resolveBlockStreamingCoalescing(
    params.cfg,
    params.provider,
    params.accountId,
    chunking,
  );
  const coalescingMax = Math.max(
    1,
    Math.min(coalescingDefaults?.maxChars ?? chunking.maxChars, chunking.maxChars),
  );
  const coalescingMin = Math.min(coalescingDefaults?.minChars ?? chunking.minChars, coalescingMax);
  const coalescing = {
    minChars: coalescingMin,
    maxChars: coalescingMax,
    idleMs: batchMs,
    joiner:
      coalescingDefaults?.joiner ??
      (chunking.breakPreference === "sentence"
        ? " "
        : chunking.breakPreference === "newline"
          ? "\n"
          : "\n\n"),
    flushOnEnqueue: coalescingDefaults?.flushOnEnqueue ?? chunking.flushOnParagraph === true,
  };
  return { chunking, coalescing };
}

export type AcpReplyProjector = {
  onEvent: (event: AcpRuntimeEvent) => Promise<void>;
  flush: (force?: boolean) => Promise<void>;
};

export function createAcpReplyProjector(params: {
  cfg: OpenClawConfig;
  shouldSendToolSummaries: boolean;
  deliver: (kind: ReplyDispatchKind, payload: ReplyPayload) => Promise<boolean>;
  provider?: string;
  accountId?: string;
}): AcpReplyProjector {
  const streaming = resolveAcpStreamingConfig({
    cfg: params.cfg,
    provider: params.provider,
    accountId: params.accountId,
  });
  const blockReplyPipeline = createBlockReplyPipeline({
    onBlockReply: async (payload) => {
      await params.deliver("block", payload);
    },
    timeoutMs: ACP_BLOCK_REPLY_TIMEOUT_MS,
    coalescing: streaming.coalescing,
  });
  const chunker = new EmbeddedBlockChunker(streaming.chunking);

  const drainChunker = (force: boolean) => {
    chunker.drain({
      force,
      emit: (chunk) => {
        blockReplyPipeline.enqueue({ text: chunk });
      },
    });
  };

  const flush = async (force = false): Promise<void> => {
    drainChunker(force);
    await blockReplyPipeline.flush({ force });
  };

  const emitToolSummary = async (prefix: string, text: string): Promise<void> => {
    if (!params.shouldSendToolSummaries || !text) {
      return;
    }
    // Keep tool summaries ordered after any pending streamed text.
    await flush(true);
    await params.deliver("tool", { text: `${prefix} ${text}` });
  };

  const onEvent = async (event: AcpRuntimeEvent): Promise<void> => {
    if (event.type === "text_delta") {
      if (event.stream && event.stream !== "output") {
        return;
      }
      if (event.text) {
        chunker.append(event.text);
        drainChunker(false);
      }
      return;
    }
    if (event.type === "status") {
      await emitToolSummary("⚙️", event.text);
      return;
    }
    if (event.type === "tool_call") {
      await emitToolSummary("🧰", event.text);
      return;
    }
    if (event.type === "done" || event.type === "error") {
      await flush(true);
    }
  };

  return {
    onEvent,
    flush,
  };
}
