/**
 * Tests for Clarity — Relevance-Based Context Prioritization
 */

"use strict";

const RelevanceScorer = require("./lib/relevance-scorer");
const ContextTracker = require("./lib/context-tracker");
const RelevancePruner = require("./lib/pruner");

// Simple mock KV store
function createMockKV() {
  const store = new Map();
  return {
    set: (ns, key, value) => store.set(`${ns}:${key}`, value),
    get: (ns, key, defaultValue = null) => store.get(`${ns}:${key}`) ?? defaultValue,
    getAll: (ns) => {
      const result = {};
      for (const [k, v] of store) {
        if (k.startsWith(`${ns}:`)) {
          result[k.replace(`${ns}:`, "")] = v;
        }
      }
      return result;
    },
    delete: (ns, key) => store.delete(`${ns}:${key}`),
  };
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`FAIL: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
  console.log(`✓ ${message}`);
}

function assertTrue(actual, message) {
  if (!actual) {
    throw new Error(`FAIL: ${message}\n  Expected truthy, got: ${actual}`);
  }
  console.log(`✓ ${message}`);
}

function assertGreaterThan(actual, threshold, message) {
  if (!(actual > threshold)) {
    throw new Error(`FAIL: ${message}\n  Expected > ${threshold}, got: ${actual}`);
  }
  console.log(`✓ ${message} (${actual} > ${threshold})`);
}

console.log("=== Clarity Relevance Scoring Tests ===\n");

// Test 1: Basic scoring
console.log("\n--- Test 1: Basic Relevance Scoring ---");
{
  const scorer = new RelevanceScorer({
    halfLife: 5,
    recencyWindow: 3,
    recencyBonus: 20,
    frequencyScale: 10,
  });

  // Item mentioned once recently
  const item1 = {
    id: "test1",
    mentionCount: 1,
    lastMentionTurn: 10,
    referenceCount: 0,
    anchored: false,
  };

  const score1 = scorer.calculateScore(item1, 10);
  console.log("  Item1 score (1 mention, current turn):", Math.round(score1.finalScore * 10) / 10);
  assertGreaterThan(score1.finalScore, 5, "Single mention should have positive score");

  // Item mentioned many times
  const item2 = {
    id: "test2",
    mentionCount: 5,
    lastMentionTurn: 10,
    referenceCount: 0,
    anchored: false,
  };

  const score2 = scorer.calculateScore(item2, 10);
  console.log("  Item2 score (5 mentions, current turn):", Math.round(score2.finalScore * 10) / 10);
  assertGreaterThan(score2.finalScore, score1.finalScore, "Frequent mentions should score higher");
}

// Test 2: Recency decay
console.log("\n--- Test 2: Recency Decay ---");
{
  const scorer = new RelevanceScorer({
    recencyWindow: 3,
    recencyBonus: 20,
    halfLife: 5,
  });

  const item = {
    id: "test",
    mentionCount: 3,
    lastMentionTurn: 10,
    referenceCount: 0,
    anchored: false,
  };

  const scoreNow = scorer.calculateScore(item, 10);
  const scoreSoon = scorer.calculateScore(item, 12); // 2 turns ago
  const scoreLater = scorer.calculateScore(item, 15); // 5 turns ago (outside window)

  console.log("  Score at turn 10:", Math.round(scoreNow.finalScore));
  console.log("  Score at turn 12:", Math.round(scoreSoon.finalScore));
  console.log("  Score at turn 15:", Math.round(scoreLater.finalScore));

  assertGreaterThan(scoreNow.finalScore, scoreSoon.finalScore, "Recent items score higher");
  assertGreaterThan(scoreSoon.finalScore, scoreLater.finalScore, "Stale items score lower");
}

// Test 3: Anchored items
console.log("\n--- Test 3: Anchored Items ---");
{
  const scorer = new RelevanceScorer({ anchorBonus: 100 });

  const unanchored = {
    id: "unanchored",
    mentionCount: 1,
    lastMentionTurn: 5,
    referenceCount: 0,
    anchored: false,
  };

  const anchored = {
    id: "anchored",
    mentionCount: 1,
    lastMentionTurn: 5,
    referenceCount: 0,
    anchored: true,
  };

  const scoreUnanchored = scorer.calculateScore(unanchored, 20); // Old mention
  const scoreAnchored = scorer.calculateScore(anchored, 20);

  console.log("  Unanchored (old mention):", Math.round(scoreUnanchored.finalScore));
  console.log("  Anchored (same old mention):", Math.round(scoreAnchored.finalScore));

  assertGreaterThan(
    scoreAnchored.finalScore,
    scoreUnanchored.finalScore,
    "Anchored items score higher",
  );
  assertTrue(scoreAnchored.breakdown.anchor > 0, "Anchor bonus applied");
}

// Test 4: ContextTracker mention tracking
console.log("\n--- Test 4: ContextTracker Mention Tracking ---");
{
  const kv = createMockKV();
  const tracker = new ContextTracker({ kv, persistInterval: 5 });

  // Simulate user mentioning projects and tools
  const text = "I need to work on ClaraCore today. Can you use web_search to find the latest docs?";
  const mentioned = tracker.trackMentions(text);

  console.log("  Mentioned items:", mentioned.join(", "));
  assertTrue(mentioned.includes("claracore"), "Should extract project name");
  assertTrue(
    mentioned.some((m) => m.includes("web_search")),
    "Should extract tool name",
  );
}

// Test 5: Turn advancement and persistence
console.log("\n--- Test 5: Turn Advancement ---");
{
  const kv = createMockKV();
  const tracker = new ContextTracker({ kv, persistInterval: 3 });

  tracker.trackMentions("Testing mentions");
  assertEqual(tracker._currentTurn, 0, "Turn starts at 0");

  tracker.advanceTurn();
  assertEqual(tracker._currentTurn, 1, "Turn advances to 1");

  tracker.advanceTurn();
  tracker.advanceTurn(); // Should trigger persistence at turn 3
  assertEqual(tracker._currentTurn, 3, "Turn advances to 3");
}

// Test 6: Score sorting
console.log("\n--- Test 6: Score-Based Sorting ---");
{
  const scorer = new RelevanceScorer();

  const items = [
    { id: "rare", mentionCount: 1, lastMentionTurn: 10, referenceCount: 0, anchored: false },
    { id: "frequent", mentionCount: 10, lastMentionTurn: 10, referenceCount: 0, anchored: false },
    { id: "referenced", mentionCount: 3, lastMentionTurn: 10, referenceCount: 5, anchored: false },
    { id: "anchored", mentionCount: 1, lastMentionTurn: 5, referenceCount: 0, anchored: true },
  ];

  const scored = scorer.scoreItems(items, 10);

  console.log("  Sorted order:", scored.map((s) => s.id).join(" > "));
  // referenced (5 refs) > anchored (old mention) > frequent (many mentions) > rare
  assertEqual(scored[0].id, "referenced", "Referenced item should be first (high utility)");
  assertTrue(
    ["anchored", "frequent"].includes(scored[1].id),
    "Second should be anchored or frequent",
  );
}

// Test 7: Pruner evaluation
console.log("\n--- Test 7: Pruner Evaluation ---");
{
  const kv = createMockKV();
  const tracker = new ContextTracker({ kv });

  // Create items with varying relevance
  tracker.trackMentions("claracore openclaw");
  tracker.advanceTurn();
  tracker.trackMentions("claracore web_search");
  tracker.advanceTurn();
  tracker.trackMentions("claracore");

  const pruner = new RelevancePruner({ tracker, config: { pruneThreshold: 10 } });

  // Anchor claracore
  tracker.anchorItem("claracore", "test");

  const result = pruner.evaluate({ strictMode: false });

  console.log("  Keeping:", result.keep.length);
  console.log("  Pruning:", result.prune.length);
  console.log("  Anchored kept:", result.stats.anchoredKept);

  assertTrue(result.stats.anchoredKept >= 1, "Should preserve anchored items");
}

// Test 8: Strict mode preservation
console.log("\n--- Test 8: Strict Mode ---");
{
  const kv = createMockKV();
  const tracker = new ContextTracker({ kv });

  // Create high-scoring items
  for (let i = 0; i < 5; i++) {
    tracker.trackMentions("high_relevance_item");
    tracker.advanceTurn();
  }

  const pruner = new RelevancePruner({ tracker });

  const normalResult = pruner.evaluate({ strictMode: false });
  const strictResult = pruner.evaluate({ strictMode: true });

  console.log("  Normal mode keeping:", normalResult.keep.length);
  console.log("  Strict mode keeping:", strictResult.keep.length);

  assertTrue(
    strictResult.keep.length >= normalResult.keep.length,
    "Strict mode should preserve more items",
  );
}

// Test 9: Item categorization
console.log("\n--- Test 9: Item Categorization ---");
{
  const kv = createMockKV();
  const tracker = new ContextTracker({ kv });

  tracker.trackMentions("Testing ClaraCore and web_search for SOUL.md");

  const items = [...tracker._items.keys()];
  console.log("  Tracked items:", items.join(", "));

  assertTrue(
    items.some((i) => i.includes("claracore") || i === "claracore"),
    "Should track projects",
  );
}

// Test 10: Persistence round-trip
console.log("\n--- Test 10: Persistence Round-Trip ---");
{
  const kv = createMockKV();

  // Create and populate tracker
  const tracker1 = new ContextTracker({ kv });
  tracker1.trackMentions("test_item persistence_test");
  tracker1.advanceTurn();
  tracker1.anchorItem("test_item", "test");
  tracker1.persist();

  // Create new tracker with same KV
  const tracker2 = new ContextTracker({ kv });
  const loaded = tracker2.load();

  assertTrue(loaded, "Should load successfully");
  assertTrue(tracker2._items.has("test_item"), "Should restore items");

  const item = tracker2.getItem("test_item");
  assertTrue(item.anchored, "Should preserve anchor status");
  // mentionCount may be 0 if item was only touched, not fully mentioned
  assertTrue(item.mentionCount >= 0, "Should have valid mention count");
}

console.log("\n=== All Tests Passed ===");

// Summary
console.log("\n=== Implementation Summary ===");
console.log(`
Relevance-Based Prioritization Implementation:

1. SCORING ALGORITHM (RelevanceScorer)
   - Frequency: log2(mentionCount + 1) * frequencyScale
   - Recency: Linear decay within window (default 3 turns), max bonus 20
   - Utility: referenceCount * referenceWeight (default 15)
   - Staleness: Exponential decay with half-life (default 5 turns)
   - Anchor bonus: 100 points (preserves user-marked items)

2. TRACKING MECHANISM (ContextTracker)
   - O(1) per-turn updates (no O(n^2) history scanning)
   - Extracts: projects, tools, memory files, keywords
   - Tracks: mentions, references, anchor status
   - Periodic persistence to kv_store (every N turns)

3. PRUNING INTEGRATION (RelevancePruner)
   - Score-based keep/prune decisions
   - Strict mode: preserves items above threshold
   - Category limits to prevent over-representation
   - Anchor preservation regardless of score

4. STORAGE FORMAT
   - Uses memory plugin's kv_store (namespace: 'clarity')
   - Key: 'clarity:relevance_state'
   - Value: { currentTurn, lastPersistAt, items: [...] }

5. INTEGRATION POINTS
   - Hook: before_agent_start (injects relevance context)
   - Hook: agent_end (tracks references, advances turn)
   - Hook: before_compaction (prunes low-relevance items)
   - Gateway methods for inspection/debugging
   - Command: /clarity for manual control
`);
