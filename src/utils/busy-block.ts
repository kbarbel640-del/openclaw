/**
 * Busy Block Utilities
 *
 * Functions for handling Work Busy calendar events with privacy stripping.
 * Used by DJ skills (agenda, findslot, timeblock) to merge work calendar
 * events without exposing sensitive meeting details.
 */

/**
 * A calendar event from gog CLI or Google Calendar API.
 */
export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{ email: string; displayName?: string }>;
  organizer?: { email: string; displayName?: string };
  htmlLink?: string;
  status?: string;
  /** Event transparency: "opaque" (busy) or "transparent" (free) */
  transparency?: "opaque" | "transparent";
  /** Google Meet / Hangout conference data */
  conferenceData?: {
    entryPoints?: Array<{ uri?: string; label?: string }>;
    conferenceSolution?: { name?: string };
  };
  /** Direct hangout link (legacy) */
  hangoutLink?: string;
  /** Recurrence rule (if this is a recurring event master) */
  recurrence?: string[];
  /** Original start time for recurring event instances */
  recurringEventId?: string;
}

/**
 * A sanitized busy block with identifying information removed.
 */
export interface BusyBlock {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  isAllDay: boolean;
  source: "primary" | "work_busy";
}

/**
 * Options for busy block sanitization.
 */
export interface BusyBlockOptions {
  label?: string;
  emoji?: string;
}

const DEFAULT_BUSY_LABEL = "Busy (work)";
const DEFAULT_BUSY_EMOJI = "🔒";

/**
 * Check if an event is marked as "free" (transparent).
 * Work Busy events should still be treated as busy regardless of transparency.
 */
export function isTransparentEvent(event: CalendarEvent): boolean {
  return event.transparency === "transparent";
}

/**
 * Sanitize a Work Busy calendar event by stripping identifying information.
 *
 * Strips:
 * - summary/title → replaced with configured label
 * - description → removed
 * - location → removed
 * - attendees → removed
 * - organizer → removed
 * - conferenceData (Meet/Hangout links) → removed
 * - hangoutLink → removed
 * - htmlLink → removed
 *
 * Preserves:
 * - start time, end time, all-day flag
 * - timeZone (for correct local time display)
 *
 * Note: Events marked "transparent" (free) in Outlook are still treated as busy
 * for conservative scheduling. If you need to respect free/busy status, filter
 * before calling this function.
 */
export function sanitizeWorkBusyEvent(
  event: CalendarEvent,
  options: BusyBlockOptions = {},
): BusyBlock {
  const label = options.label ?? DEFAULT_BUSY_LABEL;
  const isAllDay = !event.start.dateTime && !!event.start.date;

  return {
    id: event.id,
    summary: label,
    start: {
      dateTime: event.start.dateTime,
      date: event.start.date,
      timeZone: event.start.timeZone,
    },
    end: {
      dateTime: event.end.dateTime,
      date: event.end.date,
      timeZone: event.end.timeZone,
    },
    isAllDay,
    source: "work_busy",
  };
}

/**
 * Convert a primary calendar event to a BusyBlock (preserving title).
 */
export function convertToBusyBlock(event: CalendarEvent): BusyBlock {
  const isAllDay = !event.start.dateTime && !!event.start.date;

  return {
    id: event.id,
    summary: event.summary ?? "(No title)",
    start: {
      dateTime: event.start.dateTime,
      date: event.start.date,
      timeZone: event.start.timeZone,
    },
    end: {
      dateTime: event.end.dateTime,
      date: event.end.date,
      timeZone: event.end.timeZone,
    },
    isAllDay,
    source: "primary",
  };
}

/**
 * Merge primary calendar events with sanitized Work Busy events.
 *
 * @param primaryEvents - Events from the user's primary calendar
 * @param workBusyEvents - Events from the Work Busy (ICS) calendar
 * @param options - Sanitization options (label, emoji)
 * @returns Combined array of BusyBlocks sorted by start time
 */
