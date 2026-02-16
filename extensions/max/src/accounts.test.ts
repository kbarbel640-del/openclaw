import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listMaxAccountIds, resolveDefaultMaxAccountId, resolveMaxAccount } from "./accounts.js";

// Save and restore MAX_BOT_TOKEN between tests
const origEnvToken = process.env.MAX_BOT_TOKEN;
afterEach(() => {
  if (origEnvToken === undefined) {
    delete process.env.MAX_BOT_TOKEN;
  } else {
    process.env.MAX_BOT_TOKEN = origEnvToken;
  }
});

// ---------------------------------------------------------------------------
// listMaxAccountIds
// ---------------------------------------------------------------------------

describe("listMaxAccountIds", () => {
  it("returns [default] when no MAX config exists", () => {
    const cfg: OpenClawConfig = {};
    expect(listMaxAccountIds(cfg)).toEqual([DEFAULT_ACCOUNT_ID]);
  });

  it("returns [default] when MAX config has no accounts", () => {
    const cfg: OpenClawConfig = { channels: { max: { botToken: "tok" } } };
    expect(listMaxAccountIds(cfg)).toEqual([DEFAULT_ACCOUNT_ID]);
  });

  it("returns sorted account IDs", () => {
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          accounts: {
            bravo: { botToken: "b" },
            alpha: { botToken: "a" },
          },
        },
      },
    };
    expect(listMaxAccountIds(cfg)).toEqual(["alpha", "bravo"]);
  });

  it("normalizes account IDs (lowercased)", () => {
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          accounts: {
            MyBot: { botToken: "tok" },
          },
        },
      },
    };
    const ids = listMaxAccountIds(cfg);
    expect(ids).toEqual(["mybot"]);
  });

  it("deduplicates normalized account IDs", () => {
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          accounts: {
            Bot: { botToken: "a" },
            bot: { botToken: "b" },
          },
        },
      },
    };
    const ids = listMaxAccountIds(cfg);
    expect(ids).toEqual(["bot"]);
  });
});

// ---------------------------------------------------------------------------
// resolveDefaultMaxAccountId
// ---------------------------------------------------------------------------

describe("resolveDefaultMaxAccountId", () => {
  it("returns default when no accounts configured", () => {
    const cfg: OpenClawConfig = {};
    expect(resolveDefaultMaxAccountId(cfg)).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("returns default when it exists in accounts", () => {
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          accounts: {
            [DEFAULT_ACCOUNT_ID]: { botToken: "tok" },
            other: { botToken: "tok2" },
          },
        },
      },
    };
    expect(resolveDefaultMaxAccountId(cfg)).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("returns first sorted ID when default is not present", () => {
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          accounts: {
            bravo: { botToken: "b" },
            alpha: { botToken: "a" },
          },
        },
      },
    };
    expect(resolveDefaultMaxAccountId(cfg)).toBe("alpha");
  });
});

// ---------------------------------------------------------------------------
// resolveMaxAccount
// ---------------------------------------------------------------------------

describe("resolveMaxAccount", () => {
  it("resolves default account with config token", () => {
    const cfg: OpenClawConfig = {
      channels: { max: { botToken: "my-token" } },
    };
    const account = resolveMaxAccount({ cfg });
    expect(account.accountId).toBe(DEFAULT_ACCOUNT_ID);
    expect(account.token).toBe("my-token");
    expect(account.tokenSource).toBe("config");
    expect(account.enabled).toBe(true);
  });

  it("resolves env token for default account", () => {
    process.env.MAX_BOT_TOKEN = "env-token";
    const cfg: OpenClawConfig = {};
    const account = resolveMaxAccount({ cfg });
    expect(account.accountId).toBe(DEFAULT_ACCOUNT_ID);
    expect(account.token).toBe("env-token");
    expect(account.tokenSource).toBe("env");
  });

  it("does not use env token for non-default account", () => {
    process.env.MAX_BOT_TOKEN = "env-token";
    const cfg: OpenClawConfig = {
      channels: { max: { accounts: { mybot: {} } } },
    };
    const account = resolveMaxAccount({ cfg, accountId: "mybot" });
    expect(account.token).toBe("");
    expect(account.tokenSource).toBe("none");
  });

  it("resolves per-account token from accounts section", () => {
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          accounts: {
            mybot: { botToken: "account-token" },
          },
        },
      },
    };
    const account = resolveMaxAccount({ cfg, accountId: "mybot" });
    expect(account.accountId).toBe("mybot");
    expect(account.token).toBe("account-token");
    expect(account.tokenSource).toBe("config");
  });

  it("merges base config with per-account config", () => {
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          proxy: "http://proxy.example.com",
          accounts: {
            mybot: { botToken: "tok", name: "My Bot" },
          },
        },
      },
    };
    const account = resolveMaxAccount({ cfg, accountId: "mybot" });
    expect(account.config.proxy).toBe("http://proxy.example.com");
    expect(account.name).toBe("My Bot");
  });

  it("per-account config overrides base config", () => {
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          proxy: "http://base-proxy",
          accounts: {
            mybot: { botToken: "tok", proxy: "http://account-proxy" },
          },
        },
      },
    };
    const account = resolveMaxAccount({ cfg, accountId: "mybot" });
    expect(account.config.proxy).toBe("http://account-proxy");
  });

  it("returns enabled=false when base level disabled", () => {
    const cfg: OpenClawConfig = {
      channels: { max: { botToken: "tok", enabled: false } },
    };
    const account = resolveMaxAccount({ cfg });
    expect(account.enabled).toBe(false);
  });

  it("returns enabled=false when account level disabled", () => {
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          accounts: {
            mybot: { botToken: "tok", enabled: false },
          },
        },
      },
    };
    const account = resolveMaxAccount({ cfg, accountId: "mybot" });
    expect(account.enabled).toBe(false);
  });

  it("returns tokenSource=none when no token configured", () => {
    const cfg: OpenClawConfig = {};
    delete process.env.MAX_BOT_TOKEN;
    const account = resolveMaxAccount({ cfg });
    expect(account.token).toBe("");
    expect(account.tokenSource).toBe("none");
  });

  it("falls back to configured account when default has no token", () => {
    delete process.env.MAX_BOT_TOKEN;
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          accounts: {
            mybot: { botToken: "fallback-token" },
          },
        },
      },
    };
    // No explicit accountId — should fall back to "mybot" since default has no token
    const account = resolveMaxAccount({ cfg });
    expect(account.accountId).toBe("mybot");
    expect(account.token).toBe("fallback-token");
    expect(account.tokenSource).toBe("config");
  });

  it("does not fall back when explicit accountId is provided", () => {
    delete process.env.MAX_BOT_TOKEN;
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          accounts: {
            mybot: { botToken: "fallback-token" },
          },
        },
      },
    };
    // Explicit accountId=default — should NOT fall back
    const account = resolveMaxAccount({ cfg, accountId: DEFAULT_ACCOUNT_ID });
    expect(account.accountId).toBe(DEFAULT_ACCOUNT_ID);
    expect(account.token).toBe("");
    expect(account.tokenSource).toBe("none");
  });

  it("normalizes accountId lookup", () => {
    const cfg: OpenClawConfig = {
      channels: {
        max: {
          accounts: {
            MyBot: { botToken: "tok" },
          },
        },
      },
    };
    const account = resolveMaxAccount({ cfg, accountId: "MYBOT" });
    expect(account.token).toBe("tok");
    expect(account.tokenSource).toBe("config");
  });
});
