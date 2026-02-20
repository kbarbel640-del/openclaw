/* Entity Engine Deduplication Tests */

"use strict";

const { ClarityV2 } = require("../entity-engine");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`FAIL: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
  console.log(`✓ ${message}`);
}

function assertTrue(value, message) {
  if (!value) throw new Error(`FAIL: ${message}`);
  console.log(`✓ ${message}`);
}

console.log("\n=== Entity Engine Deduplication Tests ===\n");

{
  console.log('Test: Merge "clarity" and "clarity plugin"');
  const engine = new ClarityV2({ semanticMergeThreshold: 0.6 });

  // First mention: clarity
  const r1 = engine.processBatch([
    { type: "plugin", name: "clarity", normalized: "clarity", canonical: "plugin:clarity" },
  ]);

  assertEqual(r1.entityCount, 1, "First message should yield 1 extracted entity");
  assertEqual(
    engine.getState().entities.length,
    1,
    "Store should contain 1 entity after first mention",
  );

  // Second mention: clarity plugin (variation)
  const r2 = engine.processBatch([
    {
      type: "plugin",
      name: "clarity plugin",
      normalized: "clarity_plugin",
      canonical: "plugin:clarity_plugin",
    },
  ]);

  // Verify merge occurred
  assertTrue(r2.merged instanceof Map, "Merged map should be returned");
  assertTrue(r2.merged.has("plugin:clarity_plugin"), "Merged map should include clarity_plugin");
  assertEqual(
    r2.merged.get("plugin:clarity_plugin"),
    "plugin:clarity",
    "clarity_plugin should map to plugin:clarity",
  );

  // Store should end up with a single canonical entity
  const all = engine.getState().entities;
  assertEqual(all.length, 1, "Store should contain 1 canonical entity after merge");

  const canonical = engine.getEntity("plugin:clarity");
  assertTrue(
    canonical && canonical.mentionHistory && canonical.mentionHistory.length >= 2,
    "Canonical entity should have merged mention history",
  );

  console.log('\n✓ Successfully merged "clarity" variations\n');
}

console.log("\n=== All Entity Engine Dedup Tests Passed ===\n");
