import type { AmigoPluginApi } from "../../src/plugins/types.js";
import { createLlmTaskTool } from "./src/llm-task-tool.js";

export default function register(api: AmigoPluginApi) {
  api.registerTool(createLlmTaskTool(api), { optional: true });
}
