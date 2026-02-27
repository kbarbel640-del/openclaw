/**
 * Live integration test for the dynamic-tiered classifier.
 *
 * Sends real messages to Haiku and validates classification accuracy.
 * Excluded from normal test runs (*.live.test.ts pattern).
 *
 * Run on demand:
 *   LIVE=1 npx vitest run test/classifier-routing.live.test.ts
 */
import { completeSimple } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { resolveOpenClawAgentDir } from "../src/agents/agent-paths.js";
import { getApiKeyForModel } from "../src/agents/model-auth.js";
import { parseModelRef } from "../src/agents/model-selection.js";
import { ensureOpenClawModelsJson } from "../src/agents/models-config.js";
import { resolveModel } from "../src/agents/pi-embedded-runner/model.js";
import { loadConfig } from "../src/config/io.js";

const CLASSIFIER_MODEL = "amazon-bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0";
const TIMEOUT_MS = 10_000;
const MAX_TOKENS = 30;

const PROMPT_TEMPLATE = `Classify this user message by the complexity of response needed.

FAST — Greetings, confirmations, simple factual lookups, running a known command or skill, yes/no answers, short responses.
STANDARD — General conversation, moderate reasoning, multi-step but straightforward tasks, most questions.
DEEP — Analysis of large content, complex reasoning chains, debugging, creative writing, summarization, architectural decisions.

User message:
"""
{{MESSAGE}}
"""

Respond with the tier followed by a colon and a brief reason (1-5 words).
Format: TIER: reason
Example: FAST: simple greeting`;

type TierName = "fast" | "standard" | "deep";

function parseTier(text: string): { tier: TierName; detail: string } | null {
  const cleaned = text.trim();
  const match = cleaned.match(/^(FAST|STANDARD|DEEP)\s*[:-]\s*(.+)/i);
  if (match) {
    return {
      tier: match[1].toUpperCase().toLowerCase() as TierName,
      detail: match[2].trim(),
    };
  }
  const upper = cleaned.toUpperCase();
  for (const t of ["FAST", "STANDARD", "DEEP"] as const) {
    if (upper === t || upper.startsWith(t)) {
      return { tier: t.toLowerCase() as TierName, detail: "" };
    }
  }
  return null;
}

async function classify(message: string): Promise<{ tier: TierName; detail: string; raw: string }> {
  const config = loadConfig();
  const ref = parseModelRef(CLASSIFIER_MODEL, "amazon-bedrock");
  if (!ref) {
    throw new Error(`Cannot parse model ref: ${CLASSIFIER_MODEL}`);
  }

  const agentDir = resolveOpenClawAgentDir();
  await ensureOpenClawModelsJson(config, agentDir);

  const resolved = resolveModel(ref.provider, ref.model, agentDir, config);
  if (!resolved.model) {
    throw new Error(`Cannot resolve model: ${resolved.error ?? "unknown"}`);
  }

  const auth = await getApiKeyForModel({ model: resolved.model, cfg: config });
  // For aws-sdk mode (Bedrock), no explicit apiKey is needed — the AWS SDK
  // credential chain handles auth via env vars / profiles.
  const apiKey = auth.apiKey ?? "";

  const prompt = PROMPT_TEMPLATE.replace("{{MESSAGE}}", message.slice(0, 2000));

  const res = await completeSimple(
    resolved.model,
    { messages: [{ role: "user", content: prompt, timestamp: Date.now() }] },
    { apiKey, maxTokens: MAX_TOKENS },
  );

  const raw = res.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text.trim())
    .join(" ")
    .trim();

  const parsed = parseTier(raw);
  if (!parsed) {
    throw new Error(`Unparseable response for "${message}": ${raw}`);
  }

  return { tier: parsed.tier, detail: parsed.detail, raw };
}

type TestCase = { message: string; expected: TierName };

