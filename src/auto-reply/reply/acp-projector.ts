import type { AcpRuntimeEvent } from "../../acp/runtime/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import type { ReplyPayload } from "../types.js";
import type { ReplyDispatchKind } from "./reply-dispatcher.js";

const DEFAULT_ACP_STREAM_BATCH_MS = 350;
const DEFAULT_ACP_STREAM_MAX_CHUNK_CHARS = 1800;

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

export type AcpReplyProjector = {
  onEvent: (event: AcpRuntimeEvent) => Promise<void>;
  flush: (force?: boolean) => Promise<void>;
};

export function createAcpReplyProjector(params: {
  cfg: OpenClawConfig;
  shouldSendToolSummaries: boolean;
  deliver: (kind: ReplyDispatchKind, payload: ReplyPayload) => Promise<boolean>;
}): AcpReplyProjector {
  const batchMs = resolveAcpStreamBatchMs(params.cfg);
  const maxChunkChars = resolveAcpStreamMaxChunkChars(params.cfg);
  let streamBuffer = "";
  let lastFlushAt = 0;

  const flush = async (force = false): Promise<void> => {
    while (streamBuffer.length > 0) {
      const now = Date.now();
      if (!force && streamBuffer.length < maxChunkChars && now - lastFlushAt < batchMs) {
        return;
      }
      const chunk = streamBuffer.slice(0, maxChunkChars);
      streamBuffer = streamBuffer.slice(chunk.length);
      const didDeliver = await params.deliver("block", { text: chunk });
      if (didDeliver) {
        lastFlushAt = Date.now();
      }
      if (!force && streamBuffer.length < maxChunkChars) {
        return;
      }
    }
  };

  const onEvent = async (event: AcpRuntimeEvent): Promise<void> => {
    if (event.type === "text_delta") {
      if (event.stream && event.stream !== "output") {
        return;
      }
      if (event.text) {
        streamBuffer += event.text;
        await flush(false);
      }
      return;
    }
    if (event.type === "status") {
      if (params.shouldSendToolSummaries && event.text) {
        await params.deliver("tool", { text: `⚙️ ${event.text}` });
      }
      return;
    }
    if (event.type === "tool_call") {
      if (params.shouldSendToolSummaries && event.text) {
        await params.deliver("tool", { text: `🧰 ${event.text}` });
      }
    }
  };

  return {
    onEvent,
    flush,
  };
}
