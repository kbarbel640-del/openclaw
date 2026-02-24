import { cp, access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveCommonsDir } from "./registry.js";
import type { CommonsEntry, CommonsInstallResult } from "./types.js";

export type InstallOptions = {
  /** Target directory for skill/template installation. Defaults to ./skills for skills. */
  targetDir?: string;
  /** Commons directory root (defaults to repo commons/). */
  commonsDir?: string;
};

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install a commons entry to the local workspace.
 *
 * - For `skill` types: copies the skill directory into `<targetDir>/<id>/`
 * - For `workspace` types: copies the template files into `<targetDir>/`
 */
export async function installCommonsEntry(
  entry: CommonsEntry,
  options: InstallOptions = {},
): Promise<CommonsInstallResult> {
  const commonsDir = options.commonsDir ?? resolveCommonsDir();
  const sourcePath = join(commonsDir, entry.path);

  if (!(await pathExists(sourcePath))) {
    throw new Error(`Commons entry source not found: ${sourcePath}`);
  }

  let installedPath: string;

  if (entry.type === "workspace") {
    // Workspace templates copy their contents into the target directory
    installedPath = options.targetDir ?? join(process.cwd(), entry.id);
  } else {
    // Skills and other types install into a skills/ subdirectory
    const baseDir = options.targetDir ?? join(process.cwd(), "skills");
    installedPath = join(baseDir, entry.id);
  }

  const alreadyExisted = await pathExists(installedPath);

  await mkdir(installedPath, { recursive: true });
  await cp(sourcePath, installedPath, { recursive: true });

  return { entry, installedPath, alreadyExisted };
}
