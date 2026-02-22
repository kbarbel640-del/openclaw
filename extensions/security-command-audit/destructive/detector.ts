/**
 * High-risk command detection (destructive/system commands).
 *
 * Design notes:
 * - This is intentionally rules-based (no DLP / sensitive data detection).
 * - Inspired by clawguardian-main destructive detector patterns (SafeExec-like).
 */

import { detectExternalDomainViolation } from "../network/external-domain.js";
import { loadBuiltinDestructiveRules } from "../rules/rules-loader.js";
import { detectLinuxDestructive } from "./detector.linux.js";
import { detectWindowsDestructive } from "./detector.windows.js";

export type DestructiveCategory =
  | "file_delete"
  | "git_destructive"
  | "system_destructive"
  | "docker_destructive"
  | "network_destructive"
  | "process_kill"
  | "privilege_escalation";

export type Severity = "low" | "medium" | "high" | "critical" | "violation";

export type DestructiveMatch = {
  category: DestructiveCategory;
  severity: Severity;
  /** Rule name (stable identifier) */
  rule: string;
  /** Human-readable reason */
  reason: string;
};

export type DetectionPlatform = "all" | "linux" | "windows";

export type DetectionRule = {
  rule: string;
  category: DestructiveCategory;
  severity: Severity;
  reason: string;
  platform: DetectionPlatform;
  regex: RegExp;
};

type NormalizedOsType = "linux" | "windows";

function detectRuntimeOsType(): NormalizedOsType {
  return process.platform === "win32" ? "windows" : "linux";
}

function normalizeOsType(osType?: "linux" | "windows" | "darwin"): NormalizedOsType {
  if (osType === "windows") {
    return "windows";
  }
  // Treat darwin as linux for our rule-platform purposes.
  return "linux";
}

const BUILTIN_RULES = loadBuiltinDestructiveRules();

export function detectDestructive(params: {
  toolName: string;
  command: string;
  blockedCommands?: string[];
  osType?: "linux" | "windows" | "darwin";
}): DestructiveMatch | undefined {
  const tool = (params.toolName || "").toLowerCase();
  if (tool !== "exec" && tool !== "bash") {
    return undefined;
  }
  const os = normalizeOsType(params.osType ?? (detectRuntimeOsType() as "linux" | "windows"));
  let fullCommand = (params.command || "").trim();
  if (!fullCommand) {
    return undefined;
  }

  // External domain / data exfiltration (internal allowlist exempt).
  // NOTE: this is OS-agnostic and runs before OS-specific destructive rules.
  const exfil = detectExternalDomainViolation(fullCommand, params.osType ?? os);
  if (exfil) {
    return exfil;
  }

  // Backward-compat: if blockedCommands are provided, allow them to short-circuit as critical.
  for (const pattern of params.blockedCommands ?? []) {
    if (!pattern) {
      continue;
    }
    try {
      const re = new RegExp(pattern, "i");
      if (re.test(fullCommand)) {
        return {
          category: "system_destructive",
          severity: "critical",
          rule: "config.blockedCommands",
          reason: `Command matched blockedCommands rule: ${pattern}`,
        };
      }
    } catch {
      // ignore invalid regex
    }
  }

  // OS-specific matching
  if (os === "windows") {
    return detectWindowsDestructive(fullCommand, [
      ...BUILTIN_RULES.common,
      ...BUILTIN_RULES.windows,
    ]);
  }
  return detectLinuxDestructive(fullCommand, [...BUILTIN_RULES.common, ...BUILTIN_RULES.linux]);
}
