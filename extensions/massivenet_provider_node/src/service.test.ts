import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { completeNodeJob, executeStubJob, pollNodeJob, resolveJobInput } from "./service.js";

describe("massivenet_provider_node service", () => {
  it("poll request uses Authorization header", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ job: null }), { status: 200 }),
    );

    await pollNodeJob({
      fetchFn: fetchMock as unknown as typeof fetch,
      baseUrl: "https://massivenet.local",
      nodeToken: "node-token-123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer node-token-123");
  });

  it("payload_ref fetch works", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            payload_json: { request: { messages: [{ role: "user", content: "hi" }] } },
          }),
          { status: 200 },
        ),
    );

    const payload = await resolveJobInput({
      fetchFn: fetchMock as unknown as typeof fetch,
      baseUrl: "https://massivenet.local",
      nodeToken: "node-token-123",
      job: {
        id: "job-1",
        kind: "chat",
        payload_ref: "/v1/nodes/jobs/job-1/input",
      },
    });

    expect(payload).toEqual({
      request: { messages: [{ role: "user", content: "hi" }] },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://massivenet.local/v1/nodes/jobs/job-1/input");
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer node-token-123");
  });

  it("stub executor returns expected format", () => {
    expect(executeStubJob("chat")).toEqual({
      result_text: "Stub response from OpenClaw MassiveNet node.",
    });
    expect(executeStubJob("image")).toEqual({
      output_urls: ["https://example.com/stub-output.png"],
    });
  });

  it("completion call sends correct payload structure", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const secret = "test-secret";

    await completeNodeJob({
      fetchFn: fetchMock as unknown as typeof fetch,
      baseUrl: "https://massivenet.local",
      hmacSecret: secret,
      jobId: "job-xyz",
      nodeId: 42,
      success: true,
      result: { result_text: "hello world" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://massivenet.local/internal/jobs/complete");
    const body = String(init.body);
    const parsed = JSON.parse(body) as Record<string, unknown>;
    expect(parsed).toEqual({
      job_id: "job-xyz",
      node_id: 42,
      status: "succeeded",
      metrics: {
        success: true,
      },
      result: {
        result_text: "hello world",
      },
    });

    const expectedSig = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-MassiveNet-Signature"]).toBe(expectedSig);
  });
});
