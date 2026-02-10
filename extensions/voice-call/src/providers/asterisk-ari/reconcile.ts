import type { CallManager } from "../../manager.js";
import type { AriClient } from "./ari-client.js";
import type { AriConfig } from "./types.js";
import { makeEvent } from "./utils.js";

export async function reconcileLingeringCalls(params: {
  client: AriClient;
  cfg: AriConfig;
  manager: CallManager;
  providerName: string;
}): Promise<void> {
  try {
    const channels = await params.client.listChannels();
    const appChannels = channels.filter((ch) => {
      const appData = ch.dialplan?.app_data ?? "";
      return ch.dialplan?.app_name === "Stasis" && appData.includes(params.cfg.app);
    });
    for (const channel of appChannels) {
      await params.client.safeHangupChannel(channel.id).catch(() => {});
    }

    const calls = params.manager
      .getActiveCalls()
      .filter((call) => call.provider === params.providerName);
    for (const call of calls) {
      const result = await params.manager.endCall(call.callId);
      if (!result.success) {
        params.manager.processEvent(
          makeEvent({
            type: "call.ended",
            callId: call.callId,
            providerCallId: call.providerCallId,
            reason: "hangup-bot",
          }),
        );
      }
    }
  } catch (err) {
    console.warn("[ari] Failed to reconcile lingering calls", err);
  }
}
