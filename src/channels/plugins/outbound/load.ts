import { INTERNAL_MESSAGE_CHANNEL } from "../../../utils/message-channel.js";
import { createChannelRegistryLoader } from "../registry-loader.js";
import type { ChannelId, ChannelOutboundAdapter } from "../types.js";
import { webchatOutbound } from "./webchat.js";

// Channel docking: outbound sends should stay cheap to import.
//
// The full channel plugins (src/channels/plugins/*.ts) pull in status,
// onboarding, gateway monitors, etc. Outbound delivery only needs chunking +
// send primitives, so we keep a dedicated, lightweight loader here.
const loadOutboundAdapterFromRegistry = createChannelRegistryLoader<ChannelOutboundAdapter>(
  (entry) => entry.plugin.outbound,
);

export async function loadChannelOutboundAdapter(
  id: ChannelId,
): Promise<ChannelOutboundAdapter | undefined> {
  // Webchat is the internal channel — not a registered plugin. Return its
  // adapter directly so delivery-dispatch can route cron output to webchat.
  if ((id as string) === INTERNAL_MESSAGE_CHANNEL) {
    return webchatOutbound;
  }
  return loadOutboundAdapterFromRegistry(id);
}
