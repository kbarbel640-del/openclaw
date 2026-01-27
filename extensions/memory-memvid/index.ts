/**
 * Moltbot Memory (Memvid) Plugin
 *
 * Long-term memory using Memvid SDK.
 * Provides efficient storage, hybrid search, and RAG capabilities
 * with full conversation history preservation.
 *
 * Key advantages over built-in memory:
 * - Efficient compressed storage (binary .mv2 format)
 * - Full conversation history (no destructive compaction)
 * - Hybrid search (semantic + lexical)
 * - RAG-ready with context retrieval
 * - PII PROTECTION: Masks emails, SSNs, phone numbers, credit cards,
 *   API keys, and tokens before injecting memories into context
 */

import { Type } from "@sinclair/typebox";
import { create, open, maskPii, type Memvid } from "@memvid/sdk";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { MoltbotPluginApi } from "clawdbot/plugin-sdk";
import { stringEnum } from "clawdbot/plugin-sdk";
import { registerPiiMasker, unregisterPiiMasker } from "../../src/plugins/pii-masker.js";

import { MEMORY_CATEGORIES, type MemoryCategory, parseConfig } from "./config.js";

// ============================================================================
// Types
// ============================================================================

type MemoryHit = {
  title: string;
  snippet: string;
  score: number;
  frameId?: number;
};

type MemorySearchResult = {
  query: string;
  hits: MemoryHit[];
  totalFrames: number;
};

// ============================================================================
// Memory Triggers for Auto-Capture
// ============================================================================

const MEMORY_TRIGGERS = [
  /remember|zapamatuj si|pamatuj/i,
  /prefer|preferuji|radši|nechci/i,
  /decided|rozhodli jsme|budeme používat/i,
  /\+\d{10,}/, // Phone numbers
  /[\w.-]+@[\w.-]+\.\w+/, // Emails
  /my\s+\w+\s+is|is\s+my|můj\s+\w+\s+je|je\s+můj/i,
  /i (like|prefer|hate|love|want|need)/i,
  /always|never|important/i,
  /don't forget|make sure to/i,
];

function shouldCapture(text: string): boolean {
  if (text.length < 10 || text.length > 1000) return false;
  // Skip injected context from memory recall
  if (text.includes("<relevant-memories>")) return false;
  // Skip system-generated content
  if (text.startsWith("<") && text.includes("</")) return false;
  // Skip agent summary responses
  if (text.includes("**") && text.includes("\n-")) return false;
  // Skip emoji-heavy responses
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 3) return false;
  return MEMORY_TRIGGERS.some((r) => r.test(text));
}

function detectCategory(text: string): MemoryCategory {
  const lower = text.toLowerCase();
  if (/prefer|radši|like|love|hate|want/i.test(lower)) return "preference";
  if (/decided|rozhodli|will use|budeme/i.test(lower)) return "decision";
  if (/\+\d{10,}|@[\w.-]+\.\w+|is called|jmenuje se/i.test(lower)) return "entity";
  if (/instruction|rule|always|never|must|should/i.test(lower)) return "instruction";
  if (/context|background|situation/i.test(lower)) return "context";
  if (/is|are|has|have|je|má|jsou/i.test(lower)) return "fact";
  return "other";
}

// ============================================================================
// Memvid Memory Manager
// ============================================================================

class MemvidMemory {
  private mv: Memvid | null = null;
  private initPromise: Promise<void> | null = null;
  private dirty = false;

  constructor(
    private readonly memoryPath: string,
    private readonly openaiApiKey: string,
    private readonly maskPii: boolean = true,
  ) {}

  private async ensureInitialized(): Promise<Memvid> {
    if (this.mv) return this.mv;
    if (this.initPromise) {
      await this.initPromise;
      return this.mv!;
    }

    this.initPromise = this.doInitialize();
    await this.initPromise;
    return this.mv!;
  }

