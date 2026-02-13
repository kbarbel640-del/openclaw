/**
 * Atom Feedback Loop Extension
 *
 * Captures, stores, and processes user feedback to continuously improve Atom.
 *
 * Feedback types:
 *   - Explicit: user says "good", "bad", "I like/don't like", thumbs up/down
 *   - Corrective: user corrects a mistake ("actually it's X, not Y")
 *   - Preference: user states a preference ("I prefer X over Y")
 *   - Implicit: user re-does something Atom did (implies dissatisfaction)
 *
 * Pipeline: capture → classify → store as preference/lesson → update skill ratings
 *
 * Tools:
 *   feedback_record      — Record explicit feedback on a task/output
 *   feedback_correct     — Record a correction (Atom was wrong)
 *   feedback_preference  — Record a user preference
 *   feedback_stats       — View feedback statistics and trends
 *   feedback_lessons     — Extract lessons from recent feedback
 */

const QDRANT_URL = "http://localhost:6333";
const OLLAMA_URL = "http://localhost:11434";
const MEMORIES_COLLECTION = "memories";
const SKILLS_COLLECTION = "atom_skills";
const FEEDBACK_COLLECTION = "atom_feedback";
const DIMENSION = 768;

// ============================================================================
// Infrastructure
// ============================================================================

async function embed(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", input: text }),
  });
  return (await res.json()).embeddings[0];
}

async function ensureCollection() {
  const check = await fetch(`${QDRANT_URL}/collections/${FEEDBACK_COLLECTION}`);
  if (check.ok) return;
  await fetch(`${QDRANT_URL}/collections/${FEEDBACK_COLLECTION}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vectors: { size: DIMENSION, distance: "Cosine" } }),
  });
}

async function qdrantUpsert(collection, id, vector, payload) {
  await fetch(`${QDRANT_URL}/collections/${collection}/points`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: [{ id, vector, payload }] }),
  });
}

async function qdrantScroll(collection, filter, limit = 50) {
  const res = await fetch(`${QDRANT_URL}/collections/${collection}/points/scroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: filter || undefined,
      limit,
      with_payload: true,
      with_vector: false,
    }),
  });
  return (await res.json()).result?.points || [];
}

async function qdrantSearch(collection, vector, filter, limit = 5) {
  const res = await fetch(`${QDRANT_URL}/collections/${collection}/points/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vector, limit, with_payload: true, filter: filter || undefined }),
  });
  return (await res.json()).result || [];
}

async function qdrantUpdate(collection, id, payload) {
  await fetch(`${QDRANT_URL}/collections/${collection}/points/payload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: [id], payload }),
  });
}

function uuid() {
  return crypto.randomUUID();
}

// ============================================================================
// Plugin export
// ============================================================================

