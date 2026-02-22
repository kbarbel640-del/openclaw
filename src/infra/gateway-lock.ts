import { createHash } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { resolveConfigPath, resolveGatewayLockDir, resolveStateDir } from "../config/paths.js";
import { isPidAlive } from "../shared/pid-alive.js";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_STALE_MS = 30_000;

type LockPayload = {
  pid: number;
  createdAt: string;
  configPath: string;
  startTime?: number;
};

export type GatewayLockHandle = {
  lockPath: string;
  configPath: string;
  release: () => Promise<void>;
};

export type GatewayLockOptions = {
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  pollIntervalMs?: number;
  staleMs?: number;
  allowInTests?: boolean;
  platform?: NodeJS.Platform;
  /**
   * The port the gateway will bind to. When provided, port reachability is
   * used as the primary liveness signal: if nothing is listening on the port
   * the lock is definitionally stale, regardless of PID state.
   *
   * Port binding is kernel-managed and is released automatically on any form
   * of process termination including SIGKILL, making it immune to the stale-
   * lock problem that arises when the cleanup handler cannot run.
   */
  port?: number;
};

export class GatewayLockError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GatewayLockError";
  }
}

type LockOwnerStatus = "alive" | "dead" | "unknown";

function normalizeProcArg(arg: string): string {
  return arg.replaceAll("\\", "/").toLowerCase();
}

function parseProcCmdline(raw: string): string[] {
  return raw
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isGatewayArgv(args: string[]): boolean {
  const normalized = args.map(normalizeProcArg);
  if (!normalized.includes("gateway")) {
    return false;
  }

  const entryCandidates = [
    "dist/index.js",
    "dist/entry.js",
    "openclaw.mjs",
    "scripts/run-node.mjs",
    "src/index.ts",
  ];
  if (normalized.some((arg) => entryCandidates.some((entry) => arg.endsWith(entry)))) {
    return true;
  }

  const exe = normalized[0] ?? "";
  return exe.endsWith("/openclaw") || exe === "openclaw";
}

function readLinuxCmdline(pid: number): string[] | null {
  try {
    const raw = fsSync.readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return parseProcCmdline(raw);
  } catch {
    return null;
  }
}

function readLinuxStartTime(pid: number): number | null {
  try {
    const raw = fsSync.readFileSync(`/proc/${pid}/stat`, "utf8").trim();
    const closeParen = raw.lastIndexOf(")");
    if (closeParen < 0) {
      return null;
    }
    const rest = raw.slice(closeParen + 1).trim();
    const fields = rest.split(/\s+/);
    const startTime = Number.parseInt(fields[19] ?? "", 10);
    return Number.isFinite(startTime) ? startTime : null;
  } catch {
    return null;
  }
}

/**
 * Probe whether a TCP port is free by attempting a connection.
 *
 * Returns true if nothing is listening (connection refused), false if
 * something is listening. Uses connect rather than bind so we never
 * transiently occupy the port ourselves.
 */
function checkPortFree(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false); // something is listening → port not free
    });
    socket.once("error", () => {
      resolve(true); // connection refused → port free
    });
  });
}

/**
 * Determine whether the process that wrote the lock file is still a live
 * gateway owner.
 *
 * Port binding is checked first when a port is supplied: it is kernel-managed
 * and is released on any form of process termination (including SIGKILL),
 * making it the most reliable liveness signal. The PID/startTime checks that
 * follow serve as an identity guard to confirm the listening process is
 * actually the gateway described by the lock, not an unrelated service that
 * happened to bind the same port.
 */
async function resolveGatewayOwnerStatus(
  pid: number,
  payload: LockPayload | null,
  platform: NodeJS.Platform,
  port: number | undefined,
): Promise<LockOwnerStatus> {
  // Primary check: port binding is kernel-managed and survives SIGKILL.
  // If the port is free, no gateway is running — the lock is definitionally
  // stale regardless of what the PID or lock file says.
  if (port != null) {
    const portFree = await checkPortFree(port);
    if (portFree) {
      return "dead";
    }
  }

  // Secondary check: confirm the PID from the lock file is still alive.
  // isPidAlive already filters out zombie processes on Linux.
  if (!isPidAlive(pid)) {
    return "dead";
  }

  if (platform !== "linux") {
    return "alive";
  }

  // Identity check: verify the living PID is the same process that wrote the
  // lock (not a recycled PID) by comparing kernel-reported start times.
  const payloadStartTime = payload?.startTime;
  if (Number.isFinite(payloadStartTime)) {
    const currentStartTime = readLinuxStartTime(pid);
    if (currentStartTime == null) {
      return "unknown";
    }
    return currentStartTime === payloadStartTime ? "alive" : "dead";
  }

  // Fallback: inspect argv to see if the PID looks like a gateway process.
  const args = readLinuxCmdline(pid);
  if (!args) {
    return "unknown";
  }
  return isGatewayArgv(args) ? "alive" : "dead";
}

