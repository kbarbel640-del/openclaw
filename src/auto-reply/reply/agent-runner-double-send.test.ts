/**
 * Tests for double-send prevention in the agent runner pipeline.
 *
 * When block streaming is enabled, responses should NOT be sent both as:
 * 1. Block replies (incremental streaming during the run)
 * 2. Final payloads (after the run completes)
 *
 * This test verifies the deduplication logic works correctly.
 */
import { describe, expect, it } from "vitest";
import { buildReplyPayloads } from "./agent-runner-payloads.js";
import { createPayloadKey } from "./payload-normalization.js";
import type { ReplyPayload } from "../types.js";

describe("agent-runner double-send prevention", () => {
  describe("directlySentBlockKeys deduplication", () => {
    it("should filter out final payloads that were already sent via direct block reply", () => {
      // Simulate CCSDK flow: block reply was sent directly (no pipeline)
      const sentText = "Hello, this is the response!";
      const directlySentBlockKeys = new Set<string>();

      // This is what happens in agent-runner-execution.ts when onBlockReply is called
      const blockPayload: ReplyPayload = { text: sentText };
      directlySentBlockKeys.add(createPayloadKey(blockPayload));

      // Now the same text comes back as a final payload
      const finalPayloads: ReplyPayload[] = [{ text: sentText }];

      const result = buildReplyPayloads({
        payloads: finalPayloads,
        isHeartbeat: false,
        didLogHeartbeatStrip: false,
        blockStreamingEnabled: false, // Direct callback mode, not pipeline
        blockReplyPipeline: null,
        directlySentBlockKeys,
        replyToMode: "first",
        currentMessageId: "msg-123",
      });

      // The final payload should be filtered out since it was already sent
      expect(result.replyPayloads).toHaveLength(0);
    });

    it("should NOT filter out final payloads with different text", () => {
      const directlySentBlockKeys = new Set<string>();

      // Block reply was sent with partial text
      const blockPayload: ReplyPayload = { text: "Hello" };
      directlySentBlockKeys.add(createPayloadKey(blockPayload));

      // Final payload has more text
      const finalPayloads: ReplyPayload[] = [{ text: "Hello, world!" }];

      const result = buildReplyPayloads({
        payloads: finalPayloads,
        isHeartbeat: false,
        didLogHeartbeatStrip: false,
        blockStreamingEnabled: false,
        blockReplyPipeline: null,
        directlySentBlockKeys,
        replyToMode: "first",
        currentMessageId: "msg-123",
      });

      // The final payload should NOT be filtered since text differs
      expect(result.replyPayloads).toHaveLength(1);
      expect(result.replyPayloads[0]?.text).toBe("Hello, world!");
    });

    it("should handle CCSDK cumulative streaming pattern", () => {
      // CCSDK calls onBlockReply with cumulative text each time:
      // Call 1: "Hello"
      // Call 2: "Hello, how"
      // Call 3: "Hello, how are you?"
      // Final result: "Hello, how are you?"
      const directlySentBlockKeys = new Set<string>();

      // Each cumulative block reply is tracked
      directlySentBlockKeys.add(createPayloadKey({ text: "Hello" }));
      directlySentBlockKeys.add(createPayloadKey({ text: "Hello, how" }));
      directlySentBlockKeys.add(createPayloadKey({ text: "Hello, how are you?" }));

      // Final payload matches the last cumulative text
      const finalPayloads: ReplyPayload[] = [{ text: "Hello, how are you?" }];

      const result = buildReplyPayloads({
        payloads: finalPayloads,
        isHeartbeat: false,
        didLogHeartbeatStrip: false,
        blockStreamingEnabled: false,
        blockReplyPipeline: null,
        directlySentBlockKeys,
        replyToMode: "first",
        currentMessageId: "msg-123",
      });

      // Final should be filtered since it matches the last cumulative block
      expect(result.replyPayloads).toHaveLength(0);
    });
  });

  describe("whitespace normalization", () => {
    it("should match payloads with trailing whitespace differences", () => {
      const directlySentBlockKeys = new Set<string>();

      // Block reply has trailing whitespace
      directlySentBlockKeys.add(createPayloadKey({ text: "Hello  \n" }));

      // Final payload has no trailing whitespace
      const finalPayloads: ReplyPayload[] = [{ text: "Hello" }];

      const result = buildReplyPayloads({
        payloads: finalPayloads,
        isHeartbeat: false,
        didLogHeartbeatStrip: false,
        blockStreamingEnabled: false,
        blockReplyPipeline: null,
        directlySentBlockKeys,
        replyToMode: "first",
        currentMessageId: "msg-123",
      });

      // Should be filtered since trimmed text matches
      expect(result.replyPayloads).toHaveLength(0);
    });
  });

  describe("payload key creation", () => {
    it("should create identical keys for identical payloads", () => {
      const payload1: ReplyPayload = { text: "Hello" };
      const payload2: ReplyPayload = { text: "Hello" };

      expect(createPayloadKey(payload1)).toBe(createPayloadKey(payload2));
    });

    it("should create different keys for different text", () => {
      const payload1: ReplyPayload = { text: "Hello" };
      const payload2: ReplyPayload = { text: "Goodbye" };

      expect(createPayloadKey(payload1)).not.toBe(createPayloadKey(payload2));
    });

    it("should normalize whitespace in key creation", () => {
      const payload1: ReplyPayload = { text: "Hello  \n\t" };
      const payload2: ReplyPayload = { text: "Hello" };

      // Keys should match after trimming
      expect(createPayloadKey(payload1)).toBe(createPayloadKey(payload2));
    });
  });
});
