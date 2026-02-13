/**
 * Atom Self-Improvement Loop Extension
 *
 * Wires the full Actor-Evaluator-Reflector cycle:
 *   1. Retrieve relevant skills from library (context)
 *   2. Generate output (actor)
 *   3. Evaluate with binary rubric (judge)
 *   4. On FAIL: reflect, append critique, retry (up to maxRetries)
 *   5. On PASS: store/update skill, store lesson in memory
 *
 * Model escalation on retries: Kimi K2.5 → Sonnet → Opus
 *
 * Tools:
 *   improve_run       — Execute a full improvement cycle
 *   improve_reflect   — Generate reflection/critique on a failed output
 *   improve_history   — View improvement cycle history
 */

const QDRANT_URL = "http://localhost:6333";
const OLLAMA_URL = "http://localhost:11434";
const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_KEY = "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";

const SKILLS_COLLECTION = "atom_skills";
const EVAL_COLLECTION = "atom_evaluations";
const MEMORIES_COLLECTION = "memories";
const CYCLES_COLLECTION = "atom_cycles";
const DIMENSION = 768;

// Model escalation ladder
const MODEL_LADDER = [
  "moonshotai/kimi-k2.5",
  "anthropic/claude-sonnet-4-5-20250929",
  "anthropic/claude-opus-4-6",
];

// ============================================================================
// Infrastructure helpers
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

