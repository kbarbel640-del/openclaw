import { describe, expect, it } from "vitest";
import type { TranslationMap } from "../lib/types.ts";
import { en } from "../locales/en.ts";
import { uk } from "../locales/uk.ts";

function flattenStrings(
  map: TranslationMap,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  for (const [key, value] of Object.entries(map)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
      continue;
    }
    flattenStrings(value, path, out);
  }
  return out;
}

function placeholders(value: string): string[] {
  return Array.from(value.matchAll(/\{(\w+)\}/g), (m) => m[1]).toSorted();
}

describe("locale parity", () => {
  it("uk has the same translation key paths as en", () => {
    const enFlat = flattenStrings(en);
    const ukFlat = flattenStrings(uk);
    expect(Object.keys(ukFlat).toSorted()).toEqual(Object.keys(enFlat).toSorted());
  });

  it("uk preserves interpolation placeholders from en", () => {
    const enFlat = flattenStrings(en);
    const ukFlat = flattenStrings(uk);

    for (const key of Object.keys(enFlat)) {
      expect(placeholders(ukFlat[key] ?? "")).toEqual(placeholders(enFlat[key]));
    }
  });
});
