import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { setWebexRuntime } from "./src/runtime.js";
import { webexPlugin } from "./src/channel.js";
import { handleWebexWebhookRequest } from "./src/monitor.js";

/**
 * OpenClaw Cisco Webex channel plugin
 * 
 * Provides bidirectional messaging with Cisco Webex Teams via bot API.
 * Supports direct messages and group conversations with webhook-based
 * inbound message processing.
 */
const plugin = {
  id: "webex",
  name: "Webex",
  description: "Cisco Webex channel plugin",
  configSchema: webexPlugin.configSchema,
  register(api: OpenClawPluginApi) {
    setWebexRuntime(api.runtime);
    api.registerChannel({ plugin: webexPlugin });
    api.registerHttpHandler(handleWebexWebhookRequest);
  },
};

export default plugin;