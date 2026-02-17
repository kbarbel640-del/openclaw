/**
 * OpenResponses `/v1/responses` route — Elysia plugin.
 *
 * Implements the OpenResponses API endpoint for OpenClaw Gateway.
 * Supports both streaming (SSE via ReadableStream) and non-streaming modes.
 *
 * @see https://www.open-responses.com/
 */

import { randomUUID } from "node:crypto";
import { Elysia } from "elysia";
import type { ClientToolDefinition } from "../../agents/pi-embedded-runner/run/params.js";
import { createDefaultDeps } from "../../cli/deps.js";
import { agentCommand } from "../../commands/agent.js";
import type { ImageContent } from "../../commands/agent/types.js";
import type { GatewayHttpResponsesConfig } from "../../config/types.gateway.js";
import { emitAgentEvent, onAgentEvent } from "../../infra/agent-events.js";
import {
  DEFAULT_INPUT_FILE_MAX_BYTES,
  DEFAULT_INPUT_FILE_MAX_CHARS,
  DEFAULT_INPUT_FILE_MIMES,
  DEFAULT_INPUT_IMAGE_MAX_BYTES,
  DEFAULT_INPUT_IMAGE_MIMES,
  DEFAULT_INPUT_MAX_REDIRECTS,
  DEFAULT_INPUT_PDF_MAX_PAGES,
  DEFAULT_INPUT_PDF_MAX_PIXELS,
  DEFAULT_INPUT_PDF_MIN_TEXT_CHARS,
  DEFAULT_INPUT_TIMEOUT_MS,
  extractFileContentFromSource,
  extractImageContentFromSource,
  normalizeMimeList,
  type InputFileLimits,
  type InputImageLimits,
  type InputImageSource,
} from "../../media/input-files.js";
import { defaultRuntime } from "../../runtime.js";
import { authorizeGatewayConnect, type ResolvedGatewayAuth } from "../auth.js";
import { getNodeRequest, getWebBearerToken } from "../elysia-node-compat.js";
import { resolveAgentIdForRequest, resolveSessionKey } from "../http-utils.js";
import {
  CreateResponseBodySchema,
  type CreateResponseBody,
  type ItemParam,
  type OutputItem,
  type ResponseResource,
  type StreamingEvent,
  type Usage,
} from "../open-responses.schema.js";
import { buildAgentPrompt } from "../openresponses-prompt.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper types
// ─────────────────────────────────────────────────────────────────────────────

type ResolvedResponsesLimits = {
  maxBodyBytes: number;
  files: InputFileLimits;
  images: InputImageLimits;
};

const DEFAULT_BODY_BYTES = 20 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions (small utilities inlined from openresponses-http.ts)
// ─────────────────────────────────────────────────────────────────────────────

function resolveResponsesLimits(
  config: GatewayHttpResponsesConfig | undefined,
): ResolvedResponsesLimits {
  const files = config?.files;
  const images = config?.images;
  return {
    maxBodyBytes: config?.maxBodyBytes ?? DEFAULT_BODY_BYTES,
    files: {
      allowUrl: files?.allowUrl ?? true,
      allowedMimes: normalizeMimeList(files?.allowedMimes, DEFAULT_INPUT_FILE_MIMES),
      maxBytes: files?.maxBytes ?? DEFAULT_INPUT_FILE_MAX_BYTES,
      maxChars: files?.maxChars ?? DEFAULT_INPUT_FILE_MAX_CHARS,
      maxRedirects: files?.maxRedirects ?? DEFAULT_INPUT_MAX_REDIRECTS,
      timeoutMs: files?.timeoutMs ?? DEFAULT_INPUT_TIMEOUT_MS,
      pdf: {
        maxPages: files?.pdf?.maxPages ?? DEFAULT_INPUT_PDF_MAX_PAGES,
        maxPixels: files?.pdf?.maxPixels ?? DEFAULT_INPUT_PDF_MAX_PIXELS,
        minTextChars: files?.pdf?.minTextChars ?? DEFAULT_INPUT_PDF_MIN_TEXT_CHARS,
      },
    },
    images: {
      allowUrl: images?.allowUrl ?? true,
      allowedMimes: normalizeMimeList(images?.allowedMimes, DEFAULT_INPUT_IMAGE_MIMES),
      maxBytes: images?.maxBytes ?? DEFAULT_INPUT_IMAGE_MAX_BYTES,
      maxRedirects: images?.maxRedirects ?? DEFAULT_INPUT_MAX_REDIRECTS,
      timeoutMs: images?.timeoutMs ?? DEFAULT_INPUT_TIMEOUT_MS,
    },
  };
}

