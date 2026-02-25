import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveSlackAccount } from "./accounts.js";

describe("resolveSlackAccount", () => {
  const prevSlackUserToken = process.env.SLACK_USER_TOKEN;

  beforeAll(() => {
    process.env.SLACK_USER_TOKEN = "xoxp-env-user";
  });

  afterAll(() => {
    if (prevSlackUserToken === undefined) {
      delete process.env.SLACK_USER_TOKEN;
      return;
    }
    process.env.SLACK_USER_TOKEN = prevSlackUserToken;
  });

  it("reads default account user token from environment", () => {
    const cfg: OpenClawConfig = {
      channels: {
        slack: {
          enabled: true,
        },
      },
    };

    const account = resolveSlackAccount({ cfg });
    expect(account.config.userToken).toBe("xoxp-env-user");
  });
});
