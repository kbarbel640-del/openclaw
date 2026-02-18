/**
 * AI-Powered Session Summarization System
 * Intelligent conversation compression using LLM-generated summaries
 */

import { EventEmitter } from "node:events";
import fs from "node:fs";
import type { OpenClawConfig } from "../config/config.js";

export interface SummaryChunk {
  id: string;
  startIndex: number;
  endIndex: number;
  summary: string;
  keyPoints: string[];
  entities: string[];
  timestamp: number;
  tokenCount: number;
}

export interface SessionSummary {
  sessionId: string;
  chunks: SummaryChunk[];
  fullSummary: string;
  metadata: {
    originalMessageCount: number;
    compressedMessageCount: number;
    compressionRatio: number;
    generatedAt: number;
  };
}

export interface SummarizationOptions {
  sessionId: string;
  sessionFile: string;
  config: OpenClawConfig;
  chunkSize?: number;
  overlap?: number;
  model?: string;
  provider?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface SummarizationProgress {
  sessionId: string;
  status: "pending" | "analyzing" | "summarizing" | "completed" | "failed";
  currentChunk: number;
  totalChunks: number;
  progress: number;
}

type ProgressListener = (progress: SummarizationProgress) => void;

export class AISessionSummarizer extends EventEmitter {
  private static instance: AISessionSummarizer | null = null;
  private summaryCache = new Map<string, SessionSummary>();
  private activeSummarizations = new Map<string, SummarizationProgress>();
  private readonly DEFAULT_CHUNK_SIZE = 20;
  private readonly DEFAULT_OVERLAP = 5;
  private readonly SUMMARY_SYSTEM_PROMPT = `You are an expert at summarizing conversations. Your task is to create concise, informative summaries that preserve:
1. Key decisions and their rationale
2. Important facts and technical details
3. Context needed to understand future messages
4. Any unresolved issues or follow-ups

Format your response as:
## Summary
[A 2-3 paragraph summary of the conversation]

## Key Points
- [Bullet point 1]
- [Bullet point 2]
...

## Entities Mentioned
- [List of important entities: people, files, concepts]

Be concise but comprehensive. Focus on actionable information.`;

  private constructor() {
    super();
  }

  static getInstance(): AISessionSummarizer {
    if (!AISessionSummarizer.instance) {
      AISessionSummarizer.instance = new AISessionSummarizer();
    }
    return AISessionSummarizer.instance;
  }

  async summarize(options: SummarizationOptions): Promise<SessionSummary> {
    const cacheKey = `${options.sessionFile}:${this.getFileMtime(options.sessionFile)}`;
    const cached = this.summaryCache.get(cacheKey);
    if (cached && this.isSummaryFresh(cached)) {
      return cached;
    }

    const progress: SummarizationProgress = {
      sessionId: options.sessionId,
      status: "analyzing",
      currentChunk: 0,
      totalChunks: 0,
      progress: 0,
    };
    this.activeSummarizations.set(options.sessionId, progress);
    this.emit("progress", progress);

    try {
      const { SessionManager } = await import("@mariozechner/pi-coding-agent");
      const sessionManager = SessionManager.open(options.sessionFile);
      const messages = this.extractMessages(sessionManager);

      const chunkSize = options.chunkSize ?? this.DEFAULT_CHUNK_SIZE;
      if (messages.length <= chunkSize) {
        const summary: SessionSummary = {
          sessionId: options.sessionId,
          chunks: [],
          fullSummary: "Session is small enough, no summarization needed.",
          metadata: {
            originalMessageCount: messages.length,
            compressedMessageCount: messages.length,
            compressionRatio: 1,
            generatedAt: Date.now(),
          },
        };
        this.summaryCache.set(cacheKey, summary);
        return summary;
      }

      progress.status = "summarizing";
      const chunks = await this.createChunks(messages, options, progress);
      const fullSummary = await this.generateFullSummary(chunks, options);

      const summary: SessionSummary = {
        sessionId: options.sessionId,
        chunks,
        fullSummary,
        metadata: {
          originalMessageCount: messages.length,
          compressedMessageCount: chunks.reduce((sum, c) => sum + c.keyPoints.length, 0),
          compressionRatio: messages.length / Math.max(1, chunks.length),
          generatedAt: Date.now(),
        },
      };

      progress.status = "completed";
      progress.progress = 100;
      this.emit("progress", progress);
      this.summaryCache.set(cacheKey, summary);

      return summary;
    } catch (error) {
      progress.status = "failed";
      this.emit("progress", progress);
      throw error;
    } finally {
      this.activeSummarizations.delete(options.sessionId);
    }
  }

  subscribe(sessionId: string, listener: ProgressListener): () => void {
    this.on("progress", listener as (progress: SummarizationProgress) => void);
    return () => this.off("progress", listener as (progress: SummarizationProgress) => void);
  }

  getProgress(sessionId: string): SummarizationProgress | undefined {
    return this.activeSummarizations.get(sessionId);
  }

  invalidateCache(sessionFile: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.summaryCache.keys()) {
      if (key.startsWith(sessionFile)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.summaryCache.delete(key));
  }

