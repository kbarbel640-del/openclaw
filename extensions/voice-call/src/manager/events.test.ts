import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CallManagerContext } from "./context.js";
import { processEvent } from "./events.js";
import type { HangupCallInput, NormalizedEvent } from "../types.js";
import { VoiceCallConfigSchema } from "../config.js";

function createContext(overrides: Partial<CallManagerContext> = {}): CallManagerContext {
  return {
    activeCalls: new Map(),
    providerCallIdMap: new Map(),
    processedEventIds: new Set(),
    rejectedProviderCallIds: new Set(),
    provider: null,
    config: VoiceCallConfigSchema.parse({
      enabled: true,
      provider: "plivo",
      fromNumber: "+15550000000",
    }),
    storePath: path.join(os.tmpdir(), `openclaw-voice-call-events-test-${Date.now()}`),
    webhookUrl: null,
    transcriptWaiters: new Map(),
    maxDurationTimers: new Map(),
    ...overrides,
  };
}

describe("processEvent (functional)", () => {
  it("calls provider hangup when rejecting inbound call", () => {
    const hangupCalls: HangupCallInput[] = [];
    const provider = {
      name: "plivo" as const,
      async hangupCall(input: HangupCallInput): Promise<void> {
        hangupCalls.push(input);
      },
    };

    const ctx = createContext({
      config: VoiceCallConfigSchema.parse({
        enabled: true,
        provider: "plivo",
        fromNumber: "+15550000000",
        inboundPolicy: "disabled",
      }),
      provider,
    });
    const event: NormalizedEvent = {
      id: "evt-1",
      type: "call.initiated",
      callId: "prov-1",
      providerCallId: "prov-1",
      timestamp: Date.now(),
      direction: "inbound",
      from: "+15559999999",
      to: "+15550000000",
    };

    processEvent(ctx, event);

    expect(ctx.activeCalls.size).toBe(0);
    expect(hangupCalls).toHaveLength(1);
    expect(hangupCalls[0]).toEqual({
      callId: "prov-1",
      providerCallId: "prov-1",
      reason: "hangup-bot",
    });
  });

  it("does not call hangup when provider is null", () => {
    const ctx = createContext({
      config: VoiceCallConfigSchema.parse({
        enabled: true,
        provider: "plivo",
        fromNumber: "+15550000000",
        inboundPolicy: "disabled",
      }),
      provider: null,
    });
    const event: NormalizedEvent = {
      id: "evt-2",
      type: "call.initiated",
      callId: "prov-2",
      providerCallId: "prov-2",
      timestamp: Date.now(),
      direction: "inbound",
      from: "+15551111111",
      to: "+15550000000",
    };

    processEvent(ctx, event);

    expect(ctx.activeCalls.size).toBe(0);
  });

  it("calls hangup only once for duplicate events for same rejected call", () => {
    const hangupCalls: HangupCallInput[] = [];
    const provider = {
      name: "plivo" as const,
      async hangupCall(input: HangupCallInput): Promise<void> {
        hangupCalls.push(input);
      },
    };
    const ctx = createContext({
      config: VoiceCallConfigSchema.parse({
        enabled: true,
        provider: "plivo",
        fromNumber: "+15550000000",
        inboundPolicy: "disabled",
      }),
      provider,
    });
    const event1: NormalizedEvent = {
      id: "evt-init",
      type: "call.initiated",
      callId: "prov-dup",
      providerCallId: "prov-dup",
      timestamp: Date.now(),
      direction: "inbound",
      from: "+15552222222",
      to: "+15550000000",
    };
    const event2: NormalizedEvent = {
      id: "evt-ring",
      type: "call.ringing",
      callId: "prov-dup",
      providerCallId: "prov-dup",
      timestamp: Date.now(),
      direction: "inbound",
      from: "+15552222222",
      to: "+15550000000",
    };

    processEvent(ctx, event1);
    processEvent(ctx, event2);

    expect(ctx.activeCalls.size).toBe(0);
    expect(hangupCalls).toHaveLength(1);
    expect(hangupCalls[0]?.providerCallId).toBe("prov-dup");
  });

  it("when hangup throws, logs and does not throw", () => {
    const provider = {
      name: "plivo" as const,
      async hangupCall(): Promise<void> {
        throw new Error("provider down");
      },
    };
    const ctx = createContext({
      config: VoiceCallConfigSchema.parse({
        enabled: true,
        provider: "plivo",
        fromNumber: "+15550000000",
        inboundPolicy: "disabled",
      }),
      provider,
    });
    const event: NormalizedEvent = {
      id: "evt-fail",
      type: "call.initiated",
      callId: "prov-fail",
      providerCallId: "prov-fail",
      timestamp: Date.now(),
      direction: "inbound",
      from: "+15553333333",
      to: "+15550000000",
    };

    expect(() => processEvent(ctx, event)).not.toThrow();
    expect(ctx.activeCalls.size).toBe(0);
  });
});
