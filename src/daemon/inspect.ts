import fs from "node:fs/promises";
import path from "node:path";
import {
  GATEWAY_SERVICE_KIND,
  GATEWAY_SERVICE_MARKER,
  resolveGatewayLaunchAgentLabel,
  resolveGatewaySystemdServiceName,
  resolveGatewayWindowsTaskName,
} from "./constants.js";
import { execSchtasks } from "./schtasks-exec.js";

export type ExtraGatewayService = {
  platform: "darwin" | "linux" | "win32";
  label: string;
  detail: string;
  scope: "user" | "system";
  marker?: "openclaw" | "clawdbot" | "moltbot";
  legacy?: boolean;
};

export type FindExtraGatewayServicesOptions = {
  deep?: boolean;
};

const EXTRA_MARKERS = ["openclaw", "clawdbot", "moltbot"] as const;

export function renderGatewayServiceCleanupHints(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string[] {
  const profile = env.OPENCLAW_PROFILE;
  switch (process.platform) {
    case "darwin": {
      const label = resolveGatewayLaunchAgentLabel(profile);
      return [`launchctl bootout gui/$UID/${label}`, `rm ~/Library/LaunchAgents/${label}.plist`];
    }
    case "linux": {
      const unit = resolveGatewaySystemdServiceName(profile);
      return [
        `systemctl --user disable --now ${unit}.service`,
        `rm ~/.config/systemd/user/${unit}.service`,
      ];
    }
    case "win32": {
      const task = resolveGatewayWindowsTaskName(profile);
      return [`schtasks /Delete /TN "${task}" /F`];
    }
    default:
      return [];
  }
}

function resolveHomeDir(env: Record<string, string | undefined>): string {
  const home = env.HOME?.trim() || env.USERPROFILE?.trim();
  if (!home) {
    throw new Error("Missing HOME");
  }
  return home;
}

type Marker = (typeof EXTRA_MARKERS)[number];

/**
 * Known service name prefixes that indicate a gateway-related service.
 * Systemd names: "openclaw-", "clawdbot-", "moltbot-"
 * Launchd labels: "ai.openclaw.", plus legacy markers in the label.
 */
const SYSTEMD_GATEWAY_NAME_PREFIXES = ["openclaw-", "clawdbot-", "moltbot-"];
const LAUNCHD_GATEWAY_LABEL_PREFIXES = ["ai.openclaw."];

function detectMarkerFromName(name: string, prefixes: string[]): Marker | null {
  const lower = name.toLowerCase();
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      for (const marker of EXTRA_MARKERS) {
        if (prefix.includes(marker)) {
          return marker;
        }
      }
    }
  }
  // Also check legacy marker names directly in the label/name
  for (const marker of EXTRA_MARKERS) {
    if (marker !== "openclaw" && lower.includes(marker)) {
      return marker;
    }
  }
  return null;
}

/**
 * Detects a marker by checking if the service file's ExecStart / command
 * actually invokes a known gateway binary (e.g. `openclaw gateway run`,
 * `clawdbot gateway`, `moltbot`). Avoids false positives from incidental
 * mentions of "openclaw" in paths, descriptions, or working directories.
 */
function detectMarkerFromCommand(content: string): Marker | null {
  const lower = content.toLowerCase();
  // Extract ExecStart lines (systemd) or look for ProgramArguments (launchd plist)
  const execStartMatch = lower.match(/execstart\s*=\s*(.+)/);
  const commandLine = execStartMatch?.[1] ?? "";

  // For launchd plists, look at ProgramArguments content
  const plistCommandMatch = lower.match(
    /<key>programarguments<\/key>\s*<array>([\s\S]*?)<\/array>/,
  );
  const plistArgs = plistCommandMatch?.[1] ?? "";

  const searchTarget = `${commandLine} ${plistArgs}`;
  if (!searchTarget.trim()) {
    return null;
  }

  for (const marker of EXTRA_MARKERS) {
    if (searchTarget.includes(marker)) {
      return marker;
    }
  }
  return null;
}

/**
 * Detects whether a service file represents a gateway-like service.
 *
 * Uses a three-tier heuristic:
 * 1. Service name/label prefix matching (most reliable)
 * 2. ExecStart/command content matching (checks actual binary invocation)
 * 3. Structured OPENCLAW_SERVICE_MARKER env vars in file contents
 *
 * Avoids flagging unrelated services that merely contain "openclaw" in
 * paths, descriptions, or working directories.
 */
function detectServiceMarker(name: string, content: string, namePrefixes: string[]): Marker | null {
  // Tier 1: check service name/label for known prefixes
  const nameMarker = detectMarkerFromName(name, namePrefixes);
  if (nameMarker) {
    return nameMarker;
  }

  // Tier 2: check if the service's ExecStart/command invokes a known binary
  const commandMarker = detectMarkerFromCommand(content);
  if (commandMarker) {
    return commandMarker;
  }

  // Tier 3: check for structured service marker env vars
  if (hasGatewayServiceMarker(content)) {
    return "openclaw";
  }

  return null;
}

