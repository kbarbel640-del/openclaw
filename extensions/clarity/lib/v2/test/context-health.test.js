/**
 * context-health.test.js - Tests for context health diagnostics
 */

'use strict';

const {
  calculateClutterScore,
  detectPotentialDuplicates,
  findBuriedImportant,
  calculateSignalToNoise,
  generateHealthReport,
  formatHealthReport,
  determineHealthStatus,
  generateSuggestions,
  HEALTH_THRESHOLDS,
  HEALTH_STATUS,
} = require('../context-health');

// Mock Entity class for testing
class MockEntity {
  constructor(id, type, name, normalized, options = {}) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.normalized = normalized;
    this.mentionCount = options.mentionCount || 1;
    this.mentionHistory = options.mentionHistory || [1];
    this.firstMentionTurn = options.firstMentionTurn || 1;
    this.lastMentionTurn = options.lastMentionTurn || 1;
    this.totalScore = options.totalScore || 0;
    this.isAnchor = options.isAnchor || false;
    this.contexts = options.contexts || [];
    this.relationships = options.relationships || [];
  }
}

// Test utilities
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual, expected, tolerance = 0.01, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ~${expected}, got ${actual}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(`${message}: expected true, got ${value}`);
  }
}

function assertGreaterThan(actual, threshold, message) {
  if (!(actual > threshold)) {
    throw new Error(`${message}: expected > ${threshold}, got ${actual}`);
  }
}

function assertLessThan(actual, threshold, message) {
  if (!(actual < threshold)) {
    throw new Error(`${message}: expected < ${threshold}, got ${actual}`);
  }
}

// ============================================================================
// Test Suite: calculateClutterScore
// ============================================================================

console.log('\n=== Clutter Score Tests ===\n');

{
  console.log('Test: Empty entities returns 0');
  const score = calculateClutterScore([]);
  assertEqual(score, 0, 'Empty entities should have 0 clutter');
  console.log('  ✓ Empty entities return 0');
}

{
  console.log('Test: Few high-quality entities have low clutter');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { totalScore: 50 }),
    new MockEntity('p:proj2', 'project', 'Project B', 'project_b', { totalScore: 60 }),
  ];
  const score = calculateClutterScore(entities);
  assertEqual(score, 0, '2 high-quality entities should not be cluttered');
  console.log('  ✓ Low entity count with high quality = low clutter');
}

{
  console.log('Test: Many entities increase clutter score');
  const entities = Array(50).fill(null).map((_, i) => 
    new MockEntity(`p:proj${i}`, 'project', `Project ${i}`, `project_${i}`, { totalScore: 30 })
  );
  const score = calculateClutterScore(entities);
  assertGreaterThan(score, 50, '50 entities should have high clutter');
  console.log('  ✓ Many entities increase clutter score');
}

{
  console.log('Test: Low-quality entities increase clutter');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { totalScore: 50 }),
    new MockEntity('p:proj2', 'project', 'Project B', 'project_b', { totalScore: 10 }),
    new MockEntity('p:proj3', 'project', 'Project C', 'project_c', { totalScore: 15 }),
  ];
  const score = calculateClutterScore(entities);
  assertGreaterThan(score, 0, 'Low-quality entities should increase clutter');
  console.log('  ✓ Low-quality entities contribute to clutter');
}

// ============================================================================
// Test Suite: detectPotentialDuplicates
// ============================================================================

console.log('\n=== Duplicate Detection Tests ===\n');

{
  console.log('Test: Empty entities returns empty array');
  const dups = detectPotentialDuplicates([]);
  assertEqual(dups.length, 0, 'Empty array should have no duplicates');
  console.log('  ✓ Empty entities returns empty array');
}

{
  console.log('Test: Single entity returns empty array');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a'),
  ];
  const dups = detectPotentialDuplicates(entities);
  assertEqual(dups.length, 0, 'Single entity should have no duplicates');
  console.log('  ✓ Single entity returns empty array');
}

