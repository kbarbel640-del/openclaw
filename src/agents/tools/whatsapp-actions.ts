import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { OpenClawConfig } from "../../config/config.js";
import { sendReactionWhatsApp } from "../../web/outbound.js";
import { readFileWhatsApp } from "../../web/outbound.js";
import { readWhatsAppMessages } from "../../web/read-messages.js";
import { saveMediaBuffer } from "../../media/store.js";
import { createActionGate, jsonResult, readReactionParams, readStringParam } from "./common.js";

export async function handleWhatsAppAction(
  params: Record<string, unknown>,
  cfg: OpenClawConfig,
): Promise<AgentToolResult<unknown>> {
  const action = readStringParam(params, "action", { required: true });
  const isActionEnabled = createActionGate(cfg.channels?.whatsapp?.actions);

  if (action === "react") {
    if (!isActionEnabled("reactions")) {
      throw new Error("WhatsApp reactions are disabled.");
    }
    const chatJid = readStringParam(params, "chatJid", { required: true });
    const messageId = readStringParam(params, "messageId", { required: true });
    const { emoji, remove, isEmpty } = readReactionParams(params, {
      removeErrorMessage: "Emoji is required to remove a WhatsApp reaction.",
    });
    const participant = readStringParam(params, "participant");
    const accountId = readStringParam(params, "accountId");
    const fromMeRaw = params.fromMe;
    const fromMe = typeof fromMeRaw === "boolean" ? fromMeRaw : undefined;
    const resolvedEmoji = remove ? "" : emoji;
    await sendReactionWhatsApp(chatJid, messageId, resolvedEmoji, {
      verbose: false,
      fromMe,
      participant: participant ?? undefined,
      accountId: accountId ?? undefined,
    });
    if (!remove && !isEmpty) {
      return jsonResult({ ok: true, added: emoji });
    }
    return jsonResult({ ok: true, removed: true });
  }

  if (action === "readFile") {
    if (!isActionEnabled("readFile")) {
      throw new Error("WhatsApp readFile is disabled.");
    }
    const chatJid = readStringParam(params, "chatJid", { required: true });
    const messageId = readStringParam(params, "messageId", { required: true });
    const accountId = readStringParam(params, "accountId");

    const result = await readFileWhatsApp(chatJid, messageId, {
      accountId: accountId ?? undefined,
    });

    if (!result) {
      return jsonResult({ ok: false, error: "Message not found or has no media" });
    }

    // Save the media buffer to a file
    const saved = await saveMediaBuffer(
      result.buffer,
      result.mimetype,
      "agent-download",
      50 * 1024 * 1024, // 50MB max
      result.fileName,
    );

    return jsonResult({
      ok: true,
      path: saved.path,
      mimetype: result.mimetype,
      fileName: result.fileName,
      size: result.buffer.length,
    });
  }

  if (action === "read") {
    if (!isActionEnabled("messages")) {
      throw new Error("WhatsApp message reading is disabled.");
    }
    const chatJid = readStringParam(params, "chatJid", { required: true });
    const accountId = readStringParam(params, "accountId");
    const limit = typeof params.limit === "number" ? params.limit : undefined;

    const result = await readWhatsAppMessages(chatJid, {
      accountId: accountId ?? "",
      limit,
    });

    return jsonResult({
      ok: true,
      messages: result.messages,
      count: result.messages.length,
    });
  }

  throw new Error(`Unsupported WhatsApp action: ${action}`);
}
