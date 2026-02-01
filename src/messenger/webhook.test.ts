import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { MessengerWebhookPayload } from "./types.js";
import {
  computeMessengerSignature,
  createMessengerWebhookHandler,
  parseQueryString,
  parseWebhookPayload,
  startMessengerWebhook,
  verifyMessengerSignature,
  verifyWebhookSubscription,
} from "./webhook.js";

describe("verifyMessengerSignature", () => {
  const appSecret = "test_app_secret";
  const body = '{"test":"data"}';

  it("verifies valid signature", () => {
    const signature = computeMessengerSignature(body, appSecret);
    expect(verifyMessengerSignature(body, signature, appSecret)).toBe(true);
  });

  it("rejects invalid signature", () => {
    const signature = "sha256=invalid";
    expect(verifyMessengerSignature(body, signature, appSecret)).toBe(false);
  });

  it("rejects signature without sha256 prefix", () => {
    const hash = computeMessengerSignature(body, appSecret).slice("sha256=".length);
    expect(verifyMessengerSignature(body, hash, appSecret)).toBe(false);
  });

  it("rejects signature with wrong secret", () => {
    const signature = computeMessengerSignature(body, "wrong_secret");
    expect(verifyMessengerSignature(body, signature, appSecret)).toBe(false);
  });

  it("handles Buffer body", () => {
    const bufferBody = Buffer.from(body);
    const signature = computeMessengerSignature(body, appSecret);
    expect(verifyMessengerSignature(bufferBody, signature, appSecret)).toBe(true);
  });

  it("rejects tampered body", () => {
    const signature = computeMessengerSignature(body, appSecret);
    expect(verifyMessengerSignature('{"test":"tampered"}', signature, appSecret)).toBe(false);
  });
});

