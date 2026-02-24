/**
 * Centralized relative-time formatting utilities.
 *
 * Consolidates 7+ scattered implementations (formatAge, formatAgeShort, formatAgo,
 * formatRelativeTime, formatElapsedTime) into two functions:
 *
 * - `formatTimeAgo(durationMs)` — format a duration as "5m ago" / "5m" (for known elapsed time)
 * - `formatRelativeTimestamp(epochMs)` — format an epoch timestamp relative to now (handles future)
 */

export type FormatTimeAgoOptions = {
  /** Append "ago" suffix. Default: true. When false, returns bare unit: "5m", "2h" */
  suffix?: boolean;
  /** Return value for invalid/null/negative input. Default: "unknown" */
  fallback?: string;
  /** Optional locale for localized output (e.g. "pt-BR") */
  locale?: string;
};

function resolveLocaleTag(locale?: string): string {
  if (!locale) {
    return "en";
  }
  return locale.toLowerCase();
}

function formatRelativeText(value: number, unit: string, isPast: boolean, locale?: string): string {
  const tag = resolveLocaleTag(locale);
  if (tag.startsWith("pt")) {
    return isPast ? `há ${value}${unit}` : `em ${value}${unit}`;
  }
  return isPast ? `${value}${unit} ago` : `in ${value}${unit}`;
}

function formatJustNow(isPast: boolean, locale?: string): string {
  const tag = resolveLocaleTag(locale);
  if (tag.startsWith("pt")) {
    return isPast ? "agora mesmo" : "em <1m";
  }
  return isPast ? "just now" : "in <1m";
}

/**
 * Format a duration (in ms) as a human-readable relative time.
 *
 * Input: how many milliseconds ago something happened.
 *
 * With suffix (default):  "just now", "5m ago", "3h ago", "2d ago"
 * Without suffix:         "0s", "5m", "3h", "2d"
 */
export function formatTimeAgo(
  durationMs: number | null | undefined,
  options?: FormatTimeAgoOptions,
): string {
  const suffix = options?.suffix !== false;
  const fallback = options?.fallback ?? "unknown";
  const locale = options?.locale;

  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) {
    return fallback;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.round(totalSeconds / 60);

  if (minutes < 1) {
    return suffix ? formatJustNow(true, locale) : `${totalSeconds}s`;
  }
  if (minutes < 60) {
    return suffix ? formatRelativeText(minutes, "m", true, locale) : `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return suffix ? formatRelativeText(hours, "h", true, locale) : `${hours}h`;
  }
  const days = Math.round(hours / 24);
  return suffix ? formatRelativeText(days, "d", true, locale) : `${days}d`;
}

export type FormatRelativeTimestampOptions = {
  /** If true, fall back to short date (e.g. "Oct 5") for timestamps >7 days. Default: false */
  dateFallback?: boolean;
  /** IANA timezone for date fallback display */
  timezone?: string;
  /** Return value for invalid/null input. Default: "n/a" */
  fallback?: string;
  /** Optional locale for localized output (e.g. "pt-BR") */
  locale?: string;
};

/**
 * Format an epoch timestamp relative to now.
 *
 * Handles both past ("5m ago") and future ("in 5m") timestamps.
 * Optionally falls back to a short date for timestamps older than 7 days.
 */
export function formatRelativeTimestamp(
  timestampMs: number | null | undefined,
  options?: FormatRelativeTimestampOptions,
): string {
  const fallback = options?.fallback ?? "n/a";
  const locale = options?.locale;
  if (timestampMs == null || !Number.isFinite(timestampMs)) {
    return fallback;
  }

  const diff = Date.now() - timestampMs;
  const absDiff = Math.abs(diff);
  const isPast = diff >= 0;

  const sec = Math.round(absDiff / 1000);
  if (sec < 60) {
    return formatJustNow(isPast, locale);
  }

  const min = Math.round(sec / 60);
  if (min < 60) {
    return formatRelativeText(min, "m", isPast, locale);
  }

  const hr = Math.round(min / 60);
  if (hr < 48) {
    return formatRelativeText(hr, "h", isPast, locale);
  }

  const day = Math.round(hr / 24);
  if (!options?.dateFallback || day <= 7) {
    return formatRelativeText(day, "d", isPast, locale);
  }

  // Fall back to short date display for old timestamps
  try {
    const localeTag = locale && resolveLocaleTag(locale).startsWith("pt") ? "pt-BR" : "en-US";
    return new Intl.DateTimeFormat(localeTag, {
      month: "short",
      day: "numeric",
      ...(options.timezone ? { timeZone: options.timezone } : {}),
    }).format(new Date(timestampMs));
  } catch {
    return formatRelativeText(day, "d", isPast, locale);
  }
}
