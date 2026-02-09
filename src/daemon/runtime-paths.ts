import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { isSupportedNodeVersion } from "../infra/runtime-guard.js";

const VERSION_MANAGER_MARKERS = [
  "/.nvm/",
  "/.fnm/",
  "/.volta/",
  "/.asdf/",
  "/.n/",
  "/.nodenv/",
  "/.nodebrew/",
  "/nvs/",
];

function getPathModule(platform: NodeJS.Platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function isNodeExecPath(execPath: string, platform: NodeJS.Platform): boolean {
  const pathModule = getPathModule(platform);
  const base = pathModule.basename(execPath).toLowerCase();
  return base === "node" || base === "node.exe";
}

function normalizeForCompare(input: string, platform: NodeJS.Platform): string {
  const pathModule = getPathModule(platform);
  const normalized = pathModule.normalize(input).replaceAll("\\", "/");
  if (platform === "win32") {
    return normalized.toLowerCase();
  }
  return normalized;
}

function buildSystemNodeCandidates(
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform,
): string[] {
  if (platform === "darwin") {
    return ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"];
  }
  if (platform === "linux") {
    return ["/usr/local/bin/node", "/usr/bin/node"];
  }
  if (platform === "win32") {
    const pathModule = getPathModule(platform);
    const programFiles = env.ProgramFiles ?? "C:\\Program Files";
    const programFilesX86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    return [
      pathModule.join(programFiles, "nodejs", "node.exe"),
      pathModule.join(programFilesX86, "nodejs", "node.exe"),
    ];
  }
  return [];
}

type ExecFileAsync = (
  file: string,
  args: readonly string[],
  options: { encoding: "utf8" },
) => Promise<{ stdout: string; stderr: string }>;

const execFileAsync = promisify(execFile) as unknown as ExecFileAsync;

async function resolveNodeVersion(
  nodePath: string,
  execFileImpl: ExecFileAsync,
): Promise<string | null> {
  try {
    const { stdout } = await execFileImpl(nodePath, ["-p", "process.versions.node"], {
      encoding: "utf8",
    });
    const value = stdout.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

export type SystemNodeInfo = {
  path: string;
  version: string | null;
  supported: boolean;
};

export function isVersionManagedNodePath(
  nodePath: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const normalized = normalizeForCompare(nodePath, platform);
  return VERSION_MANAGER_MARKERS.some((marker) => normalized.includes(marker));
}

export function isSystemNodePath(
  nodePath: string,
  env: Record<string, string | undefined> = process.env,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const normalized = normalizeForCompare(nodePath, platform);
  return buildSystemNodeCandidates(env, platform).some((candidate) => {
    const normalizedCandidate = normalizeForCompare(candidate, platform);
    return normalized === normalizedCandidate;
  });
}

export async function resolveSystemNodePath(
  env: Record<string, string | undefined> = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<string | null> {
  const candidates = buildSystemNodeCandidates(env, platform);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep going
    }
  }
  return null;
}

export async function resolveSystemNodeInfo(params: {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  execFile?: ExecFileAsync;
}): Promise<SystemNodeInfo | null> {
  const env = params.env ?? process.env;
  const platform = params.platform ?? process.platform;
  const systemNode = await resolveSystemNodePath(env, platform);
  if (!systemNode) {
    return null;
  }

  const version = await resolveNodeVersion(systemNode, params.execFile ?? execFileAsync);
  return {
    path: systemNode,
    version,
    supported: isSupportedNodeVersion(version),
  };
}

export function renderSystemNodeWarning(
  systemNode: SystemNodeInfo | null,
  selectedNodePath?: string,
): string | null {
  if (!systemNode || systemNode.supported) {
    return null;
  }
  const versionLabel = systemNode.version ?? "unknown";
  const selectedLabel = selectedNodePath ? ` Using ${selectedNodePath} for the daemon.` : "";
  return `System Node ${versionLabel} at ${systemNode.path} is below the required Node 22+.${selectedLabel} Install Node 22+ from nodejs.org or Homebrew.`;
}

// Subpath to the OpenClawNode.app binary within the config directory.
// This app bundle wraps a standalone Node.js so macOS Full Disk Access can be
// granted to the gateway without granting FDA to all of homebrew node.
const OPENCLAW_NODE_BUNDLE_SUBPATH = "OpenClawNode.app/Contents/MacOS/node";

/**
 * Check for the OpenClawNode.app bundle binary in the config directory.
 * Returns the absolute path if the binary exists, or null.
 */
async function resolveOpenClawNodeBundlePath(
  env: Record<string, string | undefined>,
): Promise<string | null> {
  const stateDir = env.OPENCLAW_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim();
  const home = env.HOME?.trim() || env.USERPROFILE?.trim();
  const baseDir = stateDir || (home ? path.join(home, ".openclaw") : null);
  if (!baseDir) {
    return null;
  }
  const candidate = path.join(baseDir, OPENCLAW_NODE_BUNDLE_SUBPATH);
  try {
    await fs.access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

export async function resolvePreferredNodePath(params: {
  env?: Record<string, string | undefined>;
  runtime?: string;
  platform?: NodeJS.Platform;
  execFile?: ExecFileAsync;
  execPath?: string;
}): Promise<string | undefined> {
  if (params.runtime !== "node") {
    return undefined;
  }

  // On macOS, prefer the OpenClawNode.app bundle binary so the gateway runs
  // under its own app identity (needed for Full Disk Access).
  const platform = params.platform ?? process.platform;
  if (platform === "darwin") {
    const env = params.env ?? process.env;
    const bundlePath = await resolveOpenClawNodeBundlePath(env);
    if (bundlePath) {
      const version = await resolveNodeVersion(bundlePath, params.execFile ?? execFileAsync);
      if (isSupportedNodeVersion(version)) {
        return bundlePath;
      }
    }
  }
  // Prefer the node that is currently running `openclaw gateway install`.
  // This respects the user's active version manager (fnm/nvm/volta/etc.).
  const currentExecPath = params.execPath ?? process.execPath;
  if (currentExecPath && isNodeExecPath(currentExecPath, platform)) {
    const execFileImpl = params.execFile ?? execFileAsync;
    const version = await resolveNodeVersion(currentExecPath, execFileImpl);
    if (isSupportedNodeVersion(version)) {
      return currentExecPath;
    }
  }
  // Fall back to system node.
  const systemNode = await resolveSystemNodeInfo(params);
  if (!systemNode?.supported) {
    return undefined;
  }
  return systemNode.path;
}