function hasGatewayServiceMarker(content: string): boolean {
  const lower = content.toLowerCase();
  const markerKeys = ["openclaw_service_marker"];
  const kindKeys = ["openclaw_service_kind"];
  const markerValues = [GATEWAY_SERVICE_MARKER.toLowerCase()];
  const hasMarkerKey = markerKeys.some((key) => lower.includes(key));
  const hasKindKey = kindKeys.some((key) => lower.includes(key));
  const hasMarkerValue = markerValues.some((value) => lower.includes(value));
  return (
    hasMarkerKey &&
    hasKindKey &&
    hasMarkerValue &&
    lower.includes(GATEWAY_SERVICE_KIND.toLowerCase())
  );
}

function isOpenClawGatewayLaunchdService(label: string, contents: string): boolean {
  if (hasGatewayServiceMarker(contents)) {
    return true;
  }
  const lowerContents = contents.toLowerCase();
  if (!lowerContents.includes("gateway")) {
    return false;
  }
  return label.startsWith("ai.openclaw.");
}

function isOpenClawGatewaySystemdService(name: string, contents: string): boolean {
  if (hasGatewayServiceMarker(contents)) {
    return true;
  }
  if (!name.startsWith("openclaw-gateway")) {
    return false;
  }
  return contents.toLowerCase().includes("gateway");
}

function isOpenClawGatewayTaskName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const defaultName = resolveGatewayWindowsTaskName().toLowerCase();
  return normalized === defaultName || normalized.startsWith("openclaw gateway");
}

function tryExtractPlistLabel(contents: string): string | null {
  const match = contents.match(/<key>Label<\/key>\s*<string>([\s\S]*?)<\/string>/i);
  if (!match) {
    return null;
  }
  return match[1]?.trim() || null;
}

function isIgnoredLaunchdLabel(label: string): boolean {
  return label === resolveGatewayLaunchAgentLabel();
}

function isIgnoredSystemdName(name: string): boolean {
  return name === resolveGatewaySystemdServiceName();
}

function isLegacyLabel(label: string): boolean {
  const lower = label.toLowerCase();
  return lower.includes("clawdbot") || lower.includes("moltbot");
}

async function readDirEntries(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

async function readUtf8File(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

type ServiceFileEntry = {
  entry: string;
  name: string;
  fullPath: string;
  contents: string;
};

async function collectServiceFiles(params: {
  dir: string;
  extension: string;
  isIgnoredName: (name: string) => boolean;
}): Promise<ServiceFileEntry[]> {
  const out: ServiceFileEntry[] = [];
  const entries = await readDirEntries(params.dir);
  for (const entry of entries) {
    if (!entry.endsWith(params.extension)) {
      continue;
    }
    const name = entry.slice(0, -params.extension.length);
    if (params.isIgnoredName(name)) {
      continue;
    }
    const fullPath = path.join(params.dir, entry);
    const contents = await readUtf8File(fullPath);
    if (contents === null) {
      continue;
    }
    out.push({ entry, name, fullPath, contents });
  }
  return out;
}

async function scanLaunchdDir(params: {
  dir: string;
  scope: "user" | "system";
}): Promise<ExtraGatewayService[]> {
  const results: ExtraGatewayService[] = [];
  const candidates = await collectServiceFiles({
    dir: params.dir,
    extension: ".plist",
    isIgnoredName: isIgnoredLaunchdLabel,
  });

  for (const { name: labelFromName, fullPath, contents } of candidates) {
    const label = tryExtractPlistLabel(contents) ?? labelFromName;
    // Use targeted detection: name prefix, then ExecStart/command, then structured env markers.
    // This avoids false positives from incidental mentions of "openclaw" in descriptions or paths.
    const marker = detectServiceMarker(label, contents, LAUNCHD_GATEWAY_LABEL_PREFIXES);
    if (!marker) {
      const legacyLabel = isLegacyLabel(labelFromName) || isLegacyLabel(label);
      if (!legacyLabel) {
        continue;
      }
      results.push({
        platform: "darwin",
        label,
        detail: `plist: ${fullPath}`,
        scope: params.scope,
        marker: isLegacyLabel(label) ? "clawdbot" : "moltbot",
        legacy: true,
      });
      continue;
    }
    if (isIgnoredLaunchdLabel(label)) {
      continue;
    }
    if (marker === "openclaw" && isOpenClawGatewayLaunchdService(label, contents)) {
      continue;
    }
    results.push({
      platform: "darwin",
      label,
      detail: `plist: ${fullPath}`,
      scope: params.scope,
      marker,
      legacy: marker !== "openclaw" || isLegacyLabel(label),
    });
  }

  return results;
}

async function scanSystemdDir(params: {
  dir: string;
  scope: "user" | "system";
}): Promise<ExtraGatewayService[]> {
  const results: ExtraGatewayService[] = [];
  const candidates = await collectServiceFiles({
    dir: params.dir,
    extension: ".service",
    isIgnoredName: isIgnoredSystemdName,
  });

  for (const { entry, name, fullPath, contents } of candidates) {
    // Use targeted detection: name prefix, then ExecStart command, then structured env markers.
    // This avoids false positives from unrelated services that merely reference "openclaw" in
    // paths, descriptions, or working directories (e.g. voice pipelines, custom daemons).
    const marker = detectServiceMarker(name, contents, SYSTEMD_GATEWAY_NAME_PREFIXES);
    if (!marker) {
      continue;
    }
    if (marker === "openclaw" && isOpenClawGatewaySystemdService(name, contents)) {
      continue;
    }
    results.push({
      platform: "linux",
      label: entry,
      detail: `unit: ${fullPath}`,
      scope: params.scope,
      marker,
      legacy: marker !== "openclaw",
    });
  }

  return results;
}

type ScheduledTaskInfo = {
  name: string;
  taskToRun?: string;
};

function parseSchtasksList(output: string): ScheduledTaskInfo[] {
  const tasks: ScheduledTaskInfo[] = [];
  let current: ScheduledTaskInfo | null = null;

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (current) {
        tasks.push(current);
        current = null;
      }
      continue;
    }
    const idx = line.indexOf(":");
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!value) {
      continue;
    }
    if (key === "taskname") {
      if (current) {
        tasks.push(current);
      }
      current = { name: value };
      continue;
    }
    if (!current) {
      continue;
    }
    if (key === "task to run") {
      current.taskToRun = value;
    }
  }

  if (current) {
    tasks.push(current);
  }
  return tasks;
}

