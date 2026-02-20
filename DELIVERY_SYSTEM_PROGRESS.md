# Intelligent Delivery System - Implementation Progress

## ✅ Phase 1 Complete: Core Services

### Implemented Files

**1. Task Analyzer** (`src/agents/task-analyzer.ts`)
- Analyzes tool calls to estimate task characteristics
- Classifies: duration (quick/moderate/long), complexity (simple/moderate/complex), work type
- Identifies slow tools (exec, web_search, browser, etc.)
- Re-evaluation logic for tasks that exceed estimates

**2. Engagement Monitor** (`src/agents/engagement-monitor.ts`)
- Tracks when user last sent message
- Determines if user is actively engaged (within 2min window)
- Provides engagement state for strategy decisions

**3. Delivery Strategy Selector** (`src/agents/delivery-strategy.ts`)
- Core decision logic: silent | batch | milestone | stream
- Rule-based strategy selection considering task + engagement
- Strategy escalation during execution (if task takes longer than expected)
- Tool-specific overrides support

### Strategy Decision Rules

```
1. User waiting + complex/long task → stream
2. Quick + simple → silent
3. Long + engaged user + complex → stream
4. Long + engaged user → milestone
5. Long + idle user → batch
6. Moderate + engaged → milestone
7. Moderate + idle → batch
8. Default → batch
```

### Escalation Logic

- Silent >30s → batch
- Batch >60s → milestone
- Milestone >120s → stream

## ⏳ Phase 2: Integration (Next)

### Integration Points

**A. Agent Start (pi-embedded-runner/run/attempt.ts)**

Before agent starts generating response:
```typescript
import { analyzeTask } from '../task-analyzer.js';
import { EngagementMonitor } from '../engagement-monitor.js';
import { selectDeliveryStrategy } from '../delivery-strategy.js';

// Create engagement monitor (per-session instance)
const engagementMonitor = new EngagementMonitor();

// On user message received
engagementMonitor.recordUserMessage();

// Before agent turn
const taskChars = analyzeTask({
  toolCalls: anticipatedToolCalls,
  messageText: userMessage.content
});

const engagement = engagementMonitor.getEngagement();
const decision = selectDeliveryStrategy(taskChars, engagement, config);

// Pass strategy to message handler
ctx.deliveryStrategy = decision.strategy;
```

**B. Message Update Handler (pi-embedded-subscribe.handlers.messages.ts)**

Enhance `handleMessageUpdate` to respect strategy:
```typescript
import { shouldSendUpdate } from '../delivery-strategy.js';

// In message update handler
const shouldSend = shouldSendUpdate({
  strategy: ctx.deliveryStrategy,
  toolCallComplete: isToolCallComplete,
  significantProgress: hasSignificantProgress,
  finalUpdate: isFinalUpdate
});

if (!shouldSend) {
  // Buffer the update, don't send yet
  ctx.messageBuffer.accumulate(text);
  return;
}

// Send the update
ctx.messageBuffer.flush();
```

**C. Duration Tracking (pi-embedded-runner/run/attempt.ts)**

Monitor task duration and escalate strategy if needed:
```typescript
import { shouldEscalateStrategy, reevaluateTaskDuration } from '../delivery-strategy.js';

// Track start time
const startTime = Date.now();

// Periodically check (every 30s)
const checkEscalation = () => {
  const elapsed = Date.now() - startTime;
  const escalation = shouldEscalateStrategy(
    ctx.deliveryStrategy,
    elapsed,
    taskChars
  );
  
  if (escalation.escalate) {
    ctx.deliveryStrategy = escalation.newStrategy;
    // Log telemetry
    logger.info(`Escalated delivery strategy: ${escalation.reason}`);
  }
};
```

**D. Configuration (config/types.ts)**

