/**
 * Tests for RichFormatter — Enhanced output formatting for Clarity v2
 */

"use strict";

const assert = require("assert");
const {
  RichFormatter,
  RELATIONSHIP_PRIORITY,
  TYPE_LABELS,
  ENTITY_TYPE_DESCRIPTORS,
} = require("../rich-formatter");
const { THRESHOLDS, ENTITY_TYPES, RELATIONSHIP_TYPES } = require("../integration");

// Test utilities
function createMockEntity(id, type, score = 50, relationships = [], contexts = []) {
  return {
    id,
    type,
    normalized: id.split(":")[1] || id,
    totalScore: score,
    relationships,
    contexts,
    mentionCount: 1,
    isAnchor: false,
  };
}

function createMockRelationship(targetId, type, strength = 0.5) {
  return {
    targetId,
    type,
    strength,
    lastCooccurrence: 1,
  };
}

// ============================================================================
// TESTS
// ============================================================================

console.log("Running RichFormatter tests...\n");

// ----------------------------------------------------------------------------
// Test 1: Constructor and default options
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  assert.strictEqual(formatter.maxRelatedPerEntity, 3, "Default maxRelatedPerEntity should be 3");
  assert.strictEqual(
    formatter.minRelationshipStrength,
    0.1,
    "Default minRelationshipStrength should be 0.1",
  );
  assert.strictEqual(formatter.showDescriptions, true, "Default showDescriptions should be true");
  assert.strictEqual(
    formatter.showContextualPhrases,
    true,
    "Default showContextualPhrases should be true",
  );
  assert.strictEqual(formatter.includeTiers, true, "Default includeTiers should be true");
  console.log("✓ Test 1: Default options");
}

// ----------------------------------------------------------------------------
// Test 2: Custom options
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter({
    maxRelatedPerEntity: 5,
    showDescriptions: false,
    includeTiers: false,
  });
  assert.strictEqual(formatter.maxRelatedPerEntity, 5, "Custom maxRelatedPerEntity should work");
  assert.strictEqual(formatter.showDescriptions, false, "Custom showDescriptions should work");
  assert.strictEqual(formatter.includeTiers, false, "Custom includeTiers should work");
  console.log("✓ Test 2: Custom options");
}

// ----------------------------------------------------------------------------
// Test 3: Relevance indicators
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();

  // High relevance
  assert.strictEqual(formatter.getRelevanceIndicator(50), "●", "High relevance should show ●");
  assert.strictEqual(formatter.getRelevanceIndicator(45), "●", "Score 45 should show ●");
  assert.strictEqual(formatter.getRelevanceIndicator(40), "●", "Score 40 should show ●");

  // Medium relevance
  assert.strictEqual(formatter.getRelevanceIndicator(39), "○", "Score 39 should show ○");
  assert.strictEqual(formatter.getRelevanceIndicator(30), "○", "Score 30 should show ○");
  assert.strictEqual(formatter.getRelevanceIndicator(25), "○", "Score 25 should show ○");

  // Low relevance
  assert.strictEqual(formatter.getRelevanceIndicator(24), "·", "Score 24 should show ·");
  assert.strictEqual(formatter.getRelevanceIndicator(10), "·", "Score 10 should show ·");

  // Disabled tiers
  const noTierFormatter = new RichFormatter({ includeTiers: false });
  assert.strictEqual(
    noTierFormatter.getRelevanceIndicator(100),
    "",
    "Disabled tiers should return empty",
  );
  console.log("✓ Test 3: Relevance indicators");
}

// ----------------------------------------------------------------------------
// Test 4: Shorten entity ID
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  assert.strictEqual(formatter.shortenEntityId("project:claracore"), "claracore");
  assert.strictEqual(formatter.shortenEntityId("plugin:clarity"), "clarity");
  assert.strictEqual(formatter.shortenEntityId("tool:subagents"), "subagents");
  assert.strictEqual(
    formatter.shortenEntityId("file:memory_architecture_md"),
    "memory_architecture_md",
  );
  assert.strictEqual(formatter.shortenEntityId("claracore"), "claracore"); // No prefix
  assert.strictEqual(formatter.shortenEntityId("a:b:c"), "b:c"); // Multiple colons
  console.log("✓ Test 4: Shorten entity ID");
}

