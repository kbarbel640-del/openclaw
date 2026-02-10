import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";

export type ArchiveKind = "tar" | "zip";

export type ArchiveLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

const TAR_SUFFIXES = [".tgz", ".tar.gz", ".tar"];

function isPathInside(basePath: string, candidatePath: string): boolean {
  const base = path.resolve(basePath);
  const candidate = path.resolve(base, candidatePath);
  const rel = path.relative(base, candidate);
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
}

function resolveSafeEntryPath(params: {
  baseDir: string;
  entryPath: string;
  origin: "zip" | "tar";
}): string {
  const trimmed = params.entryPath.trim();
  if (!trimmed) {
    throw new Error(`${params.origin} entry has empty path`);
  }
  if (!isPathInside(params.baseDir, trimmed)) {
    throw new Error(`${params.origin} entry escapes destination: ${params.entryPath}`);
  }
  return path.resolve(params.baseDir, trimmed);
}

function isArchiveLinkEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  const entryType = String((entry as { type?: unknown }).type ?? "").toLowerCase();
  return entryType.includes("link");
}

export function resolveArchiveKind(filePath: string): ArchiveKind | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".zip")) {
    return "zip";
  }
  if (TAR_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return "tar";
  }
  return null;
}

export async function resolvePackedRootDir(extractDir: string): Promise<string> {
  const direct = path.join(extractDir, "package");
  try {
    const stat = await fs.stat(direct);
    if (stat.isDirectory()) {
      return direct;
    }
  } catch {
    // ignore
  }

  const entries = await fs.readdir(extractDir, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (dirs.length !== 1) {
    throw new Error(`unexpected archive layout (dirs: ${dirs.join(", ")})`);
  }
  const onlyDir = dirs[0];
  if (!onlyDir) {
    throw new Error("unexpected archive layout (no package dir found)");
  }
  return path.join(extractDir, onlyDir);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function extractZip(params: { archivePath: string; destDir: string }): Promise<void> {
  const buffer = await fs.readFile(params.archivePath);
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  const baseDir = path.resolve(params.destDir);

  for (const entry of entries) {
    const entryPath = entry.name.replaceAll("\\", "/");
    if (!entryPath || entryPath.endsWith("/")) {
      const dirPath = resolveSafeEntryPath({ baseDir, entryPath, origin: "zip" });
      await fs.mkdir(dirPath, { recursive: true });
      continue;
    }

    const outPath = resolveSafeEntryPath({ baseDir, entryPath, origin: "zip" });
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const data = await entry.async("nodebuffer");
    await fs.writeFile(outPath, data);
  }
}

export async function extractArchive(params: {
  archivePath: string;
  destDir: string;
  timeoutMs: number;
  logger?: ArchiveLogger;
}): Promise<void> {
  const kind = resolveArchiveKind(params.archivePath);
  if (!kind) {
    throw new Error(`unsupported archive: ${params.archivePath}`);
  }

  const label = kind === "zip" ? "extract zip" : "extract tar";
  if (kind === "tar") {
    const baseDir = path.resolve(params.destDir);
    const rejectedEntries: string[] = [];
    await withTimeout(
      tar.x({
        file: params.archivePath,
        cwd: params.destDir,
        filter: (entryPath, entry) => {
          try {
            resolveSafeEntryPath({ baseDir, entryPath, origin: "tar" });
          } catch (err) {
            rejectedEntries.push(err instanceof Error ? err.message : String(err));
            return false;
          }
          if (isArchiveLinkEntry(entry)) {
            rejectedEntries.push(`tar entry is a link: ${entryPath}`);
            return false;
          }
          return true;
        },
      }),
      params.timeoutMs,
      label,
    );
    if (rejectedEntries.length > 0) {
      throw new Error(rejectedEntries[0]);
    }
    return;
  }

  await withTimeout(extractZip(params), params.timeoutMs, label);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}
