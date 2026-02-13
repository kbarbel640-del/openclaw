# Slack Queue Position Indicators

## Overview

Queue Position Indicators provide real-time visual feedback to users in Slack when their messages are queued for AI processing. When multiple messages stack up waiting for the AI to respond, users can see their position in the queue via emoji reactions.

## Features

- **Position Reactions**: Messages receive number emoji reactions (1️⃣, 2️⃣, 3️⃣, etc.) indicating their position in the queue
- **Dynamic Updates**: Reactions update automatically as the queue changes (messages ahead complete processing)
- **Processing Indicator**: When a message starts processing, the position reaction is replaced with a processing emoji (⏳)
- **Automatic Cleanup**: Reactions are automatically removed when processing completes or when messages are removed from the queue
- **Multi-Account Support**: Works correctly with multiple Slack accounts/workspaces
- **Configurable**: Position emojis, processing emoji, and max position can be customized

## How It Works

### Message Flow

1. **Enqueue**: When a message enters the queue, it receives a position reaction (1️⃣ for first, 2️⃣ for second, etc.)
2. **Position Updates**: As messages ahead complete and are removed from the queue, remaining messages move up and their reactions update
3. **Processing Start**: When a message starts being processed, the position reaction is removed and replaced with ⏳
4. **Processing Complete**: The processing indicator is removed when the AI finishes responding
5. **Queue Clear**: If the queue is cleared or a message is removed, all position reactions are cleaned up

### Architecture

The implementation consists of:

- **`QueuePositionTracker`** (`src/auto-reply/reply/queue/position-tracker.ts`): Core class that manages position reactions
- **Integration hooks** in:
  - `enqueue.ts`: Updates positions after enqueuing
  - `drain.ts`: Marks as processing and updates positions during drain
  - `cleanup.ts`: Clears reactions when queues are cleared
  - `state.ts`: Clears reactions when queue state is reset

## Configuration

The queue position tracker can be configured globally or per-instance:

```typescript
import { QueuePositionTracker } from "./auto-reply/reply/queue/position-tracker.js";

const tracker = new QueuePositionTracker({
  // Enable/disable the feature (default: true)
  enabled: true,

  // Custom position emojis (default: ["one", "two", "three", ...])
  positionEmojis: ["fire", "star", "rocket"],

  // Processing indicator emoji (default: "hourglass_flowing_sand")
  processingEmoji: "rocket",

  // Maximum position to show (default: 9)
  // Messages beyond this position won't get a reaction to avoid clutter
  maxPosition: 5,
});
```

### Global Instance

The code uses a global tracker instance by default:

```typescript
import { globalQueuePositionTracker } from "./auto-reply/reply/queue.js";

// The global instance is automatically used by the queue system
// No additional configuration needed for basic usage
```

### Disabling the Feature

To disable queue position indicators:

```typescript
import { globalQueuePositionTracker } from "./auto-reply/reply/queue.js";

globalQueuePositionTracker.config.enabled = false;
```

Or create a disabled tracker:

```typescript
const tracker = new QueuePositionTracker({ enabled: false });
```

## Edge Cases Handled

1. **Message Deletion**: Position reactions are cleaned up when messages are removed from the queue
2. **Queue Clear**: All position reactions are removed when a queue is cleared
3. **Bot Restart**: Reactions are stateless; if the bot restarts, old reactions remain but new queue state will be tracked correctly
4. **Non-Slack Messages**: Only Slack messages with `originatingChannel: "slack"` receive position indicators
5. **Missing Metadata**: Messages without `channelId` or `messageId` are skipped
6. **API Failures**: Reaction add/remove failures are logged but don't crash the queue processing
7. **Collect Mode**: When multiple messages are collected into one processing run, all items are marked as processing
8. **Beyond Max Position**: Messages beyond `maxPosition` don't receive reactions to avoid clutter

## Testing

The implementation includes comprehensive tests in `position-tracker.test.ts`:

```bash
# Run the queue position indicator tests
pnpm test src/auto-reply/reply/queue/position-tracker.test.ts
```

Test coverage includes:
- Position reaction addition and updates
- Processing indicator management
- Queue position changes
- Custom configuration
- Error handling
- Edge cases (non-Slack messages, missing metadata, etc.)

## Performance Considerations

- **Async Operations**: All Slack API calls are asynchronous and don't block queue processing
- **Deduplication**: Position reactions are only updated when positions actually change
- **Cleanup**: Reactions are automatically cleaned up to avoid accumulating stale data
- **Rate Limiting**: The implementation respects Slack's API rate limits by using the same client infrastructure

## Examples

### Basic Usage

```typescript
import { enqueueFollowupRun } from "./auto-reply/reply/queue.js";

// Queue a message (position indicator added automatically)
const run: FollowupRun = {
  prompt: "Help me with this task",
  messageId: "1234567890.123456",
  originatingChannel: "slack",
  originatingTo: "C0123456789",
  originatingAccountId: "T0123456789",
  // ... other fields
};

enqueueFollowupRun("session-key", run, settings);
// Message automatically gets position reaction (1️⃣, 2️⃣, etc.)
```

### Custom Configuration

```typescript
import { QueuePositionTracker } from "./auto-reply/reply/queue/position-tracker.js";

// Use custom emojis for positions
const tracker = new QueuePositionTracker({
  enabled: true,
  positionEmojis: ["alarm_clock", "timer_clock", "stopwatch"],
  processingEmoji: "gear",
  maxPosition: 3,
});

// Use this tracker instead of the global one
await tracker.updateQueuePositions(queueItems);
```

### Manual Control

```typescript
import { globalQueuePositionTracker } from "./auto-reply/reply/queue.js";

// Manually mark a message as processing
await globalQueuePositionTracker.markAsProcessing(run);

// Manually remove processing indicator
await globalQueuePositionTracker.removeProcessingIndicator(run);

// Clear all tracked reactions
await globalQueuePositionTracker.clearAll();
```

## Future Enhancements

Potential improvements for future versions:

1. **Persistence**: Store position state to restore after bot restarts
2. **Estimated Wait Time**: Calculate and show estimated wait time instead of just position
3. **Queue Statistics**: Add reactions showing total queue depth or average wait time
4. **Priority Indicators**: Different emojis for priority vs regular messages
5. **User Notifications**: Send DM notifications when a message moves to the front of the queue
6. **Analytics**: Track queue metrics (depth over time, wait times, etc.)

## Troubleshooting

### Reactions Not Appearing

1. Check that the bot has `reactions:write` permission in Slack
2. Verify `enabled: true` in configuration
3. Ensure messages have `originatingChannel: "slack"` set
4. Check that `messageId` and `originatingTo` (channel ID) are present

### Reactions Not Updating

1. Check logs for Slack API errors
2. Verify network connectivity to Slack API
3. Check rate limiting (though the implementation handles this gracefully)

### Stale Reactions After Restart

This is expected behavior. The tracker is stateless and doesn't persist across restarts. Old reactions will remain until manually removed or the message is deleted. Future versions may add persistence to handle this case.

## Related Documentation

- [Slack Web API - Reactions](https://api.slack.com/methods/reactions.add)
- [OpenClaw Queue System](./queue-system.md) (if exists)
- [Slack Integration](./slack-integration.md) (if exists)
