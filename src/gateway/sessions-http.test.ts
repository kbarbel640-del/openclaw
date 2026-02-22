import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ResolvedGatewayAuth } from "./auth.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("./http-auth-helpers.js", () => ({
  authorizeGatewayBearerRequestOrReply: vi.fn(),
}));

vi.mock("./http-endpoint-helpers.js", () => ({
  handleGatewayPostJsonEndpoint: vi.fn(),
}));

vi.mock("./server-methods/sessions.js", () => ({
  sessionsHandlers: {
    "sessions.reset": vi.fn(),
    "sessions.compact": vi.fn(),
    "sessions.list": vi.fn(),
  },
}));

const { authorizeGatewayBearerRequestOrReply } = await import("./http-auth-helpers.js");
const { handleGatewayPostJsonEndpoint } = await import("./http-endpoint-helpers.js");
const { sessionsHandlers } = await import("./server-methods/sessions.js");
const { handleSessionsHttpRequest } = await import("./sessions-http.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeReq(url: string, method = "POST", headers: Record<string, string> = {}): IncomingMessage {
  return { url, method, headers: { host: "localhost", ...headers } } as unknown as IncomingMessage;
}

function fakeRes(): ServerResponse & { _status?: number; _body?: unknown } {
  const res: Record<string, unknown> = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: vi.fn((data: string) => {
      try {
        res._body = JSON.parse(data);
      } catch {
        res._body = data;
      }
    }),
  };
  return res as unknown as ServerResponse & { _status?: number; _body?: unknown };
}

const AUTH = {} as unknown as ResolvedGatewayAuth;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleSessionsHttpRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Routing ──────────────────────────────────────────────────────────

  it("returns false for non-session paths", async () => {
    const result = await handleSessionsHttpRequest(
      fakeReq("/v1/chat/completions"),
      fakeRes(),
      { auth: AUTH },
    );
    expect(result).toBe(false);
  });

  it("returns 404 JSON for unknown /v1/sessions/* paths", async () => {
    const res = fakeRes();
    const result = await handleSessionsHttpRequest(
      fakeReq("/v1/sessions/unknown"),
      res,
      { auth: AUTH },
    );
    expect(result).toBe(true);
    expect(res.statusCode).toBe(404);
  });

  // ── POST /v1/sessions/reset ──────────────────────────────────────────

  describe("POST /v1/sessions/reset", () => {
    it("resets session with key from body", async () => {
      vi.mocked(handleGatewayPostJsonEndpoint).mockResolvedValue({
        body: { key: "agent:main:http-user:alice", reason: "new" },
      });

      vi.mocked(sessionsHandlers["sessions.reset"]).mockImplementation(
        ({ respond }: { respond: (ok: boolean, payload?: unknown) => void }) => {
          respond(true, { ok: true, key: "agent:main:http-user:alice", entry: {} });
        },
      );

      const res = fakeRes();
      const result = await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/reset"),
        res,
        { auth: AUTH },
      );

      expect(result).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res._body).toEqual({ ok: true, key: "agent:main:http-user:alice", entry: {} });
    });

    it("resets session with key from header", async () => {
      vi.mocked(handleGatewayPostJsonEndpoint).mockResolvedValue({
        body: {},
      });

      vi.mocked(sessionsHandlers["sessions.reset"]).mockImplementation(
        ({ respond }: { respond: (ok: boolean, payload?: unknown) => void }) => {
          respond(true, { ok: true, key: "my-key", entry: {} });
        },
      );

      const res = fakeRes();
      const result = await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/reset", "POST", { "x-openclaw-session-key": "my-key" }),
        res,
        { auth: AUTH },
      );

      expect(result).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it("returns 400 when key is missing", async () => {
      vi.mocked(handleGatewayPostJsonEndpoint).mockResolvedValue({
        body: {},
      });

      const res = fakeRes();
      const result = await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/reset"),
        res,
        { auth: AUTH },
      );

      expect(result).toBe(true);
      expect(res.statusCode).toBe(400);
    });

    it("returns true when auth fails (response already sent)", async () => {
      vi.mocked(handleGatewayPostJsonEndpoint).mockResolvedValue(undefined);

      const res = fakeRes();
      const result = await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/reset"),
        res,
        { auth: AUTH },
      );

      expect(result).toBe(true);
    });
  });

  // ── POST /v1/sessions/compact ────────────────────────────────────────

  describe("POST /v1/sessions/compact", () => {
    it("compacts session with key and maxLines from body", async () => {
      vi.mocked(handleGatewayPostJsonEndpoint).mockResolvedValue({
        body: { key: "my-session", maxLines: 200 },
      });

      vi.mocked(sessionsHandlers["sessions.compact"]).mockImplementation(
        ({ respond }: { respond: (ok: boolean, payload?: unknown) => void }) => {
          respond(true, { ok: true, key: "my-session", compacted: true, kept: 200 });
        },
      );

      const res = fakeRes();
      const result = await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/compact"),
        res,
        { auth: AUTH },
      );

      expect(result).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res._body).toEqual({ ok: true, key: "my-session", compacted: true, kept: 200 });
    });

    it("returns 400 when key is missing", async () => {
      vi.mocked(handleGatewayPostJsonEndpoint).mockResolvedValue({
        body: { maxLines: 100 },
      });

      const res = fakeRes();
      await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/compact"),
        res,
        { auth: AUTH },
      );

      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /v1/sessions/status ──────────────────────────────────────────

  describe("GET /v1/sessions/status", () => {
    it("returns session status with key from header", async () => {
      vi.mocked(authorizeGatewayBearerRequestOrReply).mockResolvedValue(true);

      vi.mocked(sessionsHandlers["sessions.list"]).mockImplementation(
        ({ respond }: { respond: (ok: boolean, payload?: unknown) => void }) => {
          respond(true, { ok: true, sessions: [] });
        },
      );

      const res = fakeRes();
      const result = await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/status", "GET", { "x-openclaw-session-key": "my-key" }),
        res,
        { auth: AUTH },
      );

      expect(result).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it("returns session status with key from query param", async () => {
      vi.mocked(authorizeGatewayBearerRequestOrReply).mockResolvedValue(true);

      vi.mocked(sessionsHandlers["sessions.list"]).mockImplementation(
        ({ respond }: { respond: (ok: boolean, payload?: unknown) => void }) => {
          respond(true, { ok: true, sessions: [] });
        },
      );

      const res = fakeRes();
      const result = await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/status?key=my-key", "GET"),
        res,
        { auth: AUTH },
      );

      expect(result).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it("rejects POST method", async () => {
      const res = fakeRes();
      const result = await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/status", "POST"),
        res,
        { auth: AUTH },
      );

      expect(result).toBe(true);
      // sendMethodNotAllowed should have been called
    });

    it("returns 400 when key is missing", async () => {
      vi.mocked(authorizeGatewayBearerRequestOrReply).mockResolvedValue(true);

      const res = fakeRes();
      await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/status", "GET"),
        res,
        { auth: AUTH },
      );

      expect(res.statusCode).toBe(400);
    });

    it("returns true when auth fails", async () => {
      vi.mocked(authorizeGatewayBearerRequestOrReply).mockResolvedValue(false);

      const res = fakeRes();
      const result = await handleSessionsHttpRequest(
        fakeReq("/v1/sessions/status", "GET"),
        res,
        { auth: AUTH },
      );

      expect(result).toBe(true);
    });
  });
});
