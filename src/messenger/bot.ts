/**
 * Messenger bot gateway lifecycle management.
 *
 * Handles starting and stopping of Messenger accounts in the gateway.
 * Unlike polling-based channels (like Telegram), Messenger uses webhooks
 * only - the gateway simply tracks state and handles incoming webhook events.
 */

import type { ChannelGatewayContext } from "../channels/plugins/types.js";
import type { ResolvedMessengerAccount } from "./types.js";
import { probeMessenger } from "./probe.js";

export type MessengerBotState = {
  accountId: string;
  pageId?: string;
  pageName?: string;
  running: boolean;
  startedAt?: number;
  abortController?: AbortController;
};

/**
 * Active Messenger bot instances by account ID.
 */
const activeBots = new Map<string, MessengerBotState>();

/**
 * Start a Messenger account in the gateway.
 *
 * Validates the page access token and sets up state tracking.
 * Messenger uses webhooks, so there's no polling loop to start.
 */
export async function startMessengerAccount(
  ctx: ChannelGatewayContext<ResolvedMessengerAccount>,
): Promise<MessengerBotState> {
  const { account, log, setStatus, getStatus } = ctx;
  const accountId = account.accountId;

  // Check if already running
  const existing = activeBots.get(accountId);
  if (existing?.running) {
    log?.warn?.(`[${accountId}] already running, skipping start`);
    return existing;
  }

  let pageLabel = "";
  try {
    const probe = await probeMessenger(account.pageAccessToken, 5000);
    if (probe.ok && probe.page?.name) {
      pageLabel = ` (${probe.page.name})`;
    }
  } catch (err) {
    log?.debug?.(`[${accountId}] probe failed during start: ${String(err)}`);
  }

  log?.info?.(`[${accountId}] starting Messenger provider${pageLabel}`);

  const state: MessengerBotState = {
    accountId,
    pageId: account.pageId,
    running: true,
    startedAt: Date.now(),
    abortController: new AbortController(),
  };

  activeBots.set(accountId, state);

  // Update status
  setStatus({
    ...getStatus(),
    running: true,
    lastStartAt: Date.now(),
    lastError: null,
  });

  return state;
}

/**
 * Stop a Messenger account in the gateway.
 */
export async function stopMessengerAccount(
  ctx: ChannelGatewayContext<ResolvedMessengerAccount>,
): Promise<void> {
  const { account, log, setStatus, getStatus } = ctx;
  const accountId = account.accountId;

  const existing = activeBots.get(accountId);
  if (!existing) {
    log?.debug?.(`[${accountId}] not running, nothing to stop`);
    return;
  }

  log?.info?.(`[${accountId}] stopping Messenger provider`);

  // Signal abort to any pending operations
  existing.abortController?.abort();
  existing.running = false;

  activeBots.delete(accountId);

  // Update status
  setStatus({
    ...getStatus(),
    running: false,
    lastStopAt: Date.now(),
  });
}

/**
 * Get the current state of a Messenger bot.
 */
export function getMessengerBotState(accountId: string): MessengerBotState | undefined {
  return activeBots.get(accountId);
}

/**
 * Check if a Messenger account is currently running.
 */
export function isMessengerAccountRunning(accountId: string): boolean {
  return activeBots.get(accountId)?.running ?? false;
}

/**
 * List all running Messenger account IDs.
 */
export function listRunningMessengerAccounts(): string[] {
  return Array.from(activeBots.entries())
    .filter(([_, state]) => state.running)
    .map(([id]) => id);
}
