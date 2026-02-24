import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import { toToolDefinitions } from "./pi-tool-definition-adapter.js";

type ToolExecute = ReturnType<typeof toToolDefinitions>[number]["execute"];
const extensionContext = {} as Parameters<ToolExecute>[4];

async function executeThrowingTool(name: string, callId: string) {
  const tool = {
    name,
    label: name === "bash" ? "Bash" : "Boom",
    description: "throws",
    parameters: Type.Object({}),
    execute: async () => {
      throw new Error("nope");
    },
  } satisfies AgentTool;

  const defs = toToolDefinitions([tool]);
  const def = defs[0];
  if (!def) {
    throw new Error("missing tool definition");
  }
  return await def.execute(callId, {}, undefined, undefined, extensionContext);
}

function makeSimpleTool(name: string): AgentTool {
  return {
    name,
    label: name,
    description: "a test tool",
    parameters: Type.Object({}),
    execute: async () => ({ content: [], details: {} }) as ReturnType<AgentTool["execute"]>,
  } satisfies AgentTool;
}

describe("pi tool definition adapter", () => {
  it("sanitizes tool names with special characters for API compatibility", () => {
    const tools = [
      makeSimpleTool("my.tool"),
      makeSimpleTool("tool name"),
      makeSimpleTool("tool:call"),
    ].map((t) => toToolDefinitions([t])[0]);

    expect(tools[0].name).toBe("my_tool");
    expect(tools[1].name).toBe("tool_name");
    expect(tools[2].name).toBe("tool_call");
  });

  it("leaves already-valid tool names unchanged", () => {
    const defs = toToolDefinitions([makeSimpleTool("web_search")]);
    expect(defs[0].name).toBe("web_search");
  });

  it("wraps tool errors into a tool result", async () => {
    const result = await executeThrowingTool("boom", "call1");

    expect(result.details).toMatchObject({
      status: "error",
      tool: "boom",
    });
    expect(result.details).toMatchObject({ error: "nope" });
    expect(JSON.stringify(result.details)).not.toContain("\n    at ");
  });

  it("normalizes exec tool aliases in error results", async () => {
    const result = await executeThrowingTool("bash", "call2");

    expect(result.details).toMatchObject({
      status: "error",
      tool: "exec",
      error: "nope",
    });
  });
});
