import { describe, expect, it, vi } from "vitest";
import { loadDopplerSecrets, shouldAutoEnableDoppler } from "./doppler.js";

describe("shouldAutoEnableDoppler", () => {
  it("returns false when DOPPLER_TOKEN is absent", () => {
    expect(shouldAutoEnableDoppler({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("returns false when DOPPLER_TOKEN is blank", () => {
    expect(shouldAutoEnableDoppler({ DOPPLER_TOKEN: "  " })).toBe(false);
  });

  it("returns true when DOPPLER_TOKEN is set", () => {
    expect(shouldAutoEnableDoppler({ DOPPLER_TOKEN: "dp.st.xxx" })).toBe(true);
  });
});

describe("loadDopplerSecrets", () => {
  const makeEnv = (extra: Record<string, string> = {}): NodeJS.ProcessEnv =>
    ({ ...extra }) as NodeJS.ProcessEnv;

  const makeExec = (result: string | Error) => {
    return vi.fn((...args: unknown[]) => {
      // Second call is the actual secrets download; first might be --version check
      if (result instanceof Error) {
        // Allow --version check to pass, throw on secrets download
        const cliArgs = args[1] as string[];
        if (cliArgs?.[0] === "--version") {
          return "3.0.0";
        }
        throw result;
      }
      const cliArgs = args[1] as string[];
      if (cliArgs?.[0] === "--version") {
        return "3.0.0";
      }
      return result;
    });
  };

  it("skips when dopplerConfig.enabled is false", () => {
    const env = makeEnv({ DOPPLER_TOKEN: "dp.st.xxx" });
    const exec = vi.fn();

    const res = loadDopplerSecrets({
      env,
      dopplerConfig: { enabled: false },
      exec: exec as unknown as Parameters<typeof loadDopplerSecrets>[0]["exec"],
    });

    expect(res.ok).toBe(true);
    expect(res.applied).toEqual([]);
    expect(res.ok && res.skippedReason).toBe("disabled");
    expect(exec).not.toHaveBeenCalled();
  });

  it("skips when no token and not explicitly enabled", () => {
    const env = makeEnv();
    const exec = vi.fn();

    const res = loadDopplerSecrets({
      env,
      exec: exec as unknown as Parameters<typeof loadDopplerSecrets>[0]["exec"],
    });

    expect(res.ok).toBe(true);
    expect(res.ok && res.skippedReason).toBe("no-token");
    expect(exec).not.toHaveBeenCalled();
  });

  it("returns not-installed when doppler CLI is missing", () => {
    const env = makeEnv({ DOPPLER_TOKEN: "dp.st.xxx" });
    const exec = vi.fn(() => {
      throw new Error("ENOENT");
    });

    const res = loadDopplerSecrets({
      env,
      exec: exec as unknown as Parameters<typeof loadDopplerSecrets>[0]["exec"],
    });

    expect(res.ok).toBe(true);
    expect(res.ok && res.skippedReason).toBe("not-installed");
  });

  it("returns not-installed with warning when explicitly enabled but CLI missing", () => {
    const env = makeEnv();
    const logger = { warn: vi.fn() };
    const exec = vi.fn(() => {
      throw new Error("ENOENT");
    });

    const res = loadDopplerSecrets({
      env,
      logger,
      dopplerConfig: { enabled: true },
      exec: exec as unknown as Parameters<typeof loadDopplerSecrets>[0]["exec"],
    });

    expect(res.ok).toBe(true);
    expect(res.ok && res.skippedReason).toBe("not-installed");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Doppler is enabled in config but the CLI is not installed"),
    );
  });

  it("successfully loads secrets without overriding existing env", () => {
    const env = makeEnv({
      DOPPLER_TOKEN: "dp.st.xxx",
      EXISTING_KEY: "keep-me",
    });

    const secretsJson = JSON.stringify({
      OPENAI_API_KEY: "sk-from-doppler",
      EXISTING_KEY: "doppler-value",
      NEW_SECRET: "new-value",
      DOPPLER_PROJECT: "my-proj",
      DOPPLER_CONFIG: "dev",
      DOPPLER_ENVIRONMENT: "dev",
    });

    const exec = makeExec(secretsJson);

    const res = loadDopplerSecrets({
      env,
      exec: exec as unknown as Parameters<typeof loadDopplerSecrets>[0]["exec"],
    });

    expect(res.ok).toBe(true);
    expect(res.applied).toContain("OPENAI_API_KEY");
    expect(res.applied).toContain("NEW_SECRET");
    expect(res.applied).not.toContain("EXISTING_KEY");
    expect(res.applied).not.toContain("DOPPLER_PROJECT");
    expect(res.applied).not.toContain("DOPPLER_CONFIG");
    expect(res.applied).not.toContain("DOPPLER_ENVIRONMENT");

    expect(env.OPENAI_API_KEY).toBe("sk-from-doppler");
    expect(env.EXISTING_KEY).toBe("keep-me");
    expect(env.NEW_SECRET).toBe("new-value");
  });

  it("handles Doppler computed value format", () => {
    const env = makeEnv({ DOPPLER_TOKEN: "dp.st.xxx" });

    const secretsJson = JSON.stringify({
      MY_KEY: { computed: "computed-value", raw: "raw-value" },
    });

    const exec = makeExec(secretsJson);

    const res = loadDopplerSecrets({
      env,
      exec: exec as unknown as Parameters<typeof loadDopplerSecrets>[0]["exec"],
    });

    expect(res.ok).toBe(true);
    expect(env.MY_KEY).toBe("computed-value");
  });

  it("passes --project and --config CLI args when configured", () => {
    const env = makeEnv({ DOPPLER_TOKEN: "dp.st.xxx" });

    const secretsJson = JSON.stringify({ SOME_KEY: "value" });
    const exec = makeExec(secretsJson);

    loadDopplerSecrets({
      env,
      dopplerConfig: { project: "rosie", config: "prod" },
      exec: exec as unknown as Parameters<typeof loadDopplerSecrets>[0]["exec"],
    });

    // The second call (index 1) is the secrets download
    const callArgs = exec.mock.calls[1];
    expect(callArgs[0]).toBe("doppler");
    const cliArgs = callArgs[1] as string[];
    expect(cliArgs).toContain("--project");
    expect(cliArgs).toContain("rosie");
    expect(cliArgs).toContain("--config");
    expect(cliArgs).toContain("prod");
  });

  it("returns error on fetch failure", () => {
    const env = makeEnv({ DOPPLER_TOKEN: "dp.st.xxx" });
    const logger = { warn: vi.fn() };

    const exec = makeExec(new Error("Connection refused"));

    const res = loadDopplerSecrets({
      env,
      logger,
      exec: exec as unknown as Parameters<typeof loadDopplerSecrets>[0]["exec"],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Connection refused");
    }
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Doppler secrets fetch failed"),
    );
  });

  it("works with explicit enabled: true even without DOPPLER_TOKEN", () => {
    const env = makeEnv();

    const secretsJson = JSON.stringify({ SECRET: "value" });
    const exec = makeExec(secretsJson);

    const res = loadDopplerSecrets({
      env,
      dopplerConfig: { enabled: true },
      exec: exec as unknown as Parameters<typeof loadDopplerSecrets>[0]["exec"],
    });

    expect(res.ok).toBe(true);
    expect(res.applied).toContain("SECRET");
    expect(env.SECRET).toBe("value");
  });

  it("skips blank secret values", () => {
    const env = makeEnv({ DOPPLER_TOKEN: "dp.st.xxx" });

    const secretsJson = JSON.stringify({
      GOOD_KEY: "has-value",
      BLANK_KEY: "   ",
      EMPTY_KEY: "",
    });

    const exec = makeExec(secretsJson);

    const res = loadDopplerSecrets({
      env,
      exec: exec as unknown as Parameters<typeof loadDopplerSecrets>[0]["exec"],
    });

    expect(res.ok).toBe(true);
    expect(res.applied).toContain("GOOD_KEY");
    expect(res.applied).not.toContain("BLANK_KEY");
    expect(res.applied).not.toContain("EMPTY_KEY");
  });
});
