import type { TranslationMap } from "../lib/types.ts";

function isMap(value: unknown): value is TranslationMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeTranslations(...parts: TranslationMap[]): TranslationMap {
  const out: TranslationMap = {};

  for (const part of parts) {
    mergeInto(out, part);
  }

  return out;
}

function mergeInto(target: TranslationMap, source: TranslationMap) {
  for (const [key, value] of Object.entries(source)) {
    if (isMap(value) && isMap(target[key])) {
      mergeInto(target[key], value);
      continue;
    }
    if (isMap(value)) {
      const next: TranslationMap = {};
      mergeInto(next, value);
      target[key] = next;
      continue;
    }
    target[key] = value;
  }
}
