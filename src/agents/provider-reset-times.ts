/**
 * Provider billing reset schedules.
 *
 * When a billing error occurs, knowing *when* the quota resets lets the user
 * (and the agent) decide whether to wait vs. switch providers.
 *
 * Exported helpers are pure functions (Date.now injected for testability).
 */

export type ResetSchedule =
  | { kind: "daily"; utcHour: number } // resets every day at this UTC hour
  | { kind: "monthly"; dayOfMonth: number; utcHour: number } // resets on day N each month
  | { kind: "none" }; // unknown / pay-as-you-go / free beta

/**
 * Known provider reset schedules.
 * Keys are normalised provider ids (lowercase, trimmed).
 */
const PROVIDER_RESET_SCHEDULES: Record<string, ResetSchedule> = {
  venice: { kind: "daily", utcHour: 0 }, // midnight UTC
  "venice.ai": { kind: "daily", utcHour: 0 },
  openai: { kind: "monthly", dayOfMonth: 1, utcHour: 0 },
  anthropic: { kind: "monthly", dayOfMonth: 1, utcHour: 0 },
  copilot: { kind: "monthly", dayOfMonth: 1, utcHour: 0 },
  "github-copilot": { kind: "monthly", dayOfMonth: 1, utcHour: 0 },
  "mor-gateway": { kind: "none" }, // free beta / staked MOR
  morpheus: { kind: "none" },
};

function normalizeId(provider: string): string {
  return provider.trim().toLowerCase();
}

export function getResetSchedule(provider: string): ResetSchedule {
  return PROVIDER_RESET_SCHEDULES[normalizeId(provider)] ?? { kind: "none" };
}

/**
 * Calculate milliseconds until the next billing reset for a provider.
 * Returns `null` when the schedule is unknown.
 */
export function msUntilReset(provider: string, now: number = Date.now()): number | null {
  const schedule = getResetSchedule(provider);
  if (schedule.kind === "none") {
    return null;
  }

  const nowDate = new Date(now);

  if (schedule.kind === "daily") {
    const resetToday = new Date(nowDate);
    resetToday.setUTCHours(schedule.utcHour, 0, 0, 0);
    if (resetToday.getTime() <= now) {
      resetToday.setUTCDate(resetToday.getUTCDate() + 1);
    }
    return resetToday.getTime() - now;
  }

  if (schedule.kind === "monthly") {
    const resetThisMonth = new Date(
      Date.UTC(
        nowDate.getUTCFullYear(),
        nowDate.getUTCMonth(),
        schedule.dayOfMonth,
        schedule.utcHour,
      ),
    );
    if (resetThisMonth.getTime() <= now) {
      // next month
      resetThisMonth.setUTCMonth(resetThisMonth.getUTCMonth() + 1);
    }
    return resetThisMonth.getTime() - now;
  }

  return null;
}

/**
 * Human-readable "resets in Xh Ym" string, or `null` if unknown.
 */
export function formatResetCountdown(provider: string, now: number = Date.now()): string | null {
  const ms = msUntilReset(provider, now);
  if (ms === null) {
    return null;
  }

  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `resets in ${days}d ${remainingHours}h`;
  }
  if (hours > 0) {
    return `resets in ${hours}h ${minutes}m`;
  }
  return `resets in ${minutes}m`;
}
