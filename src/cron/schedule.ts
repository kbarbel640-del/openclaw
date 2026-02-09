import { Cron } from "croner";
import type { CronSchedule } from "./types.js";
import { parseAbsoluteTimeMs } from "./parse.js";

/**
 * Returns `true` when at least one scheduled occurrence falls strictly
 * between `afterMs` (exclusive) and `beforeMs` (inclusive).
 *
 * This is used during startup catch-up: if the gateway was down and a
 * recurring job missed one or more occurrences since its last successful
 * run, the job should be made immediately due instead of waiting until the
 * next future occurrence.
 */
export function hasMissedOccurrence(
  schedule: CronSchedule,
  afterMs: number,
  beforeMs: number,
): boolean {
  if (afterMs >= beforeMs) {
    return false;
  }

  if (schedule.kind === "at") {
    // One-shot jobs don't have repeating occurrences to miss.
    return false;
  }

  if (schedule.kind === "every") {
    const everyMs = Math.max(1, Math.floor(schedule.everyMs));
    const anchor = Math.max(0, Math.floor(schedule.anchorMs ?? 0));
    // There's a missed occurrence if the interval between afterMs and
    // beforeMs spans at least one tick.
    const stepsAfter = Math.floor((afterMs - anchor) / everyMs);
    const nextTickAfterAfterMs = anchor + (stepsAfter + 1) * everyMs;
    return nextTickAfterAfterMs <= beforeMs;
  }

  // Cron expression schedule — use croner to find the next occurrence
  // after `afterMs` and check whether it falls before `beforeMs`.
  const expr = schedule.expr.trim();
  if (!expr) {
    return false;
  }
  const cron = new Cron(expr, {
    timezone: schedule.tz?.trim() || undefined,
    catch: false,
  });
  const next = cron.nextRun(new Date(afterMs));
  return next !== null && next.getTime() <= beforeMs;
}

export function computeNextRunAtMs(schedule: CronSchedule, nowMs: number): number | undefined {
  if (schedule.kind === "at") {
    const atMs = parseAbsoluteTimeMs(schedule.at);
    if (atMs === null) {
      return undefined;
    }
    return atMs > nowMs ? atMs : undefined;
  }

  if (schedule.kind === "every") {
    const everyMs = Math.max(1, Math.floor(schedule.everyMs));
    const anchor = Math.max(0, Math.floor(schedule.anchorMs ?? nowMs));
    if (nowMs < anchor) {
      return anchor;
    }
    const elapsed = nowMs - anchor;
    const steps = Math.max(1, Math.floor((elapsed + everyMs - 1) / everyMs));
    return anchor + steps * everyMs;
  }

  const expr = schedule.expr.trim();
  if (!expr) {
    return undefined;
  }
  const cron = new Cron(expr, {
    timezone: schedule.tz?.trim() || undefined,
    catch: false,
  });
  const next = cron.nextRun(new Date(nowMs));
  return next ? next.getTime() : undefined;
}
