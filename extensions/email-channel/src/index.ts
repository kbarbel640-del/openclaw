/**
 * Email Channel Plugin for OpenClaw
 */

import type { OpenClawPluginApi, PluginRuntime } from "openclaw/plugin-sdk";
import { emailPlugin, setEmailRuntime } from "./channel.js";

const plugin = {
  id: "email-channel",
  name: "Email Channel",
  description: "Email channel plugin for sending and receiving messages via IMAP/SMTP",

  register(api: OpenClawPluginApi) {
    // Store runtime for use in channel
    setEmailRuntime(api.runtime);

    // Register the email channel
    api.registerChannel({ plugin: emailPlugin });

    api.runtime.log("info", "Email channel plugin registered", {
      plugin: "email-channel",
      version: "1.0.0",
    });
  },
};

export default plugin;
