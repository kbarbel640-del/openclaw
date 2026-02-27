import fsp from "node:fs/promises";

/** Known model short names extracted from model ID strings. */
const MODEL_SHORT_NAMES: Array<[pattern: string, label: string]> = [
  ["opus", "opus"],
  ["sonnet", "sonnet"],
  ["haiku", "haiku"],
  ["gpt-4o-mini", "gpt-4o-mini"],
  ["gpt-4o", "gpt-4o"],
  ["gpt-4", "gpt-4"],
  ["o3", "o3"],
  ["o1", "o1"],
  ["gemini", "gemini"],
  ["mistral", "mistral"],
  ["llama", "llama"],
  ["deepseek", "deepseek"],
  ["command", "command"],
];

export function extractModelLabel(modelId: string | undefined): string | undefined {
  if (!modelId) {
    return undefined;
  }
  const lower = modelId.toLowerCase();
  for (const [pattern, label] of MODEL_SHORT_NAMES) {
    if (lower.includes(pattern)) {
      return label;
    }
  }
  // Unknown model — truncate the raw ID.
  return modelId.length > 20 ? `${modelId.slice(0, 20)}…` : modelId;
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (block): block is { type: "text"; text: string } =>
          typeof block === "object" &&
          block !== null &&
          block.type === "text" &&
          typeof block.text === "string",
      )
      .map((block) => block.text)
      .join(" ");
  }
  return "";
}

type SessionMessage = {
  role: "user" | "assistant";
  text: string;
  model?: string;
};

/**
 * System-generated "user" messages that should not be treated as real
 * conversation context for the classifier. These are internal prompts
 * injected by the framework, not actual user input.
 */
const SYSTEM_MESSAGE_PREFIXES = [
  "A new session was started via",
  "Pre-compaction memory flush",
  "GatewayRestart:",
];

function isSystemMessage(text: string): boolean {
  const trimmed = text.trimStart();
  return SYSTEM_MESSAGE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * Read the tail of a session JSONL file and extract recent user/assistant messages.
 *
 * This is best-effort: any error returns `undefined` so routing is never blocked.
 */
export async function loadRecentSessionContext(params: {
  sessionFile: string;
  messageCount?: number;
  truncateChars?: number;
}): Promise<string | undefined> {
  const { sessionFile, messageCount = 5, truncateChars = 200 } = params;

  try {
    // Read last ~16KB of the file for efficiency.
    const TAIL_BYTES = 16 * 1024;
    let raw: string;

    const stat = await fsp.stat(sessionFile);
    if (stat.size === 0) {
      return undefined;
    }

    if (stat.size <= TAIL_BYTES) {
      raw = await fsp.readFile(sessionFile, "utf-8");
    } else {
      const buf = Buffer.alloc(TAIL_BYTES);
      const fd = await fsp.open(sessionFile, "r");
      try {
        await fd.read(buf, 0, TAIL_BYTES, stat.size - TAIL_BYTES);
      } finally {
        await fd.close();
      }
      raw = buf.toString("utf-8");
      // Drop the first (likely partial) line.
      const firstNewline = raw.indexOf("\n");
      if (firstNewline >= 0) {
        raw = raw.slice(firstNewline + 1);
      }
    }

    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    const messages: SessionMessage[] = [];
    let skipNextAssistant = false;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type !== "message" || !entry.message) {
          continue;
        }
        const msg = entry.message;
        if (msg.role !== "user" && msg.role !== "assistant") {
          continue;
        }
        const text = extractTextContent(msg.content);
        if (!text.trim()) {
          continue;
        }
        // Skip system-generated user messages (e.g. /new greeting prompts,
        // compaction triggers) and the assistant reply that follows them,
        // since neither represents real conversation context.
        if (msg.role === "user" && isSystemMessage(text)) {
          skipNextAssistant = true;
          continue;
        }
        if (msg.role === "assistant" && skipNextAssistant) {
          skipNextAssistant = false;
          continue;
        }
        skipNextAssistant = false;
        messages.push({
          role: msg.role,
          text,
          model: msg.role === "assistant" ? (msg.model as string | undefined) : undefined,
        });
      } catch {
        // Skip malformed lines.
      }
    }

    if (messages.length < 2) {
      return undefined;
    }

    const recent = messages.slice(-messageCount);
    const formatted = recent.map((m) => {
      const truncated =
        m.text.length > truncateChars ? `${m.text.slice(0, truncateChars)}...` : m.text;
      if (m.role === "assistant") {
        const label = extractModelLabel(m.model);
        return label ? `Assistant [${label}]: ${truncated}` : `Assistant: ${truncated}`;
      }
      return `User: ${truncated}`;
    });

    return `Recent conversation:\n${formatted.join("\n")}`;
  } catch {
    return undefined;
  }
}
