import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchBrowserJson: vi.fn(async () => ({ ok: true, targetId: "t1" })),
}));

vi.mock("./client-fetch.js", () => ({
  fetchBrowserJson: mocks.fetchBrowserJson,
}));

import {
  browserAct,
  browserArmDialog,
  browserArmFileChooser,
  browserDownload,
  browserWaitForDownload,
} from "./client-actions-core.js";

describe("client-actions-core timeout policy", () => {
  it("uses default route timeout when request timeout is not provided", async () => {
    mocks.fetchBrowserJson.mockClear();
    await browserAct("http://127.0.0.1:18791", { kind: "click", ref: "1" });
    const init = mocks.fetchBrowserJson.mock.calls[0]?.[1] as { timeoutMs?: number };
    expect(init.timeoutMs).toBe(20_000);
  });

  it("adds headroom above act timeoutMs", async () => {
    mocks.fetchBrowserJson.mockClear();
    await browserAct("http://127.0.0.1:18791", {
      kind: "wait",
      timeMs: 30_000,
      timeoutMs: 30_000,
    });
    const init = mocks.fetchBrowserJson.mock.calls[0]?.[1] as { timeoutMs?: number };
    expect(init.timeoutMs).toBe(35_000);
  });

  it("uses a longer default route timeout for wait/evaluate acts", async () => {
    mocks.fetchBrowserJson.mockClear();
    await browserAct("http://127.0.0.1:18791", {
      kind: "evaluate",
      fn: "() => document.title",
    });
    const init = mocks.fetchBrowserJson.mock.calls[0]?.[1] as { timeoutMs?: number };
    expect(init.timeoutMs).toBe(30_000);
  });

  it("applies timeout headroom for dialog and file chooser hooks", async () => {
    mocks.fetchBrowserJson.mockClear();
    await browserArmDialog("http://127.0.0.1:18791", { accept: true, timeoutMs: 40_000 });
    await browserArmFileChooser("http://127.0.0.1:18791", {
      paths: ["/tmp/a.txt"],
      timeoutMs: 45_000,
    });
    const first = mocks.fetchBrowserJson.mock.calls[0]?.[1] as { timeoutMs?: number };
    const second = mocks.fetchBrowserJson.mock.calls[1]?.[1] as { timeoutMs?: number };
    expect(first.timeoutMs).toBe(45_000);
    expect(second.timeoutMs).toBe(50_000);
  });

  it("applies timeout headroom for download routes", async () => {
    mocks.fetchBrowserJson.mockClear();
    await browserWaitForDownload("http://127.0.0.1:18791", { timeoutMs: 60_000 });
    await browserDownload("http://127.0.0.1:18791", {
      ref: "e1",
      path: "/tmp/dl.txt",
      timeoutMs: 70_000,
    });
    const first = mocks.fetchBrowserJson.mock.calls[0]?.[1] as { timeoutMs?: number };
    const second = mocks.fetchBrowserJson.mock.calls[1]?.[1] as { timeoutMs?: number };
    expect(first.timeoutMs).toBe(65_000);
    expect(second.timeoutMs).toBe(75_000);
  });
});
