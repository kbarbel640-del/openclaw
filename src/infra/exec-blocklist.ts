/**
 * Command Execution Blocklist
 *
 * This module provides a security layer that blocks dangerous commands before
 * they reach the allowlist evaluation. Commands matching blocklist patterns
 * are ALWAYS blocked regardless of allowlist settings or elevated permissions.
 *
 * The blocklist is designed to prevent catastrophic system damage from
 * commands that should almost never be run via an AI assistant.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("exec").child("blocklist");

/** Result of blocklist evaluation */
export type BlocklistResult = {
  blocked: boolean;
  reason: string | null;
  matchedPatterns: string[];
  severity: "critical" | "high" | "medium" | null;
};

/** Blocklist entry with pattern and metadata */
type BlocklistEntry = {
  pattern: RegExp;
  description: string;
  severity: "critical" | "high" | "medium";
};

/**
 * CRITICAL: Commands that can cause catastrophic, irreversible system damage.
 * These are ALWAYS blocked without any override option.
 */
const CRITICAL_BLOCKLIST: BlocklistEntry[] = [
  // Destructive filesystem operations
  {
    pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?[/~]\s*$/i,
    description: "rm -rf / (root filesystem deletion)",
    severity: "critical",
  },
  {
    pattern: /\brm\s+(-[a-zA-Z]*[rf]+[a-zA-Z]*\s+)+\s*\/\s*$/i,
    description: "rm -rf / (root filesystem deletion)",
    severity: "critical",
  },
  {
    pattern: /\brm\s+(-[a-zA-Z]*[rf]+[a-zA-Z]*\s+)+\s*~\s*$/i,
    description: "rm -rf ~ (home directory deletion)",
    severity: "critical",
  },

  // Disk/filesystem destruction
  {
    pattern: /\bdd\s+.*\bof\s*=\s*\/dev\/(sd[a-z]|hd[a-z]|nvme\d+n\d+|disk\d+)\b/i,
    description: "dd to raw disk device",
    severity: "critical",
  },
  {
    pattern: /\bmkfs(\.[a-z0-9]+)?\s+.*\/dev\/(sd[a-z]|hd[a-z]|nvme\d+n\d+|disk\d+)/i,
    description: "mkfs on disk device (filesystem destruction)",
    severity: "critical",
  },
  {
    pattern: /\bfdisk\s+.*\/dev\/(sd[a-z]|hd[a-z]|nvme\d+n\d+|disk\d+)/i,
    description: "fdisk partition manipulation",
    severity: "critical",
  },
  {
    pattern: /\bparted\s+.*\/dev\/(sd[a-z]|hd[a-z]|nvme\d+n\d+|disk\d+)/i,
    description: "parted partition manipulation",
    severity: "critical",
  },

  // System control commands
  {
    pattern: /\b(halt|poweroff|reboot|shutdown)\b/i,
    description: "system halt/reboot command",
    severity: "critical",
  },
  {
    pattern: /\binit\s+[0-6]\b/i,
    description: "init runlevel change",
    severity: "critical",
  },
  {
    pattern: /\bsystemctl\s+(halt|poweroff|reboot|suspend|hibernate)\b/i,
    description: "systemctl power control",
    severity: "critical",
  },

  // Fork bomb patterns
  {
    pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    description: "fork bomb",
    severity: "critical",
  },
  {
    pattern: /\bwhile\s+true\s*;\s*do\s*:\s*;\s*done\s*&/i,
    description: "infinite loop fork",
    severity: "critical",
  },
];

/**
 * HIGH: Commands that can cause significant security issues or data loss.
 * These require explicit user approval.
 *
 * NOTE on sudo/privilege escalation:
 * - sudo is NOT blocked here because it's often legitimately needed
 * - RBAC enforces exec.elevated permission for sudo commands
 * - The isElevatedCommand() function in rbac.ts handles sudo detection
 * - Users with only "exec" permission (not "exec.elevated") cannot run sudo
 * - This provides a more flexible security model than blanket blocking
 */
