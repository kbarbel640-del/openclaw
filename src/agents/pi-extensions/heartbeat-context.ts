import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { ContextEvent, ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { getHeartbeatContextRuntime } from "./heartbeat-context/runtime.js";

const DEFAULT_MAX_MESSAGES = 20;
const DEFAULT_TOOL_SUMMARY_MAX_CHARS = 1_000;
const IMAGE_CHAR_ESTIMATE = 8_000;

type HeartbeatContextMode = "all" | "recent-messages" | "summarize-tools";

type HeartbeatContextSettings = {
  mode?: HeartbeatContextMode;
  maxMessages?: number;
  toolSummaryMaxChars?: number;
};

function normalizeMode(mode?: HeartbeatContextMode): HeartbeatContextMode {
  if (mode === "recent-messages" || mode === "summarize-tools" || mode === "all") return mode;
  return "all";
}

function resolveMaxMessages(value?: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return DEFAULT_MAX_MESSAGES;
}

function resolveToolSummaryMaxChars(value?: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return DEFAULT_TOOL_SUMMARY_MAX_CHARS;
}

function estimateToolResultChars(message: ToolResultMessage): { chars: number; imageCount: number } {
  let chars = 0;
  let imageCount = 0;
  for (const block of message.content) {
    if (block.type === "text") {
      chars += block.text.length;
      continue;
    }
    if (block.type === "image") {
      imageCount += 1;
      chars += IMAGE_CHAR_ESTIMATE;
    }
  }
  return { chars, imageCount };
}

function formatToolResultPlaceholder(params: {
  toolName?: string;
  chars: number;
  imageCount: number;
}): string {
  const name = params.toolName?.trim() ? params.toolName.trim() : "unknown";
  const imageSuffix = params.imageCount > 0 ? `, ${params.imageCount} image(s)` : "";
  return `[tool result omitted: ${name}, ${params.chars} chars${imageSuffix}]`;
}

function summarizeToolResults(
  messages: AgentMessage[],
  maxChars: number,
): AgentMessage[] {
  let next: AgentMessage[] | null = null;
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    if (!msg || msg.role !== "toolResult") continue;

    const toolMsg = msg as ToolResultMessage;
    const { chars, imageCount } = estimateToolResultChars(toolMsg);
    if (chars <= maxChars) continue;

    const placeholder = formatToolResultPlaceholder({
      toolName: toolMsg.toolName,
      chars,
      imageCount,
    });
    const updated: ToolResultMessage = {
      ...toolMsg,
      content: [{ type: "text", text: placeholder }],
    };
    if (!next) next = messages.slice();
    next[i] = updated as unknown as AgentMessage;
  }
  return next ?? messages;
}

function keepRecentMessages(messages: AgentMessage[], maxMessages: number): AgentMessage[] {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
}

export function applyHeartbeatContext(
  messages: AgentMessage[],
  settings: HeartbeatContextSettings,
): AgentMessage[] {
  const mode = normalizeMode(settings.mode);
  if (mode === "all") return messages;

  if (mode === "recent-messages") {
    const maxMessages = resolveMaxMessages(settings.maxMessages);
    return keepRecentMessages(messages, maxMessages);
  }

  const maxChars = resolveToolSummaryMaxChars(settings.toolSummaryMaxChars);
  return summarizeToolResults(messages, maxChars);
}

export default function heartbeatContextExtension(api: ExtensionAPI): void {
  api.on("context", (event: ContextEvent, ctx) => {
    const runtime = getHeartbeatContextRuntime(ctx.sessionManager);
    if (!runtime?.isHeartbeat) return undefined;

    const next = applyHeartbeatContext(event.messages as AgentMessage[], {
      mode: runtime.mode,
      maxMessages: runtime.maxMessages,
      toolSummaryMaxChars: runtime.toolSummaryMaxChars,
    });
    if (next === event.messages) return undefined;
    return { messages: next };
  });
}
