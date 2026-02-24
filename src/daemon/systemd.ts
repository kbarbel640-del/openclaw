import fs from "node:fs/promises";
import path from "node:path";
import { splitArgsPreservingQuotes } from "./arg-split.js";
import {
  LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES,
  resolveGatewayServiceDescription,
  resolveGatewaySystemdServiceName,
} from "./constants.js";
import { execFileUtf8 } from "./exec-file.js";
import { formatLine, toPosixPath, writeFormattedLines } from "./output.js";
import { resolveHomeDir } from "./paths.js";
import { parseKeyValueOutput } from "./runtime-parse.js";
import type { GatewayServiceRuntime } from "./service-runtime.js";
import type {
  GatewayServiceCommandConfig,
  GatewayServiceControlArgs,
  GatewayServiceEnv,
  GatewayServiceEnvArgs,
  GatewayServiceInstallArgs,
  GatewayServiceManageArgs,
} from "./service-types.js";
import {
  enableSystemdUserLinger,
  readSystemdUserLingerStatus,
  type SystemdUserLingerStatus,
} from "./systemd-linger.js";
import {
  buildSystemdUnit,
  parseSystemdEnvAssignment,
  parseSystemdExecStart,
} from "./systemd-unit.js";

type SystemctlScope = "user" | "system";

function resolveSystemdUnitPathForName(env: GatewayServiceEnv, name: string): string {
  const home = toPosixPath(resolveHomeDir(env));
  return path.posix.join(home, ".config", "systemd", "user", `${name}.service`);
}

function resolveSystemdServiceName(env: GatewayServiceEnv): string {
  const override = env.OPENCLAW_SYSTEMD_UNIT?.trim();
  if (override) {
    return override.endsWith(".service") ? override.slice(0, -".service".length) : override;
  }
  return resolveGatewaySystemdServiceName(env.OPENCLAW_PROFILE);
}

function resolveSystemdUnitPath(env: GatewayServiceEnv): string {
  return resolveSystemdUnitPathForName(env, resolveSystemdServiceName(env));
}

export function resolveSystemdUserUnitPath(env: GatewayServiceEnv): string {
  return resolveSystemdUnitPath(env);
}

export { enableSystemdUserLinger, readSystemdUserLingerStatus };
export type { SystemdUserLingerStatus };

// Unit file parsing/rendering: see systemd-unit.ts

export async function readSystemdServiceExecStart(
  env: GatewayServiceEnv,
): Promise<GatewayServiceCommandConfig | null> {
  const serviceName = resolveSystemdServiceName(env);
  const unitPath = resolveSystemdUnitPathForName(env, serviceName);

  const parseUnitContent = async (
    content: string,
    sourcePath: string,
  ): Promise<GatewayServiceCommandConfig | null> => {
    let execStart = "";
    let workingDirectory = "";
    const inlineEnvironment: Record<string, string> = {};
    const environmentFiles: Array<{ path: string; optional: boolean }> = [];
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      if (line.startsWith("ExecStart=")) {
        execStart = line.slice("ExecStart=".length).trim();
      } else if (line.startsWith("WorkingDirectory=")) {
        workingDirectory = line.slice("WorkingDirectory=".length).trim();
      } else if (line.startsWith("Environment=")) {
        const raw = line.slice("Environment=".length).trim();
        const parsed = parseSystemdEnvAssignment(raw);
        if (parsed) {
          inlineEnvironment[parsed.key] = parsed.value;
        }
      } else if (line.startsWith("EnvironmentFile=")) {
        const raw = line.slice("EnvironmentFile=".length).trim();
        for (const entry of splitArgsPreservingQuotes(raw, { escapeMode: "backslash" })) {
          const trimmed = entry.trim();
          if (!trimmed) {
            continue;
          }
          const optional = trimmed.startsWith("-");
          const resolvedPath = optional ? trimmed.slice(1) : trimmed;
          if (!resolvedPath) {
            continue;
          }
          environmentFiles.push({ path: resolvedPath, optional });
        }
      }
    }
    if (!execStart) {
      return null;
    }

    const environment: Record<string, string> = {};
    for (const envFile of environmentFiles) {
      try {
        const raw = await fs.readFile(envFile.path, "utf8");
        for (const rawLine of raw.split("\n")) {
          const line = rawLine.trim();
          if (!line || line.startsWith("#")) {
            continue;
          }
          const normalized = line.startsWith("export ") ? line.slice("export ".length) : line;
          const idx = normalized.indexOf("=");
          if (idx <= 0) {
            continue;
          }
          const key = normalized.slice(0, idx).trim();
          if (!key) {
            continue;
          }
          let value = normalized.slice(idx + 1).trim();
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          environment[key] = value;
        }
      } catch {
        if (!envFile.optional) {
          // Best-effort: skip missing/unreadable env files.
        }
      }
    }
    Object.assign(environment, inlineEnvironment);

    const programArguments = parseSystemdExecStart(execStart);
    return {
      programArguments,
      ...(workingDirectory ? { workingDirectory } : {}),
      ...(Object.keys(environment).length > 0 ? { environment } : {}),
      sourcePath,
    };
  };

  try {
    const content = await fs.readFile(unitPath, "utf8");
    return await parseUnitContent(content, unitPath);
  } catch {
    // Fall back to system-wide unit files when user service isn't installed.
    for (const systemUnitPath of [
      `/etc/systemd/system/${serviceName}.service`,
      `/lib/systemd/system/${serviceName}.service`,
      `/usr/lib/systemd/system/${serviceName}.service`,
    ]) {
      try {
        const content = await fs.readFile(systemUnitPath, "utf8");
        const parsed = await parseUnitContent(content, systemUnitPath);
        if (parsed) {
          return parsed;
        }
      } catch {
        // Try next path.
      }
    }
    return null;
  }
}

