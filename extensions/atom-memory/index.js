/**
 * Atom Memory Plugin v3
 *
 * PostgreSQL + pgvector semantic memory with auto-recall and auto-capture.
 * Connects to the atom-memory-service running on localhost:11438.
 *
 * Hooks use api.on("before_agent_start") and api.on("agent_end") — the correct
 * OpenClaw plugin lifecycle hooks (NOT registerHook with made-up event names).
 * Reference implementation: extensions/memory-lancedb/index.ts
 */

const MEMORY_CATEGORIES = ["fact", "episode", "insight", "correction"];

// ==========================================================================
// Auto-capture filters (loosened Feb 9, 2026)
// ==========================================================================

const EXPLICIT_MEMORY_TRIGGERS = [
  /\b(remember|don't forget|keep in mind|note that|for (the |my )?record)\b/i,
  /\b(save this|store this|log this|write this down)\b/i,
];

const PERSONAL_FACT_TRIGGERS = [
  /\bmy\s+(name|wife|husband|daughter|son|birthday|address|phone|email|job|company|salary|password)\s+(is|was)\b/i,
  /\b(born|birthday)\s+(on|in|is)\b/i,
  /\b(i|we)\s+(live|moved|work|worked)\s+(in|at|to|for)\b/i,
  /\b(jenna|savannah|emberly|eden)\b.*\b(is|was|has|had|will|said|told|wants|needs|likes)\b/i,
];

const PREFERENCE_TRIGGERS = [
  /\bi\s+(always|never)\s+\w+\s+\w+/i,
  /\bi\s+(prefer|hate|can't stand|love)\s+\w+/i,
  /\b(decided to|switching to|going with|from now on|moving to)\b.*\b(for|because|instead)\b/i,
];

const STRUCTURED_DATA_TRIGGERS = [
  /\+\d{10,}/,
  /[\w.-]+@[\w.-]+\.\w{2,}/,
  /\b(account|routing)\s*(number|#|num)\b/i,
];

const DIRECTIVE_TRIGGERS = [
  /\b(option \d|do both|start with|priority|highest priority|#1 priority)\b/i,
  /\b(the plan is|here's what|let's do|going forward|the approach)\b/i,
  /\b(don't|stop|quit|never again|no more)\s+\w+ing\b/i,
  /\b(need to|have to|must|should)\s+\w+/i,
];

const NOISE_PATTERNS = [
  /^<relevant-memories>/,
  /^HEARTBEAT_OK$/i,
  /^NO_REPLY$/,
  /^System:\s*\[/, // System messages (gateway restarts, node connects)
  /GatewayRestart:/, // Restart notifications
  /\bNode:.*Mac mini/, // Node connect messages
  /\bmessage_id:\s*[a-f0-9-]+\]$/i, // Bare message IDs
  /^Read HEARTBEAT\.md/, // Heartbeat prompts
  /^Pre-compaction memory flush/, // Compaction prompts
];

function shouldCapture(text) {
  if (text.length < 30 || text.length > 2000) return false;
  if (
    /^(ok|yeah|yes|no|thanks|sure|got it|cool|nice|lol|haha|hmm|idk|nvm|k|ty|np)$/i.test(
      text.trim(),
    )
  )
    return false;
  if (NOISE_PATTERNS.some((r) => r.test(text))) return false;

  if (EXPLICIT_MEMORY_TRIGGERS.some((r) => r.test(text))) return true;
  if (STRUCTURED_DATA_TRIGGERS.some((r) => r.test(text))) return true;
  if (PERSONAL_FACT_TRIGGERS.some((r) => r.test(text))) return true;
  if (PREFERENCE_TRIGGERS.some((r) => r.test(text))) return true;
  if (DIRECTIVE_TRIGGERS.some((r) => r.test(text))) return true;

  if (text.length > 100 && /[.!?]/.test(text)) return true;
  return false;
}

// ==========================================================================
// Helpers
// ==========================================================================

async function fetchMemoryService(path, options = {}) {
  const baseUrl = "http://localhost:11438";
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return response.json();
}

function extractTexts(messages) {
  const texts = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const role = msg.role;
    if (role !== "user" && role !== "assistant") continue;
    const content = msg.content;
    if (typeof content === "string") {
      texts.push({ role, text: content });
      continue;
    }
    if (Array.isArray(content)) {
      for (const block of content) {
        if (
          block &&
          typeof block === "object" &&
          block.type === "text" &&
          typeof block.text === "string"
        ) {
          texts.push({ role, text: block.text });
        }
      }
    }
  }
  return texts;
}

// ==========================================================================
// LLM summarization via OpenRouter (Kimi K2.5)
// ==========================================================================

const SUMMARY_MODEL = "moonshotai/kimi-k2.5";
const SUMMARY_PROMPT = `You are a memory system. Summarize this conversation in 2-4 sentences. Focus ONLY on:
1. What was DECIDED (choices made, directions chosen)
2. What was BUILT or CHANGED (code, config, files modified)
3. What's PENDING (open questions, next steps)

Skip greetings, troubleshooting steps that didn't work, and back-and-forth. Just the durable facts.
If nothing meaningful happened, reply with exactly: SKIP

Conversation:
`;

let _openrouterKey = null;

async function getOpenRouterKey() {
  if (_openrouterKey) return _openrouterKey;
  try {
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const authPath = path.default.join(
      os.default.homedir(),
      ".openclaw/agents/main/agent/auth-profiles.json",
    );
    const data = JSON.parse(await fs.default.readFile(authPath, "utf-8"));
    _openrouterKey = data.profiles?.["openrouter:default"]?.token || null;
    return _openrouterKey;
  } catch {
    return null;
  }
}

async function generateSummary(conversationText) {
  const apiKey = await getOpenRouterKey();
  if (!apiKey) return null;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://atom.local",
        "X-Title": "Atom Memory",
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        messages: [{ role: "user", content: SUMMARY_PROMPT + conversationText.slice(0, 4000) }],
        max_tokens: 300,
        temperature: 0.3,
        reasoning: { effort: "none" },
      }),
    });

    const data = await response.json();
    const msg = data.choices?.[0]?.message;
    const summary = (msg?.content || msg?.reasoning || "").trim();
    if (!summary || summary === "SKIP" || summary.length < 20) return null;
    return summary;
  } catch {
    return null;
  }
}

