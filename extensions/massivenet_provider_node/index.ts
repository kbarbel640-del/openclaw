import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { createMassiveNetProviderNodeService } from "./src/service.js";

const plugin = {
  id: "massivenet_provider_node",
  name: "MassiveNet Provider Node",
  description: "Thin MassiveNet provider-node worker loop for polling and completing node jobs.",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerService(createMassiveNetProviderNodeService());
  },
};

export default plugin;
