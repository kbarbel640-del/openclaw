import { beforeEach, describe, expect, it } from "vitest";
import {
  resolveExpansoValidationSandboxDockerConfig,
  type ExpansoValidationSandboxParams,
} from "./config.js";
import {
  EXPANSO_SANDBOX_CONTAINER_PREFIX,
  EXPANSO_SANDBOX_IMAGE,
  EXPANSO_SANDBOX_PIPELINE_PATH,
  EXPANSO_SANDBOX_WORKDIR,
} from "./constants.js";

describe("resolveExpansoValidationSandboxDockerConfig", () => {
  // -------------------------------------------------------------------------
  // Constants sanity-checks
  // -------------------------------------------------------------------------

  it("exports expected constant values", () => {
    expect(EXPANSO_SANDBOX_IMAGE).toBe("openclaw-expanso-sandbox:latest");
    expect(EXPANSO_SANDBOX_CONTAINER_PREFIX).toBe("openclaw-sbx-expanso-");
    expect(EXPANSO_SANDBOX_WORKDIR).toBe("/workspace");
    expect(EXPANSO_SANDBOX_PIPELINE_PATH).toBe("/workspace/pipeline.yaml");
  });

  // -------------------------------------------------------------------------
  // Default (no host path)
  // -------------------------------------------------------------------------

  describe("without hostWorkspacePath", () => {
    it("returns the Expanso sandbox image", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.image).toBe(EXPANSO_SANDBOX_IMAGE);
    });

    it("uses the Expanso container prefix", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.containerPrefix).toBe(EXPANSO_SANDBOX_CONTAINER_PREFIX);
    });

    it("sets workdir to /workspace", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.workdir).toBe(EXPANSO_SANDBOX_WORKDIR);
    });

    it("has read-only root", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.readOnlyRoot).toBe(true);
    });

    it("disables networking", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.network).toBe("none");
    });

    it("drops all Linux capabilities", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.capDrop).toEqual(["ALL"]);
    });

    it("includes /workspace in tmpfs (no host bind provided)", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.tmpfs).toContain(EXPANSO_SANDBOX_WORKDIR);
    });

    it("includes standard tmpfs paths", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.tmpfs).toContain("/tmp");
      expect(cfg.tmpfs).toContain("/var/tmp");
      expect(cfg.tmpfs).toContain("/run");
    });

    it("does not set any bind mounts", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.binds).toBeUndefined();
    });

    it("applies a tight pid limit", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(typeof cfg.pidsLimit).toBe("number");
      expect(cfg.pidsLimit).toBeLessThanOrEqual(128);
    });

    it("applies a memory limit", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.memory).toBeDefined();
    });

    it("applies a cpu limit", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.cpus).toBeDefined();
      expect(cfg.cpus).toBeLessThanOrEqual(2);
    });

    it("sets LANG in env", () => {
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg.env?.["LANG"]).toBeDefined();
    });

    it("returns a full config when called with no arguments", () => {
      // Should not throw when called with default empty params
      const cfg = resolveExpansoValidationSandboxDockerConfig();
      expect(cfg).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // With host workspace path
  // -------------------------------------------------------------------------

  describe("with hostWorkspacePath", () => {
    const hostPath = "/tmp/expanso-validation-abc123";
    let cfg: ReturnType<typeof resolveExpansoValidationSandboxDockerConfig>;

    beforeEach(() => {
      cfg = resolveExpansoValidationSandboxDockerConfig({ hostWorkspacePath: hostPath });
    });

    it("adds a read-only bind mount for the host workspace", () => {
      expect(cfg.binds).toBeDefined();
      expect(cfg.binds).toHaveLength(1);
      expect(cfg.binds![0]).toBe(`${hostPath}:${EXPANSO_SANDBOX_WORKDIR}:ro`);
    });

    it("does NOT include /workspace in tmpfs when bind-mounted", () => {
      expect(cfg.tmpfs).not.toContain(EXPANSO_SANDBOX_WORKDIR);
    });

    it("still includes /tmp in tmpfs", () => {
      expect(cfg.tmpfs).toContain("/tmp");
    });

    it("still uses the Expanso sandbox image", () => {
      expect(cfg.image).toBe(EXPANSO_SANDBOX_IMAGE);
    });

    it("still has read-only root", () => {
      expect(cfg.readOnlyRoot).toBe(true);
    });

    it("still disables networking", () => {
      expect(cfg.network).toBe("none");
    });

    it("still drops all capabilities", () => {
      expect(cfg.capDrop).toEqual(["ALL"]);
    });
  });

  // -------------------------------------------------------------------------
  // Type-level check: params are optional
  // -------------------------------------------------------------------------

  it("accepts an empty params object", () => {
    const params: ExpansoValidationSandboxParams = {};
    const cfg = resolveExpansoValidationSandboxDockerConfig(params);
    expect(cfg.image).toBe(EXPANSO_SANDBOX_IMAGE);
  });

  it("accepts params with only hostWorkspacePath defined", () => {
    const params: ExpansoValidationSandboxParams = { hostWorkspacePath: "/tmp/test" };
    const cfg = resolveExpansoValidationSandboxDockerConfig(params);
    expect(cfg.binds).toBeDefined();
  });
});
