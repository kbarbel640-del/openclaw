import type { Client } from "@buape/carbon";

export async function sendTyping(params: { client: Client; channelId: string }) {
  const channel = await params.client.fetchChannel(params.channelId);
  if (!channel) {
    return;
  }
  if ("triggerTyping" in channel && typeof channel.triggerTyping === "function") {
    await channel.triggerTyping();
  }
}

// Some Discord client implementations expose a stopTyping/clearTyping method.
// Provide a best-effort stop function so channels that call it can cancel the
// typing indicator when available.
export async function stopTyping(params: { client: Client; channelId: string }) {
  const channel = await params.client.fetchChannel(params.channelId);
  if (!channel) {
    return;
  }
  if ("stopTyping" in channel && typeof channel.stopTyping === "function") {
    try {
      // Best-effort: some libs implement stopTyping to cancel the indicator.
      // If not available, this is a no-op.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (channel as any).stopTyping();
    } catch {
      // Ignore errors from stopTyping.
    }
  }
}