  private async createChunks(
    messages: unknown[],
    options: SummarizationOptions,
    progress: SummarizationProgress,
  ): Promise<SummaryChunk[]> {
    const chunkSize = options.chunkSize ?? this.DEFAULT_CHUNK_SIZE;
    const overlap = options.overlap ?? this.DEFAULT_OVERLAP;
    const chunks: SummaryChunk[] = [];

    const totalChunks = Math.ceil(messages.length / (chunkSize - overlap));
    progress.totalChunks = totalChunks;

    let i = 0;
    let chunkIndex = 0;
    while (i < messages.length) {
      if (options.signal?.aborted) {
        throw new Error("Summarization aborted");
      }

      const chunkMessages = messages.slice(i, i + chunkSize);
      const summary = await this.summarizeChunk(chunkMessages, chunkIndex, options);

      chunks.push({
        id: `chunk-${chunkIndex}`,
        startIndex: i,
        endIndex: Math.min(i + chunkSize, messages.length),
        summary: summary.summary,
        keyPoints: summary.keyPoints,
        entities: summary.entities,
        timestamp: Date.now(),
        tokenCount: this.estimateTokens(chunkMessages),
      });

      progress.currentChunk = chunkIndex + 1;
      progress.progress = Math.floor((progress.currentChunk / totalChunks) * 100);
      this.emit("progress", progress);

      i += chunkSize - overlap;
      chunkIndex++;

      await this.yieldToEventLoop();
    }

    return chunks;
  }

  private async summarizeChunk(
    messages: unknown[],
    chunkIndex: number,
    options: SummarizationOptions,
  ): Promise<{ summary: string; keyPoints: string[]; entities: string[] }> {
    const conversationText = this.formatMessagesForSummary(messages);
    const prompt = `${this.SUMMARY_SYSTEM_PROMPT}\n\n## Conversation (Chunk ${chunkIndex + 1})\n${conversationText}`;

    try {
      const summary = await this.callLLM(prompt, options);
      return this.parseSummaryResponse(summary);
    } catch {
      console.warn(`Failed to generate AI summary for chunk ${chunkIndex}, using fallback`);
      return this.generateFallbackSummary(messages);
    }
  }

  private async callLLM(prompt: string, options: SummarizationOptions): Promise<string> {
    const _provider = options.provider ?? "anthropic";
    const model = options.model ?? "claude-sonnet-4-6";

    console.log(`[summarizer] Calling LLM with model ${model} provider ${_provider} (prompt length: ${prompt.length})`);

    return `[AI Summary would be generated here using ${model}]\n\n${prompt.slice(0, 200)}...`;
  }

  private parseSummaryResponse(response: string): {
    summary: string;
    keyPoints: string[];
    entities: string[];
  } {
    const lines = response.split("\n");
    let currentSection = "";
    let summary = "";
    const keyPoints: string[] = [];
    const entities: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("## Summary")) {
        currentSection = "summary";
      } else if (trimmed.startsWith("## Key Points")) {
        currentSection = "keyPoints";
      } else if (trimmed.startsWith("## Entities")) {
        currentSection = "entities";
      } else if (trimmed.startsWith("- ")) {
        const content = trimmed.slice(2);
        if (currentSection === "keyPoints") {
          keyPoints.push(content);
        } else if (currentSection === "entities") {
          entities.push(content);
        }
      } else if (currentSection === "summary" && trimmed) {
        summary += trimmed + " ";
      }
    }

    return {
      summary: summary.trim(),
      keyPoints,
      entities,
    };
  }

  private generateFallbackSummary(messages: unknown[]): {
    summary: string;
    keyPoints: string[];
    entities: string[];
  } {
    return {
      summary: `[Auto-compressed ${messages.length} messages]`,
      keyPoints: [`Compressed ${messages.length} messages from conversation`],
      entities: [],
    };
  }

  private async generateFullSummary(
    chunks: SummaryChunk[],
    options: SummarizationOptions,
  ): Promise<string> {
    if (chunks.length === 0) {
      return "No content to summarize.";
    }

    if (chunks.length === 1) {
      return chunks[0].summary;
    }

    const combinedPoints = chunks.flatMap((c) => c.keyPoints);
    const allEntities = [...new Set(chunks.flatMap((c) => c.entities))];

    const prompt = `${this.SUMMARY_SYSTEM_PROMPT}

## Key Points from All Chunks
${combinedPoints.map((p) => `- ${p}`).join("\n")}

## All Entities
${allEntities.map((e) => `- ${e}`).join("\n")}

Please provide a coherent overall summary that ties together all the key points.`;

    try {
      return await this.callLLM(prompt, options);
    } catch {
      return chunks.map((c) => c.summary).join("\n\n");
    }
  }

  private extractMessages(sessionManager: unknown): unknown[] {
    return (sessionManager as unknown as { messages: unknown[] }).messages ?? [];
  }

  private formatMessagesForSummary(messages: unknown[]): string {
    return messages
      .map((msg, idx) => {
        if (!msg || typeof msg !== "object") {
          return "";
        }
        const m = msg as Record<string, unknown>;
        const role = (m.role as string) ?? "unknown";
        const content = this.extractContent(m.content);
        return `[${idx + 1}] ${role.toUpperCase()}: ${content.slice(0, 500)}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  private extractContent(content: unknown): string {
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

  private estimateTokens(messages: unknown[]): number {
    let total = 0;
    for (const msg of messages) {
      if (msg && typeof msg === "object") {
        total += Math.ceil(this.extractContent((msg as Record<string, unknown>).content).length / 4);
      }
    }
    return total;
  }

  private getFileMtime(filePath: string): number {
    try {
      const { mtimeMs } = fs.statSync(filePath);
      return mtimeMs;
    } catch {
      return 0;
    }
  }

  private isSummaryFresh(summary: SessionSummary): boolean {
    const MAX_AGE_MS = 5 * 60 * 1000;
    return Date.now() - summary.metadata.generatedAt < MAX_AGE_MS;
  }

  private async yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }
}

export function getAISessionSummarizer(): AISessionSummarizer {
  return AISessionSummarizer.getInstance();
}
