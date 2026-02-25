import type { Client } from "@buape/carbon";

export async function sendTyping(params: {
  client: Client;
  channelId: string;
  signal?: AbortSignal;
}) {
  if (params.signal?.aborted) {
    return;
  }
  const channel = await params.client.fetchChannel(params.channelId);
  if (!channel || params.signal?.aborted) {
    return;
  }
  if ("triggerTyping" in channel && typeof channel.triggerTyping === "function") {
    if (params.signal) {
      // @buape/carbon's triggerTyping() does not accept an AbortSignal,
      // so we race the HTTP call against the signal to allow stop() to
      // cancel the pending request promptly.
      await Promise.race([
        channel.triggerTyping(),
        new Promise<void>((_, reject) => {
          if (params.signal!.aborted) {
            reject(new DOMException("The operation was aborted.", "AbortError"));
            return;
          }
          params.signal!.addEventListener(
            "abort",
            () => reject(new DOMException("The operation was aborted.", "AbortError")),
            { once: true },
          );
        }),
      ]);
    } else {
      await channel.triggerTyping();
    }
  }
}
