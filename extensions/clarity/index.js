/**
 * Clarity Plugin — Relevance-Based Context Prioritization
 *
 * Replaces static priority rules with dynamic relevance scoring based on
 * actual usage patterns: mentions, recency, frequency, and utility.
 *
 * Features:
 * - Multi-factor relevance scoring (recency, frequency, utility, staleness)
 * - Efficient tracking (O(1) per turn, no O(n^2) scanning)
 * - Integration with existing Clarity strict mode
 * - Anchored item preservation
 * - Score inspection for debugging
 * - Persistence to kv_store
 *
 * Hooks:
 *   before_agent_start — Inject relevance-based context
 *   agent_end — Track mentions/references, persist state
 *   before_compaction — Prune low-relevance items
 *
 * Gateway methods:
 *   clarity.getState — Full tracker state
 *   clarity.getScores — Current relevance scores
 *   clarity.anchor — Mark item as anchored
 *   clarity.unanchor — Remove anchor from item
 *   clarity.prune — Trigger manual pruning
 *   clarity.stats — Get statistics
 */

"use strict";

const path = require("path");
const fs = require("fs");

const ContextTracker = require("./lib/v2").V2ContextTracker;
const RelevancePruner = require("./lib/pruner");
const ContextHealth = require("./lib/v2/context-health");

// Default configuration
const DEFAULT_CONFIG = {
  enabled: true,
  strictMode: false,

  // Scoring parameters (updated for entity-based TF-IDF scoring)
  scoring: {
    halfLife: 5, // Exponential decay half-life in turns
    recencyWindow: 3, // Turns considered "recent"
    recencyBonus: 20, // Max bonus for recent mentions
    referenceWeight: 15, // Points per actual reference in response
    frequencyScale: 10, // Scaling factor for frequency
    anchorBonus: 5, // Reduced from 100 — small consistent boost
  },

  // Pruning parameters
  pruning: {
    pruneThreshold: 8,
    strictModePreserveThreshold: 25,
    maxItemsPerCategory: 20,
    targetContextItems: 30,
    maxContextItems: 50,
    minMentionsPreserve: 3,
  },

  // Extraction parameters (updated for entity-based extraction)
  extraction: {
    minWordLength: 5, // Increased from 4 to filter more noise
    maxKeywordsPerMessage: 8, // Limit keywords per message
    extractProjects: true,
    extractTools: true,
    extractMemoryFiles: true,
    customPatterns: [],
  },

  // Persistence
  persistInterval: 10, // Turns between persistence
};

function loadConfig(pluginConfig = {}) {
  const configPath = path.join(__dirname, "config.json");
  let fileConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
      console.error("[Clarity] Failed to load config:", err.message);
    }
  }

  // Merge: defaults < file < pluginConfig
  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...pluginConfig,
    scoring: { ...DEFAULT_CONFIG.scoring, ...fileConfig.scoring, ...pluginConfig.scoring },
    pruning: { ...DEFAULT_CONFIG.pruning, ...fileConfig.pruning, ...pluginConfig.pruning },
    extraction: {
      ...DEFAULT_CONFIG.extraction,
      ...fileConfig.extraction,
      ...pluginConfig.extraction,
    },
  };
}

