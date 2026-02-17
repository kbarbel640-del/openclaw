import { defaultRuntime } from "../../../runtime.js";
import {
  buildCollectPrompt,
  buildQueueSummaryPrompt,
  hasCrossChannelItems,
  waitForQueueDebounce,
} from "../../../utils/queue-helpers.js";
import { isRoutableChannel } from "../route-reply.js";
import { FOLLOWUP_QUEUES } from "./state.js";
import type { FollowupRun } from "./types.js";

function previewQueueSummaryPrompt(queue: {
  dropPolicy: "summarize" | "old" | "new";
  droppedCount: number;
  summaryLines: string[];
}): string | undefined {
  return buildQueueSummaryPrompt({
    state: {
      dropPolicy: queue.dropPolicy,
      droppedCount: queue.droppedCount,
      summaryLines: [...queue.summaryLines],
    },
    noun: "message",
  });
}

function clearQueueSummaryState(queue: { droppedCount: number; summaryLines: string[] }): void {
  queue.droppedCount = 0;
  queue.summaryLines = [];
}

export function scheduleFollowupDrain(
  key: string,
  runFollowup: (run: FollowupRun) => Promise<void>,
): void {
  const queue = FOLLOWUP_QUEUES.get(key);
  if (!queue || queue.draining) {
    return;
  }
  queue.draining = true;
  void (async () => {
    try {
      const LOCK_RETRY_DELAY_MS = 5_000;
      const MAX_LOCK_RETRIES = 3;

      /** Run a followup, handling session-lock errors with backoff + re-enqueue. */
      const runWithLockRetry = async (
        item: FollowupRun,
        restoreOnLock?: () => void,
      ): Promise<void> => {
        try {
          await runFollowup(item);
          // Reset lock retry counter on success.
          queue.lockRetryCount = 0;
        } catch (err) {
          if (err instanceof Error && err.message.includes("session file locked")) {
            const retryCount = queue.lockRetryCount ?? 0;
            if (retryCount >= MAX_LOCK_RETRIES) {
              defaultRuntime.error?.(
                `Session locked after ${MAX_LOCK_RETRIES} retries in drain, dropping: ${key}`,
              );
              queue.lockRetryCount = 0;
              return;
            }
            defaultRuntime.log?.(
              `Session locked in drain (retry ${retryCount + 1}/${MAX_LOCK_RETRIES}), re-enqueueing: ${key}`,
            );
            queue.lockRetryCount = retryCount + 1;
            if (restoreOnLock) {
              // Collect mode: restore original items instead of the synthetic merged prompt.
              restoreOnLock();
            } else {
              // Individual mode: re-insert at front to preserve FIFO order.
              // This is a restore (the item was already shift()ed from the
              // queue), not a new addition, so cap checks don't apply.
              queue.items.unshift(item);
            }
            queue.lastEnqueuedAt = Date.now();
            await new Promise<void>((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
            return;
          }
          throw err;
        }
      };

      let forceIndividualCollect = false;
      while (queue.items.length > 0 || queue.droppedCount > 0) {
        await waitForQueueDebounce(queue);
        if (queue.mode === "collect") {
          // Once the batch is mixed, never collect again within this drain.
          // Prevents “collect after shift” collapsing different targets.
          //
          // Debug: `pnpm test src/auto-reply/reply/queue.collect-routing.test.ts`
          if (forceIndividualCollect) {
            const next = queue.items[0];
            if (!next) {
              break;
            }
            await runWithLockRetry(next);
            queue.items.shift();
            continue;
          }

          // Check if messages span multiple channels.
          // If so, process individually to preserve per-message routing.
          const isCrossChannel = hasCrossChannelItems(queue.items, (item) => {
            const channel = item.originatingChannel;
            const to = item.originatingTo;
            const accountId = item.originatingAccountId;
            const threadId = item.originatingThreadId;
            if (!channel && !to && !accountId && threadId == null) {
              return {};
            }
            if (!isRoutableChannel(channel) || !to) {
              return { cross: true };
            }
            const threadKey = threadId != null ? String(threadId) : "";
            return {
              key: [channel, to, accountId || "", threadKey].join("|"),
            };
          });

          if (isCrossChannel) {
            forceIndividualCollect = true;
            const next = queue.items[0];
            if (!next) {
              break;
            }
            await runWithLockRetry(next);
            queue.items.shift();
            continue;
          }

          const items = queue.items.splice(0, queue.items.length);
          // Save summary state before buildQueueSummaryPrompt clears it,
          // so we can restore it if a lock error triggers a retry.
          const savedDroppedCount = queue.droppedCount;
          const savedSummaryLines = [...queue.summaryLines];
          const summary = buildQueueSummaryPrompt({ state: queue, noun: "message" });
          const run = items.at(-1)?.run ?? queue.lastRun;
          if (!run) {
            break;
          }

          // Preserve originating channel from items when collecting same-channel.
          const originatingChannel = items.find((i) => i.originatingChannel)?.originatingChannel;
          const originatingTo = items.find((i) => i.originatingTo)?.originatingTo;
          const originatingAccountId = items.find(
            (i) => i.originatingAccountId,
          )?.originatingAccountId;
          const originatingThreadId = items.find(
            (i) => i.originatingThreadId != null,
          )?.originatingThreadId;

          const prompt = buildCollectPrompt({
            title: "[Queued messages while agent was busy]",
            items,
            summary,
            renderItem: (item, idx) => `---\nQueued #${idx + 1}\n${item.prompt}`.trim(),
          });
          await runWithLockRetry(
            {
              prompt,
              run,
              enqueuedAt: Date.now(),
              originatingChannel,
              originatingTo,
              originatingAccountId,
              originatingThreadId,
            },
            // On lock, restore the original items and summary state so they
            // can be re-collected on the next attempt.  Merge any concurrent
            // overflow that accumulated while the locked run was in-flight
            // instead of blindly overwriting (P2), and re-apply the cap so
            // the queue never exceeds its configured limit (P1).
            () => {
              queue.items.unshift(...items);
              // Merge: add back the saved counts, then layer concurrent ones on top.
              queue.droppedCount += savedDroppedCount;
              queue.summaryLines.push(...savedSummaryLines);
              // Enforce cap directly instead of using applyQueueDropPolicy,
              // which drops `len - cap + 1` (designed for pre-enqueue) and
              // would over-trim by one item in this restore context.
              const cap = queue.cap;
              if (cap > 0 && queue.items.length > cap) {
                if (queue.dropPolicy === "new") {
                  // Drop the newest (tail) items that were concurrently enqueued.
                  queue.items.length = cap;
                } else {
                  // Drop oldest (front) items, summarizing if configured.
                  const excess = queue.items.length - cap;
                  const dropped = queue.items.splice(0, excess);
                  if (queue.dropPolicy === "summarize") {
                    for (const item of dropped) {
                      queue.droppedCount += 1;
                      queue.summaryLines.push(item.prompt.slice(0, 140));
                    }
                  }
                }
              }
              // Bound summary lines to cap so overflow prompts stay bounded.
              const summaryLimit = Math.max(0, cap);
              if (queue.summaryLines.length > summaryLimit) {
                queue.summaryLines.splice(0, queue.summaryLines.length - summaryLimit);
              }
            },
          );
          continue;
        }

        const summaryPrompt = previewQueueSummaryPrompt(queue);
        if (summaryPrompt) {
          const run = queue.lastRun;
          if (!run) {
            break;
          }
          await runWithLockRetry({
            prompt: summaryPrompt,
            run,
            enqueuedAt: Date.now(),
          });
          queue.items.shift();
          clearQueueSummaryState(queue);
          continue;
        }

        const next = queue.items[0];
        if (!next) {
          break;
        }
        await runWithLockRetry(next);
        queue.items.shift();
      }
    } catch (err) {
      queue.lastEnqueuedAt = Date.now();
      defaultRuntime.error?.(`followup queue drain failed for ${key}: ${String(err)}`);
    } finally {
      queue.draining = false;
      if (queue.items.length === 0 && queue.droppedCount === 0) {
        FOLLOWUP_QUEUES.delete(key);
      } else {
        scheduleFollowupDrain(key, runFollowup);
      }
    }
  })();
}
