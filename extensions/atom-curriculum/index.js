/**
 * Atom Curriculum / Self-Directed Learning Extension
 *
 * Auto-generates improvement tasks based on:
 *   - Skill gaps (domains with no/few skills)
 *   - Failure patterns (repeated eval failures in same area)
 *   - User goals (aligned to tracked goals)
 *   - Feedback trends (areas with negative feedback)
 *
 * Implements the "curriculum" concept from Voyager:
 *   progressively harder tasks that build on existing skills.
 *
 * Tools:
 *   curriculum_generate  — Generate next improvement tasks based on current state
 *   curriculum_status    — View current learning progress across domains
 *   curriculum_focus     — Set learning focus/priority
 *   curriculum_next      — Get the single highest-priority next task
 */

const QDRANT_URL = "http://localhost:6333";
const OLLAMA_URL = "http://localhost:11434";
const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_KEY = "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";
const CURRICULUM_MODEL = "moonshotai/kimi-k2.5";

const SKILLS_COLLECTION = "atom_skills";
const EVAL_COLLECTION = "atom_evaluations";
const CYCLES_COLLECTION = "atom_cycles";
const FEEDBACK_COLLECTION = "atom_feedback";
const GOALS_COLLECTION = "memories"; // goals stored in memories with source=atom-goals
const CURRICULUM_COLLECTION = "atom_curriculum";
const DIMENSION = 768;

