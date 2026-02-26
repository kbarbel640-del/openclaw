import { describe, expect, it } from "vitest";
import { linePlugin } from "./channel.js";

const DEFAULT_ACCOUNT_ID = "default";

describe("linePlugin.status.collectStatusIssues", () => {
  it("does not warn when snapshot indicates token+secret present", () => {
    const issues = linePlugin.status!.collectStatusIssues!([
      {
        accountId: DEFAULT_ACCOUNT_ID,
        hasChannelAccessToken: true,
        hasChannelSecret: true,
      },
    ] as any);

    expect(issues).toEqual([]);
  });

  it("warns when snapshot indicates missing token", () => {
    const issues = linePlugin.status!.collectStatusIssues!([
      {
        accountId: DEFAULT_ACCOUNT_ID,
        hasChannelAccessToken: false,
        hasChannelSecret: true,
      },
    ] as any);

    expect(issues.map((i) => i.message)).toContain("LINE channel access token not configured");
  });

  it("warns when snapshot indicates missing secret", () => {
    const issues = linePlugin.status!.collectStatusIssues!([
      {
        accountId: DEFAULT_ACCOUNT_ID,
        hasChannelAccessToken: true,
        hasChannelSecret: false,
      },
    ] as any);

    expect(issues.map((i) => i.message)).toContain("LINE channel secret not configured");
  });
});
