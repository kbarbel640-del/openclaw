/**
 * GitHub 2FA Extension Configuration
 */

export type TwoFactorConfig = {
  clientId?: string;
  tokenTtlMinutes?: number;
  sensitiveTools?: string[];
  gateAllTools?: boolean;
  /** Paths where 'read' tool is allowed without 2FA (prefix match) */
  readAllowPaths?: string[];
  /** Paths where 'write'/'edit' tools are allowed without 2FA (prefix match) */
  writeAllowPaths?: string[];
};

const DEFAULT_SENSITIVE_TOOLS = ["exec", "Bash", "Write", "Edit", "NotebookEdit"];
const DEFAULT_TTL_MINUTES = 30;

export function parseConfig(value: unknown): TwoFactorConfig {
  if (!value || typeof value !== "object") return {};
  const cfg = value as Record<string, unknown>;
  return {
    clientId: typeof cfg.clientId === "string" ? cfg.clientId : undefined,
    tokenTtlMinutes:
      typeof cfg.tokenTtlMinutes === "number" ? cfg.tokenTtlMinutes : DEFAULT_TTL_MINUTES,
    sensitiveTools: Array.isArray(cfg.sensitiveTools)
      ? cfg.sensitiveTools.filter((t): t is string => typeof t === "string")
      : DEFAULT_SENSITIVE_TOOLS,
    gateAllTools: typeof cfg.gateAllTools === "boolean" ? cfg.gateAllTools : false,
    readAllowPaths: Array.isArray(cfg.readAllowPaths)
      ? cfg.readAllowPaths.filter((p): p is string => typeof p === "string")
      : undefined,
    writeAllowPaths: Array.isArray(cfg.writeAllowPaths)
      ? cfg.writeAllowPaths.filter((p): p is string => typeof p === "string")
      : undefined,
  };
}

export const twoFactorConfigSchema = {
  parse: parseConfig,
  uiHints: {
    clientId: {
      label: "GitHub OAuth App Client ID",
      placeholder: "Ov23xxxxxxxxxxxxxxxxxx",
      help: "Create at GitHub Settings > Developer Settings > OAuth Apps (enable Device Flow)",
    },
    tokenTtlMinutes: {
      label: "Session TTL (minutes)",
      placeholder: "30",
      help: "How long before re-authentication is required",
      sensitive: true,
    },
    sensitiveTools: {
      label: "Sensitive Tools",
      help: "Tool names requiring 2FA (default: Bash, Write, Edit, NotebookEdit)",
    },
    gateAllTools: {
      label: "Gate All Tools",
      help: "Require 2FA for all tools, not just sensitive ones",
    },
    readAllowPaths: {
      label: "Read Allow Paths",
      help: "Paths where 'read' is allowed without 2FA (prefix match, e.g. /root/clawd/)",
    },
    writeAllowPaths: {
      label: "Write Allow Paths",
      help: "Paths where 'write'/'edit' are allowed without 2FA (prefix match, e.g. /root/clawd/)",
    },
  },
};
