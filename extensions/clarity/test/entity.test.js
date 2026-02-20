/**
 * Unit tests for Entity and Relationship classes
 * Run with: node test/entity.test.js
 */

const { Entity, Relationship, EntityType, RelType } = require("../lib/v2/entity");

// Simple test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  assertEqual(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(`${msg}: expected ${expected}, got ${actual}`);
    }
  }

  assertCloseTo(actual, expected, tolerance = 0.0001, msg) {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`${msg}: expected ${expected} ±${tolerance}, got ${actual}`);
    }
  }

  assertTrue(value, msg) {
    if (!value) {
      throw new Error(`${msg}: expected true, got ${value}`);
    }
  }

  assertFalse(value, msg) {
    if (value) {
      throw new Error(`${msg}: expected false, got ${value}`);
    }
  }

  assertThrows(fn, msg) {
    let threw = false;
    try {
      fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(`${msg}: expected function to throw`);
    }
  }

  async run() {
    console.log("Running Entity tests...\n");

    for (const { name, fn } of this.tests) {
      try {
        await fn(this);
        this.passed++;
        console.log(`  ✓ ${name}`);
      } catch (e) {
        this.failed++;
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
      }
    }

    console.log(`\n${this.passed}/${this.tests.length} tests passed`);
    return this.failed === 0;
  }
}

const runner = new TestRunner();

// ========== Entity ID Tests ==========
runner.test("Entity.makeId creates canonical ID", (t) => {
  const id = Entity.makeId(EntityType.PROJECT, "claracore");
  t.assertEqual(id, "project:claracore", "ID format");
});

runner.test("Entity.makeId with different types", (t) => {
  t.assertEqual(Entity.makeId(EntityType.PLUGIN, "clarity"), "plugin:clarity", "Plugin ID");
  t.assertEqual(Entity.makeId(EntityType.TOOL, "sessions_spawn"), "tool:sessions_spawn", "Tool ID");
  t.assertEqual(Entity.makeId(EntityType.FILE, "soul_md"), "file:soul_md", "File ID");
});

// ========== Entity Constructor Tests ==========
runner.test("Entity constructor sets basic properties", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "ClaraCore",
    normalized: "claracore",
    firstMentionTurn: 1,
  });

  t.assertEqual(entity.id, "project:claracore", "ID");
  t.assertEqual(entity.type, EntityType.PROJECT, "Type");
  t.assertEqual(entity.name, "ClaraCore", "Name");
  t.assertEqual(entity.normalized, "claracore", "Normalized");
  t.assertEqual(entity.mentionCount, 1, "Initial mention count");
  t.assertEqual(entity.firstMentionTurn, 1, "First mention turn");
  t.assertEqual(entity.lastMentionTurn, 1, "Last mention turn");
});

runner.test("Entity constructor initializes empty relationships", (t) => {
  const entity = new Entity({
    type: EntityType.PLUGIN,
    name: "Clarity",
    normalized: "clarity",
    firstMentionTurn: 1,
  });

  t.assertEqual(entity.relationships.length, 0, "Empty relationships array");
  t.assertEqual(entity.contexts.length, 0, "Empty contexts array");
  t.assertFalse(entity.isAnchor, "Not an anchor by default");
});

// ========== Mention Tracking Tests ==========
runner.test("addMention increments count and updates history", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "TestProject",
    normalized: "testproject",
    firstMentionTurn: 1,
  });

  entity.addMention(2);
  t.assertEqual(entity.mentionCount, 2, "Mention count incremented");
  t.assertEqual(entity.lastMentionTurn, 2, "Last mention updated");
  t.assertEqual(entity.mentionHistory.length, 2, "History has 2 entries");
});

runner.test("addMention keeps max 20 history entries", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "TestProject",
    normalized: "testproject",
    firstMentionTurn: 1,
  });

  // Add 25 mentions
  for (let i = 2; i <= 25; i++) {
    entity.addMention(i);
  }

  t.assertEqual(entity.mentionHistory.length, 20, "History capped at 20");
  t.assertEqual(entity.mentionHistory[0], 6, "Oldest is turn 6 (dropped 1-5)");
  t.assertEqual(entity.mentionHistory[19], 25, "Newest is turn 25");
});

runner.test("addMention adds context snippets", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "TestProject",
    normalized: "testproject",
    firstMentionTurn: 1,
  });

  entity.addMention(2, "Working on TestProject today");
  entity.addMention(3, "TestProject is coming along");

  t.assertEqual(entity.contexts.length, 2, "Two context snippets");
  t.assertTrue(entity.contexts[0].includes("Working on"), "First context stored");
});

runner.test("addMention keeps max 5 contexts", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "TestProject",
    normalized: "testproject",
    firstMentionTurn: 1,
  });

  for (let i = 2; i <= 7; i++) {
    entity.addMention(i, `Context ${i}`);
  }

  t.assertEqual(entity.contexts.length, 5, "Contexts capped at 5");
  t.assertTrue(entity.contexts[0].includes("3"), "Oldest context is 3");
});

