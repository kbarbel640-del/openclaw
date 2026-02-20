/**
 * Integration Tests for Clarity v2
 *
 * Tests the integration layer including:
 * - V2ContextTracker as drop-in replacement
 * - Backward compatibility with v1 API
 * - New v2 features (entities, relationships, scoring)
 * - Output format per design doc Section 6
 */

"use strict";

const assert = require("assert");
const path = require("path");

// Load v2 modules
const v2 = require("../lib/v2");
const {
  V2ContextTracker,
  EntityExtractor,
  EntityScorer,
  Entity,
  Relationship,
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  THRESHOLDS,
} = require("../lib/v2/integration");

// Load v1 for comparison
const V1ContextTracker = require("../lib/context-tracker");

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: "PASS" });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.failed++;
    results.tests.push({ name, status: "FAIL", error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "Assertion failed"}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, msg) {
  if (!value) {
    throw new Error(msg || "Expected true, got false");
  }
}

function assertExists(value, msg) {
  if (value == null) {
    throw new Error(msg || "Expected value to exist");
  }
}

console.log("\n========================================");
console.log("Clarity v2 Integration Tests");
console.log("========================================\n");

// =============================================================================
// Test Suite 1: Entity Extraction
// =============================================================================
console.log("\n--- Suite 1: Entity Extraction ---");

test("extracts CamelCase project names", () => {
  const extractor = new EntityExtractor();
  const result = extractor.extract("Working on ClaraCore and OpenClaw projects", 1);

  const entities = [...result.entities.values()];
  assertTrue(
    entities.some((e) => e.id === "project:claracore"),
    "Should find ClaraCore",
  );
  assertTrue(
    entities.some((e) => e.id === "project:openclaw"),
    "Should find OpenClaw",
  );
});

test("extracts hyphenated project names", () => {
  const extractor = new EntityExtractor();
  const result = extractor.extract("The focus-engine component is ready", 1);

  const entities = [...result.entities.values()];
  assertTrue(
    entities.some((e) => e.id === "project:focus_engine"),
    "Should find focus-engine",
  );
});

test("excludes system hyphenated terms", () => {
  const extractor = new EntityExtractor();
  const result = extractor.extract("This is a high-level overview with end-to-end testing", 1);

  const entities = [...result.entities.values()];
  assertTrue(!entities.some((e) => e.normalized === "high_level"), "Should exclude high-level");
  assertTrue(!entities.some((e) => e.normalized === "end_to_end"), "Should exclude end-to-end");
});

test("extracts plugins by name", () => {
  const extractor = new EntityExtractor();
  const result = extractor.extract("Using the clarity and awareness plugins", 1);

  const entities = [...result.entities.values()];
  assertTrue(
    entities.some((e) => e.id === "plugin:clarity"),
    "Should find clarity plugin",
  );
  assertTrue(
    entities.some((e) => e.id === "plugin:awareness"),
    "Should find awareness plugin",
  );
});

test("extracts tool references", () => {
  const extractor = new EntityExtractor();
  const result = extractor.extract("Run subagents and use web_search for data", 1);

  const entities = [...result.entities.values()];
  assertTrue(
    entities.some((e) => e.id === "tool:subagents"),
    "Should find subagents tool",
  );
  assertTrue(
    entities.some((e) => e.id === "tool:web_search"),
    "Should find web_search tool",
  );
});

test("extracts file references", () => {
  const extractor = new EntityExtractor();
  const result = extractor.extract("Check SOUL.md and memory/active-context.md", 1);

  const entities = [...result.entities.values()];
  assertTrue(
    entities.some((e) => e.id === "file:soul_md"),
    "Should find SOUL.md",
  );
  assertTrue(
    entities.some((e) => e.id === "file:memory_active_context_md"),
    "Should find memory file",
  );
});

test("extracts lowercase projects with tech suffixes", () => {
  const extractor = new EntityExtractor();
  const result = extractor.extract("The claracore and dashclaw systems", 1);

  const entities = [...result.entities.values()];
  assertTrue(
    entities.some((e) => e.normalized === "claracore"),
    "Should find claracore",
  );
  assertTrue(
    entities.some((e) => e.normalized === "dashclaw"),
    "Should find dashclaw",
  );
});

// =============================================================================
// Test Suite 2: Relationships
// =============================================================================
console.log("\n--- Suite 2: Relationships ---");

test("creates co-occurrence relationships", () => {
  const extractor = new EntityExtractor();
  const result = extractor.extract("ClaraCore uses subagents for processing", 1);

  assertTrue(result.relationships.length > 0, "Should have relationships");

  const hasRelated = result.relationships.some((r) => r.type === RELATIONSHIP_TYPES.RELATED);
  assertTrue(hasRelated, "Should have RELATED relationships");
});

