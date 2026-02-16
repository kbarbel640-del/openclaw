import type {
  ContextPruningToolMatch,
  EffectiveContextPruningSettings,
  EffectiveSoftTrimSettings,
} from "./settings.js";
import { compileGlobPatterns, matchesAnyGlobPattern } from "../../glob-pattern.js";

function normalizeGlob(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function makeToolPrunablePredicate(
  match: ContextPruningToolMatch,
): (toolName: string) => boolean {
  const deny = compileGlobPatterns({ raw: match.deny, normalize: normalizeGlob });
  const allow = compileGlobPatterns({ raw: match.allow, normalize: normalizeGlob });

  return (toolName: string) => {
    const normalized = normalizeGlob(toolName);
    if (matchesAnyGlobPattern(normalized, deny)) {
      return false;
    }
    if (allow.length === 0) {
      return true;
    }
    return matchesAnyGlobPattern(normalized, allow);
  };
}

/**
 * Resolve the effective softTrim settings for a specific tool.
 * Returns per-tool override if one matches, otherwise falls back to global softTrim.
 */
export function resolveToolSoftTrim(
  toolName: string,
  settings: EffectiveContextPruningSettings,
): EffectiveSoftTrimSettings {
  if (settings.toolOverrides.size === 0) {
    return settings.softTrim;
  }
  const normalized = normalizeGlob(toolName);
  // Direct match first.
  const direct = settings.toolOverrides.get(normalized);
  if (direct) {
    return direct;
  }
  // Glob pattern match.
  for (const [pattern, override] of settings.toolOverrides.entries()) {
    if (pattern.includes("*") || pattern.includes("?")) {
      const compiled = compileGlobPatterns({ raw: [pattern], normalize: normalizeGlob });
      if (matchesAnyGlobPattern(normalized, compiled)) {
        return override;
      }
    }
  }
  return settings.softTrim;
}
