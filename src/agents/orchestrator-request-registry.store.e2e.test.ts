import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OrchestratorRequestRecord } from "./orchestrator-request-registry.store.js";
import {
  loadOrchestratorRegistryFromDisk,
  resolveOrchestratorRegistryPath,
  saveOrchestratorRegistryToDisk,
} from "./orchestrator-request-registry.store.js";

describe("orchestrator request registry store", () => {
  const previousStateDir = process.env.OPENCLAW_STATE_DIR;
  let tempStateDir: string | null = null;

  afterEach(async () => {
    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
      tempStateDir = null;
    }
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
  });

  it("persists requests to disk and loads on restart", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-orch-req-"));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;

    const requests = new Map<string, OrchestratorRequestRecord>([
      [
        "req-1",
        {
          requestId: "req-1",
          childSessionKey: "agent:main:orchestrator:child-1",
          parentSessionKey: "agent:main:main",
          runId: "run-1",
          message: "do the thing",
          context: '{"task": "test"}',
          priority: "normal",
          status: "pending",
          createdAt: 1000,
          timeoutAt: 2000,
        },
      ],
    ]);

    saveOrchestratorRegistryToDisk(requests);

    // Read raw file to verify structure
    const registryPath = path.join(tempStateDir, "orchestrator-requests", "requests.json");
    const raw = await fs.readFile(registryPath, "utf8");
    const parsed = JSON.parse(raw) as { version: number; requests?: Record<string, unknown> };
    expect(parsed.version).toBe(1);
    expect(parsed.requests && Object.keys(parsed.requests)).toContain("req-1");

    // Simulate restart - load fresh from disk
    const loaded = loadOrchestratorRegistryFromDisk();
    expect(loaded.size).toBe(1);
    const loadedReq = loaded.get("req-1");
    expect(loadedReq?.requestId).toBe("req-1");
    expect(loadedReq?.childSessionKey).toBe("agent:main:orchestrator:child-1");
    expect(loadedReq?.message).toBe("do the thing");
  });

  it("handles version migration (unknown version returns empty map)", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-orch-req-"));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;

    // Write a file with unknown version (e.g., version 99)
    const registryPath = path.join(tempStateDir, "orchestrator-requests", "requests.json");
    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await fs.writeFile(
      registryPath,
      JSON.stringify({ version: 99, requests: { "req-1": { requestId: "req-1" } } }) + "\n",
    );

    // Should return empty map for unknown version
    const loaded = loadOrchestratorRegistryFromDisk();
    expect(loaded.size).toBe(0);
  });

  it("handles missing state directory gracefully (loadJsonFile returns undefined)", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-orch-req-"));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;

    // Don't create any files - state dir exists but no registry
    const loaded = loadOrchestratorRegistryFromDisk();
    expect(loaded.size).toBe(0);
  });

  it("handles corrupt JSON gracefully", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-orch-req-"));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;

    // Write corrupt JSON
    const registryPath = path.join(tempStateDir, "orchestrator-requests", "requests.json");
    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await fs.writeFile(registryPath, "this is not json{");

    // Should return empty map for corrupt JSON
    const loaded = loadOrchestratorRegistryFromDisk();
    expect(loaded.size).toBe(0);
  });

  it("resolves correct path in state dir", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-orch-req-"));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;

    const resolvedPath = resolveOrchestratorRegistryPath();
    expect(resolvedPath).toBe(path.join(tempStateDir, "orchestrator-requests", "requests.json"));
  });

  it("round-trips all fields accurately", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-orch-req-"));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;

    const fullRecord: OrchestratorRequestRecord = {
      requestId: "req-full",
      childSessionKey: "agent:main:orchestrator:child-full",
      parentSessionKey: "agent:main:main",
      runId: "run-full",
      message: "full test request",
      context: '{"key": "value", "nested": {"a": 1}}',
      priority: "high",
      status: "notified",
      createdAt: 1000,
      notifiedAt: 1500,
      timeoutAt: 3000,
      resolvedAt: 2500,
      resolvedBySessionKey: "agent:main:subagent:resolver",
      response: "completed successfully",
      error: undefined,
    };

    const requests = new Map<string, OrchestratorRequestRecord>([["req-full", fullRecord]]);
    saveOrchestratorRegistryToDisk(requests);

    const loaded = loadOrchestratorRegistryFromDisk();
    expect(loaded.size).toBe(1);

    const loadedReq = loaded.get("req-full")!;

    // All fields should match exactly
    expect(loadedReq.requestId).toBe(fullRecord.requestId);
    expect(loadedReq.childSessionKey).toBe(fullRecord.childSessionKey);
    expect(loadedReq.parentSessionKey).toBe(fullRecord.parentSessionKey);
    expect(loadedReq.runId).toBe(fullRecord.runId);
    expect(loadedReq.message).toBe(fullRecord.message);
    expect(loadedReq.context).toBe(fullRecord.context);
    expect(loadedReq.priority).toBe(fullRecord.priority);
    expect(loadedReq.status).toBe(fullRecord.status);
    expect(loadedReq.createdAt).toBe(fullRecord.createdAt);
    expect(loadedReq.notifiedAt).toBe(fullRecord.notifiedAt);
    expect(loadedReq.timeoutAt).toBe(fullRecord.timeoutAt);
    expect(loadedReq.resolvedAt).toBe(fullRecord.resolvedAt);
    expect(loadedReq.resolvedBySessionKey).toBe(fullRecord.resolvedBySessionKey);
    expect(loadedReq.response).toBe(fullRecord.response);
    expect(loadedReq.error).toBe(fullRecord.error);
  });
});
