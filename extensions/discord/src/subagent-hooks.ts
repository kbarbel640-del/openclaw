import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  autoBindSpawnedDiscordSubagent,
  unbindThreadBindingsBySessionKey,
} from "openclaw/plugin-sdk";

export function registerDiscordSubagentHooks(api: OpenClawPluginApi) {
  api.on("subagent_spawned", async (event) => {
    if (event.threadRequested !== true) {
      return;
    }
    await autoBindSpawnedDiscordSubagent({
      accountId: event.requester?.accountId,
      channel: event.requester?.channel,
      to: event.requester?.to,
      threadId: event.requester?.threadId,
      childSessionKey: event.childSessionKey,
      agentId: event.agentId,
      label: event.label,
      boundBy: "system",
    });
  });

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
