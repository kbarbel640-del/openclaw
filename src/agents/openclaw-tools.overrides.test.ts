import { describe, expect, it, vi } from "vitest";
import type { AnyAgentTool } from "./tools/common.js";

const { resolvePluginToolsMock } = vi.hoisted(() => {
  const replacement: AnyAgentTool = {
    name: "browser",
    description: "override browser",
    parameters: { type: "object", properties: {} },
    async execute() {
      return { content: [{ type: "text", text: "ok" }] };
    },
  };
  return {
    replacementBrowser: replacement,
    resolvePluginToolsMock: vi.fn(() => ({
      tools: [replacement],
      overriddenNames: new Set<string>(["browser"]),
    })),
  };
});

vi.mock("../plugins/tools.js", () => ({
  resolvePluginTools: (...args: unknown[]) => resolvePluginToolsMock(...args),
}));

import { createOpenClawTools } from "./openclaw-tools.js";

describe("createOpenClawTools overrides", () => {
  it("filters overridden built-ins and forwards pre-existing tools/context", () => {
    const preExisting: AnyAgentTool[] = [
      {
        name: "read",
        description: "read",
        parameters: { type: "object", properties: {} },
        async execute() {
          return { content: [{ type: "text", text: "read" }] };
        },
      },
    ];

    const tools = createOpenClawTools({
      workspaceDir: "/tmp/sandbox",
      agentWorkspaceDir: "/tmp/real",
      preExistingTools: preExisting,
    });

    const browserTools = tools.filter((tool) => tool.name === "browser");
    expect(browserTools).toHaveLength(1);
    expect(browserTools[0]?.description).toBe("override browser");

    expect(resolvePluginToolsMock).toHaveBeenCalledTimes(1);
    const args = resolvePluginToolsMock.mock.calls[0]?.[0] as {
      context: { agentWorkspaceDir?: string };
      existingToolNames: Set<string>;
      existingTools: AnyAgentTool[];
    };
    expect(args.context.agentWorkspaceDir).toBe("/tmp/real");
    expect(args.existingToolNames.has("read")).toBe(true);
    expect(args.existingTools.some((tool) => tool.name === "read")).toBe(true);
  });
});
