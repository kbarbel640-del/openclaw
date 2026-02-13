/**
 * OpenRTB 2.6 Bid Request Generator
 *
 * Constructs a valid BidRequest JSON for Native Ads (v1.2).
 * Requests Data Assets (Title, Description, CTA) so the ad
 * can be rendered as a natural chat message ("Sponsored Solution").
 */

import { randomUUID } from "node:crypto";
import type { IntentSignal, SspConfig } from "./types.js";

/**
 * Native ad request payload (OpenRTB Native 1.2).
 * Assets:
 *   1 - Title (max 80 chars)
 *   2 - Description / body text (data type 2, max 140 chars)
 *   3 - CTA button text (data type 12)
 */
const NATIVE_REQUEST_PAYLOAD = JSON.stringify({
  assets: [
    { id: 1, required: 1, title: { len: 80 } },
    { id: 2, required: 1, data: { type: 2, len: 140 } },
    { id: 3, required: 1, data: { type: 12 } },
  ],
});

export type OpenRtbBidRequest = {
  id: string;
  at: number;
  tmax: number;
  imp: Array<{
    id: string;
    native: { ver: string; request: string };
    bidfloor: number;
    bidfloorcur: string;
  }>;
  site: {
    id: string;
    name: string;
    domain: string;
    cat: string[];
    keywords: string;
  };
  device: { ua: string; ip: string };
  user: { id: string };
};

/**
 * Build an OpenRTB 2.6 bid request from extracted intent signals.
 *
 * @param intent - Commercial intent extracted by the Intent Mapper
 * @param config - SSP middleware configuration
 * @param userIp - End-user IP (defaults to placeholder for privacy)
 * @param userId - Hashed/anonymized user identifier
 */
export function buildBidRequest(
  intent: IntentSignal,
  config: SspConfig,
  userIp = "0.0.0.0",
  userId?: string,
): OpenRtbBidRequest {
  return {
    id: `moltbot_${randomUUID()}`,
    at: 2, // Second-price auction
    tmax: config.tmax,
    imp: [
      {
        id: "1",
        native: {
          ver: "1.2",
          request: NATIVE_REQUEST_PAYLOAD,
        },
        bidfloor: config.bidFloor,
        bidfloorcur: "USD",
      },
    ],
    site: {
      id: config.epomSiteId,
      name: "Moltbot_Agent",
      domain: "molt.bot",
      cat: [intent.category],
      keywords: intent.keywords.join(","),
    },
    device: {
      ua: "Moltbot-Agent-v1",
      ip: userIp,
    },
    user: {
      id: userId ?? `anon_${randomUUID().slice(0, 8)}`,
    },
  };
}
