import type { CommandHandler } from "./commands-types.js";
import { logVerbose } from "../../globals.js";
import { listSkillCommandsForAgents } from "../skill-commands.js";
import {
  buildCommandsMessage,
  buildCommandsMessagePaginated,
  buildHelpMessage,
} from "../status.js";
import { buildContextReply } from "./commands-context-report.js";
import { buildStatusReply } from "./commands-status.js";

export const handleHelpCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  if (params.command.commandBodyNormalized !== "/help") {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /help from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  return {
    shouldContinue: false,
    reply: { text: buildHelpMessage(params.cfg) },
  };
};

export const handleCommandsListCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  if (params.command.commandBodyNormalized !== "/commands") {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /commands from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  const skillCommands =
    params.skillCommands ??
    listSkillCommandsForAgents({
      cfg: params.cfg,
      agentIds: params.agentId ? [params.agentId] : undefined,
    });
  const surface = params.ctx.Surface;

  if (surface === "telegram") {
    const result = buildCommandsMessagePaginated(params.cfg, skillCommands, {
      page: 1,
      surface,
    });

    if (result.totalPages > 1) {
      return {
        shouldContinue: false,
        reply: {
          text: result.text,
          channelData: {
            telegram: {
              buttons: buildCommandsPaginationKeyboard(
                result.currentPage,
                result.totalPages,
                params.agentId,
              ),
            },
          },
        },
      };
    }

    return {
      shouldContinue: false,
      reply: { text: result.text },
    };
  }

  return {
    shouldContinue: false,
    reply: { text: buildCommandsMessage(params.cfg, skillCommands, { surface }) },
  };
};

export function buildCommandsPaginationKeyboard(
  currentPage: number,
  totalPages: number,
  agentId?: string,
): Array<Array<{ text: string; callback_data: string }>> {
  const buttons: Array<{ text: string; callback_data: string }> = [];
  const suffix = agentId ? `:${agentId}` : "";

  if (currentPage > 1) {
    buttons.push({
      text: "◀ Prev",
      callback_data: `commands_page_${currentPage - 1}${suffix}`,
    });
  }

  buttons.push({
    text: `${currentPage}/${totalPages}`,
    callback_data: `commands_page_noop${suffix}`,
  });

  if (currentPage < totalPages) {
    buttons.push({
      text: "Next ▶",
      callback_data: `commands_page_${currentPage + 1}${suffix}`,
    });
  }

  return [buttons];
}

export const handleStatusCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const statusRequested =
    params.directives.hasStatusDirective || params.command.commandBodyNormalized === "/status";
  if (!statusRequested) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /status from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  const reply = await buildStatusReply({
    cfg: params.cfg,
    command: params.command,
    sessionEntry: params.sessionEntry,
    sessionKey: params.sessionKey,
    sessionScope: params.sessionScope,
    provider: params.provider,
    model: params.model,
    contextTokens: params.contextTokens,
    resolvedThinkLevel: params.resolvedThinkLevel,
    resolvedVerboseLevel: params.resolvedVerboseLevel,
    resolvedReasoningLevel: params.resolvedReasoningLevel,
    resolvedElevatedLevel: params.resolvedElevatedLevel,
    resolveDefaultThinkingLevel: params.resolveDefaultThinkingLevel,
    isGroup: params.isGroup,
    defaultGroupActivation: params.defaultGroupActivation,
    mediaDecisions: params.ctx.MediaUnderstandingDecisions,
  });
  return { shouldContinue: false, reply };
};

export const handleContextCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const normalized = params.command.commandBodyNormalized;
  if (normalized !== "/context" && !normalized.startsWith("/context ")) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /context from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  return { shouldContinue: false, reply: await buildContextReply(params) };
};

export const handleWhoamiCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  if (params.command.commandBodyNormalized !== "/whoami") {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /whoami from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  const senderId = params.ctx.SenderId ?? "";
  const senderUsername = params.ctx.SenderUsername ?? "";
  const lines = ["🧭 Identity", `Channel: ${params.command.channel}`];
  if (senderId) {
    lines.push(`User id: ${senderId}`);
  }
  if (senderUsername) {
    const handle = senderUsername.startsWith("@") ? senderUsername : `@${senderUsername}`;
    lines.push(`Username: ${handle}`);
  }
  if (params.ctx.ChatType === "group" && params.ctx.From) {
    lines.push(`Chat: ${params.ctx.From}`);
  }
  if (params.ctx.MessageThreadId != null) {
    lines.push(`Thread: ${params.ctx.MessageThreadId}`);
  }
  if (senderId) {
    lines.push(`AllowFrom: ${senderId}`);
  }
  return { shouldContinue: false, reply: { text: lines.join("\n") } };
};

const VIPERR_MESSAGE = `📋 VIPERR — Обязательный старт сессии

📖 ПРОЧИТАЙ:
1. SOUL.md — алгоритм работы
2. PREFLIGHT.md — чеклист до/после ответа
3. SESSION-STATE.md — что делали
4. memory/learnings/global.md — твои ошибки
5. memory/YYYY-MM-DD.md — сегодняшний контекст

✅ СДЕЛАЙ:
• Следуй SOUL.md для каждого ответа
• Не повторяй ошибки из learnings
• Стримь прогресс, не молчи`;

export const handleViperCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  if (params.command.commandBodyNormalized !== "/viperr") {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /viperr from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  // Inject into agent context instead of replying to user
  return { shouldContinue: true, injectContent: VIPERR_MESSAGE };
};