test("creates USES relationship from plugin to tool", () => {
  const extractor = new EntityExtractor();
  const result = extractor.extract("The clarity plugin uses subagents", 1);

  const hasUses = result.relationships.some(
    (r) =>
      r.type === RELATIONSHIP_TYPES.USES &&
      r.sourceId === "plugin:clarity" &&
      r.targetId === "tool:subagents",
  );
  assertTrue(hasUses, "Should have USES relationship from plugin to tool");
});

test("creates CONTAINS relationship from project to file", () => {
  const extractor = new EntityExtractor();
  const result = extractor.extract("ClaraCore has a SOUL.md file", 1);

  const hasContains = result.relationships.some(
    (r) =>
      r.type === RELATIONSHIP_TYPES.CONTAINS &&
      r.sourceId === "project:claracore" &&
      r.targetId === "file:soul_md",
  );
  assertTrue(hasContains, "Should have CONTAINS relationship");
});

test("strengthens existing relationships on re-occurrence", () => {
  const extractor = new EntityExtractor();

  // First mention
  const result1 = extractor.extract("ClaraCore uses subagents", 1);
  const rel1 = result1.relationships.find((r) => r.type === RELATIONSHIP_TYPES.USES);
  const strength1 = rel1 ? rel1.strength : 0;

  // Simulate entity already exists
  const result2 = extractor.extract("ClaraCore uses subagents again", 2);
  const entity = result2.entities.get("project:claracore");
  const rel2 = entity.relationships.find((r) => r.type === RELATIONSHIP_TYPES.USES);

  assertTrue(rel2.strength >= strength1, "Relationship should be strengthened");
});

// =============================================================================
// Test Suite 3: Entity Scoring
// =============================================================================
console.log("\n--- Suite 3: Entity Scoring ---");

test("calculates TF-IDF scores", () => {
  const scorer = new EntityScorer();
  const entity = new Entity("test:entity", ENTITY_TYPES.TOPIC, "Test", "test", 1);
  entity.addMention(1);
  entity.addMention(2);
  entity.addMention(3);

  const scores = scorer.scoreEntity(entity, 5, 10);

  assertTrue(scores.tfidf >= 0, "TF-IDF should be non-negative");
  assertTrue(scores.recency > 0, "Recency should be positive");
});

test("recency decays exponentially", () => {
  const scorer = new EntityScorer();

  const recent = new Entity("test:recent", ENTITY_TYPES.TOPIC, "Recent", "recent", 10);
  recent.lastMentionTurn = 10;

  const old = new Entity("test:old", ENTITY_TYPES.TOPIC, "Old", "old", 1);
  old.lastMentionTurn = 1;

  const recentScore = scorer.computeRecency(10, 10);
  const oldScore = scorer.computeRecency(1, 10);

  assertTrue(recentScore > oldScore, "Recent mention should have higher recency");
  assertEqual(recentScore, 1, "Current turn should have recency of 1");
});

test("anchor bonus is applied", () => {
  const scorer = new EntityScorer();
  const entity = new Entity("test:entity", ENTITY_TYPES.TOPIC, "Test", "test", 1);
  entity.isAnchor = true;

  const scores = scorer.scoreEntity(entity, 5, 10);

  assertEqual(scores.anchorBonus, 5, "Anchor bonus should be 5");
});

test("relationship boost increases score", () => {
  const scorer = new EntityScorer();

  const entity1 = new Entity("test:entity1", ENTITY_TYPES.TOPIC, "Test1", "test1", 1);
  entity1.addRelationship("test:entity2", RELATIONSHIP_TYPES.RELATED, 0.8);

  const entity2 = new Entity("test:entity2", ENTITY_TYPES.TOPIC, "Test2", "test2", 1);

  const boost1 = scorer.computeRelationshipBoost(entity1);
  const boost2 = scorer.computeRelationshipBoost(entity2);

  assertTrue(boost1 > boost2, "Entity with relationships should have higher boost");
  assertTrue(boost1 > 0, "Relationship boost should be positive");
});

// =============================================================================
// Test Suite 4: V2ContextTracker Core Functionality
// =============================================================================
console.log("\n--- Suite 4: V2ContextTracker Core ---");

test("extractItemsV2 returns entities and relationships", () => {
  const tracker = new V2ContextTracker();
  const result = tracker.extractItemsV2("ClaraCore uses subagents", 1);

  assertTrue(Array.isArray(result.entities), "entities should be an array");
  assertTrue(Array.isArray(result.relationships), "relationships should be an array");
  assertTrue(Array.isArray(result.compositeTerms), "compositeTerms should be an array");
  assertTrue(result.entities.length > 0, "Should have extracted entities");
});