// ----------------------------------------------------------------------------
// Test 5: Get entity type from ID
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  assert.strictEqual(formatter.getEntityType("project:claracore"), "project");
  assert.strictEqual(formatter.getEntityType("plugin:clarity"), "plugin");
  assert.strictEqual(formatter.getEntityType("tool:subagents"), "tool");
  assert.strictEqual(formatter.getEntityType("file:memory_md"), "file");
  assert.strictEqual(formatter.getEntityType("person:valerie"), "person");
  console.log("✓ Test 5: Get entity type from ID");
}

// ----------------------------------------------------------------------------
// Test 6: Top relationships prioritization
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  const entity = createMockEntity("plugin:clarity", ENTITY_TYPES.PLUGIN, 50, [
    createMockRelationship("tool:subagents", RELATIONSHIP_TYPES.USES, 0.5),
    createMockRelationship("project:claracore", RELATIONSHIP_TYPES.RELATED, 0.8),
    createMockRelationship("file:config_json", RELATIONSHIP_TYPES.CONTAINS, 0.3),
    createMockRelationship("tool:exec", RELATIONSHIP_TYPES.USES, 0.4),
    createMockRelationship("plugin:awareness", RELATIONSHIP_TYPES.DEPENDS_ON, 0.6),
  ]);

  const topRel = formatter.getTopRelationships(entity, 3);

  // Should prioritize USES, then CONTAINS, then others
  assert.strictEqual(topRel.length, 3, "Should return max 3 relationships");
  assert.strictEqual(
    topRel[0].type,
    RELATIONSHIP_TYPES.USES,
    "First should be USES (highest priority)",
  );
  assert.strictEqual(topRel[0].targetId, "tool:subagents", "Should be subagents (stronger USES)");
  console.log("✓ Test 6: Top relationships prioritization");
}

// ----------------------------------------------------------------------------
// Test 7: Relationship grouping
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  const entity = createMockEntity("plugin:clarity", ENTITY_TYPES.PLUGIN, 50, [
    createMockRelationship("tool:subagents", RELATIONSHIP_TYPES.USES, 0.7),
    createMockRelationship("tool:exec", RELATIONSHIP_TYPES.USES, 0.5),
    createMockRelationship("project:claracore", RELATIONSHIP_TYPES.RELATED, 0.6),
  ]);

  const entityMap = new Map([
    ["tool:subagents", createMockEntity("tool:subagents", ENTITY_TYPES.TOOL)],
    ["tool:exec", createMockEntity("tool:exec", ENTITY_TYPES.TOOL)],
    ["project:claracore", createMockEntity("project:claracore", ENTITY_TYPES.PROJECT)],
  ]);

  const topRel = formatter.getTopRelationships(entity, 3);
  const grouped = formatter.groupRelationshipsByType(topRel, entityMap);

  assert(grouped.has(RELATIONSHIP_TYPES.USES), "Should have USES group");
  assert.strictEqual(
    grouped.get(RELATIONSHIP_TYPES.USES).length,
    2,
    "Should have 2 USES relationships",
  );
  assert(grouped.has(RELATIONSHIP_TYPES.RELATED), "Should have RELATED group");
  console.log("✓ Test 7: Relationship grouping");
}