const HIGH_BLOCKLIST: BlocklistEntry[] = [
  // Privilege escalation to root shell (always dangerous)
  {
    pattern: /\bsu\s+(-\s+)?root\b/i,
    description: "su to root",
    severity: "high",
  },

  // Credential manipulation
  {
    pattern: /\bpasswd\b/i,
    description: "passwd (password change)",
    severity: "high",
  },
  {
    pattern: /\bchpasswd\b/i,
    description: "chpasswd (bulk password change)",
    severity: "high",
  },
  {
    pattern: /\bvisudo\b/i,
    description: "visudo (sudoers modification)",
    severity: "high",
  },

  // Firewall and network security
  {
    pattern: /\biptables\s+/i,
    description: "iptables (firewall rules)",
    severity: "high",
  },
  {
    pattern: /\bip6tables\s+/i,
    description: "ip6tables (IPv6 firewall rules)",
    severity: "high",
  },
  {
    pattern: /\bnft\s+/i,
    description: "nftables (firewall rules)",
    severity: "high",
  },
  {
    pattern: /\bufw\s+(disable|reset|delete)/i,
    description: "ufw firewall disable/reset",
    severity: "high",
  },
  {
    pattern: /\bfirewall-cmd\s+/i,
    description: "firewalld manipulation",
    severity: "high",
  },

  // User/group manipulation
  {
    pattern: /\buseradd\b/i,
    description: "useradd (user creation)",
    severity: "high",
  },
  {
    pattern: /\buserdel\b/i,
    description: "userdel (user deletion)",
    severity: "high",
  },
  {
    pattern: /\busermod\b/i,
    description: "usermod (user modification)",
    severity: "high",
  },
  {
    pattern: /\bgroupadd\b/i,
    description: "groupadd (group creation)",
    severity: "high",
  },
  {
    pattern: /\bgroupdel\b/i,
    description: "groupdel (group deletion)",
    severity: "high",
  },

  // SSH key manipulation
  {
    pattern: /\bssh-keygen\s+.*(-[a-zA-Z]*f[a-zA-Z]*\s+)?~\/\.ssh\/(id_|authorized_keys)/i,
    description: "SSH key overwrite",
    severity: "high",
  },

  // Kernel/boot manipulation
  {
    pattern: /\bmodprobe\s+/i,
    description: "modprobe (kernel module loading)",
    severity: "high",
  },
  {
    pattern: /\binsmod\s+/i,
    description: "insmod (kernel module insertion)",
    severity: "high",
  },
  {
    pattern: /\brmmod\s+/i,
    description: "rmmod (kernel module removal)",
    severity: "high",
  },

  // Cron manipulation (persistence)
  {
    pattern: /\bcrontab\s+-[a-zA-Z]*e/i,
    description: "crontab edit",
    severity: "high",
  },

  // System config files
  {
    pattern: />\s*\/etc\/(passwd|shadow|sudoers|hosts|fstab|ssh)/i,
    description: "redirect to system config file",
    severity: "high",
  },

  // macOS specific
  {
    pattern: /\bcsrutil\s+(disable|enable)\b/i,
    description: "csrutil (SIP modification)",
    severity: "high",
  },
  {
    pattern: /\bspctl\s+/i,
    description: "spctl (Gatekeeper manipulation)",
    severity: "high",
  },
  {
    pattern: /\bdscl\s+.*-passwd/i,
    description: "dscl password change",
    severity: "high",
  },
];

/**
 * MEDIUM: Commands that should be reviewed but may have legitimate uses.
 * These log warnings but don't block by default.
 *
 * NOTE: Command substitution patterns ($() and backticks) are intentionally
 * omitted from this list. They create too many false positives when users
 * discuss shell syntax, share code examples, or include documentation.
 * Command substitution is only dangerous in the context of actual shell
 * execution, which is already gated by the exec permission system.
 */
const MEDIUM_BLOCKLIST: BlocklistEntry[] = [
  // eval is still flagged as it's explicitly used for code execution
  {
    pattern: /\beval\s+/i,
    description: "eval (arbitrary code execution)",
    severity: "medium",
  },

  // Network data exfiltration
  {
    pattern: /\bcurl\s+.*-[a-zA-Z]*d\s+/i,
    description: "curl POST data",
    severity: "medium",
  },
  {
    pattern: /\bwget\s+.*--post/i,
    description: "wget POST",
    severity: "medium",
  },

  // Process manipulation
  {
    pattern: /\bkillall\s+/i,
    description: "killall (mass process termination)",
    severity: "medium",
  },
  {
    pattern: /\bpkill\s+-9\s+/i,
    description: "pkill -9 (force kill)",
    severity: "medium",
  },

  // File permission changes
  {
    pattern: /\bchmod\s+777\s+/i,
    description: "chmod 777 (world-writable)",
    severity: "medium",
  },
  {
    pattern: /\bchmod\s+-[a-zA-Z]*R[a-zA-Z]*\s+/i,
    description: "chmod recursive",
    severity: "medium",
  },
  {
    pattern: /\bchown\s+-[a-zA-Z]*R[a-zA-Z]*\s+/i,
    description: "chown recursive",
    severity: "medium",
  },
];

