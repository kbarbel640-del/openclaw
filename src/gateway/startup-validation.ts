/**
 * Gateway startup validation.
 * Ensures the gateway can serve requests before accepting connections.
 */
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import { resolveConfiguredModelRef } from "../agents/model-selection.js";
import { ensureMoltbotModelsJson } from "../agents/models-config.js";
import { resolveModel } from "../agents/pi-embedded-runner/model.js";
import type { MoltbotConfig } from "../config/config.js";

export type StartupValidationResult = {
  ok: boolean;
  defaultModel?: { provider: string; model: string };
  error?: string;
  suggestions?: string[];
};

/**
 * Generate actionable suggestions based on the error message.
 */
function generateSuggestions(error: string, provider: string): string[] {
  const suggestions: string[] = [];

  // Ollama-specific suggestions
  if (provider === "ollama") {
    if (error.includes("Unknown model")) {
      suggestions.push("Start Ollama: ollama serve");
      suggestions.push("Pull the model: ollama pull llama3:chat");
      suggestions.push(
        "Or configure a different model: moltbot config set agents.defaults.model.primary anthropic/claude-sonnet-4-5",
      );
    }
  }

  // Anthropic-specific suggestions
  if (provider === "anthropic") {
    if (error.includes("Unknown model") || error.includes("No API key")) {
      suggestions.push("Set API key: export ANTHROPIC_API_KEY=your-key");
      suggestions.push(
        "Or configure Ollama: moltbot config set agents.defaults.model.primary ollama/llama3:chat",
      );
    }
  }

  // OpenAI-specific suggestions
  if (provider === "openai") {
    if (error.includes("Unknown model") || error.includes("No API key")) {
      suggestions.push("Set API key: export OPENAI_API_KEY=your-key");
    }
  }

  // Generic suggestions
  if (suggestions.length === 0) {
    suggestions.push(`Check provider configuration for ${provider}`);
    suggestions.push("Run: moltbot models list --status to see available models");
  }

  return suggestions;
}

/**
 * Validate gateway startup prerequisites.
 * Checks that the configured default model can be resolved.
 *
 * @param cfg - The loaded configuration
 * @param agentDir - The agent directory path
 * @returns Validation result with ok status and error details if failed
 */
export async function validateGatewayStartup(
  cfg: MoltbotConfig,
  agentDir: string,
): Promise<StartupValidationResult> {
  // Skip validation if explicitly disabled (for testing)
  if (process.env.CLAWDBOT_SKIP_STARTUP_VALIDATION === "1") {
    return { ok: true };
  }

  // 1. Ensure models.json is written (triggers provider discovery)
  try {
    await ensureMoltbotModelsJson(cfg, agentDir);
  } catch (err) {
    return {
      ok: false,
      error: `Failed to initialize model configuration: ${err instanceof Error ? err.message : String(err)}`,
      suggestions: ["Check disk permissions for agent directory", "Run: moltbot doctor"],
    };
  }

  // 2. Resolve the configured default model
  const { provider: defaultProvider, model: defaultModel } = resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });

  // 3. Try to resolve the actual model from the registry
  const { model, error } = resolveModel(defaultProvider, defaultModel, agentDir, cfg);

  if (!model) {
    return {
      ok: false,
      defaultModel: { provider: defaultProvider, model: defaultModel },
      error: error ?? `Unknown model: ${defaultProvider}/${defaultModel}`,
      suggestions: generateSuggestions(error ?? "", defaultProvider),
    };
  }

  return {
    ok: true,
    defaultModel: { provider: defaultProvider, model: defaultModel },
  };
}

/**
 * Format validation error for display.
 */
export function formatValidationError(result: StartupValidationResult): string {
  if (result.ok) return "";

  const lines: string[] = [];
  lines.push(`Gateway startup validation failed: ${result.error}`);

  if (result.defaultModel) {
    lines.push(`  Configured model: ${result.defaultModel.provider}/${result.defaultModel.model}`);
  }

  if (result.suggestions && result.suggestions.length > 0) {
    lines.push("");
    lines.push("Suggestions:");
    for (const suggestion of result.suggestions) {
      lines.push(`  - ${suggestion}`);
    }
  }

  return lines.join("\n");
}
