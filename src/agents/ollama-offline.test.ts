import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkConnectivity, getOfflineCapabilities, getStatus } from "./ollama-offline.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function mockFetchImpl(opts: { ollama?: boolean; internet?: boolean } = {}) {
  const { ollama = true, internet = true } = opts;
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("11434")) {
      if (!ollama) {
        return Promise.reject(new Error("ECONNREFUSED"));
      }
      return Promise.resolve({ ok: true });
    }
    if (typeof url === "string" && url.includes("1.1.1.1")) {
      if (!internet) {
        return Promise.reject(new Error("timeout"));
      }
      return Promise.resolve({ ok: true });
    }
    return Promise.reject(new Error("unexpected URL"));
  });
}

describe("checkConnectivity", () => {
  it("returns all true when everything is up", async () => {
    mockFetchImpl({ ollama: true, internet: true });
    const result = await checkConnectivity();
    expect(result).toEqual({ online: true, ollama: true, internet: true });
  });

  it("returns ollama=false when Ollama is down", async () => {
    mockFetchImpl({ ollama: false, internet: true });
    const result = await checkConnectivity();
    expect(result).toEqual({ online: true, ollama: false, internet: true });
  });

  it("returns internet=false when offline", async () => {
    mockFetchImpl({ ollama: true, internet: false });
    const result = await checkConnectivity();
    expect(result).toEqual({ online: true, ollama: true, internet: false });
  });

  it("returns all false when nothing is running", async () => {
    mockFetchImpl({ ollama: false, internet: false });
    const result = await checkConnectivity();
    expect(result).toEqual({ online: false, ollama: false, internet: false });
  });

  it("handles fetch timeout (abort)", async () => {
    mockFetch.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("aborted")), 10)),
    );
    const result = await checkConnectivity();
    expect(result.ollama).toBe(false);
    expect(result.internet).toBe(false);
  });
});

describe("getOfflineCapabilities", () => {
  it("returns full capabilities with Ollama + models", () => {
    const caps = getOfflineCapabilities(true, ["llama3", "codellama"]);
    expect(caps.status).toBe("full");
    expect(caps.canInfer).toBe(true);
    expect(caps.canPullModels).toBe(true);
    expect(caps.message).toContain("2 models");
  });

  it("returns no-models when Ollama running but empty", () => {
    const caps = getOfflineCapabilities(true, []);
    expect(caps.status).toBe("no-models");
    expect(caps.canInfer).toBe(false);
    expect(caps.canPullModels).toBe(true);
  });

  it("returns no-ollama when Ollama is not running", () => {
    const caps = getOfflineCapabilities(false, []);
    expect(caps.status).toBe("no-ollama");
    expect(caps.canInfer).toBe(false);
    expect(caps.canPullModels).toBe(false);
    expect(caps.message).toContain("ollama serve");
  });

  it("returns no-ollama even if models list is non-empty", () => {
    const caps = getOfflineCapabilities(false, ["llama3"]);
    expect(caps.status).toBe("no-ollama");
  });

  it("singular model message", () => {
    const caps = getOfflineCapabilities(true, ["llama3"]);
    expect(caps.message).toContain("1 model:");
  });
});

describe("getStatus (integrated)", () => {
  it("returns full with cloud when everything is up", async () => {
    mockFetchImpl({ ollama: true, internet: true });
    const status = await getStatus(["llama3"]);
    expect(status.status).toBe("full");
    expect(status.canUseCloudProviders).toBe(true);
    expect(status.canInfer).toBe(true);
  });

  it("returns local-only when Ollama + models but no internet", async () => {
    mockFetchImpl({ ollama: true, internet: false });
    const status = await getStatus(["llama3", "codellama"]);
    expect(status.status).toBe("local-only");
    expect(status.canInfer).toBe(true);
    expect(status.canPullModels).toBe(false);
    expect(status.canUseCloudProviders).toBe(false);
    expect(status.message).toContain("Offline but fully functional");
  });

  it("returns no-models when Ollama running, no models", async () => {
    mockFetchImpl({ ollama: true, internet: true });
    const status = await getStatus([]);
    expect(status.status).toBe("no-models");
    expect(status.canInfer).toBe(false);
  });

  it("returns no-ollama when nothing running", async () => {
    mockFetchImpl({ ollama: false, internet: false });
    const status = await getStatus([]);
    expect(status.status).toBe("no-ollama");
  });
});
