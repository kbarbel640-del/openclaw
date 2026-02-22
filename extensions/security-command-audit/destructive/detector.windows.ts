import type { DestructiveMatch, DetectionRule } from "./detector.js";

function normalizeWindowsPathSeparators(command: string): string {
  // Replace forward slashes with backslashes to better match Windows paths.
  return command.replaceAll("/", "\\");
}

export function detectWindowsDestructive(
  command: string,
  rules: DetectionRule[],
): DestructiveMatch | undefined {
  const fullCommand = normalizeWindowsPathSeparators((command || "").trim());
  if (!fullCommand) {
    return undefined;
  }
  for (const r of rules) {
    if (r.platform !== "all" && r.platform !== "windows") {
      continue;
    }
    if (r.regex.test(fullCommand)) {
      return {
        category: r.category,
        severity: r.severity,
        rule: r.rule,
        reason: r.reason,
      };
    }
  }
  return undefined;
}
