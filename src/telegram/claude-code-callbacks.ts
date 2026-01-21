/**
 * Claude Code Telegram Callback Handlers
 *
 * Handles inline keyboard callbacks for Claude Code bubbles:
 * - claude:continue:<token> - Continue/send input to session
 * - claude:cancel:<token>   - Cancel a running session
 * - claude:answer:<token>   - Answer a question (prompts for input)
 */

import type { Bot, Context } from "grammy";
import {
  sendInput,
  getSessionByToken,
  cancelSessionByToken,
  getSessionState,
  startSession,
  getBubbleByTokenPrefix,
  resumeSession,
  CLEAR_MARKUP,
} from "../agents/claude-code/index.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("telegram/claude-callbacks");

/**
 * Callback data format: "claude:<action>:<tokenPrefix>"
 */
type ClaudeCallbackData = {
  action: "continue" | "cancel" | "answer";
  tokenPrefix: string;
};

/**
 * Parse callback data for Claude Code actions.
 */
function parseClaudeCallback(data: string): ClaudeCallbackData | null {
  const match = data.match(/^claude:(continue|cancel|answer):(\w+)$/);
  if (!match) return null;
  return {
    action: match[1] as ClaudeCallbackData["action"],
    tokenPrefix: match[2],
  };
}

/**
 * Handle a Claude Code callback query.
 * Returns true if handled, false if not a Claude Code callback.
 */
export async function handleClaudeCodeCallback(
  ctx: Context,
  api: Bot["api"],
  data: string,
): Promise<boolean> {
  const parsed = parseClaudeCallback(data);
  if (!parsed) return false;

  const { action, tokenPrefix } = parsed;
  const callbackId = ctx.callbackQuery?.id;
  const chatId = ctx.callbackQuery?.message?.chat.id;
  const messageId = ctx.callbackQuery?.message?.message_id;

  log.info(`Handling claude callback: ${action} for ${tokenPrefix}`);

  // Find the session (may not exist if process exited)
  const session = getSessionByToken(tokenPrefix);

  switch (action) {
    case "cancel": {
      if (!session) {
        await api.answerCallbackQuery(callbackId ?? "", {
          text: "Session already ended",
        });
        return true;
      }
      const success = cancelSessionByToken(tokenPrefix);
      if (success) {
        await api.answerCallbackQuery(callbackId ?? "", {
          text: "Session cancelled",
        });
        // Update the message to show cancelled state and remove buttons
        if (chatId && messageId) {
          const state = getSessionState(session);
          await api
            .editMessageText(
              chatId,
              messageId,
              `**${state.projectName}**\n${state.runtimeStr} · Cancelled`,
              { parse_mode: "Markdown", reply_markup: CLEAR_MARKUP },
            )
            .catch(() => {});
        }
      } else {
        await api.answerCallbackQuery(callbackId ?? "", {
          text: "Failed to cancel session",
          show_alert: true,
        });
      }
      return true;
    }

    case "continue": {
      // If session is running in memory, send input
      if (session) {
        // Reset runtime limiter if paused
        resumeSession(session.id);

        const success = sendInput(session.id, "continue");
        if (success) {
          await api.answerCallbackQuery(callbackId ?? "", {
            text: "Sent continue signal",
          });
        } else {
          await api.answerCallbackQuery(callbackId ?? "", {
            text: "Session not accepting input",
            show_alert: true,
          });
        }
        return true;
      }

      // Session not in memory - try to spawn new process with --resume
      const bubbleInfo = getBubbleByTokenPrefix(tokenPrefix);
      if (bubbleInfo) {
        const { bubble } = bubbleInfo;
        log.info(`Resuming session from bubble: ${bubble.resumeToken} in ${bubble.workingDir}`);

        // Acknowledge immediately
        await api.answerCallbackQuery(callbackId ?? "", {
          text: "Resuming session...",
        });

        // Start a new session with --resume
        const result = await startSession({
          workingDir: bubble.workingDir,
          resumeToken: bubble.resumeToken,
          prompt: "continue",
          permissionMode: "bypassPermissions",
        });

        if (result.success) {
          // Send confirmation message
          if (chatId) {
            await api
              .sendMessage(chatId, `Resumed session for **${bubble.projectName}**`, {
                parse_mode: "Markdown",
              })
              .catch(() => {});
          }
        } else {
          if (chatId) {
            await api
              .sendMessage(chatId, `Failed to resume: ${result.error}`, {
                parse_mode: "Markdown",
              })
              .catch(() => {});
          }
        }
        return true;
      }

      // No bubble info - can't resume
      await api.answerCallbackQuery(callbackId ?? "", {
        text: "Session info lost. Use CLI: claude --resume <token>",
        show_alert: true,
      });
      return true;
    }

    case "answer": {
      if (!session) {
        await api.answerCallbackQuery(callbackId ?? "", {
          text: "Session ended",
          show_alert: true,
        });
        return true;
      }
      // For questions, we need to prompt the user for input
      const state = getSessionState(session);
      if (state.hasQuestion && state.questionText) {
        await api.answerCallbackQuery(callbackId ?? "", {
          text: "Reply to this message with your answer",
        });
        // Send the question as a new message with force_reply
        if (chatId) {
          await api
            .sendMessage(
              chatId,
              `**Question from Claude Code:**\n\n${state.questionText}\n\n_Reply to this message with your answer._`,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  force_reply: true,
                  selective: true,
                },
              },
            )
            .catch(() => {});
        }
      } else {
        await api.answerCallbackQuery(callbackId ?? "", {
          text: "No pending question",
          show_alert: true,
        });
      }
      return true;
    }

    default:
      return false;
  }
}

/**
 * Check if callback data is for Claude Code.
 */
export function isClaudeCodeCallback(data: string): boolean {
  return data.startsWith("claude:");
}
