import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudruClient, CloudruApiError } from "./cloudru-client.js";

// Mock the auth module to avoid real IAM calls
vi.mock("./cloudru-auth.js", () => {
  class MockCloudruTokenProvider {
    async getToken() {
      return { token: "test-bearer-token", expiresAt: Date.now() + 3600_000 };
    }
    clearCache() {}
  }

  class MockCloudruAuthError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "CloudruAuthError";
    }
  }

  return {
    CloudruTokenProvider: MockCloudruTokenProvider,
    CloudruAuthError: MockCloudruAuthError,
  };
});

function createMockFetch(responses: Array<{ status: number; body?: unknown }>): typeof fetch {
  const impl = vi.fn();
  for (const response of responses) {
    impl.mockResolvedValueOnce({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: () => Promise.resolve(response.body),
      text: () => Promise.resolve(JSON.stringify(response.body ?? {})),
      headers: new Headers(),
    });
  }
  return impl as unknown as typeof fetch;
}

const BASE_CONFIG = {
  projectId: "proj-123",
  auth: { keyId: "k", secret: "s" },
  baseUrl: "https://test-api.example.com/api/v1",
  iamUrl: "https://iam.test/token",
};

describe("CloudruClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("makes GET requests with auth header", async () => {
    const fetchImpl = createMockFetch([{ status: 200, body: { items: [], total: 0 } }]);

    const client = new CloudruClient({ ...BASE_CONFIG, fetchImpl });
    const result = await client.get<{ items: unknown[]; total: number }>("/agents");

    expect(result).toEqual({ items: [], total: 0 });
    expect(fetchImpl).toHaveBeenCalledOnce();

    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://test-api.example.com/api/v1/proj-123/agents");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-bearer-token");
  });

  it("appends query parameters", async () => {
    const fetchImpl = createMockFetch([{ status: 200, body: { items: [], total: 0 } }]);

    const client = new CloudruClient({ ...BASE_CONFIG, fetchImpl });
    await client.get("/agents", { search: "test", limit: 10, offset: 0 });

    const [url] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("search=test");
    expect(url).toContain("limit=10");
  });

  it("makes POST requests with body", async () => {
    const fetchImpl = createMockFetch([{ status: 201, body: { id: "agent-1", name: "test" } }]);

    const client = new CloudruClient({ ...BASE_CONFIG, fetchImpl });
    const result = await client.post<{ id: string }>("/agents", { name: "test" });

    expect(result.id).toBe("agent-1");

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "test" }));
  });

  it("handles 204 No Content", async () => {
    const fetchImpl = createMockFetch([{ status: 204 }]);

    const client = new CloudruClient({ ...BASE_CONFIG, fetchImpl });
    const result = await client.delete("/agents/x");

    expect(result).toBeUndefined();
  });

  it("throws CloudruApiError on error responses", async () => {
    const fetchImpl = createMockFetch([
      { status: 404, body: { message: "not found", code: "NOT_FOUND" } },
    ]);

    const client = new CloudruClient({ ...BASE_CONFIG, fetchImpl });

    try {
      await client.get("/agents/missing");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CloudruApiError);
      expect((err as CloudruApiError).status).toBe(404);
      expect((err as CloudruApiError).code).toBe("NOT_FOUND");
    }
  });

  it("retries on 429 and 5xx", async () => {
    const fetchImpl = createMockFetch([
      { status: 429, body: { message: "rate limited" } },
      { status: 200, body: { id: "agent-1" } },
    ]);

    const client = new CloudruClient({ ...BASE_CONFIG, fetchImpl });
    const result = await client.get<{ id: string }>("/agents/1");

    expect(result.id).toBe("agent-1");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx (except 429)", async () => {
    const fetchImpl = createMockFetch([{ status: 400, body: { message: "bad request" } }]);

    const client = new CloudruClient({ ...BASE_CONFIG, fetchImpl });

    await expect(client.get("/agents")).rejects.toThrow(CloudruApiError);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("omits undefined query values", async () => {
    const fetchImpl = createMockFetch([{ status: 200, body: [] }]);

    const client = new CloudruClient({ ...BASE_CONFIG, fetchImpl });
    await client.get("/agents", { search: undefined, limit: 20 });

    const [url] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).not.toContain("search");
    expect(url).toContain("limit=20");
  });
});
