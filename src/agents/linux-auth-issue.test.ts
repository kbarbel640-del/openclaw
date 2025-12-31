#!/usr/bin/env node

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { discoverAuthStorage } from "@mariozechner/pi-coding-agent";
import { getEnvApiKey } from "@mariozechner/pi-ai";
import fs from "fs";
import os from "os";
import path from "path";

describe("Linux Authentication Issue", () => {
  const testAgentDir = path.join(os.tmpdir(), "test-clawdis-agent-" + Date.now());
  const authFilePath = path.join(testAgentDir, "auth.json");
  const testApiKey = "test-key-469c4a87d685405e982debcbcd814eac.O6fldQP7ES3zKxYE";

  beforeAll(() => {
    // Create test auth.json file
    fs.mkdirSync(testAgentDir, { recursive: true });
    fs.writeFileSync(
      authFilePath,
      JSON.stringify({
        anthropic: {
          type: "api_key",
          key: testApiKey,
        },
      }, null, 2),
    );
  });

  afterAll(() => {
    // Cleanup
    fs.rmSync(testAgentDir, { recursive: true, force: true });
  });

  it("should retrieve API key from auth.json file on Linux", async () => {
    // Test 1: Direct auth storage lookup
    const authStorage = discoverAuthStorage(testAgentDir);
    const storedKey = await authStorage.getApiKey("anthropic");

    expect(storedKey).toBeDefined();
    expect(storedKey).toBe(testApiKey);
  });

  it("should retrieve API key from environment variables", async () => {
    // Set env var for this test
    process.env.ANTHROPIC_API_KEY = testApiKey;

    const envKey = getEnvApiKey("anthropic");
    expect(envKey).toBeDefined();
    expect(envKey).toBe(testApiKey);

    // Cleanup
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("should handle credential object format correctly", async () => {
    const authStorage = discoverAuthStorage(testAgentDir);
    const credential = authStorage.get("anthropic");

    expect(credential).toBeDefined();
    expect(credential?.type).toBe("api_key");
    expect((credential as any).key).toBe(testApiKey);
  });

  it("should return null when no key found for nonexistent provider", async () => {
    const authStorage = discoverAuthStorage(testAgentDir);

    // Try a provider that doesn't exist
    const result = await authStorage.getApiKey("nonexistent");
    expect(result).toBeNull();
  });
});
