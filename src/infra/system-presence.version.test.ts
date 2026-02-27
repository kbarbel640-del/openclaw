import { describe, expect, it, vi } from "vitest";
import { VERSION } from "../version.js";
import { withEnvAsync } from "../test-utils/env.js";

async function withPresenceModule<T>(
  env: Record<string, string | undefined>,
  run: (module: typeof import("./system-presence.js")) => Promise<T> | T,
): Promise<T> {
  return withEnvAsync(env, async () => {
    vi.resetModules();
    try {
      const module = await import("./system-presence.js");
      return await run(module);
    } finally {
      vi.resetModules();
    }
  });
}

describe("system-presence self version", () => {
  it("reports running gateway VERSION", async () => {
    await withPresenceModule(
      {
        OPENCLAW_VERSION: "9.9.9-cli",
        OPENCLAW_SERVICE_VERSION: "2.4.6-service",
        npm_package_version: "1.0.0-package",
      },
      ({ listSystemPresence }) => {
        const selfEntry = listSystemPresence().find((entry) => entry.reason === "self");
        expect(selfEntry?.version).toBe(VERSION);
      },
    );
  });
});