export function mergeCalendarEvents(
  primaryEvents: CalendarEvent[],
  workBusyEvents: CalendarEvent[],
  options: BusyBlockOptions = {},
): BusyBlock[] {
  const primaryBlocks = primaryEvents.map((e) => convertToBusyBlock(e));
  const workBlocks = workBusyEvents.map((e) => sanitizeWorkBusyEvent(e, options));

  const merged = [...primaryBlocks, ...workBlocks];

  // Sort by start time
  return merged.toSorted((a, b) => {
    const aTime = a.start.dateTime ?? a.start.date ?? "";
    const bTime = b.start.dateTime ?? b.start.date ?? "";
    return aTime.localeCompare(bTime);
  });
}

/**
 * Get the start time of a BusyBlock as a Date object.
 */
export function getBlockStartTime(block: BusyBlock): Date {
  const timeStr = block.start.dateTime ?? block.start.date;
  if (!timeStr) {
    throw new Error("Block has no start time");
  }
  return new Date(timeStr);
}

/**
 * Get the end time of a BusyBlock as a Date object.
 */
export function getBlockEndTime(block: BusyBlock): Date {
  const timeStr = block.end.dateTime ?? block.end.date;
  if (!timeStr) {
    throw new Error("Block has no end time");
  }
  return new Date(timeStr);
}

/**
 * Check if two time blocks overlap.
 */
