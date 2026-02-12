import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { handleControlUiHttpRequest } from "./control-ui.js";

function makeReq(params: {
  url: string;
  method?: string;
  host?: string;
  remoteAddress?: string;
}): IncomingMessage {
  const req = {
    url: params.url,
    method: params.method ?? "GET",
    headers: {
      host: params.host ?? "localhost:18789",
    },
    socket: {
      remoteAddress: params.remoteAddress ?? "127.0.0.1",
    },
  };
  // oxlint-disable-next-line typescript/no-explicit-any
  return req as any;
}

function makeRes(): ServerResponse & { headers: Map<string, string>; body: string } {
  const headers = new Map<string, string>();
  const res = {
    statusCode: 200,
    headers,
    body: "",
    setHeader(key: string, value: unknown) {
      headers.set(key.toLowerCase(), String(value));
    },
    end(value?: unknown) {
      if (typeof value === "string") {
        this.body = value;
      } else if (Buffer.isBuffer(value)) {
        this.body = value.toString("utf8");
      } else if (value == null) {
        this.body = "";
      } else if (typeof value === "number" || typeof value === "boolean") {
        this.body = String(value);
      } else {
        // Avoid Object default stringification in tests; surface the data instead.
        this.body = JSON.stringify(value);
      }
    },
  };
  // oxlint-disable-next-line typescript/no-explicit-any
  return res as any;
}

function makeUiRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-control-ui-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<html><head></head><body>ok</body></html>\n");
  return dir;
}

describe("handleControlUiHttpRequest (tokenized redirect)", () => {
  it("redirects local root requests to a tokenized URL", () => {
    const root = makeUiRoot();
    const req = makeReq({ url: "/" });
    const res = makeRes();

    const handled = handleControlUiHttpRequest(req, res, {
      root: { kind: "resolved", path: root },
      config: {
        gateway: { auth: { mode: "token", token: "abc123" } },
        // oxlint-disable-next-line typescript/no-explicit-any
      } as any,
    });

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(302);
    expect(res.headers.get("location")).toBe("/?token=abc123");
  });

  it("redirects local deep links to a tokenized URL", () => {
    const root = makeUiRoot();
    const req = makeReq({ url: "/hierarchy" });
    const res = makeRes();

    const handled = handleControlUiHttpRequest(req, res, {
      root: { kind: "resolved", path: root },
      config: {
        gateway: { auth: { mode: "token", token: "abc123" } },
        // oxlint-disable-next-line typescript/no-explicit-any
      } as any,
    });

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(302);
    expect(res.headers.get("location")).toBe("/hierarchy?token=abc123");
  });

  it("does not redirect when token is already present", () => {
    const root = makeUiRoot();
    const req = makeReq({ url: "/?token=abc123" });
    const res = makeRes();

    handleControlUiHttpRequest(req, res, {
      root: { kind: "resolved", path: root },
      config: {
        gateway: { auth: { mode: "token", token: "abc123" } },
        // oxlint-disable-next-line typescript/no-explicit-any
      } as any,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("__OPENCLAW_CONTROL_UI_BASE_PATH__");
  });

  it("does not redirect non-local requests", () => {
    const root = makeUiRoot();
    const req = makeReq({ url: "/", remoteAddress: "10.0.0.5" });
    const res = makeRes();

    handleControlUiHttpRequest(req, res, {
      root: { kind: "resolved", path: root },
      config: {
        gateway: { auth: { mode: "token", token: "abc123" } },
        // oxlint-disable-next-line typescript/no-explicit-any
      } as any,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("__OPENCLAW_CONTROL_UI_BASE_PATH__");
  });
});
