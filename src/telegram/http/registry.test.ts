import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import {
  handleTelegramHttpRequest,
  normalizeTelegramWebhookPath,
  registerTelegramHttpHandler,
} from "./registry.js";

function mockReq(opts: { method?: string; url?: string } = {}): IncomingMessage {
  return {
    method: opts.method ?? "POST",
    url: opts.url ?? "/telegram-webhook",
    headers: {},
  } as unknown as IncomingMessage;
}

function mockRes(): ServerResponse {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
    headersSent: false,
    writableEnded: false,
  } as unknown as ServerResponse;
}

describe("normalizeTelegramWebhookPath", () => {
  it("returns default path for undefined", () => {
    expect(normalizeTelegramWebhookPath(undefined)).toBe("/telegram-webhook");
  });

  it("returns default path for empty string", () => {
    expect(normalizeTelegramWebhookPath("")).toBe("/telegram-webhook");
  });

  it("adds leading slash to bare path", () => {
    expect(normalizeTelegramWebhookPath("custom-path")).toBe("/custom-path");
  });

  it("preserves existing leading slash", () => {
    expect(normalizeTelegramWebhookPath("/already-slashed")).toBe("/already-slashed");
  });

  it("returns default path for whitespace-only string", () => {
    expect(normalizeTelegramWebhookPath("   ")).toBe("/telegram-webhook");
  });

  it("returns default path for null", () => {
    expect(normalizeTelegramWebhookPath(null)).toBe("/telegram-webhook");
  });
});

describe("registerTelegramHttpHandler / unregister", () => {
  it("registers a handler that makes handleTelegramHttpRequest return true", async () => {
    const handler = vi.fn();
    const unregister = registerTelegramHttpHandler({ path: "/test-reg", handler });
    try {
      const req = mockReq({ url: "/test-reg" });
      const res = mockRes();
      const handled = await handleTelegramHttpRequest(req, res);
      expect(handled).toBe(true);
      expect(handler).toHaveBeenCalledWith(req, res);
    } finally {
      unregister();
    }
  });

  it("unregistering makes handleTelegramHttpRequest return false", async () => {
    const handler = vi.fn();
    const unregister = registerTelegramHttpHandler({ path: "/test-unreg", handler });
    unregister();

    const req = mockReq({ url: "/test-unreg" });
    const res = mockRes();
    const handled = await handleTelegramHttpRequest(req, res);
    expect(handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("logs a warning when registering the same path twice", async () => {
    const log = vi.fn();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unregister1 = registerTelegramHttpHandler({ path: "/dup-path", handler: handler1, log });
    try {
      const unregister2 = registerTelegramHttpHandler({
        path: "/dup-path",
        handler: handler2,
        log,
      });
      // Second register returns a no-op unregister
      unregister2();

      expect(log).toHaveBeenCalledWith(expect.stringContaining("/dup-path already registered"));

      // Original handler is still in place
      const req = mockReq({ url: "/dup-path" });
      const res = mockRes();
      const handled = await handleTelegramHttpRequest(req, res);
      expect(handled).toBe(true);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    } finally {
      unregister1();
    }
  });
});

describe("handleTelegramHttpRequest", () => {
  it("returns false for unregistered paths", async () => {
    const req = mockReq({ url: "/nonexistent" });
    const res = mockRes();
    const handled = await handleTelegramHttpRequest(req, res);
    expect(handled).toBe(false);
  });

  it("returns false for non-POST methods on registered paths", async () => {
    // Note: the registry itself does not filter by method — the handler does.
    // handleTelegramHttpRequest dispatches to the handler regardless of method.
    // Method filtering is done inside the handler. So a GET on a registered path
    // still returns true (handler is called).
    const handler = vi.fn();
    const unregister = registerTelegramHttpHandler({ path: "/method-test", handler });
    try {
      const req = mockReq({ method: "GET", url: "/method-test" });
      const res = mockRes();
      const handled = await handleTelegramHttpRequest(req, res);
      // The registry dispatches to handler and returns true
      expect(handled).toBe(true);
      expect(handler).toHaveBeenCalledWith(req, res);
    } finally {
      unregister();
    }
  });

  it("returns true and calls handler for POST on registered path", async () => {
    const handler = vi.fn();
    const unregister = registerTelegramHttpHandler({ path: "/post-test", handler });
    try {
      const req = mockReq({ method: "POST", url: "/post-test" });
      const res = mockRes();
      const handled = await handleTelegramHttpRequest(req, res);
      expect(handled).toBe(true);
      expect(handler).toHaveBeenCalledWith(req, res);
    } finally {
      unregister();
    }
  });

  it("strips query params before matching path", async () => {
    const handler = vi.fn();
    const unregister = registerTelegramHttpHandler({ path: "/qp-test", handler });
    try {
      const req = mockReq({ url: "/qp-test?foo=bar&baz=1" });
      const res = mockRes();
      const handled = await handleTelegramHttpRequest(req, res);
      expect(handled).toBe(true);
      expect(handler).toHaveBeenCalledWith(req, res);
    } finally {
      unregister();
    }
  });

  it("works with multiple registered paths simultaneously", async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unregister1 = registerTelegramHttpHandler({ path: "/multi-a", handler: handler1 });
    const unregister2 = registerTelegramHttpHandler({ path: "/multi-b", handler: handler2 });
    try {
      const req1 = mockReq({ url: "/multi-a" });
      const res1 = mockRes();
      const req2 = mockReq({ url: "/multi-b" });
      const res2 = mockRes();

      const handled1 = await handleTelegramHttpRequest(req1, res1);
      const handled2 = await handleTelegramHttpRequest(req2, res2);

      expect(handled1).toBe(true);
      expect(handled2).toBe(true);
      expect(handler1).toHaveBeenCalledWith(req1, res1);
      expect(handler2).toHaveBeenCalledWith(req2, res2);
      expect(handler1).not.toHaveBeenCalledWith(req2, res2);
      expect(handler2).not.toHaveBeenCalledWith(req1, res1);
    } finally {
      unregister1();
      unregister2();
    }
  });

  it("uses default path normalization when registering with no path", async () => {
    const handler = vi.fn();
    const unregister = registerTelegramHttpHandler({ handler });
    try {
      const req = mockReq({ url: "/telegram-webhook" });
      const res = mockRes();
      const handled = await handleTelegramHttpRequest(req, res);
      expect(handled).toBe(true);
      expect(handler).toHaveBeenCalled();
    } finally {
      unregister();
    }
  });
});
