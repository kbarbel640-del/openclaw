import { beforeEach, describe, expect, it, vi } from "vitest";
import { startWebLoginWithQr, waitForWebLogin } from "./login-qr.js";
import { createWaSocket, logoutWeb, waitForWaConnection } from "./session.js";

vi.mock("./session.js", () => {
  const createWaSocket = vi.fn(
    async (_printQr: boolean, _verbose: boolean, opts?: { onQr?: (qr: string) => void }) => {
      const sock = { ws: { close: vi.fn() } };
      if (opts?.onQr) {
        setImmediate(() => opts.onQr?.("qr-data"));
      }
      return sock;
    },
  );
  const waitForWaConnection = vi.fn();
  const formatError = vi.fn((err: unknown) => `formatted:${String(err)}`);
  // Must match the real getStatusCode behavior — including unwrapping
  // the Baileys lastDisconnect { error: { output: { statusCode } } } shape.
  const getStatusCode = vi.fn(
    (err: unknown) =>
      (err as { output?: { statusCode?: number } })?.output?.statusCode ??
      (err as { error?: { output?: { statusCode?: number } } })?.error?.output?.statusCode ??
      (err as { status?: number })?.status,
  );
  const webAuthExists = vi.fn(async () => false);
  const readWebSelfId = vi.fn(() => ({ e164: null, jid: null }));
  const logoutWeb = vi.fn(async () => true);
  return {
    createWaSocket,
    waitForWaConnection,
    formatError,
    getStatusCode,
    webAuthExists,
    readWebSelfId,
    logoutWeb,
  };
});

vi.mock("./qr-image.js", () => ({
  renderQrPngBase64: vi.fn(async () => "base64"),
}));

const createWaSocketMock = vi.mocked(createWaSocket);
const waitForWaConnectionMock = vi.mocked(waitForWaConnection);
const logoutWebMock = vi.mocked(logoutWeb);

describe("login-qr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restarts login once on 515 with Baileys lastDisconnect shape", async () => {
    // Real Baileys shape: waitForWaConnection rejects with update.lastDisconnect
    // which wraps the Boom error under .error
    waitForWaConnectionMock
      .mockRejectedValueOnce({ error: { output: { statusCode: 515 } } })
      .mockResolvedValueOnce(undefined);

    const start = await startWebLoginWithQr({ timeoutMs: 5000 });
    expect(start.qrDataUrl).toBe("data:image/png;base64,base64");

    const result = await waitForWebLogin({ timeoutMs: 5000 });

    expect(result.connected).toBe(true);
    expect(createWaSocketMock).toHaveBeenCalledTimes(2);
    expect(logoutWebMock).not.toHaveBeenCalled();
  });

  it("restarts login once on 515 with direct Boom shape (backward compat)", async () => {
    waitForWaConnectionMock
      .mockRejectedValueOnce({ output: { statusCode: 515 } })
      .mockResolvedValueOnce(undefined);

    const start = await startWebLoginWithQr({ timeoutMs: 5000 });
    expect(start.qrDataUrl).toBe("data:image/png;base64,base64");

    const result = await waitForWebLogin({ timeoutMs: 5000 });

    expect(result.connected).toBe(true);
    expect(createWaSocketMock).toHaveBeenCalledTimes(2);
  });

  it("clears session on loggedOut (401) with Baileys lastDisconnect shape", async () => {
    waitForWaConnectionMock.mockRejectedValueOnce({
      error: { output: { statusCode: 401 } },
    });

    const start = await startWebLoginWithQr({ timeoutMs: 5000 });
    expect(start.qrDataUrl).toBe("data:image/png;base64,base64");

    const result = await waitForWebLogin({ timeoutMs: 5000 });

    expect(result.connected).toBe(false);
    expect(result.message).toContain("logged out");
    expect(logoutWebMock).toHaveBeenCalled();
  });

  it("reports failure for non-515/non-401 errors", async () => {
    waitForWaConnectionMock.mockRejectedValueOnce({
      error: { output: { statusCode: 408 } },
    });

    const start = await startWebLoginWithQr({ timeoutMs: 5000 });
    expect(start.qrDataUrl).toBe("data:image/png;base64,base64");

    const result = await waitForWebLogin({ timeoutMs: 5000 });

    expect(result.connected).toBe(false);
    expect(logoutWebMock).not.toHaveBeenCalled();
    expect(createWaSocketMock).toHaveBeenCalledTimes(1);
  });
});
