import { afterEach, describe, expect, test } from "vitest";
import {
  DEFAULT_MAX_PAYLOAD_BYTES,
  MAX_BUFFERED_BYTES_FACTOR,
  getMaxBufferedBytes,
  getMaxPayloadBytes,
  setMaxPayloadBytes,
} from "./server-constants.js";

describe("ws max payload config", () => {
  afterEach(() => {
    setMaxPayloadBytes(undefined);
  });

  test("defaults to DEFAULT_MAX_PAYLOAD_BYTES (50 MiB)", () => {
    expect(getMaxPayloadBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
    expect(DEFAULT_MAX_PAYLOAD_BYTES).toBe(50 * 1024 * 1024);
  });

  test("setMaxPayloadBytes overrides the value", () => {
    setMaxPayloadBytes(100 * 1024 * 1024);
    expect(getMaxPayloadBytes()).toBe(100 * 1024 * 1024);
  });

  test("setMaxPayloadBytes(undefined) resets to default", () => {
    setMaxPayloadBytes(8 * 1024 * 1024);
    expect(getMaxPayloadBytes()).toBe(8 * 1024 * 1024);
    setMaxPayloadBytes(undefined);
    expect(getMaxPayloadBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
  });

  test("ignores non-positive values and resets to default", () => {
    setMaxPayloadBytes(10_000);
    setMaxPayloadBytes(0);
    expect(getMaxPayloadBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
    setMaxPayloadBytes(-1);
    expect(getMaxPayloadBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
  });

  test("ignores non-finite values", () => {
    setMaxPayloadBytes(10_000);
    setMaxPayloadBytes(NaN);
    expect(getMaxPayloadBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
    setMaxPayloadBytes(Infinity);
    expect(getMaxPayloadBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
  });

  test("getMaxBufferedBytes is factor * maxPayload", () => {
    expect(getMaxBufferedBytes()).toBe(DEFAULT_MAX_PAYLOAD_BYTES * MAX_BUFFERED_BYTES_FACTOR);
    setMaxPayloadBytes(10 * 1024 * 1024);
    expect(getMaxBufferedBytes()).toBe(10 * 1024 * 1024 * MAX_BUFFERED_BYTES_FACTOR);
  });
});
