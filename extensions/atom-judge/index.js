/**
 * Atom Judge / Evaluator Extension
 *
 * Binary rubric evaluation system with LLM-as-judge pattern.
 * Uses cheap model (Kimi K2.5 via OpenRouter) for binary PASS/FAIL evaluation.
 * Escalates to stronger model for reflection on failures.
 *
 * Tools:
 *   evaluate          — Run binary rubric evaluation on output
 *   evaluate_compare  — Compare two outputs (A/B test)
 *   rubric_create     — Create a reusable rubric for a task type
 *   rubric_list       — List stored rubrics
 *   rubric_get        — Get rubric by ID
 *   eval_log          — Query evaluation history
 *
 * Storage: Qdrant (atom_evaluations collection for logs, atom_rubrics for rubrics)
 */

const QDRANT_URL = "http://localhost:6333";
const OLLAMA_URL = "http://localhost:11434";
const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_KEY = "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";
const JUDGE_MODEL = "moonshotai/kimi-k2.5";
const REFLECTOR_MODEL = "anthropic/claude-sonnet-4-5-20250929";

const EVAL_COLLECTION = "atom_evaluations";
const RUBRIC_COLLECTION = "atom_rubrics";
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

async function ensureCollection(name) {
  const check = await fetch(`${QDRANT_URL}/collections/${name}`);
  if (check.ok) return;
  const res = await fetch(`${QDRANT_URL}/collections/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vectors: { size: DIMENSION, distance: "Cosine" } }),
  });
  if (!res.ok) throw new Error(`Failed to create ${name}: ${await res.text()}`);
}

async function qdrantUpsert(collection, id, vector, payload) {
  const res = await fetch(`${QDRANT_URL}/collections/${collection}/points`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: [{ id, vector, payload }] }),
  });
  return (await res.json()).status;
}

async function qdrantSearch(collection, vector, filter, limit = 5) {
  const body = { vector, limit, with_payload: true, filter: filter || undefined };
  const res = await fetch(`${QDRANT_URL}/collections/${collection}/points/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()).result || [];
}

