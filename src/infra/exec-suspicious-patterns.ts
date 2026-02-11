import type { ExecAllowlistEntry, ExecCommandSegment } from "./exec-approvals.js";

// Patterns that indicate potentially dangerous command semantics.
// These are checked even when a command passes allowlist evaluation.
const SUSPICIOUS_PIPE_TARGETS = new Set(["sh", "bash", "zsh", "dash", "ksh", "csh", "fish"]);
const SUSPICIOUS_BINARIES = new Set(["eval", "exec", "source"]);
const SUSPICIOUS_CURL_PIPE_RE = /\b(curl|wget)\b.*\|\s*(sh|bash|zsh|dash|python|perl|ruby|node)\b/;
const SUSPICIOUS_ENV_OVERRIDE_RE =
  /\b(LD_PRELOAD|LD_LIBRARY_PATH|BASH_ENV|DYLD_INSERT_LIBRARIES)\s*=/;

export type SuspiciousPatternResult = {
  warnings: string[];
  blocked: boolean;
};

export function detectSuspiciousPatterns(
  command: string,
  segments: ExecCommandSegment[],
): SuspiciousPatternResult {
  const warnings: string[] = [];
  let blocked = false;

  // Check for curl/wget piped to shell — BLOCK (remote code execution).
  if (SUSPICIOUS_CURL_PIPE_RE.test(command)) {
    warnings.push(
      "[BLOCKED] Remote code execution pattern detected: output piped to shell interpreter",
    );
    blocked = true;
  }

  // Check for dangerous environment variable injection in command text — BLOCK.
  if (SUSPICIOUS_ENV_OVERRIDE_RE.test(command)) {
    warnings.push("[BLOCKED] Dangerous environment variable override detected in command");
    blocked = true;
  }

  for (const seg of segments) {
    const bin = seg.argv[0]?.toLowerCase() ?? "";
    const baseBin = bin.split("/").pop() ?? "";

    // Check for eval/exec/source as command — BLOCK.
    if (SUSPICIOUS_BINARIES.has(baseBin)) {
      warnings.push(`[BLOCKED] Suspicious command: "${baseBin}" can execute arbitrary code`);
      blocked = true;
    }

    // Check if a pipe targets a shell interpreter — WARN (non-remote source).
    if (segments.length > 1 && SUSPICIOUS_PIPE_TARGETS.has(baseBin) && seg !== segments[0]) {
      warnings.push(`Pipeline feeds into shell interpreter "${baseBin}"`);
    }
  }

  return { warnings, blocked };
}

/** Map suspicious pattern result to the fields used in ExecAllowlistAnalysis. */
export function evaluateSuspiciousPatterns(command: string, segments: ExecCommandSegment[]) {
  const s = detectSuspiciousPatterns(command, segments);
  return { securityWarnings: s.warnings, securityBlocked: s.blocked };
}

export type ExecAllowlistAnalysis = {
  analysisOk: boolean;
  allowlistSatisfied: boolean;
  allowlistMatches: ExecAllowlistEntry[];
  segments: ExecCommandSegment[];
  securityWarnings: string[];
  securityBlocked: boolean;
};

export const ANALYSIS_FAILED: ExecAllowlistAnalysis = {
  analysisOk: false,
  allowlistSatisfied: false,
  allowlistMatches: [],
  segments: [],
  securityWarnings: [],
  securityBlocked: false,
};