function extractClientTools(body: CreateResponseBody): ClientToolDefinition[] {
  return (body.tools ?? []) as ClientToolDefinition[];
}

function applyToolChoice(params: {
  tools: ClientToolDefinition[];
  toolChoice: CreateResponseBody["tool_choice"];
}): { tools: ClientToolDefinition[]; extraSystemPrompt?: string } {
  const { tools, toolChoice } = params;
  if (!toolChoice) {
    return { tools };
  }

  if (toolChoice === "none") {
    return { tools: [] };
  }

  if (toolChoice === "required") {
    if (tools.length === 0) {
      throw new Error("tool_choice=required but no tools were provided");
    }
    return {
      tools,
      extraSystemPrompt: "You must call one of the available tools before responding.",
    };
  }

  if (typeof toolChoice === "object" && toolChoice.type === "function") {
    const targetName = toolChoice.function?.name?.trim();
    if (!targetName) {
      throw new Error("tool_choice.function.name is required");
    }
    const matched = tools.filter((tool) => tool.function?.name === targetName);
    if (matched.length === 0) {
      throw new Error(`tool_choice requested unknown tool: ${targetName}`);
    }
    return {
      tools: matched,
      extraSystemPrompt: `You must call the ${targetName} tool before responding.`,
    };
  }

  return { tools };
}

function createEmptyUsage(): Usage {
  return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
}

function toUsage(
  value:
    | {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
        total?: number;
      }
    | undefined,
): Usage {
  if (!value) {
    return createEmptyUsage();
  }
  const input = value.input ?? 0;
  const output = value.output ?? 0;
  const cacheRead = value.cacheRead ?? 0;
  const cacheWrite = value.cacheWrite ?? 0;
  const total = value.total ?? input + output + cacheRead + cacheWrite;
  return {
    input_tokens: Math.max(0, input),
    output_tokens: Math.max(0, output),
    total_tokens: Math.max(0, total),
  };
}

function extractUsageFromResult(result: unknown): Usage {
  const meta = (result as { meta?: { agentMeta?: { usage?: unknown } } } | null)?.meta;
  const usage = meta && typeof meta === "object" ? meta.agentMeta?.usage : undefined;
  return toUsage(
    usage as
      | { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; total?: number }
      | undefined,
  );
}

function createResponseResource(params: {
  id: string;
  model: string;
  status: ResponseResource["status"];
  output: OutputItem[];
  usage?: Usage;
  error?: { code: string; message: string };
}): ResponseResource {
  return {
    id: params.id,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: params.status,
    model: params.model,
    output: params.output,
    usage: params.usage ?? createEmptyUsage(),
    error: params.error,
  };
}

