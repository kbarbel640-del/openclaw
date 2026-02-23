/**
 * Email Channel Plugin for OpenClaw
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { buildSimpleChannelConfigSchema } from "openclaw/plugin-sdk";
import { emailChannelPlugin } from "./channel.js";

const plugin = {
  id: "email-channel",
  name: "Email Channel",
  description: "Email channel plugin for sending and receiving messages via IMAP/SMTP",

  configSchema: buildSimpleChannelConfigSchema({
    accountProperties: {
      imap: {
        type: "object",
        description: "IMAP server configuration",
        properties: {
          host: { type: "string", description: "IMAP server hostname" },
          port: { type: "number", description: "IMAP server port" },
          user: { type: "string", description: "Email address/username" },
          password: {
            type: "string",
            description: "Email password or app password",
            sensitive: true,
          },
          tls: {
            type: "boolean",
            description: "Enable TLS",
            default: true,
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
          user: { type: "string", description: "Email address/username" },
          password: {
            type: "string",
            description: "Email password or app password",
            sensitive: true,
          },
          secure: {
            type: "boolean",
            description: "Use SSL/TLS",
            default: true,
          },
        },
        required: ["host", "port", "user", "password"],
      },
      allowedSenders: {
        type: "array",
        description: "Whitelist of allowed email addresses or patterns",
        items: { type: "string" },
        default: [],
      },
    },
  }),

  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: emailChannelPlugin });
    api.runtime.log("info", "Email channel plugin registered", {
      plugin: "email-channel",
      version: "1.0.0",
    });
  },
};

export default plugin;
