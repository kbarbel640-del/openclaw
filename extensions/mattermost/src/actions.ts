import type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  OpenClawConfig,
} from "openclaw/plugin-sdk";
import { listEnabledMattermostAccounts, resolveMattermostAccount } from "./mattermost/accounts.js";
import {
  createMattermostClient,
  deleteMattermostPost,
  fetchMattermostMe,
  getMattermostPost,
  normalizeMattermostBaseUrl,
  reactMattermostPost,
  unreactMattermostPost,
  updateMattermostPost,
} from "./mattermost/client.js";
import { sendMessageMattermost } from "./mattermost/send.js";

function readStringParam(
  params: Record<string, unknown>,
  key: string,
  opts?: { required?: boolean },
): string | undefined {
  const raw = params[key];
  if (typeof raw !== "string") {
    if (opts?.required) {
      throw new Error(`${key} is required`);
    }
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed && opts?.required) {
    throw new Error(`${key} is required`);
  }
  return trimmed || undefined;
}

function resolveClientForAccount(cfg: OpenClawConfig, accountId?: string | null) {
  const account = resolveMattermostAccount({ cfg, accountId: accountId ?? undefined });
  const token = account.botToken?.trim();
  const baseUrl = normalizeMattermostBaseUrl(account.baseUrl);
  if (!token) {
    throw new Error(`Mattermost bot token missing for account "${account.accountId}".`);
  }
  if (!baseUrl) {
    throw new Error(`Mattermost baseUrl missing for account "${account.accountId}".`);
  }
  return { client: createMattermostClient({ baseUrl, botToken: token }), account };
}

export async function handleMattermostAction(
  params: Record<string, unknown>,
  cfg: OpenClawConfig,
): Promise<{ content: string }> {
  const action = readStringParam(params, "action", { required: true })!;
  const accountId = readStringParam(params, "accountId");

  if (action === "sendMessage") {
    const to = readStringParam(params, "to", { required: true })!;
    const content = readStringParam(params, "content") ?? readStringParam(params, "message") ?? "";
    const mediaUrl = readStringParam(params, "mediaUrl");
    const replyToId = readStringParam(params, "replyToId") ?? readStringParam(params, "replyTo");

    const result = await sendMessageMattermost(to, content, {
      accountId: accountId ?? undefined,
      mediaUrl: mediaUrl ?? undefined,
      replyToId: replyToId ?? undefined,
    });

    return {
      content: JSON.stringify({
        ok: true,
        messageId: result.messageId,
        channelId: result.channelId,
      }),
    };
  }

  if (action === "editMessage") {
    const postId = readStringParam(params, "postId") ?? readStringParam(params, "messageId");
    if (!postId) {
      throw new Error("postId is required for editMessage");
    }
    const message = readStringParam(params, "message") ?? readStringParam(params, "content");
    if (!message) {
      throw new Error("message is required for editMessage");
    }
    const { client } = resolveClientForAccount(cfg, accountId);
    const updated = await updateMattermostPost(client, { postId, message });
    return { content: JSON.stringify({ ok: true, postId: updated.id }) };
  }

  if (action === "deleteMessage") {
    const postId = readStringParam(params, "postId") ?? readStringParam(params, "messageId");
    if (!postId) {
      throw new Error("postId is required for deleteMessage");
    }
    const { client } = resolveClientForAccount(cfg, accountId);
    await deleteMattermostPost(client, postId);
    return { content: JSON.stringify({ ok: true, deleted: true, postId }) };
  }

  if (action === "react") {
    const postId = readStringParam(params, "postId") ?? readStringParam(params, "messageId");
    if (!postId) {
      throw new Error("postId is required for react");
    }
    const emoji = readStringParam(params, "emoji") ?? readStringParam(params, "emojiName");
    if (!emoji) {
      throw new Error("emoji is required for react");
    }
    const remove = params.remove === true;
    const { client } = resolveClientForAccount(cfg, accountId);
    const botUser = await fetchMattermostMe(client);
    const emojiName = emoji.replace(/^:/, "").replace(/:$/, "");

    if (remove) {
      await unreactMattermostPost(client, { userId: botUser.id, postId, emojiName });
      return { content: JSON.stringify({ ok: true, removed: true, emoji: emojiName }) };
    }
    await reactMattermostPost(client, { userId: botUser.id, postId, emojiName });
    return { content: JSON.stringify({ ok: true, added: emojiName }) };
  }

  if (action === "getPost") {
    const postId = readStringParam(params, "postId") ?? readStringParam(params, "messageId");
    if (!postId) {
      throw new Error("postId is required for getPost");
    }
    const { client } = resolveClientForAccount(cfg, accountId);
    const post = await getMattermostPost(client, postId);
    return {
      content: JSON.stringify({
        ok: true,
        post: {
          id: post.id,
          channelId: post.channel_id,
          message: post.message,
          userId: post.user_id,
          rootId: post.root_id,
          createdAt: post.create_at,
        },
      }),
    };
  }

  throw new Error(`Unsupported Mattermost action: ${action}`);
}

export const mattermostMessageActions: ChannelMessageActionAdapter = {
  listActions: ({ cfg }) => {
    const accounts = listEnabledMattermostAccounts(cfg);
    if (accounts.length === 0) {
      return [];
    }
    const actions: ChannelMessageActionName[] = ["send", "edit", "delete", "react"];
    return actions;
  },

  supportsButtons: () => false,

  extractToolSend: ({ args }) => {
    const action = typeof args.action === "string" ? args.action.trim() : "";
    if (action !== "sendMessage") {
      return null;
    }
    const to = typeof args.to === "string" ? args.to : undefined;
    if (!to) {
      return null;
    }
    const accountId = typeof args.accountId === "string" ? args.accountId.trim() : undefined;
    return { to, accountId };
  },

  handleAction: async ({ action, params, cfg, accountId }) => {
    const mappedAction =
      action === "send"
        ? "sendMessage"
        : action === "edit"
          ? "editMessage"
          : action === "delete"
            ? "deleteMessage"
            : action;

    const result = await handleMattermostAction(
      {
        action: mappedAction,
        ...params,
        accountId: accountId ?? undefined,
      },
      cfg,
    );

    return {
      content: [{ type: "text" as const, text: result.content }],
      details: null,
    };
  },
};
