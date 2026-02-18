import { formatCliCommand } from "../../../cli/command-format.js";
import type { OpenClawConfig } from "../../../config/config.js";
import { DEFAULT_ACCOUNT_ID } from "../../../routing/session-key.js";
import {
  listTelegramAccountIds,
  resolveDefaultTelegramAccountId,
  resolveTelegramAccount,
} from "../../../telegram/accounts.js";
import { formatDocsLink } from "../../../terminal/links.js";
import type { WizardPrompter } from "../../../wizard/prompts.js";
import { fetchTelegramChatId } from "../../telegram/api.js";
import type { ChannelOnboardingAdapter, ChannelOnboardingDmPolicy } from "../onboarding-types.js";
import {
  applySingleTokenPromptResult,
  patchChannelConfigForAccount,
  promptSingleChannelToken,
  resolveAccountIdForConfigure,
  resolveOnboardingAccountId,
  setChannelDmPolicyWithAllowFrom,
  setOnboardingChannelEnabled,
} from "./helpers.js";

const channel = "telegram" as const;

async function noteTelegramTokenHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "1) Open Telegram and chat with @BotFather",
      "2) Run /newbot (or /mybots)",
      "3) Copy the token (looks like 123456:ABC...)",
      "Tip: you can also set TELEGRAM_BOT_TOKEN in your env.",
      `Docs: ${formatDocsLink("/telegram")}`,
      "Website: https://openclaw.ai",
    ].join("\n"),
    "Telegram bot token",
  );
}

async function noteTelegramUserIdHelp(prompter: WizardPrompter, apiRoot: string): Promise<void> {
  const isCustomApi = apiRoot !== "https://api.telegram.org";
  await prompter.note(
    [
      `1) DM your bot, then read from.id in \`${formatCliCommand("openclaw logs --follow")}\` (safest)`,
      `2) Or call ${apiRoot}/bot<bot_token>/getUpdates and read message.from.id`,
      "3) Third-party: DM @userinfobot or @getidsbot" +
        (isCustomApi ? " (only works on official Telegram)" : ""),
      `Docs: ${formatDocsLink("/telegram")}`,
      "Website: https://openclaw.ai",
    ].join("\n"),
    "Telegram user id",
  );
}

export function normalizeTelegramAllowFromInput(raw: string): string {
  return raw
    .trim()
    .replace(/^(telegram|tg):/i, "")
    .trim();
}

export function parseTelegramAllowFromId(raw: string): string | null {
  const stripped = normalizeTelegramAllowFromInput(raw);
  return /^\d+$/.test(stripped) ? stripped : null;
}

async function promptTelegramAllowFrom(params: {
  cfg: OpenClawConfig;
  prompter: WizardPrompter;
  accountId: string;
}): Promise<OpenClawConfig> {
  const { cfg, prompter, accountId } = params;
  const resolved = resolveTelegramAccount({ cfg, accountId });
  const existingAllowFrom = resolved.config.allowFrom ?? [];
  await noteTelegramUserIdHelp(prompter, resolved.apiRoot);

  const token = resolved.token;
  if (!token) {
    await prompter.note("Telegram token missing; username lookup is unavailable.", "Telegram");
  }

  const resolveTelegramUserId = async (raw: string): Promise<string | null> => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    const stripped = trimmed.replace(/^(telegram|tg):/i, "").trim();
    if (/^\d+$/.test(stripped)) {
      return stripped;
    }
    if (!token) {
      return null;
    }
    const username = stripped.startsWith("@") ? stripped : `@${stripped}`;
    return await fetchTelegramChatId({
      token,
      chatId: username,
      apiRoot: resolved.apiRoot,
    });
  };

  const parseInput = (value: string) =>
    value
      .split(/[\n,;]+/g)
      .map((entry) => entry.trim())
      .filter(Boolean);

  let resolvedIds: string[] = [];
  while (resolvedIds.length === 0) {
    const entry = await prompter.text({
      message: "Telegram allowFrom (numeric sender id; @username resolves to id)",
      placeholder: "@username",
      initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : undefined,
      validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
    });
    const parts = parseInput(String(entry));
    const results = await Promise.all(parts.map((part) => resolveTelegramUserId(part)));
    const unresolved = parts.filter((_, idx) => !results[idx]);
    if (unresolved.length > 0) {
      await prompter.note(
        `Could not resolve: ${unresolved.join(", ")}. Use @username or numeric id.`,
        "Telegram allowlist",
      );
      continue;
    }
    resolvedIds = results.filter((id): id is string => id !== null);
  }

  return patchChannelConfigForAccount({
    cfg,
    channel: "telegram",
    accountId,
    patch: { dmPolicy: "allowlist", allowFrom: resolvedIds },
  });
}

