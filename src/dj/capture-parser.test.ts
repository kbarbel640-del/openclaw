import { describe, expect, it } from "vitest";
import { extractDateReference, parseCaptureInput } from "./capture-parser.js";

describe("parseCaptureInput", () => {
  it("defaults to task type for plain text", () => {
    const result = parseCaptureInput("Buy new headphones");
    expect(result.type).toBe("task");
    expect(result.content).toBe("Buy new headphones");
  });

  it("parses task: prefix", () => {
    const result = parseCaptureInput("task: Review contract");
    expect(result.type).toBe("task");
    expect(result.content).toBe("Review contract");
  });

  it("parses todo: prefix as task", () => {
    const result = parseCaptureInput("todo: Send invoice");
    expect(result.type).toBe("task");
    expect(result.content).toBe("Send invoice");
  });

  it("parses note: prefix", () => {
    const result = parseCaptureInput("note: Interesting production technique");
    expect(result.type).toBe("note");
    expect(result.content).toBe("Interesting production technique");
  });

  it("parses meeting: prefix", () => {
    const result = parseCaptureInput("meeting: Label wants 3 remixes by March");
    expect(result.type).toBe("meeting");
    expect(result.content).toBe("Label wants 3 remixes by March");
  });

  it("parses mtg: prefix as meeting", () => {
    const result = parseCaptureInput("mtg: Discussed tour dates");
    expect(result.type).toBe("meeting");
    expect(result.content).toBe("Discussed tour dates");
  });

  it("parses idea: prefix", () => {
    const result = parseCaptureInput("idea: Mashup of 90s track with current banger");
    expect(result.type).toBe("idea");
    expect(result.content).toBe("Mashup of 90s track with current banger");
  });

  it("handles case-insensitive prefixes", () => {
    const result = parseCaptureInput("MEETING: Important notes");
    expect(result.type).toBe("meeting");
    expect(result.content).toBe("Important notes");
  });

  it("preserves raw input", () => {
    const input = "  task: Trim me  ";
    const result = parseCaptureInput(input);
    expect(result.rawInput).toBe(input);
  });

  it("handles empty input", () => {
    const result = parseCaptureInput("");
    expect(result.type).toBe("task");
    expect(result.content).toBe("");
  });

  it("handles whitespace-only input", () => {
    const result = parseCaptureInput("   ");
    expect(result.type).toBe("task");
    expect(result.content).toBe("");
  });

  it("does not match non-prefix colons", () => {
    const result = parseCaptureInput("Time: 3:00 PM meeting");
    expect(result.type).toBe("task");
    expect(result.content).toBe("Time: 3:00 PM meeting");
  });

  it("handles unknown prefix as content", () => {
    const result = parseCaptureInput("random: some text");
    expect(result.type).toBe("task");
    expect(result.content).toBe("random: some text");
  });
});

describe("extractDateReference", () => {
  it("extracts 'by Friday' reference", () => {
    const result = extractDateReference("Buy headphones by Friday");
    expect(result?.toLowerCase()).toBe("friday");
  });

  it("extracts 'by tomorrow' reference", () => {
    const result = extractDateReference("Finish remix by tomorrow");
    expect(result?.toLowerCase()).toBe("tomorrow");
  });

  it("extracts 'by today' reference", () => {
    const result = extractDateReference("Send email by today");
    expect(result?.toLowerCase()).toBe("today");
  });

  it("extracts 'by next week' reference", () => {
    const result = extractDateReference("Complete project by next week");
    expect(result?.toLowerCase()).toBe("next week");
  });

  it("extracts date format MM/DD", () => {
    const result = extractDateReference("Submit by 2/15");
    expect(result).toBe("2/15");
  });

  it("extracts 'due Monday' reference", () => {
    const result = extractDateReference("Contract review due Monday");
    expect(result?.toLowerCase()).toBe("monday");
  });

  it("extracts standalone 'tomorrow' reference", () => {
    const result = extractDateReference("Call them tomorrow");
    expect(result?.toLowerCase()).toBe("tomorrow");
  });

  it("returns null when no date reference found", () => {
    const result = extractDateReference("Buy new headphones");
    expect(result).toBeNull();
  });

  it("handles empty string", () => {
    const result = extractDateReference("");
    expect(result).toBeNull();
  });
});
