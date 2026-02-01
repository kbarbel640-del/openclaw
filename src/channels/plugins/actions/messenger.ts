/**
 * Messenger message action adapter.
 *
 * Handles agent tool actions for Messenger channel.
 */

import type { ChannelMessageActionAdapter, ChannelMessageActionName } from "../types.js";
import { createActionGate, jsonResult, readStringParam } from "../../../agents/tools/common.js";
import { listEnabledMessengerAccounts } from "../../../messenger/accounts.js";
import { sendMessageMessenger } from "../../../messenger/send.js";

const providerId = "messenger";

function readMessengerSendParams(params: Record<string, unknown>) {
  const to = readStringParam(params, "to", { required: true });
  const mediaUrl = readStringParam(params, "media", { trim: false });
  const message = readStringParam(params, "message", { required: !mediaUrl, allowEmpty: true });
  const caption = readStringParam(params, "caption", { allowEmpty: true });
  const content = message || caption || "";
  return {
    to,
    content,
    mediaUrl: mediaUrl ?? undefined,
  };
}

export const messengerMessageActions: ChannelMessageActionAdapter = {
  listActions: ({ cfg }) => {
    const accounts = listEnabledMessengerAccounts(cfg).filter(
      (account) => account.tokenSource !== "none",
    );
    if (accounts.length === 0) {
      return [];
    }
    const gate = createActionGate(cfg.channels?.messenger?.actions);
    const actions = new Set<ChannelMessageActionName>(["send"]);

    // Add reaction support if enabled
    if (gate("reactions", true)) {
      actions.add("react");
    }

    return Array.from(actions);
  },

  supportsButtons: ({ cfg }) => {
    // Messenger supports quick replies and button templates
    const accounts = listEnabledMessengerAccounts(cfg).filter(
      (account) => account.tokenSource !== "none",
    );
    return accounts.length > 0;
  },

  extractToolSend: ({ args }) => {
    const action = typeof args.action === "string" ? args.action.trim() : "";
    if (action !== "sendMessage") {
      return null;
    }
    const to = typeof args.to === "string" ? args.to : undefined;
    if (!to) {
      return null;
    }
    const accountId = typeof args.accountId === "string" ? args.accountId.trim() : undefined;
    return { to, accountId };
  },

  handleAction: async ({ action, params, accountId }) => {
    if (action === "send") {
      const sendParams = readMessengerSendParams(params);
      const result = await sendMessageMessenger(sendParams.to, sendParams.content, {
        mediaUrl: sendParams.mediaUrl,
        accountId: accountId ?? undefined,
        verbose: false,
      });
      return jsonResult({
        ok: true,
        messageId: result.messageId,
        recipientId: result.recipientId,
      });
    }

    throw new Error(`Action ${action} is not supported for provider ${providerId}.`);
  },
};