async function readLockPayload(lockPath: string): Promise<LockPayload | null> {
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LockPayload>;
    if (typeof parsed.pid !== "number") {
      return null;
    }
    if (typeof parsed.createdAt !== "string") {
      return null;
    }
    if (typeof parsed.configPath !== "string") {
      return null;
    }
    const startTime = typeof parsed.startTime === "number" ? parsed.startTime : undefined;
    return {
      pid: parsed.pid,
      createdAt: parsed.createdAt,
      configPath: parsed.configPath,
      startTime,
    };
  } catch {
    return null;
  }
}

function resolveGatewayLockPath(env: NodeJS.ProcessEnv) {
  const stateDir = resolveStateDir(env);
  const configPath = resolveConfigPath(env, stateDir);
  const hash = createHash("sha256").update(configPath).digest("hex").slice(0, 8);
  const lockDir = resolveGatewayLockDir();
  const lockPath = path.join(lockDir, `gateway.${hash}.lock`);
  return { lockPath, configPath };
}

export async function acquireGatewayLock(
  opts: GatewayLockOptions = {},
): Promise<GatewayLockHandle | null> {
  const env = opts.env ?? process.env;
  const allowInTests = opts.allowInTests === true;
  if (
    env.OPENCLAW_ALLOW_MULTI_GATEWAY === "1" ||
    (!allowInTests && (env.VITEST || env.NODE_ENV === "test"))
  ) {
    return null;
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
  const platform = opts.platform ?? process.platform;
  const port = opts.port;
  const { lockPath, configPath } = resolveGatewayLockPath(env);
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  const startedAt = Date.now();
  let lastPayload: LockPayload | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const handle = await fs.open(lockPath, "wx");
      const startTime = platform === "linux" ? readLinuxStartTime(process.pid) : null;
      const payload: LockPayload = {
        pid: process.pid,
        createdAt: new Date().toISOString(),
        configPath,
      };
      if (typeof startTime === "number" && Number.isFinite(startTime)) {
        payload.startTime = startTime;
      }
      await handle.writeFile(JSON.stringify(payload), "utf8");
      return {
        lockPath,
        configPath,
        release: async () => {
          await handle.close().catch(() => undefined);
          await fs.rm(lockPath, { force: true });
        },
      };
    } catch (err) {
      const code = (err as { code?: unknown }).code;
      if (code !== "EEXIST") {
        throw new GatewayLockError(`failed to acquire gateway lock at ${lockPath}`, err);
      }

      lastPayload = await readLockPayload(lockPath);
      const ownerPid = lastPayload?.pid;
      const ownerStatus = ownerPid
        ? await resolveGatewayOwnerStatus(ownerPid, lastPayload, platform, port)
        : "unknown";
      if (ownerStatus === "dead" && ownerPid) {
        await fs.rm(lockPath, { force: true });
        continue;
      }
      if (ownerStatus !== "alive") {
        let stale = false;
        if (lastPayload?.createdAt) {
          const createdAt = Date.parse(lastPayload.createdAt);
          stale = Number.isFinite(createdAt) ? Date.now() - createdAt > staleMs : false;
        }
        if (!stale) {
          try {
            const st = await fs.stat(lockPath);
            stale = Date.now() - st.mtimeMs > staleMs;
          } catch {
            // On Windows or locked filesystems we may be unable to stat the
            // lock file even though the existing gateway is still healthy.
            // Treat the lock as non-stale so we keep waiting instead of
            // forcefully removing another gateway's lock.
            stale = false;
          }
        }
        if (stale) {
          await fs.rm(lockPath, { force: true });
          continue;
        }
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  const owner = lastPayload?.pid ? ` (pid ${lastPayload.pid})` : "";
  throw new GatewayLockError(`gateway already running${owner}; lock timeout after ${timeoutMs}ms`);
}
