import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";
import { resolveMattermostGroupRequireMention } from "./group-mentions.js";

describe("resolveMattermostGroupRequireMention", () => {
  it("returns false when chatmode is 'onmessage'", () => {
    const cfg: OpenClawConfig = {
      channels: {
        mattermost: {
          enabled: true,
          botToken: "test-token",
          baseUrl: "https://chat.example.com",
          chatmode: "onmessage",
        },
      },
    };

    const result = resolveMattermostGroupRequireMention({
      cfg,

      accountId: "default",
    });

    expect(result).toBe(false);
  });

  it("returns true when chatmode is 'oncall'", () => {
    const cfg: OpenClawConfig = {
      channels: {
        mattermost: {
          enabled: true,
          botToken: "test-token",
          baseUrl: "https://chat.example.com",
          chatmode: "oncall",
        },
      },
    };

    const result = resolveMattermostGroupRequireMention({
      cfg,

      accountId: "default",
    });

    expect(result).toBe(true);
  });

  it("returns true when chatmode is 'onchar'", () => {
    const cfg: OpenClawConfig = {
      channels: {
        mattermost: {
          enabled: true,
          botToken: "test-token",
          baseUrl: "https://chat.example.com",
          chatmode: "onchar",
        },
      },
    };

    const result = resolveMattermostGroupRequireMention({
      cfg,

      accountId: "default",
    });

    expect(result).toBe(true);
  });

  it("defaults to true when no chatmode is set", () => {
    const cfg: OpenClawConfig = {
      channels: {
        mattermost: {
          enabled: true,
          botToken: "test-token",
          baseUrl: "https://chat.example.com",
        },
      },
    };

    const result = resolveMattermostGroupRequireMention({
      cfg,

      accountId: "default",
    });

    expect(result).toBe(true);
  });

  it("returns false for account-level chatmode 'onmessage'", () => {
    const cfg: OpenClawConfig = {
      channels: {
        mattermost: {
          enabled: true,
          accounts: {
            myaccount: {
              enabled: true,
              botToken: "test-token",
              baseUrl: "https://chat.example.com",
              chatmode: "onmessage",
            },
          },
        },
      },
    };

    const result = resolveMattermostGroupRequireMention({
      cfg,

      accountId: "myaccount",
    });

    expect(result).toBe(false);
  });
});
