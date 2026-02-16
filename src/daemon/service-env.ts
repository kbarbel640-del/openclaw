import fs from "node:fs";
import path from "node:path";
import { VERSION } from "../version.js";
import {
  GATEWAY_SERVICE_KIND,
  GATEWAY_SERVICE_MARKER,
  resolveGatewayLaunchAgentLabel,
  resolveGatewaySystemdServiceName,
  NODE_SERVICE_KIND,
  NODE_SERVICE_MARKER,
  NODE_WINDOWS_TASK_SCRIPT_NAME,
  resolveNodeLaunchAgentLabel,
  resolveNodeSystemdServiceName,
  resolveNodeWindowsTaskName,
} from "./constants.js";

export type MinimalServicePathOptions = {
  platform?: NodeJS.Platform;
  extraDirs?: string[];
  home?: string;
  env?: Record<string, string | undefined>;
};

type BuildServicePathOptions = MinimalServicePathOptions & {
  env?: Record<string, string | undefined>;
};

/**
 * Read system PATH from macOS /etc/paths and /etc/paths.d/.
 * This respects user customizations to the system PATH.
 */
function readMacosSystemPaths(): string[] {
  const dirs: string[] = [];

  // Read /etc/paths (one directory per line)
  const etcPaths = "/etc/paths";
  try {
    if (fs.existsSync(etcPaths)) {
      const content = fs.readFileSync(etcPaths, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !dirs.includes(trimmed)) {
          dirs.push(trimmed);
        }
      }
    }
  } catch {
    // Fall back to defaults if reading fails
  }

  // Read all files in /etc/paths.d/ (each file contains directories, one per line)
  const pathsdDir = "/etc/paths.d";
  try {
    if (fs.existsSync(pathsdDir) && fs.statSync(pathsdDir).isDirectory()) {
      const files = fs.readdirSync(pathsdDir);
      for (const file of files) {
        const filePath = path.join(pathsdDir, file);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (trimmed && !dirs.includes(trimmed)) {
              dirs.push(trimmed);
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    }
  } catch {
    // Fall back to defaults if reading fails
  }

  return dirs;
}

function resolveSystemPathDirs(platform: NodeJS.Platform): string[] {
  if (platform === "darwin") {
    // Read from /etc/paths and /etc/paths.d/ to respect system PATH configuration
    const systemPaths = readMacosSystemPaths();
    if (systemPaths.length > 0) {
      return systemPaths;
    }
    // Fall back to sensible defaults if /etc/paths doesn't exist or is empty
    return ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  }
  if (platform === "linux") {
    return ["/usr/local/bin", "/usr/bin", "/bin"];
  }
  return [];
}

/**
 * Resolve common user bin directories for Linux.
 * These are paths where npm global installs and node version managers typically place binaries.
 */
export function resolveLinuxUserBinDirs(
  home: string | undefined,
  env?: Record<string, string | undefined>,
): string[] {
  if (!home) {
    return [];
  }

  const dirs: string[] = [];

  const add = (dir: string | undefined) => {
    if (dir) {
      dirs.push(dir);
    }
  };
  const appendSubdir = (base: string | undefined, subdir: string) => {
    if (!base) {
      return undefined;
    }
    return base.endsWith(`/${subdir}`) ? base : path.posix.join(base, subdir);
  };

  // Env-configured bin roots (override defaults when present).
  add(env?.PNPM_HOME);
  add(appendSubdir(env?.NPM_CONFIG_PREFIX, "bin"));
  add(appendSubdir(env?.BUN_INSTALL, "bin"));
  add(appendSubdir(env?.VOLTA_HOME, "bin"));
  add(appendSubdir(env?.ASDF_DATA_DIR, "shims"));
  add(appendSubdir(env?.NVM_DIR, "current/bin"));
  add(appendSubdir(env?.FNM_DIR, "current/bin"));

  // Common user bin directories
  dirs.push(`${home}/.local/bin`); // XDG standard, pip, etc.
  dirs.push(`${home}/.npm-global/bin`); // npm custom prefix (recommended for non-root)
  dirs.push(`${home}/bin`); // User's personal bin

  // Node version managers
  dirs.push(`${home}/.nvm/current/bin`); // nvm with current symlink
  dirs.push(`${home}/.fnm/current/bin`); // fnm
  dirs.push(`${home}/.volta/bin`); // Volta
  dirs.push(`${home}/.asdf/shims`); // asdf
  dirs.push(`${home}/.local/share/pnpm`); // pnpm global bin
  dirs.push(`${home}/.bun/bin`); // Bun

  return dirs;
}

export function getMinimalServicePathParts(options: MinimalServicePathOptions = {}): string[] {
  const platform = options.platform ?? process.platform;
  if (platform === "win32") {
    return [];
  }

  const parts: string[] = [];
  const extraDirs = options.extraDirs ?? [];
  const systemDirs = resolveSystemPathDirs(platform);

  // Add Linux user bin directories (npm global, nvm, fnm, volta, etc.)
  const linuxUserDirs =
    platform === "linux" ? resolveLinuxUserBinDirs(options.home, options.env) : [];

  const add = (dir: string) => {
    if (!dir) {
      return;
    }
    if (!parts.includes(dir)) {
      parts.push(dir);
    }
  };

  for (const dir of extraDirs) {
    add(dir);
  }
  // User dirs first so user-installed binaries take precedence
  for (const dir of linuxUserDirs) {
    add(dir);
  }
  for (const dir of systemDirs) {
    add(dir);
  }

  return parts;
}

export function getMinimalServicePathPartsFromEnv(options: BuildServicePathOptions = {}): string[] {
  const env = options.env ?? process.env;
  return getMinimalServicePathParts({
    ...options,
    home: options.home ?? env.HOME,
    env,
  });
}

export function buildMinimalServicePath(options: BuildServicePathOptions = {}): string {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  if (platform === "win32") {
    return env.PATH ?? "";
  }

  return getMinimalServicePathPartsFromEnv({ ...options, env }).join(path.posix.delimiter);
}

export function buildServiceEnvironment(params: {
  env: Record<string, string | undefined>;
  port: number;
  token?: string;
  launchdLabel?: string;
}): Record<string, string | undefined> {
  const { env, port, token, launchdLabel } = params;
  const profile = env.OPENCLAW_PROFILE;
  const resolvedLaunchdLabel =
    launchdLabel ||
    (process.platform === "darwin" ? resolveGatewayLaunchAgentLabel(profile) : undefined);
  const systemdUnit = `${resolveGatewaySystemdServiceName(profile)}.service`;
  const stateDir = env.OPENCLAW_STATE_DIR;
  const configPath = env.OPENCLAW_CONFIG_PATH;
  return {
    HOME: env.HOME,
    PATH: buildMinimalServicePath({ env }),
    OPENCLAW_PROFILE: profile,
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_GATEWAY_PORT: String(port),
    OPENCLAW_GATEWAY_TOKEN: token,
    OPENCLAW_LAUNCHD_LABEL: resolvedLaunchdLabel,
    OPENCLAW_SYSTEMD_UNIT: systemdUnit,
    OPENCLAW_SERVICE_MARKER: GATEWAY_SERVICE_MARKER,
    OPENCLAW_SERVICE_KIND: GATEWAY_SERVICE_KIND,
    OPENCLAW_SERVICE_VERSION: VERSION,
  };
}

export function buildNodeServiceEnvironment(params: {
  env: Record<string, string | undefined>;
}): Record<string, string | undefined> {
  const { env } = params;
  const stateDir = env.OPENCLAW_STATE_DIR;
  const configPath = env.OPENCLAW_CONFIG_PATH;
  return {
    HOME: env.HOME,
    PATH: buildMinimalServicePath({ env }),
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_LAUNCHD_LABEL: resolveNodeLaunchAgentLabel(),
    OPENCLAW_SYSTEMD_UNIT: resolveNodeSystemdServiceName(),
    OPENCLAW_WINDOWS_TASK_NAME: resolveNodeWindowsTaskName(),
    OPENCLAW_TASK_SCRIPT_NAME: NODE_WINDOWS_TASK_SCRIPT_NAME,
    OPENCLAW_LOG_PREFIX: "node",
    OPENCLAW_SERVICE_MARKER: NODE_SERVICE_MARKER,
    OPENCLAW_SERVICE_KIND: NODE_SERVICE_KIND,
    OPENCLAW_SERVICE_VERSION: VERSION,
  };
}