Add config schema:
```typescript
deliveryStrategy?: {
  enabled?: boolean;
  mode?: 'auto' | 'always-stream' | 'always-batch' | 'always-silent';
  thresholds?: {
    quickTaskSeconds?: number;
    moderateTaskSeconds?: number;
    engagementWindowSeconds?: number;
  };
  toolOverrides?: Record<string, 'silent' | 'batch' | 'milestone' | 'stream'>;
};
```

## 🧪 Testing Plan

### Test Cases

**1. Quick simple task (read file)**
- Expected: silent until complete
- Verify: single message at end

**2. Long research (user engaged)**
- Expected: milestone updates
- Verify: updates at tool completions

**3. Long research (user idle)**
- Expected: batch summary
- Verify: single message at end

**4. Complex coding (user watching)**
- Expected: stream progress
- Verify: incremental text updates

**5. Task exceeding estimate**
- Expected: strategy escalation
- Verify: switches from silent → batch after 30s

### Telemetry

Add logging at:
- Strategy selection
- Strategy escalation
- Update suppression (when batch/silent)
- Final delivery

Format:
```json
{
  "event": "delivery_strategy_selected",
  "strategy": "milestone",
  "reason": "moderate task + engaged user",
  "confidence": "high",
  "task": {
    "duration": "moderate",
    "complexity": "moderate",
    "toolCount": 3
  },
  "engagement": {
    "lastMessageAgo": 45000,
    "isActive": true
  }
}
```

## 🚧 Integration Risks

1. **Breaking existing streaming** - Need to preserve current behavior when disabled
2. **Message ordering** - Ensure batched messages don't arrive out of order
3. **Subagent interference** - Subagent completions should respect strategy
4. **Error handling** - If strategy selection fails, must have safe fallback

## 📋 Integration Checklist

- [ ] Add engagement monitor to session context
- [ ] Hook task analysis into agent start
- [ ] Integrate strategy decision into message handler
- [ ] Add duration tracking and escalation
- [ ] Implement message buffering for batch/silent
- [ ] Add configuration schema
- [ ] Add telemetry logging
- [ ] Test with quick tasks
- [ ] Test with long tasks (engaged user)
- [ ] Test with long tasks (idle user)
- [ ] Test strategy escalation
- [ ] Verify backward compatibility (disabled mode)
- [ ] User acceptance testing

## 🎯 Next Steps

1. **Review design with user** - Confirm approach before invasive integration
2. **Implement message buffer enhancement** - Add accumulation for batch/silent
3. **Hook into agent runner** - Integrate at agent start and message update
4. **Add configuration** - Enable/disable, thresholds, overrides
5. **Test thoroughly** - All scenarios, edge cases
6. **Deploy and monitor** - Watch telemetry, tune thresholds

---

**Status:** Phase 1 complete (core services)
**Next:** Integration into agent runner (requires careful testing)
**Priority:** High (user requested: "prioritize this, make it robust")

## ✅ Phase 1.5 Complete: Type Integration

### Files Modified

**1. `src/agents/pi-embedded-subscribe.types.ts`**
- Added imports for `DeliveryStrategy`, `TaskCharacteristics`, `UserEngagement`
- Extended `SubscribeEmbeddedPiSessionParams` with delivery strategy fields:
  - `deliveryStrategy?: DeliveryStrategy`
  - `taskCharacteristics?: TaskCharacteristics`
  - `userEngagement?: UserEngagement`

**2. `src/agents/pi-embedded-subscribe.handlers.types.ts`**
- Added imports for delivery strategy types
- Extended `EmbeddedPiSubscribeState` with tracking fields:
  - `deliveryStrategy?: DeliveryStrategy`
  - `taskCharacteristics?: TaskCharacteristics`
  - `userEngagement?: UserEngagement`
  - `deliveryStartTime?: number` (for duration monitoring)
  - `toolCallsCompleted: number` (for milestone tracking)

