import type { BaasClient } from "@meeting-baas/sdk";
import { createBaasClient } from "@meeting-baas/sdk";
import { Type } from "@sinclair/typebox";

const ACTIONS = [
  "create_bot",
  "get_bot",
  "get_transcript",
  "leave_bot",
  "list_bots",
  "delete_bot_data",
] as const;

const RECORDING_MODES = ["speaker_view", "audio_only", "gallery_view"] as const;

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

export const MeetingBotToolSchema = Type.Object(
  {
    action: stringEnum(ACTIONS, {
      description: `Action to perform: ${ACTIONS.join(", ")}`,
    }),
    meeting_url: Type.Optional(
      Type.String({
        description: "Meeting URL (Google Meet, Zoom, or MS Teams). Required for create_bot.",
      }),
    ),
    bot_name: Type.Optional(
      Type.String({
        description: "Display name for the bot in the meeting. Required for create_bot.",
      }),
    ),
    bot_id: Type.Optional(
      Type.String({
        description: "Bot UUID. Required for get_bot, get_transcript, leave_bot, delete_bot_data.",
      }),
    ),
    entry_message: Type.Optional(
      Type.String({
        description: "Message the bot posts in meeting chat on join (Google Meet/Zoom only).",
      }),
    ),
    recording_mode: Type.Optional(
      stringEnum(RECORDING_MODES, {
        description: "Recording mode: speaker_view (default), audio_only, or gallery_view.",
      }),
    ),
  },
  { additionalProperties: false },
);

type ToolParams = {
  action: (typeof ACTIONS)[number];
  meeting_url?: string;
  bot_name?: string;
  bot_id?: string;
  entry_message?: string;
  recording_mode?: (typeof RECORDING_MODES)[number];
};

type PluginCfg = {
  apiKey?: string;
  baseUrl?: string;
};

function json(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// Cache client by config key so we don't recreate on every call
let cachedClient: BaasClient<"v2"> | null = null;
let cachedConfigKey = "";

function getClient(cfg: PluginCfg): BaasClient<"v2"> {
  if (!cfg.apiKey) {
    throw new Error(
      "Meeting BaaS API key not configured. Set it with: openclaw config set extensions.meeting-baas.apiKey <key>",
    );
  }

  const configKey = `${cfg.apiKey}:${cfg.baseUrl ?? ""}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  cachedClient = createBaasClient({
    api_key: cfg.apiKey,
    api_version: "v2" as const,
    ...(cfg.baseUrl ? { base_url: cfg.baseUrl } : {}),
  });
  cachedConfigKey = configKey;
  return cachedClient;
}

export function createMeetingBotTool(pluginConfig: PluginCfg) {
  return {
    name: "meeting_bot",
    label: "Meeting Bot",
    description:
      "Manage meeting recording bots on Google Meet, Zoom, and Microsoft Teams via Meeting BaaS. " +
      "Actions: create_bot (join & record a meeting), get_bot (bot status & details), " +
      "get_transcript (retrieve transcript, recording, and media URLs), " +
      "leave_bot (remove bot from meeting), list_bots (list all bots), " +
      "delete_bot_data (delete recordings/data for a bot).",
    parameters: MeetingBotToolSchema,

    async execute(_toolCallId: string, params: ToolParams): Promise<AgentToolResult> {
      try {
        const client = getClient(pluginConfig);

        switch (params.action) {
          case "create_bot": {
            if (!params.meeting_url) {
              throw new Error("meeting_url is required for create_bot");
            }
            if (!params.bot_name) {
              throw new Error("bot_name is required for create_bot");
            }
            const res = await client.createBot({
              meeting_url: params.meeting_url,
              bot_name: params.bot_name,
              ...(params.entry_message ? { entry_message: params.entry_message } : {}),
              ...(params.recording_mode ? { recording_mode: params.recording_mode } : {}),
            });
            if (!res.success) {
              throw new Error(res.error || res.message || "Failed to create bot");
            }
            return json(res.data);
          }

          case "get_bot": {
            if (!params.bot_id) {
              throw new Error("bot_id is required for get_bot");
            }
            const res = await client.getBotDetails({ bot_id: params.bot_id });
            if (!res.success) {
              throw new Error(res.error || res.message || "Failed to get bot details");
            }
            return json(res.data);
          }

          case "get_transcript": {
            if (!params.bot_id) {
              throw new Error("bot_id is required for get_transcript");
            }
            const res = await client.getBotDetails({ bot_id: params.bot_id });
            if (!res.success) {
              throw new Error(res.error || res.message || "Failed to get bot details");
            }
            const d = res.data;
            return json({
              bot_id: d.bot_id,
              status: d.status,
              transcription: d.transcription,
              raw_transcription: d.raw_transcription,
              diarization: d.diarization,
              audio: d.audio,
              video: d.video,
              participants: d.participants,
              speakers: d.speakers,
              duration_seconds: d.duration_seconds,
            });
          }

          case "leave_bot": {
            if (!params.bot_id) {
              throw new Error("bot_id is required for leave_bot");
            }
            const res = await client.leaveBot({ bot_id: params.bot_id });
            if (!res.success) {
              throw new Error(res.error || res.message || "Failed to leave meeting");
            }
            return json(res.data);
          }

          case "list_bots": {
            const res = await client.listBots();
            if (!res.success) {
              throw new Error(res.error || res.message || "Failed to list bots");
            }
            return json(res.data);
          }

          case "delete_bot_data": {
            if (!params.bot_id) {
              throw new Error("bot_id is required for delete_bot_data");
            }
            const res = await client.deleteBotData({ bot_id: params.bot_id });
            if (!res.success) {
              throw new Error(res.error || res.message || "Failed to delete bot data");
            }
            return json(res.data);
          }

          default: {
            params.action satisfies never;
            throw new Error(
              `Unknown action: ${String(params.action)}. Valid actions: ${ACTIONS.join(", ")}`,
            );
          }
        }
      } catch (err) {
        return json({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// Reset cached client (for testing)
export function _resetClient() {
  cachedClient = null;
  cachedConfigKey = "";
}
