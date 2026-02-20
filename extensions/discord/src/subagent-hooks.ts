import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { unbindThreadBindingsBySessionKey } from "openclaw/plugin-sdk";

export function registerDiscordSubagentHooks(api: OpenClawPluginApi) {
  api.on("subagent_ended", (event) => {
    unbindThreadBindingsBySessionKey({
      targetSessionKey: event.targetSessionKey,
      accountId: event.accountId,
      targetKind: event.targetKind,
      reason: event.reason,
      sendFarewell: event.sendFarewell,
    });
  });
}
