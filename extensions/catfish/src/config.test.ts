import { afterEach, describe, expect, it } from "vitest";
import {
  parseCatfishConfig,
  resolveCatfishCredentials,
  CATFISH_SCOPE_ALT,
  CATFISH_SCOPE_PRIMARY,
} from "./config.js";

describe("catfish config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses default required scopes when none are configured", () => {
    const parsed = parseCatfishConfig(undefined);
    expect(parsed.requiredScopes).toEqual([CATFISH_SCOPE_PRIMARY, CATFISH_SCOPE_ALT]);
  });

  it("resolves dedicated credentials from env vars", () => {
    process.env.CATFISH_ZOOM_CLIENT_ID = "env-client-id";
    process.env.CATFISH_ZOOM_CLIENT_SECRET = "env-client-secret";
    process.env.CATFISH_ZOOM_ACCOUNT_ID = "env-account-id";

    const creds = resolveCatfishCredentials(parseCatfishConfig(undefined));
    expect(creds).toEqual({
      clientId: "env-client-id",
      clientSecret: "env-client-secret",
      accountId: "env-account-id",
    });
  });

  it("falls back to ZOOM_REPORT_* env vars when CATFISH_ZOOM_* are absent", () => {
    process.env.ZOOM_REPORT_CLIENT_ID = "report-client-id";
    process.env.ZOOM_REPORT_CLIENT_SECRET = "report-client-secret";
    process.env.ZOOM_REPORT_ACCOUNT_ID = "report-account-id";

    const creds = resolveCatfishCredentials(parseCatfishConfig(undefined));
    expect(creds).toEqual({
      clientId: "report-client-id",
      clientSecret: "report-client-secret",
      accountId: "report-account-id",
    });
  });

  it("falls back to ZOOM_* env vars when CATFISH_ZOOM_* and ZOOM_REPORT_* are absent", () => {
    process.env.ZOOM_CLIENT_ID = "zoom-client-id";
    process.env.ZOOM_CLIENT_SECRET = "zoom-client-secret";
    process.env.ZOOM_ACCOUNT_ID = "zoom-account-id";

    const creds = resolveCatfishCredentials(parseCatfishConfig(undefined));
    expect(creds).toEqual({
      clientId: "zoom-client-id",
      clientSecret: "zoom-client-secret",
      accountId: "zoom-account-id",
    });
  });

  it("prefers dedicated CATFISH_ZOOM_* over fallback env vars", () => {
    process.env.CATFISH_ZOOM_CLIENT_ID = "catfish-client-id";
    process.env.CATFISH_ZOOM_CLIENT_SECRET = "catfish-client-secret";
    process.env.CATFISH_ZOOM_ACCOUNT_ID = "catfish-account-id";
    process.env.ZOOM_REPORT_CLIENT_ID = "report-client-id";
    process.env.ZOOM_REPORT_CLIENT_SECRET = "report-client-secret";
    process.env.ZOOM_REPORT_ACCOUNT_ID = "report-account-id";

    const creds = resolveCatfishCredentials(parseCatfishConfig(undefined));
    expect(creds).toEqual({
      clientId: "catfish-client-id",
      clientSecret: "catfish-client-secret",
      accountId: "catfish-account-id",
    });
  });

  it("prefers plugin config over all env vars", () => {
    process.env.CATFISH_ZOOM_CLIENT_ID = "catfish-client-id";
    process.env.CATFISH_ZOOM_CLIENT_SECRET = "catfish-client-secret";
    process.env.CATFISH_ZOOM_ACCOUNT_ID = "catfish-account-id";

    const creds = resolveCatfishCredentials(
      parseCatfishConfig({
        clientId: "cfg-client-id",
        clientSecret: "cfg-client-secret",
        accountId: "cfg-account-id",
      }),
    );
    expect(creds).toEqual({
      clientId: "cfg-client-id",
      clientSecret: "cfg-client-secret",
      accountId: "cfg-account-id",
    });
  });
});