// ==========================================================================
// Session tracking
// ==========================================================================

const sessionExchangeCounts = new Map();
const sessionLastSummarized = new Map();
const SUMMARY_THRESHOLD = 5;
let lastHeartbeatSummary = 0;

// ==========================================================================
// Plugin
// ==========================================================================

export default {
  id: "atom-memory",
  name: "Atom Memory",
  description: "PostgreSQL + pgvector semantic memory with session summaries",
  kind: "memory",

  register(api) {
    const cfg = api.pluginConfig || {};
    const autoCapture = cfg.autoCapture !== false;
    const autoRecall = cfg.autoRecall !== false;
    const recallLimit = cfg.recallLimit || 5;
    const recallThreshold = cfg.recallThreshold || 0.35;

    api.logger.info("atom-memory v3: registered (api.on hooks, loosened filters, LLM summaries)");

    // ========================================================================
    // Tools (unchanged)
    // ========================================================================

    api.registerTool(
      {
        name: "memory_recall",
        label: "Memory Recall",
        description:
          "Search semantic memory for relevant information about past conversations, preferences, decisions, and facts.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "What to search for" },
            limit: { type: "number", description: "Max results (default: 5)" },
            type: {
              type: "string",
              description: "Filter by type: fact, episode, insight, correction",
            },
          },
          required: ["query"],
        },
        async execute(_toolCallId, params) {
          try {
            const { query, limit = 5, type } = params;
            const url = `/memories/search?q=${encodeURIComponent(query)}&limit=${limit}&threshold=${recallThreshold}${type ? `&type=${type}` : ""}`;
            const data = await fetchMemoryService(url);

            if (!data.results || data.results.length === 0) {
              return {
                content: [{ type: "text", text: "No relevant memories found." }],
                details: { count: 0 },
              };
            }

            const text = data.results
              .map(
                (m, i) =>
                  `${i + 1}. [${m.content_type}] ${m.content} (${(m.similarity * 100).toFixed(0)}% match)`,
              )
              .join("\n");

            return {
              content: [{ type: "text", text: `Found ${data.count} memories:\n\n${text}` }],
              details: { count: data.count, memories: data.results },
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Memory search failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "memory_recall" },
    );

    api.registerTool(
      {
        name: "memory_store",
        label: "Memory Store",
        description:
          "Store important information in long-term memory. Use for preferences, facts, decisions, corrections.",
        parameters: {
          type: "object",
          properties: {
            content: { type: "string", description: "Information to remember" },
            type: {
              type: "string",
              enum: MEMORY_CATEGORIES,
              description: "Memory type: fact, episode, insight, or correction",
            },
          },
          required: ["content"],
        },
        async execute(_toolCallId, params) {
          try {
            const { content, type } = params;
            const data = await fetchMemoryService("/memories", {
              method: "POST",
              body: JSON.stringify({ content, type, source: "agent" }),
            });

            return {
              content: [{ type: "text", text: `Stored memory: "${content.slice(0, 80)}..."` }],
              details: { id: data.id, type: data.content_type },
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Memory store failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "memory_store" },
    );

    api.registerTool(
      {
        name: "memory_forget",
        label: "Memory Forget",
        description: "Delete a specific memory by ID.",
        parameters: {
          type: "object",
          properties: {
            memoryId: { type: "string", description: "Memory ID to delete" },
          },
          required: ["memoryId"],
        },
        async execute(_toolCallId, params) {
          try {
            const { memoryId } = params;
            await fetchMemoryService(`/memories/${memoryId}`, { method: "DELETE" });
            return {
              content: [{ type: "text", text: `Memory ${memoryId} forgotten.` }],
              details: { deleted: memoryId },
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Memory delete failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "memory_forget" },
    );

    api.registerTool(
      {
        name: "memory_stats",
        label: "Memory Stats",
        description: "Get statistics about stored memories.",
        parameters: { type: "object", properties: {} },
        async execute() {
          try {
            const data = await fetchMemoryService("/stats");
            const byType = data.by_type.map((t) => `  ${t.content_type}: ${t.count}`).join("\n");
            return {
              content: [{ type: "text", text: `Memory stats:\n  Total: ${data.total}\n${byType}` }],
              details: data,
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Stats failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "memory_stats" },
    );

    // ========================================================================
    // Lifecycle Hooks — using api.on() with correct event names
    // Reference: extensions/memory-lancedb/index.ts
    // ========================================================================

    // --- Auto-Recall: inject relevant memories before agent starts ---
    if (autoRecall) {
      api.on("before_agent_start", async (event) => {
        const prompt = event.prompt;
        if (!prompt || prompt.length < 10) return;

        // Skip heartbeat prompts
        if (prompt.includes("HEARTBEAT_OK")) return;

        try {
          const data = await fetchMemoryService(
            `/memories/search?q=${encodeURIComponent(prompt.slice(0, 500))}&limit=${recallLimit}&threshold=${recallThreshold}`,
          );

          if (data.results && data.results.length > 0) {
            const memories = data.results
              .map((m) => `- [${m.content_type}] ${m.content}`)
              .join("\n");

            api.logger.info(`atom-memory: recalled ${data.results.length} memories`);

            return {
              prependContext: `<relevant-memories>\n${memories}\n</relevant-memories>`,
            };
          }
        } catch (err) {
          api.logger.warn(`atom-memory: recall failed: ${err.message}`);
        }
      });
    }

    // --- Auto-Capture + Session Summaries: after agent ends ---
    if (autoCapture) {
      api.on("agent_end", async (event, ctx) => {
        if (!event.success || !event.messages || event.messages.length === 0) return;

        const sessionKey = ctx?.sessionKey || "default";
        const exchangeCount = (sessionExchangeCounts.get(sessionKey) || 0) + 1;
        sessionExchangeCounts.set(sessionKey, exchangeCount);

        // --- Auto-capture matching user messages ---
        const allTexts = extractTexts(event.messages);
        const userTexts = allTexts.filter((t) => t.role === "user");
        let captured = 0;

        for (const { text } of userTexts) {
          if (shouldCapture(text)) {
            try {
              // Deduplicate: check if similar content already exists
              const existing = await fetchMemoryService(
                `/memories/search?q=${encodeURIComponent(text.slice(0, 200))}&limit=1&threshold=0.95`,
              );
              if (existing.results && existing.results.length > 0) {
                api.logger.debug(`atom-memory: skipped duplicate: "${text.slice(0, 40)}..."`);
                continue;
              }

              await fetchMemoryService("/memories", {
                method: "POST",
                body: JSON.stringify({
                  content: text,
                  source: "auto-capture",
                }),
              });
              captured++;
            } catch (err) {
              api.logger.warn(`atom-memory: capture failed: ${err.message}`);
            }
          }
        }

        if (captured > 0) {
          api.logger.info(`atom-memory: auto-captured ${captured} messages`);
        }

        // --- Session Summary: after SUMMARY_THRESHOLD exchanges ---
        if (exchangeCount >= SUMMARY_THRESHOLD) {
          const lastSummary = sessionLastSummarized.get(sessionKey) || 0;
          const now = Date.now();

          if (now - lastSummary < 10 * 60 * 1000) return; // 10 min cooldown

          try {
            const recentTexts = allTexts.slice(-20);
            if (recentTexts.length < SUMMARY_THRESHOLD * 2) return;

            const conversationText = recentTexts
              .map((t) => `${t.role}: ${t.text.slice(0, 500)}`)
              .filter((t) => t.length > 10)
              .join("\n");

            if (conversationText.length < 200) return;

            const summary = await generateSummary(conversationText);
            if (!summary) {
              api.logger.debug("atom-memory: session summary skipped (SKIP or failed)");
              sessionLastSummarized.set(sessionKey, now);
              sessionExchangeCounts.set(sessionKey, 0);
              return;
            }

            const dateStr = new Date().toISOString().split("T")[0];
            await fetchMemoryService("/memories", {
              method: "POST",
              body: JSON.stringify({
                content: `[${dateStr}] ${summary}`,
                content_type: "episode",
                source: "session-summary",
              }),
            });

            sessionLastSummarized.set(sessionKey, now);
            sessionExchangeCounts.set(sessionKey, 0);
            api.logger.info(`atom-memory: session summary stored: "${summary.slice(0, 80)}..."`);
          } catch (err) {
            api.logger.warn(`atom-memory: session summary failed: ${err.message}`);
          }
        }
      });
    }

    // --- Heartbeat Summary: check for recent activity on heartbeat ---
    if (autoCapture) {
      api.on("before_agent_start", async (event) => {
        const prompt = event.prompt;
        if (!prompt || !prompt.includes("HEARTBEAT") || !prompt.includes("HEARTBEAT_OK")) return;

        const now = Date.now();
        if (now - lastHeartbeatSummary < 25 * 60 * 1000) return; // 25 min cooldown

        let totalExchanges = 0;
        for (const [, count] of sessionExchangeCounts) {
          totalExchanges += count;
        }
        if (totalExchanges < 3) return;

        try {
          // We don't have conversation messages in before_agent_start,
          // so we generate a summary based on what we've auto-captured recently
          const recentData = await fetchMemoryService(
            `/memories/search?q=recent+conversation&limit=5&threshold=0.2`,
          );

          if (!recentData.results || recentData.results.length === 0) return;

          const recentContent = recentData.results.map((r) => r.content).join("\n");

          if (recentContent.length < 100) return;

          const summary = await generateSummary(recentContent);
          if (!summary) {
            lastHeartbeatSummary = now;
            sessionExchangeCounts.clear();
            return;
          }

          const dateStr = new Date().toISOString().split("T")[0];
          await fetchMemoryService("/memories", {
            method: "POST",
            body: JSON.stringify({
              content: `[${dateStr}] ${summary}`,
              content_type: "episode",
              source: "heartbeat-summary",
            }),
          });

          lastHeartbeatSummary = now;
          sessionExchangeCounts.clear();
          api.logger.info(`atom-memory: heartbeat summary stored: "${summary.slice(0, 80)}..."`);
        } catch (err) {
          api.logger.warn(`atom-memory: heartbeat summary failed: ${err.message}`);
        }
      });
    }

    api.logger.info(`atom-memory v3: autoRecall=${autoRecall}, autoCapture=${autoCapture}`);
  },
};
