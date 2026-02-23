/**
 * Email Channel Plugin for OpenClaw
 * Uses official Plugin SDK - no SDK modifications required
 */

import type { ChannelPlugin, OpenClawConfig, ChannelGatewayAdapter } from "openclaw/plugin-sdk";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";
import { startEmail, stopEmail, sendEmail, type EmailAttachment } from "./runtime.js";

// Email account configuration
interface EmailAccount {
  accountId?: string;
  enabled?: boolean;
  imap: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
  checkInterval?: number;
  allowedSenders?: string[];
  maxAttachmentSize?: number;
}

// Store email context for outbound messaging
const emailContexts = new Map<string, { fromEmail: string; subject: string; messageId: string }>();

export function getEmailContext(sessionKey: string) {
  return emailContexts.get(sessionKey);
}

// Gateway adapter for email channel
const emailGatewayAdapter: ChannelGatewayAdapter<EmailAccount> = {
  startAccount: async (ctx) => {
    const account = ctx.account as EmailAccount;

    if (!account || !account.enabled) {
      ctx.log?.info?.(`[${account.accountId}] Email account disabled`);
      return;
    }

    if (
      !account.imap?.host ||
      !account.imap?.port ||
      !account.imap?.user ||
      !account.imap?.password
    ) {
      ctx.log?.error?.(`[${account.accountId}] Email IMAP configuration incomplete`);
      return;
    }

    if (
      !account.smtp?.host ||
      !account.smtp?.port ||
      !account.smtp?.user ||
      !account.smtp?.password
    ) {
      ctx.log?.error?.(`[${account.accountId}] Email SMTP configuration incomplete`);
      return;
    }

    ctx.log?.info?.(`[${account.accountId}] Starting email channel`);

    // Log allowed senders configuration with security warning
    if (account.allowedSenders && account.allowedSenders.length > 0) {
      ctx.log?.info?.(
        `[${account.accountId}] Only accepting emails from: ${account.allowedSenders.join(", ")}`,
      );
      ctx.log?.warn?.(
        `[${account.accountId}] WARNING: allowedSenders checks "From" address which can be forged. Use with IMAP server-level DKIM/SPF/DMARC validation for security.`,
      );
    } else {
      ctx.log?.info?.(`[${account.accountId}] Accepting emails from all senders`);
    }

    // Log attachment size limit
    const maxAttachmentSize = account.maxAttachmentSize || 10 * 1024 * 1024;
    ctx.log?.info?.(
      `[${account.accountId}] Maximum attachment size: ${(maxAttachmentSize / 1024 / 1024).toFixed(2)}MB`,
    );

    // Start email processing
    startEmail(
      account.accountId || "default",
      account,
      async (from, fromEmail, subject, body, messageId, uid, attachments) => {
        // Process attachments: save to temporary files
        const attachmentPaths: string[] = [];
        const attachmentsDir = `/tmp/openclaw-email-attachments/${Date.now()}`;

        if (attachments.length > 0) {
          try {
            const fs = await import("fs");
            const path = await import("path");

            if (!fs.existsSync(attachmentsDir)) {
              fs.mkdirSync(attachmentsDir, { recursive: true });
            }

            for (const att of attachments) {
              const sanitizedFilename = att.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
              const filePath = path.join(attachmentsDir, sanitizedFilename);
              fs.writeFileSync(filePath, att.content);
              attachmentPaths.push(filePath);

              ctx.log?.info?.(
                `[${account.accountId}] Saved attachment: ${att.filename} to ${filePath}`,
              );
            }
          } catch (error) {
            ctx.log?.error?.(`[${account.accountId}] Error saving attachments: ${String(error)}`);
          }
        }

        // Build formatted message envelope
        let message = `From: ${from}\nSubject: ${subject}\n\n${body}`;

        // Add attachment information
        if (attachments.length > 0) {
          message += `\n\n--- Attachments ---\n`;
          for (let i = 0; i < attachments.length; i++) {
            const att = attachments[i];
            message += `- ${att.filename} (${(att.size / 1024).toFixed(2)}KB, ${att.contentType})\n`;
            if (attachmentPaths[i]) {
              message += `  File: ${attachmentPaths[i]}\n`;
            }
          }
        }

        // Add system instructions for file generation
        message += `\n\n--- System Instructions ---\n`;
        message += `This is an email channel. If you need to generate any files:\n\n`;
        message += `1. Save files to /tmp/ or /tmp/openclaw-generated/\n`;
        message += `2. Each file should only exist in ONE path\n`;
        message += `3. Mention the file path in your response\n`;
        message += `4. The system will automatically attach it to the reply\n`;

        // Use fromEmail as sessionKey
        const sessionKey = `email:${fromEmail}`;

        ctx.log?.info?.(
          `[${account.accountId}] Processing email from ${fromEmail}: "${subject}" (UID: ${uid}, Attachments: ${attachments.length})`,
        );

        try {
          // Store email context for outbound messaging
          emailContexts.set(sessionKey, { fromEmail, subject, messageId });

          // TODO: Implement message dispatch using channel runtime
          // For now, just log the message
          ctx.log?.info?.(`[${account.accountId}] Email received and ready for processing`);

          ctx.log?.info?.(`[${account.accountId}] Email processed successfully`);
        } catch (error: any) {
          ctx.log?.error?.(
            `[${account.accountId}] Error processing email from ${fromEmail}: ${error?.message || String(error)}`,
          );

          // Send error notification
          try {
            const errorMessage =
              "Sorry, there was an error processing your request. Please try again later.";
            await sendEmail(
              account.accountId || "default",
              fromEmail,
              subject,
              errorMessage,
              messageId,
            );
          } catch (sendError) {
            ctx.log?.error?.(
              `[${account.accountId}] Failed to send error notification: ${String(sendError)}`,
            );
          }
        }
      },
    );

    // Return cleanup function
    return () => {
      ctx.log?.info?.(`[${account.accountId}] Stopping email channel`);
      stopEmail(account.accountId || "default");
    };
  },
};