/** Combined blocklist for evaluation */
const BLOCKLIST = [...CRITICAL_BLOCKLIST, ...HIGH_BLOCKLIST, ...MEDIUM_BLOCKLIST];

/**
 * Configuration for blocklist evaluation behavior.
 */
export type BlocklistConfig = {
  /** Block critical severity commands (default: true) */
  blockCritical: boolean;
  /** Block high severity commands (default: true) */
  blockHigh: boolean;
  /** Block medium severity commands (default: false, just warn) */
  blockMedium: boolean;
  /** Log all blocklist matches */
  logMatches: boolean;
};

const DEFAULT_BLOCKLIST_CONFIG: BlocklistConfig = {
  blockCritical: true,
  blockHigh: true,
  blockMedium: false,
  logMatches: true,
};

/**
 * Evaluates a command against the blocklist.
 * Returns whether the command should be blocked and why.
 */
export function evaluateBlocklist(
  command: string,
  config: Partial<BlocklistConfig> = {},
): BlocklistResult {
  const cfg = { ...DEFAULT_BLOCKLIST_CONFIG, ...config };
  const matchedPatterns: string[] = [];
  let highestSeverity: "critical" | "high" | "medium" | null = null;
  let blocked = false;
  let reason: string | null = null;

  for (const entry of BLOCKLIST) {
    if (entry.pattern.test(command)) {
      matchedPatterns.push(entry.description);

      // Track highest severity
      if (
        highestSeverity === null ||
        entry.severity === "critical" ||
        (entry.severity === "high" && highestSeverity !== "critical")
      ) {
        highestSeverity = entry.severity;
      }

      // Determine if we should block
      if (entry.severity === "critical" && cfg.blockCritical) {
        blocked = true;
        reason = `BLOCKED: ${entry.description} (critical severity)`;
      } else if (entry.severity === "high" && cfg.blockHigh) {
        blocked = true;
        reason = `BLOCKED: ${entry.description} (high severity)`;
      } else if (entry.severity === "medium" && cfg.blockMedium) {
        blocked = true;
        reason = `BLOCKED: ${entry.description} (medium severity)`;
      }
    }
  }

  // Log matches if configured
  if (cfg.logMatches && matchedPatterns.length > 0) {
    const logLevel = blocked ? "error" : highestSeverity === "medium" ? "warn" : "error";
    const preview = command.length > 80 ? command.slice(0, 80) + "..." : command;

    if (logLevel === "error") {
      log.error("Command blocklist match", {
        blocked,
        severity: highestSeverity,
        patterns: matchedPatterns,
        command: preview,
      });
    } else {
      log.warn("Command blocklist match", {
        blocked,
        severity: highestSeverity,
        patterns: matchedPatterns,
        command: preview,
      });
    }
  }

  return {
    blocked,
    reason,
    matchedPatterns,
    severity: highestSeverity,
  };
}

/**
 * Quick check if a command is on the blocklist (any severity).
 * Use evaluateBlocklist for full analysis.
 */
export function isOnBlocklist(command: string): boolean {
  return BLOCKLIST.some((entry) => entry.pattern.test(command));
}

/**
 * Returns a human-readable explanation of why a command was blocked.
 */
export function formatBlocklistReason(result: BlocklistResult): string {
  if (!result.blocked) {
    return "Command is allowed";
  }

  const lines = [
    `Command blocked due to security policy.`,
    `Severity: ${result.severity}`,
    `Matched patterns:`,
    ...result.matchedPatterns.map((p) => `  - ${p}`),
  ];

  if (result.severity === "critical") {
    lines.push("");
    lines.push("Critical severity commands cannot be approved and are always blocked.");
    lines.push("These commands can cause catastrophic, irreversible system damage.");
  } else if (result.severity === "high") {
    lines.push("");
    lines.push("High severity commands require explicit user approval.");
    lines.push("If you need to run this command, please do so directly in your terminal.");
  }

  return lines.join("\n");
}

/**
 * Get all blocklist patterns for documentation/display purposes.
 */
export function getBlocklistPatterns(): Array<{
  pattern: string;
  description: string;
  severity: "critical" | "high" | "medium";
}> {
  return BLOCKLIST.map((entry) => ({
    pattern: entry.pattern.source,
    description: entry.description,
    severity: entry.severity,
  }));
}
