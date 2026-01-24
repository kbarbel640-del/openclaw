/**
 * Twitch channel plugin for Clawdbot.
 *
 * Main plugin export combining all adapters (outbound, actions, status, gateway).
 * This is the primary entry point for the Twitch channel integration.
 */

import { checkTwitchAccessControl } from "./access-control.js";
import { resolveAgentRoute } from "../../../src/routing/resolve-route.js";
import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import { buildChannelConfigSchema } from "clawdbot/plugin-sdk";
import { twitchMessageActions } from "./actions.js";
import { TwitchConfigSchema } from "./config-schema.js";
import {
  DEFAULT_ACCOUNT_ID,
  getAccountConfig,
  listAccountIds,
} from "./config.js";
import { twitchOnboardingAdapter } from "./onboarding.js";
import { twitchOutbound } from "./outbound.js";
import { probeTwitch } from "./probe.js";
import { resolveTwitchTargets } from "./resolver.js";
import { collectTwitchStatusIssues } from "./status.js";
import {
  getOrCreateClientManager,
  removeClientManager,
} from "./client-manager-registry.js";
import type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelLogSink,
  ChannelMeta,
  ChannelPlugin,
  ChannelResolveKind,
  ChannelResolveResult,
  TwitchAccountConfig,
} from "./types.js";

/**
 * Check if an account is properly configured.
 */
function isConfigured(
  account: TwitchAccountConfig | null | undefined,
): boolean {
  return Boolean(account?.token && account?.username && account?.clientId);
}

/**
 * Twitch channel plugin.
 *
 * Implements the ChannelPlugin interface to provide Twitch chat integration
 * for Clawdbot. Supports message sending, receiving, access control, and
 * status monitoring.
 */
