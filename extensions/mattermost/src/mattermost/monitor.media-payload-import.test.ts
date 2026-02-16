import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

describe("monitor media payload compatibility", () => {
  test("monitor.ts should not import buildAgentMediaPayload from plugin-sdk", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const filePath = resolve(here, "./monitor.ts");
    const source = readFileSync(filePath, "utf8");

    expect(source).not.toContain("buildAgentMediaPayload");
  });
});
