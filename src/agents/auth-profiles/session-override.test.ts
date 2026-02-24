import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions.js";
import { withStateDirEnv } from "../../test-helpers/state-dir-env.js";
import { resolveSessionAuthProfileOverride } from "./session-override.js";

async function writeAuthStore(agentDir: string) {
  const authPath = path.join(agentDir, "auth-profiles.json");
  const payload = {
    version: 1,
    profiles: {
      "zai:work": { type: "api_key", provider: "zai", key: "sk-test" },
    },
    order: {
      zai: ["zai:work"],
    },
  };
  await fs.writeFile(authPath, JSON.stringify(payload), "utf-8");
}

async function writeMultiProfileAuthStore(agentDir: string, opts?: { cooldownManual?: boolean }) {
  const authPath = path.join(agentDir, "auth-profiles.json");
  const payload = {
    version: 1,
    profiles: {
      "anthropic:manual": { type: "token", provider: "anthropic", token: "tok-manual" },
      "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-api" },
    },
    order: {
      anthropic: ["anthropic:manual", "anthropic:default"],
    },
    usageStats: opts?.cooldownManual
      ? {
          "anthropic:manual": {
            consecutiveErrors: 3,
            lastErrorAt: Date.now(),
            cooldownUntil: Date.now() + 300_000,
          },
        }
      : undefined,
  };
  await fs.writeFile(authPath, JSON.stringify(payload), "utf-8");
}

describe("resolveSessionAuthProfileOverride", () => {
  it("keeps user override when provider alias differs", async () => {
    await withStateDirEnv("openclaw-auth-", async ({ stateDir }) => {
      const agentDir = path.join(stateDir, "agent");
      await fs.mkdir(agentDir, { recursive: true });
      await writeAuthStore(agentDir);

      const sessionEntry: SessionEntry = {
        sessionId: "s1",
        updatedAt: Date.now(),
        authProfileOverride: "zai:work",
        authProfileOverrideSource: "user",
      };
      const sessionStore = { "agent:main:main": sessionEntry };

      const resolved = await resolveSessionAuthProfileOverride({
        cfg: {} as OpenClawConfig,
        provider: "z.ai",
        agentDir,
        sessionEntry,
        sessionStore,
        sessionKey: "agent:main:main",
        storePath: undefined,
        isNewSession: false,
      });

      expect(resolved).toBe("zai:work");
      expect(sessionEntry.authProfileOverride).toBe("zai:work");
    });
  });

  it("re-selects higher-priority profile when it exits cooldown (#25510)", async () => {
    await withStateDirEnv("openclaw-auth-", async ({ stateDir }) => {
      const agentDir = path.join(stateDir, "agent");
      await fs.mkdir(agentDir, { recursive: true });
      // Manual profile is NOT in cooldown → should be preferred
      await writeMultiProfileAuthStore(agentDir, { cooldownManual: false });

      const sessionEntry: SessionEntry = {
        sessionId: "s2",
        updatedAt: Date.now(),
        // Currently pinned to lower-priority API key (from a previous auto-selection)
        authProfileOverride: "anthropic:default",
        authProfileOverrideSource: "auto",
        authProfileOverrideCompactionCount: 0,
      };
      const sessionStore = { "agent:main:main": sessionEntry };

      const resolved = await resolveSessionAuthProfileOverride({
        cfg: {} as OpenClawConfig,
        provider: "anthropic",
        agentDir,
        sessionEntry,
        sessionStore,
        sessionKey: "agent:main:main",
        storePath: undefined,
        isNewSession: false,
      });

      // Should switch back to the higher-priority manual profile
      expect(resolved).toBe("anthropic:manual");
      expect(sessionEntry.authProfileOverride).toBe("anthropic:manual");
    });
  });

  it("stays on current profile when higher-priority profiles are in cooldown (#25510)", async () => {
    await withStateDirEnv("openclaw-auth-", async ({ stateDir }) => {
      const agentDir = path.join(stateDir, "agent");
      await fs.mkdir(agentDir, { recursive: true });
      // Manual profile IS in cooldown → should stay on API key
      await writeMultiProfileAuthStore(agentDir, { cooldownManual: true });

      const sessionEntry: SessionEntry = {
        sessionId: "s3",
        updatedAt: Date.now(),
        authProfileOverride: "anthropic:default",
        authProfileOverrideSource: "auto",
        authProfileOverrideCompactionCount: 0,
      };
      const sessionStore = { "agent:main:main": sessionEntry };

      const resolved = await resolveSessionAuthProfileOverride({
        cfg: {} as OpenClawConfig,
        provider: "anthropic",
        agentDir,
        sessionEntry,
        sessionStore,
        sessionKey: "agent:main:main",
        storePath: undefined,
        isNewSession: false,
      });

      // Should stay on current since manual is still in cooldown
      expect(resolved).toBe("anthropic:default");
    });
  });
});