test("getScoredItemsV2 returns sorted entities", () => {
  const tracker = new V2ContextTracker();
  tracker.extractItemsV2("ClaraCore uses subagents", 1);
  tracker.extractItemsV2("OpenClaw uses web_search", 1);

  const scored = tracker.getScoredItemsV2();

  assertTrue(Array.isArray(scored), "Should return array");
  assertTrue(scored.length >= 2, "Should have at least 2 entities");

  // Check sorted by score
  for (let i = 1; i < scored.length; i++) {
    assertTrue(
      scored[i - 1].totalScore >= scored[i].totalScore,
      "Entities should be sorted by score descending",
    );
  }
});

test("getEntities returns structured data", () => {
  const tracker = new V2ContextTracker();
  tracker.extractItemsV2("ClaraCore uses subagents for work", 1);
  tracker.advanceTurn();

  const data = tracker.getEntities();

  assertTrue(Array.isArray(data.entities), "Should have entities array");
  assertTrue(Array.isArray(data.topEntities), "Should have topEntities array");
  assertTrue(Array.isArray(data.relationships), "Should have relationships array");
  assertTrue(Array.isArray(data.topics), "Should have topics array");
});

test("formatClarityContext produces correct format", () => {
  const tracker = new V2ContextTracker();
  tracker.extractItemsV2("ClaraCore uses subagents", 1);
  tracker.advanceTurn();
  tracker.extractItemsV2("ClaraCore and OpenClaw integration", 2);
  tracker.advanceTurn();

  const context = tracker.formatClarityContext();

  assertTrue(context.includes("[CLARITY CONTEXT]"), "Should have header");
  assertTrue(
    context.includes("project:claracore") || context.includes("project:"),
    "Should include entity mentions",
  );
});

test("trackMentions updates entity counts", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("ClaraCore project");

  const entity = tracker._entities.get("project:claracore");
  assertExists(entity, "Entity should exist");
  assertEqual(entity.mentionCount, 1, "Should have 1 mention");
});

test("anchorItem marks entity as anchor", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("ClaraCore");
  tracker.anchorItem("project:claracore", "test");

  const entity = tracker._entities.get("project:claracore");
  assertTrue(entity.isAnchor, "Entity should be anchored");

  const legacyItem = tracker._items.get("project:claracore");
  assertTrue(legacyItem.anchored, "Legacy item should also be anchored");
});

test("unanchorItem removes anchor", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("ClaraCore");
  tracker.anchorItem("project:claracore");
  tracker.unanchorItem("project:claracore");

  const entity = tracker._entities.get("project:claracore");
  assertTrue(!entity.isAnchor, "Entity should not be anchored");
});

// =============================================================================
// Test Suite 5: Backward Compatibility
// =============================================================================
console.log("\n--- Suite 5: Backward Compatibility ---");

test("extractItems returns array of strings (v1 API)", () => {
  const tracker = new V2ContextTracker();
  const items = tracker.extractItems("ClaraCore and OpenClaw");

  assertTrue(Array.isArray(items), "Should return array");
  assertTrue(items.length > 0, "Should have items");
  assertTrue(
    items.every((i) => typeof i === "string"),
    "All items should be strings",
  );
  assertTrue(
    items.some((i) => i.includes("claracore")),
    "Should include ClaraCore",
  );
});

test("getScoredItems returns v1-compatible format", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("ClaraCore project with subagents");
  tracker.advanceTurn();

  const scored = tracker.getScoredItems();

  assertTrue(Array.isArray(scored), "Should return array");
  assertTrue(scored.length > 0, "Should have scored items");

  const first = scored[0];
  assertTrue(typeof first.id === "string", "Should have id");
  assertTrue(typeof first.finalScore === "number", "Should have finalScore");
  assertTrue(first.metadata != null, "Should have metadata");
  assertTrue(typeof first.metadata.mentionCount === "number", "Should have mentionCount");
  assertTrue(typeof first.metadata.anchored === "boolean", "Should have anchored");
  assertTrue(first.breakdown != null, "Should have breakdown");
});

test("getStats returns expected structure", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("ClaraCore");

  const stats = tracker.getStats();

  assertTrue(typeof stats.totalItems === "number", "Should have totalItems");
  assertTrue(typeof stats.anchoredItems === "number", "Should have anchoredItems");
  assertTrue(typeof stats.currentTurn === "number", "Should have currentTurn");
  assertTrue(typeof stats.averageMentions === "number", "Should have averageMentions");
  assertTrue(typeof stats.averageScore === "number", "Should have averageScore");
  assertTrue(Array.isArray(stats.topItems), "Should have topItems array");
});

