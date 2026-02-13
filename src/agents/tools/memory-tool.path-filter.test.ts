import { describe, expect, it, vi } from "vitest";

const { searchSpy } = vi.hoisted(() => ({
  searchSpy: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../memory/index.js", () => {
  return {
    getMemorySearchManager: async () => ({
      manager: {
        search: searchSpy,
        readFile: vi.fn(),
        status: () => ({
          backend: "builtin",
          provider: "openai",
          model: "text-embedding-3-small",
          requestedProvider: "openai",
          fallback: undefined,
        }),
      },
    }),
  };
});

import { createMemorySearchTool } from "./memory-tool.js";

describe("memory_search pathFilter", () => {
  it("passes pathFilter through to memory manager search", async () => {
    const cfg = { agents: { list: [{ id: "main", default: true }] } };
    const tool = createMemorySearchTool({ config: cfg });
    expect(tool).not.toBeNull();
    if (!tool) {
      throw new Error("memory_search tool missing");
    }

    await tool.execute("call_1", {
      query: "pricing",
      pathFilter: ["memory/shared/*", "memory/daily/*"],
    });

    expect(searchSpy).toHaveBeenCalledWith("pricing", {
      maxResults: undefined,
      minScore: undefined,
      sessionKey: undefined,
      pathFilter: ["memory/shared/*", "memory/daily/*"],
    });
  });

  it("wildcard pathFilter ['*'] matches all paths", async () => {
    const cfg = { agents: { list: [{ id: "main", default: true }] } };
    const tool = createMemorySearchTool({ config: cfg });
    expect(tool).not.toBeNull();
    if (!tool) {
      throw new Error("memory_search tool missing");
    }

    await tool.execute("call_2", {
      query: "everything",
      pathFilter: ["*"],
    });

    expect(searchSpy).toHaveBeenCalledWith("everything", {
      maxResults: undefined,
      minScore: undefined,
      sessionKey: undefined,
      pathFilter: ["*"],
    });
  });
});
