import {
  KeysUploadRequest,
  KeysQueryRequest,
  KeysClaimRequest,
  ToDeviceRequest,
  SignatureUploadRequest,
  RoomMessageRequest,
} from "@matrix-org/matrix-sdk-crypto-nodejs";
import { getMachine } from "./machine.js";
import { matrixFetch } from "../client/http.js";

/**
 * Simple token bucket rate limiter.
 * Prevents 429s after initial sync when OlmMachine generates many outgoing requests.
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(
    private maxTokens: number = 5,
    private refillRate: number = 1 // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((r) => setTimeout(r, waitMs));
      this.tokens = 0;
      this.lastRefill = Date.now();
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 1);

/**
 * Dispatch a single outgoing request from OlmMachine to the homeserver.
 *
 * Each request type has known properties from the FFI:
 * - KeysUploadRequest: { id, body, type } → POST /_matrix/client/v3/keys/upload
 * - KeysQueryRequest: { id, body, type } → POST /_matrix/client/v3/keys/query
 * - KeysClaimRequest: { id, body, type } → POST /_matrix/client/v3/keys/claim
 * - ToDeviceRequest: { id, eventType, txnId, body, type } → PUT /_matrix/client/v3/sendToDevice/{eventType}/{txnId}
 * - SignatureUploadRequest: { id, body, type } → POST /_matrix/client/v3/keys/signatures/upload
 * - RoomMessageRequest: { id, roomId, txnId, eventType, body, type } → PUT /_matrix/client/v3/rooms/{roomId}/send/{eventType}/{txnId}
 */
async function dispatchRequest(
  request: KeysUploadRequest | KeysQueryRequest | KeysClaimRequest | ToDeviceRequest | SignatureUploadRequest | RoomMessageRequest,
  log?: { info?: (msg: string) => void; warn?: (msg: string) => void; error?: (msg: string) => void }
): Promise<unknown> {
  if (request instanceof KeysUploadRequest) {
    return matrixFetch("POST", "/_matrix/client/v3/keys/upload", JSON.parse(request.body));
  }

  if (request instanceof KeysQueryRequest) {
    return matrixFetch("POST", "/_matrix/client/v3/keys/query", JSON.parse(request.body));
  }

  if (request instanceof KeysClaimRequest) {
    return matrixFetch("POST", "/_matrix/client/v3/keys/claim", JSON.parse(request.body));
  }

  if (request instanceof ToDeviceRequest) {
    const path = `/_matrix/client/v3/sendToDevice/${encodeURIComponent(request.eventType)}/${encodeURIComponent(request.txnId)}`;
    return matrixFetch("PUT", path, JSON.parse(request.body));
  }

  if (request instanceof SignatureUploadRequest) {
    return matrixFetch("POST", "/_matrix/client/v3/keys/signatures/upload", JSON.parse(request.body));
  }

  if (request instanceof RoomMessageRequest) {
    const path = `/_matrix/client/v3/rooms/${encodeURIComponent(request.roomId)}/send/${encodeURIComponent(request.eventType)}/${encodeURIComponent(request.txnId)}`;
    return matrixFetch("PUT", path, JSON.parse(request.body));
  }

  log?.warn?.(`[crypto] Unknown outgoing request type, skipping`);
  return null;
}

/**
 * Process all pending outgoing requests from the OlmMachine.
 *
 * After each sync cycle, OlmMachine may need to:
 * - Upload one-time keys (KeysUploadRequest)
 * - Query device keys (KeysQueryRequest)
 * - Claim one-time keys from other devices (KeysClaimRequest)
 * - Send to-device messages — key shares (ToDeviceRequest)
 * - Upload cross-signing signatures (SignatureUploadRequest)
 * - Send room messages (RoomMessageRequest)
 *
 * CRITICAL: Only call markRequestAsSent() AFTER the network call succeeds.
 * If marked prematurely, OlmMachine won't retry (e.g., OTKs assumed uploaded but weren't).
 */
export async function processOutgoingRequests(
  log?: { info?: (msg: string) => void; warn?: (msg: string) => void; error?: (msg: string) => void }
): Promise<void> {
  const machine = getMachine();
  const requests = await machine.outgoingRequests();

  for (const request of requests) {
    await rateLimiter.acquire();

    try {
      const response = await dispatchRequest(request, log);
      if (response === null) continue; // Unknown type, skipped

      // Only mark as sent AFTER successful network call
      await machine.markRequestAsSent(
        request.id,
        request.type,
        JSON.stringify(response)
      );
    } catch (err: any) {
      log?.error?.(
        `[crypto] Failed to process outgoing request (type=${request.type}): ${err.message}`
      );
      // Do NOT mark as sent — OlmMachine will retry next cycle
    }
  }
}
