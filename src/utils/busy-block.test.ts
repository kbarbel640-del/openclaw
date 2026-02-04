import { describe, expect, it } from "vitest";
import type { CalendarEvent, BusyBlock } from "./busy-block.js";
import {
  sanitizeWorkBusyEvent,
  convertToBusyBlock,
  mergeCalendarEvents,
  getBlockStartTime,
  getBlockEndTime,
  blocksOverlap,
  findTimeGaps,
  formatBusyBlock,
  isTransparentEvent,
  expandAllDayToWorkingHours,
  filterRecurrenceMasters,
  prepareWorkBusyEvents,
} from "./busy-block.js";

describe("busy-block", () => {
  // Sample events for testing
  const workMeeting: CalendarEvent = {
    id: "work-1",
    summary: "Q1 Planning with CEO",
    description: "Confidential strategy discussion",
    location: "Boardroom 3",
    start: { dateTime: "2026-02-03T09:00:00-05:00" },
    end: { dateTime: "2026-02-03T10:00:00-05:00" },
    attendees: [
      { email: "ceo@company.com", displayName: "CEO" },
      { email: "user@company.com", displayName: "User" },
    ],
    organizer: { email: "ceo@company.com", displayName: "CEO" },
  };

  const personalEvent: CalendarEvent = {
    id: "personal-1",
    summary: "Studio session",
    description: "Work on new track",
    start: { dateTime: "2026-02-03T14:00:00-05:00" },
    end: { dateTime: "2026-02-03T16:00:00-05:00" },
  };

  const allDayEvent: CalendarEvent = {
    id: "allday-1",
    summary: "Company Holiday",
    start: { date: "2026-02-17" },
    end: { date: "2026-02-18" },
  };

  describe("sanitizeWorkBusyEvent", () => {
    it("should strip title and replace with default label", () => {
      const result = sanitizeWorkBusyEvent(workMeeting);

      expect(result.summary).toBe("Busy (work)");
      expect(result.id).toBe("work-1");
      expect(result.source).toBe("work_busy");
    });

    it("should strip description, location, and attendees", () => {
      const result = sanitizeWorkBusyEvent(workMeeting);

      // These properties should not exist on the result
      expect(result).not.toHaveProperty("description");
      expect(result).not.toHaveProperty("location");
      expect(result).not.toHaveProperty("attendees");
      expect(result).not.toHaveProperty("organizer");
    });

    it("should preserve start and end times", () => {
      const result = sanitizeWorkBusyEvent(workMeeting);

      expect(result.start.dateTime).toBe("2026-02-03T09:00:00-05:00");
      expect(result.end.dateTime).toBe("2026-02-03T10:00:00-05:00");
    });

    it("should use custom label when provided", () => {
      const result = sanitizeWorkBusyEvent(workMeeting, { label: "Work meeting" });

      expect(result.summary).toBe("Work meeting");
    });

    it("should detect all-day events", () => {
      const result = sanitizeWorkBusyEvent(allDayEvent);

      expect(result.isAllDay).toBe(true);
      expect(result.start.date).toBe("2026-02-17");
    });

    it("should not mark timed events as all-day", () => {
      const result = sanitizeWorkBusyEvent(workMeeting);

      expect(result.isAllDay).toBe(false);
    });
  });

  describe("convertToBusyBlock", () => {
    it("should preserve title for primary calendar events", () => {
      const result = convertToBusyBlock(personalEvent);

      expect(result.summary).toBe("Studio session");
      expect(result.source).toBe("primary");
    });

    it("should use default title for events without summary", () => {
      const noTitle: CalendarEvent = {
        id: "notitle-1",
        start: { dateTime: "2026-02-03T10:00:00-05:00" },
        end: { dateTime: "2026-02-03T11:00:00-05:00" },
      };

      const result = convertToBusyBlock(noTitle);
      expect(result.summary).toBe("(No title)");
    });
  });

  describe("mergeCalendarEvents", () => {
    it("should merge primary and work busy events", () => {
      const primary = [personalEvent];
      const workBusy = [workMeeting];

      const result = mergeCalendarEvents(primary, workBusy);

      expect(result).toHaveLength(2);
      expect(result[0].source).toBe("work_busy"); // 09:00 comes first
      expect(result[1].source).toBe("primary"); // 14:00 comes second
    });

    it("should sort events by start time", () => {
      const earlyEvent: CalendarEvent = {
        id: "early-1",
        summary: "Early meeting",
        start: { dateTime: "2026-02-03T08:00:00-05:00" },
        end: { dateTime: "2026-02-03T08:30:00-05:00" },
      };

      const result = mergeCalendarEvents([personalEvent, earlyEvent], [workMeeting]);

      expect(result[0].start.dateTime).toBe("2026-02-03T08:00:00-05:00"); // earlyEvent
      expect(result[1].start.dateTime).toBe("2026-02-03T09:00:00-05:00"); // workMeeting
      expect(result[2].start.dateTime).toBe("2026-02-03T14:00:00-05:00"); // personalEvent
    });

    it("should sanitize work busy events with custom label", () => {
      const result = mergeCalendarEvents([], [workMeeting], { label: "Work" });

      expect(result[0].summary).toBe("Work");
    });

    it("should handle empty arrays", () => {
      expect(mergeCalendarEvents([], [])).toEqual([]);
      expect(mergeCalendarEvents([personalEvent], [])).toHaveLength(1);
      expect(mergeCalendarEvents([], [workMeeting])).toHaveLength(1);
    });
  });

  describe("getBlockStartTime and getBlockEndTime", () => {
    it("should parse dateTime correctly", () => {
      const block = convertToBusyBlock(personalEvent);

      const start = getBlockStartTime(block);
      const end = getBlockEndTime(block);

      expect(start.toISOString()).toBe("2026-02-03T19:00:00.000Z"); // UTC
      expect(end.toISOString()).toBe("2026-02-03T21:00:00.000Z");
    });

    it("should parse date correctly for all-day events", () => {
      const block = convertToBusyBlock(allDayEvent);

      const start = getBlockStartTime(block);
      expect(start.toISOString()).toBe("2026-02-17T00:00:00.000Z");
    });

    it("should throw for blocks without time", () => {
      const badBlock: BusyBlock = {
        id: "bad",
        summary: "Bad",
        start: {},
        end: {},
        isAllDay: false,
        source: "primary",
      };

      expect(() => getBlockStartTime(badBlock)).toThrow("Block has no start time");
      expect(() => getBlockEndTime(badBlock)).toThrow("Block has no end time");
    });
  });

  describe("blocksOverlap", () => {
    it("should detect overlapping blocks", () => {
      const block1: BusyBlock = {
        id: "1",
        summary: "Block 1",
        start: { dateTime: "2026-02-03T09:00:00Z" },
        end: { dateTime: "2026-02-03T10:00:00Z" },
        isAllDay: false,
        source: "primary",
      };
      const block2: BusyBlock = {
        id: "2",
        summary: "Block 2",
        start: { dateTime: "2026-02-03T09:30:00Z" },
        end: { dateTime: "2026-02-03T10:30:00Z" },
        isAllDay: false,
        source: "work_busy",
      };

      expect(blocksOverlap(block1, block2)).toBe(true);
      expect(blocksOverlap(block2, block1)).toBe(true);
    });

    it("should not flag adjacent blocks as overlapping", () => {
      const block1: BusyBlock = {
        id: "1",
        summary: "Block 1",
        start: { dateTime: "2026-02-03T09:00:00Z" },
        end: { dateTime: "2026-02-03T10:00:00Z" },
        isAllDay: false,
        source: "primary",
      };
      const block2: BusyBlock = {
        id: "2",
        summary: "Block 2",
        start: { dateTime: "2026-02-03T10:00:00Z" },
        end: { dateTime: "2026-02-03T11:00:00Z" },
        isAllDay: false,
        source: "primary",
      };

      expect(blocksOverlap(block1, block2)).toBe(false);
    });

    it("should not flag non-overlapping blocks", () => {
      const block1: BusyBlock = {
        id: "1",
        summary: "Block 1",
        start: { dateTime: "2026-02-03T09:00:00Z" },
        end: { dateTime: "2026-02-03T10:00:00Z" },
        isAllDay: false,
        source: "primary",
      };
      const block2: BusyBlock = {
        id: "2",
        summary: "Block 2",
        start: { dateTime: "2026-02-03T14:00:00Z" },
        end: { dateTime: "2026-02-03T15:00:00Z" },
        isAllDay: false,
        source: "primary",
      };

      expect(blocksOverlap(block1, block2)).toBe(false);
    });
  });

  describe("findTimeGaps", () => {
    it("should find gaps between busy blocks", () => {
      const blocks: BusyBlock[] = [
        {
          id: "1",
          summary: "Morning",
          start: { dateTime: "2026-02-03T09:00:00Z" },
          end: { dateTime: "2026-02-03T10:00:00Z" },
          isAllDay: false,
          source: "primary",
        },
        {
          id: "2",
          summary: "Afternoon",
          start: { dateTime: "2026-02-03T14:00:00Z" },
          end: { dateTime: "2026-02-03T15:00:00Z" },
          isAllDay: false,
          source: "work_busy",
        },
      ];

      const rangeStart = new Date("2026-02-03T08:00:00Z");
      const rangeEnd = new Date("2026-02-03T17:00:00Z");

      const gaps = findTimeGaps(blocks, rangeStart, rangeEnd);

      expect(gaps).toHaveLength(3);
      // Gap before first block: 08:00-09:00
      expect(gaps[0].start.toISOString()).toBe("2026-02-03T08:00:00.000Z");
      expect(gaps[0].end.toISOString()).toBe("2026-02-03T09:00:00.000Z");
      // Gap between blocks: 10:00-14:00
      expect(gaps[1].start.toISOString()).toBe("2026-02-03T10:00:00.000Z");
      expect(gaps[1].end.toISOString()).toBe("2026-02-03T14:00:00.000Z");
      // Gap after last block: 15:00-17:00
      expect(gaps[2].start.toISOString()).toBe("2026-02-03T15:00:00.000Z");
      expect(gaps[2].end.toISOString()).toBe("2026-02-03T17:00:00.000Z");
    });

    it("should respect minimum gap duration", () => {
      const blocks: BusyBlock[] = [
        {
          id: "1",
          summary: "Block",
          start: { dateTime: "2026-02-03T09:00:00Z" },
          end: { dateTime: "2026-02-03T09:55:00Z" }, // 5 min gap after
          isAllDay: false,
          source: "primary",
        },
        {
          id: "2",
          summary: "Block",
          start: { dateTime: "2026-02-03T10:00:00Z" },
          end: { dateTime: "2026-02-03T11:00:00Z" },
          isAllDay: false,
          source: "primary",
        },
      ];

      const rangeStart = new Date("2026-02-03T09:00:00Z");
      const rangeEnd = new Date("2026-02-03T12:00:00Z");

      // With 15 min minimum, 5 min gap should be excluded
      const gaps = findTimeGaps(blocks, rangeStart, rangeEnd, 15);

      expect(gaps).toHaveLength(1);
      expect(gaps[0].start.toISOString()).toBe("2026-02-03T11:00:00.000Z");
    });

    it("should handle empty block array", () => {
      const rangeStart = new Date("2026-02-03T09:00:00Z");
      const rangeEnd = new Date("2026-02-03T17:00:00Z");

      const gaps = findTimeGaps([], rangeStart, rangeEnd);

      expect(gaps).toHaveLength(1);
      expect(gaps[0].start.toISOString()).toBe("2026-02-03T09:00:00.000Z");
      expect(gaps[0].end.toISOString()).toBe("2026-02-03T17:00:00.000Z");
    });

    it("should handle blocks outside range", () => {
      const blocks: BusyBlock[] = [
        {
          id: "1",
          summary: "Before",
          start: { dateTime: "2026-02-03T07:00:00Z" },
          end: { dateTime: "2026-02-03T08:00:00Z" },
          isAllDay: false,
          source: "primary",
        },
        {
          id: "2",
          summary: "After",
          start: { dateTime: "2026-02-03T18:00:00Z" },
          end: { dateTime: "2026-02-03T19:00:00Z" },
          isAllDay: false,
          source: "primary",
        },
      ];

      const rangeStart = new Date("2026-02-03T09:00:00Z");
      const rangeEnd = new Date("2026-02-03T17:00:00Z");

      const gaps = findTimeGaps(blocks, rangeStart, rangeEnd);

      // Should return the entire range as a gap
      expect(gaps).toHaveLength(1);
      expect(gaps[0].start.toISOString()).toBe("2026-02-03T09:00:00.000Z");
      expect(gaps[0].end.toISOString()).toBe("2026-02-03T17:00:00.000Z");
    });

    it("should handle overlapping blocks correctly", () => {
      const blocks: BusyBlock[] = [
        {
          id: "1",
          summary: "Block 1",
          start: { dateTime: "2026-02-03T09:00:00Z" },
          end: { dateTime: "2026-02-03T11:00:00Z" },
          isAllDay: false,
          source: "primary",
        },
        {
          id: "2",
          summary: "Block 2",
          start: { dateTime: "2026-02-03T10:00:00Z" },
          end: { dateTime: "2026-02-03T12:00:00Z" },
          isAllDay: false,
          source: "work_busy",
        },
      ];

      const rangeStart = new Date("2026-02-03T09:00:00Z");
      const rangeEnd = new Date("2026-02-03T14:00:00Z");

      const gaps = findTimeGaps(blocks, rangeStart, rangeEnd);

      // Should only have gap after the combined block (12:00-14:00)
      expect(gaps).toHaveLength(1);
      expect(gaps[0].start.toISOString()).toBe("2026-02-03T12:00:00.000Z");
      expect(gaps[0].end.toISOString()).toBe("2026-02-03T14:00:00.000Z");
    });
  });

  describe("formatBusyBlock", () => {
    it("should format work busy block with emoji", () => {
      const block: BusyBlock = {
        id: "1",
        summary: "Busy (work)",
        start: { dateTime: "2026-02-03T09:00:00Z" },
        end: { dateTime: "2026-02-03T10:00:00Z" },
        isAllDay: false,
        source: "work_busy",
      };

      const result = formatBusyBlock(block);

      expect(result).toContain("🔒");
      expect(result).toContain("Busy (work)");
    });

    it("should format primary event without emoji", () => {
      const block: BusyBlock = {
        id: "1",
        summary: "Studio session",
        start: { dateTime: "2026-02-03T14:00:00Z" },
        end: { dateTime: "2026-02-03T16:00:00Z" },
        isAllDay: false,
        source: "primary",
      };

      const result = formatBusyBlock(block);

      expect(result).not.toContain("🔒");
      expect(result).toContain("Studio session");
    });

    it("should use custom emoji when provided", () => {
      const block: BusyBlock = {
        id: "1",
        summary: "Busy",
        start: { dateTime: "2026-02-03T09:00:00Z" },
        end: { dateTime: "2026-02-03T10:00:00Z" },
        isAllDay: false,
        source: "work_busy",
      };

      const result = formatBusyBlock(block, { emoji: "🏢" });

      expect(result).toContain("🏢");
    });

    it("should format all-day events correctly", () => {
      const block: BusyBlock = {
        id: "1",
        summary: "Holiday",
        start: { date: "2026-02-17" },
        end: { date: "2026-02-18" },
        isAllDay: true,
        source: "primary",
      };

      const result = formatBusyBlock(block);

      expect(result).toContain("(all day)");
      expect(result).toContain("Holiday");
    });
  });

  describe("isTransparentEvent", () => {
    it("should return true for transparent events", () => {
      const event: CalendarEvent = {
        id: "1",
        summary: "Free time",
        start: { dateTime: "2026-02-03T09:00:00Z" },
        end: { dateTime: "2026-02-03T10:00:00Z" },
        transparency: "transparent",
      };

      expect(isTransparentEvent(event)).toBe(true);
    });

    it("should return false for opaque events", () => {
      const event: CalendarEvent = {
        id: "1",
        summary: "Meeting",
        start: { dateTime: "2026-02-03T09:00:00Z" },
        end: { dateTime: "2026-02-03T10:00:00Z" },
        transparency: "opaque",
      };

      expect(isTransparentEvent(event)).toBe(false);
    });

    it("should return false when transparency is not set", () => {
      const event: CalendarEvent = {
        id: "1",
        summary: "Meeting",
        start: { dateTime: "2026-02-03T09:00:00Z" },
        end: { dateTime: "2026-02-03T10:00:00Z" },
      };

      expect(isTransparentEvent(event)).toBe(false);
    });
  });

  describe("sanitizeWorkBusyEvent - conference links", () => {
    it("should strip conferenceData from work events", () => {
      const eventWithConference: CalendarEvent = {
        id: "conf-1",
        summary: "Team Standup",
        start: { dateTime: "2026-02-03T09:00:00Z" },
        end: { dateTime: "2026-02-03T09:30:00Z" },
        conferenceData: {
          entryPoints: [{ uri: "https://meet.google.com/abc-defg-hij", label: "Meet" }],
          conferenceSolution: { name: "Google Meet" },
        },
        hangoutLink: "https://meet.google.com/abc-defg-hij",
      };

      const result = sanitizeWorkBusyEvent(eventWithConference);

      // Conference data should not be present in the result
      expect(result).not.toHaveProperty("conferenceData");
      expect(result).not.toHaveProperty("hangoutLink");
      expect(result.summary).toBe("Busy (work)");
    });

    it("should strip htmlLink from work events", () => {
      const eventWithLink: CalendarEvent = {
        id: "link-1",
        summary: "Secret Meeting",
        start: { dateTime: "2026-02-03T09:00:00Z" },
        end: { dateTime: "2026-02-03T10:00:00Z" },
        htmlLink: "https://calendar.google.com/calendar/event?eid=abc123",
      };

      const result = sanitizeWorkBusyEvent(eventWithLink);

      expect(result).not.toHaveProperty("htmlLink");
    });
  });

  describe("expandAllDayToWorkingHours", () => {
    it("should expand all-day event to working hours", () => {
      const allDayBlock: BusyBlock = {
        id: "1",
        summary: "Busy (work)",
        start: { date: "2026-02-03" },
        end: { date: "2026-02-04" },
        isAllDay: true,
        source: "work_busy",
      };

      const result = expandAllDayToWorkingHours(allDayBlock, 9, 18);

      expect(result.isAllDay).toBe(false);
      expect(result.start.dateTime).toBe("2026-02-03T09:00:00");
      expect(result.end.dateTime).toBe("2026-02-03T18:00:00");
    });

    it("should use custom working hours", () => {
      const allDayBlock: BusyBlock = {
        id: "1",
        summary: "Busy (work)",
        start: { date: "2026-02-03" },
        end: { date: "2026-02-04" },
        isAllDay: true,
        source: "work_busy",
      };

      const result = expandAllDayToWorkingHours(allDayBlock, 8, 17);

      expect(result.start.dateTime).toBe("2026-02-03T08:00:00");
      expect(result.end.dateTime).toBe("2026-02-03T17:00:00");
    });

    it("should not modify non-all-day events", () => {
      const timedBlock: BusyBlock = {
        id: "1",
        summary: "Meeting",
        start: { dateTime: "2026-02-03T14:00:00Z" },
        end: { dateTime: "2026-02-03T15:00:00Z" },
        isAllDay: false,
        source: "primary",
      };

      const result = expandAllDayToWorkingHours(timedBlock);

      expect(result).toEqual(timedBlock);
    });

    it("should preserve timezone in expanded event", () => {
      const allDayBlock: BusyBlock = {
        id: "1",
        summary: "Busy (work)",
        start: { date: "2026-02-03", timeZone: "America/New_York" },
        end: { date: "2026-02-04", timeZone: "America/New_York" },
        isAllDay: true,
        source: "work_busy",
      };

      const result = expandAllDayToWorkingHours(allDayBlock);

      expect(result.start.timeZone).toBe("America/New_York");
      expect(result.end.timeZone).toBe("America/New_York");
    });
  });

  describe("filterRecurrenceMasters", () => {
    it("should filter out events with recurrence rules", () => {
      const events: CalendarEvent[] = [
        {
          id: "master-1",
          summary: "Weekly standup",
          start: { dateTime: "2026-02-03T09:00:00Z" },
          end: { dateTime: "2026-02-03T09:30:00Z" },
          recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
        },
        {
          id: "instance-1",
          summary: "Weekly standup",
          start: { dateTime: "2026-02-10T09:00:00Z" },
          end: { dateTime: "2026-02-10T09:30:00Z" },
          recurringEventId: "master-1",
        },
        {
          id: "single-1",
          summary: "One-time meeting",
          start: { dateTime: "2026-02-03T14:00:00Z" },
          end: { dateTime: "2026-02-03T15:00:00Z" },
        },
      ];

      const result = filterRecurrenceMasters(events);

      expect(result).toHaveLength(2);
      expect(result.find((e) => e.id === "master-1")).toBeUndefined();
      expect(result.find((e) => e.id === "instance-1")).toBeDefined();
      expect(result.find((e) => e.id === "single-1")).toBeDefined();
    });

    it("should keep events with empty recurrence array", () => {
      const events: CalendarEvent[] = [
        {
          id: "1",
          summary: "Event",
          start: { dateTime: "2026-02-03T09:00:00Z" },
          end: { dateTime: "2026-02-03T10:00:00Z" },
          recurrence: [],
        },
      ];

      const result = filterRecurrenceMasters(events);

      expect(result).toHaveLength(1);
    });
  });

  describe("prepareWorkBusyEvents", () => {
    it("should sanitize and filter events", () => {
      const events: CalendarEvent[] = [
        {
          id: "1",
          summary: "Secret Meeting",
          description: "Confidential",
          start: { dateTime: "2026-02-03T09:00:00Z" },
          end: { dateTime: "2026-02-03T10:00:00Z" },
        },
      ];

      const result = prepareWorkBusyEvents(events);

      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe("Busy (work)");
      expect(result[0].source).toBe("work_busy");
    });

    it("should expand all-day events by default", () => {
      const events: CalendarEvent[] = [
        {
          id: "1",
          summary: "PTO",
          start: { date: "2026-02-03" },
          end: { date: "2026-02-04" },
        },
      ];

      const result = prepareWorkBusyEvents(events);

      expect(result[0].isAllDay).toBe(false);
      expect(result[0].start.dateTime).toBe("2026-02-03T09:00:00");
    });

    it("should skip all-day expansion when disabled", () => {
      const events: CalendarEvent[] = [
        {
          id: "1",
          summary: "PTO",
          start: { date: "2026-02-03" },
          end: { date: "2026-02-04" },
        },
      ];

      const result = prepareWorkBusyEvents(events, {}, false);

      expect(result[0].isAllDay).toBe(true);
      expect(result[0].start.date).toBe("2026-02-03");
    });

    it("should use custom working hours for all-day expansion", () => {
      const events: CalendarEvent[] = [
        {
          id: "1",
          summary: "PTO",
          start: { date: "2026-02-03" },
          end: { date: "2026-02-04" },
        },
      ];

      const result = prepareWorkBusyEvents(events, {}, true, { start: 8, end: 20 });

      expect(result[0].start.dateTime).toBe("2026-02-03T08:00:00");
      expect(result[0].end.dateTime).toBe("2026-02-03T20:00:00");
    });

    it("should filter out recurrence masters", () => {
      const events: CalendarEvent[] = [
        {
          id: "master",
          summary: "Weekly",
          start: { dateTime: "2026-02-03T09:00:00Z" },
          end: { dateTime: "2026-02-03T10:00:00Z" },
          recurrence: ["RRULE:FREQ=WEEKLY"],
        },
        {
          id: "instance",
          summary: "Weekly",
          start: { dateTime: "2026-02-10T09:00:00Z" },
          end: { dateTime: "2026-02-10T10:00:00Z" },
          recurringEventId: "master",
        },
      ];

      const result = prepareWorkBusyEvents(events);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("instance");
    });

    it("should use custom label", () => {
      const events: CalendarEvent[] = [
        {
          id: "1",
          summary: "Meeting",
          start: { dateTime: "2026-02-03T09:00:00Z" },
          end: { dateTime: "2026-02-03T10:00:00Z" },
        },
      ];

      const result = prepareWorkBusyEvents(events, { label: "Work" });

      expect(result[0].summary).toBe("Work");
    });
  });

  describe("findTimeGaps with all-day events", () => {
    it("should treat expanded all-day events as busy blocks", () => {
      const blocks: BusyBlock[] = [
        {
          id: "1",
          summary: "Busy (work)",
          start: { dateTime: "2026-02-03T09:00:00Z" },
          end: { dateTime: "2026-02-03T18:00:00Z" },
          isAllDay: false, // After expansion
          source: "work_busy",
        },
      ];

      const rangeStart = new Date("2026-02-03T08:00:00Z");
      const rangeEnd = new Date("2026-02-03T20:00:00Z");

      const gaps = findTimeGaps(blocks, rangeStart, rangeEnd);

      expect(gaps).toHaveLength(2);
      // Gap before: 08:00-09:00
      expect(gaps[0].start.toISOString()).toBe("2026-02-03T08:00:00.000Z");
      expect(gaps[0].end.toISOString()).toBe("2026-02-03T09:00:00.000Z");
      // Gap after: 18:00-20:00
      expect(gaps[1].start.toISOString()).toBe("2026-02-03T18:00:00.000Z");
      expect(gaps[1].end.toISOString()).toBe("2026-02-03T20:00:00.000Z");
    });
  });

  // ==========================================================================
  // Trust Tests - Edge cases that commonly bite calendar systems
  // ==========================================================================

  describe("trust tests", () => {
    describe("DST boundary handling", () => {
      it("should expand all-day event on DST spring-forward weekend correctly", () => {
        // US DST 2026: Spring forward on March 8 (2:00 AM → 3:00 AM)
        // All-day event on the transition day
        const dstAllDay: BusyBlock = {
          id: "dst-1",
          summary: "Busy (work)",
          start: { date: "2026-03-08", timeZone: "America/New_York" },
          end: { date: "2026-03-09", timeZone: "America/New_York" },
          isAllDay: true,
          source: "work_busy",
        };

        const result = expandAllDayToWorkingHours(dstAllDay, 9, 18);

        // Working hours should still be 09:00 and 18:00 on the local date
        expect(result.isAllDay).toBe(false);
        expect(result.start.dateTime).toBe("2026-03-08T09:00:00");
        expect(result.end.dateTime).toBe("2026-03-08T18:00:00");
        expect(result.start.timeZone).toBe("America/New_York");
        expect(result.end.timeZone).toBe("America/New_York");
      });

      it("should expand all-day event on DST fall-back weekend correctly", () => {
        // US DST 2026: Fall back on November 1 (2:00 AM → 1:00 AM)
        const dstAllDay: BusyBlock = {
          id: "dst-2",
          summary: "Busy (work)",
          start: { date: "2026-11-01", timeZone: "America/New_York" },
          end: { date: "2026-11-02", timeZone: "America/New_York" },
          isAllDay: true,
          source: "work_busy",
        };

        const result = expandAllDayToWorkingHours(dstAllDay, 9, 18);

        expect(result.isAllDay).toBe(false);
        expect(result.start.dateTime).toBe("2026-11-01T09:00:00");
        expect(result.end.dateTime).toBe("2026-11-01T18:00:00");
        expect(result.start.timeZone).toBe("America/New_York");
      });
    });

    describe("multi-day all-day events", () => {
      it("should handle 3-day all-day event without phantom gaps", () => {
        // A 3-day conference: Feb 10-12 (end date Feb 13 is exclusive)
        // Currently expandAllDayToWorkingHours only covers the first day
        // This test documents current behavior and what we expect
        const multiDayEvent: CalendarEvent = {
          id: "multi-1",
          summary: "Conference",
          start: { date: "2026-02-10" },
          end: { date: "2026-02-13" }, // Exclusive - actually Feb 10, 11, 12
        };

        const blocks = prepareWorkBusyEvents([multiDayEvent]);

        // Current behavior: single-day expansion uses start date only
        // This is a known limitation - the block only covers Feb 10
        expect(blocks).toHaveLength(1);
        expect(blocks[0].start.dateTime).toBe("2026-02-10T09:00:00");
        expect(blocks[0].end.dateTime).toBe("2026-02-10T18:00:00");

        // Gap finding on Feb 11 should show the day as free (current behavior)
        // TODO: If multi-day expansion is implemented, this test should verify
        // that working hours on Feb 11 and Feb 12 are also blocked
        const feb11Start = new Date("2026-02-11T09:00:00Z");
        const feb11End = new Date("2026-02-11T18:00:00Z");

        const gaps = findTimeGaps(blocks, feb11Start, feb11End);

        // Currently returns full day as gap (single-day expansion limitation)
        expect(gaps).toHaveLength(1);
        expect(gaps[0].start.toISOString()).toBe("2026-02-11T09:00:00.000Z");
        expect(gaps[0].end.toISOString()).toBe("2026-02-11T18:00:00.000Z");
      });

      it("should block working hours on each day of a multi-day event when properly expanded", () => {
        // Manually create blocks for a 3-day event (simulating correct expansion)
        const multiDayBlocks: BusyBlock[] = [
          {
            id: "multi-day-1",
            summary: "Busy (work)",
            start: { dateTime: "2026-02-10T09:00:00Z" },
            end: { dateTime: "2026-02-10T18:00:00Z" },
            isAllDay: false,
            source: "work_busy",
          },
          {
            id: "multi-day-2",
            summary: "Busy (work)",
            start: { dateTime: "2026-02-11T09:00:00Z" },
            end: { dateTime: "2026-02-11T18:00:00Z" },
            isAllDay: false,
            source: "work_busy",
          },
          {
            id: "multi-day-3",
            summary: "Busy (work)",
            start: { dateTime: "2026-02-12T09:00:00Z" },
            end: { dateTime: "2026-02-12T18:00:00Z" },
            isAllDay: false,
            source: "work_busy",
          },
        ];

        // Check each day for gaps during working hours
        for (const [i, date] of ["10", "11", "12"].entries()) {
          const dayStart = new Date(`2026-02-${date}T09:00:00Z`);
          const dayEnd = new Date(`2026-02-${date}T18:00:00Z`);

          const gaps = findTimeGaps(multiDayBlocks, dayStart, dayEnd);

          // No gaps during working hours (block covers entire range)
          expect(gaps).toHaveLength(0);
        }
      });
    });

    describe("overlap and merge determinism", () => {
      it("should produce deterministic output when personal event overlaps work busy", () => {
        const personalMeeting: CalendarEvent = {
          id: "personal-overlap",
          summary: "Dentist",
          start: { dateTime: "2026-02-03T10:00:00Z" },
          end: { dateTime: "2026-02-03T11:30:00Z" },
        };

        const workBusy: CalendarEvent = {
          id: "work-overlap",
          summary: "Team Meeting",
          start: { dateTime: "2026-02-03T10:30:00Z" },
          end: { dateTime: "2026-02-03T12:00:00Z" },
        };

        // Run merge multiple times to verify determinism
        const results: BusyBlock[][] = [];
        for (let i = 0; i < 5; i++) {
          results.push(mergeCalendarEvents([personalMeeting], [workBusy]));
        }

        // All results should be identical (stable sort)
        for (let i = 1; i < results.length; i++) {
          expect(results[i]).toEqual(results[0]);
        }

        // Verify expected order: personal (10:00) before work (10:30)
        const merged = results[0];
        expect(merged).toHaveLength(2);
        expect(merged[0].source).toBe("primary");
        expect(merged[0].start.dateTime).toBe("2026-02-03T10:00:00Z");
        expect(merged[1].source).toBe("work_busy");
        expect(merged[1].start.dateTime).toBe("2026-02-03T10:30:00Z");
      });

      it("should exclude full overlapped range when finding gaps", () => {
        // Personal: 10:00-11:30, Work: 10:30-12:00
        // Combined busy period should be 10:00-12:00 (union of overlaps)
        const overlappingBlocks: BusyBlock[] = [
          {
            id: "1",
            summary: "Dentist",
            start: { dateTime: "2026-02-03T10:00:00Z" },
            end: { dateTime: "2026-02-03T11:30:00Z" },
            isAllDay: false,
            source: "primary",
          },
          {
            id: "2",
            summary: "Busy (work)",
            start: { dateTime: "2026-02-03T10:30:00Z" },
            end: { dateTime: "2026-02-03T12:00:00Z" },
            isAllDay: false,
            source: "work_busy",
          },
        ];

        const rangeStart = new Date("2026-02-03T09:00:00Z");
        const rangeEnd = new Date("2026-02-03T14:00:00Z");

        const gaps = findTimeGaps(overlappingBlocks, rangeStart, rangeEnd);

        // Should have exactly 2 gaps: before (09:00-10:00) and after (12:00-14:00)
        expect(gaps).toHaveLength(2);

        // Gap before overlapped range
        expect(gaps[0].start.toISOString()).toBe("2026-02-03T09:00:00.000Z");
        expect(gaps[0].end.toISOString()).toBe("2026-02-03T10:00:00.000Z");

        // Gap after overlapped range (should start at 12:00, not 11:30)
        expect(gaps[1].start.toISOString()).toBe("2026-02-03T12:00:00.000Z");
        expect(gaps[1].end.toISOString()).toBe("2026-02-03T14:00:00.000Z");
      });

      it("should not produce duplicate blocks when same event appears in both sources", () => {
        // Edge case: what if someone accidentally adds same event to both calendars?
        const event: CalendarEvent = {
          id: "shared-event",
          summary: "Shared Meeting",
          start: { dateTime: "2026-02-03T14:00:00Z" },
          end: { dateTime: "2026-02-03T15:00:00Z" },
        };

        const merged = mergeCalendarEvents([event], [event]);

        // Currently produces 2 blocks (one primary, one work_busy)
        // This is expected behavior - dedup would need ID matching
        expect(merged).toHaveLength(2);
        expect(merged[0].source).toBe("primary");
        expect(merged[1].source).toBe("work_busy");

        // Gap finding should still work correctly (treats as single 1-hour block)
        const rangeStart = new Date("2026-02-03T13:00:00Z");
        const rangeEnd = new Date("2026-02-03T16:00:00Z");
        const gaps = findTimeGaps(merged, rangeStart, rangeEnd);

        expect(gaps).toHaveLength(2);
        expect(gaps[0].start.toISOString()).toBe("2026-02-03T13:00:00.000Z");
        expect(gaps[0].end.toISOString()).toBe("2026-02-03T14:00:00.000Z");
        expect(gaps[1].start.toISOString()).toBe("2026-02-03T15:00:00.000Z");
        expect(gaps[1].end.toISOString()).toBe("2026-02-03T16:00:00.000Z");
      });
    });
  });
});
