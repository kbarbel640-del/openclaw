/**
 * Streaming Compaction System
 * Provides non-blocking, progressive session compaction with background processing
 */

import { EventEmitter } from "node:events";

export interface CompactionChunk {
  type: "start" | "progress" | "complete" | "error";
  sessionId: string;
  progress?: number;
  removedMessages?: number;
  keptMessages?: number;
  summary?: string;
  error?: string;
}

export interface CompactionProgress {
  sessionId: string;
  totalMessages: number;
  processedMessages: number;
  removedMessages: number;
  keptMessages: number;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  status: "pending" | "running" | "completed" | "failed";
}

export interface StreamingCompactionOptions {
  sessionId: string;
  sessionFile: string;
  maxTokens: number;
  chunkSize?: number;
  signal?: AbortSignal;
}

export interface CompactionResult {
  ok: boolean;
  compacted: boolean;
  removedMessages: number;
  keptMessages: number;
  summary: string;
  progress: CompactionProgress;
}

type CompactionEventListener = (chunk: CompactionChunk) => void;

export class StreamingCompactionEngine extends EventEmitter {
  private static instance: StreamingCompactionEngine | null = null;
  private activeCompactions = new Map<string, CompactionProgress>();
  private compactionQueue: Array<{
    options: StreamingCompactionOptions;
    resolve: (result: CompactionResult) => void;
  }> = [];
  private isProcessing = false;
  private readonly CHUNK_SIZE = 50;

  private constructor() {
    super();
  }

  static getInstance(): StreamingCompactionEngine {
    if (!StreamingCompactionEngine.instance) {
      StreamingCompactionEngine.instance = new StreamingCompactionEngine();
    }
    return StreamingCompactionEngine.instance;
  }

  subscribe(sessionId: string, listener: CompactionEventListener): () => void {
    this.on(`compaction:${sessionId}`, listener);
    return () => this.off(`compaction:${sessionId}`, listener);
  }

  async compact(options: StreamingCompactionOptions): Promise<CompactionResult> {
    const progress: CompactionProgress = {
      sessionId: options.sessionId,
      totalMessages: 0,
      processedMessages: 0,
      removedMessages: 0,
      keptMessages: 0,
      estimatedTokensBefore: 0,
      estimatedTokensAfter: 0,
      status: "pending",
    };

    this.activeCompactions.set(options.sessionId, progress);

    return new Promise((resolve, _resolve) => {
      this.compactionQueue.push({
        options,
        resolve: (result) => {
          this.activeCompactions.delete(options.sessionId);
          resolve(result);
        },
      });

      this.emitCompactionChunk({
        type: "start",
        sessionId: options.sessionId,
      });

      this.processQueue();
    });
  }

  getProgress(sessionId: string): CompactionProgress | undefined {
    return this.activeCompactions.get(sessionId);
  }

  getActiveCount(): number {
    return this.activeCompactions.size;
  }

