/**
 * Lightweight agent tool that calls the hosted WhatsApp Voice API via HTTP.
 * No local service, WebRTC, or heavy deps needed — just HTTP calls.
 */

import { Type } from "@sinclair/typebox";

const ACTIONS = ["make_call", "get_status"] as const;

type AgentToolResult = {
  content: Array<{ type: string; text: string }>;
  details?: unknown;
};

function stringEnum<T extends readonly string[]>(
  values: T,
  options: { description?: string } = {},
) {
  return Type.Unsafe<T[number]>({
    type: "string",
    enum: [...values],
    ...options,
  });
}

export const WhatsAppCallRemoteToolSchema = Type.Object(
  {
    action: stringEnum(ACTIONS, {
      description:
        "Action: make_call (initiate an outbound WhatsApp voice call), get_status (check call status)",
    }),
    whatsapp_number: Type.Optional(
      Type.String({
        description:
          "Target WhatsApp number with country code, no + or symbols (e.g. 8618811551698)",
      }),
    ),
    connection_id: Type.Optional(
      Type.String({ description: "Connection ID returned from make_call, used for get_status" }),
    ),
    greeting: Type.Optional(
      Type.String({ description: "Custom greeting/instructions for the AI voice assistant" }),
    ),
    language: Type.Optional(Type.String({ description: "Language code (e.g. zh, en, es)" })),
  },
  { additionalProperties: false },
);

type ToolParams = {
  action: (typeof ACTIONS)[number];
  whatsapp_number?: string;
  connection_id?: string;
  greeting?: string;
  language?: string;
};

function json(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

async function httpCall(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export type RemoteToolDefaults = {
  greeting?: string;
  language?: string;
  voice?: string;
  openaiApiKey?: string;
};

export function createWhatsAppCallRemoteTool(
  serviceUrl: string,
  apiKey: string = "",
  defaults: RemoteToolDefaults = {},
) {
  const baseUrl = serviceUrl.replace(/\/$/, "");

  return {
    name: "whatsapp_call",
    label: "WhatsApp Call",
    description:
      "Make outbound WhatsApp voice calls powered by AI. " +
      "The call connects the recipient to an AI voice assistant via WhatsApp.",
    parameters: WhatsAppCallRemoteToolSchema,
    async execute(
      _toolCallId: string,
      params: ToolParams,
      _signal?: AbortSignal,
    ): Promise<AgentToolResult> {
      try {
        switch (params.action) {
          case "make_call": {
            if (!params.whatsapp_number)
              throw new Error("whatsapp_number is required for make_call");
            const greeting = params.greeting || defaults.greeting;
            const language = params.language || defaults.language;
            const result = await httpCall(baseUrl, apiKey, "POST", "/calls", {
              whatsapp_number: params.whatsapp_number,
              ...(greeting ? { greeting } : {}),
              ...(language ? { language } : {}),
              ...(defaults.voice ? { voice: defaults.voice } : {}),
              ...(defaults.openaiApiKey ? { openai_api_key: defaults.openaiApiKey } : {}),
            });
            return json(result);
          }

          case "get_status": {
            if (!params.connection_id) throw new Error("connection_id is required for get_status");
            const result = await httpCall(baseUrl, apiKey, "GET", `/calls/${params.connection_id}`);
            return json(result);
          }

          default: {
            params.action satisfies never;
            throw new Error(`Unknown action: ${String(params.action)}`);
          }
        }
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
