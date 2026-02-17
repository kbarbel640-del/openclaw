import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { VoiceCallProvider } from "./providers/base.js";
import type {
  HangupCallInput,
  InitiateCallInput,
  InitiateCallResult,
  NormalizedEvent,
  PlayTtsInput,
  ProviderWebhookParseResult,
  StartListeningInput,
  StopListeningInput,
  WebhookContext,
  WebhookVerificationResult,
} from "./types.js";
import { VoiceCallConfigSchema } from "./config.js";
import { CallManager } from "./manager.js";
import { loadActiveCallsFromStore } from "./manager/store.js";
import { VoiceCallWebhookServer } from "./webhook.js";

function createRequest(body: string): http.IncomingMessage {
  const req = new PassThrough() as PassThrough & {
    headers: http.IncomingHttpHeaders;
    method: string;
    url: string;
    socket: { remoteAddress?: string };
  };
  req.headers = { host: "127.0.0.1" };
  req.method = "POST";
  req.url = "/voice/webhook";
  req.socket = { remoteAddress: "127.0.0.1" };
  req.end(body);
  return req as unknown as http.IncomingMessage;
}

function createResponse(): http.ServerResponse {
  return {
    statusCode: 200,
    setHeader: () => undefined,
    end: () => undefined,
  } as unknown as http.ServerResponse;
}

class ThrowingManager {
  readonly processEvent = vi.fn((_event: NormalizedEvent) => {
    throw new Error("persist failed");
  });

  getCallByProviderCallId(): undefined {
    return undefined;
  }

  getCall(): undefined {
    return undefined;
  }

  getActiveCalls(): [] {
    return [];
  }

  async endCall(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async speak(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async speakInitialMessage(): Promise<void> {}
}

class EventProvider implements VoiceCallProvider {
  readonly name = "plivo" as const;

  verifyWebhook(_ctx: WebhookContext): WebhookVerificationResult {
    return { ok: true };
  }

  parseWebhookEvent(_ctx: WebhookContext): ProviderWebhookParseResult {
    return {
      events: [
        {
          id: "evt-1",
          type: "call.initiated",
          callId: "call-1",
          providerCallId: "provider-1",
          timestamp: Date.now(),
        },
      ],
      statusCode: 200,
    };
  }

  async initiateCall(_input: InitiateCallInput): Promise<InitiateCallResult> {
    return { providerCallId: "provider-1", status: "initiated" };
  }

  async hangupCall(_input: HangupCallInput): Promise<void> {}

  async playTts(_input: PlayTtsInput): Promise<void> {}

  async startListening(_input: StartListeningInput): Promise<void> {}

  async stopListening(_input: StopListeningInput): Promise<void> {}
}

class JsonEventProvider implements VoiceCallProvider {
  readonly name = "plivo" as const;

  verifyWebhook(_ctx: WebhookContext): WebhookVerificationResult {
    return { ok: true };
  }

  parseWebhookEvent(ctx: WebhookContext): ProviderWebhookParseResult {
    return {
      events: [JSON.parse(ctx.rawBody) as NormalizedEvent],
      statusCode: 200,
    };
  }

  async initiateCall(_input: InitiateCallInput): Promise<InitiateCallResult> {
    return { providerCallId: "provider-1", status: "initiated" };
  }

  async hangupCall(_input: HangupCallInput): Promise<void> {}

  async playTts(_input: PlayTtsInput): Promise<void> {}

  async startListening(_input: StartListeningInput): Promise<void> {}

  async stopListening(_input: StopListeningInput): Promise<void> {}
}

describe("VoiceCallWebhookServer", () => {
  it("does not swallow event-processing failures", async () => {
    const config = VoiceCallConfigSchema.parse({
      enabled: true,
      provider: "plivo",
      fromNumber: "+15550000000",
    });
    const manager = new ThrowingManager();
    const server = new VoiceCallWebhookServer(
      config,
      manager as unknown as CallManager,
      new EventProvider(),
    );

    const request = createRequest("{}");
    const response = createResponse();

    await expect(
      (
        server as unknown as {
          handleRequest: (
            req: http.IncomingMessage,
            res: http.ServerResponse,
            webhookPath: string,
          ) => Promise<void>;
        }
      ).handleRequest(request, response, "/voice/webhook"),
    ).rejects.toThrow("persist failed");
    expect(manager.processEvent).toHaveBeenCalledTimes(1);
  });

  it("processes retried terminal events after transient persistence failure", async () => {
    const storePath = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-voice-call-webhook-retry-"));
    const config = VoiceCallConfigSchema.parse({
      enabled: true,
      provider: "plivo",
      fromNumber: "+15550000000",
      inboundPolicy: "open",
    });
    const provider = new JsonEventProvider();
    const manager = new CallManager(config, storePath);
    manager.initialize(provider, "https://example.com/voice/webhook");

    const server = new VoiceCallWebhookServer(config, manager, provider);
    const handleRequest = (
      req: http.IncomingMessage,
      res: http.ServerResponse,
      webhookPath: string,
    ): Promise<void> =>
      (
        server as unknown as {
          handleRequest: (
            request: http.IncomingMessage,
            response: http.ServerResponse,
            path: string,
          ) => Promise<void>;
        }
      ).handleRequest(req, res, webhookPath);

    const initiatedEvent: NormalizedEvent = {
      id: "evt-init",
      type: "call.initiated",
      callId: "provider-1",
      providerCallId: "provider-1",
      timestamp: Date.now(),
      direction: "inbound",
      from: "+15550000001",
      to: "+15550000000",
    };
    await handleRequest(createRequest(JSON.stringify(initiatedEvent)), createResponse(), "/voice/webhook");
    expect(manager.getActiveCalls()).toHaveLength(1);

    const endedEvent: NormalizedEvent = {
      id: "evt-ended",
      type: "call.ended",
      callId: "provider-1",
      providerCallId: "provider-1",
      timestamp: Date.now() + 1,
      reason: "hangup-user",
    };

    let shouldFailOnce = true;
    const originalAppendFileSync = fs.appendFileSync;
    const appendSpy = vi.spyOn(fs, "appendFileSync").mockImplementation(
      ((...args: unknown[]) => {
        const data = args[1];
        if (shouldFailOnce && typeof data === "string" && data.includes('"evt-ended"')) {
          shouldFailOnce = false;
          throw new Error("disk full");
        }
        return Reflect.apply(
          originalAppendFileSync,
          fs,
          args as Parameters<typeof fs.appendFileSync>,
        );
      }) as typeof fs.appendFileSync,
    );

    try {
      await expect(
        handleRequest(createRequest(JSON.stringify(endedEvent)), createResponse(), "/voice/webhook"),
      ).rejects.toThrow("disk full");
      expect(manager.getActiveCalls()).toHaveLength(1);

      await handleRequest(createRequest(JSON.stringify(endedEvent)), createResponse(), "/voice/webhook");
      expect(manager.getActiveCalls()).toHaveLength(0);

      const recovered = loadActiveCallsFromStore(storePath);
      expect(recovered.activeCalls.size).toBe(0);
    } finally {
      appendSpy.mockRestore();
    }
  });
});
