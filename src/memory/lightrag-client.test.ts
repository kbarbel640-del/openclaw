import { describe, expect, it, vi } from "vitest";

import {
  LightRAGClient,
  type LightRAGQueryResponse,
  type LightRAGEntity,
  type LightRAGStats,
} from "./lightrag-client.js";

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

describe("LightRAGClient", () => {
  it("health check returns true for successful response", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    const fetchImpl = vi.fn(createFetchFixture({ status: "ok" }));
    globalThis.fetch = fetchImpl;

    const result = await client.health();

    expect(result).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:8001/health",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("health check returns false on error", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    globalThis.fetch = vi.fn(createFailingFetch(500, "Internal Server Error"));

    const result = await client.health();

    expect(result).toBe(false);
  });

  it("query returns answer with sources and entities", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    const mockResponse: LightRAGQueryResponse = {
      answer: "This is the answer from the knowledge base",
      sources: ["source1.md", "source2.md"],
      entities: ["Entity1", "Entity2"],
      confidence: 0.95,
    };

    const fetchImpl = vi.fn(createFetchFixture(mockResponse));
    globalThis.fetch = fetchImpl;

    const result = await client.query({ query: "What is the answer?" });

    expect(result).toEqual(mockResponse);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:8001/query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: expect.stringContaining('"query":"What is the answer?"'),
      }),
    );
  });

  it("query uses default mode hybrid", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    const fetchImpl = vi.fn(createFetchFixture({ answer: "test" }));
    globalThis.fetch = fetchImpl;

    await client.query({ query: "test" });

    const callBody = JSON.parse((fetchImpl.mock.calls[0][1] as any).body);
    expect(callBody.mode).toBe("hybrid");
  });

  it("query respects custom mode parameter", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    const fetchImpl = vi.fn(createFetchFixture({ answer: "test" }));
    globalThis.fetch = fetchImpl;

    await client.query({ query: "test", mode: "local" });

    const callBody = JSON.parse((fetchImpl.mock.calls[0][1] as any).body);
    expect(callBody.mode).toBe("local");
  });

  it("query respects topK parameter", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    const fetchImpl = vi.fn(createFetchFixture({ answer: "test" }));
    globalThis.fetch = fetchImpl;

    await client.query({ query: "test", topK: 10 });

    const callBody = JSON.parse((fetchImpl.mock.calls[0][1] as any).body);
    expect(callBody.top_k).toBe(10);
  });

  it("query throws on non-ok response", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    globalThis.fetch = vi.fn(createFailingFetch(500, "Internal Server Error"));

    await expect(client.query({ query: "test" })).rejects.toThrow(/lightrag query failed: 500/);
  });

  it("getEntities returns list of entities", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    const mockEntities: LightRAGEntity[] = [
      {
        name: "Entity1",
        type: "Person",
        count: 10,
      },
      {
        name: "Entity2",
        type: "Organization",
        count: 5,
      },
    ];

    globalThis.fetch = vi.fn(
      createFetchFixture({
        entities: [
          {
            name: "Entity1",
            type: "Person",
            count: 10,
          },
          {
            name: "Entity2",
            type: "Organization",
            count: 5,
          },
        ],
      }),
    );

    const result = await client.getEntities();

    expect(result).toEqual(mockEntities);
  });

  it("getEntities handles empty response", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    globalThis.fetch = vi.fn(createFetchFixture({}));

    const result = await client.getEntities();

    expect(result).toEqual([]);
  });

  it("getStats returns knowledge base statistics", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    const mockStats: LightRAGStats = {
      totalDocuments: 100,
      totalEntities: 250,
      totalRelationships: 500,
      lastIndexed: "2026-01-31T23:59:59Z",
    };

    globalThis.fetch = vi.fn(
      createFetchFixture({
        total_documents: 100,
        total_entities: 250,
        total_relationships: 500,
        last_indexed: "2026-01-31T23:59:59Z",
      }),
    );

    const result = await client.getStats();

    expect(result).toEqual(mockStats);
  });

  it("getStats handles partial response", async () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001" });
    globalThis.fetch = vi.fn(
      createFetchFixture({
        total_documents: 50,
      }),
    );

    const result = await client.getStats();

    expect(result.totalDocuments).toBe(50);
    expect(result.totalEntities).toBeUndefined();
    expect(result.totalRelationships).toBeUndefined();
    expect(result.lastIndexed).toBeUndefined();
  });

  it("trims trailing slash from endpoint", () => {
    const client = new LightRAGClient({ endpoint: "http://localhost:8001/" });
    expect((client as any).endpoint).toBe("http://localhost:8001");
  });

  it("uses default endpoint if not provided", () => {
    const client = new LightRAGClient();
    expect((client as any).endpoint).toBe("http://localhost:8001");
  });

  it("uses default timeout if not provided", () => {
    const client = new LightRAGClient();
    expect((client as any).timeout).toBe(30_000);
  });
});