**3. `src/agents/pi-embedded-subscribe.ts`**
- Initialized delivery strategy state from params:
  ```typescript
  deliveryStrategy: params.deliveryStrategy,
  taskCharacteristics: params.taskCharacteristics,
  userEngagement: params.userEngagement,
  deliveryStartTime: Date.now(),
  toolCallsCompleted: 0,
  ```

### Integration Status

✅ Core services implemented (task-analyzer, engagement-monitor, delivery-strategy)
✅ Type system extended (params, state, context)  
✅ State initialization hooked in  
⏳ Next: Hook into agent runner (analyze task before subscription)  
⏳ Next: Modify message handlers (respect strategy)  
⏳ Next: Add configuration schema  
⏳ Next: Test all scenarios  

## 🚧 Phase 2: Agent Runner Integration (In Progress)

### Next Steps

**A. Agent Runner Hook (pi-embedded-runner/run/attempt.ts)**

Before `subscribeEmbeddedPiSession` call (~line 757):

```typescript
import { analyzeTask } from '../task-analyzer.js';
import { EngagementMonitor } from '../engagement-monitor.js';
import { selectDeliveryStrategy } from '../delivery-strategy.js';

// Create engagement monitor (per-session, persistent)
// TODO: Store in session context for reuse across turns
const engagement Monitor = new EngagementMonitor();
engagementMonitor.recordUserMessage();

// Analyze task (extract tool calls from session history)
const taskChars = analyzeTask({
  toolCalls: [], // TODO: Extract from session.messages or anticipate from user message
  messageText: userMessage?.content
});

// Select strategy
const engagement = engagementMonitor.getEngagement();
const decision = selectDeliveryStrategy(taskChars, engagement, config);

// Log telemetry
logger.info(`Delivery strategy selected: ${decision.strategy} (${decision.reason})`);

// Pass to subscription
const subscription = subscribeEmbeddedPiSession({
  // ... existing params
  deliveryStrategy: decision.strategy,
  taskCharacteristics: taskChars,
  userEngagement: engagement,
});
```

**B. Message Handler Modification (pi-embedded-subscribe.handlers.messages.ts)**

In `handleMessageUpdate`:

```typescript
import { shouldSendUpdate } from '../delivery-strategy.js';

// Check if we should send this update
const shouldSend = shouldSendUpdate({
  strategy: ctx.state.deliveryStrategy ?? 'stream', // fallback to stream
  toolCallComplete: false, // TODO: detect tool completion
  significantProgress: false, // TODO: detect significant progress
  finalUpdate: false, // TODO: detect final update
});

if (!shouldSend) {
  // Don't emit, buffer accumulates automatically
  return;
}

// Existing emit logic
```

**C. Tool Completion Tracking**

In tool result handlers:

```typescript
// When tool completes
ctx.state.toolCallsCompleted++;

// Check if milestone delivery
if (ctx.state.deliveryStrategy === 'milestone') {
  // Flush accumulated text as milestone update
  ctx.flushBlockReplyBuffer();
}
```

**D. Duration Monitoring & Escalation**

Add periodic check in subscription:

```typescript
import { shouldEscalateStrategy } from '../delivery-strategy.js';

// Check every 30s
setInterval(() => {
  if (!ctx.state.deliveryStrategy || !ctx.state.deliveryStartTime) return;
  
  const elapsed = Date.now() - ctx.state.deliveryStartTime;
  const escalation = shouldEscalateStrategy(
    ctx.state.deliveryStrategy,
    elapsed,
    ctx.state.taskCharacteristics!
  );
  
  if (escalation.escalate) {
    ctx.state.deliveryStrategy = escalation.newStrategy!;
    logger.info(`Escalated delivery strategy: ${escalation.reason}`);
  }
}, 30000);
```

---

**Status:** Type system complete, ready for runtime integration
**Next Session:** Hook task analysis into agent runner, modify message handlers
**Complexity:** Medium (requires careful integration with existing streaming logic)