async function ensureCollection(name) {
  const check = await fetch(`${QDRANT_URL}/collections/${name}`);
  if (check.ok) return;
  await fetch(`${QDRANT_URL}/collections/${name}`, {
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

async function qdrantSearch(collection, vector, filter, limit = 5) {
  const res = await fetch(`${QDRANT_URL}/collections/${collection}/points/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vector, limit, with_payload: true, filter: filter || undefined }),
  });
  return (await res.json()).result || [];
}

async function qdrantScroll(collection, filter, limit = 20) {
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

function uuid() {
  return crypto.randomUUID();
}

// ============================================================================
// LLM helpers
// ============================================================================

async function llmCall(model, systemPrompt, userPrompt, temperature = 0.3) {
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
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ============================================================================
// Core loop functions
// ============================================================================

async function retrieveSkills(taskDescription, domain) {
  const vector = await embed(taskDescription);
  const filter = domain ? { must: [{ key: "skill_domain", match: { value: domain } }] } : null;
  const results = await qdrantSearch(SKILLS_COLLECTION, vector, filter, 3);

  return results
    .filter((r) => r.score > 0.5)
    .map((r) => ({
      id: r.id,
      name: r.payload.skill_name,
      description: r.payload.skill_description,
      code: r.payload.skill_code,
      lessons: JSON.parse(r.payload.skill_lessons || "[]"),
      rubric: r.payload.skill_rubric,
      score: r.score,
    }));
}

function buildActorPrompt(task, skills, previousAttempt, reflection) {
  let prompt = `## Task\n${task}\n\n`;

  if (skills.length > 0) {
    prompt += `## Relevant Skills from Library\n`;
    for (const s of skills) {
      prompt += `### ${s.name} (relevance: ${(s.score * 100).toFixed(0)}%)\n`;
      prompt += `${s.description}\n`;
      if (s.lessons.length > 0) {
        prompt += `Lessons: ${s.lessons.join("; ")}\n`;
      }
      prompt += `\`\`\`\n${s.code.slice(0, 1000)}\n\`\`\`\n\n`;
    }
  }

  if (previousAttempt) {
    prompt += `## Previous Attempt (FAILED)\n${previousAttempt.slice(0, 2000)}\n\n`;
  }

  if (reflection) {
    prompt += `## Reflection on Failure\n${reflection}\n\n`;
  }

  prompt += `Generate the output for this task. Be thorough and correct.`;
  return prompt;
}

// Built-in rubrics (same as judge extension)
const RUBRICS = {
  canvas: [
    { id: "renders", check: "Does the HTML render without console errors?", weight: "critical" },
    { id: "visual", check: "Is the output visually correct and complete?", weight: "critical" },
    { id: "animation", check: "Do animations run smoothly?", weight: "major" },
    { id: "no_regression", check: "No regressions from previous version?", weight: "critical" },
  ],
  code: [
    { id: "correct", check: "Does the code do what was requested?", weight: "critical" },
    { id: "no_errors", check: "No syntax or runtime errors?", weight: "critical" },
    { id: "no_regression", check: "No existing functionality broken?", weight: "critical" },
    { id: "secure", check: "No security vulnerabilities?", weight: "major" },
  ],
  general: [
    { id: "complete", check: "Is the task fully completed as requested?", weight: "critical" },
    { id: "correct", check: "Is the output factually correct?", weight: "critical" },
    { id: "useful", check: "Is the output directly useful?", weight: "major" },
  ],
};

function formatRubric(criteria) {
  return criteria
    .map((c, i) => `${i + 1}. [${c.weight.toUpperCase()}] ${c.check} — PASS or FAIL`)
    .join("\n");
}

function parseEval(response, criteria) {
  let allCriticalPass = true;
  let allMajorPass = true;
  let passCount = 0;
  const results = [];

  for (const c of criteria) {
    const linePattern = new RegExp(
      `${c.check.slice(0, 25).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?(PASS|FAIL)`,
      "i",
    );
    const match = response.match(linePattern);
    const pass = match ? match[1].toUpperCase() === "PASS" : false;

    if (pass) passCount++;
    if (!pass && c.weight === "critical") allCriticalPass = false;
    if (!pass && c.weight === "major") allMajorPass = false;
    results.push({ ...c, pass });
  }

  return {
    results,
    overallPass: allCriticalPass && allMajorPass,
    score: criteria.length > 0 ? passCount / criteria.length : 0,
    passCount,
    totalCount: criteria.length,
  };
}

async function evaluate(taskDescription, output, domain) {
  const criteria = RUBRICS[domain] || RUBRICS.general;
  const rubricText = formatRubric(criteria);

  const systemPrompt =
    "You are a strict binary evaluator. For each criterion answer EXACTLY PASS or FAIL with brief reasoning. " +
    "Be honest. FAIL anything that doesn't fully meet the criterion.";

  const userPrompt =
    `## Task\n${taskDescription}\n\n` +
    `## Output\n${output.slice(0, 6000)}\n\n` +
    `## Rubric\n${rubricText}`;

  const judgeResponse = await llmCall("moonshotai/kimi-k2.5", systemPrompt, userPrompt, 0);
  return { ...parseEval(judgeResponse, criteria), rawResponse: judgeResponse };
}

async function reflect(taskDescription, output, evalResult) {
  const failedCriteria = evalResult.results
    .filter((r) => !r.pass)
    .map((r) => `- [${r.weight}] ${r.check}`)
    .join("\n");

  const prompt =
    `## Task\n${taskDescription}\n\n` +
    `## Failed Output\n${output.slice(0, 3000)}\n\n` +
    `## Failed Criteria\n${failedCriteria}\n\n` +
    `## Judge Feedback\n${evalResult.rawResponse.slice(0, 1500)}\n\n` +
    `Generate a concise reflection:\n` +
    `1. What specific mistake caused each failure?\n` +
    `2. What concrete change would fix it?\n` +
    `3. One lesson to remember for next time.`;

  // Use stronger model for reflection
  return await llmCall(
    "anthropic/claude-sonnet-4-5-20250929",
    "You are a thoughtful code reviewer. Generate actionable, specific feedback.",
    prompt,
    0.2,
  );
}

async function storeLesson(taskDescription, lesson) {
  const vector = await embed(lesson);
  const id = uuid();
  await qdrantUpsert(MEMORIES_COLLECTION, id, vector, {
    memory: lesson,
    user_id: "eli",
    source: "self-improvement",
    type: "lesson",
    task_context: taskDescription.slice(0, 200),
    created_at: new Date().toISOString(),
  });
  return id;
}

// ============================================================================
// Plugin export
// ============================================================================

export default {
  id: "atom-improve",
  name: "Atom Self-Improvement Loop",
  description: "Actor-Evaluator-Reflector cycle for autonomous improvement",
  kind: "tool",

  register(api) {
    api.logger.info("atom-improve: registering");

    let collectionsReady = null;
    function ready() {
      if (!collectionsReady) {
        collectionsReady = Promise.all([
          ensureCollection(CYCLES_COLLECTION),
          ensureCollection(EVAL_COLLECTION),
        ]);
      }
      return collectionsReady;
    }

    // ========================================================================
    // improve_run — Full improvement cycle
    // ========================================================================
    api.registerTool(
      {
        name: "improve_run",
        label: "Run Improvement Cycle",
        description:
          "Execute a full self-improvement cycle: retrieve skills → generate → evaluate → " +
          "reflect+retry on failure → store skill + lesson on success. " +
          "Use this to autonomously attempt and iterate on a task.",
        parameters: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description: "What to accomplish",
            },
            domain: {
              type: "string",
              enum: ["canvas", "code", "email", "research", "system", "business", "general"],
              description: "Task domain (determines rubric and skill retrieval)",
            },
            context: {
              type: "string",
              description: "Additional context (previous version, requirements, constraints)",
            },
            max_retries: {
              type: "number",
              description: "Max retry attempts (default 3)",
            },
            skill_name: {
              type: "string",
              description: "If successful, store result as this skill name",
            },
          },
          required: ["task", "domain"],
        },
        async execute(_callId, params) {
          try {
            await ready();
            const maxRetries = params.max_retries || 3;
            const now = new Date().toISOString();
            const cycleId = uuid();
            const domain = params.domain || "general";

            const log = [];
            log.push(`# Improvement Cycle: ${cycleId}`);
            log.push(`**Task:** ${params.task}`);
            log.push(`**Domain:** ${domain}`);
            log.push(`**Started:** ${now}\n`);

            // Step 1: Retrieve skills
            log.push("## Step 1: Skill Retrieval");
            const skills = await retrieveSkills(params.task, domain);
            if (skills.length > 0) {
              log.push(`Found ${skills.length} relevant skills:`);
              for (const s of skills) {
                log.push(`  - ${s.name} (${(s.score * 100).toFixed(0)}% match)`);
              }
            } else {
              log.push("No relevant skills found — starting from scratch.");
            }
            log.push("");

            // Step 2-4: Generate → Evaluate → Retry loop
            let attempt = 0;
            let output = null;
            let evalResult = null;
            let reflectionText = null;
            let previousOutput = null;
            let passed = false;
            let modelUsed = null;

            while (attempt < maxRetries && !passed) {
              attempt++;
              const model = MODEL_LADDER[Math.min(attempt - 1, MODEL_LADDER.length - 1)];
              modelUsed = model;

              log.push(`## Attempt ${attempt}/${maxRetries} (model: ${model.split("/").pop()})`);

              // Generate
              const actorSystem =
                "You are Atom, an AI agent. Complete the task thoroughly. " +
                "If prior skills or reflections are provided, incorporate their lessons. " +
                "Output ONLY the result — no explanation or commentary.";
              const actorPrompt = buildActorPrompt(
                params.task + (params.context ? `\n\nContext: ${params.context}` : ""),
                skills,
                previousOutput,
                reflectionText,
              );

              output = await llmCall(model, actorSystem, actorPrompt);
              log.push(`Generated ${output.length} chars of output.`);

              // Evaluate
              evalResult = await evaluate(params.task, output, domain);
              const resultSummary = evalResult.results
                .map((r) => `  ${r.pass ? "PASS" : "FAIL"} [${r.weight}] ${r.check}`)
                .join("\n");
              log.push(
                `Evaluation: ${evalResult.overallPass ? "PASS" : "FAIL"} (${evalResult.passCount}/${evalResult.totalCount})`,
              );
              log.push(resultSummary);

              if (evalResult.overallPass) {
                passed = true;
                log.push("\n**Result: PASSED**");
              } else if (attempt < maxRetries) {
                // Reflect
                log.push("\nReflecting on failure...");
                reflectionText = await reflect(params.task, output, evalResult);
                log.push(`Reflection: ${reflectionText.slice(0, 300)}...`);
                previousOutput = output;
              } else {
                log.push("\n**Result: FAILED after all retries**");
              }
              log.push("");
            }

            // Step 5: Store results
            log.push("## Post-Cycle");

            if (passed) {
              // Extract lesson
              const lesson =
                `Completed "${params.task.slice(0, 80)}" on attempt ${attempt}/${maxRetries}. ` +
                `Model: ${modelUsed}. ` +
                (reflectionText
                  ? `Key fix from reflection: ${reflectionText.slice(0, 200)}`
                  : "Passed on first attempt.");

              const lessonId = await storeLesson(params.task, lesson);
              log.push(`Lesson stored: ${lessonId}`);

              // Store/update skill if name provided
              if (params.skill_name) {
                const skillId = uuid();
                const skillVector = await embed(`${params.skill_name}: ${params.task}`);
                await qdrantUpsert(SKILLS_COLLECTION, skillId, skillVector, {
                  skill_name: params.skill_name,
                  skill_description: params.task,
                  skill_domain: domain,
                  skill_code: output.slice(0, 10000),
                  skill_rubric: formatRubric(RUBRICS[domain] || RUBRICS.general),
                  skill_prerequisites: "",
                  skill_lessons: JSON.stringify(
                    reflectionText ? [reflectionText.slice(0, 500)] : [],
                  ),
                  skill_version: 1,
                  skill_use_count: 1,
                  skill_pass_count: 1,
                  skill_fail_count: attempt - 1,
                  created_at: now,
                  updated_at: new Date().toISOString(),
                });
                log.push(`Skill stored: "${params.skill_name}" (id: ${skillId})`);
              }

              // Update used skills' pass counts
              for (const s of skills) {
                await qdrantUpdate(SKILLS_COLLECTION, s.id, {
                  skill_use_count:
                    ((await qdrantSearch(SKILLS_COLLECTION, await embed(s.name), null, 1))[0]
                      ?.payload?.skill_use_count || 0) + 1,
                }).catch(() => {});
              }
            }

            // Store cycle log
            const cycleVector = await embed(params.task);
            await qdrantUpsert(CYCLES_COLLECTION, cycleId, cycleVector, {
              cycle_task: params.task,
              cycle_domain: domain,
              cycle_passed: passed,
              cycle_attempts: attempt,
              cycle_model_final: modelUsed,
              cycle_score: evalResult?.score || 0,
              cycle_output_preview: (output || "").slice(0, 500),
              cycle_reflection: (reflectionText || "").slice(0, 500),
              cycle_skills_used: skills.map((s) => s.name).join(", "),
              created_at: now,
              completed_at: new Date().toISOString(),
            });
            log.push(`Cycle logged: ${cycleId}`);

            const summary = log.join("\n");

            return {
              content: [
                {
                  type: "text",
                  text:
                    summary +
                    `\n\n---\n**Output (${passed ? "PASSED" : "FAILED"}):**\n${(output || "No output").slice(0, 4000)}`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Improvement cycle failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "improve_run" },
    );

    // ========================================================================
    // improve_reflect — Standalone reflection
    // ========================================================================
    api.registerTool(
      {
        name: "improve_reflect",
        label: "Reflect on Failure",
        description:
          "Generate a reflection/critique on a failed output. Useful for manual review " +
          "or when you want to understand why something failed without running the full loop.",
        parameters: {
          type: "object",
          properties: {
            task: { type: "string", description: "What was the task?" },
            output: { type: "string", description: "The failed output" },
            failure_reason: { type: "string", description: "What went wrong?" },
          },
          required: ["task", "output", "failure_reason"],
        },
        async execute(_callId, params) {
          try {
            const prompt =
              `## Task\n${params.task}\n\n` +
              `## Failed Output\n${params.output.slice(0, 4000)}\n\n` +
              `## What Went Wrong\n${params.failure_reason}\n\n` +
              `Generate a reflection:\n` +
              `1. Root cause of the failure\n` +
              `2. Specific fix to try next\n` +
              `3. One-sentence lesson to remember`;

            const reflection = await llmCall(
              "anthropic/claude-sonnet-4-5-20250929",
              "You are a thoughtful reviewer. Be specific and actionable.",
              prompt,
              0.2,
            );

            return {
              content: [{ type: "text", text: `## Reflection\n\n${reflection}` }],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Reflection failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "improve_reflect" },
    );

    // ========================================================================
    // improve_history — View cycle history
    // ========================================================================
    api.registerTool(
      {
        name: "improve_history",
        label: "Improvement History",
        description:
          "View past improvement cycles — what was attempted, what passed/failed, and what was learned.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search by task description" },
            passed_only: { type: "boolean", description: "Only show successful cycles" },
            failed_only: { type: "boolean", description: "Only show failed cycles" },
            limit: { type: "number", description: "Max results (default 10)" },
          },
        },
        async execute(_callId, params) {
          try {
            await ready();

            let points;
            if (params.query) {
              const vector = await embed(params.query);
              let filter = null;
              if (params.passed_only)
                filter = { must: [{ key: "cycle_passed", match: { value: true } }] };
              if (params.failed_only)
                filter = { must: [{ key: "cycle_passed", match: { value: false } }] };
              points = await qdrantSearch(CYCLES_COLLECTION, vector, filter, params.limit || 10);
              points = points.map((r) => ({ id: r.id, payload: r.payload }));
            } else {
              let filter = null;
              if (params.passed_only)
                filter = { must: [{ key: "cycle_passed", match: { value: true } }] };
              if (params.failed_only)
                filter = { must: [{ key: "cycle_passed", match: { value: false } }] };
              points = await qdrantScroll(CYCLES_COLLECTION, filter, params.limit || 10);
            }

            if (points.length === 0) {
              return { content: [{ type: "text", text: "No improvement cycles found." }] };
            }

            const text = points.map((pt) => {
              const p = pt.payload;
              const status = p.cycle_passed ? "PASS" : "FAIL";
              const score =
                p.cycle_score !== undefined ? `${(p.cycle_score * 100).toFixed(0)}%` : "n/a";
              return (
                `• [${status}] ${p.cycle_task?.slice(0, 70)} — ${p.cycle_domain} — ` +
                `${p.cycle_attempts} attempts — score: ${score} — ` +
                `model: ${p.cycle_model_final?.split("/").pop()} — ${p.created_at?.slice(0, 10)}`
              );
            });

            return {
              content: [{ type: "text", text: `${points.length} cycles:\n\n${text.join("\n")}` }],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "improve_history" },
    );

    api.logger.info("atom-improve: all tools registered");
  },
};
