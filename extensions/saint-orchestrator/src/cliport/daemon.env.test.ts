import { describe, expect, it } from "vitest";
import { __testing } from "./daemon.js";

describe("buildSpawnEnv isolation", () => {
  it("includes minimal base env (PATH, HOME, LANG, TERM)", () => {
    const env = __testing.buildSpawnEnv({ cli: "test", command: "test" });
    expect(env.PATH).toBeTruthy();
    expect(env.HOME).toBeTruthy();
    expect(env.LANG).toBeTruthy();
    expect(env.TERM).toBeTruthy();
  });

  it("does not leak sensitive env vars from parent process", () => {
    // Temporarily set a sensitive env var
    const original = process.env.AWS_SECRET_ACCESS_KEY;
    process.env.AWS_SECRET_ACCESS_KEY = "super-secret";
    try {
      const env = __testing.buildSpawnEnv({ cli: "test", command: "test" });
      expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    } finally {
      if (original === undefined) {
        delete process.env.AWS_SECRET_ACCESS_KEY;
      } else {
        process.env.AWS_SECRET_ACCESS_KEY = original;
      }
    }
  });

  it("merges entry.env into the base env", () => {
    const env = __testing.buildSpawnEnv({
      cli: "test",
      command: "test",
      env: { MY_VAR: "hello", ANOTHER: "world" },
    });
    expect(env.MY_VAR).toBe("hello");
    expect(env.ANOTHER).toBe("world");
    expect(env.PATH).toBeTruthy();
  });

  it("entry.env can override base vars", () => {
    const env = __testing.buildSpawnEnv({
      cli: "test",
      command: "test",
      env: { PATH: "/custom/bin" },
    });
    expect(env.PATH).toBe("/custom/bin");
  });
});
