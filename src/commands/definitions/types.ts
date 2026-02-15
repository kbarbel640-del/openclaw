/**
 * Markdown-based command definition types.
 *
 * Allows defining new slash commands via `.md` files
 * that are automatically registered in the TUI and auto-reply systems.
 */

/**
 * Parsed command definition from a markdown file.
 *
 * Frontmatter fields:
 * ```yaml
 * ---
 * name: review
 * description: Review code changes for quality
 * allowed-tools: [web-search, web-fetch, memory, message]
 * user-invocable: true
 * model: claude-sonnet-4-5
 * ---
 * Review the current code changes...
 * ```
 */
export type CommandDefinition = {
  /** Command name used as /name in TUI. Derived from filename if not in frontmatter. */
  name: string;
  /** User-visible description shown in /help. */
  description: string;
  /** Whether users can invoke this command directly (default: true). */
  userInvocable: boolean;
  /** Whether this command accepts arguments after the command name. */
  acceptsArgs: boolean;
  /** Preferred model for executing this command. */
  model?: string;
  /** Allowed tools when executing this command's prompt. */
  allowedTools?: string[];
  /** The prompt template (markdown body after frontmatter). */
  promptTemplate: string;
  /** Source file path for debugging. */
  filePath: string;
};

/**
 * Result of loading command definitions from disk.
 */
export type CommandDefinitionLoadResult = {
  commands: CommandDefinition[];
  errors: Array<{ filePath: string; error: string }>;
};
