import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs, { type FileHandle } from "node:fs/promises";
import path from "node:path";

type ExecDockerRawOptions = {
  allowFailure?: boolean;
  input?: Buffer | string;
  signal?: AbortSignal;
};

export type ExecDockerRawResult = {
  stdout: Buffer;
  stderr: Buffer;
  code: number;
};

type ExecDockerRawError = Error & {
  code: number;
  stdout: Buffer;
  stderr: Buffer;
};

function createAbortError(): Error {
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err;
}

export function execDockerRaw(
  args: string[],
  opts?: ExecDockerRawOptions,
): Promise<ExecDockerRawResult> {
  return new Promise<ExecDockerRawResult>((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let aborted = false;

    const signal = opts?.signal;
    const handleAbort = () => {
      if (aborted) {
        return;
      }
      aborted = true;
      child.kill("SIGTERM");
    };
    if (signal) {
      if (signal.aborted) {
        handleAbort();
      } else {
        signal.addEventListener("abort", handleAbort);
      }
    }

    child.stdout?.on("data", (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.on("error", (error) => {
      if (signal) {
        signal.removeEventListener("abort", handleAbort);
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (signal) {
        signal.removeEventListener("abort", handleAbort);
      }
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      if (aborted || signal?.aborted) {
        reject(createAbortError());
        return;
      }
      const exitCode = code ?? 0;
      if (exitCode !== 0 && !opts?.allowFailure) {
        const message = stderr.length > 0 ? stderr.toString("utf8").trim() : "";
        const error: ExecDockerRawError = Object.assign(
          new Error(message || `docker ${args.join(" ")} failed`),
          {
            code: exitCode,
            stdout,
            stderr,
          },
        );
        reject(error);
        return;
      }
      resolve({ stdout, stderr, code: exitCode });
    });

    const stdin = child.stdin;
    if (stdin) {
      if (opts?.input !== undefined) {
        stdin.end(opts.input);
      } else {
        stdin.end();
      }
    }
  });
}

import type { SandboxConfig, SandboxDockerConfig, SandboxWorkspaceAccess } from "./types.js";
import { formatCliCommand } from "../../cli/command-format.js";
import { STATE_DIR } from "../../config/config.js";
import { defaultRuntime } from "../../runtime.js";
import { computeSandboxConfigHash } from "./config-hash.js";
import { DEFAULT_SANDBOX_IMAGE, SANDBOX_AGENT_WORKSPACE_MOUNT } from "./constants.js";
import { readRegistry, updateRegistry } from "./registry.js";
import { resolveSandboxAgentId, resolveSandboxScopeKey, slugifySessionKey } from "./shared.js";

const HOT_CONTAINER_WINDOW_MS = 5 * 60 * 1000;
const CLIPORT_TOKEN_ENV_KEY = "CLIPORT_TOKEN";
const CLIPORT_SESSION_KEY_ENV_KEY = "CLIPORT_SESSION_KEY";
const CLIPORT_CONTAINER_NAME_ENV_KEY = "CLIPORT_CONTAINER_NAME";
const CLIPORT_TOKENS_PATH = path.join(STATE_DIR, "cliport", "tokens.json");
const CLIPORT_TOKENS_LOCK_TIMEOUT_MS = 5000;
const CLIPORT_TOKENS_LOCK_RETRY_MS = 25;
const CLIPORT_TOKENS_LOCK_STALE_MS = 30_000;

function isCliportEnabled(cfg: SandboxDockerConfig): boolean {
  return (cfg.binds ?? []).some((bind) => bind.includes("cliport.sock"));
}

function generateCliportToken(): string {
  return randomBytes(24).toString("hex");
}

type CliportTokenEntry = {
  token: string;
  sessionKey?: string;
  containerName?: string;
};

type CliportTokenWriteOptions = {
  tokensPath?: string;
  lockTimeoutMs?: number;
  lockRetryMs?: number;
  lockStaleMs?: number;
  /** Test-only: increase race window between read and write. */
  delayAfterReadMs?: number;
};

type CliportTokenLockMetadata = {
  pid?: number;
  createdAtMs?: number;
};

function parseCliportTokenEntry(value: unknown): CliportTokenEntry | null {
  if (typeof value === "string") {
    const token = value.trim();
    return token ? { token } : null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const token = typeof record.token === "string" ? record.token.trim() : "";
  if (!token) {
    return null;
  }
  const sessionKey = typeof record.sessionKey === "string" ? record.sessionKey.trim() : "";
  const containerName = typeof record.containerName === "string" ? record.containerName.trim() : "";
  return {
    token,
    sessionKey: sessionKey || undefined,
    containerName: containerName || undefined,
  };
}

async function ensureCliportTokenAllowed(
  token: string,
  binding?: { sessionKey?: string; containerName?: string },
  options?: CliportTokenWriteOptions,
): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) {
    return;
  }
  const tokensPath = options?.tokensPath?.trim() || CLIPORT_TOKENS_PATH;
  const lockTimeoutMs = Math.max(
    100,
    Math.floor(options?.lockTimeoutMs ?? CLIPORT_TOKENS_LOCK_TIMEOUT_MS),
  );
  const lockRetryMs = Math.max(
    5,
    Math.floor(options?.lockRetryMs ?? CLIPORT_TOKENS_LOCK_RETRY_MS),
  );
  const lockStaleMs = Math.max(
    1_000,
    Math.floor(options?.lockStaleMs ?? CLIPORT_TOKENS_LOCK_STALE_MS),
  );

  await fs.mkdir(path.dirname(tokensPath), { recursive: true });
  await withFileLock(
    {
      lockPath: `${tokensPath}.lock`,
      timeoutMs: lockTimeoutMs,
      retryMs: lockRetryMs,
      staleMs: lockStaleMs,
    },
    async () => {
      const raw = await fs.readFile(tokensPath, "utf-8").catch(() => "");
      let parsed: { tokens?: unknown } | null = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw) as { tokens?: unknown };
        } catch {
          parsed = null;
        }
      }

      if (typeof options?.delayAfterReadMs === "number" && options.delayAfterReadMs > 0) {
        await sleep(options.delayAfterReadMs);
      }

      const existing = Array.isArray(parsed?.tokens)
        ? parsed.tokens
            .map((entry) => parseCliportTokenEntry(entry))
            .filter((entry): entry is CliportTokenEntry => Boolean(entry))
        : [];
      const nextByToken = new Map<string, CliportTokenEntry>();
      for (const entry of existing) {
        nextByToken.set(entry.token, entry);
      }
      const current = nextByToken.get(trimmed);
      const nextEntry: CliportTokenEntry = {
        token: trimmed,
        sessionKey: binding?.sessionKey?.trim() || current?.sessionKey,
        containerName: binding?.containerName?.trim() || current?.containerName,
      };
      const unchanged =
        current !== undefined &&
        current.token === nextEntry.token &&
        (current.sessionKey ?? undefined) === (nextEntry.sessionKey ?? undefined) &&
        (current.containerName ?? undefined) === (nextEntry.containerName ?? undefined);
      if (unchanged) {
        return;
      }
      nextByToken.set(trimmed, nextEntry);

      const next = Array.from(nextByToken.values());
      await writeFileAtomic(tokensPath, `${JSON.stringify({ tokens: next }, null, 2)}\n`);
    },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquireLockFile(params: {
  lockPath: string;
  timeoutMs: number;
  retryMs: number;
  staleMs: number;
}): Promise<FileHandle> {
  const startedAt = Date.now();
  while (true) {
    try {
      const handle = await fs.open(params.lockPath, "wx");
      await writeLockMetadata(handle);
      return handle;
    } catch (err) {
      const code = err && typeof err === "object" ? (err as { code?: unknown }).code : undefined;
      if (code !== "EEXIST") {
        throw err;
      }
      const released = await releaseStaleLockIfNeeded({
        lockPath: params.lockPath,
        staleMs: params.staleMs,
      });
      if (released) {
        continue;
      }
      if (Date.now() - startedAt >= params.timeoutMs) {
        throw new Error(`timed out acquiring cliport token lock: ${params.lockPath}`);
      }
      await sleep(params.retryMs);
    }
  }
}

async function withFileLock<T>(
  params: { lockPath: string; timeoutMs: number; retryMs: number; staleMs: number },
  task: () => Promise<T>,
): Promise<T> {
  const handle = await acquireLockFile(params);
  try {
    return await task();
  } finally {
    await handle.close().catch(() => {});
    await fs.unlink(params.lockPath).catch(() => {});
  }
}

async function writeLockMetadata(handle: FileHandle): Promise<void> {
  const payload: CliportTokenLockMetadata = {
    pid: process.pid,
    createdAtMs: Date.now(),
  };
  await handle.writeFile(`${JSON.stringify(payload)}\n`, "utf-8").catch(() => {});
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: unknown }).code : undefined;
    return code === "EPERM";
  }
}

