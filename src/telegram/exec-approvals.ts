import type { OpenClawConfig } from "../config/config.js";
import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
import type { TelegramExecApprovalConfig } from "../config/types.telegram.js";
import { buildGatewayConnectionDetails } from "../gateway/call.js";
import { GatewayClient } from "../gateway/client.js";
import type { EventFrame } from "../gateway/protocol/index.js";
import type {
  ExecApprovalDecision,
  ExecApprovalRequest,
  ExecApprovalResolved,
} from "../infra/exec-approvals.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { normalizeAccountId, resolveAgentIdFromSessionKey } from "../routing/session-key.js";
import type { RuntimeEnv } from "../runtime.js";
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
  normalizeMessageChannel,
} from "../utils/message-channel.js";
import {
  sendMessageTelegram,
  editMessageTelegram,
  deleteMessageTelegram,
} from "./send.js";

export type { ExecApprovalRequest, ExecApprovalResolved };

const log = createSubsystemLogger("telegram/exec-approvals");

// ─── Callback data encoding ─────────────────────────────────────────────────
// Telegram callback_data has a 64-byte limit. We use a monotonic counter
// mapped to the full UUID approval ID in memory:
//   ea:{counter}:{action}  (e.g. "ea:42:ao" = 11 bytes)
// Actions: ao = allow-once, aa = allow-always, d = deny

const ACTION_SHORT: Record<ExecApprovalDecision, string> = {
  "allow-once": "ao",
  "allow-always": "aa",
  deny: "d",
};
const ACTION_LONG: Record<string, ExecApprovalDecision> = {
  ao: "allow-once",
  aa: "allow-always",
  d: "deny",
};

const EA_PREFIX = "ea:";

export function buildExecApprovalCallbackData(
  counter: number,
  action: ExecApprovalDecision,
): string {
  return `${EA_PREFIX}${counter}:${ACTION_SHORT[action]}`;
}

export function isExecApprovalCallbackData(data: string): boolean {
  return data.startsWith(EA_PREFIX);
}

export function parseExecApprovalCallbackData(
  data: string,
): { counter: number; decision: ExecApprovalDecision } | null {
  if (!data.startsWith(EA_PREFIX)) {
    return null;
  }
  const rest = data.slice(EA_PREFIX.length);
  const colonIdx = rest.indexOf(":");
  if (colonIdx < 1) {
    return null;
  }
  const counterStr = rest.slice(0, colonIdx);
  const actionStr = rest.slice(colonIdx + 1);
  const counter = Number.parseInt(counterStr, 10);
  if (!Number.isFinite(counter) || counter < 0) {
    return null;
  }
  const decision = ACTION_LONG[actionStr];
  if (!decision) {
    return null;
  }
  return { counter, decision };
}

// ─── Session key helpers ─────────────────────────────────────────────────────

/** Extract Telegram chat ID from a session key like "agent:main:telegram:channel:-123456" */
export function extractTelegramChatId(sessionKey?: string | null): string | null {
  if (!sessionKey) {
    return null;
  }
  const match = sessionKey.match(/telegram:(?:channel|group):(-?\d+)/);
  return match ? match[1] : null;
}

function resolveExecApprovalAccountId(params: {
  cfg: OpenClawConfig;
  request: ExecApprovalRequest;
}): string | null {
  const sessionKey = params.request.request.sessionKey?.trim();
  if (!sessionKey) {
    return null;
  }
  try {
    const agentId = resolveAgentIdFromSessionKey(sessionKey);
    const storePath = resolveStorePath(params.cfg.session?.store, { agentId });
    const store = loadSessionStore(storePath);
    const entry = store[sessionKey];
    const channel = normalizeMessageChannel(entry?.origin?.provider ?? entry?.lastChannel);
    if (channel && channel !== "telegram") {
      return null;
    }
    const accountId = entry?.origin?.accountId ?? entry?.lastAccountId;
    return accountId?.trim() || null;
  } catch {
    return null;
  }
}

// ─── Message formatting ──────────────────────────────────────────────────────

function formatApprovalCommand(command: string): string {
  if (!command.includes("\n") && !command.includes("`")) {
    return `\`${command}\``;
  }
  let fence = "```";
  while (command.includes(fence)) {
    fence += "`";
  }
  return `${fence}\n${command}\n${fence}`;
}

