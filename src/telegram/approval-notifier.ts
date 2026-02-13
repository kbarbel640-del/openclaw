import { Bot } from "grammy";
import type { OpenClawConfig } from "../config/config.js";

export interface ApprovalRecord {
  id: string;
  request: {
    command: string;
    cwd?: string | null;
    resolvedPath?: string | null;
    ask?: string | null;
  };
  createdAtMs: number;
  expiresAtMs: number;
}

export function createTelegramApprovalNotifier(
  cfg: OpenClawConfig,
  runtime?: { log?: ReturnType<typeof console.log>; error?: ReturnType<typeof console.error> }
): { sendApprovalRequest: (record: ApprovalRecord) => Promise<void> } | null {
  const telegramCfg = cfg.channels?.telegram;

  // Find first account with botToken (supports both new accounts structure and legacy)
  const account = telegramCfg?.accounts
    ? Object.values(telegramCfg.accounts).find((acc): acc is { botToken: string } => Boolean(acc?.botToken))
    : (telegramCfg as { botToken?: string } | undefined)?.botToken ? telegramCfg as { botToken: string } : undefined;

  if (!account?.botToken) {
    return null;
  }

  const bot = new Bot(account.botToken);

  // Resolve chat ID:
  // - Prefer approvalChatId from config (can be set on account-level or top-level)
  // - Fallback to first account ID (for single-account setups this is the owner's chat ID)
  const approvalChatId = (account as any).approvalChatId ?? telegramCfg?.approvalChatId;
  const accountIds = telegramCfg?.accounts ? Object.keys(telegramCfg.accounts) : [];
  const chatId = approvalChatId ?? accountIds[0] ?? (telegramCfg as any)?.accountId;

  if (!chatId) {
    runtime?.log?.("telegram approval notifier: no chatId configured (approvalChatId or accountId)");
    return null;
  }

  return {
    async sendApprovalRequest(record: ApprovalRecord): Promise<void> {
      const { id, request } = record;
      const { command: cmdStr, cwd, resolvedPath, ask } = request;
      const text = `⚠️ *Approval Required*

Command: \`${cmdStr}\`
CWD: \`${cwd ?? "n/a"}\`
Path: \`${resolvedPath ?? "n/a"}\`
Ask: ${ask ?? "-"}

Choose an action:`;

      try {
        await bot.api.sendMessage(String(chatId), text, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Approve Once", callback_data: `approve_once:${id}` },
                { text: "✅ Approve Always", callback_data: `approve_always:${id}` },
                { text: "❌ Reject", callback_data: `reject:${id}` },
              ],
            ],
          },
        });
      } catch (err) {
        if (typeof runtime?.error === 'function') {
          runtime.error(`telegram approval send failed: ${String(err)}`);
        } else if (runtime) {
          console.error(`telegram approval send failed: ${String(err)}`);
        }
        throw err;
      }
    },
  };
}
