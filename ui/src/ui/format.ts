import { formatDurationHuman as formatDurationHumanBase } from "../../../src/infra/format-time/format-duration.ts";
import type { FormatRelativeTimestampOptions } from "../../../src/infra/format-time/format-relative.ts";
import { stripReasoningTagsFromText } from "../../../src/shared/text/reasoning-tags.js";
import { i18n, t } from "../i18n/index.ts";

export function getUiLocale(): string {
  return i18n.getLocale();
}

export function formatDurationHuman(ms?: number | null, fallback = t("common.na")): string {
  return formatDurationHumanBase(ms, fallback);
}

function formatRelativeUnit(
  count: number,
  unit: "minutes" | "hours" | "days",
  isPast: boolean,
): string {
  const unitKey =
    unit === "minutes"
      ? isPast
        ? "format.pastMinutes"
        : "format.futureMinutes"
      : unit === "hours"
        ? isPast
          ? "format.pastHours"
          : "format.futureHours"
        : isPast
          ? "format.pastDays"
          : "format.futureDays";
  return t(unitKey, { count: String(count) });
}

export function formatRelativeTimestamp(
  timestampMs: number | null | undefined,
  options?: FormatRelativeTimestampOptions,
): string {
  const fallback = options?.fallback ?? t("common.na");
  if (timestampMs == null || !Number.isFinite(timestampMs)) {
    return fallback;
  }

  const diff = Date.now() - timestampMs;
  const absDiff = Math.abs(diff);
  const isPast = diff >= 0;

  const sec = Math.round(absDiff / 1000);
  if (sec < 60) {
    return isPast ? t("format.justNow") : t("format.lessThanMinuteFuture");
  }

  const min = Math.round(sec / 60);
  if (min < 60) {
    return formatRelativeUnit(min, "minutes", isPast);
  }

  const hr = Math.round(min / 60);
  if (hr < 48) {
    return formatRelativeUnit(hr, "hours", isPast);
  }

  const day = Math.round(hr / 24);
  if (!options?.dateFallback || day <= 7) {
    return formatRelativeUnit(day, "days", isPast);
  }

  try {
    return new Intl.DateTimeFormat(getUiLocale(), {
      month: "short",
      day: "numeric",
      ...(options.timezone ? { timeZone: options.timezone } : {}),
    }).format(new Date(timestampMs));
  } catch {
    return formatRelativeUnit(day, "days", isPast);
  }
}

export function formatMs(ms?: number | null): string {
  if (!ms && ms !== 0) {
    return t("common.na");
  }
  return new Date(ms).toLocaleString(getUiLocale());
}

export function formatList(values?: Array<string | null | undefined>): string {
  if (!values || values.length === 0) {
    return t("states.none");
  }
  return values.filter((v): v is string => Boolean(v && v.trim())).join(", ");
}

export function clampText(value: string, max = 120): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function truncateText(
  value: string,
  max: number,
): {
  text: string;
  truncated: boolean;
  total: number;
} {
  if (value.length <= max) {
    return { text: value, truncated: false, total: value.length };
  }
  return {
    text: value.slice(0, Math.max(0, max)),
    truncated: true,
    total: value.length,
  };
}

export function toNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseList(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function stripThinkingTags(value: string): string {
  return stripReasoningTagsFromText(value, { mode: "preserve", trim: "start" });
}
