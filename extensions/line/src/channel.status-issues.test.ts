import type { ChannelAccountSnapshot } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";
import { linePlugin } from "./channel.js";

describe("linePlugin status.collectStatusIssues", () => {
  it("warns when token/secret are missing and account is not configured", () => {
    const collect = linePlugin.status!.collectStatusIssues!;
    const issues = collect([
      {
        accountId: "default",
        enabled: true,
        configured: false,
        hasChannelAccessToken: false,
        hasChannelSecret: false,
      } as unknown as ChannelAccountSnapshot,
    ]);

    expect(issues.map((i) => i.message)).toContain("LINE channel access token not configured");
    expect(issues.map((i) => i.message)).toContain("LINE channel secret not configured");
  });

  it("does not warn when snapshot is configured (cosmetic status fix)", () => {
    const collect = linePlugin.status!.collectStatusIssues!;
    const issues = collect([
      {
        accountId: "default",
        enabled: true,
        configured: true,
        // simulate drift / redaction
        hasChannelAccessToken: false,
        hasChannelSecret: false,
      } as unknown as ChannelAccountSnapshot,
    ]);

    expect(issues).toEqual([]);
  });
});
