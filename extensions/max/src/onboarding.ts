import type { ChannelOnboardingAdapter, OpenClawConfig, WizardPrompter } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId, promptAccountId } from "openclaw/plugin-sdk";
import { listMaxAccountIds, resolveDefaultMaxAccountId, resolveMaxAccount } from "./accounts.js";

const channel = "max" as const;

async function noteMaxSetup(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "1) Go to MAX → Settings → Bot Platform (or visit dev.max.ru)",
      "2) Create a bot and copy its token",
      "3) Set the token below or use MAX_BOT_TOKEN env var for the default account",
      "Note: bot publishing requires a verified Russian legal entity.",
      "Docs: https://docs.openclaw.ai/channels/max",
    ].join("\n"),
    "MAX bot token",
  );
}

export const maxOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,

  getStatus: async ({ cfg }) => {
    const configured = listMaxAccountIds(cfg).some((accountId) => {
      const account = resolveMaxAccount({ cfg, accountId });
      return Boolean(account.token);
    });
    return {
      channel,
      configured,
      statusLines: [`MAX: ${configured ? "configured" : "needs token"}`],
      selectionHint: configured ? "configured" : "needs setup",
      quickstartScore: configured ? 2 : 1,
    };
  },

  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds }) => {
    const override = (accountOverrides as Record<string, string | undefined>).max?.trim();
    const defaultAccountId = resolveDefaultMaxAccountId(cfg);
    let accountId = override ? normalizeAccountId(override) : defaultAccountId;
    if (shouldPromptAccountIds && !override) {
      accountId = await promptAccountId({
        cfg,
        prompter,
        label: "MAX",
        currentId: accountId,
        listAccountIds: listMaxAccountIds,
        defaultAccountId,
      });
    }

    let next = cfg;
    const resolvedAccount = resolveMaxAccount({ cfg: next, accountId });
    const accountConfigured = Boolean(resolvedAccount.token);
    const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
    const canUseEnv = allowEnv && Boolean(process.env.MAX_BOT_TOKEN?.trim());
    const hasConfigValues = Boolean(resolvedAccount.config.botToken);

    let botToken: string | null = null;

    if (!accountConfigured) {
      await noteMaxSetup(prompter);
    }

    if (canUseEnv && !hasConfigValues) {
      const keepEnv = await prompter.confirm({
        message: "MAX_BOT_TOKEN env var detected. Use it?",
        initialValue: true,
      });
      if (keepEnv) {
        next = applyMaxEnabled(next, accountId);
      } else {
        botToken = await promptToken(prompter);
      }
    } else if (accountConfigured) {
      const keep = await prompter.confirm({
        message: "MAX credentials already configured. Keep them?",
        initialValue: true,
      });
      if (!keep) {
        botToken = await promptToken(prompter);
      }
    } else {
      botToken = await promptToken(prompter);
    }

    if (botToken) {
      next = applyMaxToken(next, accountId, botToken);
    }

    return { cfg: next, accountId };
  },

  dmPolicy: {
    label: "MAX",
    channel,
    policyKey: "channels.max.dmPolicy",
    allowFromKey: "channels.max.allowFrom",
    getCurrent: (cfg) => {
      const maxCfg = (cfg.channels as Record<string, Record<string, unknown>> | undefined)?.max;
      return (maxCfg?.dmPolicy as "pairing" | "allowlist" | "open") ?? "pairing";
    },
    setPolicy: (cfg, policy) => ({
      ...cfg,
      channels: { ...cfg.channels, max: { ...(cfg.channels as any)?.max, dmPolicy: policy } },
    }),
  },

  disable: (cfg: OpenClawConfig) => ({
    ...cfg,
    channels: { ...cfg.channels, max: { ...(cfg.channels as any)?.max, enabled: false } },
  }),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function promptToken(prompter: WizardPrompter): Promise<string> {
  return String(
    await prompter.text({
      message: "Enter MAX bot token",
      validate: (value) => (value?.trim() ? undefined : "Required"),
    }),
  ).trim();
}

function applyMaxEnabled(cfg: OpenClawConfig, accountId: string): OpenClawConfig {
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...cfg,
      channels: { ...cfg.channels, max: { ...(cfg.channels as any)?.max, enabled: true } },
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      max: {
        ...(cfg.channels as any)?.max,
        enabled: true,
        accounts: {
          ...(cfg.channels as any)?.max?.accounts,
          [accountId]: {
            ...(cfg.channels as any)?.max?.accounts?.[accountId],
            enabled: true,
          },
        },
      },
    },
  };
}

function applyMaxToken(cfg: OpenClawConfig, accountId: string, token: string): OpenClawConfig {
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        max: { ...(cfg.channels as any)?.max, enabled: true, botToken: token },
      },
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      max: {
        ...(cfg.channels as any)?.max,
        enabled: true,
        accounts: {
          ...(cfg.channels as any)?.max?.accounts,
          [accountId]: {
            ...(cfg.channels as any)?.max?.accounts?.[accountId],
            enabled: true,
            botToken: token,
          },
        },
      },
    },
  };
}