{
  console.log('Test: Detects very similar entities');
  const entities = [
    new MockEntity('p:clarity', 'plugin', 'Clarity', 'clarity'),
    new MockEntity('p:clarity_plugin', 'plugin', 'Clarity Plugin', 'clarity_plugin'),
  ];
  const dups = detectPotentialDuplicates(entities);
  assertGreaterThan(dups.length, 0, 'Should detect "clarity" and "clarity_plugin" as duplicates');
  assertGreaterThan(dups[0].similarity, 0.7, 'Similarity should be above 0.7');
  console.log('  ✓ Detects similar entity names');
}

{
  console.log('Test: Different entities are not duplicates');
  const entities = [
    new MockEntity('p:clarity', 'plugin', 'Clarity', 'clarity'),
    new MockEntity('p:database', 'tool', 'Database', 'database'),
  ];
  const dups = detectPotentialDuplicates(entities);
  assertEqual(dups.length, 0, 'Different entities should not be duplicates');
  console.log('  ✓ Different entities correctly ignored');
}

{
  console.log('Test: Sorts duplicates by similarity (highest first)');
  const entities = [
    new MockEntity('p:clarity', 'plugin', 'Clarity', 'clarity'),
    new MockEntity('p:clarity_v2', 'plugin', 'Clarity V2', 'clarity_v2'),
    new MockEntity('p:clarity_plugin', 'plugin', 'Clarity Plugin', 'clarity_plugin'),
  ];
  const dups = detectPotentialDuplicates(entities);
  assertGreaterThan(dups.length, 1, 'Should find multiple duplicates');
  assertGreaterThan(dups[0].similarity, dups[dups.length - 1].similarity, 
    'Duplicates should be sorted by similarity');
  console.log('  ✓ Duplicates sorted by similarity');
}

// ============================================================================
// Test Suite: findBuriedImportant
// ============================================================================

console.log('\n=== Buried Important Tests ===\n');

{
  console.log('Test: Empty entities returns empty array');
  const buried = findBuriedImportant([], 10);
  assertEqual(buried.length, 0, 'Empty array should have no buried entities');
  console.log('  ✓ Empty entities returns empty array');
}

{
  console.log('Test: Recently mentioned entity is not buried');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { 
      mentionCount: 5, 
      lastMentionTurn: 5 
    }),
  ];
  const buried = findBuriedImportant(entities, 10);
  assertEqual(buried.length, 0, 'Recently mentioned entity should not be buried');
  console.log('  ✓ Recent entities not flagged as buried');
}

{
  console.log('Test: Entity with few mentions is not buried');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { 
      mentionCount: 2, 
      lastMentionTurn: 1 
    }),
  ];
  const buried = findBuriedImportant(entities, 15);
  assertEqual(buried.length, 0, 'Entity with few mentions should not be buried');
  console.log('  ✓ Low mention count entities not flagged');
}

{
  console.log('Test: Well-mentioned but old entity is buried');
  const entities = [
    new MockEntity('p:important', 'project', 'Important Project', 'important_project', { 
      mentionCount: 5, 
      lastMentionTurn: 5,
      totalScore: 30,
    }),
  ];
  const buried = findBuriedImportant(entities, 20);
  assertEqual(buried.length, 1, 'Old well-mentioned entity should be buried');
  assertEqual(buried[0].mentionCount, 5, 'Should preserve mention count');
  assertEqual(buried[0].turnsSinceLast, 15, 'Should calculate turns since correctly');
  console.log('  ✓ Detects buried important entity');
}

{
  console.log('Test: Anchored entities are not buried');
  const entities = [
    new MockEntity('p:anchored', 'project', 'Anchored Project', 'anchored_project', { 
      mentionCount: 5, 
      lastMentionTurn: 5,
      isAnchor: true,
    }),
  ];
  const buried = findBuriedImportant(entities, 20);
  assertEqual(buried.length, 0, 'Anchored entity should not be buried');
  console.log('  ✓ Anchored entities excluded from buried list');
}

// ============================================================================
// Test Suite: calculateSignalToNoise
// ============================================================================

console.log('\n=== Signal to Noise Tests ===\n');

