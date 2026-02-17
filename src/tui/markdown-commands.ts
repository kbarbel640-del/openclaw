/**
 * Markdown command integration for TUI and auto-reply.
 *
 * Bridges the markdown command definitions (Phase 2) into
 * the TUI slash command system and auto-reply command registry.
 */

import os from "node:os";
import type { SlashCommand } from "@mariozechner/pi-tui";
import { buildCommandPrompt } from "../commands/definitions/executor.js";
import { loadCommandDefinitions } from "../commands/definitions/loader.js";
import type {
  CommandDefinition,
  CommandDefinitionLoadResult,
} from "../commands/definitions/types.js";
import { resolveStateDir } from "../config/paths.js";

/** Cached markdown command definitions. */
let cachedResult: CommandDefinitionLoadResult | null = null;
let cachedStateDir: string | undefined;
let cachedWorkspaceDir: string | undefined;

/**
 * Load and cache markdown command definitions.
 */
export function getMarkdownCommandDefinitions(params?: {
  workspaceDir?: string;
}): CommandDefinition[] {
  const stateDir = resolveStateDir(process.env, os.homedir);
  const workspaceDir = params?.workspaceDir;

  if (cachedResult && cachedStateDir === stateDir && cachedWorkspaceDir === workspaceDir) {
    return cachedResult.commands;
  }

  const result = loadCommandDefinitions({ stateDir, workspaceDir });

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.warn(`Command definition error in ${err.filePath}: ${err.error}`);
    }
  }

  cachedResult = result;
  cachedStateDir = stateDir;
  cachedWorkspaceDir = workspaceDir;
  return result.commands;
}

/**
 * Get SlashCommand entries for all markdown-defined commands.
 *
 * These are merged into the TUI's slash command autocomplete list.
 */
export function getMarkdownSlashCommands(params?: { workspaceDir?: string }): SlashCommand[] {
  const commands = getMarkdownCommandDefinitions(params);
  return commands
    .filter((cmd) => cmd.userInvocable)
    .map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
    }));
}

/**
 * Try to match and resolve a markdown command from user input.
 *
 * Returns the expanded prompt if matched, or null if not a markdown command.
 */
export function resolveMarkdownCommand(
  commandName: string,
  args?: string,
  params?: { workspaceDir?: string },
): string | null {
  const commands = getMarkdownCommandDefinitions(params);
  const command = commands.find((c) => c.name === commandName);
  if (!command) {
    return null;
  }
  return buildCommandPrompt(command, args);
}

/**
 * Clear the markdown command cache (for testing or reload).
 */
export function clearMarkdownCommandCache(): void {
  cachedResult = null;
  cachedStateDir = undefined;
  cachedWorkspaceDir = undefined;
}
