import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { safeParseJson } from "../utils.js";

/**
 * @description Reads and JSON-parses a file, returning a `fallback` value
 * when the file does not exist or contains invalid JSON. Never throws.
 *
 * @param filePath - Absolute path of the JSON file to read.
 * @param fallback - Value returned when the file is missing or unparseable.
 * @returns An object with `value` (parsed content or fallback) and `exists`
 *   (`true` when the file was present on disk, even if it contained invalid JSON).
 *
 * @example
 * ```ts
 * const { value, exists } = await readJsonFileWithFallback("/data/state.json", {});
 * if (!exists) {
 *   // first run – no stored state yet
 * }
 * ```
 */
export async function readJsonFileWithFallback<T>(
  filePath: string,
  fallback: T,
): Promise<{ value: T; exists: boolean }> {
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const parsed = safeParseJson<T>(raw);
    if (parsed == null) {
      return { value: fallback, exists: true };
    }
    return { value: parsed, exists: true };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return { value: fallback, exists: false };
    }
    return { value: fallback, exists: false };
  }
}

/**
 * @description Writes a value as pretty-printed JSON to `filePath` using an
 * atomic write pattern: the data is first written to a sibling `.tmp` file and
 * then renamed into place. The directory is created if it does not exist. The
 * temp file and final file are both restricted to owner-only permissions
 * (mode `0600`/`0700`).
 *
 * @param filePath - Absolute destination path of the JSON file.
 * @param value - Any JSON-serializable value to write.
 * @returns A promise that resolves when the write is complete.
 *
 * @example
 * ```ts
 * await writeJsonFileAtomically("/data/state.json", { lastRun: Date.now() });
 * ```
 */
export async function writeJsonFileAtomically(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(dir, `${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  await fs.promises.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf-8",
  });
  await fs.promises.chmod(tmp, 0o600);
  await fs.promises.rename(tmp, filePath);
}