function buildRequestMessageText(request: ExecApprovalRequest, nowMs: number): string {
  const commandText = request.request.command;
  const commandPreview =
    commandText.length > 1000 ? `${commandText.slice(0, 1000)}...` : commandText;
  const formattedCommand = formatApprovalCommand(commandPreview);

  const lines: string[] = ["\u{1F512} *Exec Approval Required*", ""];
  lines.push("*Command:*");
  lines.push(formattedCommand);

  if (request.request.cwd) {
    lines.push(`CWD: ${request.request.cwd}`);
  }
  if (request.request.host) {
    lines.push(`Host: ${request.request.host}`);
  }
  if (request.request.agentId) {
    lines.push(`Agent: ${request.request.agentId}`);
  }
  const expiresIn = Math.max(0, Math.round((request.expiresAtMs - nowMs) / 1000));
  lines.push(`Expires in: ${expiresIn}s`);
  lines.push(`ID: ${request.id}`);
  return lines.join("\n");
}

function buildResolvedMessageText(
  request: ExecApprovalRequest,
  decision: ExecApprovalDecision,
  resolvedBy?: string | null,
): string {
  const commandText = request.request.command;
  const commandPreview =
    commandText.length > 500 ? `${commandText.slice(0, 500)}...` : commandText;
  const formattedCommand = formatApprovalCommand(commandPreview);

  const decisionLabel =
    decision === "allow-once"
      ? "Allowed (once)"
      : decision === "allow-always"
        ? "Allowed (always)"
        : "Denied";
  const emoji = decision === "deny" ? "\u274C" : "\u2705";
  const byLine = resolvedBy ? ` by ${resolvedBy}` : "";

  const lines: string[] = [
    `${emoji} *Exec Approval: ${decisionLabel}*`,
    `Resolved${byLine}`,
    "",
    "*Command:*",
    formattedCommand,
    `ID: ${request.id}`,
  ];
  return lines.join("\n");
}

function buildExpiredMessageText(request: ExecApprovalRequest): string {
  const commandText = request.request.command;
  const commandPreview =
    commandText.length > 500 ? `${commandText.slice(0, 500)}...` : commandText;
  const formattedCommand = formatApprovalCommand(commandPreview);

  const lines: string[] = [
    "\u23F1\uFE0F *Exec Approval: Expired*",
    "",
    "*Command:*",
    formattedCommand,
    `ID: ${request.id}`,
  ];
  return lines.join("\n");
}

// ─── Inline keyboard ─────────────────────────────────────────────────────────

function buildApprovalButtons(counter: number) {
  return [
    [
      {
        text: "\u2705 Allow Once",
        callback_data: buildExecApprovalCallbackData(counter, "allow-once"),
      },
      {
        text: "\u{1F504} Always Allow",
        callback_data: buildExecApprovalCallbackData(counter, "allow-always"),
      },
      {
        text: "\u274C Deny",
        callback_data: buildExecApprovalCallbackData(counter, "deny"),
      },
    ],
  ];
}

// ─── Pending state ───────────────────────────────────────────────────────────

type PendingApproval = {
  telegramMessageId: string;
  telegramChatId: string;
  approvalId: string;
  timeoutId: NodeJS.Timeout;
};

// ─── Handler class ───────────────────────────────────────────────────────────

export type TelegramExecApprovalHandlerOpts = {
  token: string;
  accountId: string;
  config: TelegramExecApprovalConfig;
  gatewayUrl?: string;
  cfg: OpenClawConfig;
  runtime?: RuntimeEnv;
};

export type HandleCallbackResult = {
  error?: string;
};

export class TelegramExecApprovalHandler {
  private gatewayClient: GatewayClient | null = null;
  private pending = new Map<number, PendingApproval>();
  private approvalCounters = new Map<string, Set<number>>();
  private requestCache = new Map<string, ExecApprovalRequest>();
  private counterSeq = 0;
  private opts: TelegramExecApprovalHandlerOpts;
  private started = false;

  constructor(opts: TelegramExecApprovalHandlerOpts) {
    this.opts = opts;
  }

  private nextCounter(): number {
    this.counterSeq = (this.counterSeq + 1) % 100_000;
    return this.counterSeq;
  }

  private trackCounter(approvalId: string, counter: number): void {
    let set = this.approvalCounters.get(approvalId);
    if (!set) {
      set = new Set();
      this.approvalCounters.set(approvalId, set);
    }
    set.add(counter);
  }