async function readLockMetadata(lockPath: string): Promise<{
  createdAtMs?: number;
  pid?: number;
  mtimeMs?: number;
}> {
  const stat = await fs.stat(lockPath).catch(() => null);
  if (!stat) {
    return {};
  }
  const raw = await fs.readFile(lockPath, "utf-8").catch(() => "");
  if (!raw.trim()) {
    return { mtimeMs: stat.mtimeMs };
  }
  try {
    const parsed = JSON.parse(raw) as CliportTokenLockMetadata;
    const createdAtMs =
      typeof parsed.createdAtMs === "number" && Number.isFinite(parsed.createdAtMs)
        ? parsed.createdAtMs
        : undefined;
    const pid =
      typeof parsed.pid === "number" && Number.isFinite(parsed.pid) ? Math.floor(parsed.pid) : undefined;
    return { createdAtMs, pid, mtimeMs: stat.mtimeMs };
  } catch {
    return { mtimeMs: stat.mtimeMs };
  }
}

async function releaseStaleLockIfNeeded(params: {
  lockPath: string;
  staleMs: number;
}): Promise<boolean> {
  const lock = await readLockMetadata(params.lockPath);
  const createdAtMs = lock.createdAtMs ?? lock.mtimeMs;
  if (typeof createdAtMs !== "number" || !Number.isFinite(createdAtMs)) {
    return false;
  }
  if (Date.now() - createdAtMs < params.staleMs) {
    return false;
  }
  if (typeof lock.pid === "number" && isProcessAlive(lock.pid)) {
    return false;
  }
  try {
    await fs.unlink(params.lockPath);
    return true;
  } catch {
    return false;
  }
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  let hasTemp = false;
  try {
    await fs.writeFile(tmpPath, content, "utf-8");
    hasTemp = true;
    await fs.rename(tmpPath, filePath);
    hasTemp = false;
  } finally {
    if (hasTemp) {
      await fs.unlink(tmpPath).catch(() => {});
    }
  }
}

