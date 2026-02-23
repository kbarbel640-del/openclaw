import type { FeishuToolsConfig, ResolvedFeishuAccount } from "./types.js";

/** Tool key used for per-account gating in execute phase. */
export type FeishuToolKey = keyof FeishuToolsConfig;

/**
 * Default tool configuration.
 * - doc, wiki, drive, scopes: enabled by default
 * - perm: disabled by default (sensitive operation)
 */
export const DEFAULT_TOOLS_CONFIG: Required<FeishuToolsConfig> = {
  doc: true,
  wiki: true,
  drive: true,
  perm: false,
  scopes: true,
};

/**
 * Resolve tools config with defaults.
 */
export function resolveToolsConfig(cfg?: FeishuToolsConfig): Required<FeishuToolsConfig> {
  return { ...DEFAULT_TOOLS_CONFIG, ...cfg };
}

/**
 * Merge tools configs from multiple accounts.
 * A tool is enabled if ANY account enables it (union strategy).
 * This ensures tools aren't silently disabled just because the
 * alphabetically-first account has them turned off.
 */
export function mergeToolsConfigs(
  configs: (FeishuToolsConfig | undefined)[],
): Required<FeishuToolsConfig> {
  const resolved = configs.map((c) => resolveToolsConfig(c));
  return {
    doc: resolved.some((c) => c.doc),
    wiki: resolved.some((c) => c.wiki),
    drive: resolved.some((c) => c.drive),
    perm: resolved.some((c) => c.perm),
    scopes: resolved.some((c) => c.scopes),
  };
}

/**
 * Check whether a specific tool is enabled for a resolved account.
 * Returns an error string if disabled, or undefined if allowed.
 */
export function assertToolEnabledForAccount(
  account: ResolvedFeishuAccount,
  tool: FeishuToolKey,
  toolName: string,
): string | undefined {
  const cfg = resolveToolsConfig(account.config.tools);
  if (!cfg[tool]) {
    return `${toolName} is disabled for account "${account.accountId}"`;
  }
  return undefined;
}
