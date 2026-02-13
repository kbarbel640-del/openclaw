/**
 * Integration test scaffolding: HTTP client against mock homeserver.
 *
 * Demonstrates how to wire up the mock homeserver with the real
 * matrixFetch/initHttpClient for end-to-end request testing.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initHttpClient, matrixFetch, MatrixApiError } from "../../src/client/http.js";
import { MockHomeserver } from "./mock-homeserver.js";

describe("integration: HTTP client with mock homeserver", () => {
  const server = new MockHomeserver({ accessToken: "test-token-123" });

  beforeAll(async () => {
    await server.start();
    initHttpClient(server.url, "test-token-123");
  });

  afterAll(async () => {
    await server.stop();
  });

  it("should fetch /sync successfully", async () => {
    server.syncResponse = {
      next_batch: "s42",
      rooms: { join: {}, invite: {}, leave: {} },
    };

    const result = await matrixFetch<{ next_batch: string }>(
      "GET",
      "/_matrix/client/v3/sync",
      undefined,
      { skipRateLimit: true },
    );
    expect(result.next_batch).toBe("s42");
  });

  it("should send events via PUT", async () => {
    server.sentEvents = [];
    const roomId = "!test:mock.server";
    const txnId = "txn_test_1";

    await matrixFetch(
      "PUT",
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
      { msgtype: "m.text", body: "Hello from test" },
      { skipRateLimit: true },
    );

    expect(server.sentEvents.length).toBe(1);
    expect(server.sentEvents[0].roomId).toBe(roomId);
    expect(server.sentEvents[0].eventType).toBe("m.room.message");
    expect(server.sentEvents[0].body).toEqual({ msgtype: "m.text", body: "Hello from test" });
  });

  it("should resolve room aliases via directory API", async () => {
    server.aliasMap.set("#test:mock.server", "!resolved:mock.server");

    const result = await matrixFetch<{ room_id: string }>(
      "GET",
      `/_matrix/client/v3/directory/room/${encodeURIComponent("#test:mock.server")}`,
      undefined,
      { skipRateLimit: true },
    );
    expect(result.room_id).toBe("!resolved:mock.server");
  });

  it("should handle 404 as MatrixApiError", async () => {
    await expect(() =>
      matrixFetch("GET", "/_matrix/client/v3/directory/room/%23nonexistent:x", undefined, {
        skipRateLimit: true,
      }),
    ).rejects.toThrow(MatrixApiError);

    // Also verify the error details
    try {
      await matrixFetch("GET", "/_matrix/client/v3/directory/room/%23nonexistent:x", undefined, {
        skipRateLimit: true,
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(MatrixApiError);
      expect((err as MatrixApiError).statusCode).toBe(404);
      expect((err as MatrixApiError).errcode).toBe("M_NOT_FOUND");
    }
  });

  it("should handle auth failure", async () => {
    // Temporarily use wrong token
    initHttpClient(server.url, "wrong-token");

    await expect(() =>
      matrixFetch("GET", "/_matrix/client/v3/sync", undefined, { skipRateLimit: true }),
    ).rejects.toThrow(MatrixApiError);

    try {
      await matrixFetch("GET", "/_matrix/client/v3/sync", undefined, { skipRateLimit: true });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(MatrixApiError);
      expect((err as MatrixApiError).statusCode).toBe(401);
    }

    // Restore correct token
    initHttpClient(server.url, "test-token-123");
  });

  it("should fetch m.direct account data", async () => {
    server.mDirectData = {
      "@friend:mock.server": ["!dm-room:mock.server"],
    };

    const result = await matrixFetch<Record<string, string[]>>(
      "GET",
      `/_matrix/client/v3/user/${encodeURIComponent("@bot:mock.server")}/account_data/m.direct`,
      undefined,
      { skipRateLimit: true },
    );
    expect(result["@friend:mock.server"]).toEqual(["!dm-room:mock.server"]);
  });

  it("should upload media", async () => {
    const result = await matrixFetch<{ content_uri: string }>(
      "POST",
      "/_matrix/media/v3/upload?filename=test.txt",
      undefined, // body would be binary in real usage
      { skipRateLimit: true },
    );
    expect(result.content_uri.startsWith("mxc://")).toBeTruthy();
  });

  it("should handle key upload", async () => {
    const result = await matrixFetch<{ one_time_key_counts: Record<string, number> }>(
      "POST",
      "/_matrix/client/v3/keys/upload",
      { device_keys: {}, one_time_keys: {} },
      { skipRateLimit: true },
    );
    expect(result.one_time_key_counts).toBeTruthy();
  });
});
