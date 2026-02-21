import path from "node:path";

const DEFAULT_SAFE_BIN_TRUSTED_DIRS = [
  "/bin",
  "/usr/bin",
  "/usr/local/bin",
  "/opt/homebrew/bin",
  "/opt/local/bin",
  "/snap/bin",
  "/run/current-system/sw/bin",
];

type TrustedSafeBinDirsParams = {
  pathEnv?: string | null;
  delimiter?: string;
  baseDirs?: readonly string[];
  includePathEnv?: boolean;
};

type TrustedSafeBinPathParams = {
  resolvedPath: string;
  trustedDirs?: ReadonlySet<string>;
  pathEnv?: string | null;
  delimiter?: string;
  includePathEnv?: boolean;
};

type TrustedSafeBinCache = {
  key: string;
  dirs: Set<string>;
};

let trustedSafeBinCache: TrustedSafeBinCache | null = null;
const STARTUP_PATH_ENV = process.env.PATH ?? process.env.Path ?? "";

function normalizeTrustedDir(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !path.isAbsolute(trimmed)) {
    return null;
  }
  return path.resolve(trimmed);
}

function buildTrustedSafeBinCacheKey(params: {
  includePathEnv: boolean;
  pathEnv: string;
  delimiter: string;
}): string {
  if (!params.includePathEnv) {
    return "static";
  }
  return `${params.delimiter}\u0000${params.pathEnv}`;
}

export function buildTrustedSafeBinDirs(params: TrustedSafeBinDirsParams = {}): Set<string> {
  const delimiter = params.delimiter ?? path.delimiter;
  const pathEnv = params.pathEnv ?? "";
  const baseDirs = params.baseDirs ?? DEFAULT_SAFE_BIN_TRUSTED_DIRS;
  const includePathEnv = params.includePathEnv === true;
  const trusted = new Set<string>();

  for (const entry of baseDirs) {
    const normalized = normalizeTrustedDir(entry);
    if (normalized) {
      trusted.add(normalized);
    }
  }

  if (includePathEnv) {
    const pathEntries = pathEnv
      .split(delimiter)
      .map((entry) => normalizeTrustedDir(entry))
      .filter((entry): entry is string => Boolean(entry));
    for (const entry of pathEntries) {
      trusted.add(entry);
    }
  }

  return trusted;
}

export function getTrustedSafeBinDirs(
  params: {
    pathEnv?: string | null;
    delimiter?: string;
    refresh?: boolean;
    includePathEnv?: boolean;
  } = {},
): Set<string> {
  const delimiter = params.delimiter ?? path.delimiter;
  const pathEnv = params.pathEnv ?? STARTUP_PATH_ENV;
  const includePathEnv = params.includePathEnv === true;
  const key = buildTrustedSafeBinCacheKey({ includePathEnv, pathEnv, delimiter });

  if (!params.refresh && trustedSafeBinCache?.key === key) {
    return trustedSafeBinCache.dirs;
  }

  const dirs = buildTrustedSafeBinDirs({
    pathEnv,
    delimiter,
    includePathEnv,
  });
  trustedSafeBinCache = { key, dirs };
  return dirs;
}

export function isTrustedSafeBinPath(params: TrustedSafeBinPathParams): boolean {
  const trustedDirs =
    params.trustedDirs ??
    getTrustedSafeBinDirs({
      pathEnv: params.pathEnv,
      delimiter: params.delimiter,
      includePathEnv: params.includePathEnv,
    });
  const resolvedDir = path.dirname(path.resolve(params.resolvedPath));
  return trustedDirs.has(resolvedDir);
}
