/**
 * OpenAI-compatible chat completions route — Elysia plugin.
 *
 * POST /v1/chat/completions — OpenAI chat completions API with streaming support.
 * Uses ReadableStream for SSE streaming.
 */

import { randomUUID } from "node:crypto";
import { Elysia } from "elysia";
import {
  buildHistoryContextFromEntries,
  type HistoryEntry,
} from "../../auto-reply/reply/history.js";
import { createDefaultDeps } from "../../cli/deps.js";
import { agentCommand } from "../../commands/agent.js";
import { emitAgentEvent, onAgentEvent } from "../../infra/agent-events.js";
import { defaultRuntime } from "../../runtime.js";
import { authorizeGatewayConnect, type ResolvedGatewayAuth } from "../auth.js";
import { getNodeRequest, getWebBearerToken } from "../elysia-node-compat.js";
import { resolveAgentIdForRequest, resolveSessionKey } from "../http-utils.js";

type OpenAiChatMessage = {
  role?: unknown;
  content?: unknown;
  name?: unknown;
};

type OpenAiChatCompletionRequest = {
  model?: unknown;
  stream?: unknown;
  messages?: unknown;
  user?: unknown;
};

function asMessages(val: unknown): OpenAiChatMessage[] {
  return Array.isArray(val) ? (val as OpenAiChatMessage[]) : [];
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }
        const type = (part as { type?: unknown }).type;
        const text = (part as { text?: unknown }).text;
        const inputText = (part as { input_text?: unknown }).input_text;
        if (type === "text" && typeof text === "string") {
          return text;
        }
        if (type === "input_text" && typeof text === "string") {
          return text;
        }
        if (typeof inputText === "string") {
          return inputText;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function buildAgentPrompt(messagesUnknown: unknown): {
  message: string;
  extraSystemPrompt?: string;
} {
  const messages = asMessages(messagesUnknown);

  const systemParts: string[] = [];
  const conversationEntries: Array<{ role: "user" | "assistant" | "tool"; entry: HistoryEntry }> =
    [];

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      continue;
    }
    const role = typeof msg.role === "string" ? msg.role.trim() : "";
    const content = extractTextContent(msg.content).trim();
    if (!role || !content) {
      continue;
    }
    if (role === "system" || role === "developer") {
      systemParts.push(content);
      continue;
    }

    const normalizedRole = role === "function" ? "tool" : role;
    if (normalizedRole !== "user" && normalizedRole !== "assistant" && normalizedRole !== "tool") {
      continue;
    }

    const name = typeof msg.name === "string" ? msg.name.trim() : "";
    const sender =
      normalizedRole === "assistant"
        ? "Assistant"
        : normalizedRole === "user"
          ? "User"
          : name
            ? `Tool:${name}`
            : "Tool";

    conversationEntries.push({
      role: normalizedRole,
      entry: { sender, body: content },
    });
  }

  let message = "";
  if (conversationEntries.length > 0) {
    let currentIndex = -1;
    for (let i = conversationEntries.length - 1; i >= 0; i -= 1) {
      const entryRole = conversationEntries[i]?.role;
      if (entryRole === "user" || entryRole === "tool") {
        currentIndex = i;
        break;
      }
    }
    if (currentIndex < 0) {
      currentIndex = conversationEntries.length - 1;
    }
    const currentEntry = conversationEntries[currentIndex]?.entry;
    if (currentEntry) {
      const historyEntries = conversationEntries.slice(0, currentIndex).map((entry) => entry.entry);
      if (historyEntries.length === 0) {
        message = currentEntry.body;
      } else {
        const formatEntry = (entry: HistoryEntry) => `${entry.sender}: ${entry.body}`;
        message = buildHistoryContextFromEntries({
          entries: [...historyEntries, currentEntry],
          currentMessage: formatEntry(currentEntry),
          formatEntry,
        });
      }
    }
  }

  return {
    message,
    extraSystemPrompt: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
  };
}

function coerceRequest(val: unknown): OpenAiChatCompletionRequest {
  if (!val || typeof val !== "object") {
    return {};
  }
  return val as OpenAiChatCompletionRequest;
}

