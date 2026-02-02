import { describe, expect, it } from "vitest";
import { resolveEffectiveMcpServers } from "./resolve.js";

describe("resolveEffectiveMcpServers", () => {
  it("merges root mcpServers with per-agent overrides and normalizes keys", () => {
    const cfg: any = {
      mcpServers: {
        Filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "./"],
        },
      },
      agents: {
        list: [
          {
            id: "work",
            mcpServers: {
              github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
            },
          },
        ],
      },
    };

    const merged = resolveEffectiveMcpServers({ config: cfg, agentId: "work" });
    expect(Object.keys(merged).sort()).toEqual(["filesystem", "github"]);
    expect((merged.filesystem as any).command).toBe("npx");
    expect((merged.github as any).command).toBe("npx");
  });

  it("allows per-agent overrides to disable globally defined servers", () => {
    const cfg: any = {
      mcpServers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "./"],
        },
      },
      agents: {
        list: [
          {
            id: "main",
            mcpServers: {
              filesystem: { enabled: false, command: "npx", args: [] },
            },
          },
        ],
      },
    };

    const merged = resolveEffectiveMcpServers({ config: cfg, agentId: "main" });
    expect((merged.filesystem as any).enabled).toBe(false);
  });
});
