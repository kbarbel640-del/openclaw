import type { ChannelGroupContext, ChannelPlugin, GroupToolPolicyConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, formatPairingApproveHint, PAIRING_APPROVED_MESSAGE } from "openclaw/plugin-sdk";
import {
  listSimplexAccountIds,
  resolveDefaultSimplexAccountId,
  resolveSimplexAccount,
} from "./accounts.js";
import { SimplexChannelConfigSchema } from "./config-schema.js";
import { startSimplexMonitor } from "./simplex-monitor.js";
import { buildSendMessagesCommand, type SimplexComposedMessage } from "./simplex-commands.js";
import { startSimplexCli } from "./simplex-cli.js";
import { SimplexWsClient } from "./simplex-ws-client.js";
import { buildComposedMessages } from "./simplex-media.js";
import { formatSimplexAllowFrom, resolveSimplexAllowFrom } from "./simplex-security.js";
import { simplexMessageActions } from "./actions.js";
import {
  listSimplexDirectoryGroups,
  listSimplexDirectoryPeers,
  listSimplexGroupMembers,
  resolveSimplexSelf,
  resolveSimplexTargets,
} from "./simplex-directory.js";
import type { ResolvedSimplexAccount } from "./types.js";

const activeClients = new Map<string, SimplexWsClient>();

function resolveSimplexGroupRequireMention(params: ChannelGroupContext): boolean | undefined {
  const account = resolveSimplexAccount({ cfg: params.cfg, accountId: params.accountId });
  const groups = account.config.groups ?? {};
  const groupId = params.groupId?.trim();
  const entry = groupId ? groups[groupId] : undefined;
  const fallback = groups["*"];
  if (typeof entry?.requireMention === "boolean") {
    return entry.requireMention;
  }
  if (typeof fallback?.requireMention === "boolean") {
    return fallback.requireMention;
  }
  return undefined;
}

function resolveSimplexGroupToolPolicy(
  params: ChannelGroupContext,
): GroupToolPolicyConfig | undefined {
  const account = resolveSimplexAccount({ cfg: params.cfg, accountId: params.accountId });
  const groups = account.config.groups ?? {};
  const groupId = params.groupId?.trim();
  const candidates = [groupId, "*"].filter((value): value is string => Boolean(value));
  for (const key of candidates) {
    const entry = groups[key];
    if (entry?.tools) {
      return entry.tools;
    }
  }
  return undefined;
}

function normalizeSimplexContactRef(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("@")) {
    return trimmed;
  }
  if (/^(contact|user|member|simplex):/i.test(trimmed)) {
    return `@${trimmed.slice(trimmed.indexOf(":") + 1).trim()}`;
  }
  return `@${trimmed}`;
}