module.exports = {
  id: "clarity",
  name: "Clarity — Relevance-Based Context Prioritization",
  version: "1.0.0",
  priority: 15, // After continuity (10) but before most others

  configSchema: {
    jsonSchema: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        strictMode: { type: "boolean" },
        scoring: {
          type: "object",
          properties: {
            halfLife: { type: "number" },
            recencyWindow: { type: "number" },
            recencyBonus: { type: "number" },
            referenceWeight: { type: "number" },
            frequencyScale: { type: "number" },
            anchorBonus: { type: "number" },
          },
        },
        pruning: {
          type: "object",
          properties: {
            pruneThreshold: { type: "number" },
            strictModePreserveThreshold: { type: "number" },
            maxItemsPerCategory: { type: "number" },
            targetContextItems: { type: "number" },
            maxContextItems: { type: "number" },
          },
        },
      },
    },
  },

  register(api) {
    const config = loadConfig(api.pluginConfig || {});

    if (!config.enabled) {
      api.logger.info("Clarity plugin registered (disabled)");
      return;
    }

    // Get kv store from memory plugin if available
    let kv = null;
    try {
      const memoryPlugin = api.getPlugin ? api.getPlugin("memory") : null;
      if (memoryPlugin?.api?.kv) {
        kv = memoryPlugin.api.kv;
      }
    } catch (err) {
      api.logger.debug("[Clarity] Memory plugin kv not available, will use in-memory only");
    }

    // Initialize tracker and pruner
    const tracker = new ContextTracker({
      kv,
      namespace: "clarity",
      scorerConfig: config.scoring,
      extractorConfig: config.extraction,
      persistInterval: config.persistInterval,
    });

    const pruner = new RelevancePruner({
      tracker,
      config: config.pruning,
    });

    // Load persisted state
    const loaded = tracker.load();
    if (loaded) {
      api.logger.info(
        `[Clarity] Loaded state: turn ${tracker._currentTurn}, ${tracker._items.size} items tracked`,
      );
    }

    // Track recent assistant response for reference detection
    let lastAssistantResponse = "";

    // -------------------------------------------------------------------
    // HOOK: before_agent_start — Inject relevance context
    // -------------------------------------------------------------------

    api.on(
      "before_agent_start",
      async (event, ctx) => {
        try {
          // Extract user message
          const messages = event.messages || [];
          const lastUser = [...messages].reverse().find((m) => m?.role === "user");
          const userText = _extractText(lastUser);

          if (!userText) return;

          // Track mentions from user message
          const mentioned = tracker.trackMentions(userText);

          // Get current scores for injection
          const scored = tracker.getScoredItems();
          const topItems = scored.filter((i) => i.finalScore >= 15).slice(0, 8);

          // Build context injection
          const lines = ["[CLARITY CONTEXT]"];

          // Show high-relevance items
          if (topItems.length > 0) {
            lines.push("High-relevance context:");
            for (const item of topItems) {
              const anchorMark = item.metadata.anchored ? "⚓ " : "";
              const recency =
                item.metadata.turnsSinceLastMention <= 1
                  ? "●"
                  : item.metadata.turnsSinceLastMention <= 3
                    ? "◐"
                    : "○";
              lines.push(`  ${recency} ${anchorMark}${item.id} (${Math.round(item.finalScore)})`);
            }
          }

          // Show what was just mentioned
          if (mentioned.length > 0) {
            lines.push(`Tracked mentions: ${mentioned.slice(0, 5).join(", ")}`);
          }

          // Strict mode notice
          if (config.strictMode) {
            lines.push("Strict mode: preserving essential context");
          }

          if (topItems.length > 0 || config.strictMode) {
            return { prependContext: lines.join("\n") + "\n" };
          }
        } catch (err) {
          api.logger.warn(`[Clarity] before_agent_start error: ${err.message}`);
        }
      },
      { priority: 15 },
    );

    // -------------------------------------------------------------------
    // HOOK: agent_end — Track references and advance turn
    // -------------------------------------------------------------------

    api.on("agent_end", async (event, ctx) => {
      try {
        // Get assistant response
        const messages = event.messages || [];
        const assistantMsg = [...messages].reverse().find((m) => m?.role === "assistant");
        const assistantText = _extractText(assistantMsg);

        if (assistantText) {
          lastAssistantResponse = assistantText;

          // Detect references to tracked items in the response
          const scored = tracker.getScoredItems();
          for (const item of scored) {
            const itemName = item.id.replace(/^(project|tool|file|keyword):/, "");
            if (assistantText.toLowerCase().includes(itemName.toLowerCase())) {
              tracker.trackReference(item.id, assistantText.slice(0, 100));
            }
          }
        }

        // Advance turn counter
        tracker.advanceTurn();
      } catch (err) {
        api.logger.warn(`[Clarity] agent_end error: ${err.message}`);
      }
    });

    // -------------------------------------------------------------------
    // HOOK: before_compaction — Prune low-relevance items
    // -------------------------------------------------------------------

    api.on("before_compaction", async (event, ctx) => {
      try {
        const evaluation = pruner.evaluate({
          strictMode: config.strictMode,
          currentItemCount: tracker._items.size,
        });

        // Only log if we would prune something significant
        if (evaluation.prune.length > 5) {
          api.logger.info(
            `[Clarity] Pruning evaluation: keep ${evaluation.stats.keeping}, prune ${evaluation.stats.pruning}`,
          );

          // In strict mode, be more conservative
          if (!config.strictMode) {
            const pruned = pruner.prune({ strictMode: config.strictMode });
            api.logger.info(`[Clarity] Pruned ${pruned.prunedIds.length} low-relevance items`);
          }
        }

        // Persist state on compaction
        tracker.persist();
      } catch (err) {
        api.logger.warn(`[Clarity] before_compaction error: ${err.message}`);
      }
    });

    // -------------------------------------------------------------------
    // HOOK: session_end — Final persistence
    // -------------------------------------------------------------------

    api.on("session_end", async (event, ctx) => {
      try {
        tracker.persist();
        api.logger.info(`[Clarity] Session ended. State persisted: ${tracker._items.size} items`);
      } catch (err) {
        api.logger.warn(`[Clarity] session_end error: ${err.message}`);
      }
    });

    // -------------------------------------------------------------------
    // COMMAND: /clarity
    // -------------------------------------------------------------------

    api.registerCommand({
      name: "clarity",
      description:
        "Clarity plugin control: /clarity | /clarity scores | /clarity anchor <item> | /clarity unanchor <item> | /clarity prune | /clarity stats | /clarity config",
      acceptsArgs: true,
      requireAuth: true,
      handler: (ctx) => {
        const args = (ctx.args || "").trim();
        const [cmd, ...rest] = args.split(" ");

        // Default: show status
        if (!cmd) {
          const stats = tracker.getStats();
          return {
            text: [
              `🔍 **Clarity — Relevance-Based Prioritization**`,
              `Status: ${config.enabled ? "✅ enabled" : "⏸️ disabled"}`,
              `Strict mode: ${config.strictMode ? "✅ on" : "⏸️ off"}`,
              `Current turn: ${stats.currentTurn}`,
              `Tracked items: ${stats.totalItems}`,
              `Anchored items: ${stats.anchoredItems}`,
              "",
              `**Top items by relevance:**`,
              ...stats.topItems.map(
                (i) => `  ${i.anchored ? "⚓ " : ""}${i.id}: ${i.score} (${i.mentions} mentions)`,
              ),
              "",
              "Commands: scores, anchor <item>, unanchor <item>, prune, stats, config",
            ].join("\n"),
          };
        }

        // Health report
        if (cmd === "health") {
          try {
            const report = ContextHealth.generateHealthReport(
              [...tracker._entities.values()],
              tracker._currentTurn,
            );
            const formatted = ContextHealth.formatHealthReport(report);
            // Return structured content to avoid plugin result parsing issues
            return { content: [{ type: "text", text: formatted }] };
          } catch (err) {
            api.logger.warn(`[Clarity] health command error: ${err.message}`);
            return { content: [{ type: "text", text: "❌ Failed to generate health report" }] };
          }
        }

        // Show scores
        if (cmd === "scores") {
          const scored = tracker.getScoredItems();
          const lines = [
            `📊 **Clarity Relevance Scores** (turn ${tracker._currentTurn})`,
            "",
            "| Item | Score | Freq | Recency | Utility | Mentions |",
            "|------|-------|------|---------|---------|----------|",
          ];

          for (const item of scored.slice(0, 20)) {
            const b = item.breakdown;
            const anchorMark = item.metadata.anchored ? "⚓ " : "";
            lines.push(
              `| ${anchorMark}${item.id.slice(0, 30)} | ${Math.round(item.finalScore)} | ${b.frequency} | ${b.recency} | ${b.utility} | ${item.metadata.mentionCount} |`,
            );
          }

          if (scored.length > 20) {
            lines.push(`\n... and ${scored.length - 20} more items`);
          }

          return { text: lines.join("\n") };
        }

        // Anchor an item
        if (cmd === "anchor") {
          const itemId = rest.join(" ").trim();
          if (!itemId) {
            return { text: "❌ Usage: /clarity anchor <item-id>" };
          }
          tracker.anchorItem(itemId, "user-command");
          tracker.persist();
          return { text: `✅ Anchored: ${itemId}` };
        }

        // Unanchor an item
        if (cmd === "unanchor") {
          const itemId = rest.join(" ").trim();
          if (!itemId) {
            return { text: "❌ Usage: /clarity unanchor <item-id>" };
          }
          tracker.unanchorItem(itemId);
          tracker.persist();
          return { text: `✅ Unanchored: ${itemId}` };
        }

        // Trigger pruning
        if (cmd === "prune") {
          const result = pruner.prune({ strictMode: config.strictMode });
          tracker.persist();
          return {
            text: [
              `✂️ **Clarity Pruning Results**`,
              `Evaluated: ${result.stats.totalEvaluated}`,
              `Keeping: ${result.stats.keeping}`,
              `Pruned: ${result.stats.pruning}`,
              `Anchored preserved: ${result.stats.anchoredKept}`,
              "",
              "Pruned items:",
              ...result.prunedIds.slice(0, 10).map((id) => `  - ${id}`),
              result.prunedIds.length > 10 ? `  ... and ${result.prunedIds.length - 10} more` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          };
        }

        // Show stats
        if (cmd === "stats") {
          const stats = tracker.getStats();
          const scorerConfig = tracker.scorer.getConfig();

          return {
            text: [
              `📈 **Clarity Statistics**`,
              "",
              `**Tracking:**`,
              `  Total items: ${stats.totalItems}`,
              `  Anchored: ${stats.anchoredItems}`,
              `  Current turn: ${stats.currentTurn}`,
              `  Average mentions/item: ${Math.round(stats.averageMentions * 10) / 10}`,
              `  Average score: ${Math.round(stats.averageScore * 10) / 10}`,
              "",
              `**Scoring Config:**`,
              `  Half-life: ${scorerConfig.halfLife} turns`,
              `  Recency window: ${scorerConfig.recencyWindow} turns`,
              `  Recency bonus: ${scorerConfig.recencyBonus}`,
              `  Reference weight: ${scorerConfig.referenceWeight}`,
              `  Anchor bonus: ${scorerConfig.anchorBonus}`,
              "",
              `**Top 5 Items:**`,
              ...stats.topItems.map(
                (i, idx) =>
                  `  ${idx + 1}. ${i.anchored ? "⚓ " : ""}${i.id} (score: ${i.score}, mentions: ${i.mentions})`,
              ),
            ].join("\n"),
          };
        }

        // Show config
        if (cmd === "config") {
          return {
            text: [
              `⚙️ **Clarity Configuration**`,
              "",
              `Enabled: ${config.enabled}`,
              `Strict mode: ${config.strictMode}`,
              "",
              `**Scoring:**`,
              JSON.stringify(config.scoring, null, 2),
              "",
              `**Pruning:**`,
              JSON.stringify(config.pruning, null, 2),
            ].join("\n"),
          };
        }

        return {
          text: `❌ Unknown command: ${cmd}\n\nCommands: scores, anchor <item>, unanchor <item>, prune, stats, config`,
        };
      },
    });

    // -------------------------------------------------------------------
    // Gateway methods
    // -------------------------------------------------------------------

    api.registerGatewayMethod("clarity.getState", async ({ respond }) => {
      const stats = tracker.getStats();
      respond(true, {
        currentTurn: tracker._currentTurn,
        itemCount: tracker._items.size,
        items: [...tracker._items.entries()].map(([id, data]) => ({ id, ...data })),
        stats,
      });
    });

    api.registerGatewayMethod("clarity.getScores", async ({ respond }) => {
      const scored = tracker.getScoredItems();
      respond(true, { scores: scored });
    });

    api.registerGatewayMethod("clarity.anchor", async ({ params, respond }) => {
      const itemId = params?.itemId || params?.id;
      if (!itemId) {
        respond(false, null, { message: "itemId required" });
        return;
      }
      tracker.anchorItem(itemId, params?.reason || "api");
      tracker.persist();
      respond(true, { anchored: itemId });
    });

    api.registerGatewayMethod("clarity.unanchor", async ({ params, respond }) => {
      const itemId = params?.itemId || params?.id;
      if (!itemId) {
        respond(false, null, { message: "itemId required" });
        return;
      }
      tracker.unanchorItem(itemId);
      tracker.persist();
      respond(true, { unanchored: itemId });
    });

    api.registerGatewayMethod("clarity.prune", async ({ params, respond }) => {
      const result = pruner.prune({
        strictMode: params?.strictMode ?? config.strictMode,
      });
      tracker.persist();
      respond(true, result);
    });

    api.registerGatewayMethod("clarity.stats", async ({ respond }) => {
      respond(true, tracker.getStats());
    });

    api.registerGatewayMethod("clarity.config", async ({ respond }) => {
      respond(true, {
        config,
        scorerConfig: tracker.scorer.getConfig(),
        prunerConfig: pruner.getConfig(),
      });
    });

    // -------------------------------------------------------------------
    // Startup
    // -------------------------------------------------------------------

    api.logger.info(
      `Clarity v1.0 registered — relevance scoring: half-life=${config.scoring.halfLife}t, ` +
        `strict=${config.strictMode}, ${tracker._items.size} items loaded`,
    );
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _extractText(msg) {
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.map((c) => c.text || c.content || "").join(" ");
  }
  return String(msg.content || "");
}