export function blocksOverlap(a: BusyBlock, b: BusyBlock): boolean {
  const aStart = getBlockStartTime(a);
  const aEnd = getBlockEndTime(a);
  const bStart = getBlockStartTime(b);
  const bEnd = getBlockEndTime(b);

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Find time gaps between busy blocks within a date range.
 *
 * @param blocks - Array of BusyBlocks
 * @param rangeStart - Start of search range
 * @param rangeEnd - End of search range
 * @param minGapMinutes - Minimum gap duration to include (default: 15)
 * @returns Array of {start, end} representing free time slots
 */
export function findTimeGaps(
  blocks: BusyBlock[],
  rangeStart: Date,
  rangeEnd: Date,
  minGapMinutes: number = 15,
): Array<{ start: Date; end: Date }> {
  const gaps: Array<{ start: Date; end: Date }> = [];

  // Sort blocks by start time
  const sorted = blocks.toSorted((a, b) => {
    return getBlockStartTime(a).getTime() - getBlockStartTime(b).getTime();
  });

  let currentEnd = rangeStart;

  for (const block of sorted) {
    const blockStart = getBlockStartTime(block);
    const blockEnd = getBlockEndTime(block);

    // Skip blocks outside our range
    if (blockEnd <= rangeStart || blockStart >= rangeEnd) {
      continue;
    }

    // Clamp block to range
    const effectiveStart = blockStart < rangeStart ? rangeStart : blockStart;
    const effectiveEnd = blockEnd > rangeEnd ? rangeEnd : blockEnd;

    // Check for gap before this block
    if (effectiveStart > currentEnd) {
      const gapDuration = (effectiveStart.getTime() - currentEnd.getTime()) / 60000;
      if (gapDuration >= minGapMinutes) {
        gaps.push({ start: new Date(currentEnd), end: new Date(effectiveStart) });
      }
    }

    // Move current end forward
    if (effectiveEnd > currentEnd) {
      currentEnd = effectiveEnd;
    }
  }

  // Check for gap after last block
  if (currentEnd < rangeEnd) {
    const gapDuration = (rangeEnd.getTime() - currentEnd.getTime()) / 60000;
    if (gapDuration >= minGapMinutes) {
      gaps.push({ start: new Date(currentEnd), end: new Date(rangeEnd) });
    }
  }

  return gaps;
}

/**
 * Format a BusyBlock for display with optional emoji prefix.
 */
export function formatBusyBlock(block: BusyBlock, options: BusyBlockOptions = {}): string {
  const emoji = block.source === "work_busy" ? (options.emoji ?? DEFAULT_BUSY_EMOJI) : "";
  const prefix = emoji ? `${emoji} ` : "";

  if (block.isAllDay) {
    return `${prefix}${block.summary} (all day)`;
  }

  const start = block.start.dateTime ? new Date(block.start.dateTime) : null;
  const end = block.end.dateTime ? new Date(block.end.dateTime) : null;

  if (start && end) {
    const startTime = start.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const endTime = end.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${prefix}${startTime}-${endTime} — ${block.summary}`;
  }

  return `${prefix}${block.summary}`;
}

/**
 * Expand an all-day event to cover working hours in a given timezone.
 *
 * All-day events use date strings (YYYY-MM-DD) which are timezone-ambiguous.
 * This function converts them to explicit start/end times based on working hours.
 *
 * @param block - BusyBlock with isAllDay=true
 * @param workingHoursStart - Start hour (0-23), default 9
 * @param workingHoursEnd - End hour (0-23), default 18
 * @returns BusyBlock with dateTime set to working hours
 */
export function expandAllDayToWorkingHours(
  block: BusyBlock,
  workingHoursStart: number = 9,
  workingHoursEnd: number = 18,
): BusyBlock {
  if (!block.isAllDay || !block.start.date) {
    return block;
  }

  // Parse date string (YYYY-MM-DD) and create datetime strings
  const startDate = block.start.date;

  // Format: use local interpretation of the date
  const startHour = workingHoursStart.toString().padStart(2, "0");
  const endHour = workingHoursEnd.toString().padStart(2, "0");

  // For multi-day all-day events, the end date is exclusive (next day)
  // So "2026-02-03" to "2026-02-04" means all of Feb 3
  // We use the start date for both start and end times (single day expansion)

  return {
    ...block,
    start: {
      dateTime: `${startDate}T${startHour}:00:00`,
      timeZone: block.start.timeZone,
    },
    end: {
      dateTime: `${startDate}T${endHour}:00:00`,
      timeZone: block.end.timeZone,
    },
    isAllDay: false, // No longer treated as all-day for gap calculation
  };
}

/**
 * Filter out events that are recurring event masters (have recurrence rules).
 *
 * gog returns expanded instances for recurring events. If you see both the
 * master event (with recurrence[]) and individual instances, filter masters
 * to avoid double-counting.
 *
 * @param events - Array of calendar events
 * @returns Events without recurrence masters (only expanded instances)
 */
export function filterRecurrenceMasters(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((event) => {
    // Keep events that don't have recurrence rules (they're either
    // non-recurring or expanded instances of recurring events)
    return !event.recurrence || event.recurrence.length === 0;
  });
}

/**
 * Prepare Work Busy events for gap calculation.
 *
 * This function:
 * 1. Filters out recurrence masters (keeps expanded instances)
 * 2. Treats transparent events as busy (conservative approach)
 * 3. Sanitizes events to strip identifying information
 * 4. Optionally expands all-day events to working hours
 *
 * @param events - Raw events from Work Busy calendar
 * @param options - Sanitization options
 * @param expandAllDay - Whether to expand all-day events (default: true)
 * @param workingHours - Working hours for all-day expansion
 */
export function prepareWorkBusyEvents(
  events: CalendarEvent[],
  options: BusyBlockOptions = {},
  expandAllDay: boolean = true,
  workingHours: { start: number; end: number } = { start: 9, end: 18 },
): BusyBlock[] {
  // Filter out recurrence masters
  const filtered = filterRecurrenceMasters(events);

  // Sanitize and convert to BusyBlocks
  let blocks = filtered.map((e) => sanitizeWorkBusyEvent(e, options));

  // Optionally expand all-day events
  if (expandAllDay) {
    blocks = blocks.map((block) =>
      block.isAllDay
        ? expandAllDayToWorkingHours(block, workingHours.start, workingHours.end)
        : block,
    );
  }

  return blocks;
}
