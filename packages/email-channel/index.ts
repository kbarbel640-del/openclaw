import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emailPlugin } from "./src/channel";
import { setEmailRuntime } from "./src/channel";

const plugin = {
  id: "email",
  register(api: ClawdbotPluginApi) {
    setEmailRuntime(api.runtime);
    api.registerChannel({ plugin: emailPlugin });
  },
};

export default plugin;
