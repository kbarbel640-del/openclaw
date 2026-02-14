import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { extractArchive as extractArchiveSafe } from "../infra/archive.js";
import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
import { runCommandWithTimeout } from "../process/exec.js";
import { scanDirectoryWithSummary } from "../security/skill-scanner.js";
import { hasBinary } from "./skills.js";

function isNodeReadableStream(value: unknown): value is NodeJS.ReadableStream {
  return Boolean(value && typeof (value as NodeJS.ReadableStream).pipe === "function");
}

export function formatSkillScanFindingDetail(
  rootDir: string,
  finding: { message: string; file: string; line: number },
): string {
  const relativePath = path.relative(rootDir, finding.file);
  const filePath =
    relativePath && relativePath !== "." && !relativePath.startsWith("..")
      ? relativePath
      : path.basename(finding.file);
  return `${finding.message} (${filePath}:${finding.line})`;
}

export function resolveArchiveType(filename: string, explicit?: string): string | undefined {
  const explicitType = explicit?.trim().toLowerCase();
  if (explicitType) {
    return explicitType;
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    return "tar.gz";
  }
  if (lower.endsWith(".tar.bz2") || lower.endsWith(".tbz2")) {
    return "tar.bz2";
  }
  if (lower.endsWith(".zip")) {
    return "zip";
  }
  return undefined;
}

function normalizeArchiveEntryPath(raw: string): string {
  return raw.replaceAll("\\", "/");
}

function isWindowsDrivePath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p);
}

function validateArchiveEntryPath(entryPath: string): void {
  if (!entryPath || entryPath === "." || entryPath === "./") {
    return;
  }
  if (isWindowsDrivePath(entryPath)) {
    throw new Error(`archive entry uses a drive path: ${entryPath}`);
  }
  const normalized = path.posix.normalize(normalizeArchiveEntryPath(entryPath));
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`archive entry escapes targetDir: ${entryPath}`);
  }
  if (path.posix.isAbsolute(normalized) || normalized.startsWith("//")) {
    throw new Error(`archive entry is absolute: ${entryPath}`);
  }
}

function resolveSafeBaseDir(rootDir: string): string {
  const resolved = path.resolve(rootDir);
  return resolved.endsWith(path.sep) ? resolved : `${resolved}${path.sep}`;
}

function stripArchivePath(entryPath: string, stripComponents: number): string | null {
  const raw = normalizeArchiveEntryPath(entryPath);
  if (!raw || raw === "." || raw === "./") {
    return null;
  }

  // Match tar --strip-components semantics before normalization so we can
  // detect strip-induced traversal like "a/../b" with stripComponents=1.
  const parts = raw.split("/").filter((part) => part.length > 0 && part !== ".");
  const strip = Math.max(0, Math.floor(stripComponents));
  const stripped = strip === 0 ? parts.join("/") : parts.slice(strip).join("/");
  const result = path.posix.normalize(stripped);
  if (!result || result === "." || result === "./") {
    return null;
  }
  return result;
}

function validateExtractedPathWithinRoot(params: {
  rootDir: string;
  relPath: string;
  originalPath: string;
}): void {
  const safeBase = resolveSafeBaseDir(params.rootDir);
  const outPath = path.resolve(params.rootDir, params.relPath);
  if (!outPath.startsWith(safeBase)) {
    throw new Error(`archive entry escapes targetDir: ${params.originalPath}`);
  }
}

export async function downloadUrlToFile(params: {
  url: string;
  destPath: string;
  timeoutMs: number;
  includeUrlInError?: boolean;
}): Promise<{ bytes: number }> {
  const { url, destPath, timeoutMs, includeUrlInError = false } = params;
  const { response, release } = await fetchWithSsrFGuard({
    url,
    timeoutMs: Math.max(1_000, timeoutMs),
  });
  try {
    if (!response.ok || !response.body) {
      const suffix = includeUrlInError ? `: ${url}` : "";
      throw new Error(`Download failed (${response.status} ${response.statusText})${suffix}`);
    }

    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    const body = response.body as unknown;
    const readable = isNodeReadableStream(body)
      ? body
      : Readable.fromWeb(body as NodeReadableStream);
    await pipeline(readable, file);
    const stat = await fs.promises.stat(destPath);
    return { bytes: stat.size };
  } finally {
    await release();
  }
}

