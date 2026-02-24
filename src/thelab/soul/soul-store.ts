/**
 * Soul Store
 *
 * Manages the lifecycle of SOUL.md files on disk.
 * Each photographer gets their own Soul directory with version history.
 *
 * Layout:
 *   ~/.thelab/souls/{photographer-id}/
 *     SOUL.md              ← current Soul
 *     SOUL.json            ← structured SoulData (for programmatic access)
 *     history/
 *       SOUL-2024-01-15.md ← previous versions
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { SoulData } from "./soul-generator.js";
import { renderSoulMarkdown } from "./soul-generator.js";

export interface SoulStoreConfig {
  /** Base directory for all souls (default: ~/.thelab/souls) */
  soulsDir: string;
  /** Max versions to keep in history */
  maxHistoryVersions: number;
}

const DEFAULT_STORE_CONFIG: SoulStoreConfig = {
  soulsDir: path.join(process.env.HOME ?? "~", ".thelab", "souls"),
  maxHistoryVersions: 10,
};

export class SoulStore {
  private config: SoulStoreConfig;

  constructor(config: Partial<SoulStoreConfig> = {}) {
    this.config = { ...DEFAULT_STORE_CONFIG, ...config };
  }

  /**
   * Get the directory path for a photographer's Soul.
   */
  getSoulDir(photographerId: string): string {
    return path.join(this.config.soulsDir, sanitizeId(photographerId));
  }

  /**
   * Save a Soul — writes both SOUL.md and SOUL.json, archiving the previous version.
   */
  async saveSoul(photographerId: string, soul: SoulData): Promise<string> {
    const dir = this.getSoulDir(photographerId);
    const historyDir = path.join(dir, "history");

    await fsp.mkdir(historyDir, { recursive: true });

    const mdPath = path.join(dir, "SOUL.md");
    const jsonPath = path.join(dir, "SOUL.json");

    // Archive existing SOUL.md if present
    if (fs.existsSync(mdPath)) {
      const stat = await fsp.stat(mdPath);
      const dateStr = stat.mtime.toISOString().slice(0, 10);
      const archiveName = `SOUL-${dateStr}.md`;
      const archivePath = path.join(historyDir, archiveName);

      // Don't overwrite same-day archives
      if (!fs.existsSync(archivePath)) {
        await fsp.copyFile(mdPath, archivePath);
      }

      // Prune old history
      await this.pruneHistory(historyDir);
    }

    // Write new Soul
    const markdown = renderSoulMarkdown(soul);
    await fsp.writeFile(mdPath, markdown, "utf-8");
    await fsp.writeFile(jsonPath, JSON.stringify(soul, null, 2), "utf-8");

    return mdPath;
  }

  /**
   * Load the current Soul markdown for a photographer.
   * Returns null if no Soul exists yet.
   */
  async loadSoulMarkdown(photographerId: string): Promise<string | null> {
    const mdPath = path.join(this.getSoulDir(photographerId), "SOUL.md");
    try {
      return await fsp.readFile(mdPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Load the structured Soul data for a photographer.
   * Returns null if no Soul exists yet.
   */
  async loadSoulData(photographerId: string): Promise<SoulData | null> {
    const jsonPath = path.join(this.getSoulDir(photographerId), "SOUL.json");
    try {
      const raw = await fsp.readFile(jsonPath, "utf-8");
      return JSON.parse(raw) as SoulData;
    } catch {
      return null;
    }
  }

  /**
   * Check if a photographer has a Soul.
   */
  hasSoul(photographerId: string): boolean {
    return fs.existsSync(path.join(this.getSoulDir(photographerId), "SOUL.md"));
  }

  /**
   * List all version dates in history.
   */
  async listHistory(photographerId: string): Promise<string[]> {
    const historyDir = path.join(this.getSoulDir(photographerId), "history");
    try {
      const files = await fsp.readdir(historyDir);
      return files
        .filter((f) => f.startsWith("SOUL-") && f.endsWith(".md"))
        .map((f) => f.replace("SOUL-", "").replace(".md", ""))
        .toSorted()
        .toReversed();
    } catch {
      return [];
    }
  }

  /**
   * Load a specific historical version.
   */
  async loadHistoricalSoul(photographerId: string, date: string): Promise<string | null> {
    const historyPath = path.join(this.getSoulDir(photographerId), "history", `SOUL-${date}.md`);
    try {
      return await fsp.readFile(historyPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Delete a photographer's Soul entirely.
   */
  async deleteSoul(photographerId: string): Promise<void> {
    const dir = this.getSoulDir(photographerId);
    if (fs.existsSync(dir)) {
      await fsp.rm(dir, { recursive: true });
    }
  }

  private async pruneHistory(historyDir: string): Promise<void> {
    try {
      const files = (await fsp.readdir(historyDir))
        .filter((f) => f.startsWith("SOUL-") && f.endsWith(".md"))
        .toSorted();

      while (files.length > this.config.maxHistoryVersions) {
        const oldest = files.shift()!;
        await fsp.unlink(path.join(historyDir, oldest));
      }
    } catch {
      // Non-fatal — history pruning is best-effort
    }
  }
}

/**
 * Sanitize a photographer ID for use as a directory name.
 */
function sanitizeId(id: string): string {
  return (
    id
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "default"
  );
}
