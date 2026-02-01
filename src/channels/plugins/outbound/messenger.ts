import type { MessengerQuickReplyButton } from "../../../messenger/types.js";
import type { ChannelOutboundAdapter } from "../types.js";
import { chunkMessengerText, sendMessageMessenger } from "../../../messenger/send.js";

export const messengerOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: chunkMessengerText,
  chunkerMode: "text",
  textChunkLimit: 2000,
  sendText: async ({ to, text, accountId, deps }) => {
    const send = deps?.sendMessenger ?? sendMessageMessenger;
    const result = await send(to, text, {
      verbose: false,
      accountId: accountId ?? undefined,
    });
    return { channel: "messenger", ...result };
  },
  sendMedia: async ({ to, text, mediaUrl, accountId, deps }) => {
    const send = deps?.sendMessenger ?? sendMessageMessenger;
    const result = await send(to, text, {
      verbose: false,
      mediaUrl,
      accountId: accountId ?? undefined,
    });
    return { channel: "messenger", ...result };
  },
  sendPayload: async ({ to, payload, accountId, deps }) => {
    const send = deps?.sendMessenger ?? sendMessageMessenger;
    const messengerData = payload.channelData?.messenger as
      | { quickReplies?: MessengerQuickReplyButton[] }
      | undefined;
    const text = payload.text ?? "";
    const mediaUrls = payload.mediaUrls?.length
      ? payload.mediaUrls
      : payload.mediaUrl
        ? [payload.mediaUrl]
        : [];

    if (mediaUrls.length === 0) {
      const result = await send(to, text, {
        verbose: false,
        accountId: accountId ?? undefined,
        quickReplies: messengerData?.quickReplies,
      });
      return { channel: "messenger", ...result };
    }

    // Send media messages sequentially
    let finalResult: Awaited<ReturnType<typeof send>> | undefined;
    for (let i = 0; i < mediaUrls.length; i += 1) {
      const mediaUrl = mediaUrls[i];
      const isFirst = i === 0;
      finalResult = await send(to, isFirst ? text : "", {
        verbose: false,
        mediaUrl,
        accountId: accountId ?? undefined,
        ...(isFirst ? { quickReplies: messengerData?.quickReplies } : {}),
      });
    }
    return { channel: "messenger", ...(finalResult ?? { messageId: "unknown", recipientId: to }) };
  },
};