runner.test("getMentionsInWindow returns correct count", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "TestProject",
    normalized: "testproject",
    firstMentionTurn: 1,
  });

  entity.addMention(5);
  entity.addMention(8);
  entity.addMention(10);

  t.assertEqual(entity.getMentionsInWindow(10, 5), 3, "3 mentions in last 5 turns (5, 8, 10)");
  t.assertEqual(entity.getMentionsInWindow(10, 3), 2, "2 mentions in last 3 turns (8, 10)");
  t.assertEqual(entity.getMentionsInWindow(10, 10), 4, "4 mentions in last 10 turns (1, 5, 8, 10)");
});

// ========== Relationship Tests ==========
runner.test("addRelationship creates new relationship", (t) => {
  const entity = new Entity({
    type: EntityType.PLUGIN,
    name: "Clarity",
    normalized: "clarity",
    firstMentionTurn: 1,
  });

  const rel = entity.addRelationship("tool:sessions_spawn", RelType.USES, 5);

  t.assertEqual(entity.relationships.length, 1, "One relationship");
  t.assertEqual(rel.targetId, "tool:sessions_spawn", "Target ID");
  t.assertEqual(rel.type, RelType.USES, "Relationship type");
  t.assertEqual(rel.lastCooccurrence, 5, "Co-occurrence turn");
});

runner.test("addRelationship updates existing relationship", (t) => {
  const entity = new Entity({
    type: EntityType.PLUGIN,
    name: "Clarity",
    normalized: "clarity",
    firstMentionTurn: 1,
  });

  entity.addRelationship("tool:sessions_spawn", RelType.USES, 5);
  const rel = entity.addRelationship("tool:sessions_spawn", RelType.USES, 10);

  t.assertEqual(entity.relationships.length, 1, "Still one relationship");
  t.assertCloseTo(rel.strength, 0.65, 0.0001, "Strength updated (0.5 * 0.7 + 0.3)");
  t.assertEqual(rel.lastCooccurrence, 10, "Co-occurrence updated");
});

runner.test("getRelationships filters by type", (t) => {
  const entity = new Entity({
    type: EntityType.PLUGIN,
    name: "Clarity",
    normalized: "clarity",
    firstMentionTurn: 1,
  });

  entity.addRelationship("tool:sessions_spawn", RelType.USES, 5);
  entity.addRelationship("plugin:awareness", RelType.DEPENDS_ON, 5);
  entity.addRelationship("project:claracore", RelType.RELATED, 5);

  const usesRels = entity.getRelationships(RelType.USES);
  t.assertEqual(usesRels.length, 1, "One USES relationship");
  t.assertEqual(usesRels[0].targetId, "tool:sessions_spawn", "Correct target");
});

runner.test("getTopRelationships returns strongest first", (t) => {
  const entity = new Entity({
    type: EntityType.PLUGIN,
    name: "Clarity",
    normalized: "clarity",
    firstMentionTurn: 1,
  });

  entity.addRelationship("tool:a", RelType.USES, 5);
  entity.addRelationship("tool:b", RelType.USES, 10);
  entity.addRelationship("tool:c", RelType.USES, 10);

  // Update strengths - b gets updated twice
  entity.relationships[1].strength = 0.8;
  entity.relationships[2].strength = 0.9;

  const top = entity.getTopRelationships(2);
  t.assertEqual(top.length, 2, "Returns 2 relationships");
  t.assertEqual(top[0].targetId, "tool:c", "Strongest first");
  t.assertEqual(top[1].targetId, "tool:b", "Second strongest");
});

// ========== Anchor Tests ==========
runner.test("setAnchor marks entity as anchor", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "ImportantProject",
    normalized: "importantproject",
    firstMentionTurn: 1,
  });

  entity.setAnchor();
  t.assertTrue(entity.isAnchor, "Entity is anchor");

  entity.setAnchor(false);
  t.assertFalse(entity.isAnchor, "Entity is not anchor");
});

runner.test("setAnchor returns entity for chaining", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "Test",
    normalized: "test",
    firstMentionTurn: 1,
  });

  const result = entity.setAnchor();
  t.assertEqual(result, entity, "Returns self for chaining");
});

// ========== Scoring Tests ==========
runner.test("updateScore calculates total score", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "Test",
    normalized: "test",
    firstMentionTurn: 1,
  });

  entity.updateScore({ tfidf: 20, recency: 15, relationship: 5 });

  t.assertEqual(entity.tfidfScore, 20, "TF-IDF stored");
  t.assertEqual(entity.recencyScore, 15, "Recency stored");
  t.assertEqual(entity.relationshipScore, 5, "Relationship stored");
  t.assertEqual(entity.totalScore, 40, "Total score (20+15+5)");
});

runner.test("updateScore adds anchor bonus", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "Test",
    normalized: "test",
    firstMentionTurn: 1,
  });

  entity.setAnchor();
  entity.updateScore({ tfidf: 20, recency: 15, relationship: 5 }, 10);

  t.assertEqual(entity.anchorBonus, 10, "Anchor bonus stored");
  t.assertEqual(entity.totalScore, 50, "Total with anchor bonus (20+15+5+10)");
});

