import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Agent, createSigner, createUser } from "@xmtp/agent-sdk";
import { getXmtpRuntime } from "./runtime.js";

export interface XmtpBusOptions {
  accountId?: string;
  walletKey: string;
  dbEncryptionKey: string;
  env: "local" | "dev" | "production";
  dbPath?: string;
  onMessage: (params: {
    senderAddress: string;
    senderInboxId: string;
    conversationId: string;
    isDm: boolean;
    text: string;
    messageId: string;
  }) => Promise<void>;
  onError?: (error: Error, context: string) => void;
  onConnect?: () => void;
}

export interface XmtpBusHandle {
  sendText(conversationId: string, text: string): Promise<void>;
  getAddress(): string;
  close(): Promise<void>;
}

function resolveDbDirectory(env: string, configDbPath?: string): string {
  if (configDbPath) {
    const resolved = configDbPath.replace(/^~/, os.homedir());
    fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
    return resolved;
  }

  const runtime = getXmtpRuntime();
  const stateDir = runtime.state.resolveStateDir(process.env, os.homedir);
  const dbDir = path.join(stateDir, "channels", "xmtp", env);
  fs.mkdirSync(dbDir, { recursive: true, mode: 0o700 });
  return dbDir;
}

export async function startXmtpBus(options: XmtpBusOptions): Promise<XmtpBusHandle> {
  const {
    walletKey,
    dbEncryptionKey,
    env,
    dbPath: configDbPath,
    onMessage,
    onError,
    onConnect,
  } = options;

  const dbDir = resolveDbDirectory(env, configDbPath);
  const user = createUser(walletKey as `0x${string}`);
  const signer = createSigner(user);

  const normalizedEncryptionKey = dbEncryptionKey.startsWith("0x")
    ? dbEncryptionKey
    : `0x${dbEncryptionKey}`;

  const agent = await Agent.create(signer, {
    env,
    dbEncryptionKey: normalizedEncryptionKey as `0x${string}`,
    dbPath: (inboxId: string) => path.join(dbDir, `xmtp-${inboxId}.db3`),
  });

  const agentAddress = agent.address ?? user.account.address.toLowerCase();

  agent.on("text", async (ctx) => {
    try {
      const senderAddress = await ctx.getSenderAddress();
      const senderInboxId = ctx.message.senderInboxId;
      const conversationId = ctx.conversation.id;
      const isDm = ctx.isDm();
      const text = ctx.message.content as string;
      const messageId = ctx.message.id;

      if (!isDm) return;

      await onMessage({
        senderAddress: senderAddress.toLowerCase(),
        senderInboxId,
        conversationId,
        isDm,
        text,
        messageId,
      });
    } catch (err) {
      onError?.(err as Error, "handle text message");
    }
  });

  agent.on("unhandledError", (error) => {
    onError?.(error, "unhandled agent error");
  });

  await agent.start();
  onConnect?.();

  return {
    async sendText(conversationId: string, text: string): Promise<void> {
      const conversation = await agent.client.conversations.getConversationById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      await conversation.sendText(text);
    },

    getAddress(): string {
      return agentAddress;
    },

    async close(): Promise<void> {
      await agent.stop();
    },
  };
}

export function normalizeEthAddress(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(trimmed)) {
    throw new Error("Invalid Ethereum address: must be 0x-prefixed 40 hex chars");
  }
  return trimmed;
}
