/**
 * Tests for ActionableFormatter
 *
 * Tests cover:
 * - formatActionableContext() → enriched output
 * - generateWhyItMatters(entity) → reason for relevance
 * - generateWhatYouCanDo(entity) → actionable suggestions
 * - generateContextSnippet(entity) → brief usage context
 * - generateUrgencyIndicator(entity) → "active" / "trending" / "background"
 */

"use strict";

const assert = require("assert");
const { ActionableFormatter, URGENCY } = require("../lib/v2/actionable-formatter");

// Define locally to avoid circular dependency issues
const THRESHOLDS = {
  display: 20,
  highRelevance: 40,
  mediumRelevance: 25,
  track: 10,
};

// Minimal Entity class for testing
class Entity {
  constructor(id, type, name, normalized, turn = 0) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.normalized = normalized;
    this.mentionCount = 0;
    this.firstMentionTurn = turn;
    this.lastMentionTurn = turn;
    this.mentionHistory = [];
    this.totalScore = 0;
    this.relationships = [];
    this.contexts = [];
    this.isAnchor = false;

    if (turn > 0) {
      this.addMention(turn);
    }
  }

  addMention(turn, context = null) {
    this.mentionCount++;
    this.lastMentionTurn = turn;
    this.mentionHistory.push(turn);
    if (this.mentionHistory.length > 20) {
      this.mentionHistory = this.mentionHistory.slice(-20);
    }
    if (context && this.contexts.length < 5) {
      this.contexts.push(context);
    }
  }

  addRelationship(targetId, type, strength) {
    const existing = this.relationships.find((r) => r.targetId === targetId && r.type === type);
    if (existing) {
      existing.strength = Math.min(1, existing.strength + strength * 0.1);
    } else {
      this.relationships.push({ targetId, type, strength, lastCooccurrence: this.lastMentionTurn });
    }
  }
}

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: "passed" });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.failed++;
    results.tests.push({ name, status: "failed", error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function expect(value) {
  return {
    toBe(expected) {
      assert.strictEqual(value, expected);
    },
    toContain(expected) {
      assert(value.includes(expected), `Expected "${value}" to contain "${expected}"`);
    },
    toBeLessThanOrEqual(expected) {
      assert(value <= expected, `Expected ${value} to be <= ${expected}`);
    },
    toBeGreaterThanOrEqual(expected) {
      assert(value >= expected, `Expected ${value} to be >= ${expected}`);
    },
    toBeLessThan(expected) {
      assert(value < expected, `Expected ${value} to be < ${expected}`);
    },
    toBeGreaterThan(expected) {
      assert(value > expected, `Expected ${value} to be > ${expected}`);
    },
  };
}

console.log("\nActionableFormatter Tests");
console.log("=========================\n");

// Helper function to create entities for testing
function createEntity(id, score, options = {}) {
  const parts = id.split(":");
  const type = parts[0] || "topic";
  const normalized = parts[1] || id;
  const name = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  const entity = new Entity(id, type, name, normalized, options.firstMentionTurn || 1);
  entity.totalScore = score;
  entity.lastMentionTurn = options.lastMentionTurn || 10;
  entity.isAnchor = options.isAnchor || false;

  if (options.contexts) {
    entity.contexts = options.contexts;
  }

  return entity;
}

// Setup
let formatter = new ActionableFormatter({ currentTurn: 10 });

// Tests
test("returns empty message when no entities", () => {
  const result = formatter.formatActionableContext([]);
  expect(result).toBe("[CLARITY CONTEXT]\n  No tracked entities");
});

test("formats single entity with all fields", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 8);
  entity.addMention(8, "deploy clarity plugin to production");
  entity.addMention(9, "test clarity integration");
  entity.addMention(10, "clarity is working well");
  entity.totalScore = 75;

  const result = formatter.formatActionableContext([entity]);

  expect(result).toContain("[CLARITY CONTEXT]");
  expect(result).toContain("plugin:clarity");
  expect(result).toContain("active");
  expect(result).toContain("mentioned");
  expect(result).toContain("→");
});

