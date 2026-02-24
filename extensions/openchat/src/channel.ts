import {
  type ChannelPlugin,
  type OpenClawConfig,
  DEFAULT_ACCOUNT_ID,
} from "openclaw/plugin-sdk";
import { getOpenChatRuntime } from "./runtime.js";

const meta = {
  id: "openchat",
  label: "OpenChat",
  blurb: "Connects to your custom OpenChat application",
  systemImage: "bubble.left.and.bubble.right.fill", // Generic chat icon
};

export interface OpenChatAccountConfig {
  endpoint?: string;
  token?: string;
  enabled?: boolean;
}

export interface ResolvedOpenChatAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  config: OpenChatAccountConfig;
  token?: string;
}

export const openChatPlugin: ChannelPlugin<ResolvedOpenChatAccount> = {
  id: "openchat",
  meta: {
    ...meta,
    name: "OpenChat",
  },
  capabilities: {
    chatTypes: ["direct", "channel"],
    media: true,
  },
  config: {
    listAccountIds: (cfg) => {
        const ids: string[] = [];
        if (cfg.channels?.openchat?.token) {
            ids.push(DEFAULT_ACCOUNT_ID);
        }
        if (cfg.channels?.openchat?.accounts) {
            ids.push(...Object.keys(cfg.channels.openchat.accounts));
        }
        return ids.length ? ids : [DEFAULT_ACCOUNT_ID];
    },
    resolveAccount: ({ cfg, accountId }) => {
        const id = accountId || DEFAULT_ACCOUNT_ID;
        const base = cfg.channels?.openchat;
        const account = base?.accounts?.[id];
        
        const config: OpenChatAccountConfig = {
            endpoint: account?.endpoint || base?.endpoint,
            token: account?.token || base?.token,
            enabled: account?.enabled ?? base?.enabled ?? true,
        };

        return {
            accountId: id,
            name: id,
            enabled: config.enabled ?? true,
            config,
            token: config.token,
        };
    },
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    isConfigured: (account) => Boolean(account.token),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.token),
    }),
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ to, text, accountId }) => {
      const runtime = getOpenChatRuntime();
      
      // TODO: Replace with actual HTTP call to OpenChat API
      // const token = ... (get from resolved account via runtime/config or cache)
      // await fetch(`${endpoint}/messages`, {
      //   method: 'POST',
      //   headers: { Authorization: `Bearer ${token}` },
      //   body: JSON.stringify({ to, text })
      // });
      
      runtime.log?.info(`[OpenChat] Sending text to ${to}: ${text}`);
      
      return { 
          channel: "openchat", 
          messageId: `msg-${Date.now()}`,
      };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId }) => {
      const runtime = getOpenChatRuntime();
      
      // TODO: Implement media sending logic
      // const mediaBuffer = await runtime.media.fetchRemoteMedia({ url: mediaUrl });
      // await uploadToOpenChat(mediaBuffer);
      
      runtime.log?.info(`[OpenChat] Sending media to ${to}: ${text} [${mediaUrl}]`);
      return { 
          channel: "openchat", 
          messageId: `media-${Date.now()}`,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const runtime = getOpenChatRuntime();
      const accountId = ctx.account.accountId;
      const config = ctx.account.config;

      runtime.log?.info(`[OpenChat] Starting account ${accountId}`);
      
      // TODO: Initialize polling or webhook server here
      // If using polling:
      const interval = setInterval(async () => {
        try {
            // 1. Fetch messages from OpenChat API
            // const messages = await fetchMessages(config.endpoint, config.token);
            
            // 2. Process each message
            // for (const msg of messages) {
            //    await processInboundMessage(msg, ctx);
            // }
            
            // Placeholder: Simulate receiving a message occasionally
            // if (Math.random() > 0.9) {
            //    await processInboundMessage({ 
            //      text: "Hello OpenClaw!", 
            //      sender: "user1", 
            //      id: `msg-${Date.now()}` 
            //    }, ctx);
            // }
        } catch (err) {
            runtime.error?.(`[OpenChat] Polling error: ${err}`);
        }
      }, 5000);

      ctx.abortSignal.addEventListener("abort", () => {
          clearInterval(interval);
          runtime.log?.info(`[OpenChat] Stopped account ${accountId}`);
      });
    },
  },
  setup: {
      validateInput: ({ input }) => {
          if (!input.token) return "Token is required";
          return null;
      },
      applyAccountConfig: ({ cfg, accountId, input }) => {
           return {
            ...cfg,
            channels: {
              ...cfg.channels,
              openchat: {
                ...cfg.channels?.openchat,
                enabled: true,
                ...(input.token ? { token: input.token } : {}),
                ...(input.endpoint ? { endpoint: input.endpoint } : {}),
              }
            }
          };
      }
  }
};

// Helper function to process inbound messages from OpenChat
// This function bridges the external message format to OpenClaw's internal pipeline
async function processInboundMessage(
  msg: { text: string; sender: string; id: string }, 
  ctx: { runtime: any; cfg: OpenClawConfig; account: ResolvedOpenChatAccount }
) {
    const { runtime, cfg, account } = ctx;
    
    // 1. Construct the inbound context
    // This normalizes the message into a format the agent understands
    const inboundCtx = runtime.channel.reply.finalizeInboundContext({
        Body: msg.text,
        BodyForAgent: msg.text, // The raw text for the LLM
        RawBody: msg.text,
        From: `openchat:${msg.sender}`, // Unique sender ID (e.g. openchat:user123)
        To: `openchat:${account.accountId}`, // The ID of the bot/channel receiving it
        SessionKey: `openchat:${account.accountId}:${msg.sender}`, // Session identifier
        AccountId: account.accountId,
        ChatType: "direct", // or "channel"
        ConversationLabel: `User ${msg.sender}`,
        SenderId: msg.sender,
        Provider: "openchat",
        Surface: "openchat", // Used for capability checking
        MessageSid: msg.id,
        MessageSidFull: msg.id,
        OriginatingChannel: "openchat",
        OriginatingTo: `openchat:${account.accountId}`,
    });

    // 2. Dispatch to the agent pipeline
    // This handles routing, agent selection, and generates a reply
    await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: inboundCtx,
        cfg,
        dispatcherOptions: {
            // Provide the callback to send the agent's response back to the user
            deliver: async (payload: { text?: string; mediaUrl?: string }) => {
                const to = msg.sender;
                
                if (payload.text) {
                     // In a real app, call your API here
                     // await api.sendMessage(to, payload.text);
                     runtime.log?.info(`[OpenChat] Agent replying to ${to}: ${payload.text}`);
                }
                
                if (payload.mediaUrl) {
                    runtime.log?.info(`[OpenChat] Agent sending media to ${to}: ${payload.mediaUrl}`);
                }
            },
            onError: (err: any) => {
                runtime.error?.(`[OpenChat] Reply dispatch failed: ${err}`);
            }
        }
    });
}
