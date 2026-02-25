import { afterEach, beforeAll, beforeEach, expect, vi, type MockInstance } from "vitest";
import * as ssrf from "../infra/net/ssrf.js";
import { onSpy, sendChatActionSpy } from "./bot.media.e2e-harness.js";

// Explicitly type these spies to avoid TS2742 (inferred type references @vitest/spy internals).
export const cacheStickerSpy: MockInstance = vi.fn();
export const getCachedStickerSpy: MockInstance = vi.fn();
export const describeStickerImageSpy: MockInstance = vi.fn();

const lookupMock = vi.fn();
let resolvePinnedHostnameSpy: ReturnType<typeof vi.spyOn> = null;

export const TELEGRAM_TEST_TIMINGS = {
  mediaGroupFlushMs: 20,
  textFragmentGapMs: 30,
} as const;

const TELEGRAM_BOT_IMPORT_TIMEOUT_MS = process.platform === "win32" ? 180_000 : 150_000;

let createTelegramBotRef: typeof import("./bot.js").createTelegramBot;
let replySpyRef: ReturnType<typeof vi.fn>;

export async function createBotHandler(): Promise<{
  handler: (ctx: Record<string, unknown>) => Promise<void>;
  replySpy: ReturnType<typeof vi.fn>;
  runtimeError: ReturnType<typeof vi.fn>;
}> {
  return createBotHandlerWithOptions({});
}

export async function createBotHandlerWithOptions(options: {
  proxyFetch?: typeof fetch;
  runtimeLog?: ReturnType<typeof vi.fn>;
  runtimeError?: ReturnType<typeof vi.fn>;
}): Promise<{
  handler: (ctx: Record<string, unknown>) => Promise<void>;
  replySpy: ReturnType<typeof vi.fn>;
  runtimeError: ReturnType<typeof vi.fn>;
}> {
  onSpy.mockClear();
  replySpyRef.mockClear();
  sendChatActionSpy.mockClear();

  const runtimeError = options.runtimeError ?? vi.fn();
  const runtimeLog = options.runtimeLog ?? vi.fn();
  createTelegramBotRef({
    token: "tok",
    testTimings: TELEGRAM_TEST_TIMINGS,
    ...(options.proxyFetch ? { proxyFetch: options.proxyFetch } : {}),
    runtime: {
      log: runtimeLog as (...data: unknown[]) => void,
      error: runtimeError as (...data: unknown[]) => void,
      exit: () => {
        throw new Error("exit");
      },
    },
  });
  const handler = onSpy.mock.calls.find((call) => call[0] === "message")?.[1] as (
    ctx: Record<string, unknown>,
  ) => Promise<void>;
  expect(handler).toBeDefined();
  return { handler, replySpy: replySpyRef, runtimeError };
}

export function mockTelegramFileDownload(params: {
  contentType: string;
  bytes: Uint8Array;
}): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => params.contentType },
    arrayBuffer: async () => params.bytes.buffer,
  } as unknown as Response);
}

export function mockTelegramPngDownload(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => "image/png" },
    arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
  } as unknown as Response);
}

export function mockTelegramJpegDownload(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => "image/jpeg" },
    arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer,
  } as unknown as Response);
}

export function mockTelegramStickerPngDownload(): ReturnType<typeof vi.spyOn> {
  return mockTelegramPngDownload();
}

export function mockTelegramStickerWebpDownload(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => "image/webp" },
    arrayBuffer: async () => new Uint8Array([82, 73, 70, 70]).buffer,
  } as unknown as Response);
}

export async function setupBotMediaTestHarness(): Promise<void> {
  // Ensure we import bot module once with a generous timeout.
  await vi.waitFor(
    async () => {
      const mod = await import("./bot.js");
      createTelegramBotRef = mod.createTelegramBot;
      return true;
    },
    { timeout: TELEGRAM_BOT_IMPORT_TIMEOUT_MS },
  );

  // ResolvePinnedHostname is referenced by bot internals; make it deterministic.
  resolvePinnedHostnameSpy = vi
    .spyOn(ssrf, "resolvePinnedHostname")
    .mockImplementation(async () => {
      return {
        hostname: "example.com",
        addresses: ["127.0.0.1"],
        family: 4,
        lookup: lookupMock,
      } as never;
    });

  replySpyRef = vi.fn(async () => {});
}

beforeAll(async () => {
  await setupBotMediaTestHarness();
});

beforeEach(() => {
  cacheStickerSpy.mockClear();
  getCachedStickerSpy.mockClear();
  describeStickerImageSpy.mockClear();
});

afterEach(() => {
  resolvePinnedHostnameSpy?.mockRestore();
});
