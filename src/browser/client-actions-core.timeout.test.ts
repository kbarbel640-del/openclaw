import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchBrowserJson: vi.fn(async (_url: string, _init?: RequestInit & { timeoutMs?: number }) => ({
    ok: true,
    targetId: "t1",
  })),
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
  const lastInit = (index = 0): RequestInit & { timeoutMs?: number } => {
    const call = mocks.fetchBrowserJson.mock.calls[index];
    expect(call).toBeDefined();
    return call?.[1] ?? {};
  };

  it("uses default route timeout when request timeout is not provided", async () => {
    mocks.fetchBrowserJson.mockClear();
    await browserAct("http://127.0.0.1:18791", { kind: "click", ref: "1" });
    const init = lastInit(0);
    expect(init.timeoutMs).toBe(20_000);
  });

  it("adds headroom above act timeoutMs", async () => {
    mocks.fetchBrowserJson.mockClear();
    await browserAct("http://127.0.0.1:18791", {
      kind: "wait",
      timeMs: 30_000,
      timeoutMs: 30_000,
    });
    const init = lastInit(0);
    expect(init.timeoutMs).toBe(35_000);
  });

  it("uses a longer default route timeout for wait/evaluate acts", async () => {
    mocks.fetchBrowserJson.mockClear();
    await browserAct("http://127.0.0.1:18791", {
      kind: "evaluate",
      fn: "() => document.title",
    });
    const init = lastInit(0);
    expect(init.timeoutMs).toBe(30_000);
  });

  it("applies timeout headroom for dialog and file chooser hooks", async () => {
    mocks.fetchBrowserJson.mockClear();
    await browserArmDialog("http://127.0.0.1:18791", { accept: true, timeoutMs: 40_000 });
    await browserArmFileChooser("http://127.0.0.1:18791", {
      paths: ["/tmp/a.txt"],
      timeoutMs: 45_000,
    });
    const first = lastInit(0);
    const second = lastInit(1);
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
    const first = lastInit(0);
    const second = lastInit(1);
    expect(first.timeoutMs).toBe(65_000);
    expect(second.timeoutMs).toBe(75_000);
  });
});