async function withSimplexClient<T>(
  account: ResolvedSimplexAccount,
  fn: (client: SimplexWsClient) => Promise<T>,
): Promise<T> {
  const existing = activeClients.get(account.accountId);
  if (existing) {
    return await fn(existing);
  }
  const client = new SimplexWsClient({
    url: account.wsUrl,
    connectTimeoutMs: account.config.connection?.connectTimeoutMs,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function sendComposedMessages(params: {
  account: ResolvedSimplexAccount;
  chatRef: string;
  composedMessages: SimplexComposedMessage[];
}): Promise<void> {
  if (params.composedMessages.length === 0) {
    return;
  }
  const cmd = buildSendMessagesCommand({
    chatRef: params.chatRef,
    composedMessages: params.composedMessages,
  });
  await withSimplexClient(params.account, (client) => client.sendCommand(cmd));
}

export const simplexPlugin: ChannelPlugin<ResolvedSimplexAccount> = {
  id: "simplex",
  meta: {
    id: "simplex",
    label: "SimpleX",
    selectionLabel: "SimpleX (bot API)",
    docsPath: "/channels/simplex",
    blurb: "SimpleX Chat via local CLI WebSocket API.",
    order: 95,
    quickstartAllowFrom: true,
  },
  pairing: {
    idLabel: "simplexContactId",
    normalizeAllowEntry: (entry) => entry.replace(/^simplex:/i, "").replace(/^@/, ""),
    notifyApproval: async ({ cfg, id }) => {
      const accountId = resolveDefaultSimplexAccountId(cfg);
      const account = resolveSimplexAccount({ cfg, accountId });
      const composedMessages = await buildComposedMessages({
        cfg,
        accountId,
        text: PAIRING_APPROVED_MESSAGE,
      });
      await sendComposedMessages({
        account,
        chatRef: normalizeSimplexContactRef(id),
        composedMessages,
      });
    },
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: true,
    edit: true,
    unsend: true,
    reply: true,
    groupManagement: true,
  },
  reload: { configPrefixes: ["channels.simplex"] },
  configSchema: SimplexChannelConfigSchema,
  config: {
    listAccountIds: (cfg) => listSimplexAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveSimplexAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultSimplexAccountId(cfg),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      mode: account.mode,
      wsUrl: account.wsUrl,
    }),
    resolveAllowFrom: ({ cfg, accountId }) => resolveSimplexAllowFrom({ cfg, accountId }),
    formatAllowFrom: ({ allowFrom }) => formatSimplexAllowFrom(allowFrom),
  },
  messaging: {
    normalizeTarget: (raw) => raw.replace(/^simplex:/i, "").trim(),
    targetResolver: {
      looksLikeId: (input) => input.trim().startsWith("@") || input.trim().startsWith("#"),
      hint: "@<contactId> or #<groupId>",
    },
  },
  actions: simplexMessageActions,
  directory: {
    self: async ({ cfg, accountId, runtime }) =>
      resolveSimplexSelf({ cfg, accountId, runtime }),
    listPeers: async (params) => listSimplexDirectoryPeers(params),
    listGroups: async (params) => listSimplexDirectoryGroups(params),
    listGroupMembers: async (params) => listSimplexGroupMembers(params),
    listPeersLive: async (params) => listSimplexDirectoryPeers(params),
    listGroupsLive: async (params) => listSimplexDirectoryGroups(params),
  },
  resolver: {
    resolveTargets: async (params) => resolveSimplexTargets(params),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(cfg.channels?.simplex?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath
        ? `channels.simplex.accounts.${resolvedAccountId}.`
        : "channels.simplex.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("simplex"),
        normalizeEntry: (raw) => raw.replace(/^simplex:/i, "").replace(/^@/, ""),
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy !== "open") {
        return [];
      }
      return [
        `- SimpleX groups: groupPolicy="open" allows any member to trigger the bot. Set channels.simplex.groupPolicy="allowlist" + channels.simplex.groupAllowFrom to restrict senders.`,
      ];
    },
  },
  groups: {
    resolveRequireMention: resolveSimplexGroupRequireMention,
    resolveToolPolicy: resolveSimplexGroupToolPolicy,
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4000,
    sendPayload: async ({ cfg, to, payload, accountId }) => {
      const account = resolveSimplexAccount({ cfg, accountId });
      const composedMessages = await buildComposedMessages({
        cfg,
        accountId,
        text: payload.text,
        mediaUrls: payload.mediaUrls,
        mediaUrl: payload.mediaUrl,
        audioAsVoice: payload.audioAsVoice,
      });
      await sendComposedMessages({
        account,
        chatRef: to,
        composedMessages,
      });
      return { channel: "simplex", to };
    },
    sendText: async ({ cfg, to, text, accountId }) => {
      const account = resolveSimplexAccount({ cfg, accountId });
      const composedMessages = await buildComposedMessages({
        cfg,
        accountId,
        text,
      });
      await sendComposedMessages({ account, chatRef: to, composedMessages });
      return { channel: "simplex", to };
    },
    sendMedia: async ({ cfg, to, text, mediaUrl, accountId }) => {
      if (!mediaUrl) {
        return { channel: "simplex", to };
      }
      const account = resolveSimplexAccount({ cfg, accountId });
      const composedMessages = await buildComposedMessages({
        cfg,
        accountId,
        text,
        mediaUrl,
      });
      await sendComposedMessages({ account, chatRef: to, composedMessages });
      return { channel: "simplex", to, mediaUrl };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      mode: null,
      wsUrl: null,
    },
    collectStatusIssues: (accounts) =>
      accounts.flatMap((account) => {
        const lastError = typeof account.lastError === "string" ? account.lastError.trim() : "";
        if (!lastError) {
          return [];
        }
        return [
          {
            channel: "simplex",
            accountId: account.accountId,
            kind: "runtime" as const,
            message: `Channel error: ${lastError}`,
          },
        ];
      }),
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      mode: snapshot.mode ?? null,
      wsUrl: snapshot.wsUrl ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      mode: runtime?.mode ?? account.mode,
      wsUrl: runtime?.wsUrl ?? account.wsUrl,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.setStatus({
        accountId: account.accountId,
        mode: account.mode,
        wsUrl: account.wsUrl,
      });

      let cliHandle: ReturnType<typeof startSimplexCli> | null = null;
      if (account.mode === "managed") {
        cliHandle = startSimplexCli({
          cliPath: account.cliPath,
          wsPort: account.wsPort,
          dataDir: account.dataDir,
          log: ctx.log,
        });
      }

      const monitor = await startSimplexMonitor({
        account,
        cfg: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) => ctx.setStatus({ accountId: account.accountId, ...patch }),
      });

      activeClients.set(account.accountId, monitor.client);

      await new Promise<void>((resolve) => {
        ctx.abortSignal.addEventListener(
          "abort",
          () => {
            resolve();
          },
          { once: true },
        );
      });

      activeClients.delete(account.accountId);
      await monitor.client.close().catch(() => undefined);
      cliHandle?.stop();
    },
    stopAccount: async (ctx) => {
      const client = activeClients.get(ctx.account.accountId);
      if (client) {
        await client.close();
        activeClients.delete(ctx.account.accountId);
      }
    },
  },
};
