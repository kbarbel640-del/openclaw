import type { VerifierScopeConfig } from "../../config/types.tools.js";
import { expandToolGroups, normalizeToolName } from "../tool-policy.js";

export function isToolInVerifierScope(
  toolName: string,
  scope: VerifierScopeConfig | undefined,
): boolean {
  if (!scope) {
    return true;
  }
  const normalized = normalizeToolName(toolName);
  if (scope.include && scope.include.length > 0) {
    const expanded = expandToolGroups(scope.include);
    return expanded.includes(normalized);
  }
  if (scope.exclude && scope.exclude.length > 0) {
    const expanded = expandToolGroups(scope.exclude);
    return !expanded.includes(normalized);
  }
  return true;
}