export type SystemdServiceInfo = {
  activeState?: string;
  subState?: string;
  mainPid?: number;
  execMainStatus?: number;
  execMainCode?: string;
};

export function parseSystemdShow(output: string): SystemdServiceInfo {
  const entries = parseKeyValueOutput(output, "=");
  const info: SystemdServiceInfo = {};
  const activeState = entries.activestate;
  if (activeState) {
    info.activeState = activeState;
  }
  const subState = entries.substate;
  if (subState) {
    info.subState = subState;
  }
  const mainPidValue = entries.mainpid;
  if (mainPidValue) {
    const pid = Number.parseInt(mainPidValue, 10);
    if (Number.isFinite(pid) && pid > 0) {
      info.mainPid = pid;
    }
  }
  const execMainStatusValue = entries.execmainstatus;
  if (execMainStatusValue) {
    const status = Number.parseInt(execMainStatusValue, 10);
    if (Number.isFinite(status)) {
      info.execMainStatus = status;
    }
  }
  const execMainCode = entries.execmaincode;
  if (execMainCode) {
    info.execMainCode = execMainCode;
  }
  return info;
}

async function execSystemctl(
  scope: SystemctlScope,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return await execFileUtf8("systemctl", scope === "user" ? ["--user", ...args] : args);
}

export async function isSystemdUserServiceAvailable(): Promise<boolean> {
  const res = await execSystemctl("user", ["status"]);
  if (res.code === 0) {
    return true;
  }
  const detail = `${res.stderr} ${res.stdout}`.toLowerCase();
  if (!detail) {
    return false;
  }
  if (detail.includes("not found")) {
    return false;
  }
  if (detail.includes("failed to connect")) {
    return false;
  }
  if (detail.includes("not been booted")) {
    return false;
  }
  if (detail.includes("no such file or directory")) {
    return false;
  }
  if (detail.includes("not supported")) {
    return false;
  }
  return false;
}

async function assertSystemdAvailable() {
  const res = await execSystemctl("user", ["status"]);
  if (res.code === 0) {
    return;
  }
  const detail = res.stderr || res.stdout;
  if (detail.toLowerCase().includes("not found")) {
    throw new Error("systemctl not available; systemd user services are required on Linux.");
  }
  throw new Error(`systemctl --user unavailable: ${detail || "unknown error"}`.trim());
}

async function isSystemdUnitEnabled(scope: SystemctlScope, unitName: string): Promise<boolean> {
  const res = await execSystemctl(scope, ["is-enabled", unitName]);
  return res.code === 0;
}

