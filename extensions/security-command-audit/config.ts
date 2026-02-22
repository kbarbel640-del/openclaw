import type { DetectionPlatform, DetectionRule, Severity } from "./destructive/detector.js";
import type { ExternalDomainRulesCompiled } from "./rules/rules-loader.js";
import {
  loadBuiltinDestructiveRules,
  loadBuiltinExternalDomainRules,
} from "./rules/rules-loader.js";

export type AuditAction = "pass" | "ask" | "block";

export type RegexSpec = { pattern: string; flags?: string };
export type JsonRule = Omit<DetectionRule, "regex" | "platform"> & {
  platform?: DetectionPlatform;
  regex: RegexSpec;
};

export type PluginConfig = {
  /** Param name for explicit confirm flag (default: "_sec_confirm"). */
  confirmFlag?: string;
  /**
   * How to handle `ask` decisions:
   * - confirm-flag: block and ask the user, then re-run with `confirmFlag=true`
   * - exec-approvals: rewrite exec params to host=gateway|node with ask=always (requires tools.exec.host to allow it)
   */
  askStrategy?: "confirm-flag" | "exec-approvals";
  execApprovals?: {
    host?: "gateway" | "node";
    security?: "deny" | "allowlist" | "full";
    ask?: "off" | "on-miss" | "always";
    node?: string;
  };
  policy?: {
    severityActions?: Partial<Record<Severity, AuditAction>>;
  };
  rules?: {
    destructive?: {
      /** How to combine built-in JSON rules with overrides. */
      mode?: "builtin" | "prepend" | "append" | "replace";
      common?: JsonRule[];
      linux?: JsonRule[];
      windows?: JsonRule[];
    };
    externalDomain?: {
      /** Override internal allowlist regex SOURCE (anchored with ^). */
      internalAllowlistSource?: string;
    };
  };
};

export type CompiledPluginConfig = {
  confirmFlag: string;
  askStrategy: "confirm-flag" | "exec-approvals";
  execApprovals: Required<NonNullable<PluginConfig["execApprovals"]>>;
  severityActions: Record<Severity, AuditAction>;
  linuxRules: DetectionRule[];
  windowsRules: DetectionRule[];
  externalDomainRules: ExternalDomainRulesCompiled;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function coerceString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function coerceEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim() as T;
  return allowed.includes(v) ? v : undefined;
}

function compileRegex(spec: RegexSpec, hint: string): RegExp {
  const pattern = spec.pattern ?? "";
  const flags = spec.flags ?? "i";
  try {
    return new RegExp(pattern, flags);
  } catch (err) {
    throw new Error(`[security-command-audit] invalid regex (${hint}): ${String(err)}`);
  }
}

function normalizePlatform(value: unknown): DetectionPlatform {
  if (value === "all" || value === "linux" || value === "windows") {
    return value;
  }
  return "all";
}

function compileRules(rules: JsonRule[] | undefined): DetectionRule[] {
  if (!Array.isArray(rules) || rules.length === 0) {
    return [];
  }
  return rules.map((r) => ({
    rule: r.rule,
    category: r.category,
    severity: r.severity,
    reason: r.reason,
    platform: normalizePlatform(r.platform),
    regex: compileRegex(r.regex, r.rule),
  }));
}

function mergeRules(params: {
  builtin: DetectionRule[];
  override: DetectionRule[];
  mode: "builtin" | "prepend" | "append" | "replace";
}): DetectionRule[] {
  if (params.mode === "replace") return params.override;
  if (params.mode === "prepend") return [...params.override, ...params.builtin];
  if (params.mode === "append") return [...params.builtin, ...params.override];
  return params.builtin;
}

export function compilePluginConfig(pluginConfig: unknown): CompiledPluginConfig {
  const cfg: PluginConfig = isPlainObject(pluginConfig) ? (pluginConfig as PluginConfig) : {};

  const confirmFlag = (cfg.confirmFlag ?? "_sec_confirm").trim() || "_sec_confirm";
  const askStrategy = cfg.askStrategy ?? "confirm-flag";

  const execApprovals = {
    host: cfg.execApprovals?.host ?? "node",
    security: cfg.execApprovals?.security ?? "allowlist",
    ask: cfg.execApprovals?.ask ?? "always",
    node: cfg.execApprovals?.node ?? "",
  } as const;

  const severityActions: Record<Severity, AuditAction> = {
    violation: "block",
    critical: "ask",
    high: "ask",
    medium: "ask",
    low: "pass",
    ...cfg.policy?.severityActions,
  };

  const builtin = loadBuiltinDestructiveRules();
  const destructiveMode = cfg.rules?.destructive?.mode ?? "builtin";
  const overrideCommon = compileRules(cfg.rules?.destructive?.common);
  const overrideLinux = compileRules(cfg.rules?.destructive?.linux);
  const overrideWindows = compileRules(cfg.rules?.destructive?.windows);

  const common = mergeRules({
    builtin: builtin.common,
    override: overrideCommon,
    mode: destructiveMode,
  });
  const linux = mergeRules({
    builtin: builtin.linux,
    override: overrideLinux,
    mode: destructiveMode,
  });
  const windows = mergeRules({
    builtin: builtin.windows,
    override: overrideWindows,
    mode: destructiveMode,
  });

  const externalBuiltin = loadBuiltinExternalDomainRules();
  const internalAllowlistSource =
    coerceString(cfg.rules?.externalDomain?.internalAllowlistSource) ??
    externalBuiltin.internalAllowlistSource;
  const externalDomainRules: ExternalDomainRulesCompiled = {
    ...externalBuiltin,
    internalAllowlistSource,
    internalHostRe: compileRegex(
      { pattern: `^${internalAllowlistSource}`, flags: "i" },
      "internalAllowlist",
    ),
  };

  return {
    confirmFlag,
    askStrategy,
    execApprovals: {
      host: execApprovals.host,
      security: execApprovals.security,
      ask: execApprovals.ask,
      node: execApprovals.node,
    },
    severityActions,
    linuxRules: [...common, ...linux],
    windowsRules: [...common, ...windows],
    externalDomainRules,
  };
}
