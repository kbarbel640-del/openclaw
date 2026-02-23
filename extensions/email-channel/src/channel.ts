/**
 * Email Channel Plugin Implementation
 */

import type { ChannelPlugin } from "openclaw/plugin-sdk";

export const emailChannelPlugin: ChannelPlugin = {
  id: "email",

  meta: {
    label: "Email (IMAP/SMTP)",
    discovery: {
      category: "email",
      keywords: ["email", "imap", "smtp", "messaging"],
      maturity: "experimental",
      docsLink:
        "https://github.com/guxiaobo/openclaw/tree/feature/email-channel/extensions/email-channel",
      author: "OpenClaw Community",
    },
  },

  capabilities: {
    canSendText: true,
    canSendMedia: true,
    canSendFiles: true,
    canReceiveText: true,
    canReceiveMedia: true,
    canReceiveFiles: true,
    canSendReplies: true,
    canReceiveReadReceipts: false,
    canThreadReplies: true,
    canSendReactions: false,
  },

  config: {
    resolveAccount(cfg, accountId) {
      const account = cfg.channels?.email?.accounts?.[accountId || "default"];

      if (!account) {
        throw new Error(`Email account not found: ${accountId}`);
      }

      return {
        accountId: accountId || "default",
        imap: account.imap,
        smtp: account.smtp,
        allowedSenders: account.allowedSenders ?? [],
        enabled: account.enabled ?? true,
      };
    },

    listAccountIds(cfg) {
      return Object.keys(cfg.channels?.email?.accounts ?? {});
    },
  },

  outbound: {
    async send(context, target, _payload) {
      // TODO: Implement email sending via SMTP
      context.log("info", "Email sent", {
        to: target.peerId,
        subject: "Message from OpenClaw",
      });

      return {
        externalId: `email-${Date.now()}`,
      };
    },
  },

  status: {
    async probe(_account) {
      // TODO: Implement IMAP/SMTP connectivity test
      const issues = [];
      return {
        ok: issues.length === 0,
        issues,
      };
    },
  },

  security: {
    resolveDmPolicy(context, _sender) {
      const { account, parsedSender } = context;
      const allowedSenders = account.allowedSenders ?? [];

      if (allowedSenders.length === 0) {
        context.log("warn", "No allowed senders configured, blocking email", {
          sender: parsedSender.raw,
        });
        return { decision: "blocked", reason: "no_allowed_senders" };
      }

      const senderAddress = parsedSender.address.toLowerCase();
      const isAllowed = allowedSenders.some((pattern: string) => {
        const p = pattern.toLowerCase();
        if (p.startsWith("*@")) {
          const domain = p.slice(2);
          return senderAddress.endsWith(domain);
        }
        return senderAddress === p;
      });

      if (isAllowed) {
        return { decision: "allowed" };
      }

      context.log("info", "Sender not in allowed list", {
        sender: parsedSender.raw,
        allowedSenders,
      });
      return { decision: "blocked", reason: "not_in_allowed_senders" };
    },
  },

  messaging: {
    async *poll(_context) {
      // TODO: Implement IMAP email polling
      yield* [];
    },
  },
};
