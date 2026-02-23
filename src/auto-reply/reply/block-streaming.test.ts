import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import {
  resolveBlockStreamingChunking,
  resolveEffectiveBlockStreamingConfig,
} from "./block-streaming.js";

describe("resolveEffectiveBlockStreamingConfig", () => {
  it("applies ACP-style overrides while preserving chunk/coalescer bounds", () => {
    const cfg = {} as OpenClawConfig;
    const baseChunking = resolveBlockStreamingChunking(cfg, "discord");
    const resolved = resolveEffectiveBlockStreamingConfig({
      cfg,
      provider: "discord",
      maxChunkChars: 64,
      coalesceIdleMs: 25,
    });

    expect(baseChunking.maxChars).toBeGreaterThanOrEqual(64);
    expect(resolved.chunking.maxChars).toBe(64);
    expect(resolved.chunking.minChars).toBeLessThanOrEqual(resolved.chunking.maxChars);
    expect(resolved.coalescing.maxChars).toBeLessThanOrEqual(resolved.chunking.maxChars);
    expect(resolved.coalescing.minChars).toBeLessThanOrEqual(resolved.coalescing.maxChars);
    expect(resolved.coalescing.idleMs).toBe(25);
  });

  it("reuses caller-provided chunking for shared main/subagent/ACP config resolution", () => {
    const resolved = resolveEffectiveBlockStreamingConfig({
      cfg: undefined,
      chunking: {
        minChars: 10,
        maxChars: 20,
        breakPreference: "paragraph",
      },
      coalesceIdleMs: 0,
    });

    expect(resolved.chunking).toEqual({
      minChars: 10,
      maxChars: 20,
      breakPreference: "paragraph",
    });
    expect(resolved.coalescing.maxChars).toBe(20);
    expect(resolved.coalescing.idleMs).toBe(0);
  });
});
