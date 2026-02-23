import { formatRelativeTimestamp, formatDurationHuman, formatMs } from "./format.ts";
import type { CronJob, GatewaySessionRow, PresenceEntry } from "./types.ts";

export function formatPresenceSummary(entry: PresenceEntry): string {
  const host = entry.host ?? "unknown";
  const ip = entry.ip ? `(${entry.ip})` : "";
  const mode = entry.mode ?? "";
  const version = entry.version ?? "";
  return `${host} ${ip} ${mode} ${version}`.trim();
}

export function formatPresenceAge(entry: PresenceEntry): string {
  const ts = entry.ts ?? null;
  return ts ? formatRelativeTimestamp(ts) : "n/a";
}

export function formatNextRun(ms?: number | null) {
  if (!ms) {
    return "n/a";
  }
  const weekday = new Date(ms).toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday}, ${formatMs(ms)} (${formatRelativeTimestamp(ms)})`;
}

export function formatSessionTokens(row: GatewaySessionRow) {
  if (row.totalTokens == null) {
    return "n/a";
  }
  const total = row.totalTokens ?? 0;
  const ctx = row.contextTokens ?? 0;
  return ctx ? `${total} / ${ctx}` : String(total);
}

export function formatEventPayload(payload: unknown): string {
  if (payload == null) {
    return "";
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    // oxlint-disable typescript/no-base-to-string
    return String(payload);
  }
}

export function formatCronState(job: CronJob) {
  const state = job.state ?? {};
  const next = state.nextRunAtMs ? formatMs(state.nextRunAtMs) : "n/a";
  const last = state.lastRunAtMs ? formatMs(state.lastRunAtMs) : "n/a";
  const status = state.lastStatus ?? "n/a";
  return `${status} · next ${next} · last ${last}`;
}

export function formatCronSchedule(job: CronJob) {
  const s = job.schedule;
  if (s.kind === "at") {
    const atMs = Date.parse(s.at);
    return Number.isFinite(atMs) ? `At ${formatMs(atMs)}` : `At ${s.at}`;
  }
  if (s.kind === "every") {
    return `Every ${formatDurationHuman(s.everyMs)}`;
  }
  return `Cron ${s.expr}${s.tz ? ` (${s.tz})` : ""}`;
}

const BRISBANE_TZ = "Australia/Brisbane";

export function formatCronNextRunBrisbane(job: CronJob): string {
  const ms = job.state?.nextRunAtMs;
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return "—";
  }
  return new Date(ms).toLocaleString("en-AU", {
    timeZone: BRISBANE_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatCronScheduleHuman(job: CronJob): string {
  const s = job.schedule;
  if (s.kind === "every") {
    return `Every ${formatDurationHuman(s.everyMs)}`;
  }
  if (s.kind === "at") {
    const atMs = Date.parse(s.at);
    return `Once: ${Number.isFinite(atMs) ? new Date(atMs).toLocaleString("en-AU", { timeZone: BRISBANE_TZ, weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : s.at}`;
  }
  if (s.kind === "cron") {
    const [min, hour, dom, month, dow] = s.expr.trim().split(" ");
    const days: Record<string, string> = { "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat" };
    if (dom === "*" && month === "*" && dow !== "*" && days[dow]) {
      return `${days[dow]}s at ${hour.padStart(2, "0")}:${min.padStart(2, "0")} AEST`;
    }
    if (dom === "*" && month === "*" && dow === "*") {
      return `Daily at ${hour.padStart(2, "0")}:${min.padStart(2, "0")} AEST`;
    }
    return s.expr;
  }
  return "—";
}

export function formatCronPayload(job: CronJob) {
  const p = job.payload;
  if (p.kind === "systemEvent") {
    return `System: ${p.text}`;
  }
  const base = `Agent: ${p.message}`;
  const delivery = job.delivery;
  if (delivery && delivery.mode !== "none") {
    const target =
      delivery.mode === "webhook"
        ? delivery.to
          ? ` (${delivery.to})`
          : ""
        : delivery.channel || delivery.to
          ? ` (${delivery.channel ?? "last"}${delivery.to ? ` -> ${delivery.to}` : ""})`
          : "";
    return `${base} · ${delivery.mode}${target}`;
  }
  return base;
}