export const twitchPlugin: ChannelPlugin<TwitchAccountConfig> = {
  /** Plugin identifier */
  id: "twitch",

  /** Plugin metadata */
  meta: {
    id: "twitch",
    label: "Twitch",
    selectionLabel: "Twitch (Chat)",
    docsPath: "/channels/twitch",
    blurb: "Twitch chat integration",
    aliases: ["twitch-chat"],
  } satisfies ChannelMeta,

  /** Onboarding adapter */
  onboarding: twitchOnboardingAdapter,

  /** Pairing configuration */
  pairing: {
    idLabel: "twitchUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(twitch:)?user:?/i, ""),
    notifyApproval: async ({ id }) => {
      // Note: Twitch doesn't support DMs from bots, so pairing approval is limited
      // We'll log the approval instead
      console.warn(`[twitch] Pairing approved for user ${id} (notification sent via chat if possible)`);
    },
  },

  /** Supported chat capabilities */
  capabilities: {
    chatTypes: ["group", "direct"],
  } satisfies ChannelCapabilities,

  /** Configuration schema for Twitch channel */
  configSchema: buildChannelConfigSchema(TwitchConfigSchema),

  /** Account configuration management */
  config: {
    /** List all configured account IDs */
    listAccountIds: (cfg: ClawdbotConfig): string[] => listAccountIds(cfg),

    /** Resolve an account config by ID */
    resolveAccount: (
      cfg: ClawdbotConfig,
      accountId?: string | null,
    ): TwitchAccountConfig => {
      const account = getAccountConfig(cfg, accountId ?? DEFAULT_ACCOUNT_ID);
      if (!account) {
        // Return a default/empty account if not configured
        return {
          username: "",
          token: "",
          clientId: "",
          enabled: false,
        } as TwitchAccountConfig;
      }
      return account;
    },

    /** Get the default account ID */
    defaultAccountId: (): string => DEFAULT_ACCOUNT_ID,

    /** Check if an account is configured */
    isConfigured: (_account: unknown, cfg: ClawdbotConfig): boolean => {
      const account = getAccountConfig(cfg, DEFAULT_ACCOUNT_ID);
      return isConfigured(account);
    },

    /** Check if an account is enabled */
    isEnabled: (account: TwitchAccountConfig | undefined): boolean =>
      account?.enabled !== false,

    /** Describe account status */
    describeAccount: (account: TwitchAccountConfig | undefined) => ({
      accountId: DEFAULT_ACCOUNT_ID,
      enabled: account?.enabled !== false,
      configured: account ? isConfigured(account) : false,
    }),
  },

  /** Outbound message adapter */
  outbound: twitchOutbound,

  /** Message actions adapter */
  actions: twitchMessageActions,

  /** Resolver adapter for username -> user ID resolution */
  resolver: {
    resolveTargets: async ({
      cfg,
      accountId,
      inputs,
      kind,
      runtime,
    }: {
      cfg: ClawdbotConfig;
      accountId?: string | null;
      inputs: string[];
      kind: ChannelResolveKind;
      runtime: import("../../../src/runtime.js").RuntimeEnv;
    }): Promise<ChannelResolveResult[]> => {
      const account = getAccountConfig(cfg, accountId ?? DEFAULT_ACCOUNT_ID);

      if (!account) {
        return inputs.map((input) => ({
          input,
          resolved: false,
          note: "account not configured",
        }));
      }

      // Adapt RuntimeEnv.log to ChannelLogSink
      const log: ChannelLogSink = {
        info: (msg) => runtime.log(msg),
        warn: (msg) => runtime.log(msg),
        error: (msg) => runtime.error(msg),
        debug: (msg) => runtime.log(msg),
      };
      return await resolveTwitchTargets(inputs, account, kind, log);
    },
  },

  /** Status monitoring adapter */
  status: {
    /** Default runtime state */
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },

    /** Build channel summary from snapshot */
    buildChannelSummary: ({
      snapshot,
    }: {
      snapshot: ChannelAccountSnapshot;
    }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),

    /** Probe account connection */
    probeAccount: async ({
      account,
      timeoutMs,
    }: {
      account: TwitchAccountConfig;
      timeoutMs: number;
    }): Promise<unknown> => {
      return await probeTwitch(account, timeoutMs);
    },

    /** Build account snapshot with current status */
    buildAccountSnapshot: ({
      account,
      runtime,
      probe,
    }: {
      account: TwitchAccountConfig;
      cfg: ClawdbotConfig;
      runtime?: ChannelAccountSnapshot;
      probe?: unknown;
    }): ChannelAccountSnapshot => {
      return {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: account?.enabled !== false,
        configured: isConfigured(account),
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        probe,
      };
    },

    /** Collect status issues for all accounts */
    collectStatusIssues: collectTwitchStatusIssues,
  },

  /** Gateway adapter for connection lifecycle */
  gateway: {
    /** Start an account connection */
    startAccount: async (ctx): Promise<void> => {
      const account = ctx.account as TwitchAccountConfig;
      const accountId = ctx.accountId;

      // Create logger for client manager
      const logger: ChannelLogSink = {
        info: (msg) => ctx.log?.info(`[twitch] ${msg}`),
        warn: (msg) => ctx.log?.warn(`[twitch] ${msg}`),
        error: (msg) => ctx.log?.error(`[twitch] ${msg}`),
        debug: (msg) => ctx.log?.debug?.(`[twitch] ${msg}`),
      };

      // Get or create client manager from registry
      const clientManager = getOrCreateClientManager(accountId, logger);

      // Set up message handler
      clientManager.onMessage(account, (message) => {
        // Access control check
        const botUsername = account.username.toLowerCase();
        if (message.username.toLowerCase() === botUsername) {
          return; // Ignore own messages
        }

        const access = checkTwitchAccessControl({
          message,
          account,
          botUsername,
        });

        if (!access.allowed) {
          ctx.log?.info(
            `[twitch] Ignored message from ${message.username}: ${access.reason ?? "blocked"}`,
          );
          return;
        }

        // Resolve route for this message
        resolveAgentRoute({
          cfg: ctx.cfg,
          channel: "twitch",
          accountId,
          peer: {
            kind: "group", // Twitch chat is always group-like
            id: message.channel,
          },
        });

        // Build message preview
        const preview = message.message.replace(/\s+/g, " ").slice(0, 160);

        // Log message receipt
        // Note: Message dispatch to agent system will be handled by a separate monitor/loop
        // For now, we just log that we received and validated the message
        ctx.log?.info(
          `[twitch] Received message from ${message.displayName ?? message.username}: ${preview}`,
        );
      });

      // Update status
      ctx.setStatus?.({
        accountId,
        running: true,
        lastStartAt: Date.now(),
        lastError: null,
      });

      ctx.log?.info(
        `[twitch] Starting Twitch connection for ${account.username}`,
      );

      try {
        await clientManager.getClient(account, ctx.cfg);
        ctx.log?.info(`[twitch] Connected to Twitch as ${account.username}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        ctx.log?.error(`[twitch] Failed to connect: ${errorMsg}`);
        ctx.setStatus?.({
          accountId,
          running: false,
          lastError: errorMsg,
        });
        throw error;
      }
    },

    /** Stop an account connection */
    stopAccount: async (ctx): Promise<void> => {
      const account = ctx.account as TwitchAccountConfig;
      const accountId = ctx.accountId;

      // Disconnect and remove client manager from registry
      await removeClientManager(accountId);

      ctx.setStatus?.({
        accountId,
        running: false,
        lastStopAt: Date.now(),
      });

      ctx.log?.info(
        `[twitch] Stopped Twitch connection for ${account.username}`,
      );
    },
  },
};
