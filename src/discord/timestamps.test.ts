import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../globals.js", () => ({
  logVerbose: vi.fn(),
  shouldLogVerbose: vi.fn(() => false),
}));

const { convertTimesToDiscordTimestamps } = await import("./timestamps.js");

describe("convertTimesToDiscordTimestamps", () => {
  beforeEach(() => {
    // Pin system time to 2026-02-09 12:00:00 local time
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 9, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("converts 12-hour time with PM", () => {
    const result = convertTimesToDiscordTimestamps("Your meeting is at 6:30pm.");
    expect(result).toMatch(/<t:\d+:t>/);
    expect(result).not.toContain("6:30pm");
  });

  it("converts 12-hour time with space before AM/PM", () => {
    const result = convertTimesToDiscordTimestamps("Call at 2:00 PM.");
    expect(result).toMatch(/<t:\d+:t>/);
    expect(result).not.toContain("2:00 PM");
  });

  it("converts hour-only time like 6pm", () => {
    const result = convertTimesToDiscordTimestamps("Let's meet at 6pm.");
    expect(result).toMatch(/<t:\d+:t>/);
    expect(result).not.toContain("6pm");
  });

  it("converts AM times correctly (12am = midnight)", () => {
    const result = convertTimesToDiscordTimestamps("It starts at 12:00am.");
    expect(result).toMatch(/<t:\d+:t>/);
    // 12:00am = midnight. Extract the unix and check it corresponds to 00:00.
    const match = result.match(/<t:(\d+):t>/);
    expect(match).not.toBeNull();
    const date = new Date(Number(match![1]) * 1000);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("leaves text inside inline code untouched", () => {
    const result = convertTimesToDiscordTimestamps("Run `sleep 6:30pm` to wait.");
    // The time inside backticks should remain unchanged
    expect(result).toContain("`sleep 6:30pm`");
  });

  it("leaves existing Discord timestamps untouched", () => {
    const input = "Event at <t:1707500200:t>.";
    const result = convertTimesToDiscordTimestamps(input);
    expect(result).toBe(input);
  });

  it("handles multiple times in the same text", () => {
    const result = convertTimesToDiscordTimestamps("Start at 9:00am and end at 5:30pm.");
    const matches = result.match(/<t:\d+:t>/g);
    expect(matches).toHaveLength(2);
    expect(result).not.toContain("9:00am");
    expect(result).not.toContain("5:30pm");
  });

  it("returns the correct unix timestamp for 6:30pm today", () => {
    const result = convertTimesToDiscordTimestamps("At 6:30pm.");
    const match = result.match(/<t:(\d+):t>/);
    expect(match).not.toBeNull();
    const unix = Number(match![1]);
    const date = new Date(unix * 1000);
    expect(date.getHours()).toBe(18);
    expect(date.getMinutes()).toBe(30);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1); // February (0-indexed)
    expect(date.getDate()).toBe(9);
  });

  it("does not match invalid times like 13:00pm", () => {
    const input = "At 13:00pm.";
    const result = convertTimesToDiscordTimestamps(input);
    // 13pm is invalid (>12 with am/pm), should remain unchanged
    expect(result).toBe(input);
  });

  it("does not match times without am/pm suffix", () => {
    // Standalone "18:30" without am/pm should not be converted
    // (too ambiguous, could be a version number or ratio)
    const input = "Version 18:30 released.";
    const result = convertTimesToDiscordTimestamps(input);
    expect(result).toBe(input);
  });

  it("passes through plain text with no times", () => {
    const input = "Hello, how are you today?";
    const result = convertTimesToDiscordTimestamps(input);
    expect(result).toBe(input);
  });
});
