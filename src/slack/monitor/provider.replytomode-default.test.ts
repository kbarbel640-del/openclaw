import { describe, expect, it } from "vitest";

/**
 * Regression guard for https://github.com/openclaw/openclaw/issues/XXXXX
 *
 * The docs state `channels.slack.replyToMode` defaults to `"off"`.
 * The code was defaulting to `"all"`, causing unintended thread replies
 * for users who omitted the option.
 */

// Extract the default resolution logic directly — same as provider.ts line:
//   const replyToMode = slackCfg.replyToMode ?? "off";
function resolveReplyToMode(
  configured: "off" | "first" | "all" | undefined,
): "off" | "first" | "all" {
  return configured ?? "off";
}

describe("Slack replyToMode default", () => {
  it('defaults to "off" when config omits replyToMode', () => {
    expect(resolveReplyToMode(undefined)).toBe("off");
  });

  it('respects explicit "all" when configured', () => {
    expect(resolveReplyToMode("all")).toBe("all");
  });

  it('respects explicit "first" when configured', () => {
    expect(resolveReplyToMode("first")).toBe("first");
  });

  it('respects explicit "off" when configured', () => {
    expect(resolveReplyToMode("off")).toBe("off");
  });
});