export type ExecDockerOptions = ExecDockerRawOptions;

export async function execDocker(args: string[], opts?: ExecDockerOptions) {
  const result = await execDockerRaw(args, opts);
  return {
    stdout: result.stdout.toString("utf8"),
    stderr: result.stderr.toString("utf8"),
    code: result.code,
  };
}

export async function readDockerPort(containerName: string, port: number) {
  const result = await execDocker(["port", containerName, `${port}/tcp`], {
    allowFailure: true,
  });
  if (result.code !== 0) {
    return null;
  }
  const line = result.stdout.trim().split(/\r?\n/)[0] ?? "";
  const match = line.match(/:(\d+)\s*$/);
  if (!match) {
    return null;
  }
  const mapped = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(mapped) ? mapped : null;
}

async function dockerImageExists(image: string) {
  const result = await execDocker(["image", "inspect", image], {
    allowFailure: true,
  });
  if (result.code === 0) {
    return true;
  }
  const stderr = result.stderr.trim();
  if (stderr.includes("No such image")) {
    return false;
  }
  throw new Error(`Failed to inspect sandbox image: ${stderr}`);
}

export async function ensureDockerImage(image: string) {
  const exists = await dockerImageExists(image);
  if (exists) {
    return;
  }
  if (image === DEFAULT_SANDBOX_IMAGE) {
    await execDocker(["pull", "debian:bookworm-slim"]);
    await execDocker(["tag", "debian:bookworm-slim", DEFAULT_SANDBOX_IMAGE]);
    return;
  }
  throw new Error(`Sandbox image not found: ${image}. Build or pull it first.`);
}

