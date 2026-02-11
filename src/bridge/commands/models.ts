import { modelsAuthListLogic } from "../../commands/models/auth-list.logic.js";
import {
  performAuthSwitch,
  getAuthSwitchContext,
} from "../../commands/models/auth-switch.logic.js";
import { modelsListLogic } from "../../commands/models/list.logic.js";
import { bridgeRegistry } from "../registry.js";
import { BridgeResult } from "../types.js";

// Adapter helper
function success<T>(data: T, view?: BridgeResult["view"]): BridgeResult<T> {
  return { success: true, data, view };
}

function failure(error: string): BridgeResult {
  return { success: false, error };
}

// 1. models.list
bridgeRegistry.register({
  name: "models.list",
  description: "List available models and their status",
  handler: async (args: any) => {
    try {
      const { rows, error } = await modelsListLogic(args || {});
      // Partial success is still success in list logic, but we can signal warnings if needed
      return {
        success: true,
        data: rows,
        error, // Pass through partial error
        view: "table",
      };
    } catch (err) {
      return failure(String(err));
    }
  },
});

// 2. models.auth.list
bridgeRegistry.register({
  name: "models.auth.list",
  description: "List authentication profiles",
  handler: async (args: any) => {
    try {
      const result = await modelsAuthListLogic(args || {});
      return success(result, "table");
    } catch (err) {
      return failure(String(err));
    }
  },
});

// 3. models.switch
bridgeRegistry.register({
  name: "models.switch",
  description: "Switch active model profile",
  handler: async (args: any) => {
    try {
      if (!args.provider || !args.profile) {
        return failure("Missing required args: provider, profile");
      }
      const ctx = getAuthSwitchContext({ provider: args.provider, agent: args.agent });
      await performAuthSwitch(ctx, args.profile);
      return success({ message: `Switched ${args.provider} to ${args.profile}` }, "text");
    } catch (err) {
      return failure(String(err));
    }
  },
});
