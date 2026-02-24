/**
 * Memory integrity manifest.
 *
 * Tracks the expected hash of each memory file as last written by the agent.
 * On startup, syncMemoryFiles compares actual hashes against the manifest.
 * A mismatch means the file was modified externally (outside the agent),
 * which is logged as a warning so the agent can decide how to respond.
 *
 * The manifest is stored at <workspaceDir>/.memory-manifest.json.
 * It is intentionally a plain JSON file (not in the SQLite DB) so it
 * survives DB resets and can be inspected/audited by humans.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("memory/integrity");

const MANIFEST_FILENAME = ".memory-manifest.json";

type ManifestEntry = {
  hash: string;
  updatedAt: number; // unix ms, when the agent last wrote this file
};

type Manifest = Record<string, ManifestEntry>; // key = relative path

async function manifestPath(workspaceDir: string): Promise<string> {
  return path.join(workspaceDir, MANIFEST_FILENAME);
}

async function readManifest(workspaceDir: string): Promise<Manifest> {
  try {
    const raw = await fs.readFile(await manifestPath(workspaceDir), "utf-8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return {};
  }
}

async function writeManifest(workspaceDir: string, manifest: Manifest): Promise<void> {
  await fs.writeFile(
    await manifestPath(workspaceDir),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
}

/**
 * Record that the agent has written (or confirmed) a memory file with the
 * given hash. Call this after the agent successfully writes MEMORY.md etc.
 */
export async function recordAgentWrite(
  workspaceDir: string,
  relPath: string,
  hash: string,
): Promise<void> {
  const manifest = await readManifest(workspaceDir);
  manifest[relPath] = { hash, updatedAt: Date.now() };
  await writeManifest(workspaceDir, manifest);
}

/**
 * Check a set of file entries against the manifest.
 * Returns entries where the actual hash differs from the manifest's expected
 * hash — these files were likely modified externally.
 *
 * Files not present in the manifest are skipped (no baseline to compare).
 */
export async function checkIntegrity(
  workspaceDir: string,
  entries: Array<{ path: string; hash: string }>,
): Promise<Array<{ path: string; expectedHash: string; actualHash: string }>> {
  const manifest = await readManifest(workspaceDir);
  const violations: Array<{ path: string; expectedHash: string; actualHash: string }> = [];

  for (const entry of entries) {
    const expected = manifest[entry.path];
    if (!expected) continue; // no baseline — skip
    if (expected.hash !== entry.hash) {
      violations.push({
        path: entry.path,
        expectedHash: expected.hash,
        actualHash: entry.hash,
      });
    }
  }

  if (violations.length > 0) {
    log.warn("memory integrity check: external modifications detected", {
      count: violations.length,
      paths: violations.map((v) => v.path),
    });
  }

  return violations;
}