const emailPlugin: ChannelPlugin<EmailAccount> = {
  id: "email",

  meta: {
    id: "email",
    label: "Email",
    selectionLabel: "Email (IMAP/SMTP)",
    docsPath: "/channels/email",
    blurb: "Send and receive email via IMAP/SMTP servers.",
    aliases: ["mail", "smtp"],
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
    chatTypes: ["direct"],
  },

  config: {
    listAccountIds: (cfg: OpenClawConfig) => {
      const accounts = cfg.channels?.email?.accounts;
      return accounts ? Object.keys(accounts) : [];
    },

    resolveAccount: (cfg: OpenClawConfig, accountId?: string) => {
      const accounts = cfg.channels?.email?.accounts;
      const account = accounts?.[accountId || "default"] || accounts?.default || {};
      return {
        accountId: accountId || "default",
        enabled: account.enabled ?? true,
        ...account,
      } as EmailAccount;
    },

    isConfigured: (account: EmailAccount) => {
      return Boolean(
        account.imap?.host &&
        account.imap?.port &&
        account.imap?.user &&
        account.imap?.password &&
        account.smtp?.host &&
        account.smtp?.port &&
        account.smtp?.user &&
        account.smtp?.password,
      );
    },
  },

  // Use standard config schema builder from SDK
  configSchema: buildChannelConfigSchema({
    properties: {
      imap: {
        type: "object",
        description: "IMAP server configuration",
        properties: {
          host: { type: "string", description: "IMAP server hostname" },
          port: { type: "number", description: "IMAP server port" },
          secure: { type: "boolean", description: "Use TLS", default: true },
          user: { type: "string", description: "Email address/username" },
          password: {
            type: "string",
            description: "Email password or app password",
            sensitive: true,
          },
        },
        required: ["host", "port", "user", "password"],
      },
      smtp: {
        type: "object",
        description: "SMTP server configuration",
        properties: {
          host: { type: "string", description: "SMTP server hostname" },
          port: { type: "number", description: "SMTP server port" },
          secure: { type: "boolean", description: "Use SSL/TLS", default: true },
          user: { type: "string", description: "Email address/username" },
          password: {
            type: "string",
            description: "Email password or app password",
            sensitive: true,
          },
        },
        required: ["host", "port", "user", "password"],
      },
      allowedSenders: {
        type: "array",
        description: "Whitelist of allowed email addresses (Note: From header can be forged)",
        items: { type: "string" },
        default: [],
      },
      maxAttachmentSize: {
        type: "number",
        description: "Maximum attachment size in bytes (default: 10MB)",
        default: 10485760,
      },
      checkInterval: {
        type: "number",
        description: "Email check interval in seconds (default: 30)",
        default: 30,
      },
    },
    required: ["imap", "smtp"],
  }),

  gateway: emailGatewayAdapter,

  security: {
    resolveDmPolicy: (context, _sender) => {
      const { account } = context;
      const allowedSenders = account.allowedSenders ?? [];

      if (allowedSenders.length === 0) {
        context.log?.warn?.("No allowed senders configured, accepting all emails");
        return { decision: "allowed" };
      }

      const senderEmail = _sender.toLowerCase();
      const isAllowed = allowedSenders.some((pattern: string) => {
        const p = pattern.toLowerCase();
        if (p.startsWith("*@")) {
          const domain = p.slice(2);
          return senderEmail.endsWith(domain);
        }
        return senderEmail === p;
      });

      if (isAllowed) {
        return { decision: "allowed" };
      }

      context.log?.info?.("Sender not in allowed list", {
        sender: _sender,
        allowedSenders,
      });
      return { decision: "blocked", reason: "not_in_allowed_senders" };
    },
  },

  outbound: {
    deliveryMode: "direct",
    sendText: async ({ text, to }) => {
      // Parse target format: "accountId:recipientEmail|subject|messageId"
      const match = to.match(/^([^:]+):([^|]+)\|([^|]+)\|(.+)$/);
      if (!match) {
        return {
          ok: false,
          error: "Invalid email target format",
          channel: "email" as const,
          messageId: `error-${Date.now()}`,
        };
      }

      const [, accountId, recipientEmail, subject, messageId] = match;
      const success = await sendEmail(accountId, recipientEmail, subject, text, messageId);

      return {
        ok: success,
        channel: "email" as const,
        messageId: success ? messageId : `failed-${Date.now()}`,
      };
    },
  },

  messaging: {
    normalizeTarget: (raw: string) => {
      // If already in correct format, return as-is
      if (raw.match(/^[^:]+:[^|]+\|[^|]+\|.+$/)) {
        return raw;
      }

      // Strip "email:" prefix if present
      let emailAddr = raw.startsWith("email:") ? raw.substring(6) : raw;

      // If it looks like an email address, format it
      if (emailAddr.includes("@") && !emailAddr.includes("|")) {
        const contextKey = `email:${emailAddr}`;
        const context = emailContexts.get(contextKey);
        if (context) {
          return `default:${emailAddr}|${context.subject}|${context.messageId}`;
        }
        return `default:${emailAddr}|No Subject|no-message-id`;
      }

      return raw;
    },
  },
};

export { emailPlugin };
