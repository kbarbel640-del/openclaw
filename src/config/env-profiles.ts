/**
 * Environment-based config profiles.
 *
 * Adds `$env` directive support for conditional config sections based on
 * the active environment (OPENCLAW_ENV or NODE_ENV).
 *
 * @example
 * ```json5
 * {
 *   models: { providers: { anthropic: { apiKey: "${ANTHROPIC_API_KEY}" } } },
 *   "$env": {
 *     "production": {
 *       tools: { profile: "messaging", deny: ["group:runtime"] }
 *     },
 *     "development": {
 *       tools: { profile: "full" }
 *     }
 *   }
 * }
 * ```
 *
 * The active env is resolved from (in priority order):
 * 1. `OPENCLAW_ENV` environment variable
 * 2. `NODE_ENV` environment variable
 * 3. Defaults to `"development"`
 */

import { isPlainObject } from "../utils.js";
import { deepMerge } from "./includes.js";

export const ENV_KEY = "$env";
export const DEFAULT_ENV = "development";

/** Well-known environment names. Unknown names produce warnings. */
const WELL_KNOWN_ENVS = new Set([
  "development",
  "production",
  "staging",
  "test",
  "ci",
  "local",
  "preview",
]);

/** Resolve the active environment name. */
export function resolveActiveEnv(env: NodeJS.ProcessEnv = process.env): string {
  return env.OPENCLAW_ENV?.trim() || env.NODE_ENV?.trim() || DEFAULT_ENV;
}

/**
 * Process `$env` directives in a parsed config object.
 *
 * Walks the config tree and, at each level, if a `$env` key is found:
 * 1. Reads the active env name
 * 2. Deep-merges the matching env block into the parent object
 * 3. Removes the `$env` key from the result
 *
 * This is applied AFTER `$include` resolution and BEFORE `${VAR}` substitution
 * so that env-specific blocks can contain `${VAR}` references.
 */
export function resolveConfigEnvProfiles(
  obj: unknown,
  env: NodeJS.ProcessEnv = process.env,
  onWarn?: (warning: string) => void,
): unknown {
  const activeEnv = resolveActiveEnv(env);

  // Validate env names at the top level before processing.
  if (onWarn && isPlainObject(obj) && ENV_KEY in obj) {
    const warnings = validateEnvNames(obj[ENV_KEY]);
    for (const w of warnings) {
      onWarn(w);
    }
  }

  return processNode(obj, activeEnv);
}

// ---------------------------------------------------------------------------
// Environment name validation
// ---------------------------------------------------------------------------

/**
 * Validate environment names in a `$env` block.
 * Returns warnings for unknown or suspicious names.
 */
export function validateEnvNames(envBlock: unknown): string[] {
  if (!isPlainObject(envBlock)) {
    return [];
  }

  const keys = Object.keys(envBlock);
  if (keys.length === 0) {
    return ["$env block is defined but contains no environment entries"];
  }

  const warnings: string[] = [];
  for (const name of keys) {
    if (!WELL_KNOWN_ENVS.has(name)) {
      const suggestion = findClosestEnv(name);
      const hint = suggestion ? ` (did you mean "${suggestion}"?)` : "";
      warnings.push(`Unknown environment name "${name}" in $env block${hint}`);
    }
  }

  return warnings;
}

/**
 * Find the closest well-known env name using Levenshtein distance.
 * Returns the match if distance ≤ 3, otherwise undefined.
 */
function findClosestEnv(input: string): string | undefined {
  let best: string | undefined;
  let bestDist = 4; // Max distance threshold

  for (const known of WELL_KNOWN_ENVS) {
    const dist = levenshtein(input.toLowerCase(), known);
    if (dist < bestDist) {
      bestDist = dist;
      best = known;
    }
  }

  return best;
}

/** Simple Levenshtein distance (no allocations beyond a single array). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j]!;
      prev[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, prev[j - 1]!, prev[j]!);
      prevDiag = temp;
    }
  }

  return prev[b.length]!;
}

function processNode(node: unknown, activeEnv: string): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => processNode(item, activeEnv));
  }

  if (!isPlainObject(node)) {
    return node;
  }

  // First, recurse into child objects (depth-first).
  let result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === ENV_KEY) {
      continue; // Handle $env after processing children.
    }
    result[key] = processNode(value, activeEnv);
  }

  // Apply $env overlay if present.
  if (ENV_KEY in node) {
    const envBlock = node[ENV_KEY];
    if (isPlainObject(envBlock)) {
      const overlay = envBlock[activeEnv];
      if (overlay !== undefined) {
        const processedOverlay = processNode(overlay, activeEnv);
        if (isPlainObject(processedOverlay)) {
          result = deepMerge(result, processedOverlay) as Record<string, unknown>;
        }
      }
    }
  }

  return result;
}
