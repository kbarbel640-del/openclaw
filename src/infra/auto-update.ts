import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { VERSION } from "../version.js";
import { normalizeUpdateChannel, DEFAULT_PACKAGE_CHANNEL } from "./update-channels.js";
import { compareSemverStrings, resolveNpmChannelTag } from "./update-check.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type AutoUpdateMode = "confirm" | "silent" | "notify-only";

export type AutoUpdateConfig = {
  enabled?: boolean;
  mode?: AutoUpdateMode;
  schedule?: string;
  timezone?: string;
  notifyAfterUpdate?: boolean;
  notifyChannel?: string;
};

export type AutoUpdateCheckResult = {
  currentVersion: string;
  availableVersion: string | null;
  updateAvailable: boolean;
  tag: string;
};

export type AutoUpdateState = {
  preUpdateVersion?: string;
  updatedAt?: string;
};

// ── Defaults ───────────────────────────────────────────────────────────────

export const AUTO_UPDATE_DEFAULTS = {
  enabled: false,
  mode: "notify-only" as AutoUpdateMode,
  schedule: "03:00",
  notifyAfterUpdate: true,
  notifyChannel: "last",
} as const;

// ── Schedule Parsing ───────────────────────────────────────────────────────

const HH_MM_RE = /^(\d{2}):(\d{2})$/;

/**
 * Parse an HH:MM time string into a cron expression that fires daily at that
 * time.  Returns `null` for invalid input.
 */
export function parseScheduleToCron(schedule: string): string | null {
  const m = HH_MM_RE.exec(schedule.trim());
  if (!m) {
    return null;
  }
  const hour = Number.parseInt(m[1]!, 10);
  const minute = Number.parseInt(m[2]!, 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  // cron: second minute hour day month weekday
  return `0 ${minute} ${hour} * * *`;
}

/**
 * Compute the next run time (epoch ms) for an HH:MM schedule in a given
 * timezone.  If the time has already passed today, returns tomorrow's time.
 */
export function computeNextScheduleMs(
  schedule: string,
  timezone: string,
  nowMs: number,
): number | null {
  const m = HH_MM_RE.exec(schedule.trim());
  if (!m) {
    return null;
  }
  const hour = Number.parseInt(m[1]!, 10);
  const minute = Number.parseInt(m[2]!, 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  // Build a date in the target timezone for today at HH:MM.
  // We use Intl to get current wall-clock time in the target tz.
  const now = new Date(nowMs);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const currentHour = get("hour");
  const currentMinute = get("minute");
  const currentSecond = get("second");

  // How many ms until the target time today?
  const targetTodaySec = hour * 3600 + minute * 60;
  const currentSec = currentHour * 3600 + currentMinute * 60 + currentSecond;
  const diffSec = targetTodaySec - currentSec;

  if (diffSec > 0) {
    return nowMs + diffSec * 1000;
  }
  // Already passed today — schedule for tomorrow.
  return nowMs + (diffSec + 86400) * 1000;
}

// ── State File (pre-update version persistence) ────────────────────────────

const AUTO_UPDATE_STATE_FILENAME = "auto-update-state.json";

export function resolveAutoUpdateStatePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), AUTO_UPDATE_STATE_FILENAME);
}

