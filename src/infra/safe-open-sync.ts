import fs from "node:fs";
import { sameFileIdentity as hasSameFileIdentity } from "./file-identity.js";

export type SafeOpenSyncFailureReason = "path" | "validation" | "io";

export type SafeOpenSyncResult =
  | { ok: true; path: string; fd: number; stat: fs.Stats }
  | { ok: false; reason: SafeOpenSyncFailureReason; error?: unknown };

type SafeOpenSyncFs = Pick<
  typeof fs,
  "constants" | "lstatSync" | "realpathSync" | "openSync" | "fstatSync" | "closeSync"
>;

function formatStatSummary(stat: fs.Stats): string {
  return `dev=${String(stat.dev)} ino=${String(stat.ino)} nlink=${stat.nlink} size=${stat.size}`;
}

function validationFailure(detail: string): SafeOpenSyncResult {
  return { ok: false, reason: "validation", error: new Error(detail) };
}

function isExpectedPathError(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  return code === "ENOENT" || code === "ENOTDIR" || code === "ELOOP";
}

export function sameFileIdentity(left: fs.Stats, right: fs.Stats): boolean {
  return hasSameFileIdentity(left, right);
}

export function openVerifiedFileSync(params: {
  filePath: string;
  resolvedPath?: string;
  rejectPathSymlink?: boolean;
  rejectHardlinks?: boolean;
  maxBytes?: number;
  ioFs?: SafeOpenSyncFs;
}): SafeOpenSyncResult {
  const ioFs = params.ioFs ?? fs;
  const openReadFlags =
    ioFs.constants.O_RDONLY |
    (typeof ioFs.constants.O_NOFOLLOW === "number" ? ioFs.constants.O_NOFOLLOW : 0);
  let fd: number | null = null;
  try {
    if (params.rejectPathSymlink) {
      const candidateStat = ioFs.lstatSync(params.filePath);
      if (candidateStat.isSymbolicLink()) {
        return validationFailure(`path symlink rejected: ${params.filePath}`);
      }
    }

    const realPath = params.resolvedPath ?? ioFs.realpathSync(params.filePath);
    const preOpenStat = ioFs.lstatSync(realPath);
    if (!preOpenStat.isFile()) {
      return validationFailure(`pre-open path is not a regular file: ${realPath}`);
    }
    if (params.rejectHardlinks && preOpenStat.nlink > 1) {
      return validationFailure(
        `pre-open hardlink rejected: ${realPath} (${formatStatSummary(preOpenStat)})`,
      );
    }
    if (params.maxBytes !== undefined && preOpenStat.size > params.maxBytes) {
      return validationFailure(
        `pre-open size exceeds maxBytes=${params.maxBytes}: ${realPath} (${formatStatSummary(preOpenStat)})`,
      );
    }

    fd = ioFs.openSync(realPath, openReadFlags);
    const openedStat = ioFs.fstatSync(fd);
    if (!openedStat.isFile()) {
      return validationFailure(`fd is not a regular file after open: ${realPath}`);
    }
    if (params.rejectHardlinks && openedStat.nlink > 1) {
      return validationFailure(
        `post-open hardlink rejected: ${realPath} (${formatStatSummary(openedStat)})`,
      );
    }
    if (params.maxBytes !== undefined && openedStat.size > params.maxBytes) {
      return validationFailure(
        `post-open size exceeds maxBytes=${params.maxBytes}: ${realPath} (${formatStatSummary(openedStat)})`,
      );
    }
    if (!sameFileIdentity(preOpenStat, openedStat)) {
      return validationFailure(
        `pre/post-open identity mismatch: pre(${formatStatSummary(preOpenStat)}) post(${formatStatSummary(openedStat)}) path=${realPath}`,
      );
    }

    const opened = { ok: true as const, path: realPath, fd, stat: openedStat };
    fd = null;
    return opened;
  } catch (error) {
    if (isExpectedPathError(error)) {
      return { ok: false, reason: "path", error };
    }
    return { ok: false, reason: "io", error };
  } finally {
    if (fd !== null) {
      ioFs.closeSync(fd);
    }
  }
}
