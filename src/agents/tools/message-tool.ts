import { z } from "zod";
import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";
import { BLUEBUBBLES_GROUP_ACTIONS } from "../../channels/plugins/bluebubbles-actions.js";
import {
  listChannelMessageActions,
  supportsChannelMessageButtons,
  supportsChannelMessageCards,
} from "../../channels/plugins/message-actions.js";
import {
  CHANNEL_MESSAGE_ACTION_NAMES,
  type ChannelMessageActionName,
} from "../../channels/plugins/types.js";
import { loadConfig } from "../../config/config.js";
import { GATEWAY_CLIENT_IDS, GATEWAY_CLIENT_MODES } from "../../gateway/protocol/client-info.js";
import { CHANNEL_TARGETS_DESCRIPTION } from "../../infra/outbound/channel-target.js";
import { getToolResult, runMessageAction } from "../../infra/outbound/message-action-runner.js";
import { normalizeTargetForProvider } from "../../infra/outbound/target-normalization.js";
import { normalizeAccountId } from "../../routing/session-key.js";
import { normalizeMessageChannel } from "../../utils/message-channel.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { listChannelSupportedActions } from "../channel-tools.js";
import { assertSandboxPath } from "../sandbox-paths.js";
import { zodToToolJsonSchema } from "../schema/zod-tool-schema.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

const AllMessageActions = CHANNEL_MESSAGE_ACTION_NAMES;

function buildRoutingZodProps() {
  return {
    channel: z.string().optional(),
    target: z.string().describe("Target channel/user id or name.").optional(),
    targets: z.array(z.string().describe(CHANNEL_TARGETS_DESCRIPTION)).optional(),
    accountId: z.string().optional(),
    dryRun: z.boolean().optional(),
  };
}

function buildSendZodProps(options: { includeButtons: boolean; includeCards: boolean }) {
  const props: Record<string, z.ZodType> = {
    message: z.string().optional(),
    effectId: z
      .string()
      .describe("Message effect name/id for sendWithEffect (e.g., invisible ink).")
      .optional(),
    effect: z.string().describe("Alias for effectId (e.g., invisible-ink, balloons).").optional(),
    media: z.string().optional(),
    filename: z.string().optional(),
    buffer: z
      .string()
      .describe("Base64 payload for attachments (optionally a data: URL).")
      .optional(),
    contentType: z.string().optional(),
    mimeType: z.string().optional(),
    caption: z.string().optional(),
    path: z.string().optional(),
    filePath: z.string().optional(),
    replyTo: z.string().optional(),
    threadId: z.string().optional(),
    asVoice: z.boolean().optional(),
    silent: z.boolean().optional(),
    quoteText: z.string().describe("Quote text for Telegram reply_parameters").optional(),
    bestEffort: z.boolean().optional(),
    gifPlayback: z.boolean().optional(),
    buttons: z
      .array(z.array(z.object({ text: z.string(), callback_data: z.string() })))
      .describe("Telegram inline keyboard buttons (array of button rows)")
      .optional(),
    card: z
      .object({})
      .passthrough()
      .describe("Adaptive Card JSON object (when supported by the channel)")
      .optional(),
  };
  if (!options.includeButtons) {
    delete props.buttons;
  }
  if (!options.includeCards) {
    delete props.card;
  }
  return props;
}

function buildReactionZodProps() {
  return {
    messageId: z.string().optional(),
    emoji: z.string().optional(),
    remove: z.boolean().optional(),
    targetAuthor: z.string().optional(),
    targetAuthorUuid: z.string().optional(),
    groupId: z.string().optional(),
  };
}

function buildFetchZodProps() {
  return {
    limit: z.number().optional(),
    before: z.string().optional(),
    after: z.string().optional(),
    around: z.string().optional(),
    fromMe: z.boolean().optional(),
    includeArchived: z.boolean().optional(),
  };
}

function buildPollZodProps() {
  return {
    pollQuestion: z.string().optional(),
    pollOption: z.array(z.string()).optional(),
    pollDurationHours: z.number().optional(),
    pollMulti: z.boolean().optional(),
  };
}

function buildChannelTargetZodProps() {
  return {
    channelId: z
      .string()
      .describe("Channel id filter (search/thread list/event create).")
      .optional(),
    channelIds: z.array(z.string()).optional(),
    guildId: z.string().optional(),
    userId: z.string().optional(),
    authorId: z.string().optional(),
    authorIds: z.array(z.string()).optional(),
    roleId: z.string().optional(),
    roleIds: z.array(z.string()).optional(),
    participant: z.string().optional(),
  };
}

