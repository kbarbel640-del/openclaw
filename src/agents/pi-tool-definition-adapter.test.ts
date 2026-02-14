import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { toToolDefinitions } from "./pi-tool-definition-adapter.js";

type TimedAgentToolResult = AgentToolResult<unknown> & {
  durationMs?: number;
  metadata?: {
    durationMs?: number;
  };
};

describe("pi tool definition adapter", () => {
  it("wraps tool errors into a tool result", async () => {
    const tool = {
      name: "boom",
      label: "Boom",
      description: "throws",
      parameters: {},
      execute: async () => {
        throw new Error("nope");
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = await defs[0].execute("call1", {}, undefined, undefined);

    expect(result.details).toMatchObject({
      status: "error",
      tool: "boom",
    });
    expect(result.details).toMatchObject({ error: "nope" });
    expect(JSON.stringify(result.details)).not.toContain("\n    at ");
  });

  it("normalizes exec tool aliases in error results", async () => {
    const tool = {
      name: "bash",
      label: "Bash",
      description: "throws",
      parameters: {},
      execute: async () => {
        throw new Error("nope");
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = await defs[0].execute("call2", {}, undefined, undefined);

    expect(result.details).toMatchObject({
      status: "error",
      tool: "exec",
      error: "nope",
    });
  });

  it("records durationMs at both root and metadata for successful execution", async () => {
    const tool = {
      name: "ok",
      label: "Ok",
      description: "works",
      parameters: {},
      execute: async () => {
        return { content: [{ type: "text", text: "done" }] };
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = (await defs[0].execute(
      "call3",
      {},
      undefined,
      undefined,
    )) as TimedAgentToolResult;

    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata).toBeDefined();
    expect(typeof result.metadata?.durationMs).toBe("number");
    expect(result.metadata?.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata?.durationMs).toBe(result.durationMs);
  });

  it("records duration fields consistently for failed execution", async () => {
    const tool = {
      name: "fail",
      label: "Fail",
      description: "fails",
      parameters: {},
      execute: async () => {
        throw new Error("unlucky");
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = (await defs[0].execute(
      "call4",
      {},
      undefined,
      undefined,
    )) as TimedAgentToolResult;

    expect(result.details).toMatchObject({
      status: "error",
      durationMs: expect.any(Number),
      metadata: {
        durationMs: expect.any(Number),
      },
    });
    expect(typeof result.durationMs).toBe("number");
    expect(typeof result.metadata?.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata?.durationMs).toBe(result.durationMs);
    expect((result.details as { durationMs?: number }).durationMs).toBe(result.durationMs);
    expect((result.details as { metadata?: { durationMs?: number } }).metadata?.durationMs).toBe(
      result.durationMs,
    );
  });

  it("mirrors existing root durationMs into metadata", async () => {
    const tool = {
      name: "preTimed",
      label: "PreTimed",
      description: "already timed",
      parameters: {},
      execute: async () => {
        return {
          content: [{ type: "text", text: "done" }],
          durationMs: 123,
        } as unknown as AgentToolResult<unknown>;
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = (await defs[0].execute(
      "call5",
      {},
      undefined,
      undefined,
    )) as TimedAgentToolResult;

    expect(result.durationMs).toBe(123);
    expect(result.metadata?.durationMs).toBe(123);
  });
});
