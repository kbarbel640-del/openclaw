export type ParsedLogLine = {
  time?: string;
  level?: string;
  subsystem?: string;
  module?: string;
  message: string;
  raw: string;
};

/** Matches structured prefix: [YYYY-MM-DD HH:mm:ss.SSS] [pid] [subsystem] level: */
export const STRUCTURED_LINE_RE =
  /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]\s*\[(\d+)\]\s*\[([^\]]*)\]\s*(\w+):\s*(.*)$/s;

export function parseStructuredLine(raw: string): ParsedLogLine | null {
  const m = raw.match(STRUCTURED_LINE_RE);
  if (!m) {
    return null;
  }
  const [, timeStr, _pid, subsystem, level, rest] = m;
  return {
    time: timeStr,
    level: level?.toLowerCase(),
    subsystem: subsystem ?? undefined,
    message: rest ?? "",
    raw,
  };
}

function extractMessage(value: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of Object.keys(value)) {
    if (!/^\d+$/.test(key)) {
      continue;
    }
    const item = value[key];
    if (typeof item === "string") {
      parts.push(item);
    } else if (item != null) {
      parts.push(JSON.stringify(item));
    }
  }
  return parts.join(" ");
}

function parseMetaName(raw?: unknown): { subsystem?: string; module?: string } {
  if (typeof raw !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      subsystem: typeof parsed.subsystem === "string" ? parsed.subsystem : undefined,
      module: typeof parsed.module === "string" ? parsed.module : undefined,
    };
  } catch {
    return {};
  }
}

export function parseLogLine(raw: string): ParsedLogLine | null {
  const structured = parseStructuredLine(raw);
  if (structured) {
    return structured;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const meta = parsed._meta as Record<string, unknown> | undefined;
    const nameMeta = parseMetaName(meta?.name);
    const levelRaw = typeof meta?.logLevelName === "string" ? meta.logLevelName : undefined;
    return {
      time:
        typeof parsed.time === "string"
          ? parsed.time
          : typeof meta?.date === "string"
            ? meta.date
            : undefined,
      level: levelRaw ? levelRaw.toLowerCase() : undefined,
      subsystem: nameMeta.subsystem,
      module: nameMeta.module,
      message: extractMessage(parsed),
      raw,
    };
  } catch {
    return null;
  }
}
