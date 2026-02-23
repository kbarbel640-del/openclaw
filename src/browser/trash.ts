import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateSecureToken } from "../infra/secure-random.js";
import { runExec } from "../process/exec.js";

/**
 * Attempt to move a path to the system trash.
 *
 * Tries platform-appropriate trash commands in order:
 * 1. `trash` (cross-platform, e.g. `trash-cli` or macOS built-in)
 * 2. `gio trash` (GNOME/freedesktop on Linux)
 * 3. `trash-put` (trash-cli package on Linux)
 *
 * Falls back to a manual rename into ~/.Trash if all commands fail.
 */
export async function movePathToTrash(targetPath: string): Promise<string> {
  // Try platform trash commands in order of preference
  const trashCommands: Array<{ cmd: string; args: string[] }> = [
    { cmd: "trash", args: [targetPath] },
    { cmd: "gio", args: ["trash", targetPath] },
    { cmd: "trash-put", args: [targetPath] },
  ];

  for (const { cmd, args } of trashCommands) {
    try {
      await runExec(cmd, args, { timeoutMs: 10_000 });
      return targetPath;
    } catch {
      // Command not found or failed — try next
    }
  }

  // All commands failed — manual fallback
  const trashDir = path.join(os.homedir(), ".Trash");
  fs.mkdirSync(trashDir, { recursive: true });
  const base = path.basename(targetPath);
  let dest = path.join(trashDir, `${base}-${Date.now()}`);
  if (fs.existsSync(dest)) {
    dest = path.join(trashDir, `${base}-${Date.now()}-${generateSecureToken(6)}`);
  }
  fs.renameSync(targetPath, dest);
  return dest;
}