test("formats multiple entities sorted by score", () => {
  const entities = [
    createEntity("plugin:clarity", 50, { lastMentionTurn: 10 }),
    createEntity("tool:subagents", 80, { lastMentionTurn: 10, isAnchor: true }),
    createEntity("project:claracore", 30, { lastMentionTurn: 5 }),
  ];

  const result = formatter.formatActionableContext(entities);
  const lines = result.split("\n");

  // tool:subagents should appear first (highest score)
  const subagentsIndex = lines.findIndex((l) => l.includes("tool:subagents"));
  const clarityIndex = lines.findIndex((l) => l.includes("plugin:clarity"));

  expect(subagentsIndex).toBeLessThan(clarityIndex);
});

test("respects maxEntities limit", () => {
  formatter = new ActionableFormatter({ currentTurn: 10, maxEntities: 2 });

  const entities = [
    createEntity("plugin:clarity", 80),
    createEntity("tool:subagents", 70),
    createEntity("project:claracore", 60),
    createEntity("file:test_js", 50),
  ];

  const result = formatter.formatActionableContext(entities);
  const entityLines = result
    .split("\n")
    .filter((l) => l.includes("●") || l.includes("○") || l.includes("★"));

  expect(entityLines.length).toBeLessThanOrEqual(2);
});

test("shows recent mention count in whyItMatters", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 8);
  // Constructor already adds mention at turn 8, so add 2 more for 3 total
  entity.addMention(9);
  entity.addMention(10);

  const why = formatter.generateWhyItMatters(entity);

  expect(why).toContain("mentioned");
  expect(why).toContain("3×");
});

test("shows anchor status when anchored", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 5);
  entity.addMention(5);
  entity.addMention(10);
  entity.isAnchor = true;

  const why = formatter.generateWhyItMatters(entity);

  expect(why).toContain("anchor");
});

test("shows relationship count for well-connected entities", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 8);
  entity.addMention(8);
  entity.addRelationship("tool:subagents", "uses", 0.8);
  entity.addRelationship("project:claracore", "related", 0.6);
  entity.addRelationship("plugin:awareness", "related", 0.5);

  const why = formatter.generateWhyItMatters(entity);

  expect(why).toContain("linked to 3 entities");
});

test("shows last context snippet when available", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 10);
  entity.addMention(10, "deploy clarity plugin to production");

  const why = formatter.generateWhyItMatters(entity);

  expect(why).toContain("last:");
  expect(why).toContain("clarity");
});

test("suggests actions for plugin entities", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 10);

  const what = formatter.generateWhatYouCanDo(entity);

  expect(what).toContain("/anchor");
  expect(what).toContain("clarity");
});

test("suggests actions for tool entities", () => {
  const entity = new Entity("tool:subagents", "tool", "subagents", "subagents", 10);

  const what = formatter.generateWhatYouCanDo(entity);

  expect(what).toContain("/help");
});

test("suggests related entities when relationships exist", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 10);
  entity.addRelationship("tool:subagents", "uses", 0.9);
  entity.addRelationship("project:claracore", "related", 0.7);

  const what = formatter.generateWhatYouCanDo(entity);

  expect(what).toContain("see also");
  expect(what).toContain("subagents");
});

test("uses stored context when available for context snippet", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 10);
  entity.addMention(10, "Using clarity for entity extraction in context headers");

  const snippet = formatter.generateContextSnippet(entity);

  expect(snippet).toContain("entity extraction");
});

test("generates from relationships when no context", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 10);
  entity.addRelationship("tool:subagents", "uses", 0.8);

  const snippet = formatter.generateContextSnippet(entity);

  expect(snippet).toContain("uses");
  expect(snippet).toContain("subagents");
});

test("returns type description as fallback", () => {
  const entity = new Entity("topic:ai", "topic", "AI", "ai", 10);

  const snippet = formatter.generateContextSnippet(entity);

  expect(snippet).toContain("discussed");
});

