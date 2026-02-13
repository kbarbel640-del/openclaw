/**
 * Atom Skill Library Extension
 *
 * Voyager-pattern skill library for compounding knowledge across sessions.
 * Skills are verified executable patterns stored in Qdrant with semantic retrieval.
 *
 * Backend: Qdrant vector DB + Ollama embeddings (same stack as Mem0/entities)
 * Collection: atom_skills (separate from memories)
 *
 * Tools:
 *   skill_store   — Save a verified skill after successful task completion
 *   skill_search  — Retrieve relevant skills for a new task (semantic search)
 *   skill_get     — Get full skill details by ID
 *   skill_list    — List all skills, optionally filtered by domain
 *   skill_update  — Update a skill (new version, add lesson, update rubric)
 *   skill_delete  — Remove a skill
 */

const QDRANT_URL = "http://localhost:6333";
const OLLAMA_URL = "http://localhost:11434";
const COLLECTION = "atom_skills";
const DIMENSION = 768;

// ============================================================================
// Qdrant helpers
// ============================================================================

async function embed(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", input: text }),
  });
  const data = await res.json();
  return data.embeddings[0];
}

async function ensureCollection() {
  // Check if collection exists
  const check = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`);
  if (check.ok) return;

  // Create collection
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vectors: { size: DIMENSION, distance: "Cosine" },
    }),
  });
  if (!res.ok) throw new Error(`Failed to create collection: ${await res.text()}`);
}

async function qdrantUpsert(id, vector, payload) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: [{ id, vector, payload }] }),
  });
  return (await res.json()).status;
}

async function qdrantSearch(vector, filter, limit = 5) {
  const body = { vector, limit, with_payload: true, filter: filter || undefined };
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()).result || [];
}

async function qdrantGet(ids) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, with_payload: true }),
  });
  return (await res.json()).result || [];
}

async function qdrantScroll(filter, limit = 100) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/scroll`, {
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

async function qdrantUpdate(id, payload) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/payload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: [id], payload }),
  });
  return (await res.json()).status;
}

async function qdrantDelete(ids) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: ids }),
  });
  return (await res.json()).status;
}

function uuid() {
  return crypto.randomUUID();
}

// ============================================================================
// Plugin export
// ============================================================================