{
  console.log('Test: Empty entities returns zeros');
  const stn = calculateSignalToNoise([]);
  assertEqual(stn.ratio, 0, 'Empty should have ratio 0');
  assertEqual(stn.signal, 0, 'Empty should have signal 0');
  assertEqual(stn.noise, 0, 'Empty should have noise 0');
  console.log('  ✓ Empty entities return zero metrics');
}

{
  console.log('Test: All high-quality is all signal');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { totalScore: 50 }),
    new MockEntity('p:proj2', 'project', 'Project B', 'project_b', { totalScore: 60 }),
  ];
  const stn = calculateSignalToNoise(entities);
  assertEqual(stn.signal, 2, 'Should count all as signal');
  assertEqual(stn.noise, 0, 'Should have no noise');
  assertEqual(stn.signalPercent, 100, 'Should be 100% signal');
  console.log('  ✓ All high-quality entities = 100% signal');
}

{
  console.log('Test: All low-quality is all noise');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { totalScore: 10 }),
    new MockEntity('p:proj2', 'project', 'Project B', 'project_b', { totalScore: 20 }),
  ];
  const stn = calculateSignalToNoise(entities);
  assertEqual(stn.signal, 0, 'Should count none as signal');
  assertEqual(stn.noise, 2, 'Should count all as noise');
  assertEqual(stn.noisePercent, 100, 'Should be 100% noise');
  console.log('  ✓ All low-quality entities = 100% noise');
}

{
  console.log('Test: Anchored entities count as signal');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { totalScore: 10 }),
    new MockEntity('p:proj2', 'project', 'Project B', 'project_b', { totalScore: 10, isAnchor: true }),
  ];
  const stn = calculateSignalToNoise(entities);
  assertEqual(stn.signal, 1, 'Anchored should count as signal');
  assertEqual(stn.signalPercent, 50, 'Should be 50% signal');
  console.log('  ✓ Anchored entities count as signal');
}

{
  console.log('Test: Mixed signal and noise');
  const entities = [
    new MockEntity('p:high1', 'project', 'High 1', 'high_1', { totalScore: 50 }),
    new MockEntity('p:high2', 'project', 'High 2', 'high_2', { totalScore: 60 }),
    new MockEntity('p:low1', 'project', 'Low 1', 'low_1', { totalScore: 10 }),
    new MockEntity('p:low2', 'project', 'Low 2', 'low_2', { totalScore: 20 }),
  ];
  const stn = calculateSignalToNoise(entities);
  assertEqual(stn.signal, 2, 'Should count 2 as signal');
  assertEqual(stn.noise, 2, 'Should count 2 as noise');
  assertEqual(stn.signalPercent, 50, 'Should be 50% signal');
  assertClose(stn.ratio, 1.0, 0.1, 'Ratio should be 1.0');
  console.log('  ✓ Correctly calculates mixed signal/noise');
}

// ============================================================================
// Test Suite: determineHealthStatus
// ============================================================================

console.log('\n=== Health Status Tests ===\n');

{
  console.log('Test: Healthy status');
  const status = determineHealthStatus(15, 80, 0);
  assertEqual(status.status, HEALTH_STATUS.HEALTHY, 'Should be healthy');
  assertTrue(status.description.includes('15 entities'), 'Description should mention entities');
  console.log('  ✓ Healthy status detected correctly');
}

{
  console.log('Test: Cluttered due to entity count');
  const status = determineHealthStatus(25, 80, 0);
  assertEqual(status.status, HEALTH_STATUS.CLUTTERED, 'Should be cluttered');
  assertTrue(status.description.includes('25 entities'), 'Description should mention entities');
  console.log('  ✓ Cluttered status (entity count) detected');
}

{
  console.log('Test: Cluttered due to quality');
  const status = determineHealthStatus(15, 50, 0);
  assertEqual(status.status, HEALTH_STATUS.CLUTTERED, 'Should be cluttered');
  assertTrue(status.description.includes('50%'), 'Description should mention quality');
  console.log('  ✓ Cluttered status (quality) detected');
}

