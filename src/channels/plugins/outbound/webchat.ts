import type { ChannelOutboundAdapter } from "../types.js";

// Webchat outbound adapter — delivers cron output to webchat sessions.
//
// Unlike other channel adapters that call external APIs, webchat delegates to
// deps.sendWebchat which is a closure over gateway state (broadcast,
// nodeSendToSession, appendAssistantTranscriptMessage). The closure is
// constructed at gateway startup and injected into the deps chain.
export const webchatOutbound: ChannelOutboundAdapter = {
  deliveryMode: "gateway",

  resolveTarget: ({ to }) => {
    const sessionKey = to?.trim();
    if (!sessionKey) {
      return { ok: false, error: new Error("webchat delivery requires a session key") };
    }
    return { ok: true, to: sessionKey };
  },

  sendText: async ({ to, text, deps }) => {
    const send = deps?.sendWebchat;
    if (!send) {
      throw new Error("sendWebchat dep not available — webchat delivery requires gateway context");
    }
    const result = await send(to, text);
    return { channel: "webchat" as const, ...result };
  },

  sendMedia: async ({ to, text, mediaUrl, deps }) => {
    const send = deps?.sendWebchat;
    if (!send) {
      throw new Error("sendWebchat dep not available — webchat delivery requires gateway context");
    }
    const combined = mediaUrl ? `${text}\n\n${mediaUrl}` : text;
    return { channel: "webchat" as const, ...(await send(to, combined)) };
  },
};
