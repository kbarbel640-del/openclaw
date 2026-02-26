import { afterEach, describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveSlackAccount } from "./accounts.js";

const ORIGINAL_SLACK_USER_TOKEN = process.env.SLACK_USER_TOKEN;

afterEach(() => {
  if (ORIGINAL_SLACK_USER_TOKEN === undefined) {
    delete process.env.SLACK_USER_TOKEN;
  } else {
    process.env.SLACK_USER_TOKEN = ORIGINAL_SLACK_USER_TOKEN;
  }
});

describe("resolveSlackAccount user token env fallback", () => {
  it("uses SLACK_USER_TOKEN for default account when config is missing", () => {
    process.env.SLACK_USER_TOKEN = "xoxp-env-token";
    const cfg = {
      channels: { slack: { enabled: true } },
    } as OpenClawConfig;

    const account = resolveSlackAccount({ cfg });
    expect(account.config.userToken).toBe("xoxp-env-token");
  });

  it("prefers configured userToken over SLACK_USER_TOKEN", () => {
    process.env.SLACK_USER_TOKEN = "xoxp-env-token";
    const cfg = {
      channels: { slack: { enabled: true, userToken: "xoxp-config-token" } },
    } as OpenClawConfig;

    const account = resolveSlackAccount({ cfg });
    expect(account.config.userToken).toBe("xoxp-config-token");
  });

  it("does not apply SLACK_USER_TOKEN to non-default accounts", () => {
    process.env.SLACK_USER_TOKEN = "xoxp-env-token";
    const cfg = {
      channels: {
        slack: {
          enabled: true,
          accounts: {
            secondary: { enabled: true },
          },
        },
      },
    } as OpenClawConfig;

    const account = resolveSlackAccount({ cfg, accountId: "secondary" });
    expect(account.config.userToken).toBeUndefined();
  });
});
