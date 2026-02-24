import type { AnyAgentTool, OpenClawPluginApi } from "../../src/plugins/types.js";
import { createMeetingBotTool } from "./src/tool.js";

type PluginCfg = {
  apiKey?: string;
  baseUrl?: string;
};

const plugin = {
  id: "meeting-baas",
  name: "Meeting BaaS",
  description: "Record meetings on Google Meet, Zoom, and Microsoft Teams via Meeting BaaS",
  configSchema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      apiKey: { type: "string" },
      baseUrl: { type: "string" },
    },
  },
  register(api: OpenClawPluginApi) {
    const cfg = (api.pluginConfig ?? {}) as PluginCfg;
    api.registerTool(createMeetingBotTool(cfg) as unknown as AnyAgentTool, { optional: true });
  },
};

export default plugin;