{
  console.log('Test: Cluttered due to duplicates');
  const status = determineHealthStatus(15, 80, 2);
  assertEqual(status.status, HEALTH_STATUS.CLUTTERED, 'Should be cluttered');
  assertTrue(status.description.includes('duplicate'), 'Description should mention duplicates');
  console.log('  ✓ Cluttered status (duplicates) detected');
}

{
  console.log('Test: Overloaded due to many entities');
  const status = determineHealthStatus(50, 80, 0);
  assertEqual(status.status, HEALTH_STATUS.OVERLOADED, 'Should be overloaded');
  console.log('  ✓ Overloaded status (entities) detected');
}

{
  console.log('Test: Overloaded due to low quality');
  const status = determineHealthStatus(15, 20, 0);
  assertEqual(status.status, HEALTH_STATUS.OVERLOADED, 'Should be overloaded');
  console.log('  ✓ Overloaded status (quality) detected');
}

// ============================================================================
// Test Suite: generateSuggestions
// ============================================================================

console.log('\n=== Suggestions Tests ===\n');

{
  console.log('Test: No suggestions for healthy context');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { totalScore: 50 }),
  ];
  const healthData = {
    entityCount: 1,
    signalToNoise: { noise: 0 },
    duplicates: [],
    buriedImportant: [],
    clutterScore: 0,
  };
  const suggestions = generateSuggestions(entities, healthData);
  assertEqual(suggestions.length, 0, 'Healthy context should have no suggestions');
  console.log('  ✓ No suggestions for healthy context');
}

{
  console.log('Test: Pruning suggestion for cluttered context');
  const entities = Array(25).fill(null).map((_, i) =>
    new MockEntity(`p:proj${i}`, 'project', `Project ${i}`, `project_${i}`, { totalScore: 10 })
  );
  const healthData = {
    entityCount: 25,
    signalToNoise: { noise: 25 },
    duplicates: [],
    buriedImportant: [],
    clutterScore: 50,
  };
  const suggestions = generateSuggestions(entities, healthData);
  assertGreaterThan(suggestions.length, 0, 'Should suggest pruning');
  assertTrue(suggestions[0].includes('/clarity prune'), 'Should suggest prune command');
  console.log('  ✓ Pruning suggestion generated');
}

{
  console.log('Test: Merge suggestion for duplicates');
  const entities = [
    new MockEntity('p:clarity', 'plugin', 'Clarity', 'clarity'),
    new MockEntity('p:clarity_plugin', 'plugin', 'Clarity Plugin', 'clarity_plugin'),
  ];
  const healthData = {
    entityCount: 2,
    signalToNoise: { noise: 0 },
    duplicates: [{
      entity1: entities[0],
      entity2: entities[1],
      similarity: 0.85,
    }],
    buriedImportant: [],
    clutterScore: 0,
  };
  const suggestions = generateSuggestions(entities, healthData);
  assertGreaterThan(suggestions.length, 0, 'Should suggest merging');
  assertTrue(suggestions[0].includes('/clarity merge'), 'Should suggest merge command');
  console.log('  ✓ Merge suggestion generated');
}

{
  console.log('Test: Anchor suggestion for buried important');
  const entities = [
    new MockEntity('p:important', 'project', 'Important Project', 'important_project', {
      mentionCount: 5,
      lastMentionTurn: 5,
      totalScore: 30,
    }),
  ];
  const healthData = {
    entityCount: 1,
    signalToNoise: { noise: 0 },
    duplicates: [],
    buriedImportant: [{
      entity: entities[0],
      mentionCount: 5,
      turnsSinceLast: 15,
      reason: 'mentioned 5×, last 15 turns ago',
    }],
    clutterScore: 0,
  };
  const suggestions = generateSuggestions(entities, healthData);
  assertGreaterThan(suggestions.length, 0, 'Should suggest anchoring');
  assertTrue(suggestions[0].includes('/clarity anchor'), 'Should suggest anchor command');
  console.log('  ✓ Anchor suggestion generated');
}

// ============================================================================
// Test Suite: generateHealthReport
// ============================================================================

