import { afterEach, describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveSlackAccount } from "./accounts.js";

const ORIGINAL_SLACK_USER_TOKEN = process.env.SLACK_USER_TOKEN;

function restoreSlackUserTokenEnv(): void {
  if (ORIGINAL_SLACK_USER_TOKEN === undefined) {
    delete process.env.SLACK_USER_TOKEN;
    return;
  }
  process.env.SLACK_USER_TOKEN = ORIGINAL_SLACK_USER_TOKEN;
}

afterEach(() => {
  restoreSlackUserTokenEnv();
});

describe("resolveSlackAccount", () => {
  it("uses SLACK_USER_TOKEN for default account when config userToken is missing", () => {
    process.env.SLACK_USER_TOKEN = " xoxp-env-token ";
    const cfg: OpenClawConfig = { channels: { slack: {} } };

    const account = resolveSlackAccount({ cfg });

    expect(account.userToken).toBe("xoxp-env-token");
    expect(account.userTokenSource).toBe("env");
    expect(account.config.userToken).toBe("xoxp-env-token");
  });

  it("prefers config userToken over SLACK_USER_TOKEN", () => {
    process.env.SLACK_USER_TOKEN = "xoxp-env-token";
    const cfg: OpenClawConfig = { channels: { slack: { userToken: "xoxp-config-token" } } };

    const account = resolveSlackAccount({ cfg });

    expect(account.userToken).toBe("xoxp-config-token");
    expect(account.userTokenSource).toBe("config");
    expect(account.config.userToken).toBe("xoxp-config-token");
  });

  it("does not apply SLACK_USER_TOKEN to non-default accounts", () => {
    process.env.SLACK_USER_TOKEN = "xoxp-env-token";
    const cfg: OpenClawConfig = {
      channels: { slack: { accounts: { work: {} } } },
    };

    const account = resolveSlackAccount({ cfg, accountId: "work" });

    expect(account.userToken).toBeUndefined();
    expect(account.userTokenSource).toBe("none");
    expect(account.config.userToken).toBeUndefined();
  });
});