describe("computeMessengerSignature", () => {
  it("computes sha256 HMAC signature", () => {
    const signature = computeMessengerSignature("test", "secret");
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("produces consistent results", () => {
    const sig1 = computeMessengerSignature("test", "secret");
    const sig2 = computeMessengerSignature("test", "secret");
    expect(sig1).toBe(sig2);
  });

  it("produces different results for different inputs", () => {
    const sig1 = computeMessengerSignature("test1", "secret");
    const sig2 = computeMessengerSignature("test2", "secret");
    expect(sig1).not.toBe(sig2);
  });
});

describe("verifyWebhookSubscription", () => {
  const verifyToken = "my_verify_token";

  it("accepts valid subscription request", () => {
    const query = {
      "hub.mode": "subscribe",
      "hub.verify_token": verifyToken,
      "hub.challenge": "challenge_string_123",
    };
    const result = verifyWebhookSubscription(query, verifyToken);
    expect(result).toEqual({ valid: true, challenge: "challenge_string_123" });
  });

  it("rejects invalid hub.mode", () => {
    const query = {
      "hub.mode": "unsubscribe",
      "hub.verify_token": verifyToken,
      "hub.challenge": "challenge",
    };
    const result = verifyWebhookSubscription(query, verifyToken);
    expect(result).toEqual({ valid: false, error: "Invalid hub.mode" });
  });

  it("rejects missing hub.verify_token", () => {
    const query = {
      "hub.mode": "subscribe",
      "hub.challenge": "challenge",
    };
    const result = verifyWebhookSubscription(query, verifyToken);
    expect(result).toEqual({ valid: false, error: "Missing hub.verify_token" });
  });

  it("rejects invalid hub.verify_token", () => {
    const query = {
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong_token",
      "hub.challenge": "challenge",
    };
    const result = verifyWebhookSubscription(query, verifyToken);
    expect(result).toEqual({ valid: false, error: "Invalid hub.verify_token" });
  });

  it("rejects missing hub.challenge", () => {
    const query = {
      "hub.mode": "subscribe",
      "hub.verify_token": verifyToken,
    };
    const result = verifyWebhookSubscription(query, verifyToken);
    expect(result).toEqual({ valid: false, error: "Missing hub.challenge" });
  });
});

describe("parseQueryString", () => {
  it("parses query string", () => {
    const result = parseQueryString("foo=bar&baz=qux");
    expect(result).toEqual({ foo: "bar", baz: "qux" });
  });

  it("handles empty string", () => {
    expect(parseQueryString("")).toEqual({});
  });

  it("handles URL-encoded values", () => {
    const result = parseQueryString("hub.mode=subscribe&hub.verify_token=my%20token");
    expect(result).toEqual({ "hub.mode": "subscribe", "hub.verify_token": "my token" });
  });
});

describe("parseWebhookPayload", () => {
  it("parses valid payload", () => {
    const payload: MessengerWebhookPayload = {
      object: "page",
      entry: [
        {
          id: "123",
          time: Date.now(),
          messaging: [
            {
              sender: { id: "456" },
              recipient: { id: "123" },
              timestamp: Date.now(),
              message: { mid: "msg1", text: "Hello" },
            },
          ],
        },
      ],
    };
    const result = parseWebhookPayload(JSON.stringify(payload));
    expect(result).toEqual(payload);
  });

  it("parses Buffer body", () => {
    const payload: MessengerWebhookPayload = {
      object: "page",
      entry: [],
    };
    const result = parseWebhookPayload(Buffer.from(JSON.stringify(payload)));
    expect(result).toEqual(payload);
  });

  it("rejects invalid JSON", () => {
    expect(parseWebhookPayload("not json")).toBe(null);
  });

  it("rejects non-object payload", () => {
    expect(parseWebhookPayload('"string"')).toBe(null);
  });

  it("rejects payload without object field", () => {
    expect(parseWebhookPayload('{"entry":[]}')).toBe(null);
  });

  it("rejects payload without entry field", () => {
    expect(parseWebhookPayload('{"object":"page"}')).toBe(null);
  });

  it("rejects payload with wrong object type", () => {
    expect(parseWebhookPayload('{"object":"user","entry":[]}')).toBe(null);
  });
});

describe("createMessengerWebhookHandler", () => {
  const appSecret = "test_secret";
  const verifyToken = "test_verify";

  function createMockRequest(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  }): IncomingMessage {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = options.method;
    req.url = options.url;
    req.headers = { host: "localhost", ...options.headers };

    if (options.body) {
      const readable = Readable.from([Buffer.from(options.body)]);
      Object.assign(req, {
        on: readable.on.bind(readable),
        once: readable.once.bind(readable),
        emit: readable.emit.bind(readable),
      });
    }

    return req;
  }

  function createMockResponse(): ServerResponse & {
    _statusCode: number;
    _headers: Record<string, string>;
    _body: string;
  } {
    const socket = new Socket();
    const res = new ServerResponse(new IncomingMessage(socket)) as ServerResponse & {
      _statusCode: number;
      _headers: Record<string, string>;
      _body: string;
    };

    res._statusCode = 200;
    res._headers = {};
    res._body = "";

    res.writeHead = vi.fn((statusCode: number, headers?: Record<string, string>) => {
      res._statusCode = statusCode;
      if (headers) {
        res._headers = { ...res._headers, ...headers };
      }
      return res;
    }) as typeof res.writeHead;

    res.end = vi.fn((data?: string) => {
      if (data) {
        res._body = data;
      }
      return res;
    }) as typeof res.end;

    return res;
  }

  it("handles GET verification request", async () => {
    const onEvents = vi.fn();
    const { handler } = createMessengerWebhookHandler({
      appSecret,
      verifyToken,
      onEvents,
    });

    const req = createMockRequest({
      method: "GET",
      url: `/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test_challenge`,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(res._body).toBe("test_challenge");
    expect(onEvents).not.toHaveBeenCalled();
  });

  it("rejects GET with invalid verify token", async () => {
    const onEvents = vi.fn();
    const { handler } = createMessengerWebhookHandler({
      appSecret,
      verifyToken,
      onEvents,
    });

    const req = createMockRequest({
      method: "GET",
      url: "/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=test",
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(403);
    expect(JSON.parse(res._body)).toEqual({ error: "Invalid hub.verify_token" });
  });

  it("handles POST with valid signature", async () => {
    const onEvents = vi.fn().mockResolvedValue(undefined);
    const { handler } = createMessengerWebhookHandler({
      appSecret,
      verifyToken,
      onEvents,
    });

    const payload: MessengerWebhookPayload = {
      object: "page",
      entry: [
        {
          id: "123",
          time: Date.now(),
          messaging: [
            {
              sender: { id: "456" },
              recipient: { id: "123" },
              timestamp: Date.now(),
              message: { mid: "msg1", text: "Hello" },
            },
          ],
        },
      ],
    };
    const body = JSON.stringify(payload);
    const signature = computeMessengerSignature(body, appSecret);

    const req = createMockRequest({
      method: "POST",
      url: "/webhook",
      headers: { "x-hub-signature-256": signature },
      body,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ status: "ok" });
    expect(onEvents).toHaveBeenCalledWith(payload);
  });

  it("rejects POST without signature header", async () => {
    const onEvents = vi.fn();
    const { handler } = createMessengerWebhookHandler({
      appSecret,
      verifyToken,
      onEvents,
    });

    const req = createMockRequest({
      method: "POST",
      url: "/webhook",
      body: '{"object":"page","entry":[]}',
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(401);
    expect(JSON.parse(res._body)).toEqual({ error: "Missing signature" });
    expect(onEvents).not.toHaveBeenCalled();
  });

  it("rejects POST with invalid signature", async () => {
    const onEvents = vi.fn();
    const { handler } = createMessengerWebhookHandler({
      appSecret,
      verifyToken,
      onEvents,
    });

    const req = createMockRequest({
      method: "POST",
      url: "/webhook",
      headers: { "x-hub-signature-256": "sha256=invalid" },
      body: '{"object":"page","entry":[]}',
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(401);
    expect(JSON.parse(res._body)).toEqual({ error: "Invalid signature" });
    expect(onEvents).not.toHaveBeenCalled();
  });

  it("rejects POST with invalid payload", async () => {
    const onEvents = vi.fn();
    const { handler } = createMessengerWebhookHandler({
      appSecret,
      verifyToken,
      onEvents,
    });

    const body = '{"object":"user","entry":[]}';
    const signature = computeMessengerSignature(body, appSecret);

    const req = createMockRequest({
      method: "POST",
      url: "/webhook",
      headers: { "x-hub-signature-256": signature },
      body,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(400);
    expect(JSON.parse(res._body)).toEqual({ error: "Invalid payload" });
    expect(onEvents).not.toHaveBeenCalled();
  });

  it("rejects unsupported HTTP methods", async () => {
    const onEvents = vi.fn();
    const { handler } = createMessengerWebhookHandler({
      appSecret,
      verifyToken,
      onEvents,
    });

    const req = createMockRequest({
      method: "DELETE",
      url: "/webhook",
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(405);
    expect(JSON.parse(res._body)).toEqual({ error: "Method not allowed" });
  });

  it("does not call onEvents for empty messaging array", async () => {
    const onEvents = vi.fn().mockResolvedValue(undefined);
    const { handler } = createMessengerWebhookHandler({
      appSecret,
      verifyToken,
      onEvents,
    });

    const payload: MessengerWebhookPayload = {
      object: "page",
      entry: [{ id: "123", time: Date.now(), messaging: [] }],
    };
    const body = JSON.stringify(payload);
    const signature = computeMessengerSignature(body, appSecret);

    const req = createMockRequest({
      method: "POST",
      url: "/webhook",
      headers: { "x-hub-signature-256": signature },
      body,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(onEvents).not.toHaveBeenCalled();
  });

  it("handles onEvents errors gracefully", async () => {
    const runtime = { error: vi.fn() };
    const onEvents = vi.fn().mockRejectedValue(new Error("Handler failed"));
    const { handler } = createMessengerWebhookHandler({
      appSecret,
      verifyToken,
      onEvents,
      runtime,
    });

    const payload: MessengerWebhookPayload = {
      object: "page",
      entry: [
        {
          id: "123",
          time: Date.now(),
          messaging: [
            {
              sender: { id: "456" },
              recipient: { id: "123" },
              timestamp: Date.now(),
              message: { mid: "msg1", text: "Hello" },
            },
          ],
        },
      ],
    };
    const body = JSON.stringify(payload);
    const signature = computeMessengerSignature(body, appSecret);

    const req = createMockRequest({
      method: "POST",
      url: "/webhook",
      headers: { "x-hub-signature-256": signature },
      body,
    });
    const res = createMockResponse();

    await handler(req, res);

    // Should still return 200 immediately
    expect(res._statusCode).toBe(200);

    // Wait for async error handling
    await new Promise((r) => setTimeout(r, 10));
    expect(runtime.error).toHaveBeenCalledWith(expect.stringContaining("Handler failed"));
  });
});

describe("startMessengerWebhook", () => {
  it("returns handler with default paths", () => {
    const result = startMessengerWebhook({
      appSecret: "secret",
      verifyToken: "token",
      onEvents: vi.fn(),
    });

    expect(result.path).toBe("/messenger/webhook");
    expect(result.healthPath).toBe("/healthz");
    expect(typeof result.handler).toBe("function");
  });

  it("accepts custom paths", () => {
    const result = startMessengerWebhook({
      appSecret: "secret",
      verifyToken: "token",
      onEvents: vi.fn(),
      path: "/custom/webhook",
      healthPath: "/custom/health",
    });

    expect(result.path).toBe("/custom/webhook");
    expect(result.healthPath).toBe("/custom/health");
  });
});