console.log('\n=== Health Report Tests ===\n');

{
  console.log('Test: Complete health report structure');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { totalScore: 50 }),
    new MockEntity('p:proj2', 'project', 'Project B', 'project_b', { totalScore: 60 }),
  ];
  const report = generateHealthReport(entities, 10);
  
  assertTrue(report.status, 'Should have status');
  assertTrue(report.description, 'Should have description');
  assertTrue(report.metrics, 'Should have metrics');
  assertTrue(Array.isArray(report.duplicates), 'Should have duplicates array');
  assertTrue(Array.isArray(report.buriedImportant), 'Should have buriedImportant array');
  assertTrue(Array.isArray(report.suggestions), 'Should have suggestions array');
  console.log('  ✓ Health report has all required fields');
}

{
  console.log('Test: Healthy report for good context');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { totalScore: 50 }),
    new MockEntity('p:proj2', 'project', 'Project B', 'project_b', { totalScore: 60 }),
  ];
  const report = generateHealthReport(entities, 10);
  
  assertEqual(report.status, HEALTH_STATUS.HEALTHY, 'Should be healthy status');
  assertEqual(report.metrics.entityCount, 2, 'Should count entities');
  assertEqual(report.metrics.highQualityCount, 2, 'Should count high quality');
  assertEqual(report.metrics.highQualityPercent, 100, 'Should be 100% high quality');
  console.log('  ✓ Healthy context produces healthy report');
}

{
  console.log('Test: Report with duplicates');
  const entities = [
    new MockEntity('p:clarity', 'plugin', 'Clarity', 'clarity'),
    new MockEntity('p:clarity_plugin', 'plugin', 'Clarity Plugin', 'clarity_plugin'),
  ];
  const report = generateHealthReport(entities, 10);
  
  assertGreaterThan(report.duplicates.length, 0, 'Should detect duplicates');
  assertTrue(report.duplicates[0].entity1Name, 'Should have entity1 name');
  assertTrue(report.duplicates[0].entity2Name, 'Should have entity2 name');
  assertTrue(report.duplicates[0].similarity >= 0.7, 'Should have high similarity');
  console.log('  ✓ Report correctly includes duplicates');
}

{
  console.log('Test: Report with buried important');
  const entities = [
    new MockEntity('p:important', 'project', 'Important Project', 'important_project', {
      mentionCount: 5,
      lastMentionTurn: 5,
      firstMentionTurn: 1,
      totalScore: 30,
    }),
  ];
  const report = generateHealthReport(entities, 20);
  
  assertEqual(report.buriedImportant.length, 1, 'Should detect buried important');
  assertEqual(report.buriedImportant[0].entityName, 'Important Project', 'Should preserve name');
  assertEqual(report.buriedImportant[0].mentionCount, 5, 'Should preserve mention count');
  console.log('  ✓ Report correctly includes buried important');
}

// ============================================================================
// Test Suite: formatHealthReport
// ============================================================================

console.log('\n=== Format Health Report Tests ===\n');

{
  console.log('Test: Formats healthy report');
  const entities = [
    new MockEntity('p:proj1', 'project', 'Project A', 'project_a', { totalScore: 50 }),
  ];
  const report = generateHealthReport(entities, 10);
  const formatted = formatHealthReport(report);
  
  assertTrue(formatted.includes('[CONTEXT HEALTH]'), 'Should include header');
  assertTrue(formatted.includes('🟢'), 'Should include healthy emoji');
  assertTrue(formatted.includes('Metrics:'), 'Should include metrics line');
  console.log('  ✓ Healthy report formatted correctly');
}

