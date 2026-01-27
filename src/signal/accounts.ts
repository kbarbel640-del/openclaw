import type { MoltbotConfig } from "../config/config.js";
import type { SignalAccountConfig } from "../config/types.js";
import { createAccountBase } from "../channels/accounts-base.js";
import { normalizeAccountId } from "../routing/session-key.js";

const base = createAccountBase<SignalAccountConfig>("signal");

export type ResolvedSignalAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  baseUrl: string;
  configured: boolean;
  config: SignalAccountConfig;
};

export const listSignalAccountIds = base.listAccountIds;
export const resolveDefaultSignalAccountId = base.resolveDefaultAccountId;

export function resolveSignalAccount(params: {
  cfg: MoltbotConfig;
  accountId?: string | null;
}): ResolvedSignalAccount {
  const accountId = normalizeAccountId(params.accountId);
  const merged = base.mergeAccountConfig(params.cfg, accountId);
  const enabled = base.isBaseEnabled(params.cfg) && merged.enabled !== false;
  const host = merged.httpHost?.trim() || "127.0.0.1";
  const port = merged.httpPort ?? 8080;
  const baseUrl = merged.httpUrl?.trim() || `http://${host}:${port}`;
  const configured = Boolean(
    merged.account?.trim() ||
    merged.httpUrl?.trim() ||
    merged.cliPath?.trim() ||
    merged.httpHost?.trim() ||
    typeof merged.httpPort === "number" ||
    typeof merged.autoStart === "boolean",
  );
  return {
    accountId,
    enabled,
    name: merged.name?.trim() || undefined,
    baseUrl,
    configured,
    config: merged,
  };
}

export function listEnabledSignalAccounts(cfg: MoltbotConfig): ResolvedSignalAccount[] {
  return base.listEnabledAccounts(cfg, resolveSignalAccount);
}
