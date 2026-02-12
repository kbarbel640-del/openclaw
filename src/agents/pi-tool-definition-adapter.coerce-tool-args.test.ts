import { describe, expect, it, vi } from "vitest";

// We test the coercion indirectly through toToolDefinitions since
// coerceToolArgs is not exported.  The key assertion is that a tool
// whose execute() receives `args` as a JSON *string* still runs
// correctly after the adapter coerces them.

vi.mock("../logger.js", () => ({
  logDebug: () => {},
  logError: () => {},
  logWarn: () => {},
}));

vi.mock("./tool-policy.js", () => ({
  normalizeToolName: (name: string) => name,
}));

vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: () => null,
}));

import { toToolDefinitions } from "./pi-tool-definition-adapter.js";

describe("toToolDefinitions – argument coercion", () => {
  function makeTool(name: string) {
    const executeFn = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      details: {},
    });
    return {
      name,
      label: name,
      description: "test tool",
      parameters: { type: "object", properties: {} },
      execute: executeFn,
      _executeFn: executeFn,
    };
  }

  it("passes object args through unchanged", async () => {
    const tool = makeTool("my_tool");
    const [def] = toToolDefinitions([tool]);
    const args = { foo: "bar" };
    await def.execute("call-1", args, undefined, undefined, undefined);
    expect(tool._executeFn).toHaveBeenCalledWith("call-1", args, undefined, undefined);
  });

  it("coerces a JSON string to an object", async () => {
    const tool = makeTool("my_tool");
    const [def] = toToolDefinitions([tool]);
    await def.execute("call-2", '{"kinds":["main"]}' as unknown, undefined, undefined, undefined);
    expect(tool._executeFn).toHaveBeenCalledWith(
      "call-2",
      { kinds: ["main"] },
      undefined,
      undefined,
    );
  });

  it("coerces an empty JSON string '{}' to an empty object", async () => {
    const tool = makeTool("sessions_list");
    const [def] = toToolDefinitions([tool]);
    await def.execute("call-3", "{}" as unknown, undefined, undefined, undefined);
    expect(tool._executeFn).toHaveBeenCalledWith("call-3", {}, undefined, undefined);
  });

  it("leaves a non-JSON string as-is (no crash)", async () => {
    const tool = makeTool("my_tool");
    const [def] = toToolDefinitions([tool]);
    await def.execute("call-4", "not-json" as unknown, undefined, undefined, undefined);
    expect(tool._executeFn).toHaveBeenCalledWith("call-4", "not-json", undefined, undefined);
  });

  it("passes undefined/null args through unchanged", async () => {
    const tool = makeTool("my_tool");
    const [def] = toToolDefinitions([tool]);
    await def.execute("call-5", undefined, undefined, undefined, undefined);
    expect(tool._executeFn).toHaveBeenCalledWith("call-5", undefined, undefined, undefined);
  });
});
