import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "amigo",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "amigo", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "amigo", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "amigo", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "amigo", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "amigo", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "amigo", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (dev first)", () => {
    const res = parseCliProfileArgs(["node", "amigo", "--dev", "--profile", "work", "status"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (profile first)", () => {
    const res = parseCliProfileArgs(["node", "amigo", "--profile", "work", "--dev", "status"]);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join("/home/peter", ".amigo-dev");
    expect(env.AMIGO_PROFILE).toBe("dev");
    expect(env.AMIGO_STATE_DIR).toBe(expectedStateDir);
    expect(env.AMIGO_CONFIG_PATH).toBe(path.join(expectedStateDir, "amigo.json"));
    expect(env.AMIGO_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      AMIGO_STATE_DIR: "/custom",
      AMIGO_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.AMIGO_STATE_DIR).toBe("/custom");
    expect(env.AMIGO_GATEWAY_PORT).toBe("19099");
    expect(env.AMIGO_CONFIG_PATH).toBe(path.join("/custom", "amigo.json"));
  });
});

describe("formatCliCommand", () => {
  it("returns command unchanged when no profile is set", () => {
    expect(formatCliCommand("amigo doctor --fix", {})).toBe("amigo doctor --fix");
  });

  it("returns command unchanged when profile is default", () => {
    expect(formatCliCommand("amigo doctor --fix", { AMIGO_PROFILE: "default" })).toBe(
      "amigo doctor --fix",
    );
  });

  it("returns command unchanged when profile is Default (case-insensitive)", () => {
    expect(formatCliCommand("amigo doctor --fix", { AMIGO_PROFILE: "Default" })).toBe(
      "amigo doctor --fix",
    );
  });

  it("returns command unchanged when profile is invalid", () => {
    expect(formatCliCommand("amigo doctor --fix", { AMIGO_PROFILE: "bad profile" })).toBe(
      "amigo doctor --fix",
    );
  });

  it("returns command unchanged when --profile is already present", () => {
    expect(
      formatCliCommand("amigo --profile work doctor --fix", { AMIGO_PROFILE: "work" }),
    ).toBe("amigo --profile work doctor --fix");
  });

  it("returns command unchanged when --dev is already present", () => {
    expect(formatCliCommand("amigo --dev doctor", { AMIGO_PROFILE: "dev" })).toBe(
      "amigo --dev doctor",
    );
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("amigo doctor --fix", { AMIGO_PROFILE: "work" })).toBe(
      "amigo --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("amigo doctor --fix", { AMIGO_PROFILE: "  jbamigo  " })).toBe(
      "amigo --profile jbamigo doctor --fix",
    );
  });

  it("handles command with no args after amigo", () => {
    expect(formatCliCommand("amigo", { AMIGO_PROFILE: "test" })).toBe(
      "amigo --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm amigo doctor", { AMIGO_PROFILE: "work" })).toBe(
      "pnpm amigo --profile work doctor",
    );
  });
});
