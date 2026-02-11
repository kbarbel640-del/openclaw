/**
 * Live integration test for Databricks service principal OAuth token exchange
 * and model invocation via the OpenAI-compatible serving endpoint.
 *
 * Requires real credentials exported in the environment:
 *   export DATABRICKS_CLIENT_ID="your-client-id"
 *   export DATABRICKS_CLIENT_SECRET="your-client-secret"
 *   export DATABRICKS_HOST="https://your-workspace.cloud.databricks.com"
 *
 * Run with:
 *   pnpm test:live -- src/agents/databricks-auth.live.test.ts
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearDatabricksTokenCache,
  exchangeDatabricksServicePrincipalToken,
  resolveDatabricksServicePrincipalEnv,
} from "./databricks-auth.js";

const isLive = process.env.LIVE === "1" || process.env.CLAWDBOT_LIVE_TEST === "1";
const DATABRICKS_TEST_MODEL = "databricks-claude-opus-4-6";

describe.skipIf(!isLive)("Databricks service principal (LIVE)", () => {
  beforeEach(() => {
    clearDatabricksTokenCache();
  });

  afterEach(() => {
    clearDatabricksTokenCache();
  });

  it("resolves service principal config from env", () => {
    const config = resolveDatabricksServicePrincipalEnv();
    expect(config).not.toBeNull();
    expect(config!.clientId).toBeTruthy();
    expect(config!.clientSecret).toBeTruthy();
    expect(config!.workspaceUrl).toMatch(/^https:\/\//);
    console.log(`  Workspace: ${config!.workspaceUrl}`);
    console.log(`  Client ID: ${config!.clientId.slice(0, 8)}...`);
  });

  it("exchanges client credentials for a real access token", async () => {
    const config = resolveDatabricksServicePrincipalEnv();
    expect(config).not.toBeNull();

    const token = await exchangeDatabricksServicePrincipalToken(config!);

    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    console.log(`  Token obtained: ${token.slice(0, 12)}... (${token.length} chars)`);
  });

  it("returns cached token on second call", async () => {
    const config = resolveDatabricksServicePrincipalEnv();
    expect(config).not.toBeNull();

    const token1 = await exchangeDatabricksServicePrincipalToken(config!);
    const token2 = await exchangeDatabricksServicePrincipalToken(config!);

    expect(token1).toBe(token2);
    console.log("  Cache hit confirmed: second call returned same token");
  });

  it("can list serving endpoints with the token", async () => {
    const config = resolveDatabricksServicePrincipalEnv();
    expect(config).not.toBeNull();

    const token = await exchangeDatabricksServicePrincipalToken(config!);

    const response = await fetch(`${config!.workspaceUrl}/api/2.0/serving-endpoints`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    // 200 = success, 403 = token works but SP lacks list permission (still valid auth)
    expect([200, 403]).toContain(response.status);
    console.log(`  Serving endpoints API: ${response.status} ${response.statusText}`);

    if (response.status === 200) {
      const data = (await response.json()) as { endpoints?: Array<{ name: string }> };
      const count = data.endpoints?.length ?? 0;
      console.log(`  Found ${count} serving endpoint(s)`);
      if (data.endpoints && data.endpoints.length > 0) {
        for (const ep of data.endpoints.slice(0, 5)) {
          console.log(`    - ${ep.name}`);
        }
        if (data.endpoints.length > 5) {
          console.log(`    ... and ${data.endpoints.length - 5} more`);
        }
      }
    }
  });

  it(
    "calls databricks-claude-opus-4-6 via OpenAI-compatible chat completions",
    {
      timeout: 60_000,
    },
    async () => {
      const config = resolveDatabricksServicePrincipalEnv();
      expect(config).not.toBeNull();

      const token = await exchangeDatabricksServicePrincipalToken(config!);
      const endpointUrl = `${config!.workspaceUrl}/serving-endpoints/${DATABRICKS_TEST_MODEL}/invocations`;

      console.log(`  Endpoint: ${endpointUrl}`);
      console.log(`  Model: ${DATABRICKS_TEST_MODEL}`);

      const payload = {
        messages: [
          {
            role: "user",
            content: "Reply with exactly: Hello from Databricks",
          },
        ],
        max_tokens: 50,
        temperature: 0,
      };

      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      console.log(`  Response status: ${response.status} ${response.statusText}`);
      expect(response.ok).toBe(true);

      const data = (await response.json()) as {
        id?: string;
        object?: string;
        choices?: Array<{
          message?: { role?: string; content?: string };
          index?: number;
          finish_reason?: string;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      // Validate OpenAI-compatible response structure
      expect(data.choices).toBeDefined();
      expect(data.choices!.length).toBeGreaterThan(0);

      const reply = data.choices![0]?.message?.content ?? "";
      expect(reply.length).toBeGreaterThan(0);
      console.log(`  Model reply: ${reply}`);

      if (data.usage) {
        console.log(
          `  Usage: ${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion = ${data.usage.total_tokens} total tokens`,
        );
      }

      // The response should contain the expected phrase
      expect(reply.toLowerCase()).toContain("hello from databricks");
    },
  );
});
