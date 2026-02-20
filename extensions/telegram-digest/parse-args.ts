import type { TgDigestArgs, TgChannelArgs, TgTopicsArgs, TgTopArgs } from "./types.js";

/** Regex matching a valid period token: digits + h/d/w/m (hours/days/weeks/months). */
const PERIOD_RE = /^\d+[hdwm]$/;

/** Default period for all commands. */
const DEFAULT_PERIOD = "1d";

/** Default top-N count. */
const DEFAULT_TOP_COUNT = 10;

/**
 * Convert a period string (e.g., "7d", "2w", "3h", "1m") to milliseconds.
 *
 * Note: uses its own implementation because the shared `parseDurationMs`
 * interprets `m` as minutes, while here `m` means months.
 */
export function periodToMs(period: string): number {
  const match = period.match(/^(\d+)([hdwm])$/);
  if (!match) {
    return 24 * 60 * 60 * 1000; // fallback: 1 day
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "w":
      return value * 7 * 24 * 60 * 60 * 1000;
    case "m":
      return value * 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

/** Parse `/tg_digest [period]` arguments. */
export function parseDigestArgs(raw: string): TgDigestArgs {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const period = tokens.find((t) => PERIOD_RE.test(t)) ?? DEFAULT_PERIOD;
  return { period };
}

/** Parse `/tg_channel <name> [period]` arguments. */
export function parseChannelArgs(raw: string): TgChannelArgs {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);

  let channel = "";
  let period = DEFAULT_PERIOD;

  for (const token of tokens) {
    if (PERIOD_RE.test(token)) {
      period = token;
    } else if (!channel) {
      channel = token;
    }
  }

  return { channel, period };
}

/** Parse `/tg_topics [period]` arguments. */
export function parseTopicsArgs(raw: string): TgTopicsArgs {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const period = tokens.find((t) => PERIOD_RE.test(t)) ?? DEFAULT_PERIOD;
  return { period };
}

/** Parse `/tg_top [N] [period]` arguments. */
export function parseTopArgs(raw: string): TgTopArgs {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);

  let count = DEFAULT_TOP_COUNT;
  let period = DEFAULT_PERIOD;

  for (const token of tokens) {
    if (PERIOD_RE.test(token)) {
      period = token;
    } else if (/^\d+$/.test(token)) {
      count = Math.max(1, Math.min(100, Number(token)));
    }
  }

  return { count, period };
}
