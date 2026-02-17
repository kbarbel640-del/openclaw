/**
 * DELEGATION STORAGE
 *
 * Persists delegation records to disk so they survive gateway restarts.
 * Pattern follows collaboration-storage.ts.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import type { DelegationRecord } from "./delegation-types.js";

function shouldSilenceStoreIoError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "EACCES" || code === "EPERM" || code === "EROFS";
}

function getDelegationStorePath(): string {
  const root = resolveStateDir(process.env, os.homedir);
  return path.join(root, ".delegation-storage");
}

function getDelegationPath(id: string): string {
  const storePath = getDelegationStorePath();
  const sanitized = id.replace(/[^a-z0-9-_]/g, "-");
  return path.join(storePath, `${sanitized}.json`);
}

export async function saveDelegationRecord(record: DelegationRecord): Promise<void> {
  try {
    const storePath = getDelegationStorePath();
    await fs.mkdir(storePath, { recursive: true });
    const filePath = getDelegationPath(record.id);
    const content = JSON.stringify(record, null, 2);
    // Atomic write: write to temp file then rename to prevent empty/corrupt files
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, content, "utf-8");
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // During tests/shutdown/sandboxed runs, persistence can be unavailable.
    if (shouldSilenceStoreIoError(err)) {
      return;
    }
    console.error("Failed to save delegation record:", err);
  }
}

export async function loadDelegationRecord(id: string): Promise<DelegationRecord | null> {
  try {
    const filePath = getDelegationPath(id);
    const content = await fs.readFile(filePath, "utf-8");
    if (!content.trim()) {
      // Empty file — likely a result of interrupted write; clean it up
      await fs.unlink(filePath).catch(() => {});
      return null;
    }
    return JSON.parse(content) as DelegationRecord;
  } catch (err) {
    if (!shouldSilenceStoreIoError(err)) {
      console.error("Failed to load delegation record:", err);
    }
    return null;
  }
}

export async function listDelegationRecords(): Promise<string[]> {
  try {
    const storePath = getDelegationStorePath();
    const files = await fs.readdir(storePath);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  } catch {
    return [];
  }
}

export async function loadAllDelegationRecords(): Promise<Map<string, DelegationRecord>> {
  const records = new Map<string, DelegationRecord>();
  try {
    const ids = await listDelegationRecords();
    for (const id of ids) {
      const record = await loadDelegationRecord(id);
      if (record) {
        records.set(record.id, record);
      }
    }
  } catch {
    // ignore
  }
  return records;
}

export async function deleteDelegationRecord(id: string): Promise<void> {
  try {
    const filePath = getDelegationPath(id);
    await fs.unlink(filePath);
  } catch (err) {
    if (!shouldSilenceStoreIoError(err)) {
      console.error("Failed to delete delegation record:", err);
    }
  }
}
