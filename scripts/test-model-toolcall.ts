#!/usr/bin/env bun
/**
 * STRESS TEST: 3 ollama cloud models for tool/function-calling quality.
 *
 * Tests cover:
 *   - Basic tool selection (easy)
 *   - Multi-tool calling (call 2+ tools in one turn)
 *   - Ambiguous prompts (model must pick the right tool despite distractors)
 *   - Complex parameter construction (nested params, long task descriptions)
 *   - Adversarial prompts (trick the model into hallucinating)
 *   - Multi-step reasoning (must reason about which tool before calling)
 *   - Consistency (run each 3 times to catch flaky behavior)
 */

const MODELS = [
  "kimi-k2.5:cloud",
  "glm-5:cloud",
  "qwen3-coder-next:cloud",
  "gemini-3-flash-preview:cloud",
];

const RUNS_PER_TEST = 3; // Each test runs 3 times for consistency scoring

const OLLAMA_URL = "http://127.0.0.1:11434/v1/chat/completions";

// Full tool set — more tools = more room for wrong selection
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "sessions_list",
      description: "List active agent sessions with optional filters",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", description: "Filter by agent id or session key pattern" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "sessions_spawn",
      description: "Spawn a new agent session to delegate a task to a specialist agent",
      parameters: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            description: "Target agent id (e.g. mars, john, aegis, muse, freya, kairos, vulcan)",
          },
          task: { type: "string", description: "Task description for the spawned agent" },
          thinking: {
            type: "string",
            enum: ["off", "low", "medium", "high"],
            description: "Thinking level for spawned agent",
          },
        },
        required: ["agentId", "task"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "sessions_send",
      description: "Send a message to an existing agent session",
      parameters: {
        type: "object",
        properties: {
          sessionKey: {
            type: "string",
            description: "Target session key (e.g. agent:mars, agent:aegis)",
          },
          message: { type: "string", description: "Message to send" },
        },
        required: ["sessionKey", "message"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "cron",
      description: "Manage scheduled tasks: list, create, update, delete cron jobs",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["list", "create", "update", "delete", "status"],
            description: "Action to perform",
          },
          id: { type: "string", description: "Cron job id (for update/delete)" },
          schedule: { type: "string", description: "Cron schedule expression (for create/update)" },
          task: { type: "string", description: "Task to schedule (for create)" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "exec",
      description: "Execute a shell command in the agent workspace",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          cwd: { type: "string", description: "Working directory" },
          timeout: { type: "number", description: "Timeout in milliseconds" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "file_read",
      description: "Read the contents of a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read" },
          encoding: { type: "string", description: "File encoding (default utf-8)" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "file_write",
      description: "Write content to a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to write" },
          content: { type: "string", description: "Content to write" },
          append: { type: "boolean", description: "Append instead of overwrite" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Search the web for information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          maxResults: { type: "number", description: "Max results to return" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "message_send",
      description:
        "Send a message to a user via a messaging channel (telegram, whatsapp, discord, etc.)",
      parameters: {
        type: "object",
        properties: {
          channel: {
            type: "string",
            enum: ["telegram", "whatsapp", "discord", "slack", "signal"],
            description: "Messaging channel",
          },
          target: { type: "string", description: "Recipient (phone number, chat id, username)" },
          text: { type: "string", description: "Message text" },
        },
        required: ["channel", "target", "text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "task_list",
      description: "List, create, or manage task lists for agents",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["list", "create", "update", "delete", "complete"],
            description: "Action",
          },
          listId: { type: "string", description: "Task list id" },
          title: { type: "string", description: "Task title (for create)" },
        },
        required: ["action"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are Vulcan, a senior system engineering agent in the OpenClaw multi-agent system.

Your agent network:
- Luna (main orchestrator, session: agent:main)
- Vulcan (you — coder/infra, session: agent:vulcan)
- Aegis (security audits, session: agent:aegis)
- Mars (Shopee/Lazada market intelligence, session: agent:mars)
- John (deep research, session: agent:john)
- Muse (UI/UX design, session: agent:muse)
- Freya (e-commerce ops/logistics, session: agent:freya)
- Kairos (TikTok/social media, session: agent:kairos)

Rules:
1. ALWAYS use the provided tools — never answer from memory when a tool is available.
2. Use sessions_spawn to delegate to another agent for a NEW task.
3. Use sessions_send to message an EXISTING running session.
4. Use exec for shell commands, file_read/file_write for file ops.
5. For multi-step tasks, call multiple tools in sequence.
6. Pick the MOST SPECIFIC tool. Don't use exec when file_read would work.`;

// ═══════════════════════════════════════════════════════════════
// TEST CASES — organized by difficulty
// ═══════════════════════════════════════════════════════════════

type TestCase = {
  prompt: string;
  expectedTool: string | string[]; // string[] = accept any of these
  description: string;
  category: "basic" | "ambiguous" | "complex_params" | "adversarial" | "multi_step" | "reasoning";
  validateParams?: (params: Record<string, unknown>) => boolean;
};

const TEST_CASES: TestCase[] = [
  // ── BASIC (warm-up) ──────────────────────────────────────
  {
    prompt: "Show me all cron jobs",
    expectedTool: "cron",
    description: "Basic: cron list",
    category: "basic",
    validateParams: (p) => p.action === "list",
  },
  {
    prompt: "List active agent sessions",
    expectedTool: "sessions_list",
    description: "Basic: list sessions",
    category: "basic",
  },

  // ── AMBIGUOUS (similar tools, must pick right one) ───────
  {
    prompt: "I need to know what Mars is working on right now",
    expectedTool: "sessions_send",
    description: "Ambiguous: check existing agent status (send, not spawn)",
    category: "ambiguous",
    validateParams: (p) =>
      typeof p.sessionKey === "string" && (p.sessionKey as string).toLowerCase().includes("mars"),
  },
  {
    prompt:
      "Get Mars to analyze competitor pricing on Shopee for phone cases — this is a brand new analysis, Mars hasn't started yet",
    expectedTool: "sessions_spawn",
    description: "Ambiguous: new task for agent (spawn, not send)",
    category: "ambiguous",
    validateParams: (p) =>
      (p.agentId as string)?.toLowerCase() === "mars" &&
      typeof p.task === "string" &&
      (p.task as string).length > 15,
  },
  {
    prompt: "Read the contents of package.json",
    expectedTool: "file_read",
    description: "Ambiguous: file_read not exec (more specific tool wins)",
    category: "ambiguous",
    validateParams: (p) =>
      typeof p.path === "string" && (p.path as string).includes("package.json"),
  },
  {
    prompt: "Check disk usage on this machine",
    expectedTool: "exec",
    description: "Ambiguous: exec not file_read (no file to read, need df/du)",
    category: "ambiguous",
    validateParams: (p) =>
      typeof p.command === "string" && /(df|du|disk)/.test(p.command as string),
  },

  // ── COMPLEX PARAMS (must construct params correctly) ─────
  {
    prompt:
      "Create a cron job that runs every 6 hours to check system health. The task should run 'openclaw doctor' and log the output.",
    expectedTool: "cron",
    description: "Complex params: create cron with schedule + task",
    category: "complex_params",
    validateParams: (p) =>
      p.action === "create" &&
      typeof p.schedule === "string" &&
      typeof p.task === "string" &&
      (p.task as string).includes("doctor"),
  },
  {
    prompt:
      "Send a Telegram message to chat 6292567735 saying 'Server restarted successfully at 08:45 UTC. All services healthy.'",
    expectedTool: "message_send",
    description: "Complex params: message with channel + target + exact text",
    category: "complex_params",
    validateParams: (p) =>
      p.channel === "telegram" &&
      String(p.target).includes("6292567735") &&
      typeof p.text === "string" &&
      (p.text as string).includes("restarted"),
  },
  {
    prompt:
      "Write a file at /tmp/health-check.sh with the content: '#!/bin/bash\\ndf -h\\nfree -m\\nuptime'",
    expectedTool: "file_write",
    description: "Complex params: file_write with path + multiline content",
    category: "complex_params",
    validateParams: (p) =>
      typeof p.path === "string" &&
      (p.path as string).includes("health-check") &&
      typeof p.content === "string" &&
      (p.content as string).includes("df"),
  },

  // ── ADVERSARIAL (tricky prompts that tempt hallucination) ─
  {
    prompt: "What is the capital of France?",
    expectedTool: "web_search",
    description: "Adversarial: factual Q should use search, not hallucinate",
    category: "adversarial",
  },
  {
    prompt:
      "I already know the answer, but please look up the current Node.js LTS version to confirm",
    expectedTool: "web_search",
    description: "Adversarial: 'I know the answer' bait — should still search",
    category: "adversarial",
    validateParams: (p) =>
      typeof p.query === "string" && (p.query as string).toLowerCase().includes("node"),
  },
  {
    prompt: "Don't use any tools. Just tell me how many agents are in the system.",
    expectedTool: "sessions_list",
    description: "Adversarial: explicit 'don't use tools' instruction — should still use tool",
    category: "adversarial",
  },

  // ── REASONING (must think about context before picking) ──
  {
    prompt:
      "Aegis flagged a vulnerability in our auth module yesterday. Follow up with Aegis to get the full report, then have John research CVE details for the same vulnerability.",
    expectedTool: "sessions_send",
    description: "Reasoning: multi-step but first action is follow-up (send to existing aegis)",
    category: "reasoning",
    validateParams: (p) =>
      typeof p.sessionKey === "string" && (p.sessionKey as string).toLowerCase().includes("aegis"),
  },
  {
    prompt:
      "Our TikTok ad campaign metrics dropped 30% this week. We need Kairos to investigate what happened with our social media performance.",
    expectedTool: "sessions_spawn",
    description: "Reasoning: new investigation task → spawn Kairos",
    category: "reasoning",
    validateParams: (p) =>
      (p.agentId as string)?.toLowerCase() === "kairos" &&
      typeof p.task === "string" &&
      (p.task as string).length > 20,
  },
  {
    prompt:
      "Before deploying, run the full test suite with 'pnpm test' and if it passes, also run 'pnpm build'",
    expectedTool: "exec",
    description: "Reasoning: conditional but first step is exec pnpm test",
    category: "reasoning",
    validateParams: (p) =>
      typeof p.command === "string" && (p.command as string).includes("pnpm test"),
  },
  {
    prompt:
      "Delete the cron job with id 'health-check-hourly' — it's been replaced by a new systemd timer",
    expectedTool: "cron",
    description: "Reasoning: delete specific cron by id",
    category: "reasoning",
    validateParams: (p) =>
      p.action === "delete" &&
      typeof p.id === "string" &&
      (p.id as string).includes("health-check"),
  },
];

// ═══════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════

interface TestResult {
  model: string;
  test: string;
  category: string;
  run: number;
  expectedTool: string | string[];
  actualTool: string | null;
  params: Record<string, unknown> | null;
  paramsCorrect: boolean;
  correct: boolean;
  latencyMs: number;
  hallucinated: boolean;
  error?: string;
  rawContent?: string;
}

async function callModel(
  model: string,
  prompt: string,
): Promise<{
  tool: string | null;
  toolCalls: Array<{ name: string; params: Record<string, unknown> }>;
  params: Record<string, unknown> | null;
  latencyMs: number;
  hallucinated: boolean;
  error?: string;
  rawContent?: string;
}> {
  const start = Date.now();
  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        tools: TOOLS,
        stream: false,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return {
        tool: null,
        toolCalls: [],
        params: null,
        latencyMs,
        hallucinated: false,
        error: `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
          content?: string;
        };
      }>;
    };

    const msg = data.choices?.[0]?.message;
    const rawToolCalls = msg?.tool_calls;
    const content = msg?.content ?? "";

    if (rawToolCalls && rawToolCalls.length > 0) {
      const parsed = rawToolCalls.map((tc) => {
        let params: Record<string, unknown> = {};
        try {
          params = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch {
          /* empty */
        }
        return { name: tc.function?.name ?? "unknown", params };
      });
      return {
        tool: parsed[0].name,
        toolCalls: parsed,
        params: parsed[0].params,
        latencyMs,
        hallucinated: false,
      };
    }

    return {
      tool: null,
      toolCalls: [],
      params: null,
      latencyMs,
      hallucinated: true,
      rawContent: content?.slice(0, 200),
    };
  } catch (e) {
    const latencyMs = Date.now() - start;
    return {
      tool: null,
      toolCalls: [],
      params: null,
      latencyMs,
      hallucinated: false,
      error: String(e),
    };
  }
}

function isCorrectTool(actual: string | null, expected: string | string[]): boolean {
  if (!actual) return false;
  if (Array.isArray(expected)) return expected.includes(actual);
  return actual === expected;
}

async function runTests() {
  const totalTests = TEST_CASES.length * RUNS_PER_TEST;
  console.log("=".repeat(90));
  console.log("  STRESS TEST: TOOL-CALLING MODEL COMPARISON");
  console.log("  Models:", MODELS.join(", "));
  console.log(
    `  Tests: ${TEST_CASES.length} scenarios x ${RUNS_PER_TEST} runs = ${totalTests} calls per model`,
  );
  console.log("  Categories: basic, ambiguous, complex_params, adversarial, reasoning");
  console.log("=".repeat(90));

  const allResults: TestResult[] = [];

  const categories = [...new Set(TEST_CASES.map((t) => t.category))];

  for (const cat of categories) {
    const catTests = TEST_CASES.filter((t) => t.category === cat);
    console.log(`\n${"═".repeat(90)}`);
    console.log(`  CATEGORY: ${cat.toUpperCase()} (${catTests.length} tests)`);
    console.log(`${"═".repeat(90)}`);

    for (const tc of catTests) {
      console.log(`\n  📋 ${tc.description}`);
      console.log(`     "${tc.prompt.slice(0, 80)}${tc.prompt.length > 80 ? "..." : ""}"`);
      console.log(
        `     Expected: ${Array.isArray(tc.expectedTool) ? tc.expectedTool.join(" | ") : tc.expectedTool}`,
      );

      for (let run = 1; run <= RUNS_PER_TEST; run++) {
        if (run === 1) console.log("     " + "-".repeat(75));

        // Run all models in parallel for this test+run
        const promises = MODELS.map(async (model) => {
          const { tool, params, latencyMs, hallucinated, error, rawContent } = await callModel(
            model,
            tc.prompt,
          );
          const correct = isCorrectTool(tool, tc.expectedTool);
          const paramsCorrect =
            correct && tc.validateParams ? tc.validateParams(params ?? {}) : correct;

          const result: TestResult = {
            model,
            test: tc.description,
            category: tc.category,
            run,
            expectedTool: tc.expectedTool,
            actualTool: tool,
            params,
            paramsCorrect,
            correct,
            latencyMs,
            hallucinated,
            error,
            rawContent,
          };
          allResults.push(result);
          return result;
        });

        const results = await Promise.all(promises);

        // Print run results
        const runLabel = `R${run}`;
        for (const r of results) {
          const icon = r.correct ? (r.paramsCorrect ? "✅" : "⚠️") : r.hallucinated ? "💬" : "❌";
          const modelShort = r.model.replace(":cloud", "").padEnd(20);
          const toolStr = (r.actualTool ?? "NONE").padEnd(16);
          const detail = !r.correct
            ? r.hallucinated
              ? ` hallucinated: "${r.rawContent?.slice(0, 50)}..."`
              : r.error
                ? ` error: ${r.error.slice(0, 40)}`
                : " wrong tool"
            : !r.paramsCorrect
              ? ` params wrong`
              : "";
          console.log(
            `     ${runLabel} ${icon} ${modelShort} → ${toolStr} ${String(r.latencyMs).padStart(6)}ms${detail}`,
          );
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DETAILED SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "=".repeat(90));
  console.log("  DETAILED RESULTS");
  console.log("=".repeat(90));

  for (const model of MODELS) {
    const mr = allResults.filter((r) => r.model === model);
    const modelShort = model.replace(":cloud", "");
    console.log(`\n  ┌─ ${modelShort} ${"─".repeat(70 - modelShort.length)}┐`);

    // Per-category breakdown
    for (const cat of categories) {
      const catResults = mr.filter((r) => r.category === cat);
      const correct = catResults.filter((r) => r.correct).length;
      const total = catResults.length;
      const paramOk = catResults.filter((r) => r.paramsCorrect).length;
      const halluc = catResults.filter((r) => r.hallucinated).length;
      const avgLat = Math.round(catResults.reduce((s, r) => s + r.latencyMs, 0) / total);
      const pct = Math.round((correct / total) * 100);
      const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
      console.log(
        `  │  ${cat.padEnd(16)} ${bar} ${String(pct).padStart(3)}%  tool=${correct}/${total}  params=${paramOk}/${total}  halluc=${halluc}  avg=${avgLat}ms`,
      );
    }

    // Overall
    const correct = mr.filter((r) => r.correct).length;
    const paramOk = mr.filter((r) => r.paramsCorrect).length;
    const halluc = mr.filter((r) => r.hallucinated).length;
    const avgLat = Math.round(mr.reduce((s, r) => s + r.latencyMs, 0) / mr.length);
    const maxLat = Math.max(...mr.map((r) => r.latencyMs));
    const p50 = mr.map((r) => r.latencyMs).sort((a, b) => a - b)[Math.floor(mr.length * 0.5)];
    const p95 = mr.map((r) => r.latencyMs).sort((a, b) => a - b)[Math.floor(mr.length * 0.95)];

    // Consistency: how often does it give same answer across runs?
    const testGroups = [...new Set(mr.map((r) => r.test))];
    let consistent = 0;
    for (const test of testGroups) {
      const runs = mr.filter((r) => r.test === test);
      const tools = runs.map((r) => r.actualTool);
      if (tools.every((t) => t === tools[0])) consistent++;
    }
    const consistencyPct = Math.round((consistent / testGroups.length) * 100);

    console.log(`  │  ${"─".repeat(76)}`);
    console.log(
      `  │  OVERALL:  tool=${correct}/${mr.length} (${Math.round((correct / mr.length) * 100)}%)  params=${paramOk}/${mr.length} (${Math.round((paramOk / mr.length) * 100)}%)  halluc=${halluc}`,
    );
    console.log(`  │  LATENCY:  avg=${avgLat}ms  p50=${p50}ms  p95=${p95}ms  max=${maxLat}ms`);
    console.log(`  │  CONSISTENCY: ${consistencyPct}% (same tool across ${RUNS_PER_TEST} runs)`);
    console.log(`  └${"─".repeat(78)}┘`);
  }

  // ═══════════════════════════════════════════════════════════════
  // FINAL RANKING
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "=".repeat(90));
  console.log("  FINAL RANKING");
  console.log("=".repeat(90));

  const scores = MODELS.map((model) => {
    const mr = allResults.filter((r) => r.model === model);
    const total = mr.length;
    const toolScore = mr.filter((r) => r.correct).length / total;
    const paramScore = mr.filter((r) => r.paramsCorrect).length / total;
    const hallucinationPenalty = mr.filter((r) => r.hallucinated).length / total;
    const avgLatency = mr.reduce((s, r) => s + r.latencyMs, 0) / total;
    const speedScore = Math.max(0, 1 - avgLatency / 120000);

    // Consistency bonus
    const testGroups = [...new Set(mr.map((r) => r.test))];
    let consistent = 0;
    for (const test of testGroups) {
      const runs = mr.filter((r) => r.test === test);
      if (runs.map((r) => r.actualTool).every((t) => t === runs[0].actualTool)) consistent++;
    }
    const consistencyScore = consistent / testGroups.length;

    // Weighted: tool (30%) + params (25%) + consistency (20%) + speed (15%) - hallucination (10%)
    const finalScore =
      toolScore * 30 +
      paramScore * 25 +
      consistencyScore * 20 +
      speedScore * 15 -
      hallucinationPenalty * 10;

    return {
      model,
      toolScore,
      paramScore,
      hallucinationPenalty,
      consistencyScore,
      speedScore,
      finalScore,
      avgLatency,
      total,
    };
  }).sort((a, b) => b.finalScore - a.finalScore);

  console.log(
    "\n  Weights: tool=30% | params=25% | consistency=20% | speed=15% | hallucination=-10%\n",
  );

  scores.forEach((s, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
    const modelShort = s.model.replace(":cloud", "");
    console.log(`  ${medal} #${i + 1} ${modelShort}`);
    console.log(`     Score: ${s.finalScore.toFixed(1)} / 90`);
    console.log(
      `     Tool: ${(s.toolScore * 100).toFixed(0)}%  Params: ${(s.paramScore * 100).toFixed(0)}%  Consistency: ${(s.consistencyScore * 100).toFixed(0)}%  Speed: ${(s.speedScore * 100).toFixed(0)}%  Halluc: ${(s.hallucinationPenalty * 100).toFixed(0)}%`,
    );
    console.log(`     Avg latency: ${Math.round(s.avgLatency)}ms`);
    console.log();
  });
}

runTests().catch(console.error);
