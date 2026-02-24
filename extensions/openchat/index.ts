import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { openChatPlugin } from "./src/channel.js";
import { setOpenChatRuntime } from "./src/runtime.js";

const plugin = {
  id: "openchat",
  name: "OpenChat",
  description: "OpenChat channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setOpenChatRuntime(api.runtime);
    api.registerChannel({ plugin: openChatPlugin });
  },
};

export default plugin;
