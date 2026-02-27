import { chromium } from "playwright-core";
import { describe, expect, it, vi } from "vitest";
import * as chromeModule from "./chrome.js";
import { closePlaywrightBrowserConnection, getPageForTargetId } from "./pw-session.js";

const connectOverCdpSpy = vi.spyOn(chromium, "connectOverCDP");
const getChromeWebSocketUrlSpy = vi.spyOn(chromeModule, "getChromeWebSocketUrl");

describe("pw-session getPageForTargetId", () => {
  it("falls back to the only page when CDP session attachment is blocked (extension relays)", async () => {
    connectOverCdpSpy.mockClear();
    getChromeWebSocketUrlSpy.mockClear();

    const pageOn = vi.fn();
    const contextOn = vi.fn();
    const browserOn = vi.fn();
    const browserClose = vi.fn(async () => {});

    const context = {
      pages: () => [],
      on: contextOn,
      newCDPSession: vi.fn(async () => {
        throw new Error("Not allowed");
      }),
    } as unknown as import("playwright-core").BrowserContext;

    const page = {
      on: pageOn,
      context: () => context,
    } as unknown as import("playwright-core").Page;

    // Fill pages() after page exists.
    (context as unknown as { pages: () => unknown[] }).pages = () => [page];

    const browser = {
      contexts: () => [context],
      on: browserOn,
      close: browserClose,
    } as unknown as import("playwright-core").Browser;

    connectOverCdpSpy.mockResolvedValue(browser);
    getChromeWebSocketUrlSpy.mockResolvedValue(null);

    const resolved = await getPageForTargetId({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: "NOT_A_TAB",
    });
    expect(resolved).toBe(page);

    await closePlaywrightBrowserConnection();
    expect(browserClose).toHaveBeenCalled();
  });

  it("drops stale Playwright connection when target-id lookup hangs", async () => {
    connectOverCdpSpy.mockClear();
    getChromeWebSocketUrlSpy.mockClear();
    vi.useFakeTimers();
    try {
      const pageOn = vi.fn();
      const contextOn = vi.fn();
      const browserOn = vi.fn();
      const browserOff = vi.fn();
      const browserClose = vi.fn(async () => {});

      const context = {
        pages: () => [],
        on: contextOn,
        newCDPSession: vi.fn(() => new Promise<never>(() => {})),
      } as unknown as import("playwright-core").BrowserContext;

      const page = {
        on: pageOn,
        context: () => context,
        url: () => "https://example.com/",
      } as unknown as import("playwright-core").Page;

      (context as unknown as { pages: () => unknown[] }).pages = () => [page];

      const browser = {
        contexts: () => [context],
        on: browserOn,
        off: browserOff,
        close: browserClose,
      } as unknown as import("playwright-core").Browser;

      connectOverCdpSpy.mockResolvedValue(browser);
      getChromeWebSocketUrlSpy.mockResolvedValue(null);

      const pending = getPageForTargetId({
        cdpUrl: "http://127.0.0.1:18792",
        targetId: "MISSING_TAB",
      });
      await vi.advanceTimersByTimeAsync(1300);
      await expect(pending).resolves.toBe(page);
      expect(browserClose).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      await closePlaywrightBrowserConnection();
    }
  });
});