// ----------------------------------------------------------------------------
// Test 8: Format related entities string
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  const entity = createMockEntity("plugin:clarity", ENTITY_TYPES.PLUGIN, 50, [
    createMockRelationship("tool:subagents", RELATIONSHIP_TYPES.USES, 0.7),
    createMockRelationship("tool:exec", RELATIONSHIP_TYPES.USES, 0.5),
    createMockRelationship("project:claracore", RELATIONSHIP_TYPES.RELATED, 0.6),
  ]);

  const entityMap = new Map([
    ["plugin:clarity", entity],
    ["tool:subagents", createMockEntity("tool:subagents", ENTITY_TYPES.TOOL)],
    ["tool:exec", createMockEntity("tool:exec", ENTITY_TYPES.TOOL)],
    ["project:claracore", createMockEntity("project:claracore", ENTITY_TYPES.PROJECT)],
  ]);

  const relatedStr = formatter.formatRelatedEntities(entity, entityMap);

  assert(relatedStr.includes("uses:"), 'Should include "uses:" label');
  assert(relatedStr.includes("subagents"), "Should include subagents");
  assert(relatedStr.includes("related to:"), 'Should include "related to:" label');
  assert(relatedStr.includes("claracore"), "Should include claracore");
  console.log("✓ Test 8: Format related entities string");
}

// ----------------------------------------------------------------------------
// Test 9: Contextual phrases for project entity
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  const entity = createMockEntity("project:claracore", ENTITY_TYPES.PROJECT, 50);

  const phrases = formatter.getContextualPhrases(entity, []);

  assert(phrases.length >= 1, "Should generate at least one phrase");
  assert(phrases[0].includes("claracore"), "Phrase should include entity name");
  assert(
    phrases[0].includes("working on") ||
      phrases[0].includes("developing") ||
      phrases[0].includes("building"),
    "Should include action verb",
  );
  console.log("✓ Test 9: Contextual phrases for project entity");
}

// ----------------------------------------------------------------------------
// Test 10: Contextual phrases with related entities
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  const entity = createMockEntity("plugin:clarity", ENTITY_TYPES.PLUGIN, 50);
  const related = [
    { entityId: "tool:subagents", type: RELATIONSHIP_TYPES.USES },
    { entityId: "project:claracore", type: RELATIONSHIP_TYPES.RELATED },
  ];

  const phrases = formatter.getContextualPhrases(entity, related);

  assert(phrases.length >= 2, "Should generate multiple phrases with related entities");

  // Should have "using clarity" phrase
  const hasUsingPhrase = phrases.some((p) => p.includes("using") && p.includes("clarity"));
  assert(hasUsingPhrase, 'Should include "using clarity" phrase');
  console.log("✓ Test 10: Contextual phrases with related entities");
}

// ----------------------------------------------------------------------------
// Test 11: Contextual phrases for different entity types
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();

  // Project
  const project = createMockEntity("project:openclaw", ENTITY_TYPES.PROJECT);
  const projectPhrases = formatter.getContextualPhrases(project, []);
  assert(projectPhrases[0].includes("working on") || projectPhrases[0].includes("developing"));

  // Plugin
  const plugin = createMockEntity("plugin:awareness", ENTITY_TYPES.PLUGIN);
  const pluginPhrases = formatter.getContextualPhrases(plugin, []);
  assert(pluginPhrases[0].includes("using") || pluginPhrases[0].includes("configuring"));

  // Tool
  const tool = createMockEntity("tool:exec", ENTITY_TYPES.TOOL);
  const toolPhrases = formatter.getContextualPhrases(tool, []);
  assert(toolPhrases[0].includes("using") || toolPhrases[0].includes("calling"));

  // File
  const file = createMockEntity("file:soul_md", ENTITY_TYPES.FILE);
  const filePhrases = formatter.getContextualPhrases(file, []);
  assert(filePhrases[0].includes("editing") || filePhrases[0].includes("reading"));

  console.log("✓ Test 11: Contextual phrases for different entity types");
}

