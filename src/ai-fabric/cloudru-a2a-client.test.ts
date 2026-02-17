import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudruA2AClient, A2AError } from "./cloudru-a2a-client.js";

// Mock the auth module to avoid real IAM calls
vi.mock("./cloudru-auth.js", () => {
  class MockCloudruTokenProvider {
    async getToken() {
      return { token: "test-iam-token", expiresAt: Date.now() + 3600_000 };
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

function mockFetch(response: { status: number; body?: unknown }): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    json: () => Promise.resolve(response.body),
    text: () => Promise.resolve(JSON.stringify(response.body ?? {})),
    headers: new Headers(),
  });
}

const AUTH_CONFIG = { keyId: "test-key-id", secret: "test-secret" };
const AGENT_ENDPOINT = "https://agent.cloudru.test/a2a";

describe("CloudruA2AClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends message and returns agent response text", async () => {
    const fetchImpl = mockFetch({
      status: 200,
      body: {
        result: {
          id: "task-1",
          sessionId: "sess-1",
          status: {
            state: "completed",
            message: {
              role: "agent",
              parts: [{ type: "text", text: "Hello from the agent!" }],
            },
          },
        },
      },
    });

    const client = new CloudruA2AClient({
      auth: AUTH_CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.sendMessage({
      endpoint: AGENT_ENDPOINT,
      message: "Hello agent",
    });

    expect(result.ok).toBe(true);
    expect(result.text).toBe("Hello from the agent!");
    expect(result.taskId).toBe("task-1");
    expect(result.sessionId).toBe("sess-1");

    // Verify the request
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(AGENT_ENDPOINT);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-iam-token");

    const body = JSON.parse(init.body as string);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("tasks/send");
    expect(body.params.message.parts[0].text).toBe("Hello agent");
  });

  it("includes sessionId for multi-turn conversations", async () => {
    const fetchImpl = mockFetch({
      status: 200,
      body: {
        result: {
          id: "task-2",
          sessionId: "existing-session",
          status: {
            state: "completed",
            message: { role: "agent", parts: [{ text: "Follow-up" }] },
          },
        },
      },
    });

    const client = new CloudruA2AClient({
      auth: AUTH_CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.sendMessage({
      endpoint: AGENT_ENDPOINT,
      message: "Continue",
      sessionId: "existing-session",
    });

    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.params.sessionId).toBe("existing-session");
  });

  it("extracts text from artifacts when status message is empty", async () => {
    const fetchImpl = mockFetch({
      status: 200,
      body: {
        result: {
          id: "task-3",
          status: { state: "completed" },
          artifacts: [
            {
              name: "response",
              parts: [{ text: "Artifact text 1" }, { text: "Artifact text 2" }],
            },
          ],
        },
      },
    });

    const client = new CloudruA2AClient({
      auth: AUTH_CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.sendMessage({
      endpoint: AGENT_ENDPOINT,
      message: "Query",
    });

    expect(result.text).toBe("Artifact text 1\nArtifact text 2");
  });

  it("throws A2AError on HTTP error", async () => {
    const fetchImpl = mockFetch({
      status: 500,
      body: { error: "internal server error" },
    });

    const client = new CloudruA2AClient({
      auth: AUTH_CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.sendMessage({ endpoint: AGENT_ENDPOINT, message: "fail" })).rejects.toThrow(
      A2AError,
    );
  });

  it("throws A2AError on JSON-RPC error response", async () => {
    const fetchImpl = mockFetch({
      status: 200,
      body: {
        error: { code: -32601, message: "Method not found" },
      },
    });

    const client = new CloudruA2AClient({
      auth: AUTH_CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    try {
      await client.sendMessage({ endpoint: AGENT_ENDPOINT, message: "test" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(A2AError);
      expect((err as A2AError).message).toContain("Method not found");
      expect((err as A2AError).code).toBe("-32601");
    }
  });

  it("returns helpful message when agent fails with no text", async () => {
    const fetchImpl = mockFetch({
      status: 200,
      body: {
        result: {
          id: "task-failed",
          status: { state: "failed" },
        },
      },
    });

    const client = new CloudruA2AClient({
      auth: AUTH_CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.sendMessage({
      endpoint: AGENT_ENDPOINT,
      message: "test",
    });

    expect(result.ok).toBe(true);
    expect(result.text).toContain("error");
  });

  it("returns message when agent completes with no text", async () => {
    const fetchImpl = mockFetch({
      status: 200,
      body: {
        result: {
          id: "task-empty",
          status: { state: "completed" },
        },
      },
    });

    const client = new CloudruA2AClient({
      auth: AUTH_CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.sendMessage({
      endpoint: AGENT_ENDPOINT,
      message: "test",
    });

    expect(result.text).toContain("no text response");
  });
});