async function resolveSystemdControlScope(env?: GatewayServiceEnv): Promise<SystemctlScope> {
  const override = env?.OPENCLAW_SYSTEMD_SCOPE?.trim().toLowerCase();
  if (override === "system" || override === "user") {
    return override;
  }

  const serviceName = resolveSystemdServiceName(env ?? {});
  const unitName = `${serviceName}.service`;

  const userAvailable = await isSystemdUserServiceAvailable().catch(() => false);
  if (userAvailable) {
    const userEnabled = await isSystemdUnitEnabled("user", unitName).catch(() => false);
    if (userEnabled) {
      return "user";
    }
  }

  const systemEnabled = await isSystemdUnitEnabled("system", unitName).catch(() => false);
  if (systemEnabled) {
    return "system";
  }

  return userAvailable ? "user" : "system";
}

export async function installSystemdService({
  env,
  stdout,
  programArguments,
  workingDirectory,
  environment,
  description,
}: GatewayServiceInstallArgs): Promise<{ unitPath: string }> {
  await assertSystemdAvailable();

  const unitPath = resolveSystemdUnitPath(env);
  await fs.mkdir(path.dirname(unitPath), { recursive: true });

  // Preserve user customizations: back up existing unit file before overwriting.
  let backedUp = false;
  try {
    await fs.access(unitPath);
    const backupPath = `${unitPath}.bak`;
    await fs.copyFile(unitPath, backupPath);
    backedUp = true;
  } catch {
    // File does not exist yet — nothing to back up.
  }

  const serviceDescription = resolveGatewayServiceDescription({ env, environment, description });
  const unit = buildSystemdUnit({
    description: serviceDescription,
    programArguments,
    workingDirectory,
    environment,
  });
  await fs.writeFile(unitPath, unit, "utf8");

  const serviceName = resolveGatewaySystemdServiceName(env.OPENCLAW_PROFILE);
  const unitName = `${serviceName}.service`;
  const reload = await execSystemctl("user", ["daemon-reload"]);
  if (reload.code !== 0) {
    throw new Error(`systemctl daemon-reload failed: ${reload.stderr || reload.stdout}`.trim());
  }

  const enable = await execSystemctl("user", ["enable", unitName]);
  if (enable.code !== 0) {
    throw new Error(`systemctl enable failed: ${enable.stderr || enable.stdout}`.trim());
  }

  const restart = await execSystemctl("user", ["restart", unitName]);
  if (restart.code !== 0) {
    throw new Error(`systemctl restart failed: ${restart.stderr || restart.stdout}`.trim());
  }

  // Ensure we don't end up writing to a clack spinner line (wizards show progress without a newline).
  writeFormattedLines(
    stdout,
    [
      {
        label: "Installed systemd service",
        value: unitPath,
      },
      ...(backedUp
        ? [
            {
              label: "Previous unit backed up to",
              value: `${unitPath}.bak`,
            },
          ]
        : []),
    ],
    { leadingBlankLine: true },
  );
  return { unitPath };
}

export async function uninstallSystemdService({
  env,
  stdout,
}: GatewayServiceManageArgs): Promise<void> {
  await assertSystemdAvailable();
  const serviceName = resolveGatewaySystemdServiceName(env.OPENCLAW_PROFILE);
  const unitName = `${serviceName}.service`;
  await execSystemctl("user", ["disable", "--now", unitName]);

  const unitPath = resolveSystemdUnitPath(env);
  try {
    await fs.unlink(unitPath);
    stdout.write(`${formatLine("Removed systemd service", unitPath)}\n`);
  } catch {
    stdout.write(`Systemd service not found at ${unitPath}\n`);
  }
}

async function runSystemdServiceAction(params: {
  stdout: NodeJS.WritableStream;
  env?: GatewayServiceEnv;
  action: "stop" | "restart";
  label: string;
}) {
  const scope = await resolveSystemdControlScope(params.env);
  const serviceName = resolveSystemdServiceName(params.env ?? {});
  const unitName = `${serviceName}.service`;
  const res = await execSystemctl(scope, [params.action, unitName]);
  if (res.code !== 0) {
    throw new Error(`systemctl ${params.action} failed: ${res.stderr || res.stdout}`.trim());
  }
  params.stdout.write(`${formatLine(params.label, unitName)}\n`);
}

