/**
 * Epom SSP Faucet
 *
 * Sends OpenRTB 2.6 bid requests to the Epom Ad Server endpoint
 * and parses the seatbid response to extract native ad assets.
 */

import type { OpenRtbBidRequest } from "./openrtb-generator.js";
import type { NativeAdAsset } from "./types.js";

/** Parsed bid response from Epom. */
export type BidResult = {
  won: boolean;
  asset?: NativeAdAsset;
  price?: number;
  /** Raw bid ID for impression tracking */
  bidId?: string;
  /** Win notice URL */
  nurl?: string;
};

type SeatBidResponse = {
  id: string;
  seatbid?: Array<{
    bid: Array<{
      id: string;
      impid: string;
      price: number;
      adm?: string;
      nurl?: string;
    }>;
    seat?: string;
  }>;
};

/**
 * Parse the `adm` field from the bid response.
 * The adm contains a JSON-encoded native ad response with assets.
 */
function parseNativeAdm(adm: string): NativeAdAsset | undefined {
  try {
    const native = JSON.parse(adm) as {
      native?: {
        assets?: Array<{
          id: number;
          title?: { text: string };
          data?: { value: string };
        }>;
      };
      assets?: Array<{
        id: number;
        title?: { text: string };
        data?: { value: string };
      }>;
    };

    // Handle both { native: { assets: [...] } } and { assets: [...] } formats
    const assets = native.native?.assets ?? native.assets;
    if (!assets || !Array.isArray(assets)) {
      return undefined;
    }

    let title = "";
    let description = "";
    let cta = "";

    for (const asset of assets) {
      switch (asset.id) {
        case 1:
          title = asset.title?.text ?? "";
          break;
        case 2:
          description = asset.data?.value ?? "";
          break;
        case 3:
          cta = asset.data?.value ?? "";
          break;
      }
    }

    if (!title && !description) {
      return undefined;
    }

    return { title, description, cta: cta || "Learn More" };
  } catch {
    return undefined;
  }
}

/**
 * Send a bid request to the Epom SSP endpoint and parse the response.
 *
 * @param bidRequest - OpenRTB 2.6 bid request
 * @param endpoint - Epom SSP endpoint URL
 * @returns Parsed bid result with native ad assets if bid was won
 */
export async function sendBidRequest(
  bidRequest: OpenRtbBidRequest,
  endpoint: string,
): Promise<BidResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), bidRequest.tmax + 50);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-openrtb-version": "2.6",
      },
      body: JSON.stringify(bidRequest),
      signal: controller.signal,
    });

    // HTTP 204 = no bid
    if (response.status === 204) {
      return { won: false };
    }

    if (!response.ok) {
      return { won: false };
    }

    const data = (await response.json()) as SeatBidResponse;
    const bid = data.seatbid?.[0]?.bid?.[0];

    if (!bid || !bid.adm) {
      return { won: false };
    }

    const asset = parseNativeAdm(bid.adm);
    if (!asset) {
      return { won: false };
    }

    // Fire win notice (non-blocking)
    if (bid.nurl) {
      fetch(bid.nurl, { method: "GET" }).catch(() => {});
    }

    return {
      won: true,
      asset,
      price: bid.price,
      bidId: bid.id,
      nurl: bid.nurl,
    };
  } catch {
    return { won: false };
  } finally {
    clearTimeout(timeout);
  }
}