  shouldHandle(request: ExecApprovalRequest): boolean {
    const config = this.opts.config;
    if (!config.enabled) {
      return false;
    }
    if (!config.approvers || config.approvers.length === 0) {
      return false;
    }

    const requestAccountId = resolveExecApprovalAccountId({
      cfg: this.opts.cfg,
      request,
    });
    if (requestAccountId) {
      const handlerAccountId = normalizeAccountId(this.opts.accountId);
      if (normalizeAccountId(requestAccountId) !== handlerAccountId) {
        return false;
      }
    }

    if (config.agentFilter?.length) {
      if (!request.request.agentId) {
        return false;
      }
      if (!config.agentFilter.includes(request.request.agentId)) {
        return false;
      }
    }

    if (config.sessionFilter?.length) {
      const session = request.request.sessionKey;
      if (!session) {
        return false;
      }
      const matches = config.sessionFilter.some((p) => {
        try {
          return session.includes(p) || new RegExp(p).test(session);
        } catch {
          return session.includes(p);
        }
      });
      if (!matches) {
        return false;
      }
    }

    return true;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    const config = this.opts.config;
    if (!config.enabled) {
      log.debug("telegram exec approvals: disabled");
      return;
    }
    if (!config.approvers || config.approvers.length === 0) {
      log.debug("telegram exec approvals: no approvers configured");
      return;
    }

    log.debug("telegram exec approvals: starting handler");

    const { url: gatewayUrl } = buildGatewayConnectionDetails({
      config: this.opts.cfg,
      url: this.opts.gatewayUrl,
    });

    this.gatewayClient = new GatewayClient({
      url: gatewayUrl,
      clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
      clientDisplayName: "Telegram Exec Approvals",
      mode: GATEWAY_CLIENT_MODES.BACKEND,
      scopes: ["operator.approvals"],
      onEvent: (evt) => this.handleGatewayEvent(evt),
      onHelloOk: () => {
        log.debug("telegram exec approvals: connected to gateway");
      },
      onConnectError: (err) => {
        log.error(`telegram exec approvals: connect error: ${err.message}`);
      },
      onClose: (code, reason) => {
        log.debug(`telegram exec approvals: gateway closed: ${code} ${reason}`);
      },
    });

    this.gatewayClient.start();
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.started = false;

    for (const entry of this.pending.values()) {
      clearTimeout(entry.timeoutId);
    }
    this.pending.clear();
    this.approvalCounters.clear();
    this.requestCache.clear();

    this.gatewayClient?.stop();
    this.gatewayClient = null;

    log.debug("telegram exec approvals: stopped");
  }

  private handleGatewayEvent(evt: EventFrame): void {
    if (evt.event === "exec.approval.requested") {
      const request = evt.payload as ExecApprovalRequest;
      void this.handleApprovalRequested(request);
    } else if (evt.event === "exec.approval.resolved") {
      const resolved = evt.payload as ExecApprovalResolved;
      void this.handleApprovalResolved(resolved);
    }
  }

  private async handleApprovalRequested(request: ExecApprovalRequest): Promise<void> {
    if (!this.shouldHandle(request)) {
      return;
    }

    log.debug(`telegram exec approvals: received request ${request.id}`);
    this.requestCache.set(request.id, request);

    const messageText = buildRequestMessageText(request, Date.now());
    const target = this.opts.config.target ?? "dm";
    const sendToDm = target === "dm" || target === "both";
    const sendToChannel = target === "channel" || target === "both";
    let fallbackToDm = false;

    if (sendToChannel) {
      const chatId = extractTelegramChatId(request.request.sessionKey);
      if (chatId) {
        await this.sendApprovalMessage(chatId, messageText, request);
      } else {
        if (!sendToDm) {
          log.error(
            `telegram exec approvals: target is "channel" but could not extract chat id from session key "${request.request.sessionKey ?? "(none)"}" — falling back to DM delivery for approval ${request.id}`,
          );
          fallbackToDm = true;
        } else {
          log.debug(
            "telegram exec approvals: could not extract chat id from session key",
          );
        }
      }
    }

    if (sendToDm || fallbackToDm) {
      const approvers = this.opts.config.approvers ?? [];
      for (const approver of approvers) {
        const userId = String(approver);
        await this.sendApprovalMessage(userId, messageText, request);
      }
    }
  }

  private async sendApprovalMessage(
    chatId: string,
    text: string,
    request: ExecApprovalRequest,
  ): Promise<void> {
    const counter = this.nextCounter();
    const buttons = buildApprovalButtons(counter);

    try {
      const result = await sendMessageTelegram(chatId, text, {
        token: this.opts.token,
        accountId: this.opts.accountId,
        buttons,
      });

      if (result?.messageId) {
        const timeoutMs = Math.max(0, request.expiresAtMs - Date.now());
        const timeoutId = setTimeout(() => {
          void this.handleApprovalTimeout(counter);
        }, timeoutMs);
        timeoutId.unref?.();

        this.pending.set(counter, {
          telegramMessageId: result.messageId,
          telegramChatId: result.chatId,
          approvalId: request.id,
          timeoutId,
        });
        this.trackCounter(request.id, counter);

        log.debug(
          `telegram exec approvals: sent approval ${request.id} to chat ${chatId} (counter=${counter})`,
        );
      }
    } catch (err) {
      log.error(`telegram exec approvals: failed to send to ${chatId}: ${String(err)}`);
    }
  }