test("returns ACTIVE for very recent mentions", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 9);
  entity.addMention(9);
  entity.addMention(10);

  const urgency = formatter.generateUrgencyIndicator(entity);

  expect(urgency).toBe(URGENCY.ACTIVE);
});

test("returns ACTIVE for frequent recent mentions", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 6);
  entity.addMention(6);
  entity.addMention(8);
  entity.addMention(10);

  const urgency = formatter.generateUrgencyIndicator(entity);

  expect(urgency).toBe(URGENCY.ACTIVE);
});

test("returns TRENDING for building momentum", () => {
  // At turn 10, mentions at 5 and 7 (last is 3 turns ago) - trending but not active
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 5);
  entity.addMention(7);
  entity.mentionCount = 5;

  const urgency = formatter.generateUrgencyIndicator(entity);

  expect(urgency).toBe(URGENCY.TRENDING);
});

test("returns BACKGROUND for older mentions", () => {
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 3);
  entity.addMention(3);

  const urgency = formatter.generateUrgencyIndicator(entity);

  expect(urgency).toBe(URGENCY.BACKGROUND);
});

test("uses star indicator for anchored entities", () => {
  const entity = createEntity("plugin:clarity", 75, { isAnchor: true });

  const result = formatter.formatActionableEntity(entity);

  expect(result).toContain("★");
});

test("uses filled circle for high relevance", () => {
  const entity = createEntity("plugin:clarity", 50);

  const result = formatter.formatActionableEntity(entity);

  expect(result).toContain("●");
});

test("uses open circle for medium relevance", () => {
  const entity = createEntity("plugin:clarity", 30);

  const result = formatter.formatActionableEntity(entity);

  expect(result).toContain("○");
});

test("includes mention count in formatted entity", () => {
  const entity = createEntity("plugin:clarity", 60);
  entity.addMention(8);
  entity.addMention(9);
  entity.addMention(10);

  const result = formatter.formatActionableEntity(entity);

  expect(result).toContain("mentioned");
  expect(result).toContain("3×");
});

test("suggests concrete actions with arrow", () => {
  const entity = createEntity("plugin:clarity", 60);

  const result = formatter.formatActionableEntity(entity);

  expect(result).toContain("→");
  expect(result).toContain("/");
});

test("shows Uses: context snippet when available", () => {
  const entity = createEntity("plugin:clarity", 60, {
    contexts: ["entity extraction for context headers"],
  });

  const result = formatter.formatActionableEntity(entity);

  expect(result).toContain("Uses:");
  expect(result).toContain("entity extraction");
});

test("getRecentMentions counts mentions in window", () => {
  // Constructor adds mention at turn 6
  const entity = new Entity("plugin:clarity", "plugin", "Clarity", "clarity", 6);
  entity.addMention(7);
  entity.addMention(10);

  // At turn 10 with window 5: turns 6,7,10 are in range (turns 6-10)
  const recent = formatter.getRecentMentions(entity, 5);

  expect(recent).toBe(3);
});

test("getShortName removes type prefix", () => {
  expect(formatter.getShortName("plugin:clarity")).toBe("clarity");
  expect(formatter.getShortName("tool:subagents")).toBe("subagents");
  expect(formatter.getShortName("project:claracore")).toBe("claracore");
});

test("inferEntityType extracts type from ID", () => {
  expect(formatter.inferEntityType("plugin:clarity")).toBe("plugin");
  expect(formatter.inferEntityType("tool:subagents")).toBe("tool");
});

test("setCurrentTurn updates internal turn counter", () => {
  formatter.setCurrentTurn(25);

  expect(formatter.currentTurn).toBe(25);
});

test("formatSummary counts anchored entities", () => {
  const entities = [
    createEntity("plugin:clarity", 60, { isAnchor: true }),
    createEntity("tool:subagents", 50, { isAnchor: true }),
  ];

  const summary = formatter.formatSummary(entities);

  expect(summary).toContain("2 anchored");
});

// Print summary
console.log("\n-------------------------");
console.log(`Results: ${results.passed} passed, ${results.failed} failed`);
console.log("-------------------------\n");

process.exit(results.failed > 0 ? 1 : 0);