function createAssistantOutputItem(params: {
  id: string;
  text: string;
  status?: "in_progress" | "completed";
}): OutputItem {
  return {
    type: "message",
    id: params.id,
    role: "assistant",
    content: [{ type: "output_text", text: params.text }],
    status: params.status,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Image + file extraction from input items
// ─────────────────────────────────────────────────────────────────────────────

async function extractMediaFromInput(
  input: ItemParam[],
  limits: ResolvedResponsesLimits,
): Promise<{ images: ImageContent[]; fileContexts: string[] }> {
  let images: ImageContent[] = [];
  const fileContexts: string[] = [];

  for (const item of input) {
    if (item.type !== "message" || typeof item.content === "string") {
      continue;
    }

    for (const part of item.content) {
      if (part.type === "input_image") {
        const source = part.source as {
          type?: string;
          url?: string;
          data?: string;
          media_type?: string;
        };
        const sourceType =
          source.type === "base64" || source.type === "url" ? source.type : undefined;
        if (!sourceType) {
          throw new Error("input_image must have 'source.url' or 'source.data'");
        }
        const imageSource: InputImageSource = {
          type: sourceType,
          url: source.url,
          data: source.data,
          mediaType: source.media_type,
        };
        const image = await extractImageContentFromSource(imageSource, limits.images);
        images.push(image);
        continue;
      }

      if (part.type === "input_file") {
        const source = part.source as {
          type?: string;
          url?: string;
          data?: string;
          media_type?: string;
          filename?: string;
        };
        const sourceType =
          source.type === "base64" || source.type === "url" ? source.type : undefined;
        if (!sourceType) {
          throw new Error("input_file must have 'source.url' or 'source.data'");
        }
        const file = await extractFileContentFromSource({
          source: {
            type: sourceType,
            url: source.url,
            data: source.data,
            mediaType: source.media_type,
            filename: source.filename,
          },
          limits: limits.files,
        });
        if (file.text?.trim()) {
          fileContexts.push(`<file name="${file.filename}">\n${file.text}\n</file>`);
        } else if (file.images && file.images.length > 0) {
          fileContexts.push(
            `<file name="${file.filename}">[PDF content rendered to images]</file>`,
          );
        }
        if (file.images && file.images.length > 0) {
          images = images.concat(file.images);
        }
      }
    }
  }

  return { images, fileContexts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Elysia plugin
// ─────────────────────────────────────────────────────────────────────────────

export function openResponsesRoutes(params: {
  auth: ResolvedGatewayAuth;
  config?: GatewayHttpResponsesConfig;
}) {
  const { auth, config } = params;

  return new Elysia({ name: "openresponses-routes" }).post(
    "/v1/responses",
    async ({ body: rawBody, request, set }) => {
      // ── Auth ──────────────────────────────────────────────────────────────
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

      // ── Body parsing + validation ─────────────────────────────────────────
      const parseResult = CreateResponseBodySchema.safeParse(rawBody);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        const message = issue
          ? `${issue.path.join(".")}: ${issue.message}`
          : "Invalid request body";
        set.status = 400;
        return { error: { message, type: "invalid_request_error" } };
      }

      const payload: CreateResponseBody = parseResult.data;
      const stream = Boolean(payload.stream);
      const model = payload.model;
      const user = payload.user;

      // ── Media extraction (images + files) ─────────────────────────────────
      const limits = resolveResponsesLimits(config);
      let images: ImageContent[] = [];
      let fileContexts: string[] = [];

      try {
        if (Array.isArray(payload.input)) {
          const media = await extractMediaFromInput(payload.input, limits);
          images = media.images;
          fileContexts = media.fileContexts;
        }
      } catch (err) {
        set.status = 400;
        return { error: { message: String(err), type: "invalid_request_error" } };
      }

      // ── Tool choice resolution ────────────────────────────────────────────
      const clientTools = extractClientTools(payload);
      let resolvedClientTools = clientTools;
      let toolChoicePrompt: string | undefined;

      try {
        const toolChoiceResult = applyToolChoice({
          tools: clientTools,
          toolChoice: payload.tool_choice,
        });
        resolvedClientTools = toolChoiceResult.tools;
        toolChoicePrompt = toolChoiceResult.extraSystemPrompt;
      } catch (err) {
        set.status = 400;
        return { error: { message: String(err), type: "invalid_request_error" } };
      }

      // ── Agent + session resolution ────────────────────────────────────────
      const agentId = nodeReq ? resolveAgentIdForRequest({ req: nodeReq, model }) : "main";
      const sessionKey = nodeReq
        ? resolveSessionKey({ req: nodeReq, agentId, user, prefix: "openresponses" })
        : `openresponses:${randomUUID()}`;

      // ── Prompt building ───────────────────────────────────────────────────
      const prompt = buildAgentPrompt(payload.input);
      const fileContext = fileContexts.length > 0 ? fileContexts.join("\n\n") : undefined;
      const toolChoiceContext = toolChoicePrompt?.trim();

      const extraSystemPrompt = [
        payload.instructions,
        prompt.extraSystemPrompt,
        toolChoiceContext,
        fileContext,
      ]
        .filter(Boolean)
        .join("\n\n");

      if (!prompt.message) {
        set.status = 400;
        return {
          error: {
            message: "Missing user message in `input`.",
            type: "invalid_request_error",
          },
        };
      }

      const responseId = `resp_${randomUUID()}`;
      const outputItemId = `msg_${randomUUID()}`;
      const deps = createDefaultDeps();
      const streamParams =
        typeof payload.max_output_tokens === "number"
          ? { maxTokens: payload.max_output_tokens }
          : undefined;

      // ── Non-streaming mode ────────────────────────────────────────────────
      if (!stream) {
        try {
          const result = await agentCommand(
            {
              message: prompt.message,
              images: images.length > 0 ? images : undefined,
              clientTools: resolvedClientTools.length > 0 ? resolvedClientTools : undefined,
              extraSystemPrompt: extraSystemPrompt || undefined,
              streamParams: streamParams ?? undefined,
              sessionKey,
              runId: responseId,
              deliver: false,
              messageChannel: "webchat",
              bestEffortDeliver: false,
            },
            defaultRuntime,
            deps,
          );

          const payloads = (result as { payloads?: Array<{ text?: string }> } | null)?.payloads;
          const usage = extractUsageFromResult(result);
          const meta = (result as { meta?: unknown } | null)?.meta;
          const stopReason =
            meta && typeof meta === "object"
              ? (meta as { stopReason?: string }).stopReason
              : undefined;
          const pendingToolCalls =
            meta && typeof meta === "object"
              ? (
                  meta as {
                    pendingToolCalls?: Array<{ id: string; name: string; arguments: string }>;
                  }
                ).pendingToolCalls
              : undefined;

          // If agent called a client tool, return function_call instead of text
          if (stopReason === "tool_calls" && pendingToolCalls && pendingToolCalls.length > 0) {
            const functionCall = pendingToolCalls[0];
            const functionCallItemId = `call_${randomUUID()}`;
            return createResponseResource({
              id: responseId,
              model,
              status: "incomplete",
              output: [
                {
                  type: "function_call",
                  id: functionCallItemId,
                  call_id: functionCall.id,
                  name: functionCall.name,
                  arguments: functionCall.arguments,
                },
              ],
              usage,
            });
          }

          const content =
            Array.isArray(payloads) && payloads.length > 0
              ? payloads
                  .map((p) => (typeof p.text === "string" ? p.text : ""))
                  .filter(Boolean)
                  .join("\n\n")
              : "No response from OpenClaw.";

          return createResponseResource({
            id: responseId,
            model,
            status: "completed",
            output: [
              createAssistantOutputItem({ id: outputItemId, text: content, status: "completed" }),
            ],
            usage,
          });
        } catch (err) {
          set.status = 500;
          return createResponseResource({
            id: responseId,
            model,
            status: "failed",
            output: [],
            error: { code: "api_error", message: String(err) },
          });
        }
      }

      // ── Streaming mode ────────────────────────────────────────────────────
      set.headers["content-type"] = "text/event-stream; charset=utf-8";
      set.headers["cache-control"] = "no-cache";
      set.headers["connection"] = "keep-alive";

      const encoder = new TextEncoder();

      return new ReadableStream({
        start(controller) {
          let accumulatedText = "";
          let sawAssistantDelta = false;
          let closed = false;
          let finalUsage: Usage | undefined;
          let finalizeRequested: { status: ResponseResource["status"]; text: string } | null = null;

          // Write a named SSE event (OpenResponses format uses `event:` + `data:`)
          const writeSseEvent = (event: StreamingEvent) => {
            if (closed) {
              return;
            }
            try {
              controller.enqueue(
                encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
              );
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
              // stream already closed
            }
          };

          const maybeFinalize = () => {
            if (closed || !finalizeRequested || !finalUsage) {
              return;
            }
            const usage = finalUsage;

            closed = true;
            unsubscribe();

            writeSseEvent({
              type: "response.output_text.done",
              item_id: outputItemId,
              output_index: 0,
              content_index: 0,
              text: finalizeRequested.text,
            });

            writeSseEvent({
              type: "response.content_part.done",
              item_id: outputItemId,
              output_index: 0,
              content_index: 0,
              part: { type: "output_text", text: finalizeRequested.text },
            });

            const completedItem = createAssistantOutputItem({
              id: outputItemId,
              text: finalizeRequested.text,
              status: "completed",
            });

            writeSseEvent({
              type: "response.output_item.done",
              output_index: 0,
              item: completedItem,
            });

            const finalResponse = createResponseResource({
              id: responseId,
              model,
              status: finalizeRequested.status,
              output: [completedItem],
              usage,
            });

            writeSseEvent({ type: "response.completed", response: finalResponse });
            writeDone();
            try {
              controller.close();
            } catch {
              // already closed
            }
          };

          const requestFinalize = (status: ResponseResource["status"], text: string) => {
            if (finalizeRequested) {
              return;
            }
            finalizeRequested = { status, text };
            maybeFinalize();
          };

          // ── Send initial SSE events ─────────────────────────────────────────
          const initialResponse = createResponseResource({
            id: responseId,
            model,
            status: "in_progress",
            output: [],
          });

          writeSseEvent({ type: "response.created", response: initialResponse });
          writeSseEvent({ type: "response.in_progress", response: initialResponse });

          // Add output item
          const outputItem = createAssistantOutputItem({
            id: outputItemId,
            text: "",
            status: "in_progress",
          });

          writeSseEvent({
            type: "response.output_item.added",
            output_index: 0,
            item: outputItem,
          });

          // Add content part
          writeSseEvent({
            type: "response.content_part.added",
            item_id: outputItemId,
            output_index: 0,
            content_index: 0,
            part: { type: "output_text", text: "" },
          });

          // ── Subscribe to agent streaming events ─────────────────────────────
          const unsubscribe = onAgentEvent((evt) => {
            if (evt.runId !== responseId) {
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

              sawAssistantDelta = true;
              accumulatedText += content;

              writeSseEvent({
                type: "response.output_text.delta",
                item_id: outputItemId,
                output_index: 0,
                content_index: 0,
                delta: content,
              });
              return;
            }

            if (evt.stream === "lifecycle") {
              const phase = evt.data?.phase;
              if (phase === "end" || phase === "error") {
                const finalText = accumulatedText || "No response from OpenClaw.";
                const finalStatus = phase === "error" ? "failed" : "completed";
                requestFinalize(finalStatus, finalText);
              }
            }
          });

          // ── Run agent command asynchronously ────────────────────────────────
          void (async () => {
            try {
              const result = await agentCommand(
                {
                  message: prompt.message,
                  images: images.length > 0 ? images : undefined,
                  clientTools: resolvedClientTools.length > 0 ? resolvedClientTools : undefined,
                  extraSystemPrompt: extraSystemPrompt || undefined,
                  streamParams: streamParams ?? undefined,
                  sessionKey,
                  runId: responseId,
                  deliver: false,
                  messageChannel: "webchat",
                  bestEffortDeliver: false,
                },
                defaultRuntime,
                deps,
              );

              finalUsage = extractUsageFromResult(result);
              maybeFinalize();

              if (closed) {
                return;
              }

              // Fallback: if no streaming deltas were received, send the full response
              if (!sawAssistantDelta) {
                const resultObj = result as {
                  payloads?: Array<{ text?: string }>;
                  meta?: unknown;
                };
                const payloads = resultObj.payloads;
                const meta = resultObj.meta;
                const stopReason =
                  meta && typeof meta === "object"
                    ? (meta as { stopReason?: string }).stopReason
                    : undefined;
                const pendingToolCalls =
                  meta && typeof meta === "object"
                    ? (
                        meta as {
                          pendingToolCalls?: Array<{
                            id: string;
                            name: string;
                            arguments: string;
                          }>;
                        }
                      ).pendingToolCalls
                    : undefined;

                // If agent called a client tool, emit function_call instead of text
                if (
                  stopReason === "tool_calls" &&
                  pendingToolCalls &&
                  pendingToolCalls.length > 0
                ) {
                  const functionCall = pendingToolCalls[0];
                  const usage = finalUsage ?? createEmptyUsage();

                  writeSseEvent({
                    type: "response.output_text.done",
                    item_id: outputItemId,
                    output_index: 0,
                    content_index: 0,
                    text: "",
                  });
                  writeSseEvent({
                    type: "response.content_part.done",
                    item_id: outputItemId,
                    output_index: 0,
                    content_index: 0,
                    part: { type: "output_text", text: "" },
                  });

                  const completedItem = createAssistantOutputItem({
                    id: outputItemId,
                    text: "",
                    status: "completed",
                  });
                  writeSseEvent({
                    type: "response.output_item.done",
                    output_index: 0,
                    item: completedItem,
                  });

                  const functionCallItemId = `call_${randomUUID()}`;
                  const functionCallItem = {
                    type: "function_call" as const,
                    id: functionCallItemId,
                    call_id: functionCall.id,
                    name: functionCall.name,
                    arguments: functionCall.arguments,
                  };
                  writeSseEvent({
                    type: "response.output_item.added",
                    output_index: 1,
                    item: functionCallItem,
                  });
                  writeSseEvent({
                    type: "response.output_item.done",
                    output_index: 1,
                    item: { ...functionCallItem, status: "completed" as const },
                  });

                  const incompleteResponse = createResponseResource({
                    id: responseId,
                    model,
                    status: "incomplete",
                    output: [completedItem, functionCallItem],
                    usage,
                  });
                  closed = true;
                  unsubscribe();
                  writeSseEvent({ type: "response.completed", response: incompleteResponse });
                  writeDone();
                  try {
                    controller.close();
                  } catch {
                    // already closed
                  }
                  return;
                }

                const content =
                  Array.isArray(payloads) && payloads.length > 0
                    ? payloads
                        .map((p) => (typeof p.text === "string" ? p.text : ""))
                        .filter(Boolean)
                        .join("\n\n")
                    : "No response from OpenClaw.";

                accumulatedText = content;
                sawAssistantDelta = true;

                writeSseEvent({
                  type: "response.output_text.delta",
                  item_id: outputItemId,
                  output_index: 0,
                  content_index: 0,
                  delta: content,
                });
              }
            } catch (err) {
              if (closed) {
                return;
              }

              finalUsage = finalUsage ?? createEmptyUsage();
              const errorResponse = createResponseResource({
                id: responseId,
                model,
                status: "failed",
                output: [],
                error: { code: "api_error", message: String(err) },
                usage: finalUsage,
              });

              writeSseEvent({ type: "response.failed", response: errorResponse });
              emitAgentEvent({
                runId: responseId,
                stream: "lifecycle",
                data: { phase: "error" },
              });
            } finally {
              if (!closed) {
                // Emit lifecycle end to trigger completion via the event listener
                emitAgentEvent({
                  runId: responseId,
                  stream: "lifecycle",
                  data: { phase: "end" },
                });
              }
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
