import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CallRecord } from "../types.js";
import { persistCallRecord } from "./store.js";

function createCallRecord(): CallRecord {
  return {
    callId: "call-1",
    providerCallId: "provider-1",
    provider: "plivo",
    direction: "outbound",
    state: "initiated",
    from: "+15550000000",
    to: "+15550000001",
    startedAt: Date.now(),
    transcript: [],
    processedEventIds: [],
    metadata: {},
  };
}

describe("persistCallRecord", () => {
  it("appends a call record to calls.jsonl", () => {
    const storePath = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-voice-call-store-test-"));
    const logPath = path.join(storePath, "calls.jsonl");

    persistCallRecord(storePath, createCallRecord());

    const content = fs.readFileSync(logPath, "utf-8");
    expect(content).toContain('"callId":"call-1"');
  });

  it("throws when persistence fails", () => {
    const storePath = path.join(
      os.tmpdir(),
      `openclaw-voice-call-store-missing-${Date.now()}`,
      "missing",
    );

    expect(() => persistCallRecord(storePath, createCallRecord())).toThrow(/ENOENT/i);
  });
});