export default {
  id: "atom-skills",
  name: "Atom Skill Library",
  description: "Voyager-pattern skill library — store, retrieve, compose verified skills",
  kind: "tool",

  register(api) {
    api.logger.info("atom-skills: registering (Qdrant backend)");

    // Ensure collection on first use
    let collectionReady = null;
    function ready() {
      if (!collectionReady) collectionReady = ensureCollection();
      return collectionReady;
    }

    // ========================================================================
    // skill_store — Save a verified skill
    // ========================================================================
    api.registerTool(
      {
        name: "skill_store",
        label: "Store Skill",
        description:
          "Save a verified, working skill to the library. Call this after a task succeeds and passes evaluation. " +
          "The skill becomes retrievable for future similar tasks.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Short skill name (e.g. 'canvas-animated-face', 'email-draft-business')",
            },
            description: {
              type: "string",
              description: "What this skill does — used for semantic search retrieval",
            },
            domain: {
              type: "string",
              enum: ["canvas", "code", "email", "research", "system", "business", "general"],
              description: "Skill domain for filtering",
            },
            code: {
              type: "string",
              description: "The working code/template that implements this skill",
            },
            rubric: {
              type: "string",
              description:
                "Binary evaluation rubric (PASS/FAIL criteria) used to verify this skill works",
            },
            prerequisites: {
              type: "string",
              description: "What must be available for this skill to work (tools, services, etc.)",
            },
            lessons: {
              type: "array",
              items: { type: "string" },
              description: "Lessons learned while building/refining this skill",
            },
          },
          required: ["name", "description", "domain", "code"],
        },
        async execute(_id, params) {
          try {
            await ready();
            const id = uuid();
            const now = new Date().toISOString();

            // Embed the description + name for retrieval
            const searchText = `${params.name}: ${params.description}`;
            const vector = await embed(searchText);

            const payload = {
              skill_name: params.name,
              skill_description: params.description,
              skill_domain: params.domain,
              skill_code: params.code,
              skill_rubric: params.rubric || "",
              skill_prerequisites: params.prerequisites || "",
              skill_lessons: JSON.stringify(params.lessons || []),
              skill_version: 1,
              skill_use_count: 0,
              skill_pass_count: 0,
              skill_fail_count: 0,
              created_at: now,
              updated_at: now,
            };

            await qdrantUpsert(id, vector, payload);

            return {
              content: [
                {
                  type: "text",
                  text:
                    `Skill stored: "${params.name}" [${params.domain}] (id: ${id})\n` +
                    `Description: ${params.description}\n` +
                    `Lessons: ${(params.lessons || []).length}\n` +
                    `Rubric: ${params.rubric ? "yes" : "none"}`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Failed to store skill: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "skill_store" },
    );

    // ========================================================================
    // skill_search — Retrieve skills for a new task
    // ========================================================================
    api.registerTool(
      {
        name: "skill_search",
        label: "Search Skills",
        description:
          "Search the skill library for relevant prior knowledge. Use before starting a new task " +
          "to find existing skills, patterns, and lessons that might help.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Describe the task you need skills for",
            },
            domain: {
              type: "string",
              enum: ["canvas", "code", "email", "research", "system", "business", "general"],
              description: "Filter by domain (optional)",
            },
            limit: {
              type: "number",
              description: "Max results (default 5)",
            },
          },
          required: ["query"],
        },
        async execute(_id, params) {
          try {
            await ready();
            const vector = await embed(params.query);
            const filter = params.domain
              ? { must: [{ key: "skill_domain", match: { value: params.domain } }] }
              : null;
            const results = await qdrantSearch(vector, filter, params.limit || 5);

            if (results.length === 0) {
              return { content: [{ type: "text", text: "No matching skills found." }] };
            }

            const text = results.map((r) => {
              const p = r.payload;
              const lessons = JSON.parse(p.skill_lessons || "[]");
              const stats = `v${p.skill_version} | used ${p.skill_use_count}x | pass rate: ${
                p.skill_use_count > 0
                  ? ((p.skill_pass_count / p.skill_use_count) * 100).toFixed(0) + "%"
                  : "n/a"
              }`;
              return (
                `### ${p.skill_name} [${p.skill_domain}] (score: ${(r.score * 100).toFixed(0)}%)\n` +
                `**Description:** ${p.skill_description}\n` +
                `**Stats:** ${stats}\n` +
                (p.skill_rubric ? `**Rubric:** ${p.skill_rubric.slice(0, 200)}\n` : "") +
                (lessons.length > 0
                  ? `**Lessons:** ${lessons.map((l) => `- ${l}`).join("\n")}\n`
                  : "") +
                `**Code preview:** ${p.skill_code.slice(0, 300)}...\n` +
                `(id: ${r.id})`
              );
            });

            return {
              content: [
                {
                  type: "text",
                  text: `Found ${results.length} relevant skills:\n\n${text.join("\n\n---\n\n")}`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Search failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "skill_search" },
    );

    // ========================================================================
    // skill_get — Full skill details
    // ========================================================================
    api.registerTool(
      {
        name: "skill_get",
        label: "Get Skill",
        description: "Retrieve full details of a specific skill by ID, including complete code.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "Skill ID" },
          },
          required: ["id"],
        },
        async execute(_id, params) {
          try {
            await ready();
            const points = await qdrantGet([params.id]);
            if (points.length === 0) {
              return { content: [{ type: "text", text: "Skill not found." }], isError: true };
            }

            const p = points[0].payload;
            const lessons = JSON.parse(p.skill_lessons || "[]");

            const text =
              `# ${p.skill_name} [${p.skill_domain}]\n\n` +
              `**Description:** ${p.skill_description}\n` +
              `**Version:** ${p.skill_version}\n` +
              `**Prerequisites:** ${p.skill_prerequisites || "none"}\n` +
              `**Stats:** used ${p.skill_use_count}x | pass: ${p.skill_pass_count} | fail: ${p.skill_fail_count}\n` +
              `**Created:** ${p.created_at}\n` +
              `**Updated:** ${p.updated_at}\n\n` +
              `## Rubric\n${p.skill_rubric || "No rubric defined."}\n\n` +
              `## Code\n\`\`\`\n${p.skill_code}\n\`\`\`\n\n` +
              `## Lessons Learned\n${lessons.length > 0 ? lessons.map((l) => `- ${l}`).join("\n") : "None yet."}`;

            // Increment use count
            await qdrantUpdate(params.id, {
              skill_use_count: (p.skill_use_count || 0) + 1,
            });

            return { content: [{ type: "text", text }] };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "skill_get" },
    );

    // ========================================================================
    // skill_list — List all skills
    // ========================================================================
    api.registerTool(
      {
        name: "skill_list",
        label: "List Skills",
        description: "List all skills in the library, optionally filtered by domain.",
        parameters: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              enum: ["canvas", "code", "email", "research", "system", "business", "general"],
              description: "Filter by domain",
            },
          },
        },
        async execute(_id, params) {
          try {
            await ready();
            const filter = params.domain
              ? { must: [{ key: "skill_domain", match: { value: params.domain } }] }
              : null;
            const points = await qdrantScroll(filter);

            if (points.length === 0) {
              return { content: [{ type: "text", text: "No skills in library." }] };
            }

            const text = points
              .sort((a, b) => (b.payload.skill_use_count || 0) - (a.payload.skill_use_count || 0))
              .map((pt) => {
                const p = pt.payload;
                const passRate =
                  p.skill_use_count > 0
                    ? ((p.skill_pass_count / p.skill_use_count) * 100).toFixed(0) + "%"
                    : "n/a";
                return `• **${p.skill_name}** [${p.skill_domain}] v${p.skill_version} — used ${p.skill_use_count}x (${passRate}) — ${p.skill_description.slice(0, 80)} (id: ${pt.id})`;
              });

            return {
              content: [{ type: "text", text: `${points.length} skills:\n\n${text.join("\n")}` }],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "skill_list" },
    );

    // ========================================================================
    // skill_update — Update skill (new version, add lesson, record pass/fail)
    // ========================================================================
    api.registerTool(
      {
        name: "skill_update",
        label: "Update Skill",
        description:
          "Update an existing skill: bump version with new code, add lessons learned, " +
          "update rubric, or record pass/fail outcomes.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "Skill ID" },
            code: { type: "string", description: "New code (bumps version)" },
            rubric: { type: "string", description: "Updated rubric" },
            add_lesson: { type: "string", description: "A lesson to append" },
            record_pass: { type: "boolean", description: "Record a successful use" },
            record_fail: { type: "boolean", description: "Record a failed use" },
            description: { type: "string", description: "Updated description" },
          },
          required: ["id"],
        },
        async execute(_id, params) {
          try {
            await ready();
            const points = await qdrantGet([params.id]);
            if (points.length === 0) {
              return { content: [{ type: "text", text: "Skill not found." }], isError: true };
            }

            const existing = points[0].payload;
            const updates = { updated_at: new Date().toISOString() };

            if (params.code) {
              updates.skill_code = params.code;
              updates.skill_version = (existing.skill_version || 1) + 1;
            }
            if (params.rubric) {
              updates.skill_rubric = params.rubric;
            }
            if (params.description) {
              updates.skill_description = params.description;
              // Re-embed with new description
              const searchText = `${existing.skill_name}: ${params.description}`;
              const vector = await embed(searchText);
              // Need full upsert for vector change
              await qdrantUpsert(params.id, vector, { ...existing, ...updates });
              return {
                content: [
                  {
                    type: "text",
                    text: `Skill "${existing.skill_name}" updated (re-embedded with new description).`,
                  },
                ],
              };
            }
            if (params.add_lesson) {
              const lessons = JSON.parse(existing.skill_lessons || "[]");
              lessons.push(params.add_lesson);
              updates.skill_lessons = JSON.stringify(lessons);
            }
            if (params.record_pass) {
              updates.skill_pass_count = (existing.skill_pass_count || 0) + 1;
              updates.skill_use_count = (existing.skill_use_count || 0) + 1;
            }
            if (params.record_fail) {
              updates.skill_fail_count = (existing.skill_fail_count || 0) + 1;
              updates.skill_use_count = (existing.skill_use_count || 0) + 1;
            }

            await qdrantUpdate(params.id, updates);

            const changes = [];
            if (params.code) changes.push(`v${updates.skill_version}`);
            if (params.rubric) changes.push("rubric");
            if (params.add_lesson) changes.push("lesson");
            if (params.record_pass) changes.push("pass recorded");
            if (params.record_fail) changes.push("fail recorded");

            return {
              content: [
                {
                  type: "text",
                  text: `Skill "${existing.skill_name}" updated: ${changes.join(", ")}`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Update failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "skill_update" },
    );

    // ========================================================================
    // skill_delete — Remove a skill
    // ========================================================================
    api.registerTool(
      {
        name: "skill_delete",
        label: "Delete Skill",
        description: "Remove a skill from the library.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "Skill ID to delete" },
          },
          required: ["id"],
        },
        async execute(_id, params) {
          try {
            await ready();
            const points = await qdrantGet([params.id]);
            if (points.length === 0) {
              return { content: [{ type: "text", text: "Skill not found." }], isError: true };
            }

            const name = points[0].payload.skill_name;
            await qdrantDelete([params.id]);

            return {
              content: [{ type: "text", text: `Deleted skill: "${name}"` }],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Delete failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "skill_delete" },
    );

    api.logger.info("atom-skills: all tools registered");
  },
};
