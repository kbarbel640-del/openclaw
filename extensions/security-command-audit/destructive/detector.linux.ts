import type { DestructiveMatch, DetectionRule } from "./detector.js";

export function detectLinuxDestructive(
  command: string,
  rules: DetectionRule[],
): DestructiveMatch | undefined {
  const fullCommand = (command || "").trim();
  if (!fullCommand) {
    return undefined;
  }
  for (const r of rules) {
    if (r.platform !== "all" && r.platform !== "linux") {
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
