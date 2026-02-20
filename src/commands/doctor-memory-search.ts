import fsSync from "node:fs";
import { resolveAgentDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { resolveMemorySearchConfig } from "../agents/memory-search.js";
import { resolveApiKeyForProvider } from "../agents/model-auth.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { OpenClawConfig } from "../config/config.js";
import { note } from "../terminal/note.js";
import { resolveUserPath } from "../utils.js";

/**
 * Resolve the active memory plugin name from config, if any.
 * Returns the plugin ID (e.g. "memory-neo4j") or null if no plugin is configured.
 *
 * Reads the raw config file because loadConfig() may strip fields
 * when the config schema is out of sync with the actual file.
 */
function resolveMemoryPlugin(cfg: OpenClawConfig): string | null {
  // First try the parsed config
  const pluginsEnabled = cfg.plugins?.enabled !== false;
  if (pluginsEnabled) {
    const slot =
      typeof cfg.plugins?.slots?.memory === "string" ? cfg.plugins.slots.memory.trim() : "";
    if (slot && slot.toLowerCase() !== "none") {
      return slot;
    }
  }

  // Fallback: read raw config file in case loadConfig() stripped the plugins section
  try {
    const configPath = resolveUserPath("~/.openclaw/openclaw.json");
    const raw = JSON.parse(fsSync.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    const plugins = raw.plugins as Record<string, unknown> | undefined;
    if (plugins?.enabled === false) {
      return null;
    }
    const slots = plugins?.slots as Record<string, unknown> | undefined;
    const slot = typeof slots?.memory === "string" ? slots.memory.trim() : "";
    if (slot && slot.toLowerCase() !== "none") {
      return slot;
    }
  } catch {
    // Config file read failed — fall through
  }

  return null;
}

/**
 * Check whether memory search has a usable embedding provider.
 * Runs as part of `openclaw doctor` — config-only, no network calls.
 *
 * When a memory plugin (e.g. memory-neo4j) is configured, it handles
 * its own embedding and recall — the built-in memorySearch config is
 * not required, so we report the plugin status instead.
 */
export async function noteMemorySearchHealth(cfg: OpenClawConfig): Promise<void> {
  const agentId = resolveDefaultAgentId(cfg);
  const agentDir = resolveAgentDir(cfg, agentId);
  const resolved = resolveMemorySearchConfig(cfg, agentId);
  const hasRemoteApiKey = Boolean(resolved?.remote?.apiKey?.trim());

  // Check if a memory plugin handles recall instead of the built-in search.
  // When a plugin is active, it manages its own embeddings and recall —
  // the built-in memorySearch config is irrelevant.
  const memoryPlugin = resolveMemoryPlugin(cfg);
  if (memoryPlugin) {
    note(
      `Memory recall is handled by plugin "${memoryPlugin}" (built-in memorySearch not needed).`,
      "Memory search",
    );
    return;
  }

  if (!resolved) {
    note("Memory search is explicitly disabled (enabled: false).", "Memory search");
    return;
  }

  // If a specific provider is configured (not "auto"), check only that one.
  if (resolved.provider !== "auto") {
    if (resolved.provider === "local") {
      if (hasLocalEmbeddings(resolved.local)) {
        return; // local model file exists
      }
      note(
        [
          'Memory search provider is set to "local" but no local model file was found.',
          "",
          "Fix (pick one):",
          `- Install node-llama-cpp and set a local model path in config`,
          `- Switch to a remote provider: ${formatCliCommand("openclaw config set agents.defaults.memorySearch.provider openai")}`,
          "",
          `Verify: ${formatCliCommand("openclaw memory status --deep")}`,
        ].join("\n"),
        "Memory search",
      );
      return;
    }
    // Remote provider — check for API key
    if (hasRemoteApiKey || (await hasApiKeyForProvider(resolved.provider, cfg, agentDir))) {
      return;
    }
    const envVar = providerEnvVar(resolved.provider);
    note(
      [
        `Memory search provider is set to "${resolved.provider}" but no API key was found.`,
        `Semantic recall will not work without a valid API key.`,
        "",
        "Fix (pick one):",
        `- Set ${envVar} in your environment`,
        `- Add credentials: ${formatCliCommand(`openclaw auth add --provider ${resolved.provider}`)}`,
        `- To disable: ${formatCliCommand("openclaw config set agents.defaults.memorySearch.enabled false")}`,
        "",
        `Verify: ${formatCliCommand("openclaw memory status --deep")}`,
      ].join("\n"),
      "Memory search",
    );
    return;
  }

  // provider === "auto": check all providers in resolution order
  if (hasLocalEmbeddings(resolved.local)) {
    return;
  }
  for (const provider of ["openai", "gemini", "voyage"] as const) {
    if (hasRemoteApiKey || (await hasApiKeyForProvider(provider, cfg, agentDir))) {
      return;
    }
  }

  note(
    [
      "Memory search is enabled but no embedding provider is configured.",
      "Semantic recall will not work without an embedding provider.",
      "",
      "Fix (pick one):",
      "- Set OPENAI_API_KEY or GEMINI_API_KEY in your environment",
      `- Add credentials: ${formatCliCommand("openclaw auth add --provider openai")}`,
      `- For local embeddings: configure agents.defaults.memorySearch.provider and local model path`,
      `- To disable: ${formatCliCommand("openclaw config set agents.defaults.memorySearch.enabled false")}`,
      "",
      `Verify: ${formatCliCommand("openclaw memory status --deep")}`,
    ].join("\n"),
    "Memory search",
  );
}

function hasLocalEmbeddings(local: { modelPath?: string }): boolean {
  const modelPath = local.modelPath?.trim();
  if (!modelPath) {
    return false;
  }
  // Remote/downloadable models (hf: or http:) aren't pre-resolved on disk,
  // so we can't confirm availability without a network call. Treat as
  // potentially available — the user configured it intentionally.
  if (/^(hf:|https?:)/i.test(modelPath)) {
    return true;
  }
  const resolved = resolveUserPath(modelPath);
  try {
    return fsSync.statSync(resolved).isFile();
  } catch {
    return false;
  }
}

async function hasApiKeyForProvider(
  provider: "openai" | "gemini" | "voyage",
  cfg: OpenClawConfig,
  agentDir: string,
): Promise<boolean> {
  // Map embedding provider names to model-auth provider names
  const authProvider = provider === "gemini" ? "google" : provider;
  try {
    await resolveApiKeyForProvider({ provider: authProvider, cfg, agentDir });
    return true;
  } catch {
    return false;
  }
}

function providerEnvVar(provider: string): string {
  switch (provider) {
    case "openai":
      return "OPENAI_API_KEY";
    case "gemini":
      return "GEMINI_API_KEY";
    case "voyage":
      return "VOYAGE_API_KEY";
    default:
      return `${provider.toUpperCase()}_API_KEY`;
  }
}
