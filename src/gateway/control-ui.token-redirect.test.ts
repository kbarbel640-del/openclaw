import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import os from "node:os";
import path from "node:path";
import { Elysia } from "elysia";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
// Spy on environment boundaries only (config loading + Node.js socket extraction)
import * as configModule from "../config/config.js";
import * as nodeCompatModule from "./elysia-node-compat.js";
import { controlUiRoutes } from "./routes/control-ui.js";

function makeUiRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-control-ui-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<html><head></head><body>ok</body></html>\n");
  return dir;
}

function fakeNodeReq(remoteAddress: string, host: string): IncomingMessage {
  return {
    headers: { host },
    socket: { remoteAddress },
    // oxlint-disable-next-line typescript/no-explicit-any
  } as any;
}

describe("controlUiRoutes (tokenized redirect)", () => {
  let root: string;
  let loadConfigSpy: ReturnType<typeof vi.spyOn>;
  let getNodeRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    root = makeUiRoot();
    loadConfigSpy = vi.spyOn(configModule, "loadConfig");
    getNodeRequestSpy = vi.spyOn(nodeCompatModule, "getNodeRequest");
  });

  afterAll(() => {
    loadConfigSpy.mockRestore();
    getNodeRequestSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  function createApp() {
    return new Elysia().use(
      controlUiRoutes({ basePath: "", root: { kind: "resolved", path: root } }),
    );
  }

  function setupLocalRequest(token: string) {
    loadConfigSpy.mockReturnValue({
      gateway: { auth: { mode: "token", token } },
    });
    getNodeRequestSpy.mockReturnValue(fakeNodeReq("127.0.0.1", "localhost:18789"));
  }

  it("redirects local root requests to a tokenized URL", async () => {
    const app = createApp();
    setupLocalRequest("abc123");

    const res = await app.handle(new Request("http://localhost:18789/"));

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/?token=abc123");
  });

  it("redirects local deep links to a tokenized URL", async () => {
    const app = createApp();
    setupLocalRequest("abc123");

    const res = await app.handle(new Request("http://localhost:18789/hierarchy"));

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/hierarchy?token=abc123");
  });

  it("does not redirect when token is already present", async () => {
    const app = createApp();
    setupLocalRequest("abc123");

    const res = await app.handle(new Request("http://localhost:18789/?token=abc123"));

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("__OPENCLAW_CONTROL_UI_BASE_PATH__");
  });

  it("does not redirect non-local requests", async () => {
    const app = createApp();
    loadConfigSpy.mockReturnValue({
      gateway: { auth: { mode: "token", token: "abc123" } },
    });
    getNodeRequestSpy.mockReturnValue(fakeNodeReq("10.0.0.5", "localhost:18789"));

    const res = await app.handle(new Request("http://localhost:18789/"));

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("__OPENCLAW_CONTROL_UI_BASE_PATH__");
  });
});
