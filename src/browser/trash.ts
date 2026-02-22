import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateSecureToken } from "../infra/secure-random.js";
import { runExec } from "../process/exec.js";

export async function movePathToTrash(targetPath: string): Promise<string> {
  // Try the `trash` CLI first (works on macOS with `brew install trash`).
  try {
    await runExec("trash", [targetPath], { timeoutMs: 10_000 });
    return targetPath;
  } catch {
    // Ignore — fall through to platform-specific fallbacks.
  }

  // On Linux, try `gio trash` (GNOME/freedesktop) before manual move.
  if (process.platform === "linux") {
    try {
      await runExec("gio", ["trash", targetPath], { timeoutMs: 10_000 });
      return targetPath;
    } catch {
      // Ignore — fall through to manual move.
    }
  }

  // Manual fallback: move to platform-appropriate trash directory.
  const trashDir =
    process.platform === "linux"
      ? path.join(os.homedir(), ".local", "share", "Trash", "files")
      : path.join(os.homedir(), ".Trash");
  fs.mkdirSync(trashDir, { recursive: true });
  const base = path.basename(targetPath);
  let dest = path.join(trashDir, `${base}-${Date.now()}`);
  if (fs.existsSync(dest)) {
    dest = path.join(trashDir, `${base}-${Date.now()}-${generateSecureToken(6)}`);
  }
  fs.renameSync(targetPath, dest);
  return dest;
}
