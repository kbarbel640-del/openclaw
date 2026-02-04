import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema, registerPluginHooksFromDir } from "openclaw/plugin-sdk";
import { registerMeridiaCli } from "./src/cli/meridia-cli.js";
import { closeMeridiaDb } from "./src/meridia/db/sqlite.js";
import { createExperienceCaptureTool } from "./src/tools/experience-capture-tool.js";
import { createExperienceReflectTool } from "./src/tools/experience-reflect-tool.js";
import { createExperienceSearchTool } from "./src/tools/experience-search-tool.js";

const meridiaPlugin = {
  id: "meridia",
  name: "Meridia",
  description: "Experiential continuity capture, search, reflection, and reconstitution",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerTool(
      (ctx) => {
        const search = createExperienceSearchTool({ config: ctx.config });
        const capture = createExperienceCaptureTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });
        const reflect = createExperienceReflectTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });
        return [search, capture, reflect].filter(Boolean);
      },
      { names: ["experience_search", "experience_capture", "experience_reflect"] },
    );

    api.registerCli(
      ({ program, config }) => {
        registerMeridiaCli(program, config);
      },
      { commands: ["meridia"] },
    );

    registerPluginHooksFromDir(api, "./hooks");

    api.registerService({
      id: "meridia-db",
      start: () => undefined,
      stop: () => {
        closeMeridiaDb();
      },
    });
  },
};

export default meridiaPlugin;
