import { Type } from "@sinclair/typebox";
import type { WhatsAppCallService } from "./voice/service.js";

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

export const WhatsAppCallToolSchema = Type.Object(
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
  },
  { additionalProperties: false },
);

type ToolParams = {
  action: (typeof ACTIONS)[number];
  whatsapp_number?: string;
  connection_id?: string;
};

function json(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function createWhatsAppCallTool(getService: () => WhatsAppCallService | null) {
  return {
    name: "whatsapp_call",
    label: "WhatsApp Call",
    description:
      "Make outbound WhatsApp voice calls powered by AI. " +
      "The call connects the recipient to an AI voice assistant via WhatsApp.",
    parameters: WhatsAppCallToolSchema,
    async execute(
      _toolCallId: string,
      params: ToolParams,
      _signal?: AbortSignal,
    ): Promise<AgentToolResult> {
      try {
        const service = getService();
        if (!service) {
          throw new Error(
            "WhatsApp Call service not running. Ensure the whatsappcall channel is enabled and configured.",
          );
        }

        switch (params.action) {
          case "make_call": {
            const number = params.whatsapp_number;
            if (!number) throw new Error("whatsapp_number is required for make_call");

            const result = await service.initiateCall({
              whatsappNumber: number,
              agentId: "openclaw-agent",
            });
            return json(result);
          }

          case "get_status": {
            const connId = params.connection_id;
            if (!connId) throw new Error("connection_id is required for get_status");

            const status = service.getCallStatus(connId);
            return json(status ?? { found: false, connectionId: connId });
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
