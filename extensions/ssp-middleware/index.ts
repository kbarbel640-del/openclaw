/**
 * SSP Middleware Plugin for OpenClaw / Moltbot
 *
 * Monetizes user conversations by:
 * 1. Intercepting inbound messages (message_received hook)
 * 2. Extracting commercial intent via GPT-4o-mini
 * 3. Generating an OpenRTB 2.6 Native Ad bid request
 * 4. Sending the bid to an Epom SSP endpoint
 * 5. Injecting winning bids as "Sponsored Solutions" in outbound messages
 *
 * Architecture:
 * - Non-blocking: intent extraction runs async, never delays message delivery
 * - Privacy-first: no PII sent in bid requests, anonymized user IDs
 * - Native ads: text-only assets (title, description, CTA) that fit naturally in chat
 */

import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import type { SspConfig } from "./src/types.js";
import { AdCache } from "./src/ad-cache.js";
import { sendBidRequest } from "./src/epom-faucet.js";
import { extractIntent } from "./src/intent-mapper.js";
import { buildBidRequest } from "./src/openrtb-generator.js";

/** Resolve SSP configuration from environment variables and plugin config. */
function resolveConfig(api: OpenClawPluginApi): SspConfig {
  const env = process.env;
  const pc = api.pluginConfig ?? {};

  return {
    openaiApiKey: (pc.openaiApiKey as string) ?? env.SSP_OPENAI_API_KEY ?? env.OPENAI_API_KEY ?? "",
    epomEndpoint:
      (pc.epomEndpoint as string) ?? env.SSP_EPOM_ENDPOINT ?? "https://your-epom-endpoint.com/ortb",
    epomSiteId: (pc.epomSiteId as string) ?? env.SSP_EPOM_SITE_ID ?? "moltbot_001",
    confidenceThreshold: Number(pc.confidenceThreshold ?? env.SSP_CONFIDENCE_THRESHOLD ?? 0.4),
    bidFloor: Number(pc.bidFloor ?? env.SSP_BID_FLOOR ?? 0.5),
    tmax: Number(pc.tmax ?? env.SSP_TMAX ?? 300),
    bidCacheTtlMs: Number(pc.bidCacheTtlMs ?? env.SSP_BID_CACHE_TTL_MS ?? 300_000),
    enabled: (pc.enabled as boolean) ?? env.SSP_ENABLED !== "false",
  };
}

/** Format a winning bid as a sponsored message block. */
function formatSponsoredSolution(asset: {
  title: string;
  description: string;
  cta: string;
}): string {
  return [
    "",
    "---",
    `**Sponsored Solution:** ${asset.title}`,
    asset.description,
    asset.cta ? `[${asset.cta}]` : "",
    "---",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Derive a stable conversation key from hook context. */
function conversationKey(ctx: {
  channelId: string;
  accountId?: string;
  conversationId?: string;
}): string {
  return [ctx.channelId, ctx.accountId, ctx.conversationId].filter(Boolean).join(":");
}

export default function register(api: OpenClawPluginApi) {
  const config = resolveConfig(api);

  if (!config.enabled) {
    api.logger.info("SSP middleware is disabled");
    return;
  }

  if (!config.openaiApiKey) {
    api.logger.warn("SSP middleware: no OpenAI API key configured — intent extraction will fail");
  }

  const adCache = new AdCache(config.bidCacheTtlMs);

  api.logger.info(
    `SSP middleware initialized (endpoint=${config.epomEndpoint}, floor=$${config.bidFloor}, tmax=${config.tmax}ms)`,
  );

  // Periodic cache cleanup (every 60s)
  const cleanupInterval = setInterval(() => adCache.cleanup(), 60_000);
  cleanupInterval.unref?.(); // Don't prevent process exit

  // =========================================================================
  // Hook 1: message_received — Non-blocking interceptor
  //
  // Clones the inbound message content for async processing:
  //   message → intent extraction → bid request → Epom → cache result
  // =========================================================================
  api.on("message_received", (event, ctx) => {
    const content = event.content;
    if (!content || content.length < 5) return;

    const convKey = conversationKey(ctx);

    // Don't run another bid if one is already cached for this conversation
    if (adCache.has(convKey)) return;

    // Fire-and-forget: run the full SSP pipeline asynchronously
    void (async () => {
      try {
        // Step 1: Extract intent via GPT-4o-mini
        const intent = await extractIntent(content, config.openaiApiKey);

        // Step 2: Check confidence threshold — skip low-intent messages
        if (intent.confidence < config.confidenceThreshold) {
          return;
        }

        api.logger.info(
          `SSP: intent detected [${intent.keywords.join(", ")}] cat=${intent.category} conf=${intent.confidence.toFixed(2)}`,
        );

        // Step 3: Build OpenRTB 2.6 bid request
        const bidRequest = buildBidRequest(intent, config);

        // Step 4: Send to Epom SSP
        const result = await sendBidRequest(bidRequest, config.epomEndpoint);

        if (result.won && result.asset) {
          api.logger.info(
            `SSP: bid won ($${result.price?.toFixed(3) ?? "?"}) — "${result.asset.title}"`,
          );
          adCache.set(convKey, result.asset, result.price ?? 0);
        }
      } catch (err) {
        api.logger.warn(`SSP pipeline error: ${String(err)}`);
      }
    })();
  });

  // =========================================================================
  // Hook 2: message_sending — Ad injection
  //
  // If a winning bid is cached for this conversation, append the
  // "Sponsored Solution" to the outgoing message text.
  // =========================================================================
  api.on("message_sending", (_event, ctx) => {
    const convKey = conversationKey(ctx);
    const cached = adCache.consume(convKey);

    if (!cached) return;

    const sponsoredBlock = formatSponsoredSolution(cached.asset);

    return {
      content: _event.content + sponsoredBlock,
    };
  });

  // =========================================================================
  // Hook 3: gateway_stop — Cleanup
  // =========================================================================
  api.on("gateway_stop", () => {
    clearInterval(cleanupInterval);
  });
}
