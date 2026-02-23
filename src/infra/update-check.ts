import fs from "node:fs/promises";
import path from "node:path";
import { runCommandWithTimeout } from "../process/exec.js";
import { fetchWithTimeout } from "../utils/fetch-timeout.js";
import { detectPackageManager as detectPackageManagerImpl } from "./detect-package-manager.js";
import { channelToNpmTag, type UpdateChannel } from "./update-channels.js";

export type PackageManager = "pnpm" | "bun" | "npm" | "unknown";

export type GitUpdateStatus = {
  root: string;
  sha: string | null;
  tag: string | null;
  branch: string | null;
  upstream: string | null;
  dirty: boolean | null;
  ahead: number | null;
  behind: number | null;
  fetchOk: boolean | null;
  error?: string;
};

export type DepsStatus = {
  manager: PackageManager;
  status: "ok" | "missing" | "stale" | "unknown";
  lockfilePath: string | null;
  markerPath: string | null;
  reason?: string;
};

export type RegistryStatus = {
  latestVersion: string | null;
  error?: string;
};

export type NpmTagStatus = {
  tag: string;
  version: string | null;
  error?: string;
};

export type UpdateCheckResult = {
  root: string | null;
  installKind: "git" | "package" | "unknown";
  packageManager: PackageManager;
  git?: GitUpdateStatus;
  deps?: DepsStatus;
  registry?: RegistryStatus;
};

type UpdateVersionSuffix =
  | { kind: "none" }
  | { kind: "numeric-build"; value: number }
  | { kind: "prerelease"; identifiers: string[] };

type ParsedUpdateVersion = {
  major: number;
  minor: number;
  patch: number;
  suffix: UpdateVersionSuffix;
};

const UPDATE_VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const NUMERIC_IDENTIFIER_RE = /^\d+$/;

function compareIntegers(a: number, b: number): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function parseUpdateVersion(version: string | null): ParsedUpdateVersion | null {
  if (!version) {
    return null;
  }
  const match = version.trim().match(UPDATE_VERSION_RE);
  if (!match) {
    return null;
  }

  const [, majorRaw, minorRaw, patchRaw, suffixRaw] = match;
  const major = Number.parseInt(majorRaw, 10);
  const minor = Number.parseInt(minorRaw, 10);
  const patch = Number.parseInt(patchRaw, 10);

  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }

  if (!suffixRaw) {
    return { major, minor, patch, suffix: { kind: "none" } };
  }

  if (NUMERIC_IDENTIFIER_RE.test(suffixRaw)) {
    return {
      major,
      minor,
      patch,
      suffix: { kind: "numeric-build", value: Number.parseInt(suffixRaw, 10) },
    };
  }

  const identifiers = suffixRaw.split(".");
  if (identifiers.some((part) => part.length === 0)) {
    return null;
  }

  return {
    major,
    minor,
    patch,
    suffix: { kind: "prerelease", identifiers },
  };
}

function comparePrereleaseIdentifiers(a: string[], b: string[]): number {
  const max = Math.max(a.length, b.length);
  for (let idx = 0; idx < max; idx += 1) {
    const left = a[idx];
    const right = b[idx];
    if (left == null) {
      return -1;
    }
    if (right == null) {
      return 1;
    }
    const leftNumeric = NUMERIC_IDENTIFIER_RE.test(left);
    const rightNumeric = NUMERIC_IDENTIFIER_RE.test(right);
    if (leftNumeric && rightNumeric) {
      const cmp = compareIntegers(Number.parseInt(left, 10), Number.parseInt(right, 10));
      if (cmp !== 0) {
        return cmp;
      }
      continue;
    }
    if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    }
    if (left !== right) {
      return left < right ? -1 : 1;
    }
  }
  return 0;
}

function suffixRank(suffix: UpdateVersionSuffix): number {
  switch (suffix.kind) {
    case "prerelease":
      return 0;
    case "none":
      return 1;
    case "numeric-build":
      return 2;
  }
}

function compareVersionSuffix(a: UpdateVersionSuffix, b: UpdateVersionSuffix): number {
  if (a.kind === b.kind) {
    if (a.kind === "none") {
      return 0;
    }
    if (a.kind === "numeric-build" && b.kind === "numeric-build") {
      return compareIntegers(a.value, b.value);
    }
    if (a.kind === "prerelease" && b.kind === "prerelease") {
      return comparePrereleaseIdentifiers(a.identifiers, b.identifiers);
    }
  }
  return compareIntegers(suffixRank(a), suffixRank(b));
}

