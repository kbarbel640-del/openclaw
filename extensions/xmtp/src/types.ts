import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { privateKeyToAccount } from "viem/accounts";

export interface XmtpAccountConfig {
  enabled?: boolean;
  name?: string;
  walletKey?: string;
  dbEncryptionKey?: string;
  env?: "local" | "dev" | "production";
  dbPath?: string;
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: string[];
}

export interface ResolvedXmtpAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  walletKey: string;
  dbEncryptionKey: string;
  address: string;
  env: "local" | "dev" | "production";
  config: XmtpAccountConfig;
}

const DEFAULT_ACCOUNT_ID = "default";
const DEFAULT_ENV = "production" as const;

function deriveAddressFromKey(walletKey: string): string {
  try {
    const account = privateKeyToAccount(walletKey as `0x${string}`);
    return account.address.toLowerCase();
  } catch {
    return "";
  }
}

export function listXmtpAccountIds(cfg: OpenClawConfig): string[] {
  const xmtpCfg = (cfg.channels as Record<string, unknown> | undefined)?.xmtp as
    | XmtpAccountConfig
    | undefined;

  if (xmtpCfg?.walletKey) {
    return [DEFAULT_ACCOUNT_ID];
  }

  return [];
}

export function resolveDefaultXmtpAccountId(cfg: OpenClawConfig): string {
  const ids = listXmtpAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

export function resolveXmtpAccount(opts: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedXmtpAccount {
  const accountId = opts.accountId ?? DEFAULT_ACCOUNT_ID;
  const xmtpCfg = (opts.cfg.channels as Record<string, unknown> | undefined)?.xmtp as
    | XmtpAccountConfig
    | undefined;

  const baseEnabled = xmtpCfg?.enabled !== false;
  const walletKey = xmtpCfg?.walletKey ?? "";
  const dbEncryptionKey = xmtpCfg?.dbEncryptionKey ?? "";
  const configured = Boolean(walletKey.trim() && dbEncryptionKey.trim());

  let address = "";
  if (configured) {
    address = deriveAddressFromKey(walletKey);
  }

  return {
    accountId,
    name: xmtpCfg?.name?.trim() || undefined,
    enabled: baseEnabled,
    configured,
    walletKey,
    dbEncryptionKey,
    address,
    env: xmtpCfg?.env ?? DEFAULT_ENV,
    config: {
      enabled: xmtpCfg?.enabled,
      name: xmtpCfg?.name,
      walletKey: xmtpCfg?.walletKey,
      dbEncryptionKey: xmtpCfg?.dbEncryptionKey,
      env: xmtpCfg?.env,
      dbPath: xmtpCfg?.dbPath,
      dmPolicy: xmtpCfg?.dmPolicy,
      allowFrom: xmtpCfg?.allowFrom,
    },
  };
}
