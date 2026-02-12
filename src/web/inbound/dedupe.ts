import { createGlobalDedupeCache } from "../../infra/dedupe.js";

const RECENT_WEB_MESSAGE_TTL_MS = 20 * 60_000;
const RECENT_WEB_MESSAGE_MAX = 5000;

const recentInboundMessages = createGlobalDedupeCache({
  globalKey: "openclaw:web-inbound-dedupe",
  ttlMs: RECENT_WEB_MESSAGE_TTL_MS,
  maxSize: RECENT_WEB_MESSAGE_MAX,
});

export function resetWebInboundDedupe(): void {
  recentInboundMessages.clear();
}

export function isRecentInboundMessage(key: string): boolean {
  return recentInboundMessages.check(key);
}