runner.test("updateScore caps at 100", (t) => {
  const entity = new Entity({
    type: EntityType.PROJECT,
    name: "Test",
    normalized: "test",
    firstMentionTurn: 1,
  });

  entity.updateScore({ tfidf: 50, recency: 40, relationship: 20 });

  t.assertEqual(entity.totalScore, 100, "Score capped at 100");
});

// ========== Serialization Tests ==========
runner.test("toJSON serializes entity", (t) => {
  const entity = new Entity({
    type: EntityType.PLUGIN,
    name: "Clarity",
    normalized: "clarity",
    firstMentionTurn: 1,
  });

  entity.addMention(2, "Working on clarity");
  entity.addRelationship("tool:sessions_spawn", RelType.USES, 2);
  entity.setAnchor();
  entity.updateScore({ tfidf: 25, recency: 20, relationship: 10 });

  const json = entity.toJSON();

  t.assertEqual(json.id, "plugin:clarity", "JSON has ID");
  t.assertEqual(json.type, "plugin", "JSON has type");
  t.assertEqual(json.mentionCount, 2, "JSON has mention count");
  t.assertEqual(json.relationships.length, 1, "JSON has relationships");
  t.assertTrue(json.isAnchor, "JSON has anchor flag");
});

runner.test("fromJSON restores entity", (t) => {
  const original = new Entity({
    type: EntityType.PROJECT,
    name: "ClaraCore",
    normalized: "claracore",
    firstMentionTurn: 1,
  });

  original.addMention(5);
  original.addRelationship("file:soul_md", RelType.CONTAINS, 5);
  original.updateScore({ tfidf: 30, recency: 25, relationship: 5 });

  const json = original.toJSON();
  const restored = Entity.fromJSON(json);

  t.assertEqual(restored.id, original.id, "ID restored");
  t.assertEqual(restored.name, original.name, "Name restored");
  t.assertEqual(restored.mentionCount, original.mentionCount, "Mentions restored");
  t.assertEqual(restored.relationships.length, 1, "Relationships restored");
  t.assertEqual(restored.totalScore, original.totalScore, "Score restored");
});

// ========== Relationship Class Tests ==========
runner.test("Relationship constructor sets properties", (t) => {
  const rel = new Relationship({
    targetId: "tool:test",
    type: RelType.USES,
    strength: 0.75,
    lastCooccurrence: 10,
  });

  t.assertEqual(rel.targetId, "tool:test", "Target ID");
  t.assertEqual(rel.type, "uses", "Type");
  t.assertEqual(rel.strength, 0.75, "Strength");
  t.assertEqual(rel.lastCooccurrence, 10, "Last co-occurrence");
});

runner.test("Relationship strength is clamped 0-1", (t) => {
  const rel1 = new Relationship({ targetId: "t", type: RelType.USES, strength: 1.5 });
  const rel2 = new Relationship({ targetId: "t", type: RelType.USES, strength: -0.5 });

  t.assertEqual(rel1.strength, 1, "Max 1");
  t.assertEqual(rel2.strength, 0, "Min 0");
});

runner.test("Relationship updateStrength increases strength", (t) => {
  const rel = new Relationship({
    targetId: "tool:test",
    type: RelType.USES,
    strength: 0.5,
  });

  rel.updateStrength(10, 0.3);

  t.assertCloseTo(rel.strength, 0.65, 0.0001, "Strength increased (0.5*0.7 + 0.3)");
  t.assertEqual(rel.lastCooccurrence, 10, "Turn updated");
});

runner.test("Relationship toJSON and fromJSON", (t) => {
  const original = new Relationship({
    targetId: "project:claracore",
    type: RelType.DEPENDS_ON,
    strength: 0.8,
    lastCooccurrence: 42,
  });

  const json = original.toJSON();
  const restored = Relationship.fromJSON(json);

  t.assertEqual(restored.targetId, original.targetId, "Target ID");
  t.assertEqual(restored.type, original.type, "Type");
  t.assertEqual(restored.strength, original.strength, "Strength");
});

// ========== EntityType/RelType Enum Tests ==========
runner.test("EntityType values are correct", (t) => {
  t.assertEqual(EntityType.PROJECT, "project", "PROJECT");
  t.assertEqual(EntityType.PLUGIN, "plugin", "PLUGIN");
  t.assertEqual(EntityType.TOOL, "tool", "TOOL");
  t.assertEqual(EntityType.FILE, "file", "FILE");
  t.assertEqual(EntityType.PERSON, "person", "PERSON");
  t.assertEqual(EntityType.TOPIC, "topic", "TOPIC");
  t.assertEqual(EntityType.DECISION, "decision", "DECISION");
});

runner.test("RelType values are correct", (t) => {
  t.assertEqual(RelType.CONTAINS, "contains", "CONTAINS");
  t.assertEqual(RelType.USES, "uses", "USES");
  t.assertEqual(RelType.RELATED, "related", "RELATED");
  t.assertEqual(RelType.DEPENDS_ON, "depends_on", "DEPENDS_ON");
  t.assertEqual(RelType.IMPLEMENTS, "implements", "IMPLEMENTS");
});

// Run tests
runner.run().then((success) => {
  process.exit(success ? 0 : 1);
});