export async function readAutoUpdateState(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AutoUpdateState> {
  const filePath = resolveAutoUpdateStatePath(env);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as AutoUpdateState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeAutoUpdateState(
  state: AutoUpdateState,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const filePath = resolveAutoUpdateStatePath(env);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export async function consumeAutoUpdateState(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AutoUpdateState | null> {
  const filePath = resolveAutoUpdateStatePath(env);
  const state = await readAutoUpdateState(env);
  if (!state.preUpdateVersion) {
    return null;
  }
  // Remove the file after consuming.
  await fs.unlink(filePath).catch(() => {});
  return state;
}

// ── Update Check ───────────────────────────────────────────────────────────

/**
 * Check if a newer version is available on the configured channel.
 */
export async function checkForAvailableUpdate(params: {
  channel?: "stable" | "beta" | "dev";
  timeoutMs?: number;
}): Promise<AutoUpdateCheckResult> {
  const channel = params.channel ?? DEFAULT_PACKAGE_CHANNEL;
  const npmChannel = normalizeUpdateChannel(channel) ?? DEFAULT_PACKAGE_CHANNEL;
  const resolved = await resolveNpmChannelTag({
    channel: npmChannel,
    timeoutMs: params.timeoutMs ?? 3500,
  });

  const updateAvailable =
    resolved.version != null &&
    compareSemverStrings(VERSION, resolved.version) != null &&
    compareSemverStrings(VERSION, resolved.version)! < 0;

  return {
    currentVersion: VERSION,
    availableVersion: resolved.version,
    updateAvailable,
    tag: resolved.tag,
  };
}

// ── Resolve Config Helpers ─────────────────────────────────────────────────

export function resolveAutoUpdateConfig(
  raw: AutoUpdateConfig | undefined,
): Required<AutoUpdateConfig> {
  return {
    enabled: raw?.enabled ?? AUTO_UPDATE_DEFAULTS.enabled,
    mode: raw?.mode ?? AUTO_UPDATE_DEFAULTS.mode,
    schedule: raw?.schedule ?? AUTO_UPDATE_DEFAULTS.schedule,
    timezone: raw?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    notifyAfterUpdate: raw?.notifyAfterUpdate ?? AUTO_UPDATE_DEFAULTS.notifyAfterUpdate,
    notifyChannel: raw?.notifyChannel ?? AUTO_UPDATE_DEFAULTS.notifyChannel,
  };
}

// ── Post-Update Notification ───────────────────────────────────────────────

/**
 * After restart, check if we were auto-updated and return a notification
 * message.  Consumes the state file so it only fires once.
 */
export async function checkPostAutoUpdateNotification(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ message: string; oldVersion: string; newVersion: string } | null> {
  const state = await consumeAutoUpdateState(env);
  if (!state?.preUpdateVersion) {
    return null;
  }
  const oldVersion = state.preUpdateVersion;
  const newVersion = VERSION;
  if (oldVersion === newVersion) {
    return null;
  }
  return {
    message: `✅ Auto-updated from v${oldVersion} → v${newVersion}`,
    oldVersion,
    newVersion,
  };
}

// ── Scheduler ──────────────────────────────────────────────────────────────

export type AutoUpdateSchedulerDeps = {
  config: AutoUpdateConfig | undefined;
  updateChannel?: "stable" | "beta" | "dev";
  userTimezone?: string;
  onNotify: (message: string) => void;
  onConfirm: (message: string) => void;
  onSilentUpdate: () => Promise<void>;
  log: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    error?: (msg: string, meta?: Record<string, unknown>) => void;
  };
};

/**
 * Start the auto-update scheduler.  Returns a cleanup function to cancel the
 * timer.
 */
export function startAutoUpdateScheduler(deps: AutoUpdateSchedulerDeps): () => void {
  const cfg = resolveAutoUpdateConfig(deps.config);
  if (!cfg.enabled) {
    return () => {};
  }

  const timezone = deps.userTimezone ?? cfg.timezone;
  const scheduleNextCheck = (): ReturnType<typeof setTimeout> | null => {
    const nextMs = computeNextScheduleMs(cfg.schedule, timezone, Date.now());
    if (nextMs == null) {
      deps.log.info("auto-update: invalid schedule, disabling", {
        schedule: cfg.schedule,
      });
      return null;
    }
    const delayMs = Math.max(1000, nextMs - Date.now());
    deps.log.info("auto-update: next check scheduled", {
      delayMs,
      mode: cfg.mode,
      schedule: cfg.schedule,
      timezone,
    });

    return setTimeout(async () => {
      try {
        await runScheduledCheck();
      } catch (err) {
        deps.log.error?.("auto-update: check failed", { error: String(err) });
      }
      // Re-schedule for the next day.
      timer = scheduleNextCheck();
    }, delayMs);
  };

  const runScheduledCheck = async () => {
    const result = await checkForAvailableUpdate({
      channel: deps.updateChannel,
    });

    if (!result.updateAvailable || !result.availableVersion) {
      deps.log.info("auto-update: no update available", {
        current: result.currentVersion,
      });
      return;
    }

    const versionMsg = `Update available: v${result.currentVersion} → v${result.availableVersion} (${result.tag})`;

    switch (cfg.mode) {
      case "notify-only":
        deps.onNotify(versionMsg);
        break;
      case "confirm":
        deps.onConfirm(`${versionMsg}\nReply "yes" to update now.`);
        break;
      case "silent":
        deps.log.info("auto-update: starting silent update");
        await writeAutoUpdateState({
          preUpdateVersion: result.currentVersion,
          updatedAt: new Date().toISOString(),
        });
        await deps.onSilentUpdate();
        break;
    }
  };

  let timer = scheduleNextCheck();
  return () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
