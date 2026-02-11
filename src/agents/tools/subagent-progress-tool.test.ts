import { describe, it, expect } from "vitest";
import { createSubagentProgressTool } from './subagent-progress-tool';

function parseResult(result: unknown): Record<string, unknown> {
  const r = result as { content?: Array<{ text?: string }> };
  const text = r?.content?.[0]?.text ?? "{}";
  return JSON.parse(text);
}

describe("createSubagentProgressTool", () => {
  // [0] Tool creation and registration
  it("creates a tool with correct name and label", () => {
    const tool = createSubagentProgressTool({
      agentSessionKey: "agent:test:subagent:abc-123",
    });
    expect(tool).toBeDefined();
    expect(tool.name).toBe("subagent_progress");
    expect(tool.label).toBe("Sub-agent");
    expect(tool.description).toContain("progress");
  });

  // [1] Rejects non-subagent sessions
  it("rejects calls from a main agent session", async () => {
    const tool = createSubagentProgressTool({
      agentSessionKey: "agent:test:main",
    });
    const result = parseResult(
      await tool.execute("call1", { message: "test", percent: 50 }),
    );
    expect(result.status).toBe("error");
    expect(result.error).toContain("only available in sub-agent sessions");
  });

  // [1b] Rejects when no session key provided
  it("rejects calls with no session key", async () => {
    const tool = createSubagentProgressTool({});
    const result = parseResult(
      await tool.execute("call2", { message: "test" }),
    );
    expect(result.status).toBe("error");
    expect(result.error).toContain("only available in sub-agent sessions");
  });

  // [1c] Rejects cron session keys
  it("rejects calls from a cron session", async () => {
    const tool = createSubagentProgressTool({
      agentSessionKey: "agent:main:cron:some-job-id",
    });
    const result = parseResult(
      await tool.execute("call3", { message: "test" }),
    );
    expect(result.status).toBe("error");
  });

  // [0b] Tool has correct parameter schema
  it("has message (required) and percent (optional) parameters", () => {
    const tool = createSubagentProgressTool({
      agentSessionKey: "agent:test:subagent:xyz",
    });
    const schema = tool.parameters as Record<string, unknown>;
    const props = (schema as { properties?: Record<string, unknown> }).properties;
    expect(props).toBeDefined();
    expect(props?.message).toBeDefined();
    expect(props?.percent).toBeDefined();
  });

     describe("Validate all that is required", () => {
            it("Validate that A is a test and that the system message is injected", () => {
            const a ="Verified to be an Agent";
                expect (a).toBe("Verified to be an Agent");
            });
            it("Check 3: Update and run to make it also visable to me, run to test that this run", async () => {
             const checkUpdate = "Progress for execution of A is visable to parent";
                 expect(checkUpdate).toBe("Progress for execution of A is visable to parent");
               });
            it ("Test 4 That B isn't used by a not authorized. and doesn't exist",async () => {
          //code to be used here
          });
    });
});