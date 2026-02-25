import type { OpenClawConfig } from "../../config/config.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../../routing/session-key.js";
import type { ChannelSetupInput } from "./types.core.js";

type ChannelSectionBase = {
  name?: string;
  accounts?: Record<string, Record<string, unknown>>;
};

function channelHasAccounts(cfg: OpenClawConfig, channelKey: string): boolean {
  const channels = cfg.channels as Record<string, unknown> | undefined;
  const base = channels?.[channelKey] as ChannelSectionBase | undefined;
  return Boolean(base?.accounts && Object.keys(base.accounts).length > 0);
}

function shouldStoreNameInAccounts(params: {
  cfg: OpenClawConfig;
  channelKey: string;
  accountId: string;
  alwaysUseAccounts?: boolean;
}): boolean {
  if (params.alwaysUseAccounts) {
    return true;
  }
  if (params.accountId !== DEFAULT_ACCOUNT_ID) {
    return true;
  }
  return channelHasAccounts(params.cfg, params.channelKey);
}

export function applyAccountNameToChannelSection(params: {
  cfg: OpenClawConfig;
  channelKey: string;
  accountId: string;
  name?: string;
  alwaysUseAccounts?: boolean;
}): OpenClawConfig {
  const trimmed = params.name?.trim();
  if (!trimmed) {
    return params.cfg;
  }
  const accountId = normalizeAccountId(params.accountId);
  const channels = params.cfg.channels as Record<string, unknown> | undefined;
  const baseConfig = channels?.[params.channelKey];
  const base =
    typeof baseConfig === "object" && baseConfig ? (baseConfig as ChannelSectionBase) : undefined;
  const useAccounts = shouldStoreNameInAccounts({
    cfg: params.cfg,
    channelKey: params.channelKey,
    accountId,
    alwaysUseAccounts: params.alwaysUseAccounts,
  });
  if (!useAccounts && accountId === DEFAULT_ACCOUNT_ID) {
    const safeBase = base ?? {};
    return {
      ...params.cfg,
      channels: {
        ...params.cfg.channels,
        [params.channelKey]: {
          ...safeBase,
          name: trimmed,
        },
      },
    } as OpenClawConfig;
  }
  const baseAccounts: Record<string, Record<string, unknown>> = base?.accounts ?? {};
  const existingAccount = baseAccounts[accountId] ?? {};
  const baseWithoutName =
    accountId === DEFAULT_ACCOUNT_ID
      ? (({ name: _ignored, ...rest }) => rest)(base ?? {})
      : (base ?? {});
  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      [params.channelKey]: {
        ...baseWithoutName,
        accounts: {
          ...baseAccounts,
          [accountId]: {
            ...existingAccount,
            name: trimmed,
          },
        },
      },
    },
  } as OpenClawConfig;
}

export function migrateBaseNameToDefaultAccount(params: {
  cfg: OpenClawConfig;
  channelKey: string;
  alwaysUseAccounts?: boolean;
}): OpenClawConfig {
  if (params.alwaysUseAccounts) {
    return params.cfg;
  }
  const channels = params.cfg.channels as Record<string, unknown> | undefined;
  const base = channels?.[params.channelKey] as ChannelSectionBase | undefined;
  const baseName = base?.name?.trim();
  if (!baseName) {
    return params.cfg;
  }
  const accounts: Record<string, Record<string, unknown>> = {
    ...base?.accounts,
  };
  const defaultAccount = accounts[DEFAULT_ACCOUNT_ID] ?? {};
  if (!defaultAccount.name) {
    accounts[DEFAULT_ACCOUNT_ID] = { ...defaultAccount, name: baseName };
  }
  const { name: _ignored, ...rest } = base ?? {};
  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      [params.channelKey]: {
        ...rest,
        accounts,
      },
    },
  } as OpenClawConfig;
}

/**
 * Creates a standard `applyAccountConfig` implementation for channel plugins.
 *
 * Most channels follow the same scaffolding: apply account name, migrate base
 * name for sub-accounts, then spread channel-specific fields into the config.
 * This factory extracts that boilerplate so each channel only provides the
 * channel key and a function mapping setup input to config fields.
 */
export function createApplyAccountConfig(params: {
  channelKey: string;
  alwaysUseAccounts?: boolean;
  mapInputToFields: (input: ChannelSetupInput) => Record<string, unknown>;
}): (ctx: { cfg: OpenClawConfig; accountId: string; input: ChannelSetupInput }) => OpenClawConfig {
  const { channelKey, alwaysUseAccounts } = params;
  return ({ cfg, accountId, input }) => {
    const namedConfig = applyAccountNameToChannelSection({
      cfg,
      channelKey,
      accountId,
      name: input.name,
      alwaysUseAccounts,
    });
    const next = alwaysUseAccounts
      ? migrateBaseNameToDefaultAccount({
          cfg: namedConfig,
          channelKey,
          alwaysUseAccounts: true,
        })
      : accountId !== DEFAULT_ACCOUNT_ID
        ? migrateBaseNameToDefaultAccount({ cfg: namedConfig, channelKey })
        : namedConfig;
    const fields = params.mapInputToFields(input);
    const channels = next.channels as Record<string, Record<string, unknown>> | undefined;
    const base = channels?.[channelKey];
    if (accountId === DEFAULT_ACCOUNT_ID && !alwaysUseAccounts) {
      return {
        ...next,
        channels: {
          ...next.channels,
          [channelKey]: {
            ...base,
            enabled: true,
            ...fields,
          },
        },
      } as OpenClawConfig;
    }
    const accounts = base?.accounts as Record<string, Record<string, unknown>> | undefined;
    return {
      ...next,
      channels: {
        ...next.channels,
        [channelKey]: {
          ...base,
          enabled: true,
          accounts: {
            ...accounts,
            [accountId]: {
              ...accounts?.[accountId],
              enabled: true,
              ...fields,
            },
          },
        },
      },
    } as OpenClawConfig;
  };
}