export function formatGitInstallLabel(update: UpdateCheckResult): string | null {
  if (update.installKind !== "git") {
    return null;
  }
  const shortSha = update.git?.sha ? update.git.sha.slice(0, 8) : null;
  const branch = update.git?.branch && update.git.branch !== "HEAD" ? update.git.branch : null;
  const tag = update.git?.tag ?? null;
  const parts = [
    branch ?? (tag ? "detached" : "git"),
    tag ? `tag ${tag}` : null,
    shortSha ? `@ ${shortSha}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function detectPackageManager(root: string): Promise<PackageManager> {
  return (await detectPackageManagerImpl(root)) ?? "unknown";
}

async function detectGitRoot(root: string): Promise<string | null> {
  const res = await runCommandWithTimeout(["git", "-C", root, "rev-parse", "--show-toplevel"], {
    timeoutMs: 4000,
  }).catch(() => null);
  if (!res || res.code !== 0) {
    return null;
  }
  const top = res.stdout.trim();
  return top ? path.resolve(top) : null;
}

export async function checkGitUpdateStatus(params: {
  root: string;
  timeoutMs?: number;
  fetch?: boolean;
}): Promise<GitUpdateStatus> {
  const timeoutMs = params.timeoutMs ?? 6000;
  const root = path.resolve(params.root);

  const base: GitUpdateStatus = {
    root,
    sha: null,
    tag: null,
    branch: null,
    upstream: null,
    dirty: null,
    ahead: null,
    behind: null,
    fetchOk: null,
  };

  const branchRes = await runCommandWithTimeout(
    ["git", "-C", root, "rev-parse", "--abbrev-ref", "HEAD"],
    { timeoutMs },
  ).catch(() => null);
  if (!branchRes || branchRes.code !== 0) {
    return { ...base, error: branchRes?.stderr?.trim() || "git unavailable" };
  }
  const branch = branchRes.stdout.trim() || null;

  const shaRes = await runCommandWithTimeout(["git", "-C", root, "rev-parse", "HEAD"], {
    timeoutMs,
  }).catch(() => null);
  const sha = shaRes && shaRes.code === 0 ? shaRes.stdout.trim() : null;

  const tagRes = await runCommandWithTimeout(
    ["git", "-C", root, "describe", "--tags", "--exact-match"],
    { timeoutMs },
  ).catch(() => null);
  const tag = tagRes && tagRes.code === 0 ? tagRes.stdout.trim() : null;

  const upstreamRes = await runCommandWithTimeout(
    ["git", "-C", root, "rev-parse", "--abbrev-ref", "@{upstream}"],
    { timeoutMs },
  ).catch(() => null);
  const upstream = upstreamRes && upstreamRes.code === 0 ? upstreamRes.stdout.trim() : null;

  const dirtyRes = await runCommandWithTimeout(
    ["git", "-C", root, "status", "--porcelain", "--", ":!dist/control-ui/"],
    { timeoutMs },
  ).catch(() => null);
  const dirty = dirtyRes && dirtyRes.code === 0 ? dirtyRes.stdout.trim().length > 0 : null;

  const fetchOk = params.fetch
    ? await runCommandWithTimeout(["git", "-C", root, "fetch", "--quiet", "--prune"], { timeoutMs })
        .then((r) => r.code === 0)
        .catch(() => false)
    : null;

  const counts =
    upstream && upstream.length > 0
      ? await runCommandWithTimeout(
          ["git", "-C", root, "rev-list", "--left-right", "--count", `HEAD...${upstream}`],
          { timeoutMs },
        ).catch(() => null)
      : null;

  const parseCounts = (raw: string): { ahead: number; behind: number } | null => {
    const parts = raw.trim().split(/\s+/);
    if (parts.length < 2) {
      return null;
    }
    const ahead = Number.parseInt(parts[0] ?? "", 10);
    const behind = Number.parseInt(parts[1] ?? "", 10);
    if (!Number.isFinite(ahead) || !Number.isFinite(behind)) {
      return null;
    }
    return { ahead, behind };
  };
  const parsed = counts && counts.code === 0 ? parseCounts(counts.stdout) : null;

  return {
    root,
    sha,
    tag,
    branch,
    upstream,
    dirty,
    ahead: parsed?.ahead ?? null,
    behind: parsed?.behind ?? null,
    fetchOk,
  };
}

async function statMtimeMs(p: string): Promise<number | null> {
  try {
    const st = await fs.stat(p);
    return st.mtimeMs;
  } catch {
    return null;
  }
}

function resolveDepsMarker(params: { root: string; manager: PackageManager }): {
  lockfilePath: string | null;
  markerPath: string | null;
} {
  const root = params.root;
  if (params.manager === "pnpm") {
    return {
      lockfilePath: path.join(root, "pnpm-lock.yaml"),
      markerPath: path.join(root, "node_modules", ".modules.yaml"),
    };
  }
  if (params.manager === "bun") {
    return {
      lockfilePath: path.join(root, "bun.lockb"),
      markerPath: path.join(root, "node_modules"),
    };
  }
  if (params.manager === "npm") {
    return {
      lockfilePath: path.join(root, "package-lock.json"),
      markerPath: path.join(root, "node_modules"),
    };
  }
  return { lockfilePath: null, markerPath: null };
}

export async function checkDepsStatus(params: {
  root: string;
  manager: PackageManager;
}): Promise<DepsStatus> {
  const root = path.resolve(params.root);
  const { lockfilePath, markerPath } = resolveDepsMarker({
    root,
    manager: params.manager,
  });

  if (!lockfilePath || !markerPath) {
    return {
      manager: params.manager,
      status: "unknown",
      lockfilePath,
      markerPath,
      reason: "unknown package manager",
    };
  }

  const lockExists = await exists(lockfilePath);
  const markerExists = await exists(markerPath);
  if (!lockExists) {
    return {
      manager: params.manager,
      status: "unknown",
      lockfilePath,
      markerPath,
      reason: "lockfile missing",
    };
  }
  if (!markerExists) {
    return {
      manager: params.manager,
      status: "missing",
      lockfilePath,
      markerPath,
      reason: "node_modules marker missing",
    };
  }

  const lockMtime = await statMtimeMs(lockfilePath);
  const markerMtime = await statMtimeMs(markerPath);
  if (!lockMtime || !markerMtime) {
    return {
      manager: params.manager,
      status: "unknown",
      lockfilePath,
      markerPath,
    };
  }
  if (lockMtime > markerMtime + 1000) {
    return {
      manager: params.manager,
      status: "stale",
      lockfilePath,
      markerPath,
      reason: "lockfile newer than install marker",
    };
  }
  return {
    manager: params.manager,
    status: "ok",
    lockfilePath,
    markerPath,
  };
}

export async function fetchNpmLatestVersion(params?: {
  timeoutMs?: number;
}): Promise<RegistryStatus> {
  const res = await fetchNpmTagVersion({ tag: "latest", timeoutMs: params?.timeoutMs });
  return {
    latestVersion: res.version,
    error: res.error,
  };
}

export async function fetchNpmTagVersion(params: {
  tag: string;
  timeoutMs?: number;
}): Promise<NpmTagStatus> {
  const timeoutMs = params?.timeoutMs ?? 3500;
  const tag = params.tag;
  try {
    const res = await fetchWithTimeout(
      `https://registry.npmjs.org/openclaw/${encodeURIComponent(tag)}`,
      {},
      Math.max(250, timeoutMs),
    );
    if (!res.ok) {
      return { tag, version: null, error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as { version?: unknown };
    const version = typeof json?.version === "string" ? json.version : null;
    return { tag, version };
  } catch (err) {
    return { tag, version: null, error: String(err) };
  }
}

export async function resolveNpmChannelTag(params: {
  channel: UpdateChannel;
  timeoutMs?: number;
}): Promise<{ tag: string; version: string | null }> {
  const channelTag = channelToNpmTag(params.channel);
  const channelStatus = await fetchNpmTagVersion({ tag: channelTag, timeoutMs: params.timeoutMs });
  if (params.channel !== "beta") {
    return { tag: channelTag, version: channelStatus.version };
  }

  const latestStatus = await fetchNpmTagVersion({ tag: "latest", timeoutMs: params.timeoutMs });
  if (!latestStatus.version) {
    return { tag: channelTag, version: channelStatus.version };
  }
  if (!channelStatus.version) {
    return { tag: "latest", version: latestStatus.version };
  }
  const cmp = compareSemverStrings(channelStatus.version, latestStatus.version);
  if (cmp != null && cmp < 0) {
    return { tag: "latest", version: latestStatus.version };
  }
  return { tag: channelTag, version: channelStatus.version };
}

export function compareSemverStrings(a: string | null, b: string | null): number | null {
  const pa = parseUpdateVersion(a);
  const pb = parseUpdateVersion(b);
  if (!pa || !pb) {
    return null;
  }
  const majorCmp = compareIntegers(pa.major, pb.major);
  if (majorCmp !== 0) {
    return majorCmp;
  }
  const minorCmp = compareIntegers(pa.minor, pb.minor);
  if (minorCmp !== 0) {
    return minorCmp;
  }
  const patchCmp = compareIntegers(pa.patch, pb.patch);
  if (patchCmp !== 0) {
    return patchCmp;
  }
  return compareVersionSuffix(pa.suffix, pb.suffix);
}

export async function checkUpdateStatus(params: {
  root: string | null;
  timeoutMs?: number;
  fetchGit?: boolean;
  includeRegistry?: boolean;
}): Promise<UpdateCheckResult> {
  const timeoutMs = params.timeoutMs ?? 6000;
  const root = params.root ? path.resolve(params.root) : null;
  if (!root) {
    return {
      root: null,
      installKind: "unknown",
      packageManager: "unknown",
      registry: params.includeRegistry ? await fetchNpmLatestVersion({ timeoutMs }) : undefined,
    };
  }

  const pm = await detectPackageManager(root);
  const gitRoot = await detectGitRoot(root);
  const isGit = gitRoot && path.resolve(gitRoot) === root;

  const installKind: UpdateCheckResult["installKind"] = isGit ? "git" : "package";
  const git = isGit
    ? await checkGitUpdateStatus({
        root,
        timeoutMs,
        fetch: Boolean(params.fetchGit),
      })
    : undefined;
  const deps = await checkDepsStatus({ root, manager: pm });
  const registry = params.includeRegistry ? await fetchNpmLatestVersion({ timeoutMs }) : undefined;

  return {
    root,
    installKind,
    packageManager: pm,
    git,
    deps,
    registry,
  };
}