async function qdrantGet(collection, ids) {
  const res = await fetch(`${QDRANT_URL}/collections/${collection}/points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, with_payload: true }),
  });
  return (await res.json()).result || [];
}

async function qdrantScroll(collection, filter, limit = 100) {
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

function uuid() {
  return crypto.randomUUID();
}

// ============================================================================
// LLM helpers
// ============================================================================

async function llmCall(model, systemPrompt, userPrompt, temperature = 0) {
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
// Built-in rubric templates
// ============================================================================

const BUILTIN_RUBRICS = {
  canvas_update: {
    name: "Canvas Update",
    domain: "canvas",
    criteria: [
      { id: "renders", check: "Does the HTML render without console errors?", weight: "critical" },
      {
        id: "visual_change",
        check: "Is the output visually different from the previous version?",
        weight: "major",
      },
      { id: "animation", check: "Do animations run smoothly without jank?", weight: "major" },
      {
        id: "no_regression",
        check: "Are all previously working features still functional?",
        weight: "critical",
      },
      { id: "code_size", check: "Is the code under 500 lines and maintainable?", weight: "minor" },
    ],
  },
  code_change: {
    name: "Code Change",
    domain: "code",
    criteria: [
      { id: "correct", check: "Does the code do what was requested?", weight: "critical" },
      {
        id: "no_errors",
        check: "Does it run without syntax or runtime errors?",
        weight: "critical",
      },
      {
        id: "no_regression",
        check: "Does it break any existing functionality?",
        weight: "critical",
      },
      {
        id: "clean",
        check: "Is the code clean, readable, and follows existing patterns?",
        weight: "minor",
      },
      {
        id: "secure",
        check: "Are there any security vulnerabilities introduced?",
        weight: "major",
      },
    ],
  },
  email_draft: {
    name: "Email Draft",
    domain: "email",
    criteria: [
      {
        id: "addresses_request",
        check: "Does the email address the intended purpose?",
        weight: "critical",
      },
      {
        id: "tone",
        check: "Is the tone appropriate for the recipient and context?",
        weight: "major",
      },
      {
        id: "actionable",
        check: "Does it include clear next steps or calls to action?",
        weight: "major",
      },
      { id: "concise", check: "Is it concise without unnecessary filler?", weight: "minor" },
    ],
  },
  research: {
    name: "Research Output",
    domain: "research",
    criteria: [
      {
        id: "answers_question",
        check: "Does it directly answer the research question?",
        weight: "critical",
      },
      {
        id: "sources",
        check: "Are claims supported by specific sources or evidence?",
        weight: "major",
      },
      {
        id: "actionable",
        check: "Does it provide actionable insights, not just information?",
        weight: "major",
      },
      { id: "complete", check: "Are all aspects of the question covered?", weight: "minor" },
    ],
  },
  general: {
    name: "General Task",
    domain: "general",
    criteria: [
      { id: "complete", check: "Is the task fully completed as requested?", weight: "critical" },
      { id: "correct", check: "Is the output factually correct and accurate?", weight: "critical" },
      {
        id: "useful",
        check: "Is the output directly useful without requiring follow-up?",
        weight: "major",
      },
    ],
  },
};

// ============================================================================
// Core evaluation logic
// ============================================================================

function formatRubric(criteria) {
  return criteria
    .map((c, i) => `${i + 1}. [${c.weight.toUpperCase()}] ${c.check} — Answer PASS or FAIL.`)
    .join("\n");
}

function parseEvaluation(response, criteria) {
  const results = [];
  let allCriticalPass = true;
  let allMajorPass = true;
  let passCount = 0;

  for (const c of criteria) {
    // Look for the criterion's result in the response
    const pattern = new RegExp(`${c.id}[:\\s]*(?:—|-)\\s*(PASS|FAIL)`, "i");
    const linePattern = new RegExp(
      `${c.check.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?(PASS|FAIL)`,
      "i",
    );
    const numberedPattern = new RegExp(`\\d+\\.\\s*\\[${c.weight}\\][\\s\\S]*?(PASS|FAIL)`, "i");

    let pass = null;
    const match =
      response.match(pattern) || response.match(linePattern) || response.match(numberedPattern);
    if (match) {
      pass = match[1].toUpperCase() === "PASS";
    } else {
      // Fallback: look for PASS/FAIL near the criterion text
      const idx = response.toLowerCase().indexOf(c.check.slice(0, 20).toLowerCase());
      if (idx >= 0) {
        const nearby = response.slice(idx, idx + 200);
        if (nearby.includes("PASS")) pass = true;
        else if (nearby.includes("FAIL")) pass = false;
      }
    }

    // If we still can't parse, default to FAIL for safety
    if (pass === null) pass = false;

    if (pass) passCount++;
    if (!pass && c.weight === "critical") allCriticalPass = false;
    if (!pass && c.weight === "major") allMajorPass = false;

    results.push({ ...c, pass });
  }

  // Overall: PASS if all critical pass AND all major pass
  const overallPass = allCriticalPass && allMajorPass;
  const score = criteria.length > 0 ? passCount / criteria.length : 0;

  return { results, overallPass, score, passCount, totalCount: criteria.length };
}

// ============================================================================
// Plugin export
// ============================================================================

export default {
  id: "atom-judge",
  name: "Atom Judge / Evaluator",
  description: "Binary rubric evaluation with LLM-as-judge",
  kind: "tool",

  register(api) {
    api.logger.info("atom-judge: registering");

    let collectionsReady = null;
    function ready() {
      if (!collectionsReady) {
        collectionsReady = Promise.all([
          ensureCollection(EVAL_COLLECTION),
          ensureCollection(RUBRIC_COLLECTION),
        ]);
      }
      return collectionsReady;
    }

    // ========================================================================
    // evaluate — Run binary rubric evaluation
    // ========================================================================
    api.registerTool(
      {
        name: "evaluate",
        label: "Evaluate Output",
        description:
          "Evaluate task output against a binary rubric. Returns PASS/FAIL per criterion " +
          "with overall verdict. Use built-in rubric types or provide custom criteria.",
        parameters: {
          type: "object",
          properties: {
            task_description: {
              type: "string",
              description: "What was the task?",
            },
            output: {
              type: "string",
              description: "The output/result to evaluate",
            },
            rubric_type: {
              type: "string",
              enum: [
                "canvas_update",
                "code_change",
                "email_draft",
                "research",
                "general",
                "custom",
              ],
              description: "Which rubric template to use (or 'custom' for ad-hoc criteria)",
            },
            custom_criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  check: { type: "string" },
                  weight: { type: "string", enum: ["critical", "major", "minor"] },
                },
                required: ["id", "check", "weight"],
              },
              description: "Custom criteria (only used when rubric_type is 'custom')",
            },
            rubric_id: {
              type: "string",
              description: "Stored rubric ID (overrides rubric_type)",
            },
            context: {
              type: "string",
              description:
                "Additional context for the judge (previous version, requirements, etc.)",
            },
          },
          required: ["task_description", "output", "rubric_type"],
        },
        async execute(_callId, params) {
          try {
            await ready();
            const now = new Date().toISOString();

            // Resolve criteria
            let criteria;
            let rubricName;

            if (params.rubric_id) {
              const rubricPoints = await qdrantGet(RUBRIC_COLLECTION, [params.rubric_id]);
              if (rubricPoints.length > 0) {
                criteria = JSON.parse(rubricPoints[0].payload.rubric_criteria);
                rubricName = rubricPoints[0].payload.rubric_name;
              }
            }

            if (!criteria) {
              if (params.rubric_type === "custom" && params.custom_criteria) {
                criteria = params.custom_criteria;
                rubricName = "Custom";
              } else {
                const template = BUILTIN_RUBRICS[params.rubric_type] || BUILTIN_RUBRICS.general;
                criteria = template.criteria;
                rubricName = template.name;
              }
            }

            // Build judge prompt
            const rubricText = formatRubric(criteria);
            const systemPrompt =
              "You are a strict binary evaluator. For each criterion, answer EXACTLY 'PASS' or 'FAIL'. " +
              "Give brief reasoning before each verdict. Be honest — FAIL anything that doesn't fully meet the criterion. " +
              "Do not be lenient. Format each result as: [criterion_id] — reasoning — PASS/FAIL";

            const userPrompt =
              `## Task\n${params.task_description}\n\n` +
              (params.context ? `## Context\n${params.context}\n\n` : "") +
              `## Output to Evaluate\n${params.output.slice(0, 8000)}\n\n` +
              `## Rubric (${rubricName})\nEvaluate each criterion:\n${rubricText}`;

            // Call judge
            const judgeResponse = await llmCall(JUDGE_MODEL, systemPrompt, userPrompt);

            // Parse results
            const evaluation = parseEvaluation(judgeResponse, criteria);

            // Format results
            const resultLines = evaluation.results.map(
              (r) => `${r.pass ? "PASS" : "FAIL"} [${r.weight}] ${r.check}`,
            );

            const verdict = evaluation.overallPass ? "PASS" : "FAIL";
            const summary =
              `## Evaluation: ${verdict}\n` +
              `**Rubric:** ${rubricName} | **Score:** ${evaluation.passCount}/${evaluation.totalCount} (${(evaluation.score * 100).toFixed(0)}%)\n\n` +
              resultLines.join("\n") +
              `\n\n### Judge Reasoning\n${judgeResponse.slice(0, 2000)}`;

            // Store evaluation log
            const evalId = uuid();
            const vector = await embed(params.task_description);
            await qdrantUpsert(EVAL_COLLECTION, evalId, vector, {
              eval_task: params.task_description,
              eval_rubric: rubricName,
              eval_verdict: verdict,
              eval_score: evaluation.score,
              eval_pass_count: evaluation.passCount,
              eval_total_count: evaluation.totalCount,
              eval_results: JSON.stringify(evaluation.results),
              eval_judge_response: judgeResponse.slice(0, 4000),
              eval_output_preview: params.output.slice(0, 500),
              created_at: now,
            });

            return {
              content: [
                {
                  type: "text",
                  text: summary + `\n\n(eval_id: ${evalId})`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Evaluation failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "evaluate" },
    );

    // ========================================================================
    // evaluate_compare — A/B comparison
    // ========================================================================
    api.registerTool(
      {
        name: "evaluate_compare",
        label: "Compare Outputs",
        description:
          "Compare two outputs side-by-side. Returns which is better and why. " +
          "Useful for A/B testing and evolution.",
        parameters: {
          type: "object",
          properties: {
            task_description: { type: "string", description: "What was the task?" },
            output_a: { type: "string", description: "First output (e.g. previous version)" },
            output_b: { type: "string", description: "Second output (e.g. new version)" },
            criteria: {
              type: "string",
              description:
                "What to compare on (e.g. 'visual quality, animation smoothness, code cleanliness')",
            },
          },
          required: ["task_description", "output_a", "output_b"],
        },
        async execute(_callId, params) {
          try {
            await ready();

            const systemPrompt =
              "You are comparing two outputs for the same task. " +
              "Evaluate each on the given criteria. Then declare a winner: A, B, or TIE. " +
              "Be specific about what makes one better than the other.";

            const userPrompt =
              `## Task\n${params.task_description}\n\n` +
              `## Criteria\n${params.criteria || "Overall quality, correctness, and completeness"}\n\n` +
              `## Output A\n${params.output_a.slice(0, 4000)}\n\n` +
              `## Output B\n${params.output_b.slice(0, 4000)}\n\n` +
              "Compare A and B. For each criterion state which is better. Then give overall verdict: A_BETTER, B_BETTER, or TIE.";

            const response = await llmCall(JUDGE_MODEL, systemPrompt, userPrompt);

            // Determine winner
            let winner = "TIE";
            if (
              response.includes("B_BETTER") ||
              response.includes("B is better") ||
              response.includes("Winner: B")
            ) {
              winner = "B";
            } else if (
              response.includes("A_BETTER") ||
              response.includes("A is better") ||
              response.includes("Winner: A")
            ) {
              winner = "A";
            }

            // Log comparison
            const evalId = uuid();
            const vector = await embed(params.task_description);
            await qdrantUpsert(EVAL_COLLECTION, evalId, vector, {
              eval_task: params.task_description,
              eval_rubric: "comparison",
              eval_verdict: winner,
              eval_judge_response: response.slice(0, 4000),
              eval_type: "comparison",
              created_at: new Date().toISOString(),
            });

            return {
              content: [
                {
                  type: "text",
                  text: `## Comparison Result: ${winner === "TIE" ? "TIE" : `${winner} wins`}\n\n${response.slice(0, 3000)}\n\n(eval_id: ${evalId})`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Comparison failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "evaluate_compare" },
    );

    // ========================================================================
    // rubric_create — Store a reusable rubric
    // ========================================================================
    api.registerTool(
      {
        name: "rubric_create",
        label: "Create Rubric",
        description: "Create and store a reusable evaluation rubric for a specific task type.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Rubric name (e.g. 'iPhone Face Canvas')" },
            domain: {
              type: "string",
              enum: ["canvas", "code", "email", "research", "system", "business", "general"],
              description: "Domain",
            },
            description: { type: "string", description: "When to use this rubric" },
            criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  check: { type: "string" },
                  weight: { type: "string", enum: ["critical", "major", "minor"] },
                },
                required: ["id", "check", "weight"],
              },
              description: "PASS/FAIL criteria",
            },
          },
          required: ["name", "domain", "criteria"],
        },
        async execute(_callId, params) {
          try {
            await ready();
            const id = uuid();
            const now = new Date().toISOString();
            const searchText = `${params.name}: ${params.description || params.name}`;
            const vector = await embed(searchText);

            await qdrantUpsert(RUBRIC_COLLECTION, id, vector, {
              rubric_name: params.name,
              rubric_domain: params.domain,
              rubric_description: params.description || "",
              rubric_criteria: JSON.stringify(params.criteria),
              rubric_use_count: 0,
              created_at: now,
              updated_at: now,
            });

            return {
              content: [
                {
                  type: "text",
                  text: `Rubric created: "${params.name}" [${params.domain}] with ${params.criteria.length} criteria (id: ${id})`,
                },
              ],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "rubric_create" },
    );

    // ========================================================================
    // rubric_list — List stored rubrics
    // ========================================================================
    api.registerTool(
      {
        name: "rubric_list",
        label: "List Rubrics",
        description: "List all stored rubrics, plus show built-in rubric types.",
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
        async execute(_callId, params) {
          try {
            await ready();

            // Built-in rubrics
            let text = "## Built-in Rubrics\n";
            for (const [key, r] of Object.entries(BUILTIN_RUBRICS)) {
              if (params.domain && r.domain !== params.domain) continue;
              text += `• **${r.name}** (type: ${key}) — ${r.criteria.length} criteria\n`;
            }

            // Stored rubrics
            const filter = params.domain
              ? { must: [{ key: "rubric_domain", match: { value: params.domain } }] }
              : null;
            const points = await qdrantScroll(RUBRIC_COLLECTION, filter);

            if (points.length > 0) {
              text += "\n## Custom Rubrics\n";
              for (const pt of points) {
                const p = pt.payload;
                const criteria = JSON.parse(p.rubric_criteria || "[]");
                text += `• **${p.rubric_name}** [${p.rubric_domain}] — ${criteria.length} criteria — used ${p.rubric_use_count}x (id: ${pt.id})\n`;
              }
            }

            return { content: [{ type: "text", text }] };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "rubric_list" },
    );

    // ========================================================================
    // rubric_get — Get rubric details
    // ========================================================================
    api.registerTool(
      {
        name: "rubric_get",
        label: "Get Rubric",
        description: "Get full details of a stored rubric.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "Rubric ID" },
          },
          required: ["id"],
        },
        async execute(_callId, params) {
          try {
            await ready();
            const points = await qdrantGet(RUBRIC_COLLECTION, [params.id]);
            if (points.length === 0) {
              return { content: [{ type: "text", text: "Rubric not found." }], isError: true };
            }

            const p = points[0].payload;
            const criteria = JSON.parse(p.rubric_criteria || "[]");

            const text =
              `# ${p.rubric_name} [${p.rubric_domain}]\n` +
              `**Description:** ${p.rubric_description || "N/A"}\n` +
              `**Used:** ${p.rubric_use_count}x\n\n` +
              `## Criteria\n` +
              criteria.map((c, i) => `${i + 1}. [${c.weight.toUpperCase()}] ${c.check}`).join("\n");

            return { content: [{ type: "text", text }] };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "rubric_get" },
    );

    // ========================================================================
    // eval_log — Query evaluation history
    // ========================================================================
    api.registerTool(
      {
        name: "eval_log",
        label: "Evaluation Log",
        description: "Query evaluation history. Search by task description or filter by verdict.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search evaluations by task description" },
            verdict: {
              type: "string",
              enum: ["PASS", "FAIL"],
              description: "Filter by verdict",
            },
            limit: { type: "number", description: "Max results (default 10)" },
          },
        },
        async execute(_callId, params) {
          try {
            await ready();

            let points;
            if (params.query) {
              const vector = await embed(params.query);
              const filter = params.verdict
                ? { must: [{ key: "eval_verdict", match: { value: params.verdict } }] }
                : null;
              points = await qdrantSearch(EVAL_COLLECTION, vector, filter, params.limit || 10);
              // Normalize shape
              points = points.map((r) => ({ id: r.id, payload: r.payload, score: r.score }));
            } else {
              const filter = params.verdict
                ? { must: [{ key: "eval_verdict", match: { value: params.verdict } }] }
                : null;
              points = await qdrantScroll(EVAL_COLLECTION, filter, params.limit || 10);
            }

            if (points.length === 0) {
              return { content: [{ type: "text", text: "No evaluations found." }] };
            }

            const text = points.map((pt) => {
              const p = pt.payload;
              const scoreStr =
                p.eval_score !== undefined ? `${(p.eval_score * 100).toFixed(0)}%` : "n/a";
              return `• [${p.eval_verdict}] ${p.eval_task?.slice(0, 80)} — ${p.eval_rubric} — ${scoreStr} — ${p.created_at?.slice(0, 10)} (id: ${pt.id})`;
            });

            return {
              content: [
                { type: "text", text: `${points.length} evaluations:\n\n${text.join("\n")}` },
              ],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "eval_log" },
    );

    api.logger.info("atom-judge: all tools registered");
  },
};