export async function extractArchive(params: {
  archivePath: string;
  archiveType: string;
  targetDir: string;
  stripComponents?: number;
  timeoutMs: number;
}): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const { archivePath, archiveType, targetDir, stripComponents, timeoutMs } = params;
  const strip =
    typeof stripComponents === "number" && Number.isFinite(stripComponents)
      ? Math.max(0, Math.floor(stripComponents))
      : 0;

  try {
    if (archiveType === "zip") {
      await extractArchiveSafe({
        archivePath,
        destDir: targetDir,
        timeoutMs,
        kind: "zip",
        stripComponents: strip,
      });
      return { stdout: "", stderr: "", code: 0 };
    }

    if (archiveType === "tar.gz") {
      await extractArchiveSafe({
        archivePath,
        destDir: targetDir,
        timeoutMs,
        kind: "tar",
        stripComponents: strip,
        tarGzip: true,
      });
      return { stdout: "", stderr: "", code: 0 };
    }

    if (archiveType === "tar.bz2") {
      if (!hasBinary("tar")) {
        return { stdout: "", stderr: "tar not found on PATH", code: null };
      }

      // Preflight list to prevent traversal before extraction.
      const listResult = await runCommandWithTimeout(["tar", "tf", archivePath], { timeoutMs });
      if (listResult.code !== 0) {
        return {
          stdout: listResult.stdout,
          stderr: listResult.stderr || "tar list failed",
          code: listResult.code,
        };
      }
      const entries = listResult.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const verboseResult = await runCommandWithTimeout(["tar", "tvf", archivePath], { timeoutMs });
      if (verboseResult.code !== 0) {
        return {
          stdout: verboseResult.stdout,
          stderr: verboseResult.stderr || "tar verbose list failed",
          code: verboseResult.code,
        };
      }
      for (const line of verboseResult.stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        const typeChar = trimmed[0];
        if (typeChar === "l" || typeChar === "h" || trimmed.includes(" -> ")) {
          return {
            stdout: verboseResult.stdout,
            stderr: "tar archive contains link entries; refusing to extract for safety",
            code: 1,
          };
        }
      }

      for (const entry of entries) {
        validateArchiveEntryPath(entry);
        const relPath = stripArchivePath(entry, strip);
        if (!relPath) {
          continue;
        }
        validateArchiveEntryPath(relPath);
        validateExtractedPathWithinRoot({ rootDir: targetDir, relPath, originalPath: entry });
      }

      const argv = ["tar", "xf", archivePath, "-C", targetDir];
      if (strip > 0) {
        argv.push("--strip-components", String(strip));
      }
      return await runCommandWithTimeout(argv, { timeoutMs });
    }

    return { stdout: "", stderr: `unsupported archive type: ${archiveType}`, code: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: message, code: 1 };
  }
}

export type SkillSecurityScanMode = "warn" | "block";

export async function scanSkillDirectory(params: {
  skillDir: string;
  skillName: string;
  criticalMode: SkillSecurityScanMode;
  criticalMessage?: (skillName: string, details: string) => string;
  warnMessage?: (skillName: string, warnCount: number) => string;
  scanFailureMessage?: (skillName: string, errorText: string) => string;
}): Promise<{ ok: boolean; warnings: string[] }> {
  const { skillDir, skillName, criticalMode, criticalMessage, warnMessage, scanFailureMessage } =
    params;

  const warnings: string[] = [];
  try {
    const summary = await scanDirectoryWithSummary(skillDir);
    if (summary.critical > 0) {
      const details = summary.findings
        .filter((finding) => finding.severity === "critical")
        .map((finding) => formatSkillScanFindingDetail(skillDir, finding))
        .join("; ");
      const msg =
        criticalMessage?.(skillName, details) ??
        (criticalMode === "block"
          ? `BLOCKED: Skill "${skillName}" contains dangerous code patterns: ${details}`
          : `WARNING: Skill "${skillName}" contains dangerous code patterns: ${details}`);
      warnings.push(msg);
      return { ok: criticalMode !== "block", warnings };
    }

    if (summary.warn > 0) {
      warnings.push(
        warnMessage?.(skillName, summary.warn) ??
          `Skill "${skillName}" has ${summary.warn} suspicious code pattern(s).`,
      );
    }
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    warnings.push(
      scanFailureMessage?.(skillName, errorText) ??
        `Security scan failed for "${skillName}" (${errorText}).`,
    );
  }

  return { ok: true, warnings };
}