export async function stopSystemdService({
  stdout,
  env,
}: GatewayServiceControlArgs): Promise<void> {
  await runSystemdServiceAction({
    stdout,
    env,
    action: "stop",
    label: "Stopped systemd service",
  });
}

export async function restartSystemdService({
  stdout,
  env,
}: GatewayServiceControlArgs): Promise<void> {
  await runSystemdServiceAction({
    stdout,
    env,
    action: "restart",
    label: "Restarted systemd service",
  });
}

export async function isSystemdServiceEnabled(args: GatewayServiceEnvArgs): Promise<boolean> {
  const serviceName = resolveSystemdServiceName(args.env ?? {});
  const unitName = `${serviceName}.service`;
  const userAvailable = await isSystemdUserServiceAvailable().catch(() => false);
  if (userAvailable) {
    const userEnabled = await isSystemdUnitEnabled("user", unitName).catch(() => false);
    if (userEnabled) {
      return true;
    }
  }
  const systemEnabled = await isSystemdUnitEnabled("system", unitName).catch(() => false);
  return systemEnabled;
}

export async function readSystemdServiceRuntime(
  env: GatewayServiceEnv = process.env as GatewayServiceEnv,
): Promise<GatewayServiceRuntime> {
  const scope = await resolveSystemdControlScope(env);

  const serviceName = resolveSystemdServiceName(env);
  const unitName = `${serviceName}.service`;
  const res = await execSystemctl(scope, [
    "show",
    unitName,
    "--no-page",
    "--property",
    "ActiveState,SubState,MainPID,ExecMainStatus,ExecMainCode",
  ]);
  if (res.code !== 0) {
    const detail = (res.stderr || res.stdout).trim();
    const missing = detail.toLowerCase().includes("not found");
    return {
      status: missing ? "stopped" : "unknown",
      detail: detail || undefined,
      missingUnit: missing,
    };
  }
  const parsed = parseSystemdShow(res.stdout || "");
  const activeState = parsed.activeState?.toLowerCase();
  const status = activeState === "active" ? "running" : activeState ? "stopped" : "unknown";
  return {
    status,
    state: parsed.activeState,
    subState: parsed.subState,
    pid: parsed.mainPid,
    lastExitStatus: parsed.execMainStatus,
    lastExitReason: parsed.execMainCode,
  };
}
export type LegacySystemdUnit = {
  name: string;
  unitPath: string;
  enabled: boolean;
  exists: boolean;
};

async function isSystemctlAvailable(): Promise<boolean> {
  const res = await execSystemctl("user", ["status"]);
  if (res.code === 0) {
    return true;
  }
  const detail = (res.stderr || res.stdout).toLowerCase();
  return !detail.includes("not found");
}

export async function findLegacySystemdUnits(env: GatewayServiceEnv): Promise<LegacySystemdUnit[]> {
  const results: LegacySystemdUnit[] = [];
  const systemctlAvailable = await isSystemctlAvailable();
  for (const name of LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES) {
    const unitPath = resolveSystemdUnitPathForName(env, name);
    let exists = false;
    try {
      await fs.access(unitPath);
      exists = true;
    } catch {
      // ignore
    }
    let enabled = false;
    if (systemctlAvailable) {
      const res = await execSystemctl("user", ["is-enabled", `${name}.service`]);
      enabled = res.code === 0;
    }
    if (exists || enabled) {
      results.push({ name, unitPath, enabled, exists });
    }
  }
  return results;
}

export async function uninstallLegacySystemdUnits({
  env,
  stdout,
}: GatewayServiceManageArgs): Promise<LegacySystemdUnit[]> {
  const units = await findLegacySystemdUnits(env);
  if (units.length === 0) {
    return units;
  }

  const systemctlAvailable = await isSystemctlAvailable();
  for (const unit of units) {
    if (systemctlAvailable) {
      await execSystemctl("user", ["disable", "--now", `${unit.name}.service`]);
    } else {
      stdout.write(`systemctl unavailable; removed legacy unit file only: ${unit.name}.service\n`);
    }

    try {
      await fs.unlink(unit.unitPath);
      stdout.write(`${formatLine("Removed legacy systemd service", unit.unitPath)}\n`);
    } catch {
      stdout.write(`Legacy systemd unit not found at ${unit.unitPath}\n`);
    }
  }

  return units;
}
