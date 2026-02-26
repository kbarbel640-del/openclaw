type QueueLaneSnapshot = {
  channelId: string;
  messageIds: string[];
};

type QueueSnapshot = {
  size: number;
  lanes: QueueLaneSnapshot[];
};

const lanes = new Map<string, string[]>();

function normalizeChannelId(channelId: string): string {
  return channelId.trim();
}

function normalizeMessageId(messageId: string): string {
  return messageId.trim();
}

/**
 * Claim a queue slot for a Discord message lifecycle within a channel lane.
 * hasPriorPendingWork means this message is not first in that lane.
 */
export function claimDiscordStatusReactionQueue(
  channelId: string,
  messageId: string,
): {
  hasPriorPendingWork: boolean;
  position: number;
} {
  const laneKey = normalizeChannelId(channelId);
  const normalizedMessageId = normalizeMessageId(messageId);
  if (!laneKey || !normalizedMessageId) {
    return { hasPriorPendingWork: false, position: 0 };
  }

  const lane = lanes.get(laneKey) ?? [];
  let position = lane.indexOf(normalizedMessageId);
  if (position < 0) {
    lane.push(normalizedMessageId);
    position = lane.length - 1;
  }
  lanes.set(laneKey, lane);
  return {
    hasPriorPendingWork: position > 0,
    position,
  };
}

/**
 * Release a previously claimed queue slot.
 */
export function releaseDiscordStatusReactionQueue(channelId: string, messageId: string): void {
  const laneKey = normalizeChannelId(channelId);
  const normalizedMessageId = normalizeMessageId(messageId);
  if (!laneKey || !normalizedMessageId) {
    return;
  }
  const lane = lanes.get(laneKey);
  if (!lane) {
    return;
  }
  const nextLane = lane.filter((entry) => entry !== normalizedMessageId);
  if (nextLane.length === 0) {
    lanes.delete(laneKey);
    return;
  }
  lanes.set(laneKey, nextLane);
}

function getQueueSnapshot(): QueueSnapshot {
  const laneEntries = Array.from(lanes.entries())
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([channelId, messageIds]) => ({ channelId, messageIds: [...messageIds] }));
  return {
    size: laneEntries.reduce((sum, lane) => sum + lane.messageIds.length, 0),
    lanes: laneEntries,
  };
}

function resetQueueForTests(): void {
  lanes.clear();
}

export const __testing = {
  getQueueSnapshot,
  resetQueueForTests,
};
