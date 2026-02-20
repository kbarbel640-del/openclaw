import { describe, expect, it } from "vitest";
import type { ParsedArgs } from "./types.js";
import { buildGmailQuery } from "./gmail-query.js";

describe("buildGmailQuery", () => {
  it("builds default query with no filters", () => {
    const args: ParsedArgs = { period: "1d", filters: {} };
    expect(buildGmailQuery(args)).toBe("newer_than:1d in:inbox");
  });

  it("builds query with custom period", () => {
    const args: ParsedArgs = { period: "7d", filters: {} };
    expect(buildGmailQuery(args)).toBe("newer_than:7d in:inbox");
  });

  it("builds query with from filter", () => {
    const args: ParsedArgs = {
      period: "1d",
      filters: { from: "boss@work.com" },
    };
    expect(buildGmailQuery(args)).toBe("from:boss@work.com newer_than:1d in:inbox");
  });

  it("builds query with to filter", () => {
    const args: ParsedArgs = {
      period: "3d",
      filters: { to: "team@company.com" },
    };
    expect(buildGmailQuery(args)).toBe("to:team@company.com newer_than:3d in:inbox");
  });

  it("builds query with urgent flag including urgency keywords", () => {
    const args: ParsedArgs = {
      period: "1d",
      filters: { urgent: true },
    };
    const query = buildGmailQuery(args);
    expect(query).toContain("newer_than:1d");
    expect(query).toContain("in:inbox");
    expect(query).toContain("is:important OR label:urgent");
    expect(query).toContain("срочно OR urgent OR ASAP");
  });

  it("builds query with unread filter", () => {
    const args: ParsedArgs = {
      period: "2d",
      filters: { unread: true },
    };
    expect(buildGmailQuery(args)).toBe("newer_than:2d in:inbox is:unread");
  });

  it("appends free text directly", () => {
    const args: ParsedArgs = {
      period: "7d",
      filters: { freeText: "quarterly report" },
    };
    expect(buildGmailQuery(args)).toBe("newer_than:7d in:inbox quarterly report");
  });

  it("combines all filters together", () => {
    const args: ParsedArgs = {
      period: "3d",
      filters: {
        from: "ceo@company.com",
        to: "me@company.com",
        urgent: true,
        unread: true,
        freeText: "project-update",
      },
    };
    const query = buildGmailQuery(args);
    expect(query).toContain("from:ceo@company.com");
    expect(query).toContain("to:me@company.com");
    expect(query).toContain("newer_than:3d");
    expect(query).toContain("in:inbox");
    expect(query).toContain("is:important OR label:urgent OR subject:(срочно OR urgent OR ASAP)");
    expect(query).toContain("is:unread");
    expect(query).toContain("project-update");
  });

  it("places from before newer_than", () => {
    const args: ParsedArgs = {
      period: "5d",
      filters: { from: "alice@test.com" },
    };
    const query = buildGmailQuery(args);
    const fromIdx = query.indexOf("from:");
    const newerIdx = query.indexOf("newer_than:");
    expect(fromIdx).toBeLessThan(newerIdx);
  });
});
