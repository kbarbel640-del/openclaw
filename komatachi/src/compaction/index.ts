/**
 * Compaction Module - Distilled from OpenClaw
 *
 * Summarizes conversation history to fit within token limits while
 * preserving important metadata (tool failures, file operations).
 *
 * Design principles:
 * - Fail clearly: If input is too large, throw rather than silently degrade
 * - Respect boundaries: Summarizer summarizes; caller decides what to give it
 * - Explicit state: No hidden registries or caches
 * - Auditable: Every decision traceable from input to output
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * A conversation message. Minimal type that captures what we need.
 * The actual message structure may be richer; we only access what we use.
 */
export interface Message {
  role: string;
  content: unknown;
  timestamp?: number;
  // Tool result specific fields (present when role === "toolResult")
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  details?: {
    status?: string;
    exitCode?: number;
  };
}

/**
 * Configuration for compaction.
 */
export interface CompactionConfig {
  /** Maximum tokens the summarization model can handle for input */
  maxInputTokens: number;
  /** Function to generate a summary from messages */
  summarize: (messages: Message[], previousSummary?: string) => Promise<string>;
  /** Optional: Instructions to guide summarization */
  customInstructions?: string;
  /** Optional: Previous summary to build upon */
  previousSummary?: string;
}

/**
 * Result of compaction.
 */
export interface CompactionResult {
  /** The generated summary */
  summary: string;
  /** Token count of input messages */
  inputTokens: number;
  /** Metadata extracted from the compacted messages */
  metadata: CompactionMetadata;
}

/**
 * Metadata extracted from messages during compaction.
 */
export interface CompactionMetadata {
  toolFailures: ToolFailure[];
  filesRead: string[];
  filesModified: string[];
}

/**
 * A tool invocation that failed.
 */
export interface ToolFailure {
  toolCallId: string;
  toolName: string;
  errorSummary: string;
  exitCode?: number;
}

/**
 * File operations tracked during a session.
 */
export interface FileOperations {
  read: Set<string>;
  edited: Set<string>;
  written: Set<string>;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Safety margin for token estimation. Token counting is imprecise,
 * so we apply a 20% buffer to avoid unexpected overflows.
 */
export const TOKEN_SAFETY_MARGIN = 1.2;

/**
 * Maximum portion of context window that input can occupy.
 * We need to leave room for the summary output and system prompt.
 */
const MAX_INPUT_RATIO = 0.75;

/** Maximum tool failures to include in summary */
const MAX_TOOL_FAILURES = 8;

/** Maximum characters per tool failure message */
const MAX_FAILURE_CHARS = 240;

/** Fallback text when summarization fails */
const FALLBACK_SUMMARY = "Summary unavailable. Older conversation history was truncated.";

// -----------------------------------------------------------------------------
// Token Estimation
// -----------------------------------------------------------------------------

/**
 * Estimate token count for a message.
 *
 * This is a rough approximation: ~4 characters per token for English text.
 * The safety margin compensates for underestimation.
 */
export function estimateTokens(message: Message): number {
  const content = message.content;
  let text: string;

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    // Content blocks (common in Claude API)
    text = content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object" && "text" in block) {
          return String(block.text);
        }
        return "";
      })
      .join("\n");
  } else {
    text = JSON.stringify(content);
  }

  // ~4 chars per token is a reasonable approximation for English
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens across multiple messages.
 */
export function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
}

// -----------------------------------------------------------------------------
// Input Validation
// -----------------------------------------------------------------------------

/**
 * Error thrown when input is too large to compact.
 */
export class InputTooLargeError extends Error {
  constructor(
    public readonly inputTokens: number,
    public readonly maxTokens: number
  ) {
    super(
      `Input too large to compact: ${inputTokens} tokens exceeds maximum ${maxTokens} tokens. ` +
      `Caller should reduce input size before attempting compaction.`
    );
    this.name = "InputTooLargeError";
  }
}

/**
 * Check if messages can be compacted within the given context window.
 */
export function canCompact(
  messages: Message[],
  maxInputTokens: number
): { ok: true } | { ok: false; reason: string; inputTokens: number } {
  const inputTokens = Math.ceil(estimateMessagesTokens(messages) * TOKEN_SAFETY_MARGIN);
  const effectiveMax = Math.floor(maxInputTokens * MAX_INPUT_RATIO);

  if (inputTokens > effectiveMax) {
    return {
      ok: false,
      reason: `Input (${inputTokens} tokens) exceeds limit (${effectiveMax} tokens)`,
      inputTokens,
    };
  }

  return { ok: true };
}

// -----------------------------------------------------------------------------
// Metadata Extraction
// -----------------------------------------------------------------------------

/**
 * Extract text content from a message's content field.
 */
function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter((block) => block && typeof block === "object" && block.type === "text")
    .map((block) => String(block.text || ""))
    .join("\n");
}

/**
 * Extract tool failures from messages.
 *
 * Tool failures are valuable context that should be preserved in summaries
 * so the agent doesn't repeat the same mistakes.
 */
export function extractToolFailures(messages: Message[]): ToolFailure[] {
  const failures: ToolFailure[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    if (message.role !== "toolResult" || !message.isError) continue;
    if (!message.toolCallId || seen.has(message.toolCallId)) continue;

    seen.add(message.toolCallId);

    const errorText = extractTextContent(message.content)
      .replace(/\s+/g, " ")
      .trim();

    const truncated =
      errorText.length > MAX_FAILURE_CHARS
        ? errorText.slice(0, MAX_FAILURE_CHARS - 3) + "..."
        : errorText || "failed (no output)";

    failures.push({
      toolCallId: message.toolCallId,
      toolName: message.toolName || "tool",
      errorSummary: truncated,
      exitCode: message.details?.exitCode,
    });
  }

  return failures;
}

