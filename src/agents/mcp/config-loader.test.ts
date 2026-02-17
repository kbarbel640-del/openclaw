import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadMergedMcpConfig } from "./config-loader.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-loader-test-"));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeJson(dir: string, filename: string, data: unknown): void {
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(data));
}

describe("loadMergedMcpConfig", () => {
  let tmpDir: string;
  let fakeHome: string;
  let _originalHomedir: typeof os.homedir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    fakeHome = makeTmpDir();
    _originalHomedir = os.homedir;
    // Override os.homedir to point to our fake home
    vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
  });

  afterEach(() => {
    cleanup(tmpDir);
    cleanup(fakeHome);
    vi.restoreAllMocks();
  });

  it("should return empty config when no files exist", async () => {
    const config = await loadMergedMcpConfig(tmpDir);
    expect(config.servers).toEqual({});
  });

  it("should load global config from ~/.openclaw/mcp.json", async () => {
    const openclawDir = path.join(fakeHome, ".openclaw");
    fs.mkdirSync(openclawDir, { recursive: true });
    writeJson(openclawDir, "mcp.json", {
      servers: {
        github: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
        },
      },
    });

    const config = await loadMergedMcpConfig(tmpDir);
    expect(config.servers.github).toBeDefined();
    expect(config.servers.github.command).toBe("npx");
  });

  it("should load local .mcp.json from cwd", async () => {
    writeJson(tmpDir, ".mcp.json", {
      servers: {
        filesystem: {
          command: "echo",
          args: ["hello"],
        },
      },
    });

    const config = await loadMergedMcpConfig(tmpDir);
    expect(config.servers.filesystem).toBeDefined();
    expect(config.servers.filesystem.command).toBe("echo");
  });

  it("should load local mcp.json from cwd", async () => {
    writeJson(tmpDir, "mcp.json", {
      servers: {
        test: { command: "test-cmd" },
      },
    });

    const config = await loadMergedMcpConfig(tmpDir);
    expect(config.servers.test).toBeDefined();
  });

  it("should prefer .mcp.json over mcp.json in cwd", async () => {
    writeJson(tmpDir, ".mcp.json", {
      servers: { s: { command: "from-dotfile" } },
    });
    writeJson(tmpDir, "mcp.json", {
      servers: { s: { command: "from-plain" } },
    });

    const config = await loadMergedMcpConfig(tmpDir);
    expect(config.servers.s.command).toBe("from-dotfile");
  });

  it("should merge global and local configs (local overrides)", async () => {
    const openclawDir = path.join(fakeHome, ".openclaw");
    fs.mkdirSync(openclawDir, { recursive: true });
    writeJson(openclawDir, "mcp.json", {
      servers: {
        shared: { command: "global-cmd" },
        "global-only": { command: "global" },
      },
    });

    writeJson(tmpDir, "mcp.json", {
      servers: {
        shared: { command: "local-cmd" },
        "local-only": { command: "local" },
      },
    });

    const config = await loadMergedMcpConfig(tmpDir);
    expect(config.servers.shared.command).toBe("local-cmd");
    expect(config.servers["global-only"].command).toBe("global");
    expect(config.servers["local-only"].command).toBe("local");
  });

  it("should handle invalid JSON gracefully", async () => {
    fs.writeFileSync(path.join(tmpDir, "mcp.json"), "not json");
    const config = await loadMergedMcpConfig(tmpDir);
    expect(config.servers).toEqual({});
  });

  it("should handle Zod validation failure gracefully", async () => {
    writeJson(tmpDir, "mcp.json", {
      servers: { test: { command: 123 } }, // command must be string
    });

    const config = await loadMergedMcpConfig(tmpDir);
    // Zod validation fails, returns empty
    expect(config.servers).toEqual({});
  });

  it("should support disabled flag in config", async () => {
    writeJson(tmpDir, "mcp.json", {
      servers: {
        active: { command: "echo", disabled: false },
        inactive: { command: "echo", disabled: true },
      },
    });

    const config = await loadMergedMcpConfig(tmpDir);
    expect(config.servers.active.disabled).toBe(false);
    expect(config.servers.inactive.disabled).toBe(true);
  });

  it("should support transport type and url fields", async () => {
    writeJson(tmpDir, "mcp.json", {
      servers: {
        stdio: { command: "echo", type: "stdio" },
        sse: { url: "http://localhost:3000/sse", type: "sse" },
      },
    });

    const config = await loadMergedMcpConfig(tmpDir);
    expect(config.servers.stdio.type).toBe("stdio");
    expect(config.servers.sse.type).toBe("sse");
    expect(config.servers.sse.url).toBe("http://localhost:3000/sse");
  });
});