export function openAiRoutes(params: { auth: ResolvedGatewayAuth }) {
  const { auth } = params;

  return new Elysia({ name: "openai-compat-routes" }).post(
    "/v1/chat/completions",
    async ({ body: rawBody, request, set }) => {
      const token = getWebBearerToken(request);
      const nodeReq = getNodeRequest(request);

      const authResult = await authorizeGatewayConnect({
        auth,
        connectAuth: { token, password: token },
        req: nodeReq,
        trustedProxies: undefined,
      });
      if (!authResult.ok) {
        set.status = 401;
        return { error: { message: "Unauthorized", type: "unauthorized" } };
      }

      const payload = coerceRequest(rawBody);
      const stream = Boolean(payload.stream);
      const model = typeof payload.model === "string" ? payload.model : "openclaw";
      const user = typeof payload.user === "string" ? payload.user : undefined;

      const agentId = nodeReq ? resolveAgentIdForRequest({ req: nodeReq, model }) : "main";
      const sessionKey = nodeReq
        ? resolveSessionKey({ req: nodeReq, agentId, user, prefix: "openai" })
        : `openai:${randomUUID()}`;

      const prompt = buildAgentPrompt(payload.messages);
      if (!prompt.message) {
        set.status = 400;
        return {
          error: {
            message: "Missing user message in `messages`.",
            type: "invalid_request_error",
          },
        };
      }

      const runId = `chatcmpl_${randomUUID()}`;
      const deps = createDefaultDeps();

      // Non-streaming mode
      if (!stream) {
        try {
          const result = await agentCommand(
            {
              message: prompt.message,
              extraSystemPrompt: prompt.extraSystemPrompt,
              sessionKey,
              runId,
              deliver: false,
              messageChannel: "webchat",
              bestEffortDeliver: false,
            },
            defaultRuntime,
            deps,
          );

          const payloads = (result as { payloads?: Array<{ text?: string }> } | null)?.payloads;
          const content =
            Array.isArray(payloads) && payloads.length > 0
              ? payloads
                  .map((p) => (typeof p.text === "string" ? p.text : ""))
                  .filter(Boolean)
                  .join("\n\n")
              : "No response from OpenClaw.";

          return {
            id: runId,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                index: 0,
                message: { role: "assistant", content },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          };
        } catch (err) {
          set.status = 500;
          return {
            error: { message: String(err), type: "api_error" },
          };
        }
      }

      // Streaming mode — return a ReadableStream of SSE events
      set.headers["content-type"] = "text/event-stream; charset=utf-8";
      set.headers["cache-control"] = "no-cache";
      set.headers["connection"] = "keep-alive";

      const encoder = new TextEncoder();

      return new ReadableStream({
        start(controller) {
          let wroteRole = false;
          let sawAssistantDelta = false;
          let closed = false;

          const writeSse = (data: unknown) => {
            if (closed) {
              return;
            }
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            } catch {
              closed = true;
            }
          };

          const writeDone = () => {
            if (closed) {
              return;
            }
            try {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch {
              // ignore
            }
          };

          const finish = () => {
            if (closed) {
              return;
            }
            closed = true;
            unsubscribe();
            writeDone();
            try {
              controller.close();
            } catch {
              // already closed
            }
          };

          const unsubscribe = onAgentEvent((evt) => {
            if (evt.runId !== runId) {
              return;
            }
            if (closed) {
              return;
            }

            if (evt.stream === "assistant") {
              const delta = evt.data?.delta;
              const text = evt.data?.text;
              const content =
                typeof delta === "string" ? delta : typeof text === "string" ? text : "";
              if (!content) {
                return;
              }

              if (!wroteRole) {
                wroteRole = true;
                writeSse({
                  id: runId,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [{ index: 0, delta: { role: "assistant" } }],
                });
              }

              sawAssistantDelta = true;
              writeSse({
                id: runId,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{ index: 0, delta: { content }, finish_reason: null }],
              });
              return;
            }

            if (evt.stream === "lifecycle") {
              const phase = evt.data?.phase;
              if (phase === "end" || phase === "error") {
                finish();
              }
            }
          });

          // Run agent command asynchronously
          void (async () => {
            try {
              const result = await agentCommand(
                {
                  message: prompt.message,
                  extraSystemPrompt: prompt.extraSystemPrompt,
                  sessionKey,
                  runId,
                  deliver: false,
                  messageChannel: "webchat",
                  bestEffortDeliver: false,
                },
                defaultRuntime,
                deps,
              );

              if (closed) {
                return;
              }

              // Fallback: if no streaming deltas were received, send full response
              if (!sawAssistantDelta) {
                if (!wroteRole) {
                  wroteRole = true;
                  writeSse({
                    id: runId,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [{ index: 0, delta: { role: "assistant" } }],
                  });
                }

                const payloads = (result as { payloads?: Array<{ text?: string }> } | null)
                  ?.payloads;
                const content =
                  Array.isArray(payloads) && payloads.length > 0
                    ? payloads
                        .map((p) => (typeof p.text === "string" ? p.text : ""))
                        .filter(Boolean)
                        .join("\n\n")
                    : "No response from OpenClaw.";

                sawAssistantDelta = true;
                writeSse({
                  id: runId,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [{ index: 0, delta: { content }, finish_reason: null }],
                });
              }
            } catch (err) {
              if (closed) {
                return;
              }
              writeSse({
                id: runId,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: 0,
                    delta: { content: `Error: ${String(err)}` },
                    finish_reason: "stop",
                  },
                ],
              });
              emitAgentEvent({
                runId,
                stream: "lifecycle",
                data: { phase: "error" },
              });
            } finally {
              finish();
            }
          })();
        },
        cancel() {
          // Client disconnected — cleanup handled by the unsubscribe in start()
        },
      });
    },
  );
}
