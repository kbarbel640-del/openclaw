import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerMeshCommand } from "./src/mesh-command.js";
import { registerMeshGatewayMethods } from "./src/mesh-gateway.js";

const meshPlugin = {
  id: "mesh",
  name: "Mesh",
  description: "Workflow orchestration plugin with DAG planning, runs, and retries.",
  register(api: OpenClawPluginApi) {
    registerMeshGatewayMethods(api);
    registerMeshCommand(api);
  },
};

export default meshPlugin;