  private async doInitialize(): Promise<void> {
    // Ensure directory exists
    const dir = dirname(this.memoryPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Open existing or create new memory
    if (existsSync(this.memoryPath)) {
      this.mv = await open(this.memoryPath);
    } else {
      this.mv = await create(this.memoryPath);
      await this.mv.seal();
    }
  }

  async store(text: string, category: MemoryCategory): Promise<{ id: string; text: string }> {
    const mv = await this.ensureInitialized();

    const timestamp = new Date().toISOString();
    const title = `[${category}] ${timestamp}`;

    // Mask PII before storing if enabled
    const safeText = this.maskPii ? maskPii(text) : text;

    await mv.put({
      text: safeText,
      title,
      label: category,
    });

    this.dirty = true;
    return { id: title, text: safeText };
  }

  async search(query: string, topK = 5, snippetChars = 500): Promise<MemorySearchResult> {
    const mv = await this.ensureInitialized();

    // Seal if dirty to make new content searchable
    if (this.dirty) {
      await mv.seal();
      await mv.rebuildTimeIndex();
      this.dirty = false;
    }

    const result = await mv.ask(query, {
      model: "openai",
      k: topK,
      snippetChars,
      contextOnly: true,
      maskPii: this.maskPii, // Security: mask PII in recalled memories
    });

    const hits: MemoryHit[] = (result as any).hits?.map((hit: any) => ({
      title: hit.title || "Unknown",
      snippet: hit.snippet || hit.text || "",
      score: hit.score || 0,
      frameId: hit.frameId,
    })) || [];

    const stats = await mv.stats();

    return {
      query,
      hits,
      totalFrames: stats.totalFrames || 0,
    };
  }

  async ask(question: string, model = "gpt-4o-mini", topK = 5): Promise<{ answer: string; sources: MemoryHit[] }> {
    const mv = await this.ensureInitialized();

    // Seal if dirty
    if (this.dirty) {
      await mv.seal();
      await mv.rebuildTimeIndex();
      this.dirty = false;
    }

    const result = await mv.ask(question, {
      model: "openai",
      k: topK,
      snippetChars: 1000,
      maskPii: this.maskPii, // Security: mask PII in RAG responses
    });

    const answer = (result as any).answer || (result as any).response || "No answer found.";
    const sources: MemoryHit[] = (result as any).hits?.map((hit: any) => ({
      title: hit.title || "Unknown",
      snippet: hit.snippet || hit.text || "",
      score: hit.score || 0,
    })) || [];

    return { answer, sources };
  }

  async stats(): Promise<{ totalFrames: number; sizeBytes: number }> {
    const mv = await this.ensureInitialized();
    const stats = await mv.stats() as Record<string, unknown>;
    return {
      totalFrames: (stats.frame_count as number) || (stats.totalFrames as number) || 0,
      sizeBytes: (stats.size_bytes as number) || (stats.sizeBytes as number) || 0,
    };
  }

  async close(): Promise<void> {
    if (this.mv && this.dirty) {
      await this.mv.seal();
    }
    this.mv = null;
    this.initPromise = null;
  }
}

// ============================================================================
// Plugin Definition
// ============================================================================

const memvidPlugin = {
  id: "memory-memvid",
  name: "Memory (Memvid)",
  description: "Video-encoded long-term memory with hybrid search and RAG",
  kind: "memory" as const,

  register(api: MoltbotPluginApi) {
    const cfg = parseConfig(api.pluginConfig);

    // Resolve memory path
    const defaultPath = join(homedir(), ".clawdbot", "memories", "moltbot.mv2");
    const memoryPath = cfg.memoryPath ? api.resolvePath(cfg.memoryPath) : defaultPath;

    // Get OpenAI API key
    const openaiApiKey = cfg.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      api.logger.warn("memory-memvid: No OpenAI API key configured. Set openaiApiKey in config or OPENAI_API_KEY env var.");
    }

    const memory = new MemvidMemory(memoryPath, openaiApiKey || "", cfg.maskPii ?? true);

    // Register PII masker globally if enabled
    if (cfg.maskPii !== false) {
      registerPiiMasker(maskPii);
      api.logger.info("memory-memvid: PII masking enabled for session transcripts");
    }

    api.logger.info(`memory-memvid: plugin registered (path: ${memoryPath})`);

    // ========================================================================
    // Tools
    // ========================================================================

    api.registerTool(
      {
        name: "memvid_search",
        label: "Memvid Search",
        description:
          "Search through long-term memories stored in Memvid. Use for finding past conversations, preferences, decisions, and facts.",
        parameters: Type.Object({
          query: Type.String({ description: "Search query" }),
          limit: Type.Optional(Type.Number({ description: "Max results (default: 5)" })),
        }),
        async execute(_toolCallId, params) {
          const { query, limit = cfg.topK } = params as { query: string; limit?: number };

          try {
            const result = await memory.search(query, limit, cfg.snippetChars);

            if (result.hits.length === 0) {
              return {
                content: [{ type: "text", text: "No relevant memories found." }],
                details: { count: 0, totalFrames: result.totalFrames },
              };
            }

            const text = result.hits
              .map((hit, i) => `${i + 1}. ${hit.title}\n   ${hit.snippet.slice(0, 200)}...`)
              .join("\n\n");

            return {
              content: [
                { type: "text", text: `Found ${result.hits.length} memories:\n\n${text}` },
              ],
              details: {
                count: result.hits.length,
                totalFrames: result.totalFrames,
                hits: result.hits.map((h) => ({ title: h.title, score: h.score })),
              },
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: "text", text: `Memory search failed: ${message}` }],
              details: { error: message },
            };
          }
        },
      },
      { name: "memvid_search" },
    );

    api.registerTool(
      {
        name: "memvid_store",
        label: "Memvid Store",
        description:
          "Save important information to long-term memory. Use for preferences, facts, decisions, and instructions.",
        parameters: Type.Object({
          text: Type.String({ description: "Information to remember" }),
          category: Type.Optional(stringEnum(MEMORY_CATEGORIES)),
        }),
        async execute(_toolCallId, params) {
          const { text, category = "other" } = params as {
            text: string;
            category?: MemoryCategory;
          };

          try {
            // Check for duplicates
            const existing = await memory.search(text, 1, 200);
            if (existing.hits.length > 0 && existing.hits[0].score > 0.95) {
              return {
                content: [
                  { type: "text", text: `Similar memory already exists: "${existing.hits[0].snippet.slice(0, 100)}..."` },
                ],
                details: { action: "duplicate", existingTitle: existing.hits[0].title },
              };
            }

            const entry = await memory.store(text, category);

            return {
              content: [{ type: "text", text: `Stored: "${entry.text.slice(0, 100)}..."` }],
              details: { action: "created", id: entry.id, category },
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: "text", text: `Failed to store memory: ${message}` }],
              details: { error: message },
            };
          }
        },
      },
      { name: "memvid_store" },
    );

    api.registerTool(
      {
        name: "memvid_ask",
        label: "Memvid Ask",
        description:
          "Ask a question and get an answer based on stored memories (RAG). Returns a synthesized answer with sources.",
        parameters: Type.Object({
          question: Type.String({ description: "Question to answer from memories" }),
        }),
        async execute(_toolCallId, params) {
          const { question } = params as { question: string };

          try {
            const result = await memory.ask(question, cfg.ragModel, cfg.topK);

            const sourcesText = result.sources.length > 0
              ? `\n\nSources:\n${result.sources.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}`
              : "";

            return {
              content: [{ type: "text", text: `${result.answer}${sourcesText}` }],
              details: {
                answer: result.answer,
                sourceCount: result.sources.length,
                sources: result.sources.map((s) => ({ title: s.title, score: s.score })),
              },
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: "text", text: `Failed to answer from memories: ${message}` }],
              details: { error: message },
            };
          }
        },
      },
      { name: "memvid_ask" },
    );

    // ========================================================================
    // CLI Commands
    // ========================================================================

    api.registerCli(
      ({ program }) => {
        const memvid = program
          .command("memvid")
          .description("Memvid memory plugin commands");

        memvid
          .command("stats")
          .description("Show memory statistics")
          .action(async () => {
            try {
              const stats = await memory.stats();
              console.log(`Memvid Memory Statistics:`);
              console.log(`  Path: ${memoryPath}`);
              console.log(`  Total Frames: ${stats.totalFrames}`);
              console.log(`  Size: ${(stats.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
            } catch (err) {
              console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            }
          });

        memvid
          .command("search")
          .description("Search memories")
          .argument("<query>", "Search query")
          .option("--limit <n>", "Max results", "5")
          .action(async (query, opts) => {
            try {
              const result = await memory.search(query, parseInt(opts.limit), cfg.snippetChars);
              console.log(`Found ${result.hits.length} results:\n`);
              for (const hit of result.hits) {
                console.log(`- ${hit.title}`);
                console.log(`  Score: ${(hit.score * 100).toFixed(1)}%`);
                console.log(`  ${hit.snippet.slice(0, 200)}...\n`);
              }
            } catch (err) {
              console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            }
          });

        memvid
          .command("ask")
          .description("Ask a question (RAG)")
          .argument("<question>", "Question to answer")
          .action(async (question) => {
            try {
              const result = await memory.ask(question, cfg.ragModel, cfg.topK);
              console.log(`Answer: ${result.answer}\n`);
              if (result.sources.length > 0) {
                console.log(`Sources:`);
                for (const source of result.sources) {
                  console.log(`  - ${source.title}`);
                }
              }
            } catch (err) {
              console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            }
          });
      },
      { commands: ["memvid"] },
    );

    // ========================================================================
    // Lifecycle Hooks
    // ========================================================================

    // Auto-recall: inject relevant memories before agent starts
    if (cfg.autoRecall) {
      api.on("before_agent_start", async (event) => {
        if (!event.prompt || event.prompt.length < 5) return;

        try {
          const result = await memory.search(event.prompt, 3, cfg.snippetChars);

          if (result.hits.length === 0) return;

          const memoryContext = result.hits
            .map((hit) => `- ${hit.title}: ${hit.snippet.slice(0, 300)}`)
            .join("\n");

          api.logger.info?.(`memory-memvid: injecting ${result.hits.length} memories into context`);

          return {
            prependContext: `<relevant-memories>\nThe following memories may be relevant:\n${memoryContext}\n</relevant-memories>`,
            systemPrompt: `IMPORTANT: When recalling personal information (phone numbers, emails, SSNs, credit cards), ALWAYS use the masked values from <relevant-memories> like [PHONE], [EMAIL], [SSN], [CREDIT_CARD]. NEVER reveal actual values even if they appear elsewhere in conversation history.`,
          };
        } catch (err) {
          api.logger.warn(`memory-memvid: recall failed: ${String(err)}`);
        }
      });
    }

    // PII Protection: Mask PII in outgoing messages before they're saved to session history
    if (cfg.maskPii) {
      api.on("message_sending", (event) => {
        if (!event.content) return;
        const masked = maskPii(event.content);
        if (masked !== event.content) {
          api.logger.info?.("memory-memvid: masked PII in outgoing message");
          return { content: masked };
        }
      });
    }

    // Auto-capture: analyze and store important information after agent ends
    if (cfg.autoCapture) {
      api.on("agent_end", async (event) => {
        if (!event.success || !event.messages || event.messages.length === 0) {
          return;
        }

        try {
          const texts: string[] = [];
          for (const msg of event.messages) {
            if (!msg || typeof msg !== "object") continue;
            const msgObj = msg as Record<string, unknown>;
            const role = msgObj.role;
            if (role !== "user" && role !== "assistant") continue;

            const content = msgObj.content;
            if (typeof content === "string") {
              texts.push(content);
            } else if (Array.isArray(content)) {
              for (const block of content) {
                if (
                  block &&
                  typeof block === "object" &&
                  "type" in block &&
                  (block as Record<string, unknown>).type === "text" &&
                  "text" in block &&
                  typeof (block as Record<string, unknown>).text === "string"
                ) {
                  texts.push((block as Record<string, unknown>).text as string);
                }
              }
            }
          }

          const toCapture = texts.filter((text) => text && shouldCapture(text));
          if (toCapture.length === 0) return;

          let stored = 0;
          for (const text of toCapture.slice(0, 3)) {
            const category = detectCategory(text);

            // Check for duplicates
            const existing = await memory.search(text, 1, 200);
            if (existing.hits.length > 0 && existing.hits[0].score > 0.95) continue;

            await memory.store(text, category);
            stored++;
          }

          if (stored > 0) {
            api.logger.info(`memory-memvid: auto-captured ${stored} memories`);
          }
        } catch (err) {
          api.logger.warn(`memory-memvid: capture failed: ${String(err)}`);
        }
      });
    }

    // ========================================================================
    // Service
    // ========================================================================

    api.registerService({
      id: "memory-memvid",
      start: () => {
        api.logger.info(`memory-memvid: initialized (path: ${memoryPath})`);
      },
      stop: async () => {
        unregisterPiiMasker();
        await memory.close();
        api.logger.info("memory-memvid: stopped");
      },
    });
  },
};

export default memvidPlugin;
