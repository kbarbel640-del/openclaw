/**
 * Usage Example: Session Continuation with CoreMemories
 *
 * This shows how to integrate session continuation into OpenClaw
 */

/* eslint-disable no-unused-vars */

import { CoreMemories } from "./index.js";
import { onSessionStart, heartbeatSessionCheck } from "./session-continuation-integration.js";

// ============================================================================
// EXAMPLE 1: On Gateway/Session Start
// ============================================================================

async function onGatewayOpen() {
  // Initialize CoreMemories
  const cm = await CoreMemories.getInstance({
    workspace: "./.openclaw",
    compression: "auto",
  });

  // Check if we should continue previous session
  await onSessionStart(cm, (message) => {
    // Send message to user via their channel
    console.log(message);
    // In real implementation:
    // slack.send({ channel: userSlackChannel, message })
    // or webSocket.send(message)
  });
}

// Example outputs based on gap:
// Gap < 2h: (nothing - silent)
// Gap 2-6h: "👋 Hey! Still working on the Card Sync launch?"
// Gap 6h+:
//   👋 Welcome back!
//
//   **Last time we were working on:**
//   • 🎯 Card Sync launch (next month - high priority)
//   • 📝 PR #7480 CoreMemories (needs fixes)
//
//   Want to continue with Card Sync or start fresh?

// ============================================================================
// EXAMPLE 2: HEARTBEAT Integration
// ============================================================================

async function onHeartbeat() {
  const cm = await CoreMemories.getInstance();

  // This runs every 6 hours:
  // 1. Compresses Flash memories older than 48h → Warm
  // 2. Updates keyword indices
  // 3. Checks for high-priority memories
  await heartbeatSessionCheck(cm);
}

// ============================================================================
// EXAMPLE 3: User Says "Continue"
// ============================================================================

async function onUserContinues(topic: string) {
  const cm = await CoreMemories.getInstance();

  // Load context for the topic
  const results = await cm.findByKeyword(topic);

  if (results.length > 0) {
    // Build prompt from memory
    const context = results
      .slice(0, 3)
      .map((m) => m.content)
      .join("\n---\n");

    // Use as system prompt augmentation
    const enhancedPrompt = `
Previous context on "${topic}":
${context}

User wants to continue from here.
`;

    return enhancedPrompt;
  }
}

// ============================================================================
// EXAMPLE 4: User Says "Start Fresh"
// ============================================================================

async function onUserStartsFresh() {
  const cm = await CoreMemories.getInstance();

  // Archive current Flash to Recent
  // Don't delete, just note user chose not to continue
  await cm.addFlashEntry?.({
    type: "decision",
    content: "User chose to start fresh rather than continue previous context",
    speaker: "user",
    emotionalSalience: 0.3,
    linkedTo: [], // could link to previous entries
  });
}

// ============================================================================
// EXAMPLE 5: Configuration
// ============================================================================

const CONFIG = {
  sessionContinuation: {
    enabled: true,
    thresholds: {
      silent: 2, // 0-2h: no mention
      hint: 6, // 2-6h: brief context
      prompt: 24, // 6h+: explicit prompt
    },
    prioritizeFlagged: true, // Always show flagged items
    maxMemoriesToShow: 3,
  },
};

// ============================================================================
// EXAMPLE 6: Real-World Flow
// ============================================================================

/*
SCENARIO 1: Quick Break
───────────────────────────────────
3:00 PM - User: "Let's work on Card Sync"
3:45 PM - Gateway closes (user afk)
5:30 PM - Gateway reopens (2.5h gap)
          
Output:
👋 Hey! Still working on the Card Sync launch?

SCENARIO 2: Overnight/Sleep
───────────────────────────────────
11:00 PM - User: "Check Groq console tomorrow"
7:00 AM  - User sleeps
8:30 AM  - Gateway reopens (9.5h gap)

Output:
👋 Welcome back!

**Last time we were working on:**
• 🎯 Card Sync launch (next month - high priority)
• ⏳ Check Groq console for voice system (task)

**Unfinished:**
⏳ Task: Check Groq console for voice system

Want to continue with Card Sync or start fresh?

SCENARIO 3: Work Day Gap
───────────────────────────────────
9:00 PM - User: "Need to merge PR 7480"
8:30 AM - User goes to work
7:00 PM - Gateway reopens (10h gap)

Output:
👋 Welcome back!

**Last time we were working on:**
• 🔧 PR #7480 CoreMemories (needs 4 Greptile fixes)

Want to continue with PR #7480 or start fresh?

SCENARIO 4: Weekend Break
───────────────────────────────────
Friday 6:00 PM  - User: "Let's plan Card Sync launch"
Monday 9:00 AM  - Gateway reopens (≈63h gap, >24h)

Output:
👋 Hey Luis! Good to see you again.

**Here's where we left off:**

🎯 **Card Sync Launch** (⚡ High Priority)
   └─ Launching next month - you flagged this as important
   
📊 **Recent Activity:**
• Switched to NVIDIA Kimi K2.5 ✓
• Found your flash memories ✓

What would you like to work on?
[Continue Card Sync] [Show full context] [Start something new]
*/

// ============================================================================
// EXAMPLE 7: Testing the Integration
// ============================================================================

async function testSessionContinuation() {
  // Simulate different gaps
  const testCases = [
    { gap: 1, expectedMode: "silent" },
    { gap: 3, expectedMode: "hint" },
    { gap: 8, expectedMode: "prompt" },
    { gap: 30, expectedMode: "prompt" },
  ];

  const cm = await CoreMemories.getInstance();
  const now = Date.now();

  for (const tc of testCases) {
    const lastSession = now - tc.gap * 60 * 60 * 1000;
    const message = await onSessionStart(cm, (msg) => msg);

    console.log(`Gap ${tc.gap}h: ${message || "(no message)"}`);
  }
}
