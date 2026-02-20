import {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
  formatPairingApproveHint,
  type ChannelPlugin,
  type OpenClawConfig,
} from "openclaw/plugin-sdk";
import { z } from "zod";
import {
  resolveDiscordUserAccount,
  listDiscordUserAccountIds,
  resolveDefaultDiscordUserAccountId,
  type ResolvedDiscordUserAccount,
} from "../../../src/discord-user/accounts.js";
import { monitorDiscordUserProvider } from "../../../src/discord-user/monitor/provider.js";
import { probeDiscordUser } from "../../../src/discord-user/probe.js";
import { createDiscordUserRestClient } from "../../../src/discord-user/rest.js";
import { sendDiscordUserMessage } from "../../../src/discord-user/send.js";
import { buildStealthFingerprint } from "../../../src/discord-user/stealth.js";
import { parseDiscordTarget } from "../../../src/discord/targets.js";
import { getDiscordUserRuntime } from "./runtime.js";

const DiscordUserConfigSchema = z.object({}).passthrough();

function loadConfig(): OpenClawConfig {
  return getDiscordUserRuntime().config.loadConfig();
}

function resolveOutboundTarget(
  to?: string,
): { ok: true; to: string } | { ok: false; error: Error } {
  const trimmed = to?.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: new Error(
        'Discord recipient is required. Use "channel:<id>" for channels or "user:<id>" for DMs.',
      ),
    };
  }
  // Normalize bare numeric IDs to channel: prefix to avoid ambiguity
  if (/^\d+$/.test(trimmed)) {
    return { ok: true, to: `channel:${trimmed}` };
  }
  return { ok: true, to: trimmed };
}

export const discordUserPlugin: ChannelPlugin<ResolvedDiscordUserAccount> = {
  id: "discord-user",
  meta: {
    id: "discord-user",
    label: "Discord (User)",
    selectionLabel: "Discord (User Account)",
    detailLabel: "Discord User",
    docsPath: "/channels/discord-user",
    docsLabel: "discord-user",
    blurb: "join servers as a user account — for communities that restrict bots.",
    systemImage: "bubble.left.and.bubble.right",
  },
  capabilities: {
    chatTypes: ["direct", "channel", "thread"],
    polls: false,
    reactions: false,
    threads: false,
    media: false,
    nativeCommands: false,
  },
  streaming: {
    blockStreamingCoalesceDefaults: { minChars: 1500, idleMs: 1000 },
  },
  reload: { configPrefixes: ["channels.discord-user"] },
  configSchema: buildChannelConfigSchema(DiscordUserConfigSchema),
  config: {
    listAccountIds: (cfg) => listDiscordUserAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveDiscordUserAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultDiscordUserAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "discord-user",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "discord-user",
        accountId,
        clearBaseFields: ["token", "name"],
      }),
    isConfigured: (account) => Boolean(account.token?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.token?.trim()),
      tokenSource: account.tokenSource,
    }),
    resolveAllowFrom: () => [],
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({ account }) => ({
      policy: (account.config.dmPolicy as "open" | "pairing" | "disabled") ?? "open",
      allowFrom: [],
      allowFromPath: `channels.discord-user.dm.`,
      approveHint: formatPairingApproveHint("discord-user"),
      normalizeEntry: (raw: string) => raw,
    }),
    collectWarnings: () => [],
  },
  mentions: {
    stripPatterns: () => ["<@!?\\d+>"],
  },
  threading: {
    resolveReplyToMode: () => "off",
  },
  messaging: {
    normalizeTarget: (raw: string) => {
      const target = parseDiscordTarget(raw, { defaultKind: "channel" });
      return target?.normalized;
    },
    targetResolver: {
      looksLikeId: (value: string) => /^\d{17,20}$/.test(value.trim()),
      hint: "<channelId|user:ID|channel:ID>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: null,
    textChunkLimit: 2000,
    resolveTarget: ({ to }) => resolveOutboundTarget(to),
    sendText: async ({ to, text, accountId, replyToId, silent }) => {
      const account = resolveDiscordUserAccount({
        cfg: loadConfig(),
        accountId,
      });
      const fingerprint = buildStealthFingerprint(account.config.stealth);
      const rest = createDiscordUserRestClient({
        token: account.token,
        fingerprint,
      });
      const result = await sendDiscordUserMessage(to, text, {
        rest,
        replyTo: replyToId ?? undefined,
        silent: silent ?? undefined,
      });
      return { channel: "discord-user" as const, ...result };
    },
    sendMedia: async ({ to, text, accountId, replyToId, silent }) => {
      // Media sending not yet supported in Phase 1 — send text only
      const account = resolveDiscordUserAccount({
        cfg: loadConfig(),
        accountId,
      });
      const fingerprint = buildStealthFingerprint(account.config.stealth);
      const rest = createDiscordUserRestClient({
        token: account.token,
        fingerprint,
      });
      const result = await sendDiscordUserMessage(to, text, {
        rest,
        replyTo: replyToId ?? undefined,
        silent: silent ?? undefined,
      });
      return { channel: "discord-user" as const, ...result };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      tokenSource: snapshot.tokenSource ?? "none",
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) => probeDiscordUser(account.token, timeoutMs),
    buildAccountSnapshot: ({ account, runtime, probe }) => {
      const configured = Boolean(account.token?.trim());
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        tokenSource: account.tokenSource,
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        bot: runtime?.bot ?? (probe as { user?: unknown })?.user ?? undefined,
        probe,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const token = account.token.trim();
      let userLabel = "";
      try {
        const probe = await probeDiscordUser(token, 2500);
        const username = probe.ok ? probe.user?.username?.trim() : null;
        if (username) {
          userLabel = ` (@${username})`;
        }
        ctx.setStatus({
          accountId: account.accountId,
          bot: probe.user,
        });
      } catch (err) {
        ctx.log?.debug?.(`[${account.accountId}] user probe failed: ${String(err)}`);
      }
      ctx.log?.info(`[${account.accountId}] starting discord-user provider${userLabel}`);
      return monitorDiscordUserProvider({
        token,
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
      });
    },
  },
};