function buildStickerZodProps() {
  return {
    emojiName: z.string().optional(),
    stickerId: z.array(z.string()).optional(),
    stickerName: z.string().optional(),
    stickerDesc: z.string().optional(),
    stickerTags: z.string().optional(),
  };
}

function buildThreadZodProps() {
  return {
    threadName: z.string().optional(),
    autoArchiveMin: z.number().optional(),
  };
}

function buildEventZodProps() {
  return {
    query: z.string().optional(),
    eventName: z.string().optional(),
    eventType: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    desc: z.string().optional(),
    location: z.string().optional(),
    durationMin: z.number().optional(),
    until: z.string().optional(),
  };
}

function buildModerationZodProps() {
  return {
    reason: z.string().optional(),
    deleteDays: z.number().optional(),
  };
}

function buildGatewayZodProps() {
  return {
    gatewayUrl: z.string().optional(),
    gatewayToken: z.string().optional(),
    timeoutMs: z.number().optional(),
  };
}

function buildChannelManagementZodProps() {
  return {
    name: z.string().optional(),
    type: z.number().optional(),
    parentId: z.string().optional(),
    topic: z.string().optional(),
    position: z.number().optional(),
    nsfw: z.boolean().optional(),
    rateLimitPerUser: z.number().optional(),
    categoryId: z.string().optional(),
    clearParent: z
      .boolean()
      .describe("Clear the parent/category when supported by the provider.")
      .optional(),
  };
}

function buildMessageToolZodProps(options: { includeButtons: boolean; includeCards: boolean }) {
  return {
    ...buildRoutingZodProps(),
    ...buildSendZodProps(options),
    ...buildReactionZodProps(),
    ...buildFetchZodProps(),
    ...buildPollZodProps(),
    ...buildChannelTargetZodProps(),
    ...buildStickerZodProps(),
    ...buildThreadZodProps(),
    ...buildEventZodProps(),
    ...buildModerationZodProps(),
    ...buildGatewayZodProps(),
    ...buildChannelManagementZodProps(),
  };
}

function buildMessageToolSchemaFromActions(
  actions: readonly string[],
  options: { includeButtons: boolean; includeCards: boolean },
) {
  const props = buildMessageToolZodProps(options);
  return zodToToolJsonSchema(
    z.object({
      action: z.enum(actions as [string, ...string[]]),
      ...props,
    }),
  );
}

const MessageToolSchema = buildMessageToolSchemaFromActions(AllMessageActions, {
  includeButtons: true,
  includeCards: true,
});

type MessageToolOptions = {
  agentAccountId?: string;
  agentSessionKey?: string;
  config?: OpenClawConfig;
  currentChannelId?: string;
  currentChannelProvider?: string;
  currentThreadTs?: string;
  replyToMode?: "off" | "first" | "all";
  hasRepliedRef?: { value: boolean };
  sandboxRoot?: string;
};

function buildMessageToolSchema(cfg: OpenClawConfig) {
  const actions = listChannelMessageActions(cfg);
  const includeButtons = supportsChannelMessageButtons(cfg);
  const includeCards = supportsChannelMessageCards(cfg);
  return buildMessageToolSchemaFromActions(actions.length > 0 ? actions : ["send"], {
    includeButtons,
    includeCards,
  });
}

function resolveAgentAccountId(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return normalizeAccountId(trimmed);
}

function filterActionsForContext(params: {
  actions: ChannelMessageActionName[];
  channel?: string;
  currentChannelId?: string;
}): ChannelMessageActionName[] {
  const channel = normalizeMessageChannel(params.channel);
  if (!channel || channel !== "bluebubbles") {
    return params.actions;
  }
  const currentChannelId = params.currentChannelId?.trim();
  if (!currentChannelId) {
    return params.actions;
  }
  const normalizedTarget =
    normalizeTargetForProvider(channel, currentChannelId) ?? currentChannelId;
  const lowered = normalizedTarget.trim().toLowerCase();
  const isGroupTarget =
    lowered.startsWith("chat_guid:") ||
    lowered.startsWith("chat_id:") ||
    lowered.startsWith("chat_identifier:") ||
    lowered.startsWith("group:");
  if (isGroupTarget) {
    return params.actions;
  }
  return params.actions.filter((action) => !BLUEBUBBLES_GROUP_ACTIONS.has(action));
}

