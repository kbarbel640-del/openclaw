/**
 * Preserves `$include` directives during config write-back.
 *
 * When config is read, `$include` directives are resolved and their contents
 * are merged into the config object. When writing back, callers pass the
 * fully-resolved config. This module detects which keys originated from
 * `$include` directives and reconstructs the file with directives intact,
 * so they survive config round-trips.
 *
 * A key is kept in the output if:
 * 1. It existed as a sibling key in the raw (pre-resolution) config, OR
 * 2. It is a new key not provided by any `$include` (caller-added), OR
 * 3. It was provided by an `$include` but the caller changed its value
 *    (written as a sibling override)
 *
 * The `$include` directive itself is always preserved verbatim.
 */

import { INCLUDE_KEY, type IncludeResolver, resolveConfigIncludes } from "./includes.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/**
 * Shallow-ish structural equality check. Compares JSON serializations to
 * detect whether a value was meaningfully changed from its included source.
 * This is intentionally conservative: if serialization differs at all, the
 * value is treated as changed and written as a sibling override.
 */
function structurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null || a === undefined || b === undefined) {
    return false;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== "object") {
    return a === b;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Check whether a parsed config object (or any nested object within it)
 * contains a `$include` directive at any depth.
 */
export function hasIncludeDirective(obj: unknown): boolean {
  if (!isPlainObject(obj)) {
    return false;
  }
  if (INCLUDE_KEY in obj) {
    return true;
  }
  return Object.values(obj).some((v) => hasIncludeDirective(v));
}

/**
 * Resolve only the `$include` portion of an object, excluding sibling keys.
 * Returns the content that the include directive(s) contribute.
 */
function resolveIncludeOnly(
  includeValue: unknown,
  configPath: string,
  resolver: IncludeResolver,
): unknown {
  const includeOnlyObj = { [INCLUDE_KEY]: includeValue };
  return resolveConfigIncludes(includeOnlyObj, configPath, resolver);
}

/**
 * Recursively restore `$include` directives in the config being written.
 *
 * @param incoming  - The fully-resolved config about to be written
 * @param rawParsed - The current file's pre-resolution parsed content
 * @param configPath - Absolute path to the config file (for include resolution)
 * @param resolver  - File reader / JSON parser for include files
 * @returns A config object with `$include` directives preserved
 */
export function restoreIncludeDirectives(
  incoming: unknown,
  rawParsed: unknown,
  configPath: string,
  resolver: IncludeResolver,
): unknown {
  if (!isPlainObject(incoming) || !isPlainObject(rawParsed)) {
    return incoming;
  }

  // If this level has no $include, recurse into nested objects that might
  if (!(INCLUDE_KEY in rawParsed)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (
        key in rawParsed &&
        isPlainObject(rawParsed[key]) &&
        hasIncludeDirective(rawParsed[key])
      ) {
        result[key] = restoreIncludeDirectives(value, rawParsed[key], configPath, resolver);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // This level has $include — preserve it and reconstruct sibling keys
  let fromInclude: Record<string, unknown> = {};
  try {
    const resolved = resolveIncludeOnly(rawParsed[INCLUDE_KEY], configPath, resolver);
    if (isPlainObject(resolved)) {
      fromInclude = resolved;
    }
  } catch {
    // Include resolution failed at write time — fall back to writing everything
    return incoming;
  }

  const result: Record<string, unknown> = {};

  // 1. Preserve the $include directive verbatim
  result[INCLUDE_KEY] = rawParsed[INCLUDE_KEY];

  // 2. Copy all non-$include keys from the raw file, updated with incoming values.
  //    These are the "sibling overrides" the user explicitly put in the root file.
  for (const key of Object.keys(rawParsed)) {
    if (key === INCLUDE_KEY) {
      continue;
    }
    if (key in incoming) {
      // Recurse into nested objects that may themselves contain $include
      if (isPlainObject(rawParsed[key]) && hasIncludeDirective(rawParsed[key])) {
        result[key] = restoreIncludeDirectives(incoming[key], rawParsed[key], configPath, resolver);
      } else {
        result[key] = incoming[key];
      }
    }
    // If key not in incoming, it was intentionally removed — don't include
  }

  // 3. Check for keys in incoming that weren't in the raw file.
  //    If they came from the include with the same value → skip (include provides them).
  //    If they came from the include but were changed → write as sibling override.
  //    If they're entirely new → write them.
  for (const key of Object.keys(incoming)) {
    if (key in result || key === INCLUDE_KEY) {
      continue;
    }

    if (key in fromInclude) {
      // Key exists in include — only write if the value was changed
      if (!structurallyEqual(incoming[key], fromInclude[key])) {
        result[key] = incoming[key];
      }
      // else: unchanged from include, skip
    } else {
      // New key not from include — add it
      result[key] = incoming[key];
    }
  }

  return result;
}