const FAST_CASES: TestCase[] = [
  { message: "Good morning", expected: "fast" },
  { message: "Thanks!", expected: "fast" },
  { message: "Yes", expected: "fast" },
  { message: "Run the surf report", expected: "fast" },
  { message: "What's the time?", expected: "fast" },
  { message: "Hi Nova", expected: "fast" },
  { message: "Ok sounds good", expected: "fast" },
];

const STANDARD_CASES: TestCase[] = [
  { message: "How should I structure my API endpoints?", expected: "standard" },
  { message: "What are the pros and cons of TypeScript vs JavaScript?", expected: "standard" },
  { message: "Help me write a function to validate email addresses", expected: "standard" },
  { message: "Explain how Docker networking works", expected: "standard" },
  { message: "What's the best way to handle errors in async functions?", expected: "standard" },
];

const DEEP_CASES: TestCase[] = [
  {
    message:
      "Analyze the architectural tradeoffs between microservices and a monolith for our " +
      "e-commerce platform. Consider scalability, team structure, deployment complexity, " +
      "data consistency, and operational overhead.",
    expected: "deep",
  },
  {
    message:
      "I have a race condition in my distributed cache invalidation system. Multiple nodes " +
      "are sometimes serving stale data after writes. Walk me through debugging this step by " +
      "step and suggest a solution.",
    expected: "deep",
  },
  {
    message:
      "Write a comprehensive technical design document for adding real-time collaboration " +
      "to our note-taking app, including conflict resolution strategy.",
    expected: "deep",
  },
];

const ALL_CASES = [...FAST_CASES, ...STANDARD_CASES, ...DEEP_CASES];

describe("classifier routing (live)", () => {
  it(
    "classifies all test messages and reports accuracy",
    async () => {
      const results: Array<
        TestCase & { actual: TierName; detail: string; raw: string; pass: boolean }
      > = [];

      // Run sequentially to avoid rate limiting
      for (const tc of ALL_CASES) {
        const { tier, detail, raw } = await classify(tc.message);
        results.push({
          ...tc,
          actual: tier,
          detail,
          raw,
          pass: tier === tc.expected,
        });
      }

      // Report
      const passed = results.filter((r) => r.pass);
      const failed = results.filter((r) => !r.pass);

      console.log("\n--- Classifier Accuracy Report ---");
      console.log(`Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`);
      console.log(`Accuracy: ${((passed.length / results.length) * 100).toFixed(1)}%\n`);

      for (const r of results) {
        const icon = r.pass ? "PASS" : "FAIL";
        const msg = r.message.length > 60 ? r.message.slice(0, 57) + "..." : r.message;
        console.log(`  [${icon}] "${msg}"`);
        console.log(`         expected=${r.expected} actual=${r.actual} raw="${r.raw}"`);
      }

      if (failed.length > 0) {
        console.log("\n--- Failures ---");
        for (const r of failed) {
          console.log(`  "${r.message}"`);
          console.log(`    expected=${r.expected} actual=${r.actual} raw="${r.raw}"`);
        }
      }

      // Require at least 80% accuracy — allows some flexibility for borderline cases
      const accuracy = passed.length / results.length;
      expect(accuracy).toBeGreaterThanOrEqual(0.8);
    },
    TIMEOUT_MS * ALL_CASES.length,
  );

  it(
    "response format is TIER: reason",
    async () => {
      const { raw } = await classify("Hello!");
      expect(raw).toMatch(/^(FAST|STANDARD|DEEP)\s*[:-]\s*.+/i);
    },
    TIMEOUT_MS,
  );

  it(
    "every response is parseable",
    async () => {
      // Test a few from each tier
      const samples = [FAST_CASES[0], STANDARD_CASES[0], DEEP_CASES[0]];
      for (const tc of samples) {
        const { tier, detail } = await classify(tc.message);
        expect(["fast", "standard", "deep"]).toContain(tier);
        expect(typeof detail).toBe("string");
      }
    },
    TIMEOUT_MS * 3,
  );
});
