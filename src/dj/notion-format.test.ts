import { describe, expect, it } from "vitest";
import {
  buildParagraphBlock,
  buildTaskPagePayload,
  buildTasksDueDateFilter,
  formatNotionCheckbox,
  formatNotionDate,
  formatNotionMultiSelect,
  formatNotionNumber,
  formatNotionRichText,
  formatNotionSelect,
  formatNotionTitle,
  formatNotionUrl,
} from "./notion-format.js";

describe("formatNotionTitle", () => {
  it("formats string as title property", () => {
    const result = formatNotionTitle("My Task");
    expect(result).toEqual({
      title: [{ type: "text", text: { content: "My Task" } }],
    });
  });

  it("handles empty string", () => {
    const result = formatNotionTitle("");
    expect(result.title[0]?.text.content).toBe("");
  });
});

describe("formatNotionRichText", () => {
  it("formats string as rich_text property", () => {
    const result = formatNotionRichText("Some notes");
    expect(result).toEqual({
      rich_text: [{ type: "text", text: { content: "Some notes" } }],
    });
  });
});

describe("formatNotionSelect", () => {
  it("formats string as select property", () => {
    const result = formatNotionSelect("High");
    expect(result).toEqual({
      select: { name: "High" },
    });
  });
});

describe("formatNotionMultiSelect", () => {
  it("formats array as multi_select property", () => {
    const result = formatNotionMultiSelect(["Tag1", "Tag2"]);
    expect(result).toEqual({
      multi_select: [{ name: "Tag1" }, { name: "Tag2" }],
    });
  });

  it("handles empty array", () => {
    const result = formatNotionMultiSelect([]);
    expect(result.multi_select).toEqual([]);
  });
});

describe("formatNotionDate", () => {
  it("formats date with start only", () => {
    const result = formatNotionDate("2026-02-03");
    expect(result).toEqual({
      date: { start: "2026-02-03" },
    });
  });

  it("formats date with start and end", () => {
    const result = formatNotionDate("2026-02-03", "2026-02-05");
    expect(result).toEqual({
      date: { start: "2026-02-03", end: "2026-02-05" },
    });
  });
});

describe("formatNotionCheckbox", () => {
  it("formats true value", () => {
    const result = formatNotionCheckbox(true);
    expect(result).toEqual({ checkbox: true });
  });

  it("formats false value", () => {
    const result = formatNotionCheckbox(false);
    expect(result).toEqual({ checkbox: false });
  });
});

describe("formatNotionNumber", () => {
  it("formats number value", () => {
    const result = formatNotionNumber(42);
    expect(result).toEqual({ number: 42 });
  });

  it("formats null value", () => {
    const result = formatNotionNumber(null);
    expect(result).toEqual({ number: null });
  });
});

describe("formatNotionUrl", () => {
  it("formats URL string", () => {
    const result = formatNotionUrl("https://example.com");
    expect(result).toEqual({ url: "https://example.com" });
  });

  it("formats null value", () => {
    const result = formatNotionUrl(null);
    expect(result).toEqual({ url: null });
  });
});

describe("buildTaskPagePayload", () => {
  it("builds minimal task payload", () => {
    const result = buildTaskPagePayload({
      databaseId: "db123",
      name: "My Task",
    });

    expect(result.parent).toEqual({ database_id: "db123" });
    expect((result.properties as Record<string, unknown>).Name).toEqual({
      title: [{ type: "text", text: { content: "My Task" } }],
    });
  });

  it("builds full task payload with all properties", () => {
    const result = buildTaskPagePayload({
      databaseId: "db123",
      name: "Complete Task",
      status: "Inbox",
      priority: "🔴 High",
      due: "2026-02-03",
      source: "Voice Capture",
      estimate: 60,
      notes: "Additional context here",
    });

    const properties = result.properties as Record<string, unknown>;
    expect(properties.Status).toEqual({ select: { name: "Inbox" } });
    expect(properties.Priority).toEqual({ select: { name: "🔴 High" } });
    expect(properties.Due).toEqual({ date: { start: "2026-02-03" } });
    expect(properties.Source).toEqual({ select: { name: "Voice Capture" } });
    expect(properties.Estimate).toEqual({ number: 60 });
    expect(properties.Notes).toEqual({
      rich_text: [{ type: "text", text: { content: "Additional context here" } }],
    });
  });
});

describe("buildParagraphBlock", () => {
  it("builds paragraph block structure", () => {
    const result = buildParagraphBlock("Hello world");
    expect(result).toEqual({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: "Hello world" } }],
      },
    });
  });
});

describe("buildTasksDueDateFilter", () => {
  it("builds filter with date range", () => {
    const result = buildTasksDueDateFilter({
      startDate: "2026-02-01",
      endDate: "2026-02-07",
    });

    expect(result.filter).toEqual({
      and: [
        { property: "Due", date: { on_or_after: "2026-02-01" } },
        { property: "Due", date: { on_or_before: "2026-02-07" } },
        { property: "Status", select: { does_not_equal: "Done" } },
      ],
    });
    expect(result.sorts).toEqual([{ property: "Due", direction: "ascending" }]);
  });

  it("excludes Done filter when excludeDone is false", () => {
    const result = buildTasksDueDateFilter({
      startDate: "2026-02-01",
      endDate: "2026-02-07",
      excludeDone: false,
    });

    const filter = result.filter as { and: unknown[] };
    expect(filter.and).toHaveLength(2);
    expect(filter.and).not.toContainEqual({
      property: "Status",
      select: { does_not_equal: "Done" },
    });
  });
});
