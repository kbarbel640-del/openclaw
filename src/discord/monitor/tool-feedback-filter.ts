import { logVerbose } from "../../globals.js";
import { formatErrorMessage } from "../../infra/errors.js";
import { runCommandWithTimeout } from "../../process/exec.js";

const DEFAULT_BUFFER_MS = 3000;
const DEFAULT_MAX_WAIT_MS = 8000;
const DEFAULT_FILTER_MODEL = "haiku";
const DEFAULT_FILTER_TIMEOUT_MS = 5000;

type BufferedTool = {
  toolName: string;
  timestamp: number;
};

export type ToolFeedbackFilterConfig = {
  /** Buffer window: how long to wait for more tools before flushing. Default: 3000. */
  bufferMs?: number;
  /** Max time before flushing regardless of new tools. Default: 8000. */
  maxWaitMs?: number;
  /** Model for filtering. Default: haiku. */
  model?: string;
  /** Timeout for the model call. Default: 5000. */
  timeoutMs?: number;
};

type CliResponse = {
  result?: string;
  is_error?: boolean;
};

function parseCliResponse(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as CliResponse;
    if (parsed.is_error) {
      return null;
    }
    return parsed.result?.trim() || null;
  } catch {
    return trimmed || null;
  }
}

function summarizeToolBatch(tools: BufferedTool[]): string {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    counts.set(tool.toolName, (counts.get(tool.toolName) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => (count > 1 ? `${name} (x${count})` : name))
    .join(", ");
}

async function askHaikuToFilter(params: {
  userMessage: string;
  toolSummary: string;
  model: string;
  timeoutMs: number;
}): Promise<string | null> {
  const prompt =
    `You are deciding what status to show a user while an AI agent processes their request in a Discord server.\n\n` +
    `The user asked: "${params.userMessage}"\n\n` +
    `The agent just used these tools: ${params.toolSummary}\n\n` +
    `Rules:\n` +
    `- If the tools are routine exploration (reading files, searching code, globbing), respond with SKIP\n` +
    `- If the tools indicate meaningful progress (running commands, writing files, editing code, web searches, running subagents), ` +
    `write a brief natural status update (max 8 words, e.g. "Running tests..." or "Editing the configuration...")\n` +
    `- Only respond with SKIP or the status text, nothing else`;

  const args = [
    "--model",
    params.model,
    "-p",
    prompt,
    "--output-format",
    "json",
    "--max-turns",
    "1",
  ];

  try {
    const result = await runCommandWithTimeout(["claude", ...args], {
      timeoutMs: params.timeoutMs,
    });
    if (result.code !== 0) {
      logVerbose(`tool-feedback-filter: CLI exited with code ${result.code}`);
      return null;
    }
    const text = parseCliResponse(result.stdout);
    if (!text || text.toUpperCase().startsWith("SKIP")) {
      return null;
    }
    return text;
  } catch (err) {
    logVerbose(`tool-feedback-filter: failed: ${formatErrorMessage(err)}`);
    return null;
  }
}

/**
 * Create a buffered tool feedback filter that collects tool calls and uses Haiku
 * to decide which are worth showing to the user. Prevents spamming the status
 * message with every single Read/Glob/Grep call.
 */
export function createToolFeedbackFilter(params: {
  userMessage: string;
  onUpdate: (text: string) => void;
  config?: ToolFeedbackFilterConfig;
}): {
  push: (tool: { toolName: string; toolCallId: string }) => void;
  dispose: () => void;
} {
  const bufferMs = params.config?.bufferMs ?? DEFAULT_BUFFER_MS;
  const maxWaitMs = params.config?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const model = params.config?.model ?? DEFAULT_FILTER_MODEL;
  const timeoutMs = params.config?.timeoutMs ?? DEFAULT_FILTER_TIMEOUT_MS;

  const buffer: BufferedTool[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
  let flushing = false;
  let disposed = false;

  async function flush() {
    if (buffer.length === 0 || flushing || disposed) {
      return;
    }
    flushing = true;

    // Take all buffered tools
    const batch = buffer.splice(0, buffer.length);

    // Clear timers
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    if (maxWaitTimer) {
      clearTimeout(maxWaitTimer);
      maxWaitTimer = undefined;
    }

    try {
      const toolSummary = summarizeToolBatch(batch);
      logVerbose(`tool-feedback-filter: flushing batch: ${toolSummary}`);

      const status = await askHaikuToFilter({
        userMessage: params.userMessage,
        toolSummary,
        model,
        timeoutMs,
      });

      if (status && !disposed) {
        params.onUpdate(`*${status}*`);
      }
    } catch (err) {
      logVerbose(`tool-feedback-filter: flush failed: ${formatErrorMessage(err)}`);
    } finally {
      flushing = false;
    }
  }

  function push(tool: { toolName: string; toolCallId: string }) {
    if (disposed) {
      return;
    }
    buffer.push({ toolName: tool.toolName, timestamp: Date.now() });

    // Reset debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => void flush(), bufferMs);

    // Start max-wait timer on first tool in batch
    if (!maxWaitTimer) {
      maxWaitTimer = setTimeout(() => void flush(), maxWaitMs);
    }
  }

  function dispose() {
    disposed = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    if (maxWaitTimer) {
      clearTimeout(maxWaitTimer);
      maxWaitTimer = undefined;
    }
  }

  return { push, dispose };
}
