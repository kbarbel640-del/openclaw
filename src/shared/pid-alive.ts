import fsSync from "node:fs";

/**
 * Check if a process is a zombie on Linux by reading /proc/<pid>/status.
 * Returns false on non-Linux platforms or if the proc file can't be read.
 */
function isZombieProcess(pid: number): boolean {
  if (process.platform !== "linux") {
    return false;
  }
  try {
    const status = fsSync.readFileSync(`/proc/${pid}/status`, "utf8");
    const stateMatch = status.match(/^State:\s+(\S)/m);
    return stateMatch?.[1] === "Z";
  } catch {
    return false;
  }
}

let cachedBootId: string | null | undefined;

/**
 * Read the Linux boot ID from /proc/sys/kernel/random/boot_id.
 * This value changes on every system/container restart, making it useful
 * for detecting stale lock files left by a previous container instance
 * whose PIDs may have been recycled in the new PID namespace.
 *
 * Returns `undefined` on non-Linux platforms or when the file is unreadable.
 * The result is cached for the lifetime of the process.
 */
export function getBootId(): string | undefined {
  if (cachedBootId !== undefined) {
    return cachedBootId ?? undefined;
  }
  try {
    cachedBootId = fsSync.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
  } catch {
    cachedBootId = null;
  }
  return cachedBootId ?? undefined;
}

/**
 * Read the start time of a process from /proc/<pid>/stat.
 * The start time (field 22) is measured in clock ticks since boot and is
 * unique per PID lifecycle — if a PID is recycled, its start time will differ.
 *
 * Returns `undefined` on non-Linux platforms or when the file is unreadable.
 */
export function getProcessStartTime(pid: number): string | undefined {
  if (process.platform !== "linux") {
    return undefined;
  }
  try {
    const stat = fsSync.readFileSync(`/proc/${pid}/stat`, "utf8");
    // Field 22 (1-indexed) is starttime. The comm field (2) may contain
    // spaces and parentheses, so we split after the closing paren.
    const afterComm = stat.slice(stat.lastIndexOf(")") + 2);
    const fields = afterComm.split(" ");
    // fields[0] = state (field 3), so starttime is fields[19] (field 22 - 3)
    return fields[19];
  } catch {
    return undefined;
  }
}

export function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  if (isZombieProcess(pid)) {
    return false;
  }
  return true;
}