// ----------------------------------------------------------------------------
// Test 12: Format full entity line
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  const entity = createMockEntity("plugin:clarity", ENTITY_TYPES.PLUGIN, 65, [
    createMockRelationship("tool:subagents", RELATIONSHIP_TYPES.USES, 0.7),
    createMockRelationship("project:claracore", RELATIONSHIP_TYPES.RELATED, 0.6),
    createMockRelationship("project:openclaw", RELATIONSHIP_TYPES.RELATED, 0.5),
  ]);

  const entityMap = new Map([
    ["plugin:clarity", entity],
    ["tool:subagents", createMockEntity("tool:subagents", ENTITY_TYPES.TOOL)],
    ["project:claracore", createMockEntity("project:claracore", ENTITY_TYPES.PROJECT)],
    ["project:openclaw", createMockEntity("project:openclaw", ENTITY_TYPES.PROJECT)],
  ]);

  const line = formatter.formatEntity(entity, entityMap);

  // Expected format: "● plugin:clarity (score: 65) — uses: subagents, related to: claracore, openclaw"
  assert(line.includes("plugin:clarity"), "Should include entity ID");
  assert(line.includes("score: 65"), "Should include score");
  assert(line.includes("uses:"), "Should include uses label");
  assert(line.includes("subagents"), "Should include subagents");
  assert(line.includes("related to:"), "Should include related to label");
  console.log("✓ Test 12: Format full entity line");
}

// ----------------------------------------------------------------------------
// Test 13: Format full context
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();

  const entities = [
    createMockEntity("plugin:clarity", ENTITY_TYPES.PLUGIN, 65, [
      createMockRelationship("tool:subagents", RELATIONSHIP_TYPES.USES, 0.7),
    ]),
    createMockEntity("project:claracore", ENTITY_TYPES.PROJECT, 55, [
      createMockRelationship("plugin:clarity", RELATIONSHIP_TYPES.CONTAINS, 0.5),
    ]),
  ];

  const entityMap = new Map([
    ["plugin:clarity", entities[0]],
    ["project:claracore", entities[1]],
    ["tool:subagents", createMockEntity("tool:subagents", ENTITY_TYPES.TOOL)],
  ]);

  const output = formatter.formatContext(entities, entityMap, 5);

  assert(output.includes("[CLARITY CONTEXT]"), "Should include header");
  assert(output.includes("plugin:clarity"), "Should include clarity plugin");
  assert(output.includes("project:claracore"), "Should include claracore project");
  console.log("✓ Test 13: Format full context");
}

// ----------------------------------------------------------------------------
// Test 14: Empty entities handling
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  const output = formatter.formatContext([], new Map(), 5);

  assert(output.includes("[CLARITY CONTEXT]"), "Should include header");
  assert(output.includes("No tracked entities"), "Should indicate no entities");
  console.log("✓ Test 14: Empty entities handling");
}

// ----------------------------------------------------------------------------
// Test 15: Relationship priority constants
// ----------------------------------------------------------------------------
{
  assert.strictEqual(
    RELATIONSHIP_PRIORITY[RELATIONSHIP_TYPES.USES],
    1,
    "USES should have priority 1",
  );
  assert.strictEqual(
    RELATIONSHIP_PRIORITY[RELATIONSHIP_TYPES.CONTAINS],
    2,
    "CONTAINS should have priority 2",
  );
  assert.strictEqual(
    RELATIONSHIP_PRIORITY[RELATIONSHIP_TYPES.DEPENDS_ON],
    3,
    "DEPENDS_ON should have priority 3",
  );
  assert.strictEqual(
    RELATIONSHIP_PRIORITY[RELATIONSHIP_TYPES.RELATED],
    5,
    "RELATED should have lowest priority",
  );
  console.log("✓ Test 15: Relationship priority constants");
}

// ----------------------------------------------------------------------------
// Test 16: Type labels
// ----------------------------------------------------------------------------
{
  assert.strictEqual(TYPE_LABELS[RELATIONSHIP_TYPES.USES], "uses");
  assert.strictEqual(TYPE_LABELS[RELATIONSHIP_TYPES.CONTAINS], "contains");
  assert.strictEqual(TYPE_LABELS[RELATIONSHIP_TYPES.RELATED], "related to");
  assert.strictEqual(TYPE_LABELS[RELATIONSHIP_TYPES.DEPENDS_ON], "depends on");
  console.log("✓ Test 16: Type labels");
}