export async function dockerContainerState(name: string) {
  const result = await execDocker(["inspect", "-f", "{{.State.Running}}", name], {
    allowFailure: true,
  });
  if (result.code !== 0) {
    return { exists: false, running: false };
  }
  return { exists: true, running: result.stdout.trim() === "true" };
}

function normalizeDockerLimit(value?: string | number) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function formatUlimitValue(
  name: string,
  value: string | number | { soft?: number; hard?: number },
) {
  if (!name.trim()) {
    return null;
  }
  if (typeof value === "number" || typeof value === "string") {
    const raw = String(value).trim();
    return raw ? `${name}=${raw}` : null;
  }
  const soft = typeof value.soft === "number" ? Math.max(0, value.soft) : undefined;
  const hard = typeof value.hard === "number" ? Math.max(0, value.hard) : undefined;
  if (soft === undefined && hard === undefined) {
    return null;
  }
  if (soft === undefined) {
    return `${name}=${hard}`;
  }
  if (hard === undefined) {
    return `${name}=${soft}`;
  }
  return `${name}=${soft}:${hard}`;
}

export function buildSandboxCreateArgs(params: {
  name: string;
  cfg: SandboxDockerConfig;
  scopeKey: string;
  createdAtMs?: number;
  labels?: Record<string, string>;
  configHash?: string;
  extraEnv?: Record<string, string>;
}) {
  const createdAtMs = params.createdAtMs ?? Date.now();
  const args = ["create", "--name", params.name];
  args.push("--label", "openclaw.sandbox=1");
  args.push("--label", `openclaw.sessionKey=${params.scopeKey}`);
  args.push("--label", `openclaw.createdAtMs=${createdAtMs}`);
  if (params.configHash) {
    args.push("--label", `openclaw.configHash=${params.configHash}`);
  }
  for (const [key, value] of Object.entries(params.labels ?? {})) {
    if (key && value) {
      args.push("--label", `${key}=${value}`);
    }
  }
  if (params.cfg.readOnlyRoot) {
    args.push("--read-only");
  }
  for (const entry of params.cfg.tmpfs) {
    args.push("--tmpfs", entry);
  }
  if (params.cfg.network) {
    args.push("--network", params.cfg.network);
  }
  if (params.cfg.user) {
    args.push("--user", params.cfg.user);
  }
  const containerEnv = { ...(params.cfg.env ?? {}), ...(params.extraEnv ?? {}) };
  for (const [name, value] of Object.entries(containerEnv).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!name.trim()) {
      continue;
    }
    args.push("-e", `${name}=${value}`);
  }
  for (const cap of params.cfg.capDrop) {
    args.push("--cap-drop", cap);
  }
  args.push("--security-opt", "no-new-privileges");
  if (params.cfg.seccompProfile) {
    args.push("--security-opt", `seccomp=${params.cfg.seccompProfile}`);
  }
  if (params.cfg.apparmorProfile) {
    args.push("--security-opt", `apparmor=${params.cfg.apparmorProfile}`);
  }
  for (const entry of params.cfg.dns ?? []) {
    if (entry.trim()) {
      args.push("--dns", entry);
    }
  }
  for (const entry of params.cfg.extraHosts ?? []) {
    if (entry.trim()) {
      args.push("--add-host", entry);
    }
  }
  if (typeof params.cfg.pidsLimit === "number" && params.cfg.pidsLimit > 0) {
    args.push("--pids-limit", String(params.cfg.pidsLimit));
  }
  const memory = normalizeDockerLimit(params.cfg.memory);
  if (memory) {
    args.push("--memory", memory);
  }
  const memorySwap = normalizeDockerLimit(params.cfg.memorySwap);
  if (memorySwap) {
    args.push("--memory-swap", memorySwap);
  }
  if (typeof params.cfg.cpus === "number" && params.cfg.cpus > 0) {
    args.push("--cpus", String(params.cfg.cpus));
  }
  for (const [name, value] of Object.entries(params.cfg.ulimits ?? {})) {
    const formatted = formatUlimitValue(name, value);
    if (formatted) {
      args.push("--ulimit", formatted);
    }
  }
  if (params.cfg.binds?.length) {
    for (const bind of params.cfg.binds) {
      args.push("-v", bind);
    }
  }
  return args;
}