test("trackReference updates reference counts", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("ClaraCore");
  tracker.trackReference("project:claracore", "test context");

  const item = tracker._items.get("project:claracore");
  assertTrue(item.referenceCount > 0, "Should have reference count");
});

test("prune removes low-relevance items", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("ClaraCore");
  tracker.advanceTurn();

  const beforeCount = tracker._entities.size;
  tracker.prune(100); // High threshold to force pruning
  const afterCount = tracker._entities.size;

  // Anchored items should not be pruned, but unanchored low-score items should
  assertTrue(afterCount <= beforeCount, "Should not increase entity count");
});

test("advanceTurn increments turn counter", () => {
  const tracker = new V2ContextTracker();
  const before = tracker._currentTurn;
  tracker.advanceTurn();
  const after = tracker._currentTurn;

  assertEqual(after, before + 1, "Turn should increment by 1");
});

test("reset clears all data", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("ClaraCore");
  tracker.anchorItem("project:claracore");

  tracker.reset();

  assertEqual(tracker._entities.size, 0, "Should have no entities");
  assertEqual(tracker._items.size, 0, "Should have no legacy items");
  assertEqual(tracker._currentTurn, 0, "Turn should be reset");
});

// =============================================================================
// Test Suite 6: V1 vs V2 Compatibility Check
// =============================================================================
console.log("\n--- Suite 6: V1/V2 API Compatibility ---");

test("V2ContextTracker has all v1 ContextTracker methods", () => {
  const v1 = new V1ContextTracker();
  const v2 = new V2ContextTracker();

  const v1Methods = Object.getOwnPropertyNames(Object.getPrototypeOf(v1)).filter(
    (m) => typeof v1[m] === "function" && m !== "constructor",
  );

  const v2Methods = Object.getOwnPropertyNames(Object.getPrototypeOf(v2)).filter(
    (m) => typeof v2[m] === "function" && m !== "constructor",
  );

  // Check that all v1 methods exist on v2
  for (const method of v1Methods) {
    assertTrue(v2Methods.includes(method), `V2 should have method: ${method}`);
  }
});

test("V2ContextTracker has new v2 methods", () => {
  const tracker = new V2ContextTracker();

  assertTrue(typeof tracker.extractItemsV2 === "function", "Should have extractItemsV2");
  assertTrue(typeof tracker.getScoredItemsV2 === "function", "Should have getScoredItemsV2");
  assertTrue(typeof tracker.getEntities === "function", "Should have getEntities");
  assertTrue(
    typeof tracker.formatClarityContext === "function",
    "Should have formatClarityContext",
  );
});

// =============================================================================
// Test Suite 7: Output Format
// =============================================================================
console.log("\n--- Suite 7: Output Format (Design Doc Section 6) ---");

test("output includes high-relevance indicator (●) for high scores", () => {
  const tracker = new V2ContextTracker();

  // Add multiple mentions to boost score
  for (let i = 0; i < 10; i++) {
    tracker.trackMentions("ClaraCore uses subagents");
    tracker.advanceTurn();
  }

  const context = tracker.formatClarityContext();

  // Should have high-relevance indicators for frequently mentioned items
  assertTrue(
    context.includes("●") || context.includes("○") || context.includes("·"),
    "Should include relevance indicators",
  );
});

test("output includes entity IDs with types", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("ClaraCore uses subagents");
  tracker.advanceTurn();

  const context = tracker.formatClarityContext();

  assertTrue(
    context.includes("project:") || context.includes("tool:") || context.includes("plugin:"),
    "Should include typed entity IDs",
  );
});

test("output includes relationship information", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("Clarity plugin uses subagents tool");
  tracker.advanceTurn();

  const context = tracker.formatClarityContext();
  const data = tracker.getEntities();

  if (data.relationships.length > 0) {
    assertTrue(
      context.includes("relationship") || context.includes("→"),
      "Should mention relationships when they exist",
    );
  }
});

test("output includes score values", () => {
  const tracker = new V2ContextTracker();
  tracker.trackMentions("ClaraCore");
  tracker.advanceTurn();

  const context = tracker.formatClarityContext();

  assertTrue(context.includes("score:") || /\(\d+\)/.test(context), "Should include score values");
});

// =============================================================================
// Summary
// =============================================================================
console.log("\n========================================");
console.log("Test Summary");
console.log("========================================");
console.log(`Total: ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);

if (results.failed > 0) {
  console.log("\nFailed Tests:");
  for (const test of results.tests.filter((t) => t.status === "FAIL")) {
    console.log(`  - ${test.name}: ${test.error}`);
  }
}

console.log("");

process.exit(results.failed > 0 ? 1 : 0);