// ----------------------------------------------------------------------------
// Test 17: Entity type descriptors exist
// ----------------------------------------------------------------------------
{
  assert(ENTITY_TYPE_DESCRIPTORS.project, "Should have project descriptor");
  assert(ENTITY_TYPE_DESCRIPTORS.plugin, "Should have plugin descriptor");
  assert(ENTITY_TYPE_DESCRIPTORS.tool, "Should have tool descriptor");
  assert(ENTITY_TYPE_DESCRIPTORS.file, "Should have file descriptor");
  assert(ENTITY_TYPE_DESCRIPTORS.person, "Should have person descriptor");
  assert(ENTITY_TYPE_DESCRIPTORS.topic, "Should have topic descriptor");
  assert(ENTITY_TYPE_DESCRIPTORS.decision, "Should have decision descriptor");

  // Check structure
  assert(ENTITY_TYPE_DESCRIPTORS.project.article, "Should have article");
  assert(ENTITY_TYPE_DESCRIPTORS.project.preposition, "Should have preposition");
  assert(
    Array.isArray(ENTITY_TYPE_DESCRIPTORS.project.actionVerbs),
    "Should have actionVerbs array",
  );
  console.log("✓ Test 17: Entity type descriptors");
}

// ----------------------------------------------------------------------------
// Test 18: Max 3 related items per entity
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter({ maxRelatedPerEntity: 3 });
  const entity = createMockEntity("plugin:clarity", ENTITY_TYPES.PLUGIN, 50, [
    createMockRelationship("tool:subagents", RELATIONSHIP_TYPES.USES, 0.7),
    createMockRelationship("tool:exec", RELATIONSHIP_TYPES.USES, 0.6),
    createMockRelationship("tool:read", RELATIONSHIP_TYPES.USES, 0.5),
    createMockRelationship("tool:write", RELATIONSHIP_TYPES.USES, 0.4),
    createMockRelationship("project:claracore", RELATIONSHIP_TYPES.RELATED, 0.8),
  ]);

  const topRel = formatter.getTopRelationships(entity, 3);
  assert.strictEqual(topRel.length <= 3, true, "Should respect maxRelatedPerEntity limit");
  console.log("✓ Test 18: Max 3 related items per entity");
}

// ----------------------------------------------------------------------------
// Test 19: Minimum relationship strength filtering
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter({ minRelationshipStrength: 0.3 });
  const entity = createMockEntity("plugin:clarity", ENTITY_TYPES.PLUGIN, 50, [
    createMockRelationship("tool:subagents", RELATIONSHIP_TYPES.USES, 0.7),
    createMockRelationship("tool:exec", RELATIONSHIP_TYPES.USES, 0.2), // Below threshold
    createMockRelationship("tool:read", RELATIONSHIP_TYPES.USES, 0.1), // Below threshold
  ]);

  const topRel = formatter.getTopRelationships(entity, 10);
  assert.strictEqual(topRel.length, 1, "Should filter below minRelationshipStrength");
  assert.strictEqual(
    topRel[0].targetId,
    "tool:subagents",
    "Should only include strong relationship",
  );
  console.log("✓ Test 19: Minimum relationship strength filtering");
}

// ----------------------------------------------------------------------------
// Test 20: Format description with context
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  const entityWithContext = createMockEntity(
    "plugin:clarity",
    ENTITY_TYPES.PLUGIN,
    50,
    [],
    ["clarity plugin for context tracking"],
  );

  const desc = formatter.formatDescription(entityWithContext);
  assert(desc.includes("context:"), "Should include context label");
  assert(desc.includes("clarity plugin"), "Should include context text");

  // Entity without context
  const entityNoContext = createMockEntity("plugin:awareness", ENTITY_TYPES.PLUGIN, 50);
  const descNoContext = formatter.formatDescription(entityNoContext);
  assert.strictEqual(descNoContext, "", "Should return empty for no context");
  console.log("✓ Test 20: Format description with context");
}

