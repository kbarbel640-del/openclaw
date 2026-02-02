import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { larkPlugin } from "./src/channel.js";
import { setLarkRuntime } from "./src/runtime.js";

const plugin = {
  id: "lark",
  name: "Lark (飞书)",
  description: "飞书/Lark 企业协作平台频道插件",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setLarkRuntime(api.runtime);
    api.registerChannel({ plugin: larkPlugin });
  },
};

export default plugin;
