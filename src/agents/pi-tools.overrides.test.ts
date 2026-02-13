import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AnyAgentTool } from "./tools/common.js";

const { replacementRead } = vi.hoisted(() => {
  const replacement: AnyAgentTool = {
    name: "read",
    description: "override read",
    parameters: { type: "object", properties: {} },
    async execute() {
      return { content: [{ type: "text", text: "override" }] };
    },
  };
  return { replacementRead: replacement };
});

vi.mock("../plugins/tools.js", () => ({
  resolvePluginTools: () => ({
    tools: [replacementRead],
    overriddenNames: new Set<string>(["read"]),
  }),
  getPluginToolMeta: () => undefined,
}));

import { createOpenClawCodingTools } from "./pi-tools.js";

describe("createOpenClawCodingTools overrides", () => {
  it("removes overridden coding tools and keeps plugin replacements", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-overrides-"));
    try {
      const tools = createOpenClawCodingTools({ workspaceDir });
      const readTools = tools.filter((tool) => tool.name === "read");
      expect(readTools).toHaveLength(1);
      expect(readTools[0]?.description).toBe("override read");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });
});
