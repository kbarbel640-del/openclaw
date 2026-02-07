/**
 * PreResponse hook execution for reply pipeline.
 *
 * Validates agent responses using a cheap/fast LLM before sending to user.
 * If validation fails, returns feedback for the agent to regenerate.
 */

import type { Api, Context, Model } from "@mariozechner/pi-ai";
import { complete } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../config/config.js";
import type { PromptHookCommand } from "../../config/types.hooks.js";
import { resolveOpenClawAgentDir } from "../../agents/agent-paths.js";
import { getApiKeyForModel, requireApiKey } from "../../agents/model-auth.js";
import { ensureOpenClawModelsJson } from "../../agents/models-config.js";
import { discoverAuthStorage, discoverModels } from "../../agents/pi-model-discovery.js";
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
export async function executePreResponsePromptHook(
  params: PreResponseHookParams,
): Promise<PreResponseHookResult> {
  const { cfg, response, hook, workspaceDir } = params;
  const agentDir = params.agentDir ?? resolveOpenClawAgentDir();

  const modelRef = hook.model ?? DEFAULT_VALIDATION_MODEL;
  const [provider, modelId] = modelRef.includes("/")
    ? modelRef.split("/", 2)
    : ["anthropic", modelRef];

  if (!provider || !modelId) {
    return {
      passed: true,
      error: `Invalid model reference: ${modelRef}`,
    };
  }

  try {
    await ensureOpenClawModelsJson(cfg, agentDir);
    const authStorage = discoverAuthStorage(agentDir);
    const modelRegistry = discoverModels(authStorage, agentDir);
    const model = modelRegistry.find(provider, modelId) as Model<Api> | null;

    if (!model) {
      logVerbose(`[pre-response-hook] Unknown validation model: ${modelRef}, skipping validation`);
      return { passed: true, error: `Unknown model: ${modelRef}` };
    }

    const apiKeyInfo = await getApiKeyForModel({
      model,
      cfg,
      agentDir,
    });
    const apiKey = requireApiKey(apiKeyInfo, model.provider);
    authStorage.setRuntimeApiKey(model.provider, apiKey);

    // Build the validation prompt
    const validationPrompt = hook.prompt.replace("{{response}}", response);
    const fullPrompt = `${validationPrompt}\n\n---\n\nResponse to validate:\n${response}\n\n---\n\nIf the response follows all rules, reply with exactly: ${PASS_KEYWORD}\nIf there are violations, list them concisely.`;

    const context: Context = {
      messages: [
        {
          role: "user",
          content: fullPrompt,
          timestamp: Date.now(),
        },
      ],
    };

    logVerbose(`[pre-response-hook] Calling ${modelRef} for validation`);

    const message = await complete(model, context, {
      apiKey,
      maxTokens: hook.maxTokens ?? DEFAULT_MAX_TOKENS,
    });

    // Extract text from response
    let validatorResponse = "";
    if (typeof message.content === "string") {
      validatorResponse = message.content;
    } else if (Array.isArray(message.content)) {
      validatorResponse = message.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");
    }

    const trimmed = validatorResponse.trim();
    logVerbose(`[pre-response-hook] Validator response: ${trimmed.slice(0, 100)}...`);

    // Check if validation passed
    if (trimmed.toUpperCase().startsWith(PASS_KEYWORD)) {
      return { passed: true };
    }

    // Validation failed - return feedback
    return {
      passed: false,
      feedback: trimmed,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logVerbose(`[pre-response-hook] Validation error: ${errorMsg}`);
    // On error, pass through (don't block)
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
