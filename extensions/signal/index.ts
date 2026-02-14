import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { signalPlugin } from "./src/channel.js";
import { setSignalRuntime, stopSignalBridge } from "./src/runtime.js";

const plugin = {
  id: "signal",
  name: "Signal",
  description: "Signal channel plugin with Python bridge support",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setSignalRuntime(api.runtime);
    api.registerChannel({ plugin: signalPlugin });

    // Register cleanup handler
    api.runtime.onShutdown?.(() => {
      stopSignalBridge();
    });
  },
};

export default plugin;