const ALL_DOMAINS = ["canvas", "code", "email", "research", "system", "business", "general"];

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
  const check = await fetch(`${QDRANT_URL}/collections/${CURRICULUM_COLLECTION}`);
  if (check.ok) return;
  await fetch(`${QDRANT_URL}/collections/${CURRICULUM_COLLECTION}`, {
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

async function qdrantUpdate(collection, id, payload) {
  await fetch(`${QDRANT_URL}/collections/${collection}/points/payload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: [id], payload }),
  });
}

async function llmCall(model, systemPrompt, userPrompt, temperature = 0.5) {
  const res = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  return (await res.json()).choices?.[0]?.message?.content || "";
}

function uuid() {
  return crypto.randomUUID();
}

// ============================================================================
// Analysis helpers
// ============================================================================

async function getSkillCoverage() {
  const skills = await qdrantScroll(SKILLS_COLLECTION, null, 200);
  const coverage = {};
  for (const d of ALL_DOMAINS) coverage[d] = { count: 0, totalUses: 0, avgPassRate: 0, skills: [] };

  for (const pt of skills) {
    const p = pt.payload;
    const domain = p.skill_domain || "general";
    if (!coverage[domain])
      coverage[domain] = { count: 0, totalUses: 0, avgPassRate: 0, skills: [] };
    coverage[domain].count++;
    coverage[domain].totalUses += p.skill_use_count || 0;
    const uses = p.skill_use_count || 0;
    const passes = p.skill_pass_count || 0;
    coverage[domain].skills.push({
      name: p.skill_name,
      uses,
      passRate: uses > 0 ? passes / uses : 0,
    });
  }

  // Calculate avg pass rates
  for (const d of Object.keys(coverage)) {
    const skills = coverage[d].skills;
    const ratedSkills = skills.filter((s) => s.uses > 0);
    coverage[d].avgPassRate =
      ratedSkills.length > 0
        ? ratedSkills.reduce((sum, s) => sum + s.passRate, 0) / ratedSkills.length
        : 0;
  }

  return coverage;
}

async function getFailurePatterns() {
  const evals = await qdrantScroll(
    EVAL_COLLECTION,
    { must: [{ key: "eval_verdict", match: { value: "FAIL" } }] },
    50,
  );
  const patterns = {};

  for (const pt of evals) {
    const task = pt.payload.eval_task || "unknown";
    const rubric = pt.payload.eval_rubric || "unknown";
    const key = `${rubric}`;
    patterns[key] = (patterns[key] || 0) + 1;
  }

  return { failCount: evals.length, byRubric: patterns };
}

async function getGoals() {
  const goals = await qdrantScroll(
    GOALS_COLLECTION,
    { must: [{ key: "source", match: { value: "atom-goals" } }] },
    20,
  );
  return goals
    .map((pt) => ({
      description: pt.payload.goal_description || pt.payload.memory || "",
      category: pt.payload.goal_category || "general",
      priority: pt.payload.goal_priority || 5,
      status: pt.payload.goal_status || "active",
    }))
    .filter((g) => g.status === "active");
}

async function getFeedbackTrends() {
  const feedback = await qdrantScroll(FEEDBACK_COLLECTION, null, 50);
  const byDomain = {};

  for (const pt of feedback) {
    const domain = pt.payload.feedback_domain || "general";
    if (!byDomain[domain]) byDomain[domain] = { positive: 0, negative: 0, corrections: 0 };
    const sentiment = pt.payload.feedback_sentiment;
    if (sentiment === "positive") byDomain[domain].positive++;
    else if (sentiment === "negative") byDomain[domain].negative++;
    else if (sentiment === "correction") byDomain[domain].corrections++;
  }

  return byDomain;
}

// ============================================================================
// Plugin export
// ============================================================================

export default {
  id: "atom-curriculum",
  name: "Atom Curriculum",
  description: "Self-directed learning — auto-generate improvement tasks",
  kind: "tool",

  register(api) {
    api.logger.info("atom-curriculum: registering");

    let collectionReady = null;
    function ready() {
      if (!collectionReady) collectionReady = ensureCollection();
      return collectionReady;
    }

    // ========================================================================
    // curriculum_generate — Generate improvement tasks
    // ========================================================================
    api.registerTool(
      {
        name: "curriculum_generate",
        label: "Generate Curriculum",
        description:
          "Analyze current skill coverage, failure patterns, goals, and feedback " +
          "to generate the next batch of improvement tasks. Returns prioritized tasks " +
          "that build on existing skills.",
        parameters: {
          type: "object",
          properties: {
            count: { type: "number", description: "How many tasks to generate (default 5)" },
            focus_domain: {
              type: "string",
              enum: ["canvas", "code", "email", "research", "system", "business", "general"],
              description: "Focus on a specific domain (optional)",
            },
          },
        },
        async execute(_callId, params) {
          try {
            await ready();
            const count = params.count || 5;

            // Gather state
            const [coverage, failures, goals, feedbackTrends] = await Promise.all([
              getSkillCoverage(),
              getFailurePatterns(),
              getGoals(),
              getFeedbackTrends(),
            ]);

            // Build context for LLM
            let context = "## Current Skill Coverage\n";
            for (const [domain, data] of Object.entries(coverage)) {
              if (params.focus_domain && domain !== params.focus_domain) continue;
              context += `### ${domain}: ${data.count} skills, ${data.totalUses} total uses, ${(data.avgPassRate * 100).toFixed(0)}% avg pass rate\n`;
              for (const s of data.skills.slice(0, 5)) {
                context += `  - ${s.name}: ${s.uses} uses, ${(s.passRate * 100).toFixed(0)}% pass rate\n`;
              }
            }

            context += "\n## Failure Patterns\n";
            if (failures.failCount === 0) {
              context += "No failures recorded yet.\n";
            } else {
              context += `${failures.failCount} total failures.\n`;
              for (const [rubric, count] of Object.entries(failures.byRubric).sort(
                (a, b) => b[1] - a[1],
              )) {
                context += `  - ${rubric}: ${count} failures\n`;
              }
            }

            context += "\n## Active Goals\n";
            if (goals.length === 0) {
              context += "No active goals.\n";
            } else {
              for (const g of goals) {
                context += `  - [P${g.priority}] ${g.description}\n`;
              }
            }

            context += "\n## Feedback Trends\n";
            const feedbackEntries = Object.entries(feedbackTrends);
            if (feedbackEntries.length === 0) {
              context += "No feedback data yet.\n";
            } else {
              for (const [domain, data] of feedbackEntries) {
                context += `  - ${domain}: +${data.positive} -${data.negative} corrections:${data.corrections}\n`;
              }
            }

            // Generate tasks
            const response = await llmCall(
              CURRICULUM_MODEL,
              `You are a curriculum designer for an AI agent named Atom. ` +
                `Based on the current state of skills, failures, goals, and feedback, ` +
                `generate ${count} improvement tasks. Each task should:\n` +
                `1. Build on existing skills (not start from scratch)\n` +
                `2. Address a skill gap, failure pattern, or user goal\n` +
                `3. Be specific and actionable (not vague)\n` +
                `4. Include the domain, difficulty (easy/medium/hard), and expected outcome\n\n` +
                `Format each task as:\n` +
                `TASK: [name]\nDOMAIN: [domain]\nDIFFICULTY: [easy|medium|hard]\nPRIORITY: [1-10]\nDESCRIPTION: [what to do]\nEXPECTED_OUTCOME: [what success looks like]\nBUILDS_ON: [which existing skill, or "new"]\n`,
              context,
            );

            // Parse tasks from response
            const taskBlocks = response
              .split(/(?=TASK:)/g)
              .filter((b) => b.trim().startsWith("TASK:"));
            const tasks = [];

            for (const block of taskBlocks) {
              const task = {};
              for (const line of block.split("\n")) {
                const match = line.match(
                  /^(TASK|DOMAIN|DIFFICULTY|PRIORITY|DESCRIPTION|EXPECTED_OUTCOME|BUILDS_ON):\s*(.+)/,
                );
                if (match) {
                  task[match[1].toLowerCase()] = match[2].trim();
                }
              }
              if (task.task && task.description) {
                tasks.push(task);
              }
            }

            // Store tasks
            const now = new Date().toISOString();
            for (const task of tasks) {
              const id = uuid();
              const vector = await embed(`${task.task}: ${task.description}`);
              await qdrantUpsert(CURRICULUM_COLLECTION, id, vector, {
                curriculum_task: task.task,
                curriculum_domain: task.domain || "general",
                curriculum_difficulty: task.difficulty || "medium",
                curriculum_priority: parseInt(task.priority) || 5,
                curriculum_description: task.description,
                curriculum_expected_outcome: task.expected_outcome || "",
                curriculum_builds_on: task.builds_on || "new",
                curriculum_status: "pending",
                created_at: now,
              });
            }

            // Format output
            let text = `## Generated ${tasks.length} Improvement Tasks\n\n`;
            for (const [i, task] of tasks.entries()) {
              text +=
                `### ${i + 1}. ${task.task}\n` +
                `**Domain:** ${task.domain || "general"} | **Difficulty:** ${task.difficulty || "medium"} | **Priority:** ${task.priority || 5}/10\n` +
                `**Description:** ${task.description}\n` +
                `**Expected Outcome:** ${task.expected_outcome || "n/a"}\n` +
                `**Builds On:** ${task.builds_on || "new"}\n\n`;
            }

            text += `\n### Analysis Summary\n`;
            text += `- Skills: ${Object.values(coverage).reduce((s, d) => s + d.count, 0)} total across ${Object.keys(coverage).filter((d) => coverage[d].count > 0).length} domains\n`;
            text += `- Failures: ${failures.failCount} recorded\n`;
            text += `- Goals: ${goals.length} active\n`;
            text += `- Feedback: ${feedbackEntries.reduce((s, [, d]) => s + d.positive + d.negative, 0)} entries\n`;

            return { content: [{ type: "text", text }] };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "curriculum_generate" },
    );

    // ========================================================================
    // curriculum_status — Learning progress
    // ========================================================================
    api.registerTool(
      {
        name: "curriculum_status",
        label: "Learning Status",
        description:
          "View current learning progress: skill coverage per domain, pending tasks, completion stats.",
        parameters: {
          type: "object",
          properties: {},
        },
        async execute(_callId) {
          try {
            await ready();

            const [coverage, pendingTasks, completedTasks] = await Promise.all([
              getSkillCoverage(),
              qdrantScroll(
                CURRICULUM_COLLECTION,
                { must: [{ key: "curriculum_status", match: { value: "pending" } }] },
                50,
              ),
              qdrantScroll(
                CURRICULUM_COLLECTION,
                { must: [{ key: "curriculum_status", match: { value: "completed" } }] },
                50,
              ),
            ]);

            let text = "## Learning Status\n\n";

            // Domain coverage
            text += "### Skill Coverage by Domain\n";
            for (const [domain, data] of Object.entries(coverage).sort(
              (a, b) => b[1].count - a[1].count,
            )) {
              const bar =
                "█".repeat(Math.min(data.count, 20)) + "░".repeat(Math.max(0, 20 - data.count));
              const rate = data.avgPassRate > 0 ? `${(data.avgPassRate * 100).toFixed(0)}%` : "n/a";
              text += `${domain.padEnd(10)} ${bar} ${data.count} skills (${rate} pass rate)\n`;
            }

            // Pending curriculum
            text += `\n### Pending Tasks: ${pendingTasks.length}\n`;
            const sortedPending = pendingTasks.sort(
              (a, b) => (b.payload.curriculum_priority || 0) - (a.payload.curriculum_priority || 0),
            );
            for (const pt of sortedPending.slice(0, 5)) {
              const p = pt.payload;
              text += `  [P${p.curriculum_priority}] ${p.curriculum_task} — ${p.curriculum_domain} — ${p.curriculum_difficulty} (id: ${pt.id})\n`;
            }
            if (pendingTasks.length > 5) {
              text += `  ... and ${pendingTasks.length - 5} more\n`;
            }

            // Completed
            text += `\n### Completed: ${completedTasks.length}\n`;

            // Overall progress
            const total = pendingTasks.length + completedTasks.length;
            if (total > 0) {
              const pct = ((completedTasks.length / total) * 100).toFixed(0);
              text += `\n### Overall: ${completedTasks.length}/${total} tasks (${pct}%)`;
            }

            return { content: [{ type: "text", text }] };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "curriculum_status" },
    );

    // ========================================================================
    // curriculum_focus — Set learning focus
    // ========================================================================
    api.registerTool(
      {
        name: "curriculum_focus",
        label: "Set Learning Focus",
        description: "Prioritize a specific domain or goal for the next improvement cycle.",
        parameters: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              enum: ["canvas", "code", "email", "research", "system", "business", "general"],
              description: "Domain to focus on",
            },
            goal: { type: "string", description: "Specific goal to work toward" },
            reason: { type: "string", description: "Why this focus?" },
          },
          required: ["domain"],
        },
        async execute(_callId, params) {
          try {
            await ready();

            // Boost priority of pending tasks in this domain
            const pending = await qdrantScroll(
              CURRICULUM_COLLECTION,
              {
                must: [
                  { key: "curriculum_status", match: { value: "pending" } },
                  { key: "curriculum_domain", match: { value: params.domain } },
                ],
              },
              50,
            );

            let boosted = 0;
            for (const pt of pending) {
              const current = pt.payload.curriculum_priority || 5;
              if (current < 9) {
                await qdrantUpdate(CURRICULUM_COLLECTION, pt.id, {
                  curriculum_priority: Math.min(current + 2, 10),
                });
                boosted++;
              }
            }

            // Store focus as memory
            const focusText =
              `Learning focus set: ${params.domain}` +
              (params.goal ? `. Goal: ${params.goal}` : "") +
              (params.reason ? `. Reason: ${params.reason}` : "");

            const id = uuid();
            const vector = await embed(focusText);
            await qdrantUpsert("memories", id, vector, {
              memory: focusText,
              user_id: "eli",
              source: "curriculum",
              type: "focus",
              created_at: new Date().toISOString(),
            });

            return {
              content: [
                {
                  type: "text",
                  text:
                    `Focus set: **${params.domain}**` +
                    (params.goal ? `\nGoal: ${params.goal}` : "") +
                    `\nBoosted ${boosted} pending tasks in this domain.`,
                },
              ],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "curriculum_focus" },
    );

    // ========================================================================
    // curriculum_next — Get highest-priority next task
    // ========================================================================
    api.registerTool(
      {
        name: "curriculum_next",
        label: "Next Learning Task",
        description:
          "Get the single highest-priority pending improvement task. " +
          "Use this to decide what to work on next in an autonomous improvement cycle.",
        parameters: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              enum: ["canvas", "code", "email", "research", "system", "business", "general"],
              description: "Filter by domain (optional)",
            },
          },
        },
        async execute(_callId, params) {
          try {
            await ready();

            const filter = { must: [{ key: "curriculum_status", match: { value: "pending" } }] };
            if (params.domain) {
              filter.must.push({ key: "curriculum_domain", match: { value: params.domain } });
            }

            const pending = await qdrantScroll(CURRICULUM_COLLECTION, filter, 50);

            if (pending.length === 0) {
              return {
                content: [
                  {
                    type: "text",
                    text: "No pending tasks. Run `curriculum_generate` to create new improvement tasks.",
                  },
                ],
              };
            }

            // Sort by priority (highest first), then by difficulty (easy first for momentum)
            const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
            const sorted = pending.sort((a, b) => {
              const priDiff =
                (b.payload.curriculum_priority || 5) - (a.payload.curriculum_priority || 5);
              if (priDiff !== 0) return priDiff;
              return (
                (difficultyOrder[a.payload.curriculum_difficulty] || 1) -
                (difficultyOrder[b.payload.curriculum_difficulty] || 1)
              );
            });

            const next = sorted[0];
            const p = next.payload;

            // Mark as in_progress
            await qdrantUpdate(CURRICULUM_COLLECTION, next.id, {
              curriculum_status: "in_progress",
              started_at: new Date().toISOString(),
            });

            const text =
              `## Next Task: ${p.curriculum_task}\n\n` +
              `**Domain:** ${p.curriculum_domain} | **Difficulty:** ${p.curriculum_difficulty} | **Priority:** ${p.curriculum_priority}/10\n` +
              `**Description:** ${p.curriculum_description}\n` +
              `**Expected Outcome:** ${p.curriculum_expected_outcome || "n/a"}\n` +
              `**Builds On:** ${p.curriculum_builds_on || "new"}\n\n` +
              `*Status set to in_progress. Use \`improve_run\` to execute this task.*\n` +
              `(task_id: ${next.id})`;

            return { content: [{ type: "text", text }] };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "curriculum_next" },
    );

    api.logger.info("atom-curriculum: all tools registered");
  },
};
