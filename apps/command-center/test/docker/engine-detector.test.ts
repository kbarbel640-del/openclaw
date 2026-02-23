/**
 * Unit tests for EngineDetector — all Docker/Podman calls are mocked.
 * Tests run without a real Docker daemon.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngineDetector } from "../../src/main/docker/engine-detector.js";

// ─── Mock child_process ──────────────────────────────────────────────────────

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify:
    (fn: unknown) =>
    (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        (fn as Function)(...args, (err: unknown, result: unknown) => {
          if (err) { reject(err); } else { resolve(result); }
        });
      }),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDockerVersionOutput(
  clientVersion = "24.0.5",
  apiVersion = "1.43",
  withServer = true,
): string {
  return JSON.stringify({
    Client: { Version: clientVersion, ApiVersion: apiVersion },
    ...(withServer ? { Server: { Version: clientVersion } } : {}),
  });
}

function makePodmanVersionOutput(version = "4.6.0", apiVersion = "4.6.0"): string {
  return JSON.stringify({
    Client: { Version: version, APIVersion: apiVersion },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EngineDetector", () => {
  let detector: EngineDetector;

  beforeEach(() => {
    detector = new EngineDetector();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  // ── detect() ────────────────────────────────────────────────────────────

  describe("detect()", () => {
    it("returns docker-ce when Docker daemon is running and Desktop is absent", async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(null, { stdout: makeDockerVersionOutput(), stderr: "" });
        },
      );

      const result = await detector.detect();

      expect(result.variant).toBe("docker-ce");
      expect(result.running).toBe(true);
      expect(result.version).toBe("24.0.5");
      expect(result.apiVersion).toBe("1.43");
    });

    it("returns docker-desktop when Docker Desktop bundle is present", async () => {
      mockExistsSync.mockImplementation((p: string) =>
        p.includes("Docker.app"),
      );
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(null, { stdout: makeDockerVersionOutput(), stderr: "" });
        },
      );

      const result = await detector.detect();

      expect(result.variant).toBe("docker-desktop");
      expect(result.running).toBe(true);
    });

    it("returns running=false when Docker client present but server absent", async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(null, { stdout: makeDockerVersionOutput("24.0.5", "1.43", false), stderr: "" });
        },
      );

      const result = await detector.detect();

      expect(result.running).toBe(false);
      expect(result.variant).not.toBe("none");
    });

    it("falls back to podman when docker command fails", async () => {
      mockExecFile.mockImplementation(
        (cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          if (cmd === "docker") {
            cb(new Error("command not found"), { stdout: "", stderr: "" });
          } else {
            cb(null, { stdout: makePodmanVersionOutput(), stderr: "" });
          }
        },
      );

      const result = await detector.detect();

      expect(result.variant).toBe("podman");
      expect(result.running).toBe(true);
      expect(result.version).toBe("4.6.0");
    });

    it("returns none when neither docker nor podman is available", async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(new Error("command not found"), { stdout: "", stderr: "" });
        },
      );

      const result = await detector.detect();

      expect(result.variant).toBe("none");
      expect(result.running).toBe(false);
    });

    it("returns none when docker output is invalid JSON", async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(null, { stdout: "not json", stderr: "" });
        },
      );

      const result = await detector.detect();

      // Invalid JSON causes probeDocker to throw → falls through to podman → none
      expect(result.variant).toBe("none");
    });
  });

  // ── getInstallOptions() ──────────────────────────────────────────────────

  describe("getInstallOptions()", () => {
    it("returns dockerDesktop=true on darwin", () => {
      vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
      const opts = detector.getInstallOptions();
      expect(opts.dockerDesktop).toBe(true);
    });

    it("returns dockerCE=true only on linux", () => {
      vi.spyOn(process, "platform", "get").mockReturnValue("linux");
      const opts = detector.getInstallOptions();
      expect(opts.dockerCE).toBe(true);
    });

    it("returns dockerCE=false on darwin", () => {
      vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
      const opts = detector.getInstallOptions();
      expect(opts.dockerCE).toBe(false);
    });
  });
});