function buildMessageToolDescription(options?: {
  config?: OpenClawConfig;
  currentChannel?: string;
  currentChannelId?: string;
}): string {
  const baseDescription = "Send, delete, and manage messages via channel plugins.";

  // If we have a current channel, show only its supported actions
  if (options?.currentChannel) {
    const channelActions = filterActionsForContext({
      actions: listChannelSupportedActions({
        cfg: options.config,
        channel: options.currentChannel,
      }),
      channel: options.currentChannel,
      currentChannelId: options.currentChannelId,
    });
    if (channelActions.length > 0) {
      // Always include "send" as a base action
      const allActions = new Set(["send", ...channelActions]);
      const actionList = Array.from(allActions).toSorted().join(", ");
      return `${baseDescription} Current channel (${options.currentChannel}) supports: ${actionList}.`;
    }
  }

  // Fallback to generic description with all configured actions
  if (options?.config) {
    const actions = listChannelMessageActions(options.config);
    if (actions.length > 0) {
      return `${baseDescription} Supports actions: ${actions.join(", ")}.`;
    }
  }

  return `${baseDescription} Supports actions: send, delete, react, poll, pin, threads, and more.`;
}

export function createMessageTool(options?: MessageToolOptions): AnyAgentTool {
  const agentAccountId = resolveAgentAccountId(options?.agentAccountId);
  const schema = options?.config ? buildMessageToolSchema(options.config) : MessageToolSchema;
  const description = buildMessageToolDescription({
    config: options?.config,
    currentChannel: options?.currentChannelProvider,
    currentChannelId: options?.currentChannelId,
  });

  return {
    label: "Message",
    name: "message",
    description,
    parameters: schema,
    execute: async (_toolCallId, args, signal) => {
      // Check if already aborted before doing any work
      if (signal?.aborted) {
        const err = new Error("Message send aborted");
        err.name = "AbortError";
        throw err;
      }
      const params = args as Record<string, unknown>;
      const cfg = options?.config ?? loadConfig();
      const action = readStringParam(params, "action", {
        required: true,
      }) as ChannelMessageActionName;

      // Validate file paths against sandbox root to prevent host file access.
      const sandboxRoot = options?.sandboxRoot;
      if (sandboxRoot) {
        for (const key of ["filePath", "path"] as const) {
          const raw = readStringParam(params, key, { trim: false });
          if (raw) {
            await assertSandboxPath({ filePath: raw, cwd: sandboxRoot, root: sandboxRoot });
          }
        }
      }

      const accountId = readStringParam(params, "accountId") ?? agentAccountId;
      if (accountId) {
        params.accountId = accountId;
      }

      const gateway = {
        url: readStringParam(params, "gatewayUrl", { trim: false }),
        token: readStringParam(params, "gatewayToken", { trim: false }),
        timeoutMs: readNumberParam(params, "timeoutMs"),
        clientName: GATEWAY_CLIENT_IDS.GATEWAY_CLIENT,
        clientDisplayName: "agent",
        mode: GATEWAY_CLIENT_MODES.BACKEND,
      };

      const toolContext =
        options?.currentChannelId ||
        options?.currentChannelProvider ||
        options?.currentThreadTs ||
        options?.replyToMode ||
        options?.hasRepliedRef
          ? {
              currentChannelId: options?.currentChannelId,
              currentChannelProvider: options?.currentChannelProvider,
              currentThreadTs: options?.currentThreadTs,
              replyToMode: options?.replyToMode,
              hasRepliedRef: options?.hasRepliedRef,
              // Direct tool invocations should not add cross-context decoration.
              // The agent is composing a message, not forwarding from another chat.
              skipCrossContextDecoration: true,
            }
          : undefined;

      const result = await runMessageAction({
        cfg,
        action,
        params,
        defaultAccountId: accountId ?? undefined,
        gateway,
        toolContext,
        agentId: options?.agentSessionKey
          ? resolveSessionAgentId({ sessionKey: options.agentSessionKey, config: cfg })
          : undefined,
        abortSignal: signal,
      });

      const toolResult = getToolResult(result);
      if (toolResult) {
        return toolResult;
      }
      return jsonResult(result.payload);
    },
  };
}
