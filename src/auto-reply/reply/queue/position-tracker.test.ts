import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueuePositionTracker } from "./position-tracker.js";
import type { FollowupRun } from "./types.js";
import * as slackActions from "../../../slack/actions.js";

// Mock the slack actions module
vi.mock("../../../slack/actions.js", () => ({
  reactSlackMessage: vi.fn(),
  removeSlackReaction: vi.fn(),
}));

// Mock the runtime module
vi.mock("../../../runtime.js", () => ({
  defaultRuntime: {
    error: vi.fn(),
  },
}));

describe("QueuePositionTracker", () => {
  let tracker: QueuePositionTracker;

  beforeEach(() => {
    tracker = new QueuePositionTracker({ enabled: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await tracker.clearAll();
  });

  const createMockFollowupRun = (
    messageId: string,
    channelId = "C123",
    accountId = "acc1",
  ): FollowupRun => ({
    prompt: "test prompt",
    messageId,
    enqueuedAt: Date.now(),
    originatingChannel: "slack",
    originatingTo: channelId,
    originatingAccountId: accountId,
    run: {
      agentId: "agent1",
      agentDir: "/agents/test",
      sessionId: "session1",
      sessionFile: "/sessions/test.json",
      workspaceDir: "/workspace",
      config: {} as any,
      provider: "slack",
      model: "claude-3-5-sonnet-20241022",
      timeoutMs: 30000,
      blockReplyBreak: "message_end",
    },
  });

  describe("updateQueuePositions", () => {
    it("should add position reactions to queued messages", async () => {
      const items = [
        createMockFollowupRun("msg1"),
        createMockFollowupRun("msg2"),
        createMockFollowupRun("msg3"),
      ];

      await tracker.updateQueuePositions(items);

      expect(slackActions.reactSlackMessage).toHaveBeenCalledTimes(3);
      expect(slackActions.reactSlackMessage).toHaveBeenNthCalledWith(
        1,
        "C123",
        "msg1",
        "one",
        { accountId: "acc1" },
      );
      expect(slackActions.reactSlackMessage).toHaveBeenNthCalledWith(
        2,
        "C123",
        "msg2",
        "two",
        { accountId: "acc1" },
      );
      expect(slackActions.reactSlackMessage).toHaveBeenNthCalledWith(
        3,
        "C123",
        "msg3",
        "three",
        { accountId: "acc1" },
      );
    });

    it("should update position reactions when queue order changes", async () => {
      const items = [createMockFollowupRun("msg1"), createMockFollowupRun("msg2")];

      // Initial queue
      await tracker.updateQueuePositions(items);
      vi.clearAllMocks();

      // First item removed, msg2 should move to position 1
      const updatedItems = [createMockFollowupRun("msg2")];
      await tracker.updateQueuePositions(updatedItems);

      // Should remove old reaction (two) and add new reaction (one)
      expect(slackActions.removeSlackReaction).toHaveBeenCalledWith(
        "C123",
        "msg2",
        "two",
        { accountId: "acc1" },
      );
      expect(slackActions.reactSlackMessage).toHaveBeenCalledWith("C123", "msg2", "one", {
        accountId: "acc1",
      });
    });

    it("should remove reactions when messages are removed from queue", async () => {
      const items = [createMockFollowupRun("msg1"), createMockFollowupRun("msg2")];

      await tracker.updateQueuePositions(items);
      vi.clearAllMocks();

      // All messages removed
      await tracker.updateQueuePositions([]);

      expect(slackActions.removeSlackReaction).toHaveBeenCalledTimes(2);
      expect(slackActions.removeSlackReaction).toHaveBeenCalledWith("C123", "msg1", "one");
      expect(slackActions.removeSlackReaction).toHaveBeenCalledWith("C123", "msg2", "two");
    });

    it("should not add reactions beyond maxPosition", async () => {
      const trackerWithLimit = new QueuePositionTracker({ enabled: true, maxPosition: 2 });

      const items = [
        createMockFollowupRun("msg1"),
        createMockFollowupRun("msg2"),
        createMockFollowupRun("msg3"),
      ];

      await trackerWithLimit.updateQueuePositions(items);

      expect(slackActions.reactSlackMessage).toHaveBeenCalledTimes(2);
      expect(slackActions.reactSlackMessage).toHaveBeenCalledWith("C123", "msg1", "one", {
        accountId: "acc1",
      });
      expect(slackActions.reactSlackMessage).toHaveBeenCalledWith("C123", "msg2", "two", {
        accountId: "acc1",
      });
      // msg3 should not get a reaction
      expect(slackActions.reactSlackMessage).not.toHaveBeenCalledWith(
        expect.anything(),
        "msg3",
        expect.anything(),
        expect.anything(),
      );
    });

    it("should skip non-Slack messages", async () => {
      const telegramRun: FollowupRun = {
        prompt: "test prompt",
        messageId: "tg1",
        enqueuedAt: Date.now(),
        originatingChannel: "telegram",
        originatingTo: "chat123",
        run: {} as any,
      };

      await tracker.updateQueuePositions([telegramRun]);

      expect(slackActions.reactSlackMessage).not.toHaveBeenCalled();
    });

    it("should skip messages without channel or messageId", async () => {
      const incompleteRun: FollowupRun = {
        prompt: "test prompt",
        enqueuedAt: Date.now(),
        originatingChannel: "slack",
        // Missing originatingTo and messageId
        run: {} as any,
      };

      await tracker.updateQueuePositions([incompleteRun]);

      expect(slackActions.reactSlackMessage).not.toHaveBeenCalled();
    });

    it("should not update if disabled", async () => {
      const disabledTracker = new QueuePositionTracker({ enabled: false });
      const items = [createMockFollowupRun("msg1")];

      await disabledTracker.updateQueuePositions(items);

      expect(slackActions.reactSlackMessage).not.toHaveBeenCalled();
    });
  });

  describe("markAsProcessing", () => {
    it("should replace position reaction with processing emoji", async () => {
      const run = createMockFollowupRun("msg1");

      // Add position reaction first
      await tracker.updateQueuePositions([run]);
      vi.clearAllMocks();

      // Mark as processing
      await tracker.markAsProcessing(run);

      expect(slackActions.removeSlackReaction).toHaveBeenCalledWith("C123", "msg1", "one", {
        accountId: "acc1",
      });
      expect(slackActions.reactSlackMessage).toHaveBeenCalledWith(
        "C123",
        "msg1",
        "hourglass_flowing_sand",
        { accountId: "acc1" },
      );
    });

    it("should add processing emoji even if no position was set", async () => {
      const run = createMockFollowupRun("msg1");

      await tracker.markAsProcessing(run);

      expect(slackActions.reactSlackMessage).toHaveBeenCalledWith(
        "C123",
        "msg1",
        "hourglass_flowing_sand",
        { accountId: "acc1" },
      );
    });

    it("should use custom processing emoji if configured", async () => {
      const customTracker = new QueuePositionTracker({
        enabled: true,
        processingEmoji: "rocket",
      });
      const run = createMockFollowupRun("msg1");

      await customTracker.markAsProcessing(run);

      expect(slackActions.reactSlackMessage).toHaveBeenCalledWith("C123", "msg1", "rocket", {
        accountId: "acc1",
      });
    });
  });

  describe("removeProcessingIndicator", () => {
    it("should remove processing emoji from message", async () => {
      const run = createMockFollowupRun("msg1");

      await tracker.markAsProcessing(run);
      vi.clearAllMocks();

      await tracker.removeProcessingIndicator(run);

      expect(slackActions.removeSlackReaction).toHaveBeenCalledWith(
        "C123",
        "msg1",
        "hourglass_flowing_sand",
        { accountId: "acc1" },
      );
    });
  });

  describe("clearAll", () => {
    it("should remove all tracked position reactions", async () => {
      const items = [createMockFollowupRun("msg1"), createMockFollowupRun("msg2")];

      await tracker.updateQueuePositions(items);
      vi.clearAllMocks();

      await tracker.clearAll();

      expect(slackActions.removeSlackReaction).toHaveBeenCalledTimes(2);
      expect(slackActions.removeSlackReaction).toHaveBeenCalledWith("C123", "msg1", "one");
      expect(slackActions.removeSlackReaction).toHaveBeenCalledWith("C123", "msg2", "two");
    });
  });

  describe("custom configuration", () => {
    it("should use custom position emojis", async () => {
      const customTracker = new QueuePositionTracker({
        enabled: true,
        positionEmojis: ["fire", "star", "rocket"],
      });

      const items = [
        createMockFollowupRun("msg1"),
        createMockFollowupRun("msg2"),
        createMockFollowupRun("msg3"),
      ];

      await customTracker.updateQueuePositions(items);

      expect(slackActions.reactSlackMessage).toHaveBeenCalledWith("C123", "msg1", "fire", {
        accountId: "acc1",
      });
      expect(slackActions.reactSlackMessage).toHaveBeenCalledWith("C123", "msg2", "star", {
        accountId: "acc1",
      });
      expect(slackActions.reactSlackMessage).toHaveBeenCalledWith("C123", "msg3", "rocket", {
        accountId: "acc1",
      });
    });
  });

  describe("error handling", () => {
    it("should continue on reaction add failure", async () => {
      vi.mocked(slackActions.reactSlackMessage).mockRejectedValueOnce(
        new Error("Slack API error"),
      );

      const items = [createMockFollowupRun("msg1"), createMockFollowupRun("msg2")];

      await tracker.updateQueuePositions(items);

      // Should still try to add second reaction despite first failing
      expect(slackActions.reactSlackMessage).toHaveBeenCalledTimes(2);
    });

    it("should continue on reaction remove failure", async () => {
      const items = [createMockFollowupRun("msg1")];
      await tracker.updateQueuePositions(items);

      vi.mocked(slackActions.removeSlackReaction).mockRejectedValueOnce(
        new Error("Slack API error"),
      );

      await tracker.updateQueuePositions([]);

      // Should have attempted to remove despite error
      expect(slackActions.removeSlackReaction).toHaveBeenCalled();
    });
  });
});