// ----------------------------------------------------------------------------
// Test 21: Topics formatting
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  const entities = [
    createMockEntity("project:claracore", ENTITY_TYPES.PROJECT, 50),
    createMockEntity("plugin:clarity", ENTITY_TYPES.PLUGIN, 45),
    createMockEntity("tool:subagents", ENTITY_TYPES.TOOL, 40),
  ];

  const topics = formatter.formatTopics(entities, 5);
  assert.strictEqual(topics.length, 3, "Should return all topics");
  assert(topics.includes("claracore"), "Should include claracore");
  assert(topics.includes("clarity"), "Should include clarity");
  console.log("✓ Test 21: Topics formatting");
}

// ----------------------------------------------------------------------------
// Test 22: Relationships formatting
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();
  const relationships = [
    {
      sourceId: "plugin:clarity",
      targetId: "tool:subagents",
      type: RELATIONSHIP_TYPES.USES,
      strength: 0.7,
    },
    {
      sourceId: "project:claracore",
      targetId: "plugin:clarity",
      type: RELATIONSHIP_TYPES.CONTAINS,
      strength: 0.5,
    },
  ];

  const lines = formatter.formatRelationships(relationships, 5);
  assert.strictEqual(lines.length, 2, "Should format both relationships");
  assert(lines[0].includes("clarity"), "Should include source name");
  assert(lines[0].includes("subagents"), "Should include target name");
  assert(lines[0].includes("uses"), "Should include relationship type");
  console.log("✓ Test 22: Relationships formatting");
}

// ----------------------------------------------------------------------------
// Test 23: Complete example output format
// ----------------------------------------------------------------------------
{
  const formatter = new RichFormatter();

  // Simulate a realistic scenario
  const entities = [
    createMockEntity("plugin:clarity", ENTITY_TYPES.PLUGIN, 65, [
      createMockRelationship("tool:subagents", RELATIONSHIP_TYPES.USES, 0.8),
      createMockRelationship("project:claracore", RELATIONSHIP_TYPES.RELATED, 0.7),
      createMockRelationship("project:openclaw", RELATIONSHIP_TYPES.RELATED, 0.5),
    ]),
    createMockEntity("project:claracore", ENTITY_TYPES.PROJECT, 55, [
      createMockRelationship("plugin:clarity", RELATIONSHIP_TYPES.CONTAINS, 0.6),
      createMockRelationship("file:soul_md", RELATIONSHIP_TYPES.CONTAINS, 0.4),
    ]),
    createMockEntity("tool:subagents", ENTITY_TYPES.TOOL, 45, [
      createMockRelationship("plugin:clarity", RELATIONSHIP_TYPES.RELATED, 0.5),
    ]),
  ];

  const entityMap = new Map(entities.map((e) => [e.id, e]));
  entityMap.set("file:soul_md", createMockEntity("file:soul_md", ENTITY_TYPES.FILE));
  entityMap.set("project:openclaw", createMockEntity("project:openclaw", ENTITY_TYPES.PROJECT));

  const output = formatter.formatContext(entities, entityMap);

  console.log("\n--- Example Output ---");
  console.log(output);
  console.log("----------------------\n");

  // Verify structure
  assert(output.includes("[CLARITY CONTEXT]"), "Should have header");
  assert(output.includes("plugin:clarity"), "Should have clarity plugin");
  assert(output.includes("uses: subagents"), "Should show USES relationship");
  assert(output.includes("related to:"), "Should show RELATED relationships");
  console.log("✓ Test 23: Complete example output format");
}

// ============================================================================
console.log("\n✅ All tests passed!");
console.log(`\nTest Summary: 23 tests passed`);
