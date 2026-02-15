/**
 * PreResponse hook execution for reply pipeline.
 *
 * Validates agent responses using a cheap/fast LLM before sending to user.
 * If validation fails, returns feedback for the agent to regenerate.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../../config/config.js";
import type { PromptHookCommand } from "../../config/types.hooks.js";
import { resolveOpenClawAgentDir } from "../../agents/agent-paths.js";
import { logVerbose } from "../../globals.js";

const DEFAULT_VALIDATION_MODEL = "anthropic/claude-haiku-3.5";
const DEFAULT_MAX_TOKENS = 256;
const PASS_KEYWORD = "PASS";

/**
 * Result of PreResponse hook validation.
 */
export type PreResponseHookResult = {
  /** Whether the response passed validation */
  passed: boolean;
  /** Feedback from validator if validation failed */
  feedback?: string;
  /** Error message if hook execution failed */
  error?: string;
};

/**
 * Parameters for PreResponse hook execution.
 */
export type PreResponseHookParams = {
  /** OpenClaw configuration */
  cfg: OpenClawConfig;
  /** Agent's response text to validate */
  response: string;
  /** Prompt hook configuration */
  hook: PromptHookCommand;
  /** Working directory */
  workspaceDir?: string;
  /** Agent directory */
  agentDir?: string;
};

/**
 * Get configured PreResponse prompt hooks.
 *
 * @param cfg - OpenClaw configuration
 * @returns Array of PromptHookCommand entries for PreResponse
 */
export function getPreResponsePromptHooks(cfg: OpenClawConfig | undefined): PromptHookCommand[] {
  const agentHooks = cfg?.hooks?.agentHooks;

  if (agentHooks?.enabled === false) {
    return [];
  }

  const entries = agentHooks?.PreResponse;
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const promptHooks: PromptHookCommand[] = [];

  for (const entry of entries) {
    const hooks = entry.hooks;
    if (!Array.isArray(hooks)) {
      continue;
    }

    for (const hook of hooks) {
      if (hook.type === "prompt" && typeof hook.prompt === "string") {
        promptHooks.push(hook);
      }
    }
  }

  return promptHooks;
}

/**
 * Execute a single PreResponse prompt hook.
 *
 * Calls a validation model with the response and returns pass/fail result.
 */
/**
 * Resolve API key and endpoint for the validation model.
 * Reads from hook config (apiKey field), then falls back to env vars.
 */
function resolveValidationConfig(hook: PromptHookCommand): {
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
} {
  // Hook config can specify apiKey and baseUrl directly
  const apiKey = hook.apiKey ?? process.env.OPENROUTER_API_KEY;
  const baseUrl = hook.baseUrl ?? "https://openrouter.ai/api/v1";
  const model = hook.model ?? DEFAULT_VALIDATION_MODEL;
  return { apiKey, baseUrl, model };
}

export async function executePreResponsePromptHook(
  params: PreResponseHookParams,
): Promise<PreResponseHookResult> {
  const { response, hook } = params;
  const { apiKey, baseUrl, model } = resolveValidationConfig(hook);

  // DEBUG: log that we got here
  console.error(
    `[pre-response-hook] ENTERED, model=${model}, hasKey=${!!apiKey}, baseUrl=${baseUrl}`,
  );

  if (!apiKey) {
    logVerbose("[pre-response-hook] No API key found, skipping validation");
    return { passed: true, error: "No API key" };
  }

  try {
    // Build the validation prompt
    const validationPrompt = hook.prompt.replace("{{response}}", response);
    const fullPrompt = `${validationPrompt}\n\n---\n\nResponse to validate:\n${response}\n\n---\n\nIf the response follows all rules, reply with exactly: ${PASS_KEYWORD}\nIf there are violations, list them concisely.`;

    logVerbose(`[pre-response-hook] Calling ${model} via ${baseUrl} for validation`);

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: hook.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages: [{ role: "user", content: fullPrompt }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logVerbose(`[pre-response-hook] API error ${res.status}: ${errBody.slice(0, 200)}`);
      return { passed: true, error: `API ${res.status}` };
    }

    type ChatResponse = {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const body = (await res.json()) as ChatResponse;
    const trimmed = (body.choices?.[0]?.message?.content ?? "").trim();

    logVerbose(`[pre-response-hook] Validator response: ${trimmed.slice(0, 200)}...`);

    if (trimmed.toUpperCase().startsWith(PASS_KEYWORD)) {
      return { passed: true };
    }

    return { passed: false, feedback: trimmed };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logVerbose(`[pre-response-hook] Validation error: ${errorMsg}`);
    return { passed: true, error: errorMsg };
  }
}

/**
 * Execute all configured PreResponse hooks.
 *
 * @param cfg - OpenClaw configuration
 * @param response - Agent's response text
 * @param workspaceDir - Working directory
 * @param agentDir - Agent directory
 * @returns Combined result from all hooks
 */
export async function executePreResponseHooks(params: {
  cfg: OpenClawConfig;
  response: string;
  workspaceDir?: string;
  agentDir?: string;
}): Promise<PreResponseHookResult> {
  const { cfg, response, workspaceDir, agentDir } = params;

  const hooks = getPreResponsePromptHooks(cfg);

  if (hooks.length === 0) {
    return { passed: true };
  }

  logVerbose(`[pre-response-hook] Executing ${hooks.length} PreResponse hooks`);

  // Execute hooks sequentially (could parallelize but keeping simple for v1)
  for (const hook of hooks) {
    const result = await executePreResponsePromptHook({
      cfg,
      response,
      hook,
      workspaceDir,
      agentDir,
    });

    if (!result.passed) {
      return result;
    }
  }

  return { passed: true };
}
