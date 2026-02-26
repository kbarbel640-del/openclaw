import crypto from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { resolvePreferredOpenClawTmpDir } from "../infra/tmp-openclaw-dir.js";

function sanitizePrefix(prefix: string): string {
  const normalized = prefix.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "tmp";
}

function sanitizeExtension(extension?: string): string {
  if (!extension) {
    return "";
  }
  const normalized = extension.startsWith(".") ? extension : `.${extension}`;
  const suffix = normalized.match(/[a-zA-Z0-9._-]+$/)?.[0] ?? "";
  const token = suffix.replace(/^[._-]+/, "");
  if (!token) {
    return "";
  }
  return `.${token}`;
}

function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-");
  const normalized = base.replace(/^-+|-+$/g, "");
  return normalized || "download.bin";
}

function resolveTempRoot(tmpDir?: string): string {
  return tmpDir ?? resolvePreferredOpenClawTmpDir();
}

function isNodeErrorWithCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === code
  );
}

/**
 * @description Builds a unique temporary file path using the pattern
 * `<tmpDir>/<prefix>-<timestamp>-<uuid><extension>`. The prefix and extension
 * are sanitized to remove characters that are unsafe in file names. This
 * function does **not** create the file; it only returns a path string.
 *
 * @param params.prefix - Human-readable prefix for the file name (unsafe chars
 *   are replaced with `-`).
 * @param params.extension - Optional file extension including the leading dot
 *   (e.g. `".jpg"`). Sanitized before use.
 * @param params.tmpDir - Override the tmp directory; defaults to
 *   `resolvePreferredOpenClawTmpDir()`.
 * @param params.now - Override the timestamp component (ms since epoch);
 *   defaults to `Date.now()`.
 * @param params.uuid - Override the UUID component; defaults to a random UUID.
 * @returns An absolute temporary file path string.
 *
 * @example
 * ```ts
 * const path = buildRandomTempFilePath({ prefix: "download", extension: ".mp4" });
 * // "/tmp/openclaw/download-1700000000000-xxxxxxxx-xxxx-xxxx.mp4"
 * ```
 */
export function buildRandomTempFilePath(params: {
  prefix: string;
  extension?: string;
  tmpDir?: string;
  now?: number;
  uuid?: string;
}): string {
  const prefix = sanitizePrefix(params.prefix);
  const extension = sanitizeExtension(params.extension);
  const nowCandidate = params.now;
  const now =
    typeof nowCandidate === "number" && Number.isFinite(nowCandidate)
      ? Math.trunc(nowCandidate)
      : Date.now();
  const uuid = params.uuid?.trim() || crypto.randomUUID();
  return path.join(resolveTempRoot(params.tmpDir), `${prefix}-${now}-${uuid}${extension}`);
}

/**
 * @description Creates a uniquely named temporary directory, invokes `fn` with
 * a path inside it, then removes the entire directory — even if `fn` throws.
 * Useful for downloading a media file to a location the caller does not need
 * to keep after processing.
 *
 * @param params.prefix - Prefix for the temp directory name.
 * @param params.fileName - Desired base name for the file inside the temp dir
 *   (unsafe chars sanitized). Defaults to `"download.bin"`.
 * @param params.tmpDir - Override the tmp root directory.
 * @param fn - Async callback invoked with the resolved temp file path.
 * @returns The value resolved by `fn`.
 * @throws Propagates any error thrown by `fn`.
 *
 * @example
 * ```ts
 * const result = await withTempDownloadPath({ prefix: "media", fileName: "photo.jpg" }, async (tmpPath) => {
 *   await downloadFile(url, tmpPath);
 *   return processImage(tmpPath);
 * });
 * ```
 */
export async function withTempDownloadPath<T>(
  params: {
    prefix: string;
    fileName?: string;
    tmpDir?: string;
  },
  fn: (tmpPath: string) => Promise<T>,
): Promise<T> {
  const tempRoot = resolveTempRoot(params.tmpDir);
  const prefix = `${sanitizePrefix(params.prefix)}-`;
  const dir = await mkdtemp(path.join(tempRoot, prefix));
  const tmpPath = path.join(dir, sanitizeFileName(params.fileName ?? "download.bin"));
  try {
    return await fn(tmpPath);
  } finally {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      if (!isNodeErrorWithCode(err, "ENOENT")) {
        console.warn(`temp-path cleanup failed for ${dir}: ${String(err)}`);
      }
    }
  }
}
