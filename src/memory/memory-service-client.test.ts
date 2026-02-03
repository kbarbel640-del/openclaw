import { describe, expect, it, vi } from "vitest";

import {
  MemoryServiceClient,
  type MemoryServiceSearchResponse,
  type MemoryServiceEntity,
} from "./memory-service-client.js";

function createFetchFixture(payload: unknown, status = 200): typeof fetch {
  return async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
}

function createFailingFetch(status: number, body: string): typeof fetch {
  return async () =>
    new Response(body, {
      status,
      headers: { "content-type": "text/plain" },
    });
}

describe("MemoryServiceClient", () => {
  it("health check returns true for successful response", async () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002" });
    const fetchImpl = vi.fn(createFetchFixture({ status: "ok" }));
    globalThis.fetch = fetchImpl;

    const result = await client.health();

    expect(result).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:8002/health",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("health check returns false on error", async () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002" });
    globalThis.fetch = vi.fn(createFailingFetch(500, "Internal Server Error"));

    const result = await client.health();

    expect(result).toBe(false);
  });

  it("search returns memories with scores", async () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002" });
    const mockResponse: MemoryServiceSearchResponse = {
      memories: [
        {
          id: "m1",
          content: "Memory content 1",
          score: 0.95,
          metadata: { source: "session1" },
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "m2",
          content: "Memory content 2",
          score: 0.85,
          metadata: { source: "session2" },
          createdAt: "2026-01-02T00:00:00Z",
        },
      ],
      total: 2,
    };

    globalThis.fetch = vi.fn(
      createFetchFixture({
        memories: [
          {
            id: "m1",
            content: "Memory content 1",
            score: 0.95,
            metadata: { source: "session1" },
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "m2",
            content: "Memory content 2",
            score: 0.85,
            metadata: { source: "session2" },
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
        total: 2,
      }),
    );

    const result = await client.search({ query: "test query" });

    expect(result).toEqual(mockResponse);
  });

  it("search includes query parameter", async () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002" });
    const fetchImpl = vi.fn(createFetchFixture({ memories: [] }));
    globalThis.fetch = fetchImpl;

    await client.search({ query: "test query" });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("query=test+query"),
      expect.anything(),
    );
  });

  it("search includes limit parameter", async () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002" });
    const fetchImpl = vi.fn(createFetchFixture({ memories: [] }));
    globalThis.fetch = fetchImpl;

    await client.search({ query: "test", limit: 10 });

    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("limit=10"), expect.anything());
  });

  it("search throws on non-ok response", async () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002" });
    globalThis.fetch = vi.fn(createFailingFetch(500, "Internal Server Error"));

    await expect(client.search({ query: "test" })).rejects.toThrow(
      /memory service search failed: 500/,
    );
  });

  it("search handles empty response", async () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002" });
    globalThis.fetch = vi.fn(createFetchFixture({}));

    const result = await client.search({ query: "test" });

    expect(result.memories).toEqual([]);
    expect(result.total).toBeUndefined();
  });

  it("listEntities returns entities with counts", async () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002" });
    const mockEntities: MemoryServiceEntity[] = [
      {
        name: "Entity1",
        type: "Person",
        count: 15,
        metadata: { verified: true },
      },
      {
        name: "Entity2",
        type: "Project",
        count: 8,
        metadata: { status: "active" },
      },
    ];

    globalThis.fetch = vi.fn(
      createFetchFixture({
        entities: [
          {
            name: "Entity1",
            type: "Person",
            count: 15,
            metadata: { verified: true },
          },
          {
            name: "Entity2",
            type: "Project",
            count: 8,
            metadata: { status: "active" },
          },
        ],
      }),
    );

    const result = await client.listEntities();

    expect(result).toEqual(mockEntities);
  });

  it("listEntities handles empty response", async () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002" });
    globalThis.fetch = vi.fn(createFetchFixture({}));

    const result = await client.listEntities();

    expect(result).toEqual([]);
  });

  it("listEntities throws on non-ok response", async () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002" });
    globalThis.fetch = vi.fn(createFailingFetch(404, "Not Found"));

    await expect(client.listEntities()).rejects.toThrow(/memory service list entities failed: 404/);
  });

  it("trims trailing slash from endpoint", () => {
    const client = new MemoryServiceClient({ endpoint: "http://localhost:8002/" });
    expect((client as any).endpoint).toBe("http://localhost:8002");
  });

  it("uses default endpoint if not provided", () => {
    const client = new MemoryServiceClient();
    expect((client as any).endpoint).toBe("http://localhost:8002");
  });

  it("uses default timeout if not provided", () => {
    const client = new MemoryServiceClient();
    expect((client as any).timeout).toBe(30_000);
  });

  it("uses custom timeout if provided", () => {
    const client = new MemoryServiceClient({ timeout: 60_000 });
    expect((client as any).timeout).toBe(60_000);
  });
});
