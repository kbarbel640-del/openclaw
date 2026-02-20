// Integration code for intelligent message delivery
// Add this BEFORE the subscribeEmbeddedPiSession call (around line 750)

// ═══════════════════════════════════════════════════════════════════════
// INTELLIGENT MESSAGE DELIVERY - Phase 2 Integration
// ═══════════════════════════════════════════════════════════════════════

// Step 1: Import delivery strategy modules (add to imports at top of file)
import { analyzeTask } from "../task-analyzer.js";
import { EngagementMonitor } from "../engagement-monitor.js";
import { selectDeliveryStrategy } from "../delivery-strategy.js";

// Step 2: Create engagement monitor (per-session, reusable across turns)
// TODO: Store in session context for persistence across turns
const engagementMonitor = new EngagementMonitor();
engagementMonitor.recordUserMessage();  // Mark user as actively engaged

// Step 3: Analyze task characteristics
// Extract recent messages to understand what work is anticipated
const recentMessages = activeSession.agent.messages.slice(-5);  // Last 5 messages
const lastUserMessage = recentMessages
  .toReversed()
  .find(m => m.role === "user");

const taskCharacteristics = analyzeTask({
  toolCalls: [],  // TODO: Extract from previous turns or anticipate from message
  messageText: lastUserMessage?.content?.[0]?.text || ""
});

// Step 4: Get engagement state
const userEngagement = engagementMonitor.getEngagement();

// Step 5: Select delivery strategy
const deliveryConfig = params.config?.agents?.defaults?.deliveryStrategy;
const strategyDecision = selectDeliveryStrategy(
  taskCharacteristics,
  userEngagement,
  deliveryConfig
);

// Log telemetry for learning
log.info(
  `Delivery strategy selected: ${strategyDecision.strategy} ` +
  `(${strategyDecision.reason}, confidence: ${strategyDecision.confidence})`
);

// Step 6: Pass to subscription (add these fields to subscribeEmbeddedPiSession call)
const subscription = subscribeEmbeddedPiSession({
  session: activeSession,
  runId: params.runId,
  // ... existing params ...
  
  // NEW: Delivery strategy fields
  deliveryStrategy: strategyDecision.strategy,
  taskCharacteristics,
  userEngagement,
  
  // ... rest of params ...
});
