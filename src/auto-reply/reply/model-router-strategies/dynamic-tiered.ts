import { completeSimple } from "@mariozechner/pi-ai";
import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../../../config/config.js";
import type { ModelRoutingStrategy, RoutingResult } from "./types.js";
import { resolveOpenClawAgentDir } from "../../../agents/agent-paths.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../../../agents/defaults.js";
import { getApiKeyForModel } from "../../../agents/model-auth.js";
import { parseModelRef } from "../../../agents/model-selection.js";
import { ensureOpenClawModelsJson } from "../../../agents/models-config.js";
import { resolveModel } from "../../../agents/pi-embedded-runner/model.js";
import { DEFAULT_AGENT_WORKSPACE_DIR } from "../../../agents/workspace.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";
import { resolveUserPath } from "../../../utils.js";

const routingLog = createSubsystemLogger("auto-reply/routing");

export type DynamicTieredOptions = {
  classifier: {
    model: string;
    timeoutMs?: number;
    promptFile?: string;
    heuristicsFile?: string;
  };
  tiers: {
    fast: string;
    standard: string;
    deep: string;
  };
  fallback?: "fast" | "standard" | "deep";
};

type TierName = "fast" | "standard" | "deep";

const DEFAULT_PROMPT_TEMPLATE = `Classify this user message by the complexity of response needed.

{{HEURISTICS}}

{{CONTEXT}}
User message:
"""
{{MESSAGE}}
"""

Respond with the tier followed by a colon and a brief reason (1-5 words).
Format: TIER: reason
Example: FAST: simple greeting`;

const DEFAULT_HEURISTICS = `FAST — ONLY use for standalone greetings ("hi", "hey"), standalone thanks ("thanks", "cheers"), and trivial chitchat that needs no tools, no lookups, and no context from prior messages. If the message could be a reply to something, it is NOT fast.

STANDARD — The default tier. Use for: questions, requests, follow-ups, corrections, instructions, web searches, skill execution, image descriptions, any message that references prior conversation ("it was", "move that", "change it", "actually", "no"), any message shorter than 10 words that isn't a clear greeting/thanks, and anything ambiguous.

DEEP — Food/diary logging (including corrections and follow-ups about meals), skill execution that involves data entry or multi-step scripting, complex multi-step reasoning, debugging code, architectural analysis, long-form writing, detailed summarization, or tasks requiring careful thought across multiple domains.

IMPORTANT RULES:
- When recent conversation context is provided, ALWAYS consider it. A short message in an ongoing task (food logging, debugging, planning) is STANDARD, not FAST.
- When in doubt between FAST and STANDARD, choose STANDARD.
- Messages with images or attachments are STANDARD at minimum.
- Corrections ("it was one slice", "no the other one", "actually...") are STANDARD because they require understanding and modifying prior work.
- Confirmations ("yes", "ok", "do it") in an ongoing task are STANDARD because the confirmed action needs execution.`;

async function readOptionalFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function writeFileIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await fs.writeFile(filePath, content, { encoding: "utf-8", flag: "wx" });
  } catch {
    // Silently ignore — seeding is best-effort (dir may not exist yet, permissions, etc.)
  }
}