export async function findExtraGatewayServices(
  env: Record<string, string | undefined>,
  opts: FindExtraGatewayServicesOptions = {},
): Promise<ExtraGatewayService[]> {
  const results: ExtraGatewayService[] = [];
  const seen = new Set<string>();
  const push = (svc: ExtraGatewayService) => {
    const key = `${svc.platform}:${svc.label}:${svc.detail}:${svc.scope}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    results.push(svc);
  };

  if (process.platform === "darwin") {
    try {
      const home = resolveHomeDir(env);
      const userDir = path.join(home, "Library", "LaunchAgents");
      for (const svc of await scanLaunchdDir({
        dir: userDir,
        scope: "user",
      })) {
        push(svc);
      }
      if (opts.deep) {
        for (const svc of await scanLaunchdDir({
          dir: path.join(path.sep, "Library", "LaunchAgents"),
          scope: "system",
        })) {
          push(svc);
        }
        for (const svc of await scanLaunchdDir({
          dir: path.join(path.sep, "Library", "LaunchDaemons"),
          scope: "system",
        })) {
          push(svc);
        }
      }
    } catch {
      return results;
    }
    return results;
  }

  if (process.platform === "linux") {
    try {
      const home = resolveHomeDir(env);
      const userDir = path.join(home, ".config", "systemd", "user");
      for (const svc of await scanSystemdDir({
        dir: userDir,
        scope: "user",
      })) {
        push(svc);
      }
      if (opts.deep) {
        for (const dir of [
          "/etc/systemd/system",
          "/usr/lib/systemd/system",
          "/lib/systemd/system",
        ]) {
          for (const svc of await scanSystemdDir({
            dir,
            scope: "system",
          })) {
            push(svc);
          }
        }
      }
    } catch {
      return results;
    }
    return results;
  }

  if (process.platform === "win32") {
    if (!opts.deep) {
      return results;
    }
    const res = await execSchtasks(["/Query", "/FO", "LIST", "/V"]);
    if (res.code !== 0) {
      return results;
    }
    const tasks = parseSchtasksList(res.stdout);
    for (const task of tasks) {
      const name = task.name.trim();
      if (!name) {
        continue;
      }
      if (isOpenClawGatewayTaskName(name)) {
        continue;
      }
      const lowerName = name.toLowerCase();
      const lowerCommand = task.taskToRun?.toLowerCase() ?? "";
      let marker: Marker | null = null;
      for (const candidate of EXTRA_MARKERS) {
        if (lowerName.includes(candidate) || lowerCommand.includes(candidate)) {
          marker = candidate;
          break;
        }
      }
      if (!marker) {
        continue;
      }
      push({
        platform: "win32",
        label: name,
        detail: task.taskToRun ? `task: ${name}, run: ${task.taskToRun}` : name,
        scope: "system",
        marker,
        legacy: marker !== "openclaw",
      });
    }
    return results;
  }

  return results;
}
