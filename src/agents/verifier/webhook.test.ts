import crypto from "node:crypto";
import http from "node:http";
import { afterAll, describe, expect, it } from "vitest";
import { callWebhookVerifier, redactToolParams } from "./webhook.js";

const TEST_PORT = 19876;

describe("redactToolParams", () => {
  it("redacts content field for write tool", () => {
    const params = { path: "/tmp/secret.txt", content: "super-secret-data" };
    const redacted = redactToolParams("write", params);
    expect(redacted.content).toBe("[REDACTED: 17 chars]");
    expect(redacted.path).toBe("/tmp/secret.txt");
  });

  it("redacts content field for edit tool", () => {
    const params = { path: "/tmp/file.ts", content: "code here" };
    const redacted = redactToolParams("edit", params);
    expect(String(redacted.content)).toContain("REDACTED");
  });

  it("redacts content field for apply_patch tool", () => {
    const params = { path: "/tmp/file.ts", content: "patch data" };
    const redacted = redactToolParams("apply_patch", params);
    expect(String(redacted.content)).toContain("REDACTED");
  });

  it("does not redact exec params", () => {
    const params = { command: "ls -la" };
    const redacted = redactToolParams("exec", params);
    expect(redacted.command).toBe("ls -la");
  });

  it("does not redact read params", () => {
    const params = { path: "/etc/passwd" };
    const redacted = redactToolParams("read", params);
    expect(redacted.path).toBe("/etc/passwd");
  });
});

function createTestServer(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  const server = http.createServer(handler);
  return new Promise<http.Server>((resolve) => {
    server.listen(TEST_PORT, () => resolve(server));
  });
}

function closeServer(server: http.Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

describe("callWebhookVerifier", () => {
  let server: http.Server | null = null;

  afterAll(async () => {
    if (server) {
      await closeServer(server);
    }
  });

  it("returns allow when webhook responds with allow", async () => {
    server = await createTestServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ decision: "allow" }));
    });

    const result = await callWebhookVerifier({
      url: `http://127.0.0.1:${TEST_PORT}/verify`,
      timeout: 5,
      request: {
        version: 1,
        timestamp: new Date().toISOString(),
        requestId: "test-1",
        tool: { name: "exec", params: { command: "ls" } },
        context: { agentId: "main" },
      },
    });

    expect(result.decision).toBe("allow");
    await closeServer(server);
    server = null;
  });

  it("returns deny when webhook responds with deny", async () => {
    server = await createTestServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ decision: "deny", reason: "not allowed" }));
    });

    const result = await callWebhookVerifier({
      url: `http://127.0.0.1:${TEST_PORT}/verify`,
      timeout: 5,
      request: {
        version: 1,
        timestamp: new Date().toISOString(),
        requestId: "test-2",
        tool: { name: "exec", params: { command: "rm -rf /" } },
        context: { agentId: "main" },
      },
    });

    expect(result.decision).toBe("deny");
    expect(result.reason).toBe("not allowed");
    await closeServer(server);
    server = null;
  });

  it("returns error on timeout", async () => {
    server = await createTestServer((_req, _res) => {
      // Never respond
    });

    const result = await callWebhookVerifier({
      url: `http://127.0.0.1:${TEST_PORT}/verify`,
      timeout: 1,
      request: {
        version: 1,
        timestamp: new Date().toISOString(),
        requestId: "test-3",
        tool: { name: "exec", params: {} },
        context: {},
      },
    });

    expect(result.decision).toBe("error");
    await closeServer(server);
    server = null;
  });

  it("includes HMAC signature when secret is configured", async () => {
    let receivedSignature: string | undefined;
    let receivedBody = "";
    const secret = "test-secret-key";

    server = await createTestServer((req, res) => {
      receivedSignature = req.headers["x-openclaw-signature"] as string;
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ decision: "allow" }));
      });
    });

    await callWebhookVerifier({
      url: `http://127.0.0.1:${TEST_PORT}/verify`,
      timeout: 5,
      secret,
      request: {
        version: 1,
        timestamp: new Date().toISOString(),
        requestId: "test-4",
        tool: { name: "exec", params: {} },
        context: {},
      },
    });

    expect(receivedSignature).toBeDefined();
    const expected = crypto.createHmac("sha256", secret).update(receivedBody).digest("hex");
    expect(receivedSignature).toBe(`sha256=${expected}`);
    await closeServer(server);
    server = null;
  });

  it("returns error on non-2xx status", async () => {
    server = await createTestServer((_req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal" }));
    });

    const result = await callWebhookVerifier({
      url: `http://127.0.0.1:${TEST_PORT}/verify`,
      timeout: 5,
      request: {
        version: 1,
        timestamp: new Date().toISOString(),
        requestId: "test-5",
        tool: { name: "exec", params: {} },
        context: {},
      },
    });

    expect(result.decision).toBe("error");
    expect(result.reason).toContain("500");
    await closeServer(server);
    server = null;
  });
});
