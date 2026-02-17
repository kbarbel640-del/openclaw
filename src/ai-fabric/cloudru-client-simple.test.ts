import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudruSimpleClient } from "./cloudru-client-simple.js";
import { CloudruApiError } from "./cloudru-client.js";

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
  apiKey: "test-api-key-abc",
  baseUrl: "https://test-api.example.com/api/v1",
};

describe("CloudruSimpleClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("makes GET requests with Bearer API key", async () => {
    const fetchImpl = createMockFetch([{ status: 200, body: { items: [], total: 0 } }]);

    const client = new CloudruSimpleClient({ ...BASE_CONFIG, fetchImpl });
    const result = await client.get<{ items: unknown[]; total: number }>("/mcpServers");

    expect(result).toEqual({ items: [], total: 0 });
    expect(fetchImpl).toHaveBeenCalledOnce();

    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://test-api.example.com/api/v1/proj-123/mcpServers");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-api-key-abc");
  });

  it("appends query parameters", async () => {
    const fetchImpl = createMockFetch([{ status: 200, body: { items: [], total: 0 } }]);

    const client = new CloudruSimpleClient({ ...BASE_CONFIG, fetchImpl });
    await client.get("/mcpServers", { search: "test", limit: 10, offset: 0 });

    const [url] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("search=test");
    expect(url).toContain("limit=10");
  });

  it("throws CloudruApiError on error responses", async () => {
    const fetchImpl = createMockFetch([
      { status: 403, body: { message: "forbidden", code: "FORBIDDEN" } },
    ]);

    const client = new CloudruSimpleClient({ ...BASE_CONFIG, fetchImpl });

    try {
      await client.get("/mcpServers");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CloudruApiError);
      expect((err as CloudruApiError).status).toBe(403);
      expect((err as CloudruApiError).code).toBe("FORBIDDEN");
    }
  });

  it("retries on 429 and 5xx", async () => {
    const fetchImpl = createMockFetch([
      { status: 503, body: { message: "service unavailable" } },
      { status: 200, body: { items: [], total: 0 } },
    ]);

    const client = new CloudruSimpleClient({ ...BASE_CONFIG, fetchImpl });
    const result = await client.get<{ items: unknown[]; total: number }>("/mcpServers");

    expect(result).toEqual({ items: [], total: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx (except 429)", async () => {
    const fetchImpl = createMockFetch([{ status: 401, body: { message: "unauthorized" } }]);

    const client = new CloudruSimpleClient({ ...BASE_CONFIG, fetchImpl });

    await expect(client.get("/mcpServers")).rejects.toThrow(CloudruApiError);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("listMcpServers returns paginated result", async () => {
    const mcpServers = [
      {
        id: "mcp-1",
        name: "web-search",
        status: "RUNNING",
        tools: [{ name: "search", description: "Search" }],
        createdAt: "2026-01-01",
      },
      { id: "mcp-2", name: "code-exec", status: "AVAILABLE", tools: [], createdAt: "2026-01-02" },
    ];
    const fetchImpl = createMockFetch([{ status: 200, body: { items: mcpServers, total: 2 } }]);

    const client = new CloudruSimpleClient({ ...BASE_CONFIG, fetchImpl });
    const result = await client.listMcpServers();

    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe("web-search");
    expect(result.total).toBe(2);
  });

  it("omits undefined query values", async () => {
    const fetchImpl = createMockFetch([{ status: 200, body: { items: [], total: 0 } }]);

    const client = new CloudruSimpleClient({ ...BASE_CONFIG, fetchImpl });
    await client.get("/mcpServers", { search: undefined, limit: 20 });

    const [url] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).not.toContain("search");
    expect(url).toContain("limit=20");
  });
});
