import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  createSecretWalletInjectTool,
  createSecretWalletReadTools,
  createSecretWalletWriteTools,
} from "./src/tools.js";

export default function register(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as {
    binaryPath?: string;
    allowWriteTools?: boolean;
    allowInjectTool?: boolean;
  };

  const readTools = createSecretWalletReadTools(config);
  const writeTools = createSecretWalletWriteTools(config);
  const injectTool = createSecretWalletInjectTool(config);

  for (const tool of readTools) {
    api.registerTool(
      (ctx) => {
        if (ctx.sandboxed) return null;
        return tool;
      },
      { optional: true },
    );
  }

  if (config.allowWriteTools) {
    for (const tool of writeTools) {
      api.registerTool(
        (ctx) => {
          if (ctx.sandboxed) return null;
          return tool;
        },
        { optional: true },
      );
    }
  }

  if (config.allowInjectTool) {
    api.registerTool(
      (ctx) => {
        if (ctx.sandboxed) return null;
        return injectTool;
      },
      { optional: true },
    );
  }
}