async function resolveClassifierPrompt(
  classifier: DynamicTieredOptions["classifier"],
  recentContext?: string,
): Promise<string> {
  const usingDefaultPromptPath = !classifier.promptFile;
  const usingDefaultHeuristicsPath = !classifier.heuristicsFile;
  const promptPath = usingDefaultPromptPath
    ? path.join(DEFAULT_AGENT_WORKSPACE_DIR, "ROUTER.md")
    : resolveUserPath(classifier.promptFile!);
  const heuristicsPath = usingDefaultHeuristicsPath
    ? path.join(DEFAULT_AGENT_WORKSPACE_DIR, "ROUTER-HEURISTICS.md")
    : resolveUserPath(classifier.heuristicsFile!);

  const [promptContent, heuristicsContent] = await Promise.all([
    readOptionalFile(promptPath),
    readOptionalFile(heuristicsPath),
  ]);

  const template = promptContent ?? DEFAULT_PROMPT_TEMPLATE;
  const heuristics = heuristicsContent ?? DEFAULT_HEURISTICS;

  // Seed default files on first use so they're visible and editable.
  if (promptContent === null && usingDefaultPromptPath) {
    writeFileIfMissing(promptPath, DEFAULT_PROMPT_TEMPLATE).catch(() => {});
  }
  if (heuristicsContent === null && usingDefaultHeuristicsPath) {
    writeFileIfMissing(heuristicsPath, DEFAULT_HEURISTICS).catch(() => {});
  }

  let result = template.replace("{{HEURISTICS}}", heuristics);
  if (recentContext) {
    result = result.replace("{{CONTEXT}}", recentContext);
  } else {
    // Remove the placeholder line entirely when there's no context.
    result = result.replace(/\n?{{CONTEXT}}\n?/, "\n");
  }
  return result;
}

function parseTierFromResponse(text: string): { tier: TierName; detail?: string } | null {
  const cleaned = text.trim();
  const match = cleaned.match(/^(FAST|STANDARD|DEEP)\s*[:-]\s*(.+)/i);
  if (match) {
    const tierName = match[1].toUpperCase() as "FAST" | "STANDARD" | "DEEP";
    return { tier: tierName.toLowerCase() as TierName, detail: match[2].trim() };
  }

  const upper = cleaned.toUpperCase();
  if (upper === "FAST" || upper.startsWith("FAST")) {
    return { tier: "fast" };
  }
  if (upper === "STANDARD" || upper.startsWith("STANDARD")) {
    return { tier: "standard" };
  }
  if (upper === "DEEP" || upper.startsWith("DEEP")) {
    return { tier: "deep" };
  }
  return null;
}

function resolveTierModel(
  tier: TierName,
  tiers: DynamicTieredOptions["tiers"],
): { provider: string; model: string } | null {
  const raw = tiers[tier];
  if (!raw) {
    return null;
  }
  return parseModelRef(raw, DEFAULT_PROVIDER);
}

function parseOptions(options: Record<string, unknown>): DynamicTieredOptions | null {
  const classifier = options.classifier as DynamicTieredOptions["classifier"] | undefined;
  const tiers = options.tiers as DynamicTieredOptions["tiers"] | undefined;
  if (!classifier?.model || !tiers?.fast || !tiers?.standard || !tiers?.deep) {
    return null;
  }
  return {
    classifier,
    tiers,
    fallback: (options.fallback as TierName) ?? "standard",
  };
}

