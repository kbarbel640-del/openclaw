/**
 * Clawdbrain Memory (LanceDB) Plugin
 *
 * Long-term memory with vector search for AI conversations.
 * Uses LanceDB for storage and OpenAI for embeddings/extraction.
 * Provides seamless auto-recall and auto-capture via semantic analysis.
 */

import { Type } from "@sinclair/typebox";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ClawdbrainPluginApi } from "clawdbrain/plugin-sdk";
import { stringEnum } from "clawdbrain/plugin-sdk";

import {
  MEMORY_CATEGORIES,
  memoryConfigSchema,
  vectorDimsForModel,
} from "./config.js";

import { LanceDbStore } from "./src/services/lancedb-store.js";
import { OpenAiEmbedder } from "./src/services/openai-embedder.js";
import { OpenAiExtractor } from "./src/services/openai-extractor.js";
import { OpenAiExpander } from "./src/services/openai-expander.js";
import { OpenAiSynthesizer } from "./src/services/openai-synthesizer.js";
import { DigestService } from "./src/services/digest-service.js";
import type { Notifier } from "./src/types.js";

// ============================================================================ 
// Plugin Definition
// ============================================================================ 

const memoryPlugin = {
  id: "memory-lancedb",
  name: "Memory (LanceDB)",
  description: "LanceDB-backed long-term memory with semantic extraction",
  kind: "memory" as const,
  configSchema: memoryConfigSchema,

  register(api: ClawdbrainPluginApi) {
    const cfg = memoryConfigSchema.parse(api.pluginConfig);
    const resolvedDbPath = api.resolvePath(cfg.dbPath!);
    const vectorDim = vectorDimsForModel(cfg.embedding.model ?? "text-embedding-3-small");
    
    // Initialize Services
    const db = new LanceDbStore(resolvedDbPath, vectorDim);
    const embeddings = new OpenAiEmbedder(cfg.embedding.apiKey, cfg.embedding.model!);
    const extraction = new OpenAiExtractor(cfg.extraction!.apiKey!, cfg.extraction!.model!);
    const expansion = new OpenAiExpander(cfg.extraction!.apiKey!, cfg.extraction!.model!)
    const synthesizer = new OpenAiSynthesizer(cfg.extraction!.apiKey!, cfg.extraction!.model!)
    
    // Default Notifier (Logger only for now, extensible later)
    const loggerNotifier: Notifier = {
      notify: async (msg) => {
        api.logger.info(`[Morning Briefing] ${msg}`);
      }
    };

    const digest = new DigestService(db, synthesizer, embeddings, loggerNotifier);

    api.logger.info(
      `memory-lancedb: plugin registered (db: ${resolvedDbPath}, extraction: ${cfg.extraction?.model})`,
    );

    // ======================================================================== 
    // Tools
    // ======================================================================== 

    api.registerTool(
      {
        name: "memory_recall",
        label: "Memory Recall",
        description:
          "Search through long-term memories. Use when you need context about user preferences, past decisions, or previously discussed topics.",
        parameters: Type.Object({
          query: Type.String({ description: "Search query" }),
          limit: Type.Optional(Type.Number({ description: "Max results (default: 5)" })),
        }),
        async execute(_toolCallId, params) {
          const { query, limit = 5 } = params as { query: string; limit?: number };

          const vector = await embeddings.embed(query);
          const results = await db.search(vector, limit, 0.1);

          if (results.length === 0) {
            return {
              content: [{ type: "text", text: "No relevant memories found." }],
              details: { count: 0 },
            };
          }

          const text = results
            .map(
              (r, i) =>
                `${i + 1}. [${r.entry.category}] ${r.entry.text} (${(r.score * 100).toFixed(0)}%)`,
            )
            .join("\n");

          const sanitizedResults = results.map((r) => ({
            id: r.entry.id,
            text: r.entry.text,
            category: r.entry.category,
            importance: r.entry.importance,
            score: r.score,
            tags: r.entry.tags,
          }));

          return {
            content: [
              { type: "text", text: `Found ${results.length} memories:\n\n${text}` },
            ],
            details: { count: results.length, memories: sanitizedResults },
          };
        },
      },
      { name: "memory_recall" },
    );

    api.registerTool(
      {
        name: "memory_store",
        label: "Memory Store",
        description:
          "Save important information in long-term memory. Use for preferences, facts, decisions.",
        parameters: Type.Object({
          text: Type.String({ description: "Information to remember" }),
          importance: Type.Optional(
            Type.Number({ description: "Importance 0-1 (default: 0.7)" }),
          ),
          category: Type.Optional(stringEnum(MEMORY_CATEGORIES)),
          tags: Type.Optional(Type.Array(Type.String())),
        }),
        async execute(_toolCallId, params) {
          const {
            text,
            importance = 0.7,
            category = "other",
            tags = [],
          } = params as {
            text: string;
            importance?: number;
            category?: any;
            tags?: string[];
          };

          const vector = await embeddings.embed(text);

          const existing = await db.search(vector, 1, 0.95);
          if (existing.length > 0) {
            return {
              content: [
                { type: "text", text: `Similar memory already exists: "${existing[0].entry.text}"` },
              ],
              details: { action: "duplicate", existingId: existing[0].entry.id, existingText: existing[0].entry.text },
            };
          }

          const entry = await db.store({
            text,
            vector,
            importance,
            category,
            tags,
            confidence: 1.0,
          });

          return {
            content: [{ type: "text", text: `Stored: "${text.slice(0, 100)}"..."` }],
            details: { action: "created", id: entry.id },
          };
        },
      },
      { name: "memory_store" },
    );

    // ======================================================================== 
    // Cron Jobs (The Gardener)
    // ======================================================================== 

    api.registerCron({
      id: "memory-maintenance",
      description: "Daily memory synthesis and cleanup",
      schedule: "0 4 * * *", // 4 AM Daily
      handler: async () => {
        try {
          const summary = await digest.runDailyMaintenance(api);
          api.logger.info(`[Gardener] Daily maintenance complete: ${summary}`);
        } catch (err) {
          api.logger.error(`[Gardener] Daily maintenance failed: ${String(err)}`);
        }
      }
    });

    // ======================================================================== 
    // CLI Commands
    // ======================================================================== 

    api.registerCli(
      ({ program }) => {
        const memory = program
          .command("ltm")
          .description("LanceDB memory plugin commands");

        memory
          .command("list")
          .description("List memories")
          .action(async () => {
            const count = await db.count();
            console.log(`Total memories: ${count}`);
          });

        memory
          .command("maintain")
          .description("Run synthesis and digest (The Gardener)")
          .option("--dry-run", "Preview changes without applying")
          .action(async (opts) => {
            const summary = await digest.runDailyMaintenance(api, opts.dryRun);
            console.log("Maintenance Summary:");
            console.log(summary);
          });

        memory
          .command("search")
          .description("Search memories")
          .argument("<query>", "Search query")
          .option("--limit <n>", "Max results", "5")
          .action(async (query, opts) => {
            const vector = await embeddings.embed(query);
            const results = await db.search(vector, parseInt(opts.limit), 0.3);
            const output = results.map((r) => ({
              id: r.entry.id,
              text: r.entry.text,
              category: r.entry.category,
              score: r.score,
              tags: r.entry.tags,
            }));
            console.log(JSON.stringify(output, null, 2));
          });
        
        memory
          .command("query")
          .description("Debug query expansion and search")
          .argument("<prompt>", "User prompt")
          .option("--history <msgs...>")
          .action(async (prompt, opts) => {
             const mockHistory = (opts.history || []).map((content: string, i: number) => ({
               role: i % 2 === 0 ? "user" : "assistant",
               content
             }));
             
             console.log(`[Query Expansion] Input: "${prompt}"`);
             const expanded = await expansion.expand(mockHistory, prompt, api);
             console.log(`[Query Expansion] Expanded: "${expanded}"`);

             console.log(`[Search] Embedding...`);
             const vector = await embeddings.embed(expanded);
             const results = await db.search(vector, 5, 0.1);
             
             console.log(`[Search] Found ${results.length} results:`);
             results.forEach((r, i) => {
               console.log(`${i+1}. [${r.entry.category}] ${r.entry.text} (${(r.score*100).toFixed(0)}%)`);
             });
          });

        memory
          .command("trace")
          .description("Show recent memory extraction traces")
          .option("--tail <n>", "Number of entries to show", "10")
          .action(async (opts) => {
            const logPath = join(homedir(), ".clawdbrain", "logs", "memory-trace.jsonl");
            try {
              const { readFileSync } = await import("node:fs");
              const lines = readFileSync(logPath, "utf8").trim().split("\n");
              const tail = lines.slice(-parseInt(opts.tail));
              tail.forEach(l => console.log(l));
            } catch (err) {
              console.error("No traces found or failed to read.");
            }
          });
      },
      { commands: ["ltm"] },
    );

    // ======================================================================== 
    // Lifecycle Hooks
    // ======================================================================== 

    if (cfg.autoRecall) {
      api.on("before_agent_start", async (event) => {
        if (!event.prompt || event.prompt.length < 2) return;

        try {
          const history = (event as any).history ?? [];
          
          let searchQuery = event.prompt;
          if (history.length > 0) {
            searchQuery = await expansion.expand(history, event.prompt, api);
          }

          const vector = await embeddings.embed(searchQuery);
          const results = await db.search(vector, 5, 0.3);

          if (results.length === 0) return;

          const facts = results.filter(r => r.entry.category === 'fact');
          const entities = results.filter(r => r.entry.category === 'entity');
          const prefs = results.filter(r => r.entry.category === 'preference');
          const others = results.filter(r => !['fact', 'entity', 'preference'].includes(r.entry.category));

          const formatGroup = (items: MemorySearchResult[]) => 
            items.map(r => `    - ${r.entry.text}`).join("\n");

          let memoryContext = "<memory_context>\n";
          if (facts.length) memoryContext += `  <facts>\n${formatGroup(facts)}\n  </facts>\n`;
          if (entities.length) memoryContext += `  <entities>\n${formatGroup(entities)}\n  </entities>\n`;
          if (prefs.length) memoryContext += `  <preferences>\n${formatGroup(prefs)}\n  </preferences>\n`;
          if (others.length) memoryContext += `  <history>\n${formatGroup(others)}\n  </history>\n`;
          memoryContext += "</memory_context>";

          api.logger.info?.(
            `memory-lancedb: injecting ${results.length} memories (query: "${searchQuery}")`,
          );

          return {
            prependContext: memoryContext,
          };
        } catch (err) {
          api.logger.warn(`memory-lancedb: recall failed: ${String(err)}`);
        }
      });
    }

    if (cfg.autoCapture) {
      api.on("agent_end", async (event) => {
        if (!event.success || !event.messages || event.messages.length === 0) {
          return;
        }

        try {
          const extractionMessages: { role: string; content: string }[] = [];
          for (const msg of event.messages) {
            if (!msg || typeof msg !== "object") continue;
            const msgObj = msg as any;
            const role = msgObj.role;
            if (role !== "user" && role !== "assistant") continue;

            let text = "";
            if (typeof msgObj.content === "string") {
              text = msgObj.content;
            } else if (Array.isArray(msgObj.content)) {
              text = msgObj.content
                .filter((b: any) => b.type === "text")
                .map((b: any) => b.text)
                .join("\n");
            }
            if (text) extractionMessages.push({ role, content: text });
          }

          if (extractionMessages.length < 2) return; 

          // 1. Semantic Extraction
          const items = await extraction.extract(extractionMessages, api); 
          
          let storedCount = 0;
          for (const item of items) {
            if (item.confidence < 0.6) continue;

            const vector = await embeddings.embed(item.text);
            const existing = await db.search(vector, 1, 0.9);
            if (existing.length > 0) continue;

            await db.store({
              text: item.text,
              vector,
              importance: item.importance,
              category: item.category,
              tags: item.tags,
              confidence: item.confidence,
              sourceChannel: event.channelId,
              originalText: extractionMessages[extractionMessages.length - 1].content,
            });
            storedCount++;
          }

          // 2. Inbox logic (URLs in DMs)
          const lastUserMsg = [...extractionMessages].reverse().find(m => m.role === "user");
          if (lastUserMsg && event.channelType === "dm") {
            const urlMatch = lastUserMsg.content.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
              const url = urlMatch[0];
              api.logger.debug?.(`memory-lancedb: found URL in DM, attempting auto-summarization: ${url}`);
              const summary = await extraction.summarizeUrl(url, api);
              
              if (summary) {
                const vector = await embeddings.embed(summary);
                await db.store({
                  text: `[Resource] ${summary}`,
                  vector,
                  importance: 0.5,
                  category: "resource",
                  tags: ["auto-resource", "inbox"],
                  confidence: 1.0,
                  sourceChannel: event.channelId,
                  originalText: `Shared URL: ${url}`,
                });
                storedCount++;
              }
            }
          }

          if (storedCount > 0) {
            api.logger.info(`memory-lancedb: auto-captured ${storedCount} semantic memories`);
          }

        } catch (err) {
          api.logger.warn(`memory-lancedb: auto-capture failed: ${String(err)}`);
        }
      });
    }

    // ======================================================================== 
    // Service
    // ======================================================================== 

    api.registerService({
      id: "memory-lancedb",
      start: () => {
        api.logger.info(
          `memory-lancedb: initialized (db: ${resolvedDbPath})`,
        );
      },
      stop: () => {
        api.logger.info("memory-lancedb: stopped");
      },
    });
  },
};

export default memoryPlugin;