import { describe, expect, it } from "vitest";
import {
  FRAME_EXIT,
  FRAME_STDERR,
  FRAME_STDOUT,
  MAX_FRAME_SIZE,
  encodeExitFrame,
  encodeFrame,
  tryDecodeFrames,
} from "./protocol.js";

describe("cliport protocol", () => {
  it("encodes and decodes framed stdout/stderr payloads", () => {
    const a = encodeFrame(FRAME_STDOUT, "hello");
    const b = encodeFrame(FRAME_STDERR, Buffer.from("err"));
    const bundle = Buffer.concat([a, b]);

    const decoded = tryDecodeFrames(bundle);
    expect(decoded.rest.length).toBe(0);
    expect(decoded.frames).toHaveLength(2);
    expect(decoded.frames[0]?.kind).toBe(FRAME_STDOUT);
    expect(decoded.frames[0]?.payload.toString("utf-8")).toBe("hello");
    expect(decoded.frames[1]?.kind).toBe(FRAME_STDERR);
    expect(decoded.frames[1]?.payload.toString("utf-8")).toBe("err");
  });

  it("returns incomplete bytes as rest", () => {
    const frame = encodeFrame(FRAME_STDOUT, "abc");
    const half = frame.subarray(0, frame.length - 1);
    const decoded = tryDecodeFrames(half);
    expect(decoded.frames).toHaveLength(0);
    expect(decoded.rest.length).toBe(half.length);
  });

  it("encodes exit payload as json", () => {
    const exit = encodeExitFrame({
      code: 0,
      signal: null,
      timedOut: false,
      durationMs: 12,
    });
    const decoded = tryDecodeFrames(exit);
    expect(decoded.frames).toHaveLength(1);
    expect(decoded.frames[0]?.kind).toBe(FRAME_EXIT);
    const payload = JSON.parse(decoded.frames[0]?.payload.toString("utf-8") ?? "{}");
    expect(payload).toMatchObject({ code: 0, timedOut: false, durationMs: 12 });
  });
});

describe("cliport protocol frame size limits", () => {
  it("returns error when frame size exceeds MAX_FRAME_SIZE", () => {
    // Craft a raw buffer with a header that claims a size larger than MAX_FRAME_SIZE.
    // We don't need the actual payload bytes -- tryDecodeFrames checks the size field
    // in the header before attempting to read the payload.
    const header = Buffer.allocUnsafe(5);
    header.writeUInt8(FRAME_STDOUT, 0);
    header.writeUInt32BE(MAX_FRAME_SIZE + 1, 1);

    const decoded = tryDecodeFrames(header);
    expect(decoded.error).toBeDefined();
    expect(decoded.error).toContain("exceeds maximum");
    expect(decoded.frames).toHaveLength(0);
    expect(decoded.rest.length).toBe(5);
  });

  it("returns error for a size exactly at MAX_FRAME_SIZE + 1", () => {
    const header = Buffer.allocUnsafe(5);
    header.writeUInt8(FRAME_STDERR, 0);
    header.writeUInt32BE(MAX_FRAME_SIZE + 1, 1);

    const decoded = tryDecodeFrames(header);
    expect(decoded.error).toBeDefined();
    expect(decoded.error).toContain(`frame size ${MAX_FRAME_SIZE + 1}`);
  });

  it("preserves already-decoded frames before the oversized frame", () => {
    // A valid frame followed by an oversized frame header
    const validFrame = encodeFrame(FRAME_STDOUT, "ok");
    const badHeader = Buffer.allocUnsafe(5);
    badHeader.writeUInt8(FRAME_STDOUT, 0);
    badHeader.writeUInt32BE(MAX_FRAME_SIZE + 100, 1);

    const combined = Buffer.concat([validFrame, badHeader]);
    const decoded = tryDecodeFrames(combined);

    // The first valid frame should still be decoded
    expect(decoded.frames).toHaveLength(1);
    expect(decoded.frames[0]?.payload.toString("utf-8")).toBe("ok");
    // The error should be set for the oversized second frame
    expect(decoded.error).toBeDefined();
    expect(decoded.error).toContain("exceeds maximum");
    // The rest should contain the bad header bytes
    expect(decoded.rest.length).toBe(5);
  });

  it("decodes an empty payload (size 0) correctly", () => {
    const frame = encodeFrame(FRAME_STDOUT, Buffer.alloc(0));
    const decoded = tryDecodeFrames(frame);

    expect(decoded.error).toBeUndefined();
    expect(decoded.frames).toHaveLength(1);
    expect(decoded.frames[0]?.kind).toBe(FRAME_STDOUT);
    expect(decoded.frames[0]?.payload.length).toBe(0);
    expect(decoded.rest.length).toBe(0);
  });

  it("does not set error field on successful decode", () => {
    const frame = encodeFrame(FRAME_STDOUT, "data");
    const decoded = tryDecodeFrames(frame);

    expect(decoded.error).toBeUndefined();
    expect(decoded.frames).toHaveLength(1);
    expect(decoded.rest.length).toBe(0);
  });
});
