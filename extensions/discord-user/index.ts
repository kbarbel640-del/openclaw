import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { discordUserPlugin } from "./src/channel.js";
import { setDiscordUserRuntime } from "./src/runtime.js";

const plugin = {
  id: "discord-user",
  name: "Discord (User)",
  description: "Discord user-account channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setDiscordUserRuntime(api.runtime);
    api.registerChannel({ plugin: discordUserPlugin });
  },
};

export default plugin;
