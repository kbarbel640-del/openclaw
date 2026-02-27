import { recordPendingHistoryEntryIfEnabled } from "../../../auto-reply/reply/history.js";
import { normalizeMentionText } from "../../../auto-reply/reply/mentions.js";
import type { loadConfig } from "../../../config/config.js";
import { buildMentionConfig } from "../mentions.js";
import type { WebInboundMsg } from "../types.js";

export type DmHistoryEntry = {
  sender: string;
  body: string;
  timestamp?: number;
  id?: string;
  fromMe?: boolean;
};

export const DEFAULT_DM_HISTORY_LIMIT = 20;

function mentionsAgent(body: string, mentionRegexes: RegExp[]): boolean {
  const clean = normalizeMentionText(body);
  return mentionRegexes.some((re) => re.test(clean));
}

function recordPendingDmHistoryEntry(params: {
  msg: WebInboundMsg;
  dmHistories: Map<string, DmHistoryEntry[]>;
  dmHistoryKey: string;
  dmHistoryLimit: number;
}) {
  const sender = params.msg.pushName ?? params.msg.selfE164 ?? "(self)";
  recordPendingHistoryEntryIfEnabled({
    historyMap: params.dmHistories,
    historyKey: params.dmHistoryKey,
    limit: params.dmHistoryLimit,
    entry: {
      sender,
      body: params.msg.body,
      timestamp: params.msg.timestamp,
      id: params.msg.id,
      fromMe: true,
    },
  });
}

/**
 * Gate outbound DM messages so they are buffered silently (zero LLM tokens)
 * unless they explicitly mention the agent.
 *
 * Returns `shouldProcess: false` when the message was buffered.
 * Returns `shouldProcess: true` with an optional `dmHistory` snapshot when
 * the message should be forwarded to the LLM (includes any previously
 * buffered outbound messages as context).
 */
export function applyDmGating(params: {
  cfg: ReturnType<typeof loadConfig>;
  msg: WebInboundMsg;
  dmHistoryKey: string;
  agentId: string;
  dmHistories: Map<string, DmHistoryEntry[]>;
  dmHistoryLimit: number;
  logVerbose: (msg: string) => void;
}): { shouldProcess: boolean; dmHistory?: DmHistoryEntry[] } {
  // Only gate outbound (fromMe) messages in DMs.
  if (!params.msg.fromMe) {
    // Inbound message from contact — always process.
    // Return a snapshot of any buffered outbound messages as context.
    const history = params.dmHistories.get(params.dmHistoryKey);
    return {
      shouldProcess: true,
      dmHistory: history && history.length > 0 ? [...history] : undefined,
    };
  }

  // Outbound message from owner — check if it mentions the agent.
  const mentionConfig = buildMentionConfig(params.cfg, params.agentId);
  if (mentionsAgent(params.msg.body, mentionConfig.mentionRegexes)) {
    // Owner mentioned the agent — process with DM history as context.
    const bufferLen = (params.dmHistories.get(params.dmHistoryKey) ?? []).length;
    params.logVerbose(
      `DM from owner mentions agent, processing with ${bufferLen} buffered entries`,
    );
    const history = params.dmHistories.get(params.dmHistoryKey);
    return {
      shouldProcess: true,
      dmHistory: history && history.length > 0 ? [...history] : undefined,
    };
  }

  // Outbound without agent mention — buffer silently.
  params.logVerbose(`Buffering outbound DM (no agent mention): ${params.msg.body.slice(0, 80)}`);
  recordPendingDmHistoryEntry({
    msg: params.msg,
    dmHistories: params.dmHistories,
    dmHistoryKey: params.dmHistoryKey,
    dmHistoryLimit: params.dmHistoryLimit,
  });
  return { shouldProcess: false };
}
