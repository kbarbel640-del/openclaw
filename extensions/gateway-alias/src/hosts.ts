import { readFileSync, writeFileSync } from "node:fs";

const HOSTS_FILE = "/etc/hosts";
const MARKER_START = "# >>> openclaw-gateway-alias";
const MARKER_END = "# <<< openclaw-gateway-alias";

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
};

/**
 * Build the managed hosts block for the given hostnames.
 */
function buildHostsBlock(hostnames: string[]): string {
  return [MARKER_START, ...hostnames.map((h) => `127.0.0.1\t${h}`), MARKER_END].join("\n");
}

/**
 * Regex matching the managed hosts block (MARKER_START … MARKER_END).
 */
function markerRegex(): RegExp {
  return new RegExp(`${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Synchronize /etc/hosts with the given alias hostnames.
 *
 * Writes a marked block so entries can be cleanly updated/removed later.
 * Returns true on success, false if the file could not be written
 * (e.g. missing privileges).
 */
export function syncHostsFile(hostnames: string[], log: Logger): boolean {
  if (hostnames.length === 0) return true;

  try {
    const current = readFileSync(HOSTS_FILE, "utf-8");
    const block = buildHostsBlock(hostnames);
    const re = markerRegex();
    const match = current.match(re);

    // Already up to date?
    if (match && match[0] === block) {
      log.info(`/etc/hosts already contains: ${hostnames.join(", ")}`);
      return true;
    }

    const updated = match ? current.replace(re, block) : current.trimEnd() + "\n" + block + "\n";

    writeFileSync(HOSTS_FILE, updated, "utf-8");
    log.info(`/etc/hosts updated for: ${hostnames.join(", ")}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // EACCES is expected when running without elevated privileges.
    if (message.includes("EACCES") || message.includes("permission denied")) {
      log.warn(`/etc/hosts update requires elevated privileges. Run: openclaw gateway-alias setup`);
    } else {
      log.warn(`/etc/hosts update failed: ${message}`);
    }
    return false;
  }
}

/**
 * Remove the managed hosts block from /etc/hosts.
 * Used during uninstall/teardown.
 */
export function removeHostsBlock(log: Logger): boolean {
  try {
    const current = readFileSync(HOSTS_FILE, "utf-8");
    const re = markerRegex();
    if (!re.test(current)) return true;

    const updated = current.replace(re, "").replace(/\n{3,}/g, "\n\n");
    writeFileSync(HOSTS_FILE, updated, "utf-8");
    log.info("/etc/hosts: removed gateway-alias block");
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`/etc/hosts cleanup failed: ${message}`);
    return false;
  }
}

/**
 * Check whether /etc/hosts already contains the managed block with the
 * expected hostnames.
 */
export function hostsFileIsUpToDate(hostnames: string[]): boolean {
  if (hostnames.length === 0) return true;
  try {
    const current = readFileSync(HOSTS_FILE, "utf-8");
    const block = buildHostsBlock(hostnames);
    return current.includes(block);
  } catch {
    return false;
  }
}
