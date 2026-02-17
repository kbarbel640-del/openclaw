import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupOldPerformanceFiles,
  getAgentStats,
  recordAgentPerformance,
} from "./performance-tracker.js";

function readJsonl(filePath: string): Promise<Record<string, unknown>[]> {
  return fs.readFile(filePath, "utf-8").then((content) =>
    content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>),
  );
}

function buildPath(stateDir: string, date: string): string {
  return path.join(stateDir, "data", `agent-performance-${date}.jsonl`);
}

describe("performance tracker", () => {
  let rootDir = "";

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-performance-tracker-"));
    await fs.mkdir(path.join(rootDir, ".openclaw"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  const dataRoot = () => path.join(rootDir, ".openclaw");

  it("appends records and rotates files by date", async () => {
    const dayOne = new Date("2026-02-01T00:00:00.000Z");
    const dayTwo = new Date("2026-02-02T00:00:00.000Z");
    const dayOneTs = dayOne.getTime();
    const dayOnePath1 = await recordAgentPerformance(
      { agentId: "agent-1", inputTokens: 10, outputTokens: 20 },
      { stateDir: dataRoot(), now: dayOne },
    );
    const dayOnePath2 = await recordAgentPerformance(
      { agentId: "agent-1", inputTokens: 5, outputTokens: 3 },
      { stateDir: dataRoot(), now: dayOne },
    );
    const dayTwoPath = await recordAgentPerformance(
      { agentId: "agent-1", inputTokens: 1, outputTokens: 2 },
      { stateDir: dataRoot(), now: dayTwo },
    );

    const expectedDayOne = buildPath(dataRoot(), "2026-02-01");
    const expectedDayTwo = buildPath(dataRoot(), "2026-02-02");

    expect(dayOnePath1).toBe(expectedDayOne);
    expect(dayOnePath2).toBe(expectedDayOne);
    expect(dayTwoPath).toBe(expectedDayTwo);

    const lines = await readJsonl(expectedDayOne);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      runId: `agent-1-${dayOneTs}`,
      agentId: "agent-1",
      spawnerSessionKey: "unknown",
      startedAt: dayOneTs,
      endedAt: dayOneTs,
      runtimeMs: 0,
      outcome: "success",
      tokens: {
        input: 10,
        output: 20,
        total: 30,
      },
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });
    const dayTwoLines = await readJsonl(expectedDayTwo);
    expect(dayTwoLines).toHaveLength(1);
  });

  it("aggregates totals per agent", async () => {
    const now = new Date("2026-02-01T00:00:00.000Z");
    await recordAgentPerformance(
      {
        runId: "run-1",
        agentId: "agent-1",
        spawnerSessionKey: "agent:main:subagent:parent",
        startedAt: new Date("2026-02-01T00:00:00.000Z"),
        endedAt: new Date("2026-02-01T00:00:10.000Z"),
        runtimeMs: 10_000,
        outcome: "success",
        verificationPassed: true,
        completionReport: { status: "complete", confidence: "high" },
        inputTokens: 10,
        outputTokens: 2,
      },
      { stateDir: dataRoot(), now },
    );
    await recordAgentPerformance(
      {
        runId: "run-2",
        agentId: "agent-1",
        spawnerSessionKey: "agent:main:subagent:parent",
        startedAt: new Date("2026-02-01T00:00:10.000Z"),
        endedAt: new Date("2026-02-01T00:00:20.000Z"),
        runtimeMs: 10_000,
        outcome: "partial",
        verificationPassed: false,
        inputTokens: 1,
        outputTokens: 9,
      },
      { stateDir: dataRoot(), now },
    );
    await recordAgentPerformance(
      {
        runId: "run-3",
        agentId: "agent-2",
        spawnerSessionKey: "agent:main:subagent:parent",
        startedAt: new Date("2026-02-01T00:00:00.000Z"),
        endedAt: new Date("2026-02-01T00:00:05.000Z"),
        runtimeMs: 5_000,
        outcome: "timeout",
        inputTokens: 7,
        outputTokens: 3,
      },
      { stateDir: dataRoot(), now },
    );

    const stats = await getAgentStats({ stateDir: dataRoot(), now });

    expect(stats).toMatchObject({
      "agent-1": {
        agentId: "agent-1",
        requestCount: 2,
        inputTokens: 11,
        outputTokens: 11,
        totalTokens: 22,
        averageRuntimeMs: 10000,
        outcomes: {
          success: 1,
          partial: 1,
          failure: 0,
          timeout: 0,
        },
        verification: {
          passed: 1,
          failed: 1,
          unknown: 0,
        },
        completionReports: 1,
      },
      "agent-2": {
        agentId: "agent-2",
        requestCount: 1,
        inputTokens: 7,
        outputTokens: 3,
        totalTokens: 10,
        averageRuntimeMs: 5000,
        outcomes: {
          success: 0,
          partial: 0,
          failure: 0,
          timeout: 1,
        },
        verification: {
          passed: 0,
          failed: 0,
          unknown: 1,
        },
        completionReports: 0,
      },
    });
    expect(stats["agent-1"]?.latestRunAtUtc).toBe("2026-02-01T00:00:20.000Z");
  });

  it("cleans up files older than the retention window", async () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const dataPath = path.join(dataRoot(), "data");
    await fs.mkdir(dataPath, { recursive: true });

    const stale = path.join(dataPath, "agent-performance-2026-01-01.jsonl");
    const keep = path.join(dataPath, "agent-performance-2026-02-20.jsonl");
    await fs.writeFile(
      stale,
      `${JSON.stringify({ agentId: "agent-1", inputTokens: 1, outputTokens: 1 })}\n`,
    );
    await fs.writeFile(
      keep,
      `${JSON.stringify({ agentId: "agent-1", inputTokens: 1, outputTokens: 1 })}\n`,
    );
    await recordAgentPerformance(
      { agentId: "agent-1", inputTokens: 2, outputTokens: 2 },
      { stateDir: dataRoot(), now, retentionDays: 365 },
    );

    const removed = await cleanupOldPerformanceFiles({
      stateDir: dataRoot(),
      now,
      retentionDays: 30,
    });

    expect(removed).toBe(1);
    await expect(fs.stat(stale)).rejects.toThrow();
    const stalePath = await fs.stat(stale).catch(() => null);
    expect(stalePath).toBeNull();
    await expect(fs.stat(keep)).resolves.toBeTruthy();
  });

  it("treats null token counts as zero in aggregates", async () => {
    const now = new Date("2026-02-01T00:00:00.000Z");
    await recordAgentPerformance(
      { agentId: "agent-1", inputTokens: null, outputTokens: 8 },
      { stateDir: dataRoot(), now },
    );
    await recordAgentPerformance(
      { agentId: "agent-1", inputTokens: undefined, outputTokens: null },
      { stateDir: dataRoot(), now },
    );

    const file = buildPath(dataRoot(), "2026-02-01");
    const records = await readJsonl(file);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      inputTokens: null,
      outputTokens: 8,
      tokens: { input: null, output: 8, total: 8 },
    });
    expect(records[1]).toMatchObject({
      inputTokens: null,
      outputTokens: null,
      tokens: { input: null, output: null, total: 0 },
    });

    const stats = await getAgentStats({ stateDir: dataRoot(), now });
    expect(stats["agent-1"]).toMatchObject({
      requestCount: 2,
      inputTokens: 0,
      outputTokens: 8,
      totalTokens: 8,
      averageRuntimeMs: 0,
    });
  });

  it("filters aggregates using record timestamps inside retention window", async () => {
    const now = new Date("2026-02-10T00:00:00.000Z");
    const filePath = buildPath(dataRoot(), "2026-02-10");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      [
        JSON.stringify({
          agentId: "agent-1",
          inputTokens: 10,
          outputTokens: 5,
          endedAt: new Date("2025-12-01T00:00:00.000Z").getTime(),
          outcome: "success",
        }),
        JSON.stringify({
          agentId: "agent-1",
          inputTokens: 3,
          outputTokens: 2,
          endedAt: new Date("2026-02-09T00:00:00.000Z").getTime(),
          outcome: "failure",
        }),
      ].join("\n") + "\n",
    );

    const stats = await getAgentStats({ stateDir: dataRoot(), now, retentionDays: 30 });

    expect(stats["agent-1"]).toMatchObject({
      requestCount: 1,
      inputTokens: 3,
      outputTokens: 2,
      totalTokens: 5,
      outcomes: { success: 0, partial: 0, failure: 1, timeout: 0 },
    });
  });
});
