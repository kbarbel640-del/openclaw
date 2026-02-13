import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import plugin, { __testing } from "./index.js";

function makeApi(config: unknown) {
  const registerChannel = vi.fn();
  const registerHttpRoute = vi.fn();
  const api = {
    runtime: {
      config: {
        loadConfig: () => config,
        writeConfigFile: async () => {},
      },
    },
    registerChannel,
    registerHttpRoute,
  } as unknown as OpenClawPluginApi;
  return { api, registerChannel, registerHttpRoute };
}

function makeReq(params: { method?: string; body?: string; url?: string }) {
  const stream = Readable.from([Buffer.from(params.body ?? "", "utf-8")]) as Readable & {
    method?: string;
    url?: string;
    headers: Record<string, string>;
  };
  stream.method = params.method ?? "POST";
  stream.url = params.url ?? "/saint-email/push";
  stream.headers = {};
  return stream;
}

function makeRes() {
  const result = { status: 0, body: "" };
  const res = {
    writeHead: (status: number) => {
      result.status = status;
      return res;
    },
    end: (body?: string) => {
      result.body = body ?? "";
      return res;
    },
  };
  return { res, result };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("saint-email push webhook", () => {
  it("extracts push verification token from config", () => {
    const token = __testing.extractPushVerificationToken({
      channels: { email: { pushVerificationToken: " secret " } },
    });
    expect(token).toBe("secret");
    expect(__testing.extractPushVerificationToken({})).toBeUndefined();
  });

  it("extracts push message token from body", () => {
    const token = __testing.extractPushMessageToken(
      JSON.stringify({ message: { attributes: { token: "abc" } } }),
    );
    expect(token).toBe("abc");
    expect(__testing.extractPushMessageToken("{not-json")).toBeUndefined();
  });

  it("extracts push token from webhook query string", () => {
    expect(__testing.extractPushQueryToken("/saint-email/push?token=abc")).toBe("abc");
    expect(__testing.extractPushQueryToken("/saint-email/push?verificationToken=def")).toBe("def");
    expect(__testing.extractPushQueryToken("/saint-email/push")).toBeUndefined();
  });

  it("uses timing-safe token comparison with strict length match", () => {
    expect(__testing.timingSafeTokenEquals("abc", "abc")).toBe(true);
    expect(__testing.timingSafeTokenEquals("abc", "abd")).toBe(false);
    expect(__testing.timingSafeTokenEquals("abc", "abcd")).toBe(false);
  });

  it("rejects non-POST requests", async () => {
    const { api, registerHttpRoute } = makeApi({});
    plugin.register(api);
    const route = registerHttpRoute.mock.calls[0]?.[0] as {
      handler: (req: unknown, res: unknown) => Promise<void>;
    };
    expect(route?.handler).toBeTypeOf("function");

    const { res, result } = makeRes();
    await route.handler(makeReq({ method: "GET" }), res);

    expect(result.status).toBe(405);
  });

  it("requires matching push token when configured", async () => {
    const { api, registerHttpRoute } = makeApi({
      channels: { email: { pushVerificationToken: "token-123" } },
    });
    plugin.register(api);
    const route = registerHttpRoute.mock.calls[0]?.[0] as {
      handler: (req: unknown, res: unknown) => Promise<void>;
    };

    const denied = makeRes();
    await route.handler(
      makeReq({
        body: JSON.stringify({
          message: { attributes: { token: "wrong-token" } },
        }),
      }),
      denied.res,
    );
    expect(denied.result.status).toBe(403);

    const allowed = makeRes();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_010_000);
    await route.handler(
      makeReq({
        body: JSON.stringify({
          message: { attributes: { token: "token-123" } },
        }),
      }),
      allowed.res,
    );
    expect(allowed.result.status).toBe(200);
  });

  it("accepts matching push token provided as query parameter", async () => {
    const { api, registerHttpRoute } = makeApi({
      channels: { email: { pushVerificationToken: "token-query" } },
    });
    plugin.register(api);
    const route = registerHttpRoute.mock.calls[0]?.[0] as {
      handler: (req: unknown, res: unknown) => Promise<void>;
    };

    const allowed = makeRes();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_030_000);
    await route.handler(
      makeReq({
        url: "/saint-email/push?token=token-query",
        body: JSON.stringify({ message: { attributes: {} } }),
      }),
      allowed.res,
    );
    expect(allowed.result.status).toBe(200);
  });
});
