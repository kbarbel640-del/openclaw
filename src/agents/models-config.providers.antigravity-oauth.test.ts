import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveImplicitProviders } from "./models-config.providers.js";

describe("google-antigravity implicit provider", () => {
  it("keeps oauth apiKey as JSON payload for pi-ai cloud code assist", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-antigravity-oauth-"));
    await fs.writeFile(
      join(agentDir, "auth-profiles.json"),
      JSON.stringify(
        {
          version: 1,
          profiles: {
            "google-antigravity:test": {
              type: "oauth",
              provider: "google-antigravity",
              access: "ya29.test-access-token",
              refresh: "refresh-token",
              expires: Date.now() + 60_000,
              projectId: "test-project-id",
            },
          },
        },
        null,
        2,
      ),
    );

    const providers = await resolveImplicitProviders({ agentDir });
    const antigravity = providers["google-antigravity"];

    expect(antigravity).toBeDefined();
    expect(antigravity?.api).toBe("google-gemini-cli");
    expect(antigravity?.baseUrl).toBeUndefined();
    expect(antigravity?.apiKey).toBe(
      JSON.stringify({
        token: "ya29.test-access-token",
        projectId: "test-project-id",
      }),
    );
  });
});
