import { type AddressInfo, createServer } from "node:net";
import { fetch as realFetch } from "undici";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let testPort = 0;
let reachable = false;
let prevGatewayPort: string | undefined;

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => ({
      browser: {
        enabled: true,
        color: "#FF4500",
        attachOnly: false,
        headless: true,
        defaultProfile: "clawd",
        profiles: {
          clawd: { cdpPort: testPort + 1, color: "#FF4500" },
        },
      },
    }),
    writeConfigFile: vi.fn(async () => {}),
  };
});

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => reachable),
  isChromeReachable: vi.fn(async () => reachable),
  launchClawdChrome: vi.fn(async () => {
    reachable = true;
    return {
      pid: 123,
      exe: { kind: "chrome", path: "/fake/chrome" },
      userDataDir: "/tmp/clawd",
      cdpPort: testPort + 1,
      startedAt: Date.now(),
      proc: {
        pid: 123,
        on: () => {},
        kill: () => true,
      },
    };
  }),
  resolveClawdUserDataDir: vi.fn(() => "/tmp/clawd"),
  stopClawdChrome: vi.fn(async () => {
    reachable = false;
  }),
}));

vi.mock("./cdp.js", () => ({
  createTargetViaCdp: vi.fn(async () => ({ targetId: "newtab" })),
  normalizeCdpWsUrl: vi.fn((wsUrl: string) => wsUrl),
  snapshotAria: vi.fn(async () => ({ nodes: [] })),
  getHeadersWithAuth: vi.fn(() => ({})),
  appendCdpPath: vi.fn((cdpUrl: string, path: string) => `${cdpUrl}${path}`),
}));

vi.mock("./pw-ai.js", () => ({}));

async function getFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const assigned = (s.address() as AddressInfo).port;
      s.close((err) => (err ? reject(err) : resolve(assigned)));
    });
  });
}

describe("CSRF protection", () => {
  beforeEach(async () => {
    reachable = false;
    testPort = await getFreePort();
    // Set gateway port so controlPort derives to testPort (controlPort = gatewayPort + 2)
    prevGatewayPort = process.env.CLAWDBOT_GATEWAY_PORT;
    process.env.CLAWDBOT_GATEWAY_PORT = String(testPort - 2);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/json/list")) {
          return { ok: true, status: 200, json: async () => [] };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (prevGatewayPort === undefined) {
      delete process.env.CLAWDBOT_GATEWAY_PORT;
    } else {
      process.env.CLAWDBOT_GATEWAY_PORT = prevGatewayPort;
    }
    const { stopBrowserControlServer } = await import("./server.js");
    await stopBrowserControlServer();
  });

  it("returns csrfToken in GET / response", async () => {
    const { startBrowserControlServerFromConfig } = await import("./server.js");
    await startBrowserControlServerFromConfig();
    const base = `http://127.0.0.1:${testPort}`;

    const res = await realFetch(`${base}/`);
    const data = (await res.json()) as { csrfToken?: string };

    expect(data.csrfToken).toBeDefined();
    expect(typeof data.csrfToken).toBe("string");
    expect(data.csrfToken?.length).toBe(64); // 32 bytes hex = 64 chars
  });

  it("rejects POST without CSRF token with 403", async () => {
    const { startBrowserControlServerFromConfig } = await import("./server.js");
    await startBrowserControlServerFromConfig();
    const base = `http://127.0.0.1:${testPort}`;

    const res = await realFetch(`${base}/start`, { method: "POST" });
    expect(res.status).toBe(403);

    const data = (await res.json()) as { error?: string };
    expect(data.error).toContain("CSRF");
  });

  it("rejects POST with wrong CSRF token with 403", async () => {
    const { startBrowserControlServerFromConfig } = await import("./server.js");
    await startBrowserControlServerFromConfig();
    const base = `http://127.0.0.1:${testPort}`;

    const res = await realFetch(`${base}/start`, {
      method: "POST",
      headers: { "X-CSRF-Token": "wrong-token" },
    });
    expect(res.status).toBe(403);
  });

  it("accepts POST with correct CSRF token", async () => {
    const { startBrowserControlServerFromConfig } = await import("./server.js");
    await startBrowserControlServerFromConfig();
    const base = `http://127.0.0.1:${testPort}`;

    // First get the token
    const statusRes = await realFetch(`${base}/`);
    const statusData = (await statusRes.json()) as { csrfToken: string };
    const token = statusData.csrfToken;

    // Now POST with the token
    const res = await realFetch(`${base}/start`, {
      method: "POST",
      headers: { "X-CSRF-Token": token },
    });
    expect(res.status).not.toBe(403);
  });

  it("allows GET requests without CSRF token", async () => {
    const { startBrowserControlServerFromConfig } = await import("./server.js");
    await startBrowserControlServerFromConfig();
    const base = `http://127.0.0.1:${testPort}`;

    // GET should work without token
    const res = await realFetch(`${base}/`);
    expect(res.status).toBe(200);

    const profiles = await realFetch(`${base}/profiles`);
    expect(profiles.status).toBe(200);
  });
});
