/**
 * Config Store — reads and writes the OpenClaw configuration file (openclaw.json)
 * that lives inside the managed container's config directory.
 *
 * The store always works with the host-side mounted config dir, making edits
 * visible to the container immediately (or after a graceful reload).
 *
 * Writes are atomic: write to .tmp → fsync → rename to prevent corruption.
 */

import { app } from "electron";
import path from "node:path";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const CONFIG_FILENAME = "openclaw.json";

export interface ConfigReadResult {
  config: Record<string, unknown>;
  raw: string;
  checksum: string;
  configPath: string;
}

export interface ConfigWriteResult {
  ok: boolean;
  error?: string;
  checksum: string;
}

export class ConfigStore {
  private configDir: string;

  constructor(configDir?: string) {
    // Default to the openclaw-config dir set during installation
    this.configDir = configDir ?? path.join(app.getPath("userData"), "openclaw-config");
  }

  /** Read the current config file into a parsed object. */
  async read(): Promise<ConfigReadResult> {
    const configPath = path.join(this.configDir, CONFIG_FILENAME);

    let raw: string;
    try {
      raw = await readFile(configPath, "utf-8");
    } catch (err: unknown) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
        // No config yet — return empty object (openclaw uses defaults)
        raw = "{}";
      } else {
        throw new Error(`Cannot read config: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
      }
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(raw);
    } catch {
      throw new Error("Config file contains invalid JSON. Edit manually to fix.");
    }

    const checksum = createHash("sha256").update(raw).digest("hex").slice(0, 16);
    return { config, raw, checksum, configPath };
  }

  /**
   * Write the config file atomically.
   *
   * @param config - Parsed config object to write
   * @param expectedChecksum - If provided, fails if the file has changed since last read (optimistic lock)
   */
  async write(
    config: Record<string, unknown>,
    expectedChecksum?: string,
  ): Promise<ConfigWriteResult> {
    const configPath = path.join(this.configDir, CONFIG_FILENAME);
    const tmpPath = `${configPath}.tmp`;

    // Optimistic concurrency check
    if (expectedChecksum) {
      try {
        const current = await this.read();
        if (current.checksum !== expectedChecksum) {
          return {
            ok: false,
            error: "Config was modified by another process. Refresh and try again.",
            checksum: current.checksum,
          };
        }
      } catch {
        // File doesn't exist yet — that's fine
      }
    }

    try {
      await mkdir(this.configDir, { recursive: true });
      const json = JSON.stringify(config, null, 2) + "\n";
      await writeFile(tmpPath, json, { encoding: "utf-8", flush: true });
      await rename(tmpPath, configPath);
      const checksum = createHash("sha256").update(json).digest("hex").slice(0, 16);
      return { ok: true, checksum };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err), checksum: "" };
    }
  }

  /**
   * Deep merge a partial config onto the existing config and write.
   * Only keys present in `patch` are updated.
   */
  async patch(
    patch: Record<string, unknown>,
    expectedChecksum?: string,
  ): Promise<ConfigWriteResult> {
    const { config } = await this.read();
    const merged = deepMerge(config, patch);
    return this.write(merged, expectedChecksum);
  }

  /** Get the resolved path to the config file (for display). */
  getConfigPath(): string {
    return path.join(this.configDir, CONFIG_FILENAME);
  }
}

/** Recursive deep merge — objects are merged, non-objects are replaced. */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}
