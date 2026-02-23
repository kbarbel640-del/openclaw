import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  hasBroadCapabilities,
  isValidMethodGlob,
  loadCapabilityManifest,
  matchMethodGlob,
  matchRoutePath,
  validateCapabilityManifest,
  type PluginCapabilityManifest,
} from "./capability-manifest.js";

function validManifest(overrides?: Partial<PluginCapabilityManifest>): PluginCapabilityManifest {
  return {
    manifestVersion: 1,
    pluginId: "test-plugin",
    capabilities: {
      gatewayMethods: [{ method: "test.*", description: "test methods" }],
    },
    ...overrides,
  };
}

describe("validateCapabilityManifest", () => {
  it("accepts a valid manifest", () => {
    const result = validateCapabilityManifest(validManifest(), "test-plugin");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.pluginId).toBe("test-plugin");
    }
  });

  it("rejects non-object input", () => {
    const result = validateCapabilityManifest("not-an-object", "test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("manifest must be a JSON object");
    }
  });

  it("rejects wrong manifestVersion", () => {
    const result = validateCapabilityManifest(
      { ...validManifest(), manifestVersion: 2 },
      "test-plugin",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("manifestVersion must be 1"))).toBe(true);
    }
  });

  it("rejects missing pluginId", () => {
    const m = validManifest();
    const raw = { ...m, pluginId: undefined };
    const result = validateCapabilityManifest(raw, "test-plugin");
    expect(result.ok).toBe(false);
  });

  it("rejects mismatched pluginId", () => {
    const result = validateCapabilityManifest(validManifest(), "other-plugin");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("does not match"))).toBe(true);
    }
  });

  it("rejects missing capabilities", () => {
    const raw = { manifestVersion: 1, pluginId: "test" };
    const result = validateCapabilityManifest(raw, "test");
    expect(result.ok).toBe(false);
  });

  it("rejects invalid gateway method glob", () => {
    const result = validateCapabilityManifest(
      {
        manifestVersion: 1,
        pluginId: "test",
        capabilities: {
          gatewayMethods: [{ method: "foo.*.bar", description: "bad" }],
        },
      },
      "test",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("not a valid method glob"))).toBe(true);
    }
  });

  it("validates httpRoutes with invalid HTTP method", () => {
    const result = validateCapabilityManifest(
      {
        manifestVersion: 1,
        pluginId: "test",
        capabilities: {
          httpRoutes: [
            { path: "/api/test", methods: ["BANANA"], auth: "gateway", description: "bad" },
          ],
        },
      },
      "test",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("invalid method"))).toBe(true);
    }
  });

  it("accepts a full manifest with all capability types", () => {
    const full: PluginCapabilityManifest = {
      manifestVersion: 1,
      pluginId: "full-plugin",
      capabilities: {
        gatewayMethods: [{ method: "full.*", description: "all" }],
        httpRoutes: [
          { path: "/api/full/*", methods: ["GET", "POST"], auth: "gateway", description: "routes" },
        ],
        config: { reads: ["channels.full"], writes: [] },
        filesystem: { stateDir: true, credentialsDir: false },
        network: { outbound: true, webhookInbound: true },
        runtime: { runCommands: false, spawnProcesses: false, timers: true },
        channels: { channelIds: ["full"], inbound: true, outbound: true },
      },
      permissions: {
        summary: "Full plugin",
        details: ["Does everything"],
      },
    };
    const result = validateCapabilityManifest(full, "full-plugin");
    expect(result.ok).toBe(true);
  });
});

describe("isValidMethodGlob", () => {
  it("accepts exact method names", () => {
    expect(isValidMethodGlob("send")).toBe(true);
    expect(isValidMethodGlob("msteams.send")).toBe(true);
  });

  it("accepts wildcard", () => {
    expect(isValidMethodGlob("*")).toBe(true);
  });

  it("accepts prefix globs", () => {
    expect(isValidMethodGlob("msteams.*")).toBe(true);
    expect(isValidMethodGlob("voicecall.*")).toBe(true);
  });

  it("rejects invalid patterns", () => {
    expect(isValidMethodGlob("")).toBe(false);
    expect(isValidMethodGlob("foo.*.bar")).toBe(false);
    expect(isValidMethodGlob("foo bar")).toBe(false);
  });
});

describe("matchMethodGlob", () => {
  it("matches exact methods", () => {
    expect(matchMethodGlob("msteams.send", "msteams.send")).toBe(true);
    expect(matchMethodGlob("msteams.send", "slack.send")).toBe(false);
  });

  it("matches prefix globs", () => {
    expect(matchMethodGlob("msteams.*", "msteams.send")).toBe(true);
    expect(matchMethodGlob("msteams.*", "msteams.receive")).toBe(true);
    expect(matchMethodGlob("msteams.*", "slack.send")).toBe(false);
  });

  it("matches wildcard", () => {
    expect(matchMethodGlob("*", "anything")).toBe(true);
  });
});

describe("matchRoutePath", () => {
  it("matches exact paths", () => {
    expect(matchRoutePath("/api/test", "/api/test")).toBe(true);
    expect(matchRoutePath("/api/test", "/api/other")).toBe(false);
  });

  it("matches wildcard paths", () => {
    expect(matchRoutePath("/api/channels/msteams/*", "/api/channels/msteams/webhook")).toBe(true);
    expect(matchRoutePath("/api/channels/msteams/*", "/api/channels/slack/webhook")).toBe(false);
  });
});

describe("hasBroadCapabilities", () => {
  it("detects wildcard gateway methods", () => {
    const m = validManifest({
      capabilities: {
        gatewayMethods: [{ method: "*", description: "everything" }],
      },
    });
    expect(hasBroadCapabilities(m)).toBe(true);
  });

  it("returns false for scoped methods", () => {
    expect(hasBroadCapabilities(validManifest())).toBe(false);
  });
});

describe("loadCapabilityManifest", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cap-manifest-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads from openclaw-manifest.json", () => {
    const manifest = validManifest({ pluginId: "loaded" });
    fs.writeFileSync(path.join(tmpDir, "openclaw-manifest.json"), JSON.stringify(manifest));
    const result = loadCapabilityManifest(tmpDir, "loaded");
    expect(result).not.toBeNull();
    expect(result?.pluginId).toBe("loaded");
  });

  it("returns null when no manifest exists", () => {
    const result = loadCapabilityManifest(tmpDir, "missing");
    expect(result).toBeNull();
  });

  it("loads from package.json openclaw.capabilityManifest", () => {
    const manifest = validManifest({ pluginId: "embedded" });
    const pkg = { name: "test", openclaw: { capabilityManifest: manifest } };
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));
    const result = loadCapabilityManifest(tmpDir, "embedded");
    expect(result).not.toBeNull();
    expect(result?.pluginId).toBe("embedded");
  });

  it("throws on invalid standalone manifest", () => {
    fs.writeFileSync(
      path.join(tmpDir, "openclaw-manifest.json"),
      JSON.stringify({ manifestVersion: 99, pluginId: "bad" }),
    );
    expect(() => loadCapabilityManifest(tmpDir, "bad")).toThrow("Invalid capability manifest");
  });
});
