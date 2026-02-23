/**
 * Email Channel Plugin for OpenClaw
 * Official Plugin SDK - No modifications required
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emailPlugin } from "./channel.js";

const plugin = {
  id: "email-channel",
  name: "Email Channel",
  version: "1.0.0",
  description: "Email channel plugin for sending and receiving messages via IMAP/SMTP",

  register(api: OpenClawPluginApi) {
    // Register the email channel
    api.registerChannel({ plugin: emailPlugin });

    // Log registration (using console since runtime.log may not be available in all SDK versions)
    console.log("[EMAIL PLUGIN] Email channel plugin registered", {
      plugin: "email-channel",
      version: "1.0.0",
    });
  },
};

export default plugin;
