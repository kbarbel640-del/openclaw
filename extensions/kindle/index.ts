import type { AnyAgentTool, OpenClawPluginApi } from "../../src/plugins/types.js";
import { createKindleTools } from "./src/kindle-tools.js";

export default function register(api: OpenClawPluginApi) {
  const tools = createKindleTools(api);
  for (const tool of tools) {
    api.registerTool(tool as unknown as AnyAgentTool, { optional: true });
  }
}
