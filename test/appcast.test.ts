import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const APPCAST_URL = new URL("../appcast.xml", import.meta.url);

function expectedSparkleVersion(shortVersion: string): string {
  const [year, month, day] = shortVersion.split(".");
  if (!year || !month || !day) {
    throw new Error(`unexpected short version: ${shortVersion}`);
  }
  return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}0`;
}

describe("appcast.xml", () => {
  const appcast = readFileSync(APPCAST_URL, "utf8");
  const items = Array.from(appcast.matchAll(/<item>[\s\S]*?<\/item>/g)).map((match) => match[0]);

  it("every item uses YYYYMMDD0 sparkle:version matching its shortVersionString", () => {
    for (const item of items) {
      const shortMatch = item.match(
        /<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/,
      );
      expect(shortMatch).toBeDefined();
      const shortVersion = shortMatch![1];

      const versionMatch = item.match(/<sparkle:version>([^<]+)<\/sparkle:version>/);
      expect(versionMatch).toBeDefined();

      // Skip prerelease versions (e.g. -beta.1); only validate standard calver entries
      const parts = shortVersion.split(".");
      if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
        expect(versionMatch![1], `sparkle:version mismatch for ${shortVersion}`).toBe(
          expectedSparkleVersion(shortVersion),
        );
      }
    }
  });

  it("sparkle:version values are monotonically increasing", () => {
    const versions = items.map((item) => {
      const m = item.match(/<sparkle:version>([^<]+)<\/sparkle:version>/);
      return Number(m![1]);
    });
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i], `item ${i} version should be > item ${i - 1}`).toBeGreaterThan(
        versions[i - 1],
      );
    }
  });
});