export default {
  id: "atom-feedback",
  name: "Atom Feedback Loop",
  description: "Capture and process user feedback for continuous improvement",
  kind: "tool",

  register(api) {
    api.logger.info("atom-feedback: registering");

    let collectionReady = null;
    function ready() {
      if (!collectionReady) collectionReady = ensureCollection();
      return collectionReady;
    }

    // ========================================================================
    // feedback_record — Record explicit feedback
    // ========================================================================
    api.registerTool(
      {
        name: "feedback_record",
        label: "Record Feedback",
        description:
          "Record user feedback on Atom's output. Use when the user expresses satisfaction " +
          "or dissatisfaction. Automatically updates skill ratings if a skill was used.",
        parameters: {
          type: "object",
          properties: {
            sentiment: {
              type: "string",
              enum: ["positive", "negative", "neutral"],
              description: "Was the user happy with the output?",
            },
            context: {
              type: "string",
              description: "What was Atom doing when the feedback was given?",
            },
            feedback_text: {
              type: "string",
              description: "The user's actual words or a summary",
            },
            skill_id: {
              type: "string",
              description: "If a skill was used, provide its ID to update its rating",
            },
            domain: {
              type: "string",
              enum: ["canvas", "code", "email", "research", "system", "business", "general"],
              description: "Domain of the task",
            },
          },
          required: ["sentiment", "context"],
        },
        async execute(_callId, params) {
          try {
            await ready();
            const id = uuid();
            const now = new Date().toISOString();

            const searchText = `${params.context} ${params.feedback_text || ""}`;
            const vector = await embed(searchText);

            // Store feedback
            await qdrantUpsert(FEEDBACK_COLLECTION, id, vector, {
              feedback_sentiment: params.sentiment,
              feedback_context: params.context,
              feedback_text: params.feedback_text || "",
              feedback_domain: params.domain || "general",
              feedback_skill_id: params.skill_id || null,
              created_at: now,
            });

            // Also store as memory for long-term recall
            const memoryText =
              params.sentiment === "positive"
                ? `User was happy with: ${params.context}. ${params.feedback_text || ""}`
                : params.sentiment === "negative"
                  ? `User was unhappy with: ${params.context}. ${params.feedback_text || ""}. Avoid this approach.`
                  : `User feedback on: ${params.context}. ${params.feedback_text || ""}`;

            const memId = uuid();
            await qdrantUpsert(MEMORIES_COLLECTION, memId, vector, {
              memory: memoryText,
              user_id: "eli",
              source: "feedback",
              type: "feedback",
              feedback_sentiment: params.sentiment,
              created_at: now,
            });

            // Update skill rating if provided
            if (params.skill_id) {
              try {
                const updatePayload =
                  params.sentiment === "positive"
                    ? { skill_pass_count: 1 } // Will need to increment
                    : params.sentiment === "negative"
                      ? { skill_fail_count: 1 }
                      : {};

                if (Object.keys(updatePayload).length > 0) {
                  // Fetch current counts and increment
                  const res = await fetch(`${QDRANT_URL}/collections/${SKILLS_COLLECTION}/points`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids: [params.skill_id], with_payload: true }),
                  });
                  const skillData = (await res.json()).result || [];
                  if (skillData.length > 0) {
                    const current = skillData[0].payload;
                    const updates = {};
                    if (params.sentiment === "positive") {
                      updates.skill_pass_count = (current.skill_pass_count || 0) + 1;
                      updates.skill_use_count = (current.skill_use_count || 0) + 1;
                    } else if (params.sentiment === "negative") {
                      updates.skill_fail_count = (current.skill_fail_count || 0) + 1;
                      updates.skill_use_count = (current.skill_use_count || 0) + 1;
                    }
                    await qdrantUpdate(SKILLS_COLLECTION, params.skill_id, updates);
                  }
                }
              } catch (e) {
                // Non-critical, log and continue
              }
            }

            return {
              content: [
                {
                  type: "text",
                  text:
                    `Feedback recorded: ${params.sentiment} — "${params.context.slice(0, 80)}"` +
                    (params.skill_id ? ` (skill rating updated)` : "") +
                    ` (id: ${id})`,
                },
              ],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "feedback_record" },
    );

    // ========================================================================
    // feedback_correct — Record a correction
    // ========================================================================
    api.registerTool(
      {
        name: "feedback_correct",
        label: "Record Correction",
        description:
          "Record when the user corrects Atom. Stores the correction as a high-priority " +
          "memory to prevent the same mistake.",
        parameters: {
          type: "object",
          properties: {
            wrong: { type: "string", description: "What Atom said/did that was wrong" },
            correct: { type: "string", description: "What the correct answer/action is" },
            context: { type: "string", description: "Surrounding context" },
          },
          required: ["wrong", "correct"],
        },
        async execute(_callId, params) {
          try {
            await ready();
            const id = uuid();
            const now = new Date().toISOString();

            const correctionText =
              `CORRECTION: Atom said "${params.wrong}" but the correct answer is "${params.correct}".` +
              (params.context ? ` Context: ${params.context}` : "");
            const vector = await embed(correctionText);

            // Store in feedback collection
            await qdrantUpsert(FEEDBACK_COLLECTION, id, vector, {
              feedback_sentiment: "correction",
              feedback_context: params.context || "",
              feedback_text: correctionText,
              feedback_domain: "general",
              feedback_wrong: params.wrong,
              feedback_correct: params.correct,
              created_at: now,
            });

            // Store as high-priority memory
            const memId = uuid();
            await qdrantUpsert(MEMORIES_COLLECTION, memId, vector, {
              memory: correctionText,
              user_id: "eli",
              source: "correction",
              type: "correction",
              created_at: now,
            });

            return {
              content: [
                {
                  type: "text",
                  text: `Correction stored: "${params.wrong}" → "${params.correct}" (id: ${id})`,
                },
              ],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "feedback_correct" },
    );

    // ========================================================================
    // feedback_preference — Record a preference
    // ========================================================================
    api.registerTool(
      {
        name: "feedback_preference",
        label: "Record Preference",
        description:
          "Record a user preference. Stored as a durable memory that influences future behavior.",
        parameters: {
          type: "object",
          properties: {
            preference: {
              type: "string",
              description: "The preference (e.g. 'prefers concise responses')",
            },
            domain: {
              type: "string",
              enum: [
                "canvas",
                "code",
                "email",
                "research",
                "system",
                "business",
                "communication",
                "general",
              ],
              description: "What domain this preference applies to",
            },
            strength: {
              type: "string",
              enum: ["strong", "moderate", "mild"],
              description: "How strongly the user feels about this",
            },
          },
          required: ["preference"],
        },
        async execute(_callId, params) {
          try {
            await ready();
            const id = uuid();
            const now = new Date().toISOString();

            const prefText = `Eli's preference [${params.domain || "general"}]: ${params.preference}`;
            const vector = await embed(prefText);

            // Store in feedback collection
            await qdrantUpsert(FEEDBACK_COLLECTION, id, vector, {
              feedback_sentiment: "preference",
              feedback_context: params.preference,
              feedback_text: prefText,
              feedback_domain: params.domain || "general",
              feedback_strength: params.strength || "moderate",
              created_at: now,
            });

            // Store as memory
            const memId = uuid();
            await qdrantUpsert(MEMORIES_COLLECTION, memId, vector, {
              memory: prefText,
              user_id: "eli",
              source: "preference",
              type: "preference",
              preference_domain: params.domain || "general",
              preference_strength: params.strength || "moderate",
              created_at: now,
            });

            return {
              content: [
                {
                  type: "text",
                  text: `Preference stored: "${params.preference}" [${params.domain || "general"}, ${params.strength || "moderate"}] (id: ${id})`,
                },
              ],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "feedback_preference" },
    );

    // ========================================================================
    // feedback_stats — View feedback statistics
    // ========================================================================
    api.registerTool(
      {
        name: "feedback_stats",
        label: "Feedback Statistics",
        description:
          "View feedback statistics — sentiment breakdown, correction count, top domains.",
        parameters: {
          type: "object",
          properties: {
            domain: { type: "string", description: "Filter by domain" },
            limit: { type: "number", description: "Max entries to analyze (default 100)" },
          },
        },
        async execute(_callId, params) {
          try {
            await ready();

            const filter = params.domain
              ? { must: [{ key: "feedback_domain", match: { value: params.domain } }] }
              : null;
            const points = await qdrantScroll(FEEDBACK_COLLECTION, filter, params.limit || 100);

            if (points.length === 0) {
              return { content: [{ type: "text", text: "No feedback recorded yet." }] };
            }

            // Aggregate
            const sentiments = {};
            const domains = {};
            const recent = [];

            for (const pt of points) {
              const p = pt.payload;
              sentiments[p.feedback_sentiment] = (sentiments[p.feedback_sentiment] || 0) + 1;
              domains[p.feedback_domain] = (domains[p.feedback_domain] || 0) + 1;
            }

            // Get 5 most recent
            const sorted = points
              .sort((a, b) =>
                (b.payload.created_at || "").localeCompare(a.payload.created_at || ""),
              )
              .slice(0, 5);

            let text = `## Feedback Statistics (${points.length} total)\n\n`;
            text += `### Sentiment\n`;
            for (const [s, c] of Object.entries(sentiments).sort((a, b) => b[1] - a[1])) {
              text += `  ${s}: ${c}\n`;
            }
            text += `\n### Domains\n`;
            for (const [d, c] of Object.entries(domains).sort((a, b) => b[1] - a[1])) {
              text += `  ${d}: ${c}\n`;
            }
            text += `\n### Recent Feedback\n`;
            for (const pt of sorted) {
              const p = pt.payload;
              text += `  [${p.feedback_sentiment}] ${p.feedback_context?.slice(0, 80)} — ${p.created_at?.slice(0, 16)}\n`;
            }

            // Calculate satisfaction rate
            const pos = sentiments.positive || 0;
            const neg = sentiments.negative || 0;
            const total = pos + neg;
            if (total > 0) {
              text += `\n### Satisfaction Rate: ${((pos / total) * 100).toFixed(0)}% (${pos} positive / ${total} rated)`;
            }

            return { content: [{ type: "text", text }] };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "feedback_stats" },
    );

    // ========================================================================
    // feedback_lessons — Extract lessons from feedback patterns
    // ========================================================================
    api.registerTool(
      {
        name: "feedback_lessons",
        label: "Extract Feedback Lessons",
        description:
          "Analyze recent feedback to extract patterns and actionable lessons. " +
          "Useful for periodic self-review.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "How many feedback entries to analyze (default 50)",
            },
          },
        },
        async execute(_callId, params) {
          try {
            await ready();
            const points = await qdrantScroll(FEEDBACK_COLLECTION, null, params.limit || 50);

            if (points.length < 3) {
              return {
                content: [
                  {
                    type: "text",
                    text: "Not enough feedback to extract lessons (need at least 3).",
                  },
                ],
              };
            }

            // Group by type
            const corrections = points.filter((p) => p.payload.feedback_sentiment === "correction");
            const negatives = points.filter((p) => p.payload.feedback_sentiment === "negative");
            const positives = points.filter((p) => p.payload.feedback_sentiment === "positive");
            const preferences = points.filter((p) => p.payload.feedback_sentiment === "preference");

            let lessons = "## Lessons from Feedback\n\n";

            if (corrections.length > 0) {
              lessons += `### Corrections (${corrections.length})\n`;
              lessons += "Things Atom got wrong — avoid repeating:\n";
              for (const c of corrections.slice(0, 10)) {
                const p = c.payload;
                lessons += `- ${p.feedback_wrong || ""} → ${p.feedback_correct || p.feedback_text?.slice(0, 100) || ""}\n`;
              }
              lessons += "\n";
            }

            if (negatives.length > 0) {
              lessons += `### Negative Feedback (${negatives.length})\n`;
              lessons += "Approaches that didn't work:\n";
              for (const n of negatives.slice(0, 10)) {
                lessons += `- ${n.payload.feedback_context?.slice(0, 100)}: ${n.payload.feedback_text?.slice(0, 100) || "no details"}\n`;
              }
              lessons += "\n";
            }

            if (positives.length > 0) {
              lessons += `### Positive Feedback (${positives.length})\n`;
              lessons += "What worked well — do more of this:\n";
              for (const p of positives.slice(0, 10)) {
                lessons += `- ${p.payload.feedback_context?.slice(0, 100)}\n`;
              }
              lessons += "\n";
            }

            if (preferences.length > 0) {
              lessons += `### Preferences (${preferences.length})\n`;
              for (const p of preferences.slice(0, 10)) {
                lessons += `- [${p.payload.feedback_domain}] ${p.payload.feedback_context?.slice(0, 100)}\n`;
              }
            }

            return { content: [{ type: "text", text: lessons }] };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "feedback_lessons" },
    );

    api.logger.info("atom-feedback: all tools registered");
  },
};
