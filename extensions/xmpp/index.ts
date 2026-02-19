import type { ChannelPlugin, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { xmppPlugin } from "./src/channel.js";
import { setXmppRuntime } from "./src/runtime.js";

const plugin = {
  id: "xmpp",
  name: "XMPP",
  description: "XMPP channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setXmppRuntime(api.runtime);
    api.registerChannel({ plugin: xmppPlugin as ChannelPlugin });
  },
};

export default plugin;
