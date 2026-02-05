/**
 * XMTP channel adapter for OpenClaw gateway.
 * Uses @xmtp/agent-sdk to listen for messages and forward them to the gateway.
 */

import type {
  ChannelGatewayContext,
  ChannelOutboundContext,
  ChannelPlugin,
  OpenClawConfig,
} from "openclaw/plugin-sdk";
import { Agent } from "@xmtp/agent-sdk";

export type XMTPAccountConfig = {
  walletKey: string;
  dbEncryptionKey: string;
  env?: "dev" | "production";
};

type AgentRuntime = {
  on(
    event: "text",
    handler: (ctx: {
      message: { content: string; id?: string };
      conversation?: { topic?: string };
      getSenderAddress(): Promise<string>;
    }) => Promise<void>,
  ): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendText?(to: string, text: string): Promise<void>;
  sendRemoteAttachment?(to: string, url: string, options?: { mimeType?: string }): Promise<void>;
};

const CHANNEL_ID = "xmtp";
const runningAgents = new Map<string, AgentRuntime>();

async function withEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const prev = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    Object.assign(process.env, prev);
  }
}

async function createAgentFromConfig(
  config: XMTPAccountConfig,
  accountId: string,
): Promise<AgentRuntime> {
  return withEnv(
    {
      XMTP_WALLET_KEY: config.walletKey,
      XMTP_DB_ENCRYPTION_KEY: config.dbEncryptionKey,
      XMTP_ENV: config.env ?? "production",
      XMTP_DB_DIRECTORY: process.env.XMTP_DB_DIRECTORY ?? `./data/xmtp-${accountId}`,
    },
    async () => (await Agent.createFromEnv()) as unknown as AgentRuntime,
  );
}

function listAccountIds(cfg: OpenClawConfig): string[] {
  return Object.keys(cfg.channels?.xmtp?.accounts ?? {});
}

function resolveAccount(
  cfg: OpenClawConfig,
  accountId: string | null | undefined,
): XMTPAccountConfig {
  const id = accountId ?? "default";
  const account = cfg.channels?.xmtp?.accounts?.[id];
  if (!account?.walletKey || !account?.dbEncryptionKey) {
    return { walletKey: "", dbEncryptionKey: "", env: "production" };
  }
  return account;
}

export const xmtpPlugin: ChannelPlugin<XMTPAccountConfig> = {
  id: CHANNEL_ID,
  meta: {
    id: CHANNEL_ID,
    label: "XMTP",
    selectionLabel: "XMTP (Decentralized)",
    docsPath: "/channels/xmtp",
    blurb: "Decentralized messaging via XMTP protocol",
    aliases: [CHANNEL_ID],
  },
  capabilities: { chatTypes: ["direct", "group"], media: true },
  config: {
    listAccountIds,
    resolveAccount,
    isConfigured: (account) => Boolean(account.walletKey && account.dbEncryptionKey),
  },
  gateway: {
    startAccount: async (ctx: ChannelGatewayContext<XMTPAccountConfig>) => {
      const account = ctx.account;
      const agent = await createAgentFromConfig(account, ctx.accountId);
      const runtimeWithEnqueue = ctx.runtime as {
        enqueueMessage?: (p: {
          channel: string;
          sender: string;
          text: string;
          conversationId?: string;
          messageId?: string;
        }) => void | Promise<void>;
      };
      const enqueue = runtimeWithEnqueue.enqueueMessage;
      if (typeof enqueue === "function") {
        agent.on("text", async (msgCtx) => {
          const sender = await msgCtx.getSenderAddress();
          const conversation = msgCtx.conversation;
          const conversationId = conversation?.topic ?? sender;
          await enqueue({
            channel: CHANNEL_ID,
            sender,
            text: msgCtx.message.content,
            conversationId,
            messageId: msgCtx.message.id,
          });
        });
      } else {
        ctx.log?.info?.(
          `[${ctx.accountId}] XMTP: enqueueMessage not available on runtime; inbound messages will not be forwarded`,
        );
      }
      await agent.start();
      runningAgents.set(ctx.accountId, agent);
    },
    stopAccount: async (ctx: ChannelGatewayContext<XMTPAccountConfig>) => {
      const agent = runningAgents.get(ctx.accountId);
      if (agent) {
        await agent.stop();
        runningAgents.delete(ctx.accountId);
      }
    },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async (ctx: ChannelOutboundContext) => {
      const accountId = ctx.accountId ?? "default";
      const agent = runningAgents.get(accountId);
      if (!agent?.sendText) {
        throw new Error(
          `XMTP agent not running or sendText not available for account ${accountId}`,
        );
      }
      await agent.sendText(ctx.to, ctx.text);
      return { channel: CHANNEL_ID, messageId: "unknown" };
    },
    sendMedia: async (ctx: ChannelOutboundContext) => {
      const accountId = ctx.accountId ?? "default";
      const agent = runningAgents.get(accountId);
      if (!agent) {
        throw new Error(`XMTP agent not running for account ${accountId}`);
      }
      if (typeof agent.sendRemoteAttachment === "function") {
        await agent.sendRemoteAttachment(ctx.to, ctx.mediaUrl ?? ctx.text, {
          mimeType: ctx.mediaUrl ? undefined : undefined,
        });
      } else if (typeof agent.sendText === "function") {
        await agent.sendText(ctx.to, ctx.mediaUrl ?? ctx.text);
      } else {
        throw new Error("sendMedia not supported: no sendRemoteAttachment or sendText on agent");
      }
      return { channel: CHANNEL_ID, messageId: "unknown" };
    },
  },
};