async function createSandboxContainer(params: {
  name: string;
  cfg: SandboxDockerConfig;
  workspaceDir: string;
  workspaceAccess: SandboxWorkspaceAccess;
  agentWorkspaceDir: string;
  scopeKey: string;
  configHash?: string;
  extraEnv?: Record<string, string>;
}) {
  const { cfg } = params;
  await ensureDockerImage(cfg.image);

  const args = buildSandboxContainerCreateArgs(params);
  await execDocker(args);
  await execDocker(["start", params.name]);

  if (cfg.setupCommand?.trim()) {
    await execDocker(["exec", "-i", params.name, "sh", "-lc", cfg.setupCommand]);
  }
}

export function buildSandboxContainerCreateArgs(params: {
  name: string;
  cfg: SandboxDockerConfig;
  workspaceDir: string;
  workspaceAccess: SandboxWorkspaceAccess;
  agentWorkspaceDir: string;
  scopeKey: string;
  configHash?: string;
  extraEnv?: Record<string, string>;
}) {
  const { name, cfg, workspaceDir, scopeKey } = params;
  // Apply workspace mounts first, then user-configured binds so nested binds can
  // intentionally mask workspace subpaths (e.g., /agent/config).
  const cfgWithoutBinds = cfg.binds?.length ? { ...cfg, binds: undefined } : cfg;
  const args = buildSandboxCreateArgs({
    name,
    cfg: cfgWithoutBinds,
    scopeKey,
    configHash: params.configHash,
    extraEnv: params.extraEnv,
  });
  args.push("--workdir", cfg.workdir);
  const mainMountSuffix =
    params.workspaceAccess === "ro" && workspaceDir === params.agentWorkspaceDir ? ":ro" : "";
  args.push("-v", `${workspaceDir}:${cfg.workdir}${mainMountSuffix}`);
  if (params.workspaceAccess !== "none" && workspaceDir !== params.agentWorkspaceDir) {
    const agentMountSuffix = params.workspaceAccess === "ro" ? ":ro" : "";
    args.push(
      "-v",
      `${params.agentWorkspaceDir}:${SANDBOX_AGENT_WORKSPACE_MOUNT}${agentMountSuffix}`,
    );
  }
  if (cfg.binds?.length) {
    for (const bind of cfg.binds) {
      args.push("-v", bind);
    }
  }
  args.push(cfg.image, "sleep", "infinity");
  return args;
}

async function readContainerConfigHash(containerName: string): Promise<string | null> {
  const readLabel = async (label: string) => {
    const result = await execDocker(
      ["inspect", "-f", `{{ index .Config.Labels "${label}" }}`, containerName],
      { allowFailure: true },
    );
    if (result.code !== 0) {
      return null;
    }
    const raw = result.stdout.trim();
    if (!raw || raw === "<no value>") {
      return null;
    }
    return raw;
  };
  return await readLabel("openclaw.configHash");
}

function formatSandboxRecreateHint(params: { scope: SandboxConfig["scope"]; sessionKey: string }) {
  if (params.scope === "session") {
    return formatCliCommand(`openclaw sandbox recreate --session ${params.sessionKey}`);
  }
  if (params.scope === "agent") {
    const agentId = resolveSandboxAgentId(params.sessionKey) ?? "main";
    return formatCliCommand(`openclaw sandbox recreate --agent ${agentId}`);
  }
  return formatCliCommand("openclaw sandbox recreate --all");
}