  async handleCallback(params: {
    counter: number;
    decision: ExecApprovalDecision;
    senderId: string;
  }): Promise<HandleCallbackResult> {
    const entry = this.pending.get(params.counter);
    if (!entry) {
      return { error: "This approval is no longer active." };
    }

    // Authorization check
    const approvers = this.opts.config.approvers ?? [];
    const isAuthorized = approvers.some((id) => String(id) === params.senderId);
    if (!isAuthorized) {
      return { error: "\u26D4 You are not authorized to approve exec requests." };
    }

    const decisionLabel =
      params.decision === "allow-once"
        ? "Allowed (once)"
        : params.decision === "allow-always"
          ? "Allowed (always)"
          : "Denied";

    // Update message immediately to show decision in progress
    try {
      await editMessageTelegram(
        entry.telegramChatId,
        entry.telegramMessageId,
        `Submitting decision: *${decisionLabel}*...`,
        {
          token: this.opts.token,
          accountId: this.opts.accountId,
          buttons: [], // Remove buttons
        },
      );
    } catch {
      // Message may have been deleted, continue anyway
    }

    const ok = await this.resolveApproval(entry.approvalId, params.decision);
    if (!ok) {
      return {
        error:
          "Failed to submit approval decision. The request may have expired or already been resolved.",
      };
    }
    // On success, handleApprovalResolved event will update the message with final result
    return {};
  }

  private async handleApprovalResolved(resolved: ExecApprovalResolved): Promise<void> {
    const request = this.requestCache.get(resolved.id);
    this.requestCache.delete(resolved.id);

    const counters = this.approvalCounters.get(resolved.id);
    this.approvalCounters.delete(resolved.id);

    if (!request || !counters) {
      return;
    }

    log.debug(`telegram exec approvals: resolved ${resolved.id} with ${resolved.decision}`);

    const resolvedText = buildResolvedMessageText(
      request,
      resolved.decision,
      resolved.resolvedBy,
    );

    for (const counter of counters) {
      const entry = this.pending.get(counter);
      if (!entry) {
        continue;
      }
      clearTimeout(entry.timeoutId);
      this.pending.delete(counter);

      await this.finalizeMessage(entry.telegramChatId, entry.telegramMessageId, resolvedText);
    }
  }

  private async handleApprovalTimeout(counter: number): Promise<void> {
    const entry = this.pending.get(counter);
    if (!entry) {
      return;
    }
    this.pending.delete(counter);

    const request = this.requestCache.get(entry.approvalId);

    // Clean up counter tracking
    const counters = this.approvalCounters.get(entry.approvalId);
    if (counters) {
      counters.delete(counter);
      // Only clean up requestCache if no other pending entries exist
      if (counters.size === 0) {
        this.approvalCounters.delete(entry.approvalId);
        this.requestCache.delete(entry.approvalId);
      }
    }

    if (!request) {
      return;
    }

    log.debug(`telegram exec approvals: timeout for ${entry.approvalId} (counter=${counter})`);

    const expiredText = buildExpiredMessageText(request);
    await this.finalizeMessage(entry.telegramChatId, entry.telegramMessageId, expiredText);
  }

  private async finalizeMessage(
    chatId: string,
    messageId: string,
    text: string,
  ): Promise<void> {
    if (this.opts.config.cleanupAfterResolve) {
      try {
        await deleteMessageTelegram(chatId, messageId, {
          token: this.opts.token,
          accountId: this.opts.accountId,
        });
        return;
      } catch (err) {
        log.error(`telegram exec approvals: failed to delete message: ${String(err)}`);
        // Fall through to edit
      }
    }

    try {
      await editMessageTelegram(chatId, messageId, text, {
        token: this.opts.token,
        accountId: this.opts.accountId,
        buttons: [], // Remove buttons
      });
    } catch (err) {
      log.error(`telegram exec approvals: failed to update message: ${String(err)}`);
    }
  }

  async resolveApproval(approvalId: string, decision: ExecApprovalDecision): Promise<boolean> {
    if (!this.gatewayClient) {
      log.error("telegram exec approvals: gateway client not connected");
      return false;
    }

    log.debug(`telegram exec approvals: resolving ${approvalId} with ${decision}`);

    try {
      await this.gatewayClient.request("exec.approval.resolve", {
        id: approvalId,
        decision,
      });
      log.debug(`telegram exec approvals: resolved ${approvalId} successfully`);
      return true;
    } catch (err) {
      log.error(`telegram exec approvals: resolve failed: ${String(err)}`);
      return false;
    }
  }

  getApprovers(): Array<string | number> {
    return this.opts.config.approvers ?? [];
  }
}
