import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type BackgroundUtilsModule = {
  buildRelayWsUrl: (port: number, gatewayToken: string) => Promise<string>;
  deriveRelayToken: (gatewayToken: string, port: number) => Promise<string>;
  isRetryableReconnectError: (err: unknown) => boolean;
  reconnectDelayMs: (
    attempt: number,
    opts?: { baseMs?: number; maxMs?: number; jitterMs?: number; random?: () => number },
  ) => number;
};

const require = createRequire(import.meta.url);
const BACKGROUND_UTILS_MODULE = "../../assets/chrome-extension/background-utils.js";

async function loadBackgroundUtils(): Promise<BackgroundUtilsModule> {
  try {
    return require(BACKGROUND_UTILS_MODULE) as BackgroundUtilsModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Unexpected token 'export'")) {
      throw error;
    }
    return (await import(BACKGROUND_UTILS_MODULE)) as BackgroundUtilsModule;
  }
}

const { buildRelayWsUrl, deriveRelayToken, isRetryableReconnectError, reconnectDelayMs } =
  await loadBackgroundUtils();

function expectedDerivedToken(gatewayToken: string, port: number): string {
  return createHmac("sha256", gatewayToken)
    .update(`openclaw-extension-relay-v1:${port}`)
    .digest("hex");
}

describe("chrome extension background utils", () => {
  it("builds websocket url with derived relay token", async () => {
    const url = await buildRelayWsUrl(18792, "abc/+= token");
    const expected = expectedDerivedToken("abc/+= token", 18792);
    expect(url).toBe(`ws://127.0.0.1:18792/extension?token=${expected}`);
  });

  it("throws when gateway token is missing", async () => {
    await expect(buildRelayWsUrl(18792, "")).rejects.toThrow(/Missing gatewayToken/);
    await expect(buildRelayWsUrl(18792, "   ")).rejects.toThrow(/Missing gatewayToken/);
  });

  it("derives relay token matching server-side HMAC", async () => {
    const derived = await deriveRelayToken("my-secret", 18792);
    const expected = expectedDerivedToken("my-secret", 18792);
    expect(derived).toBe(expected);
  });

  it("uses exponential backoff from attempt index", () => {
    expect(reconnectDelayMs(0, { baseMs: 1000, maxMs: 30000, jitterMs: 0, random: () => 0 })).toBe(
      1000,
    );
    expect(reconnectDelayMs(1, { baseMs: 1000, maxMs: 30000, jitterMs: 0, random: () => 0 })).toBe(
      2000,
    );
    expect(reconnectDelayMs(4, { baseMs: 1000, maxMs: 30000, jitterMs: 0, random: () => 0 })).toBe(
      16000,
    );
  });

  it("caps reconnect delay at max", () => {
    const delay = reconnectDelayMs(20, {
      baseMs: 1000,
      maxMs: 30000,
      jitterMs: 0,
      random: () => 0,
    });
    expect(delay).toBe(30000);
  });

  it("adds jitter using injected random source", () => {
    const delay = reconnectDelayMs(3, {
      baseMs: 1000,
      maxMs: 30000,
      jitterMs: 1000,
      random: () => 0.25,
    });
    expect(delay).toBe(8250);
  });

  it("sanitizes invalid attempts and options", () => {
    expect(reconnectDelayMs(-2, { baseMs: 1000, maxMs: 30000, jitterMs: 0, random: () => 0 })).toBe(
      1000,
    );
    expect(
      reconnectDelayMs(Number.NaN, {
        baseMs: Number.NaN,
        maxMs: Number.NaN,
        jitterMs: Number.NaN,
        random: () => 0,
      }),
    ).toBe(1000);
  });

  it("marks missing token errors as non-retryable", () => {
    expect(
      isRetryableReconnectError(
        new Error("Missing gatewayToken in extension settings (chrome.storage.local.gatewayToken)"),
      ),
    ).toBe(false);
  });

  it("keeps transient network errors retryable", () => {
    expect(isRetryableReconnectError(new Error("WebSocket connect timeout"))).toBe(true);
    expect(isRetryableReconnectError(new Error("Relay server not reachable"))).toBe(true);
  });
});
