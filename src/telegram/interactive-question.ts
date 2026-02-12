import { type Context } from "grammy";
import { randomUUID } from "node:crypto";
import { logVerbose } from "../globals.js";
import { sendMessageTelegram, editMessageTelegram } from "./send.js";

export type QuestionChoice = {
  label: string;
  value: string;
};

export type AskChoiceOptions = {
  chatId: string | number;
  question: string;
  choices: QuestionChoice[];
  allowText?: boolean;
  timeoutMs?: number;
  accountId?: string;
  messageThreadId?: number;
};

export type QuestionResult =
  | { kind: "choice"; value: string; raw: string; messageId?: string }
  | { kind: "text"; value: string; raw: string; messageId?: string }
  | { kind: "timeout"; value: null; raw: null; messageId?: undefined };

type PendingQuestion = {
  id: string;
  chatId: string; // Normalized string
  resolve: (result: QuestionResult) => void;
  messageId?: string; // The ID of the question message (with buttons)
  timer?: NodeJS.Timeout;
  allowText: boolean;
  accountId?: string;
  choices: QuestionChoice[];
};

// In-memory store for pending questions.
// Key: "chatId" (simple concurrency control: one question per chat at a time for simplicity,
// or use a more complex key if we need multiple users in same chat)
// Spec says: "Telegram channel 互動流程".
// For now, let's key by chatId. If a new question comes for the same chat, maybe we override or queue?
// Overriding is safer for "stuck" questions.
const pendingQuestions = new Map<string, PendingQuestion>();

const CALLBACK_PREFIX = "tgq:";

export async function askChoice(opts: AskChoiceOptions): Promise<QuestionResult> {
  const chatId = String(opts.chatId);
  const qid = randomUUID().slice(0, 8); // Short ID for callback data size limits

  // Prepare buttons
  // Callback format: tgq:<qid>:<choiceIndex> (to save space, use index or value hash?)
  // Telegram callback data max 64 bytes.
  // qid (8) + prefix (4) + colons (2) = 14 bytes. Leaves 50 bytes for value.
  // If value is long, we should store it map side or use index.
  // Using index is safer.
  const buttons = [
    opts.choices.map((c, idx) => ({
      text: c.label,
      callback_data: `${CALLBACK_PREFIX}${qid}:${idx}`,
    })),
  ];

  // Send message
  let sentMessageId: string | undefined;
  try {
    const res = await sendMessageTelegram(chatId, opts.question, {
      buttons,
      accountId: opts.accountId,
      messageThreadId: opts.messageThreadId,
    });
    sentMessageId = res.messageId;
  } catch (err) {
    throw new Error("Failed to send question", { cause: err });
  }

  return new Promise<QuestionResult>((resolve) => {
    const existing = pendingQuestions.get(chatId);
    if (existing) {
      // Cancel previous question in this chat
      clearTimeout(existing.timer);
      existing.resolve({ kind: "timeout", value: null, raw: null });
    }

    const onResolve = (res: QuestionResult) => {
      pendingQuestions.delete(chatId);
      // Clean up buttons if possible
      if (sentMessageId && res.kind !== "timeout") {
        // Fire and forget button removal
        editMessageTelegram(chatId, sentMessageId, opts.question, {
          buttons: [], // Empty array removes buttons
          accountId: opts.accountId,
        }).catch((err) => logVerbose(`Failed to remove buttons: ${err}`));
      }
      resolve(res);
    };

    const timer = setTimeout(() => {
      onResolve({ kind: "timeout", value: null, raw: null });
    }, opts.timeoutMs ?? 60_000); // Default 60s timeout

    const pending: PendingQuestion = {
      id: qid,
      chatId,
      resolve: onResolve,
      messageId: sentMessageId,
      timer,
      allowText: opts.allowText ?? true,
      accountId: opts.accountId,
      choices: opts.choices,
    };

    pendingQuestions.set(chatId, pending);
  });
}

export async function handleQuestionCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith(CALLBACK_PREFIX)) {
    return false;
  }

  const parts = data.slice(CALLBACK_PREFIX.length).split(":");
  if (parts.length < 2) {
    return false;
  }

  const [qid, choiceIdxStr] = parts;
  const chatId = String(ctx.callbackQuery?.message?.chat.id);
  const pending = pendingQuestions.get(chatId);

  if (!pending || pending.id !== qid) {
    // Expired or invalid question
    try {
      await ctx.answerCallbackQuery({ text: "Question expired." });
      // Optionally try to remove buttons if they are stale
      if (ctx.callbackQuery?.message?.message_id) {
        // We don't have the original text easily here unless we fetch or it's in the message.
        // Best effort: leave it or try to edit just markup?
        // editMessageTelegram requires text.
        // We can just return true to stop other handlers.
      }
    } catch {
      /* ignore */
    }
    return true; // Handled (even if expired)
  }

  const choiceIdx = parseInt(choiceIdxStr, 10);
  const choices = pending.choices;
  const choice = choices[choiceIdx];

  if (choice) {
    clearTimeout(pending.timer);
    pending.resolve({
      kind: "choice",
      value: choice.value,
      raw: choice.label,
      messageId: String(ctx.callbackQuery?.message?.message_id),
    });
    try {
      await ctx.answerCallbackQuery({ text: `Selected: ${choice.label}` });
    } catch {
      /* ignore */
    }
  } else {
    // Invalid choice index?
    try {
      await ctx.answerCallbackQuery({ text: "Invalid choice." });
    } catch {
      /* ignore */
    }
  }

  return true;
}

export async function handleQuestionTextReply(ctx: Context): Promise<boolean> {
  const msg = ctx.message;
  if (!msg) {
    return false;
  }

  const chatId = String(msg.chat.id);
  const pending = pendingQuestions.get(chatId);

  if (!pending) {
    return false;
  }

  if (!pending.allowText) {
    return false;
  }

  // It's a match.
  const text = msg.text ?? msg.caption ?? "";
  if (!text) {
    // Ignore non-text updates (like stickers?) if we only want text/choice.
    return false;
  }

  clearTimeout(pending.timer);
  pending.resolve({
    kind: "text",
    value: text,
    raw: text,
    messageId: String(msg.message_id),
  });

  return true; // Consumed
}