{
  console.log('Test: Formats cluttered report with issues');
  const entities = [
    new MockEntity('p:clarity', 'plugin', 'Clarity', 'clarity'),
    new MockEntity('p:clarity_plugin', 'plugin', 'Clarity Plugin', 'clarity_plugin'),
    new MockEntity('p:important', 'project', 'Important Project', 'important_project', {
      mentionCount: 5,
      lastMentionTurn: 5,
      firstMentionTurn: 1,
      totalScore: 30,
    }),
    ...Array(25).fill(null).map((_, i) =>
      new MockEntity(`p:proj${i}`, 'project', `Project ${i}`, `project_${i}`, { totalScore: 10 })
    ),
  ];
  const report = generateHealthReport(entities, 20);
  const formatted = formatHealthReport(report);
  
  assertTrue(formatted.includes('🟡') || formatted.includes('🔴'), 'Should show warning status');
  assertTrue(formatted.includes('Potential duplicates:'), 'Should include duplicates section');
  assertTrue(formatted.includes('Buried important:'), 'Should include buried section');
  assertTrue(formatted.includes('Suggestions:'), 'Should include suggestions section');
  console.log('  ✓ Cluttered report formatted with all sections');
}

{
  console.log('Test: Formats duplicate information');
  const report = {
    status: HEALTH_STATUS.CLUTTERED,
    description: '2 potential duplicates',
    metrics: { highQualityPercent: 50, clutterScore: 30 },
    duplicates: [{
      entity1Name: 'Clarity',
      entity2Name: 'Clarity Plugin',
      entity1Id: 'p:clarity',
      entity2Id: 'p:clarity_plugin',
      similarity: 0.85,
    }],
    buriedImportant: [],
    suggestions: ['/clarity merge clarity,clarity_plugin'],
  };
  const formatted = formatHealthReport(report);
  
  assertTrue(formatted.includes('Clarity'), 'Should include first entity name');
  assertTrue(formatted.includes('Clarity Plugin'), 'Should include second entity name');
  assertTrue(formatted.includes('0.85'), 'Should include similarity score');
  console.log('  ✓ Duplicate information formatted correctly');
}

// ============================================================================
// Test Suite: Integration / Real-world Scenarios
// ============================================================================

console.log('\n=== Integration Tests ===\n');

{
  console.log('Test: Example scenario from spec');
  const entities = [
    new MockEntity('plugin:clarity', 'plugin', 'Clarity', 'clarity', { 
      totalScore: 45, 
      mentionCount: 10,
      lastMentionTurn: 2,
    }),
    new MockEntity('plugin:clarity_plugin', 'plugin', 'Clarity Plugin', 'clarity_plugin', { 
      totalScore: 25,
      mentionCount: 5,
      lastMentionTurn: 3,
    }),
    new MockEntity('plugin:openclaw', 'plugin', 'OpenClaw', 'openclaw', { 
      totalScore: 40,
      mentionCount: 8,
      lastMentionTurn: 1,
    }),
    new MockEntity('plugin:openclaw_gateway', 'plugin', 'OpenClaw Gateway', 'openclaw_gateway', { 
      totalScore: 20,
      mentionCount: 4,
      lastMentionTurn: 4,
    }),
    new MockEntity('project:karplus_dispute', 'project', 'Karplus Dispute', 'karplus_dispute', { 
      totalScore: 35,
      mentionCount: 3,
      lastMentionTurn: 5,
      firstMentionTurn: 1,
    }),
    ...Array(27).fill(null).map((_, i) =>
      new MockEntity(`misc:item${i}`, 'topic', `Item ${i}`, `item_${i}`, { 
        totalScore: Math.random() * 20,
        mentionCount: 1,
        lastMentionTurn: i % 5,
      })
    ),
  ];
  
  const report = generateHealthReport(entities, 20);
  const formatted = formatHealthReport(report);
  
  console.log('Generated report:');
  console.log(formatted);
  
  assertTrue(formatted.includes('Potential duplicates:'), 'Should detect duplicates');
  assertTrue(formatted.includes('clarity') || formatted.includes('Clarity'), 'Should mention clarity');
  assertTrue(formatted.includes('openclaw') || formatted.includes('OpenClaw'), 'Should mention openclaw');
  assertTrue(report.duplicates.length >= 2, 'Should find at least 2 duplicate pairs');
  console.log('  ✓ Example scenario produces expected output');
}

// ============================================================================
// Summary
// ============================================================================

console.log('\n=== All Tests Passed! ===\n');
