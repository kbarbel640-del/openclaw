import { describe, it, expect } from "vitest";
import { validatePluginManifest } from "./manifest-schema.js";

describe("PluginManifestSchema", () => {
  it("should validate a minimal manifest", () => {
    const result = validatePluginManifest({
      id: "my-plugin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.manifest.id).toBe("my-plugin");
  });

  it("should validate a full manifest with all new fields", () => {
    const raw = {
      id: "my-extension",
      name: "My Extension",
      description: "Custom extension",
      version: "1.0.0",
      configSchema: { type: "object", properties: {} },
      channels: ["telegram"],
      providers: ["anthropic"],
      skills: ["./skills"],
      commands: "./commands",
      agents: "./agents",
      hooks: "./hooks",
      mcpServers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
        },
        github: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
        },
      },
    };

    const result = validatePluginManifest(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.manifest.commands).toBe("./commands");
    expect(result.manifest.agents).toBe("./agents");
    expect(result.manifest.hooks).toBe("./hooks");
    expect(result.manifest.mcpServers).toBeDefined();
    expect(result.manifest.mcpServers?.filesystem.command).toBe("npx");
    expect(result.manifest.mcpServers?.github.env?.GITHUB_TOKEN).toBe("${GITHUB_TOKEN}");
  });

  it("should reject manifest without id", () => {
    const result = validatePluginManifest({
      name: "No ID Plugin",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("id");
  });

  it("should reject manifest with empty id", () => {
    const result = validatePluginManifest({
      id: "",
    });
    expect(result.ok).toBe(false);
  });

  it("should accept manifest without configSchema (now optional)", () => {
    const result = validatePluginManifest({
      id: "test",
    });
    expect(result.ok).toBe(true);
  });

  it("should validate MCP server config", () => {
    const result = validatePluginManifest({
      id: "test",
      mcpServers: {
        echo: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-echo"],
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.manifest.mcpServers?.echo.command).toBe("npx");
  });

  it("should reject MCP server without command", () => {
    const result = validatePluginManifest({
      id: "test",
      mcpServers: {
        broken: {
          args: ["something"],
        },
      },
    });
    expect(result.ok).toBe(false);
  });

  it("should handle backward-compatible manifests with existing fields only", () => {
    const result = validatePluginManifest({
      id: "telegram",
      name: "Telegram",
      description: "Telegram channel plugin",
      version: "2026.2.2",
      kind: "memory",
      configSchema: { type: "object" },
      channels: ["telegram"],
      providers: [],
      skills: ["./skills"],
      uiHints: { token: { type: "password" } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.manifest.channels).toEqual(["telegram"]);
    expect(result.manifest.commands).toBeUndefined();
    expect(result.manifest.mcpServers).toBeUndefined();
  });
});