export async function ensureSandboxContainer(params: {
  sessionKey: string;
  workspaceDir: string;
  agentWorkspaceDir: string;
  cfg: SandboxConfig;
}): Promise<{ containerName: string; cliportToken?: string }> {
  const scopeKey = resolveSandboxScopeKey(params.cfg.scope, params.sessionKey);
  const slug = params.cfg.scope === "shared" ? "shared" : slugifySessionKey(scopeKey);
  const name = `${params.cfg.docker.containerPrefix}${slug}`;
  const containerName = name.slice(0, 63);
  const expectedHash = computeSandboxConfigHash({
    docker: params.cfg.docker,
    workspaceAccess: params.cfg.workspaceAccess,
    workspaceDir: params.workspaceDir,
    agentWorkspaceDir: params.agentWorkspaceDir,
  });
  const now = Date.now();
  const state = await dockerContainerState(containerName);
  let hasContainer = state.exists;
  let running = state.running;
  let currentHash: string | null = null;
  let hashMismatch = false;
  const cliportEnabled = isCliportEnabled(params.cfg.docker);
  let cliportToken: string | undefined;
  let registryEntry:
    | {
        lastUsedAtMs: number;
        configHash?: string;
        cliportToken?: string;
      }
    | undefined;
  if (hasContainer) {
    const registry = await readRegistry();
    registryEntry = registry.entries.find((entry) => entry.containerName === containerName);
    const existingCliportToken = registryEntry?.cliportToken?.trim();
    if (cliportEnabled && existingCliportToken) {
      cliportToken = existingCliportToken;
    }
    currentHash = await readContainerConfigHash(containerName);
    if (!currentHash) {
      currentHash = registryEntry?.configHash ?? null;
    }
    hashMismatch = !currentHash || currentHash !== expectedHash;
    if (hashMismatch) {
      const lastUsedAtMs = registryEntry?.lastUsedAtMs;
      const isHot =
        running &&
        (typeof lastUsedAtMs !== "number" || now - lastUsedAtMs < HOT_CONTAINER_WINDOW_MS);
      if (isHot) {
        const hint = formatSandboxRecreateHint({ scope: params.cfg.scope, sessionKey: scopeKey });
        defaultRuntime.log(
          `Sandbox config changed for ${containerName} (recently used). Recreate to apply: ${hint}`,
        );
      } else {
        await execDocker(["rm", "-f", containerName], { allowFailure: true });
        hasContainer = false;
        running = false;
      }
    }
  }
  if (cliportEnabled && !cliportToken) {
    cliportToken = generateCliportToken();
  }
  if (cliportToken) {
    await ensureCliportTokenAllowed(cliportToken, {
      sessionKey: scopeKey,
      containerName,
    });
  }
  if (!hasContainer) {
    await createSandboxContainer({
      name: containerName,
      cfg: params.cfg.docker,
      workspaceDir: params.workspaceDir,
      workspaceAccess: params.cfg.workspaceAccess,
      agentWorkspaceDir: params.agentWorkspaceDir,
      scopeKey,
      configHash: expectedHash,
      extraEnv: cliportToken
        ? {
            [CLIPORT_TOKEN_ENV_KEY]: cliportToken,
            [CLIPORT_SESSION_KEY_ENV_KEY]: scopeKey,
            [CLIPORT_CONTAINER_NAME_ENV_KEY]: containerName,
          }
        : undefined,
    });
  } else if (!running) {
    await execDocker(["start", containerName]);
  }
  await updateRegistry({
    containerName,
    sessionKey: scopeKey,
    createdAtMs: now,
    lastUsedAtMs: now,
    image: params.cfg.docker.image,
    configHash: hashMismatch && running ? (currentHash ?? undefined) : expectedHash,
    cliportToken,
  });
  return { containerName, cliportToken };
}

export const __testing = {
  ensureCliportTokenAllowed,
  parseCliportTokenEntry,
};
