import { resolveEmbeddedSessionLane } from "../../../agents/pi-embedded.js";
import { clearCommandLane } from "../../../process/command-queue.js";
import { clearFollowupQueue, FOLLOWUP_QUEUES } from "./state.js";
import { globalQueuePositionTracker } from "./position-tracker.js";

export type ClearSessionQueueResult = {
  followupCleared: number;
  laneCleared: number;
  keys: string[];
};

export function clearSessionQueues(keys: Array<string | undefined>): ClearSessionQueueResult {
  const seen = new Set<string>();
  let followupCleared = 0;
  let laneCleared = 0;
  const clearedKeys: string[] = [];

  for (const key of keys) {
    const cleaned = key?.trim();
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    clearedKeys.push(cleaned);

    // Get queue items before clearing to remove position reactions
    const queue = FOLLOWUP_QUEUES.get(cleaned);
    if (queue?.items.length) {
      // Clear position reactions for all items in queue
      void globalQueuePositionTracker.updateQueuePositions([]);
    }

    followupCleared += clearFollowupQueue(cleaned);
    laneCleared += clearCommandLane(resolveEmbeddedSessionLane(cleaned));
  }

  return { followupCleared, laneCleared, keys: clearedKeys };
}
