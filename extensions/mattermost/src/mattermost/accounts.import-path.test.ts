import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

describe("mattermost account-id import path", () => {
  test("accounts.ts must import normalizeAccountId from plugin-sdk barrel", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const accountsPath = resolve(here, "./accounts.ts");
    const source = readFileSync(accountsPath, "utf8");

    expect(source).not.toContain('"openclaw/plugin-sdk/account-id"');
    expect(source).toContain('"openclaw/plugin-sdk"');
  });
});