async function classifyMessage(params: {
  messageText: string;
  promptTemplate: string;
  config: OpenClawConfig;
  classifierModel: string;
  timeoutMs: number;
}): Promise<string> {
  const { messageText, promptTemplate, config, classifierModel, timeoutMs } = params;
  const classifierRef = parseModelRef(classifierModel, DEFAULT_PROVIDER);
  if (!classifierRef) {
    throw new Error("invalid-classifier-model");
  }

  const agentDir = resolveOpenClawAgentDir();
  await ensureOpenClawModelsJson(config, agentDir);

  const resolved = resolveModel(classifierRef.provider, classifierRef.model, agentDir, config);
  if (!resolved.model) {
    throw new Error(`resolve-error:${resolved.error ?? "no-model"}`);
  }

  const auth = await getApiKeyForModel({ model: resolved.model, cfg: config });
  // For aws-sdk mode (Bedrock), no explicit apiKey is needed — the AWS SDK
  // credential chain handles auth via env vars / profiles.
  const apiKey = auth.apiKey ?? "";

  const prompt = promptTemplate.replace("{{MESSAGE}}", messageText.slice(0, 2000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  try {
    const res = await completeSimple(
      resolved.model,
      {
        messages: [
          {
            role: "user",
            content: prompt,
            timestamp: Date.now(),
          },
        ],
      },
      {
        apiKey,
        maxTokens: 30,
        signal: controller.signal,
      },
    );

    return res.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text.trim())
      .join(" ")
      .trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dynamic tiered strategy: classifies messages using a fast LLM (e.g., Haiku)
 * and routes to FAST / STANDARD / DEEP tier models based on complexity.
 *
 * Options:
 *   classifier: { model: "provider/model", timeoutMs?: 3000, promptFile?: string, heuristicsFile?: string }
 *   tiers: { fast: "provider/model", standard: "provider/model", deep: "provider/model" }
 *   fallback?: "fast" | "standard" | "deep"  (default: "standard")
 */
export const dynamicTieredStrategy: ModelRoutingStrategy = {
  name: "dynamic-tiered",

  async route(params): Promise<RoutingResult> {
    const started = Date.now();
    const opts = parseOptions(params.options);

    if (!opts) {
      routingLog.warn("invalid routing options; falling back to primary model");
      return {
        tier: "primary",
        provider: params.primaryProvider,
        model: params.primaryModel,
        latencyMs: 0,
        reason: "fallback:invalid-options",
      };
    }

    const fallbackTier = opts.fallback ?? "standard";

    const buildFallback = (reason: string): RoutingResult => {
      const tierModel = resolveTierModel(fallbackTier, opts.tiers);
      return {
        tier: fallbackTier,
        provider: tierModel?.provider ?? DEFAULT_PROVIDER,
        model: tierModel?.model ?? DEFAULT_MODEL,
        latencyMs: Date.now() - started,
        reason,
      };
    };

    const messageText = params.ctx.CommandBody ?? params.ctx.RawBody ?? params.ctx.Body ?? "";
    if (!messageText.trim()) {
      return buildFallback("fallback:empty-message");
    }

    try {
      const promptTemplate = await resolveClassifierPrompt(opts.classifier, params.recentContext);

      const responseText = await classifyMessage({
        messageText,
        promptTemplate,
        config: params.config,
        classifierModel: opts.classifier.model,
        timeoutMs: opts.classifier.timeoutMs ?? 3000,
      });

      const classifierMs = Date.now() - started;
      const parsed = parseTierFromResponse(responseText);
      if (!parsed) {
        const result = buildFallback(`fallback:unparseable:${responseText.slice(0, 50)}`);
        routingLog.warn(
          `classifier unparseable response="${responseText.slice(0, 50)}" classifierMs=${classifierMs} fallback=${fallbackTier}`,
        );
        return result;
      }

      const tierModel = resolveTierModel(parsed.tier, opts.tiers);
      if (!tierModel) {
        const result = buildFallback(`fallback:no-tier-model:${parsed.tier}`);
        routingLog.warn(
          `no tier model for tier=${parsed.tier} classifierMs=${classifierMs} fallback=${fallbackTier}`,
        );
        return result;
      }

      const latencyMs = Date.now() - started;
      routingLog.info(
        `tier=${parsed.tier} model=${tierModel.model} reason=classifier detail="${parsed.detail ?? ""}" classifierMs=${classifierMs} latencyMs=${latencyMs} hasContext=${Boolean(params.recentContext)}`,
      );
      return {
        tier: parsed.tier,
        provider: tierModel.provider,
        model: tierModel.model,
        latencyMs,
        reason: "classifier",
        detail: parsed.detail,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("abort") || message.includes("AbortError")) {
        routingLog.warn(
          `classifier timeout after ${Date.now() - started}ms; fallback=${fallbackTier}`,
        );
        return buildFallback("fallback:timeout");
      }
      routingLog.warn(
        `classifier error="${message.slice(0, 100)}" after ${Date.now() - started}ms; fallback=${fallbackTier}`,
      );
      return buildFallback(`fallback:error:${message.slice(0, 100)}`);
    }
  },
};
