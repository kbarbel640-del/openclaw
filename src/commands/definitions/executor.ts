/**
 * Markdown command executor.
 *
 * Executes a markdown-defined command by building a prompt
 * from the command definition and passing it through the agent runtime.
 */

import type { CommandDefinition } from "./types.js";

/**
 * Build the effective prompt for a markdown command.
 *
 * Supports `{{args}}` template variable substitution.
 */
export function buildCommandPrompt(command: CommandDefinition, args?: string): string {
  let prompt = command.promptTemplate;

  // Substitute {{args}} placeholder with the user-provided arguments
  if (args) {
    prompt = prompt.replace(/\{\{args\}\}/g, args);
  } else {
    prompt = prompt.replace(/\{\{args\}\}/g, "");
  }

  return prompt.trim();
}

/**
 * Build a ChatCommandDefinition-compatible spec for use in the auto-reply system.
 */
export function commandDefinitionToSpec(command: CommandDefinition): {
  name: string;
  description: string;
  acceptsArgs: boolean;
  isMarkdownDefined: true;
} {
  return {
    name: command.name,
    description: command.description,
    acceptsArgs: command.acceptsArgs,
    isMarkdownDefined: true,
  };
}
