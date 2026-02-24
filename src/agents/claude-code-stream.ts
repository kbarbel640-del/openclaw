import { spawn } from "node:child_process";
import type { StreamFn } from "@mariozechner/pi-agent-core";
import type {
  AssistantMessage,
  StopReason,
  TextContent,
  Usage,
} from "@mariozechner/pi-ai";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("claude-code-stream");

// ── Message formatting ───────────────────────────────────────────────────────

type InputContentPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string }
  | { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return (content as InputContentPart[])
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/**
 * Flatten the OpenClaw message transcript into a single text block for the
 * Claude Code CLI.  System prompt goes first, then alternating user/assistant
 * turns.  Tool/toolResult messages are omitted — Claude Code handles tools
 * internally when running in `-p` mode.
 */
function formatMessagesForClaude(
  messages: Array<{ role: string; content: unknown }>,
  systemPrompt?: string,
): string {
  let prompt = "";
  if (systemPrompt) {
    prompt += systemPrompt + "\n\n";
  }
  for (const msg of messages) {
    const text = extractTextContent(msg.content);
    if (!text) continue;
    if (msg.role === "user") {
      prompt += `Human: ${text}\n\n`;
    } else if (msg.role === "assistant") {
      prompt += `Assistant: ${text}\n\n`;
    }
  }
  return prompt;
}

// ── Main StreamFn factory ────────────────────────────────────────────────────

export function createClaudeCodeStreamFn(): StreamFn {
  return (model, context, options) => {
    const stream = createAssistantMessageEventStream();

    const run = async () => {
      try {
        // Extract the latest user message — this is what we pipe to `claude -p`.
        // The full conversation context is prepended as a formatted transcript
        // so Claude has history, while the most recent user turn is the "prompt".
        const allMessages = context.messages ?? [];
        const lastUserMsg = [...allMessages].reverse().find((m) => m.role === "user");
        const lastUserText = lastUserMsg ? extractTextContent(lastUserMsg.content) : "";

        // Build conversation context from all *prior* messages (excluding the
        // last user message which becomes the direct prompt).
        const priorMessages = lastUserMsg
          ? allMessages.slice(0, allMessages.lastIndexOf(lastUserMsg))
          : allMessages;
        const historyBlock = formatMessagesForClaude(priorMessages, context.systemPrompt);

        // If there's meaningful history, prepend it so Claude has context.
        const fullPrompt = historyBlock
          ? historyBlock + "---\n\nHuman: " + lastUserText
          : (context.systemPrompt ? context.systemPrompt + "\n\n---\n\n" : "") + lastUserText;

        // Spawn claude CLI subprocess in print mode
        const args: string[] = [
          "-p",                     // print mode (non-interactive)
          "--output-format", "text", // plain text output
        ];

        log.info(`Spawning: claude ${args.join(" ")} (prompt length: ${fullPrompt.length})`);

        const result = await new Promise<string>((resolve, reject) => {
          const child = spawn("claude", args, {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, CLAUDECODE: undefined },
            shell: true, // Required on Windows to resolve .cmd shims in PATH
            ...(options?.signal ? { signal: options.signal } : {}),
          });

          let stdout = "";
          let stderr = "";

          child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
          });
          child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
          });

          // Pipe the full prompt via stdin
          child.stdin.write(fullPrompt);
          child.stdin.end();

          child.on("close", (code) => {
            if (code === 0) {
              resolve(stdout.trim());
            } else {
              reject(
                new Error(`claude CLI exited with code ${code}: ${stderr.trim() || "(no stderr)"}`),
              );
            }
          });
          child.on("error", (err) => {
            reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
          });
        });

        log.info(`claude CLI returned ${result.length} chars`);

        // Build AssistantMessage from CLI output
        const content: TextContent[] = result ? [{ type: "text", text: result }] : [];

        const usage: Usage = {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        };

        const assistantMessage: AssistantMessage = {
          role: "assistant",
          content,
          stopReason: "stop" as StopReason,
          api: model.api,
          provider: model.provider,
          model: model.id,
          usage,
          timestamp: Date.now(),
        };

        stream.push({
          type: "done",
          reason: "stop" as const,
          message: assistantMessage,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log.error(`claude CLI error: ${errorMessage}`);
        stream.push({
          type: "error",
          reason: "error",
          error: {
            role: "assistant" as const,
            content: [],
            stopReason: "error" as StopReason,
            errorMessage,
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            timestamp: Date.now(),
          },
        });
      } finally {
        stream.end();
      }
    };

    queueMicrotask(() => void run());
    return stream;
  };
}