/**
 * Compute file lists from file operations.
 * Modified files are those that were edited or written.
 * Read files exclude those that were also modified.
 */
export function computeFileLists(fileOps: FileOperations): {
  filesRead: string[];
  filesModified: string[];
} {
  const modified = new Set([...fileOps.edited, ...fileOps.written]);
  const filesRead = [...fileOps.read].filter((f) => !modified.has(f)).sort();
  const filesModified = [...modified].sort();
  return { filesRead, filesModified };
}

// -----------------------------------------------------------------------------
// Summary Formatting
// -----------------------------------------------------------------------------

/**
 * Format tool failures as a section to append to the summary.
 */
export function formatToolFailuresSection(failures: ToolFailure[]): string {
  if (failures.length === 0) return "";

  const lines = failures.slice(0, MAX_TOOL_FAILURES).map((f) => {
    const exit = f.exitCode !== undefined ? ` (exit ${f.exitCode})` : "";
    return `- ${f.toolName}${exit}: ${f.errorSummary}`;
  });

  if (failures.length > MAX_TOOL_FAILURES) {
    lines.push(`- ...and ${failures.length - MAX_TOOL_FAILURES} more`);
  }

  return `\n\n## Tool Failures\n${lines.join("\n")}`;
}

/**
 * Format file operations as a section to append to the summary.
 */
export function formatFileOperationsSection(
  filesRead: string[],
  filesModified: string[]
): string {
  const sections: string[] = [];

  if (filesRead.length > 0) {
    sections.push(`<read-files>\n${filesRead.join("\n")}\n</read-files>`);
  }
  if (filesModified.length > 0) {
    sections.push(`<modified-files>\n${filesModified.join("\n")}\n</modified-files>`);
  }

  return sections.length > 0 ? `\n\n${sections.join("\n\n")}` : "";
}

// -----------------------------------------------------------------------------
// Core Compaction
// -----------------------------------------------------------------------------

/**
 * Compact conversation history into a summary.
 *
 * This function:
 * 1. Validates that input is within acceptable size
 * 2. Extracts metadata (tool failures) from messages
 * 3. Generates a summary using the provided summarize function
 * 4. Appends metadata sections to the summary
 *
 * Throws InputTooLargeError if input exceeds limits. The caller is responsible
 * for reducing input size before calling this function.
 */
export async function compact(
  messages: Message[],
  fileOps: FileOperations,
  config: CompactionConfig
): Promise<CompactionResult> {
  // Handle empty input
  if (messages.length === 0) {
    const { filesRead, filesModified } = computeFileLists(fileOps);
    return {
      summary: config.previousSummary || "No prior conversation history.",
      inputTokens: 0,
      metadata: {
        toolFailures: [],
        filesRead,
        filesModified,
      },
    };
  }

  // Validate input size
  const inputTokens = Math.ceil(estimateMessagesTokens(messages) * TOKEN_SAFETY_MARGIN);
  const check = canCompact(messages, config.maxInputTokens);

  if (!check.ok) {
    throw new InputTooLargeError(check.inputTokens, config.maxInputTokens);
  }

  // Extract metadata
  const toolFailures = extractToolFailures(messages);
  const { filesRead, filesModified } = computeFileLists(fileOps);

  // Generate summary
  let summary: string;
  try {
    summary = await config.summarize(messages, config.previousSummary);
  } catch (error) {
    // Log the error but provide fallback
    console.warn(
      `Compaction summarization failed: ${error instanceof Error ? error.message : String(error)}`
    );
    summary = FALLBACK_SUMMARY;
  }

  // Append metadata sections
  summary += formatToolFailuresSection(toolFailures);
  summary += formatFileOperationsSection(filesRead, filesModified);

  return {
    summary,
    inputTokens,
    metadata: {
      toolFailures,
      filesRead,
      filesModified,
    },
  };
}

// -----------------------------------------------------------------------------
// Convenience: Create a summarizer for a model
// -----------------------------------------------------------------------------

/**
 * Options for creating a model-based summarizer.
 */
export interface SummarizerOptions {
  /** Model context window in tokens */
  contextWindow: number;
  /** Function to call the model for summarization */
  callModel: (prompt: string, signal?: AbortSignal) => Promise<string>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Custom instructions to include in the prompt */
  customInstructions?: string;
}

/**
 * Create a summarize function configured for a specific model.
 *
 * This is a convenience for creating the `summarize` function
 * expected by `compact()`.
 */
export function createSummarizer(
  options: SummarizerOptions
): (messages: Message[], previousSummary?: string) => Promise<string> {
  return async (messages: Message[], previousSummary?: string): Promise<string> => {
    const conversationText = messages
      .map((msg) => {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        return `[${msg.role}]: ${content}`;
      })
      .join("\n\n");

    let prompt = `Summarize this conversation, preserving:
- Key decisions made
- Outstanding tasks and TODOs
- Important constraints or requirements
- Any errors or failures that should be remembered

${options.customInstructions ? `Additional focus: ${options.customInstructions}\n\n` : ""}`;

    if (previousSummary) {
      prompt += `Previous context:\n${previousSummary}\n\n`;
    }

    prompt += `Conversation:\n${conversationText}`;

    return options.callModel(prompt, options.signal);
  };
}

/**
 * Calculate the maximum input tokens for a given context window.
 * Applies safety margins and reserves space for output.
 */
export function calculateMaxInputTokens(contextWindow: number): number {
  // Apply safety margin, then reserve space for output
  return Math.floor((contextWindow / TOKEN_SAFETY_MARGIN) * MAX_INPUT_RATIO);
}
