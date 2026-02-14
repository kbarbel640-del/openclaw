import { beforeEach, describe, expect, it, vi } from "vitest";
import { probeSignal } from "./probe.js";

const signalCheckMock = vi.fn();
const containerCheckMock = vi.fn();
const detectSignalApiModeMock = vi.fn();
const checkAdapterMock = vi.fn();

vi.mock("./client.js", () => ({
  signalCheck: (...args: unknown[]) => signalCheckMock(...args),
}));

vi.mock("./client-container.js", () => ({
  containerCheck: (...args: unknown[]) => containerCheckMock(...args),
}));

vi.mock("./client-adapter.js", () => ({
  detectSignalApiMode: (...args: unknown[]) => detectSignalApiModeMock(...args),
  checkAdapter: (...args: unknown[]) => checkAdapterMock(...args),
}));

describe("probeSignal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-detects native mode and returns version", async () => {
    detectSignalApiModeMock.mockResolvedValueOnce("native");
    checkAdapterMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const res = await probeSignal("http://127.0.0.1:8080", 1000);

    expect(res.ok).toBe(true);
    expect(res.apiMode).toBe("native");
    expect(res.version).toBe("signal-cli");
    expect(res.status).toBe(200);
  });

  it("auto-detects container mode and returns version", async () => {
    detectSignalApiModeMock.mockResolvedValueOnce("container");
    checkAdapterMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const res = await probeSignal("http://127.0.0.1:8080", 1000);

    expect(res.ok).toBe(true);
    expect(res.apiMode).toBe("container");
    expect(res.version).toBe("bbernhard/signal-cli-rest-api");
    expect(res.status).toBe(200);
  });

  it("returns ok=false when neither endpoint responds", async () => {
    detectSignalApiModeMock.mockRejectedValueOnce(
      new Error("Signal API not reachable at http://127.0.0.1:8080"),
    );

    const res = await probeSignal("http://127.0.0.1:8080", 1000);

    expect(res.ok).toBe(false);
    expect(res.apiMode).toBe(null);
    expect(res.error).toContain("Signal API not reachable");
  });

  it("uses specific native mode when requested", async () => {
    checkAdapterMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const res = await probeSignal("http://127.0.0.1:8080", 1000, "native");

    expect(res.ok).toBe(true);
    expect(res.apiMode).toBe("native");
    expect(res.version).toBe("signal-cli");
    expect(detectSignalApiModeMock).not.toHaveBeenCalled();
  });

  it("uses specific container mode when requested", async () => {
    checkAdapterMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const res = await probeSignal("http://127.0.0.1:8080", 1000, "container");

    expect(res.ok).toBe(true);
    expect(res.apiMode).toBe("container");
    expect(res.version).toBe("bbernhard/signal-cli-rest-api");
    expect(detectSignalApiModeMock).not.toHaveBeenCalled();
  });

  it("returns ok=false when specific mode check fails", async () => {
    checkAdapterMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      error: "HTTP 503",
    });

    const res = await probeSignal("http://127.0.0.1:8080", 1000, "native");

    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
    expect(res.error).toBe("HTTP 503");
    expect(res.apiMode).toBe(null);
  });

  it("treats auto as default when no mode specified", async () => {
    detectSignalApiModeMock.mockResolvedValueOnce("native");
    checkAdapterMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const res = await probeSignal("http://127.0.0.1:8080", 1000, "auto");

    expect(res.ok).toBe(true);
    expect(res.apiMode).toBe("native");
    expect(detectSignalApiModeMock).toHaveBeenCalled();
  });
});
