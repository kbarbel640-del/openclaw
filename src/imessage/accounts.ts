import type { MoltbotConfig } from "../config/config.js";
import type { IMessageAccountConfig } from "../config/types.js";
import { createAccountBase } from "../channels/accounts-base.js";
import { normalizeAccountId } from "../routing/session-key.js";

const base = createAccountBase<IMessageAccountConfig>("imessage");

export type ResolvedIMessageAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  config: IMessageAccountConfig;
  configured: boolean;
};

export const listIMessageAccountIds = base.listAccountIds;
export const resolveDefaultIMessageAccountId = base.resolveDefaultAccountId;

export function resolveIMessageAccount(params: {
  cfg: MoltbotConfig;
  accountId?: string | null;
}): ResolvedIMessageAccount {
  const accountId = normalizeAccountId(params.accountId);
  const merged = base.mergeAccountConfig(params.cfg, accountId);
  const enabled = base.isBaseEnabled(params.cfg) && merged.enabled !== false;
  const configured = Boolean(
    merged.cliPath?.trim() ||
    merged.dbPath?.trim() ||
    merged.service ||
    merged.region?.trim() ||
    (merged.allowFrom && merged.allowFrom.length > 0) ||
    (merged.groupAllowFrom && merged.groupAllowFrom.length > 0) ||
    merged.dmPolicy ||
    merged.groupPolicy ||
    typeof merged.includeAttachments === "boolean" ||
    typeof merged.mediaMaxMb === "number" ||
    typeof merged.textChunkLimit === "number" ||
    (merged.groups && Object.keys(merged.groups).length > 0),
  );
  return {
    accountId,
    enabled,
    name: merged.name?.trim() || undefined,
    config: merged,
    configured,
  };
}

export function listEnabledIMessageAccounts(cfg: MoltbotConfig): ResolvedIMessageAccount[] {
  return base.listEnabledAccounts(cfg, resolveIMessageAccount);
}
