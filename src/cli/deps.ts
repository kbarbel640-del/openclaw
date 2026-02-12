import type { OutboundSendDeps } from "../infra/outbound/deliver.js";
import { sendMessageSlack } from "../slack/send.js";
import { sendMessageTelegram } from "../telegram/send.js";

export type CliDeps = {
  sendMessageTelegram: typeof sendMessageTelegram;
  sendMessageSlack: typeof sendMessageSlack;
};

export function createDefaultDeps(): CliDeps {
  return {
    sendMessageTelegram,
    sendMessageSlack,
  };
}

// Provider docking: extend this mapping when adding new outbound send deps.
export function createOutboundSendDeps(deps: CliDeps): OutboundSendDeps {
  return {
    sendTelegram: deps.sendMessageTelegram,
    sendSlack: deps.sendMessageSlack,
  };
}