  cancel(sessionId: string): boolean {
    const progress = this.activeCompactions.get(sessionId);
    if (progress && progress.status === "running") {
      progress.status = "failed";
      this.emitCompactionChunk({
        type: "error",
        sessionId,
        error: "Compaction cancelled by user",
      });
      return true;
    }
    return false;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.compactionQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.compactionQueue.length > 0) {
      const { options, resolve } = this.compactionQueue.shift()!;
      const progress = this.activeCompactions.get(options.sessionId);

      if (!progress) {
        resolve({
          ok: false,
          compacted: false,
          removedMessages: 0,
          keptMessages: 0,
          summary: "Compaction cancelled",
          progress: {
            sessionId: options.sessionId,
            totalMessages: 0,
            processedMessages: 0,
            removedMessages: 0,
            keptMessages: 0,
            estimatedTokensBefore: 0,
            estimatedTokensAfter: 0,
            status: "failed",
          },
        });
        continue;
      }

      try {
        const result = await this.runStreamingCompaction(options, progress);
        resolve(result);
      } catch (error) {
        progress.status = "failed";
        this.emitCompactionChunk({
          type: "error",
          sessionId: options.sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        resolve({
          ok: false,
          compacted: false,
          removedMessages: progress.removedMessages,
          keptMessages: progress.keptMessages,
          summary: `Compaction failed: ${error}`,
          progress,
        });
      }
    }

    this.isProcessing = false;
  }

  private async runStreamingCompaction(
    options: StreamingCompactionOptions,
    progress: CompactionProgress,
  ): Promise<CompactionResult> {
    progress.status = "running";

    const { SessionManager } = await import("@mariozechner/pi-coding-agent");
    const sessionManager = SessionManager.open(options.sessionFile);

    const messages = (sessionManager as unknown as { messages: unknown[] }).messages as unknown[];
    progress.totalMessages = messages.length;
    progress.estimatedTokensBefore = this.estimateTokens(messages);

    const targetTokens = options.maxTokens * 0.7;
    const chunkSize = options.chunkSize ?? this.CHUNK_SIZE;

    const summaryParts: string[] = [];
    let remainingMessages = [...messages];

    while (remainingMessages.length > 0) {
      if (options.signal?.aborted) {
        throw new Error("Compaction aborted");
      }

      const chunk = remainingMessages.slice(0, chunkSize);
      remainingMessages = remainingMessages.slice(chunkSize);

      const currentTotalTokens = this.estimateTokens(remainingMessages);

      if (currentTotalTokens > targetTokens) {
        const summary = this.generateChunkSummary(chunk);
        summaryParts.push(summary);
        progress.removedMessages += chunk.length;
      } else {
        progress.keptMessages += chunk.length;
      }

      progress.processedMessages += chunk.length;
      const pct = Math.floor((progress.processedMessages / progress.totalMessages) * 100);

      this.emitCompactionChunk({
        type: "progress",
        sessionId: options.sessionId,
        progress: pct,
        removedMessages: progress.removedMessages,
        keptMessages: progress.keptMessages,
      });

      if (currentTotalTokens <= targetTokens) {
        break;
      }

      await this.yieldToEventLoop();
    }

    progress.estimatedTokensAfter = this.estimateTokens(
      remainingMessages.slice(-progress.keptMessages),
    );
    progress.status = "completed";

    const summary = summaryParts.join("\n\n");

    this.emitCompactionChunk({
      type: "complete",
      sessionId: options.sessionId,
      removedMessages: progress.removedMessages,
      keptMessages: progress.keptMessages,
      summary,
    });

    return {
      ok: true,
      compacted: progress.removedMessages > 0,
      removedMessages: progress.removedMessages,
      keptMessages: progress.keptMessages,
      summary,
      progress,
    };
  }

  private generateChunkSummary(chunk: unknown[]): string {
    return `[Compacted ${chunk.length} messages - see session history for details]`;
  }

  private estimateTokens(messages: unknown[]): number {
    let total = 0;
    for (const msg of messages) {
      const text = this.extractMessageText(msg);
      total += Math.ceil(text.length / 4);
    }
    return total;
  }

  private extractMessageText(message: unknown): string {
    if (!message || typeof message !== "object") {
      return "";
    }
    const msg = message as Record<string, unknown>;
    const content = msg.content;
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((block) => {
          if (typeof block === "string") {
            return block;
          }
          if (block && typeof block === "object") {
            return (block as Record<string, unknown>).text ?? "";
          }
          return "";
        })
        .join("");
    }
    return "";
  }

  private async yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  private emitCompactionChunk(chunk: CompactionChunk): void {
    this.emit(`compaction:${chunk.sessionId}`, chunk);
    this.emit("compaction", chunk);
  }
}

export function getStreamingCompactionEngine(): StreamingCompactionEngine {
  return StreamingCompactionEngine.getInstance();
}
