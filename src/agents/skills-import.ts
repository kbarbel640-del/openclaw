import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CONFIG_DIR, ensureDir } from "../utils.js";
import { downloadUrlToFile, extractArchive, scanSkillDirectory } from "./skills-package-utils.js";
import { parseFrontmatter } from "./skills/frontmatter.js";
import { bumpSkillsSnapshotVersion } from "./skills/refresh.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillImportSource = "file" | "remote";

export type SkillImportRequest = {
  source: SkillImportSource;
  /** Mode A: local file path to a .zip or .skill file */
  filePath?: string;
  /** Mode B: remote package identifier (e.g. "facebook/react") */
  package?: string;
  /** Mode B: registry base URL (default: https://registry.skillsmp.com) */
  registry?: string;
  /** Overwrite existing skill with the same name */
  force?: boolean;
  /** Skip security scan (not recommended) */
  skipScan?: boolean;
  /** Custom managed skills directory (default: ~/.openclaw/skills) */
  managedSkillsDir?: string;
  /** Timeout for remote downloads (ms) */
  timeoutMs?: number;
};

export type SkillImportResult = {
  ok: boolean;
  skillName: string;
  description?: string;
  message: string;
  warnings?: string[];
  installedPath?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_REGISTRY = "https://registry.skillsmp.com";
const DEFAULT_TIMEOUT_MS = 120_000;
const SKILL_FILENAME = "SKILL.md";
const VALID_EXTENSIONS = new Set([".zip", ".skill"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidArchive(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return VALID_EXTENSIONS.has(ext);
}

function resolveManagedSkillsDir(custom?: string): string {
  return custom?.trim() || path.join(CONFIG_DIR, "skills");
}

async function createTempDir(): Promise<string> {
  const prefix = path.join(os.tmpdir(), "skill-import-");
  return await fs.promises.mkdtemp(prefix);
}

async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

// ---------------------------------------------------------------------------
// Extract
// ---------------------------------------------------------------------------

/**
 * Locate the skill root directory within the extracted contents.
 * The SKILL.md may be at the root of the extracted dir, or inside a single
 * subdirectory (common pattern: zip contains `skill-name/SKILL.md`).
 */
async function locateSkillRoot(extractedDir: string): Promise<string | null> {
  // Check if SKILL.md is directly in the extracted dir
  const directPath = path.join(extractedDir, SKILL_FILENAME);
  if (fs.existsSync(directPath)) {
    return extractedDir;
  }

  // Check one level deep: look for a single subdirectory containing SKILL.md
  const entries = await fs.promises.readdir(extractedDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  for (const dir of dirs) {
    const candidate = path.join(extractedDir, dir.name, SKILL_FILENAME);
    if (fs.existsSync(candidate)) {
      return path.join(extractedDir, dir.name);
    }
  }

  // Check all subdirectories (not just single-dir case)
  for (const dir of dirs) {
    const subEntries = await fs.promises.readdir(path.join(extractedDir, dir.name), {
      withFileTypes: true,
    });
    for (const sub of subEntries) {
      if (sub.isDirectory()) {
        const candidate = path.join(extractedDir, dir.name, sub.name, SKILL_FILENAME);
        if (fs.existsSync(candidate)) {
          return path.join(extractedDir, dir.name, sub.name);
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

type SkillValidation = {
  ok: boolean;
  name: string;
  description: string;
  message: string;
};

function validateSkillStructure(skillDir: string): SkillValidation {
  const skillMdPath = path.join(skillDir, SKILL_FILENAME);
  if (!fs.existsSync(skillMdPath)) {
    return {
      ok: false,
      name: "",
      description: "",
      message: `${SKILL_FILENAME} not found in skill directory`,
    };
  }

  let content: string;
  try {
    content = fs.readFileSync(skillMdPath, "utf-8");
  } catch (err) {
    return {
      ok: false,
      name: "",
      description: "",
      message: `Failed to read ${SKILL_FILENAME}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const frontmatter = parseFrontmatter(content);
  const name = frontmatter.name?.trim();
  const description = frontmatter.description?.trim() ?? "";

  if (!name) {
    return {
      ok: false,
      name: "",
      description,
      message: `${SKILL_FILENAME} is missing required 'name' field in frontmatter`,
    };
  }

  // Validate name format: lowercase letters, digits, hyphens
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    return {
      ok: false,
      name,
      description,
      message: `Invalid skill name "${name}": must contain only lowercase letters, digits, and hyphens`,
    };
  }

  if (!description) {
    return {
      ok: false,
      name,
      description: "",
      message: `${SKILL_FILENAME} is missing required 'description' field in frontmatter`,
    };
  }

  return { ok: true, name, description, message: "valid" };
}

// ---------------------------------------------------------------------------
// Security scan
// ---------------------------------------------------------------------------

async function scanSkill(
  skillDir: string,
  skillName: string,
): Promise<{ ok: boolean; warnings: string[] }> {
  return await scanSkillDirectory({
    skillDir,
    skillName,
    criticalMode: "block",
    criticalMessage: (name, details) =>
      `BLOCKED: Skill "${name}" contains dangerous code patterns: ${details}`,
    warnMessage: (name, warnCount) =>
      `Skill "${name}" has ${warnCount} suspicious code pattern(s). Review before use.`,
    scanFailureMessage: (name, errorText) =>
      `Security scan failed for "${name}" (${errorText}). Proceeding with caution.`,
  });
}

// ---------------------------------------------------------------------------
// Download (remote mode)
// ---------------------------------------------------------------------------

async function downloadSkillPackage(params: {
  package: string;
  registry?: string;
  targetDir: string;
  timeoutMs: number;
}): Promise<{ ok: boolean; filePath: string; message: string }> {
  const registry = params.registry?.trim() || DEFAULT_REGISTRY;
  const pkg = params.package.trim();

  // Construct download URL: support both full URLs and "owner/repo" format
  let url: string;
  if (pkg.startsWith("http://") || pkg.startsWith("https://")) {
    url = pkg;
  } else {
    // Assume "owner/repo" format → registry API
    url = `${registry}/api/v1/skills/${encodeURIComponent(pkg)}/download`;
  }

  const filename = `${pkg.replace(/\//g, "-")}.zip`;
  const destPath = path.join(params.targetDir, filename);

  try {
    await downloadUrlToFile({
      url,
      destPath,
      timeoutMs: params.timeoutMs,
      includeUrlInError: true,
    });
    return { ok: true, filePath: destPath, message: "downloaded" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      filePath: "",
      message: message.startsWith("Download failed") ? message : `Download error: ${message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Install (copy to managed dir)
// ---------------------------------------------------------------------------

async function installToManagedDir(params: {
  skillDir: string;
  skillName: string;
  managedSkillsDir: string;
  force: boolean;
}): Promise<{ ok: boolean; installedPath: string; message: string }> {
  const targetDir = path.join(params.managedSkillsDir, params.skillName);

  if (fs.existsSync(targetDir)) {
    if (!params.force) {
      return {
        ok: false,
        installedPath: "",
        message: `Skill "${params.skillName}" already exists at ${targetDir}. Use force=true to overwrite.`,
      };
    }
    // Remove existing before overwrite
    await fs.promises.rm(targetDir, { recursive: true, force: true });
  }

  await ensureDir(params.managedSkillsDir);
  await fs.promises.cp(params.skillDir, targetDir, { recursive: true, force: true });

  return {
    ok: true,
    installedPath: targetDir,
    message: `Installed to ${targetDir}`,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function importSkill(params: SkillImportRequest): Promise<SkillImportResult> {
  const managedSkillsDir = resolveManagedSkillsDir(params.managedSkillsDir);
  const timeoutMs = Math.min(Math.max(params.timeoutMs ?? DEFAULT_TIMEOUT_MS, 5_000), 600_000);
  const force = params.force ?? false;
  const skipScan = params.skipScan ?? false;

  const fail = (message: string, warnings?: string[]): SkillImportResult => ({
    ok: false,
    skillName: "",
    message,
    warnings: warnings?.length ? warnings : undefined,
  });

  let tempDir: string | undefined;
  try {
    tempDir = await createTempDir();
    let archivePath: string;

    // -----------------------------------------------------------------------
    // Step 1: Resolve archive path (local or remote)
    // -----------------------------------------------------------------------
    if (params.source === "file") {
      const filePath = params.filePath?.trim();
      if (!filePath) {
        return fail("filePath is required for source=file");
      }
      if (!fs.existsSync(filePath)) {
        return fail(`File not found: ${filePath}`);
      }
      if (!isValidArchive(filePath)) {
        return fail(`Unsupported file type. Expected .zip or .skill: ${filePath}`);
      }
      archivePath = filePath;
    } else if (params.source === "remote") {
      const pkg = params.package?.trim();
      if (!pkg) {
        return fail("package is required for source=remote");
      }
      const downloadResult = await downloadSkillPackage({
        package: pkg,
        registry: params.registry,
        targetDir: tempDir,
        timeoutMs,
      });
      if (!downloadResult.ok) {
        return fail(downloadResult.message);
      }
      archivePath = downloadResult.filePath;
    } else {
      return fail(`Unsupported source: ${params.source}`);
    }

    // -----------------------------------------------------------------------
    // Step 2: Extract archive
    // -----------------------------------------------------------------------
    const extractDir = path.join(tempDir, "extracted");
    await ensureDir(extractDir);

    const extractResult = await extractArchive({
      archivePath,
      archiveType: "zip",
      targetDir: extractDir,
      timeoutMs,
    });
    if (extractResult.code !== 0) {
      const stderr = extractResult.stderr.trim();
      return fail(`Failed to extract archive: ${stderr || `exit ${extractResult.code}`}`);
    }

    // -----------------------------------------------------------------------
    // Step 3: Locate and validate SKILL.md
    // -----------------------------------------------------------------------
    const skillRoot = await locateSkillRoot(extractDir);
    if (!skillRoot) {
      return fail("No SKILL.md found in the archive. Not a valid skill package.");
    }

    const validation = validateSkillStructure(skillRoot);
    if (!validation.ok) {
      return fail(validation.message);
    }

    const { name: skillName, description } = validation;

    // -----------------------------------------------------------------------
    // Step 4: Security scan
    // -----------------------------------------------------------------------
    const allWarnings: string[] = [];
    if (!skipScan) {
      const scanResult = await scanSkill(skillRoot, skillName);
      allWarnings.push(...scanResult.warnings);
      if (!scanResult.ok) {
        return {
          ok: false,
          skillName,
          description,
          message: `Security scan blocked installation of "${skillName}"`,
          warnings: allWarnings.length > 0 ? allWarnings : undefined,
        };
      }
    }

    // -----------------------------------------------------------------------
    // Step 5: Install to managed skills directory
    // -----------------------------------------------------------------------
    const installResult = await installToManagedDir({
      skillDir: skillRoot,
      skillName,
      managedSkillsDir,
      force,
    });

    if (!installResult.ok) {
      return {
        ok: false,
        skillName,
        description,
        message: installResult.message,
        warnings: allWarnings.length > 0 ? allWarnings : undefined,
      };
    }

    // -----------------------------------------------------------------------
    // Step 6: Trigger skill snapshot refresh
    // -----------------------------------------------------------------------
    bumpSkillsSnapshotVersion({ reason: "manual" });

    return {
      ok: true,
      skillName,
      description,
      message: `Skill "${skillName}" installed successfully`,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
      installedPath: installResult.installedPath,
    };
  } catch (err) {
    return fail(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------

export type SkillUninstallRequest = {
  skillName: string;
  managedSkillsDir?: string;
};

export type SkillUninstallResult = {
  ok: boolean;
  skillName: string;
  message: string;
};

export async function uninstallSkill(params: SkillUninstallRequest): Promise<SkillUninstallResult> {
  const managedSkillsDir = resolveManagedSkillsDir(params.managedSkillsDir);
  const skillName = params.skillName.trim();

  if (!skillName) {
    return { ok: false, skillName: "", message: "skillName is required" };
  }

  const targetDir = path.join(managedSkillsDir, skillName);

  if (!fs.existsSync(targetDir)) {
    return {
      ok: false,
      skillName,
      message: `Skill "${skillName}" not found in managed skills directory`,
    };
  }

  // Verify it's actually a skill directory (has SKILL.md)
  const skillMd = path.join(targetDir, SKILL_FILENAME);
  if (!fs.existsSync(skillMd)) {
    return {
      ok: false,
      skillName,
      message: `"${skillName}" does not appear to be a valid skill (no ${SKILL_FILENAME})`,
    };
  }

  try {
    await fs.promises.rm(targetDir, { recursive: true, force: true });
    bumpSkillsSnapshotVersion({ reason: "manual" });
    return {
      ok: true,
      skillName,
      message: `Skill "${skillName}" uninstalled successfully`,
    };
  } catch (err) {
    return {
      ok: false,
      skillName,
      message: `Uninstall failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