async function promptTelegramAllowFromForAccount(params: {
  cfg: OpenClawConfig;
  prompter: WizardPrompter;
  accountId?: string;
}): Promise<OpenClawConfig> {
  const accountId = resolveOnboardingAccountId({
    accountId: params.accountId,
    defaultAccountId: resolveDefaultTelegramAccountId(params.cfg),
  });
  return promptTelegramAllowFrom({
    cfg: params.cfg,
    prompter: params.prompter,
    accountId,
  });
}

const dmPolicy: ChannelOnboardingDmPolicy = {
  label: "Telegram",
  channel,
  policyKey: "channels.telegram.dmPolicy",
  allowFromKey: "channels.telegram.allowFrom",
  getCurrent: (cfg) => cfg.channels?.telegram?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) =>
    setChannelDmPolicyWithAllowFrom({
      cfg,
      channel: "telegram",
      dmPolicy: policy,
    }),
  promptAllowFrom: promptTelegramAllowFromForAccount,
};

export const telegramOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const configured = listTelegramAccountIds(cfg).some((accountId) =>
      Boolean(resolveTelegramAccount({ cfg, accountId }).token),
    );
    return {
      channel,
      configured,
      statusLines: [`Telegram: ${configured ? "configured" : "needs token"}`],
      selectionHint: configured ? "recommended · configured" : "recommended · newcomer-friendly",
      quickstartScore: configured ? 1 : 10,
    };
  },
  configure: async ({
    cfg,
    prompter,
    accountOverrides,
    shouldPromptAccountIds,
    forceAllowFrom,
  }) => {
    const defaultTelegramAccountId = resolveDefaultTelegramAccountId(cfg);
    const telegramAccountId = await resolveAccountIdForConfigure({
      cfg,
      prompter,
      label: "Telegram",
      accountOverride: accountOverrides.telegram,
      shouldPromptAccountIds,
      listAccountIds: listTelegramAccountIds,
      defaultAccountId: defaultTelegramAccountId,
    });

    let next = cfg;
    const resolvedAccount = resolveTelegramAccount({
      cfg: next,
      accountId: telegramAccountId,
    });
    const accountConfigured = Boolean(resolvedAccount.token);
    const allowEnv = telegramAccountId === DEFAULT_ACCOUNT_ID;
    const canUseEnv =
      allowEnv &&
      !resolvedAccount.config.botToken &&
      Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
    const hasConfigToken = Boolean(
      resolvedAccount.config.botToken || resolvedAccount.config.tokenFile,
    );

    if (!accountConfigured) {
      await noteTelegramTokenHelp(prompter);
    }

    const tokenResult = await promptSingleChannelToken({
      prompter,
      accountConfigured,
      canUseEnv,
      hasConfigToken,
      envPrompt: "TELEGRAM_BOT_TOKEN detected. Use env var?",
      keepPrompt: "Telegram token already configured. Keep it?",
      inputPrompt: "Enter Telegram bot token",
    });

    next = applySingleTokenPromptResult({
      cfg: next,
      channel: "telegram",
      accountId: telegramAccountId,
      tokenPatchKey: "botToken",
      tokenResult,
    });

    if (forceAllowFrom) {
      next = await promptTelegramAllowFrom({
        cfg: next,
        prompter,
        accountId: telegramAccountId,
      });
    }

    return { cfg: next, accountId: telegramAccountId };
  },
  dmPolicy,
  disable: (cfg) => setOnboardingChannelEnabled(cfg, channel, false),
};
