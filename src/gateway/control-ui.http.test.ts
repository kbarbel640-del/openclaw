import fsSync from "node:fs";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CONTROL_UI_BOOTSTRAP_CONFIG_PATH } from "./control-ui-contract.js";
import { handleControlUiAvatarRequest, handleControlUiHttpRequest } from "./control-ui.js";
import { makeMockHttpResponse } from "./test-http-response.js";

describe("handleControlUiHttpRequest", () => {
  async function withControlUiRoot<T>(params: {
    indexHtml?: string;
    fn: (tmp: string) => Promise<T>;
  }) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-ui-"));
    try {
      await fs.writeFile(path.join(tmp, "index.html"), params.indexHtml ?? "<html></html>\n");
      return await params.fn(tmp);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }

  function parseBootstrapPayload(end: ReturnType<typeof makeMockHttpResponse>["end"]) {
    return JSON.parse(String(end.mock.calls[0]?.[0] ?? "")) as {
      basePath: string;
      assistantName: string;
      assistantAvatar: string;
      assistantAgentId: string;
    };
  }

  function expectNotFoundResponse(params: {
    handled: boolean;
    res: ReturnType<typeof makeMockHttpResponse>["res"];
    end: ReturnType<typeof makeMockHttpResponse>["end"];
  }) {
    expect(params.handled).toBe(true);
    expect(params.res.statusCode).toBe(404);
    expect(params.end).toHaveBeenCalledWith("Not Found");
  }

  function runControlUiRequest(params: {
    url: string;
    method: "GET" | "HEAD";
    rootPath: string;
    basePath?: string;
  }) {
    const { res, end } = makeMockHttpResponse();
    const handled = handleControlUiHttpRequest(
      { url: params.url, method: params.method } as IncomingMessage,
      res,
      {
        ...(params.basePath ? { basePath: params.basePath } : {}),
        root: { kind: "resolved", path: params.rootPath },
      },
    );
    return { res, end, handled };
  }

  function runAvatarRequest(params: {
    url: string;
    method: "GET" | "HEAD";
    resolveAvatar: Parameters<typeof handleControlUiAvatarRequest>[2]["resolveAvatar"];
    basePath?: string;
  }) {
    const { res, end } = makeMockHttpResponse();
    const handled = handleControlUiAvatarRequest(
      { url: params.url, method: params.method } as IncomingMessage,
      res,
      {
        ...(params.basePath ? { basePath: params.basePath } : {}),
        resolveAvatar: params.resolveAvatar,
      },
    );
    return { res, end, handled };
  }

  async function writeAssetFile(rootPath: string, filename: string, contents: string) {
    const assetsDir = path.join(rootPath, "assets");
    await fs.mkdir(assetsDir, { recursive: true });
    const filePath = path.join(assetsDir, filename);
    await fs.writeFile(filePath, contents);
    return { assetsDir, filePath };
  }

  async function withBasePathRootFixture<T>(params: {
    siblingDir: string;
    fn: (paths: { root: string; sibling: string }) => Promise<T>;
  }) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-ui-root-"));
    try {
      const root = path.join(tmp, "ui");
      const sibling = path.join(tmp, params.siblingDir);
      await fs.mkdir(root, { recursive: true });
      await fs.mkdir(sibling, { recursive: true });
      await fs.writeFile(path.join(root, "index.html"), "<html>ok</html>\n");
      return await params.fn({ root, sibling });
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }

  it("sets security headers for Control UI responses", async () => {
    await withControlUiRoot({
      fn: async (tmp) => {
        const { res, setHeader } = makeMockHttpResponse();
        const handled = handleControlUiHttpRequest(
          { url: "/", method: "GET" } as IncomingMessage,
          res,
          {
            root: { kind: "resolved", path: tmp },
          },
        );
        expect(handled).toBe(true);
        expect(setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
        const csp = setHeader.mock.calls.find((call) => call[0] === "Content-Security-Policy")?.[1];
        expect(typeof csp).toBe("string");
        expect(String(csp)).toContain("frame-ancestors 'none'");
        expect(String(csp)).toContain("script-src 'self'");
        expect(String(csp)).not.toContain("script-src 'self' 'unsafe-inline'");
      },
    });
  });

  it("does not inject inline scripts into index.html", async () => {
    const html = "<html><head></head><body>Hello</body></html>\n";
    await withControlUiRoot({
      indexHtml: html,
      fn: async (tmp) => {
        const { res, end } = makeMockHttpResponse();
        const handled = handleControlUiHttpRequest(
          { url: "/", method: "GET" } as IncomingMessage,
          res,
          {
            root: { kind: "resolved", path: tmp },
            config: {
              agents: { defaults: { workspace: tmp } },
              ui: { assistant: { name: "</script><script>alert(1)//", avatar: "evil.png" } },
            },
          },
        );
        expect(handled).toBe(true);
        expect(end).toHaveBeenCalledWith(html);
      },
    });
  });

  it("serves bootstrap config JSON", async () => {
    await withControlUiRoot({
      fn: async (tmp) => {
        const { res, end } = makeMockHttpResponse();
        const handled = handleControlUiHttpRequest(
          { url: CONTROL_UI_BOOTSTRAP_CONFIG_PATH, method: "GET" } as IncomingMessage,
          res,
          {
            root: { kind: "resolved", path: tmp },
            config: {
              agents: { defaults: { workspace: tmp } },
              ui: { assistant: { name: "</script><script>alert(1)//", avatar: "</script>.png" } },
            },
          },
        );
        expect(handled).toBe(true);
        const parsed = parseBootstrapPayload(end);
        expect(parsed.basePath).toBe("");
        expect(parsed.assistantName).toBe("</script><script>alert(1)//");
        expect(parsed.assistantAvatar).toBe("/avatar/main");
        expect(parsed.assistantAgentId).toBe("main");
      },
    });
  });

  it("serves bootstrap config JSON under basePath", async () => {
    await withControlUiRoot({
      fn: async (tmp) => {
        const { res, end } = makeMockHttpResponse();
        const handled = handleControlUiHttpRequest(
          { url: `/openclaw${CONTROL_UI_BOOTSTRAP_CONFIG_PATH}`, method: "GET" } as IncomingMessage,
          res,
          {
            basePath: "/openclaw",
            root: { kind: "resolved", path: tmp },
            config: {
              agents: { defaults: { workspace: tmp } },
              ui: { assistant: { name: "Ops", avatar: "ops.png" } },
            },
          },
        );
        expect(handled).toBe(true);
        const parsed = parseBootstrapPayload(end);
        expect(parsed.basePath).toBe("/openclaw");
        expect(parsed.assistantName).toBe("Ops");
        expect(parsed.assistantAvatar).toBe("/openclaw/avatar/main");
        expect(parsed.assistantAgentId).toBe("main");
      },
    });
  });

  it("serves local avatar bytes through hardened avatar handler", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-avatar-http-"));
    try {
      const avatarPath = path.join(tmp, "main.png");
      await fs.writeFile(avatarPath, "avatar-bytes\n");

      const { res, end, handled } = runAvatarRequest({
        url: "/avatar/main",
        method: "GET",
        resolveAvatar: () => ({ kind: "local", filePath: avatarPath }),
      });

      expect(handled).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(String(end.mock.calls[0]?.[0] ?? "")).toBe("avatar-bytes\n");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("rejects avatar symlink paths from resolver", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-avatar-http-link-"));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-avatar-http-outside-"));
    try {
      const outsideFile = path.join(outside, "secret.txt");
      await fs.writeFile(outsideFile, "outside-secret\n");
      const linkPath = path.join(tmp, "avatar-link.png");
      await fs.symlink(outsideFile, linkPath);

      const { res, end, handled } = runAvatarRequest({
        url: "/avatar/main",
        method: "GET",
        resolveAvatar: () => ({ kind: "local", filePath: linkPath }),
      });

      expectNotFoundResponse({ handled, res, end });
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("rejects symlinked assets that resolve outside control-ui root", async () => {
    await withControlUiRoot({
      fn: async (tmp) => {
        const assetsDir = path.join(tmp, "assets");
        const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-ui-outside-"));
        try {
          const outsideFile = path.join(outsideDir, "secret.txt");
          await fs.mkdir(assetsDir, { recursive: true });
          await fs.writeFile(outsideFile, "outside-secret\n");
          await fs.symlink(outsideFile, path.join(assetsDir, "leak.txt"));

          const { res, end } = makeMockHttpResponse();
          const handled = handleControlUiHttpRequest(
            { url: "/assets/leak.txt", method: "GET" } as IncomingMessage,
            res,
            {
              root: { kind: "resolved", path: tmp },
            },
          );
          expectNotFoundResponse({ handled, res, end });
        } finally {
          await fs.rm(outsideDir, { recursive: true, force: true });
        }
      },
    });
  });

  it("allows symlinked assets that resolve inside control-ui root", async () => {
    await withControlUiRoot({
      fn: async (tmp) => {
        const { assetsDir, filePath } = await writeAssetFile(tmp, "actual.txt", "inside-ok\n");
        await fs.symlink(filePath, path.join(assetsDir, "linked.txt"));

        const { res, end, handled } = runControlUiRequest({
          url: "/assets/linked.txt",
          method: "GET",
          rootPath: tmp,
        });

        expect(handled).toBe(true);
        expect(res.statusCode).toBe(200);
        expect(String(end.mock.calls[0]?.[0] ?? "")).toBe("inside-ok\n");
      },
    });
  });

  it("serves HEAD for in-root assets without writing a body", async () => {
    await withControlUiRoot({
      fn: async (tmp) => {
        await writeAssetFile(tmp, "actual.txt", "inside-ok\n");

        const { res, end, handled } = runControlUiRequest({
          url: "/assets/actual.txt",
          method: "HEAD",
          rootPath: tmp,
        });

        expect(handled).toBe(true);
        expect(res.statusCode).toBe(200);
        expect(end.mock.calls[0]?.length ?? -1).toBe(0);
      },
    });
  });

  it("rejects symlinked SPA fallback index.html outside control-ui root", async () => {
    await withControlUiRoot({
      fn: async (tmp) => {
        const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-ui-index-outside-"));
        try {
          const outsideIndex = path.join(outsideDir, "index.html");
          await fs.writeFile(outsideIndex, "<html>outside</html>\n");
          await fs.rm(path.join(tmp, "index.html"));
          await fs.symlink(outsideIndex, path.join(tmp, "index.html"));

          const { res, end, handled } = runControlUiRequest({
            url: "/app/route",
            method: "GET",
            rootPath: tmp,
          });
          expectNotFoundResponse({ handled, res, end });
        } finally {
          await fs.rm(outsideDir, { recursive: true, force: true });
        }
      },
    });
  });

  it("rejects absolute-path escape attempts under basePath routes", async () => {
    await withBasePathRootFixture({
      siblingDir: "ui-secrets",
      fn: async ({ root, sibling }) => {
        const secretPath = path.join(sibling, "secret.txt");
        await fs.writeFile(secretPath, "sensitive-data");

        const secretPathUrl = secretPath.split(path.sep).join("/");
        const absolutePathUrl = secretPathUrl.startsWith("/") ? secretPathUrl : `/${secretPathUrl}`;
        const { res, end, handled } = runControlUiRequest({
          url: `/openclaw/${absolutePathUrl}`,
          method: "GET",
          rootPath: root,
          basePath: "/openclaw",
        });
        expectNotFoundResponse({ handled, res, end });
      },
    });
  });

  it("rejects symlink escape attempts under basePath routes", async () => {
    await withBasePathRootFixture({
      siblingDir: "outside",
      fn: async ({ root, sibling }) => {
        await fs.mkdir(path.join(root, "assets"), { recursive: true });
        const secretPath = path.join(sibling, "secret.txt");
        await fs.writeFile(secretPath, "sensitive-data");

        const linkPath = path.join(root, "assets", "leak.txt");
        try {
          await fs.symlink(secretPath, linkPath, "file");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EPERM") {
            return;
          }
          throw error;
        }

        const { res, end, handled } = runControlUiRequest({
          url: "/openclaw/assets/leak.txt",
          method: "GET",
          rootPath: root,
          basePath: "/openclaw",
        });
        expectNotFoundResponse({ handled, res, end });
      },
    });
  });
});

// ---------------------------------------------------------------------------
// handleControlUiHttpRequest – SPA fallback vs /api/* routes
// ---------------------------------------------------------------------------

function mockReq(method: string, url: string): IncomingMessage {
  return { method, url, headers: {} } as unknown as IncomingMessage;
}

function mockRes2(): ServerResponse & {
  _status: number;
  _headers: Record<string, string>;
  _body: string;
} {
  const res = {
    _status: 200,
    _headers: {} as Record<string, string>,
    _body: "",
    set statusCode(v: number) {
      this._status = v;
    },
    get statusCode() {
      return this._status;
    },
    setHeader(k: string, v: string) {
      this._headers[k.toLowerCase()] = v;
    },
    end(body?: string | Buffer) {
      if (body != null) this._body = typeof body === "string" ? body : body.toString("utf8");
    },
  } as unknown as ServerResponse & {
    _status: number;
    _headers: Record<string, string>;
    _body: string;
  };
  return res;
}

describe("handleControlUiHttpRequest – /api/ exclusion", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "openclaw-cui-test-"));
    fsSync.writeFileSync(path.join(tmpDir, "index.html"), "<html><body>SPA</body></html>", "utf8");
  });

  afterAll(() => {
    fsSync.rmSync(tmpDir, { recursive: true, force: true });
  });

  const rootState = () => ({ kind: "resolved" as const, path: tmpDir });

  it("serves SPA fallback for normal unknown routes", () => {
    const req = mockReq("GET", "/some/page");
    const res = mockRes2();
    const handled = handleControlUiHttpRequest(req, res, { root: rootState() });
    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._headers["content-type"]).toContain("text/html");
    expect(res._body).toContain("SPA");
  });

  it("returns JSON 404 for /api/ routes instead of SPA fallback", () => {
    const req = mockReq("GET", "/api/some-endpoint");
    const res = mockRes2();
    const handled = handleControlUiHttpRequest(req, res, { root: rootState() });
    expect(handled).toBe(true);
    expect(res._status).toBe(404);
    expect(res._headers["content-type"]).toContain("application/json");
    expect(JSON.parse(res._body)).toEqual({ error: "Not found" });
  });

  it("returns JSON 404 for /api (no trailing slash)", () => {
    const req = mockReq("GET", "/api");
    const res = mockRes2();
    const handled = handleControlUiHttpRequest(req, res, { root: rootState() });
    expect(handled).toBe(true);
    expect(res._status).toBe(404);
    expect(JSON.parse(res._body)).toEqual({ error: "Not found" });
  });

  it("returns JSON 404 for /api/ routes under a basePath", () => {
    const req = mockReq("GET", "/ui/api/foo");
    const res = mockRes2();
    const handled = handleControlUiHttpRequest(req, res, {
      basePath: "/ui",
      root: rootState(),
    });
    expect(handled).toBe(true);
    expect(res._status).toBe(404);
    expect(res._headers["content-type"]).toContain("application/json");
    expect(JSON.parse(res._body)).toEqual({ error: "Not found" });
  });
});
