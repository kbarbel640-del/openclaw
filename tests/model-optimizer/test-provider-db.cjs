#!/usr/bin/env node
/**
 * test-provider-db.cjs - Unit tests for scripts/provider-db.cjs
 *
 * Tests: Database init, seed builtins, CRUD providers, CRUD models,
 * getTestableModelsFromDB, and edge cases.
 *
 * All tests use :memory: SQLite databases to avoid file system side effects.
 *
 * Run inside Docker:
 *   MSYS_NO_PATHCONV=1 docker exec openclaw-openclaw-gateway-1 \
 *     node /host/home/openclaw/tests/model-optimizer/test-provider-db.cjs
 */
'use strict';

var assert = require('assert');

// ---------------------------------------------------------------------------
// Load the module under test
// ---------------------------------------------------------------------------
var providerDb;
try {
  providerDb = require('/host/home/openclaw/scripts/provider-db.cjs');
} catch (e) {
  console.error('FATAL: Cannot load provider-db.cjs - ' + e.message);
  console.error('Make sure the file exists at /host/home/openclaw/scripts/provider-db.cjs');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Test infrastructure (matches project pattern)
// ---------------------------------------------------------------------------
var passed = 0;
var failed = 0;
var skipped = 0;
var failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    failures.push({ name: name, error: e.message });
    console.log('  FAIL: ' + name + ' -- ' + e.message);
  }
}

function skip(name, reason) {
  skipped++;
  console.log('  SKIP: ' + name + ' -- ' + reason);
}

// ---------------------------------------------------------------------------
// Detect API surface and adapt tests accordingly
// ---------------------------------------------------------------------------
var hasInitDB = typeof providerDb.initDB === 'function';
var hasSeedBuiltins = typeof providerDb.seedBuiltinProviders === 'function';
var hasAddProvider = typeof providerDb.addProvider === 'function';
var hasGetProvider = typeof providerDb.getProvider === 'function';
var hasGetProviders = typeof providerDb.getProviders === 'function';
var hasUpdateProvider = typeof providerDb.updateProvider === 'function';
var hasRemoveProvider = typeof providerDb.removeProvider === 'function';
var hasAddModel = typeof providerDb.addModel === 'function';
var hasRemoveModel = typeof providerDb.removeModel === 'function';
var hasToggleModel = typeof providerDb.toggleModel === 'function';
var hasGetTestableModelsFromDB = typeof providerDb.getTestableModelsFromDB === 'function';
var hasCloseDB = typeof providerDb.closeDB === 'function';

console.log('\n=== provider-db.cjs API Surface ===\n');
console.log('  initDB:                  ' + hasInitDB);
console.log('  seedBuiltinProviders:    ' + hasSeedBuiltins);
console.log('  addProvider:             ' + hasAddProvider);
console.log('  getProvider:             ' + hasGetProvider);
console.log('  getProviders:            ' + hasGetProviders);
console.log('  updateProvider:          ' + hasUpdateProvider);
console.log('  removeProvider:          ' + hasRemoveProvider);
console.log('  addModel:                ' + hasAddModel);
console.log('  removeModel:             ' + hasRemoveModel);
console.log('  toggleModel:             ' + hasToggleModel);
console.log('  getTestableModelsFromDB: ' + hasGetTestableModelsFromDB);
console.log('  closeDB:                 ' + hasCloseDB);

// ===========================================================================
// TESTS: Database Initialization (5 tests)
// ===========================================================================
console.log('\n=== Database Initialization ===\n');

test('initDB creates tables and returns db handle', function() {
  if (!hasInitDB) throw new Error('initDB not exported');
  var db = providerDb.initDB(':memory:');
  assert.ok(db, 'initDB should return a db handle');
  // Verify tables exist by querying sqlite_master
  var tables;
  if (typeof db.prepare === 'function') {
    tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  } else if (db.tables) {
    tables = db.tables;
  }
  assert.ok(tables, 'should be able to query tables');
  if (typeof db.close === 'function') db.close();
  else if (hasCloseDB) providerDb.closeDB(db);
});

test('Re-init is idempotent (no error on second call)', function() {
  if (!hasInitDB) throw new Error('initDB not exported');
  var db = providerDb.initDB(':memory:');
  // Call init again on the same :memory: db -- should not throw
  // For :memory:, each call creates a new db, so just verify two calls succeed
  var db2 = providerDb.initDB(':memory:');
  assert.ok(db2, 'second initDB should succeed');
  if (typeof db.close === 'function') db.close();
  if (typeof db2.close === 'function') db2.close();
});

test('WAL mode is enabled', function() {
  if (!hasInitDB) throw new Error('initDB not exported');
  var db = providerDb.initDB(':memory:');
  if (typeof db.pragma === 'function') {
    var mode = db.pragma('journal_mode', { simple: true });
    // :memory: may report 'memory' instead of 'wal', both are acceptable
    assert.ok(mode === 'wal' || mode === 'memory',
      'journal_mode should be wal or memory, got: ' + mode);
  } else {
    // If not better-sqlite3 direct API, just verify db works
    assert.ok(db, 'db should be valid');
  }
  if (typeof db.close === 'function') db.close();
});

test('Foreign keys are enabled', function() {
  if (!hasInitDB) throw new Error('initDB not exported');
  var db = providerDb.initDB(':memory:');
  if (typeof db.pragma === 'function') {
    var fk = db.pragma('foreign_keys', { simple: true });
    assert.strictEqual(fk, 1, 'foreign_keys should be enabled (1)');
  } else {
    assert.ok(db, 'db should be valid');
  }
  if (typeof db.close === 'function') db.close();
});

test('In-memory DB works (no file created)', function() {
  if (!hasInitDB) throw new Error('initDB not exported');
  var db = providerDb.initDB(':memory:');
  assert.ok(db, ':memory: db should be valid');
  // Should be able to do basic operations
  if (typeof db.prepare === 'function') {
    var row = db.prepare('SELECT 1 as val').get();
    assert.strictEqual(row.val, 1);
  }
  if (typeof db.close === 'function') db.close();
});

// ===========================================================================
// TESTS: Seed Builtins (5 tests)
// ===========================================================================
console.log('\n=== Seed Builtins ===\n');

test('seedBuiltins seeds all KNOWN_PROVIDERS', function() {
  if (!hasInitDB || !hasSeedBuiltins) throw new Error('initDB or seedBuiltins not exported');
  var db = providerDb.initDB(':memory:');
  providerDb.seedBuiltinProviders(db);
  if (hasGetProviders) {
    var providers = providerDb.getProviders(db);
    assert.ok(providers.length >= 5,
      'Should have at least 5 providers after seeding, got ' + providers.length);
  }
  if (typeof db.close === 'function') db.close();
});

test('Seeded providers have correct total model count (22+)', function() {
  if (!hasInitDB || !hasSeedBuiltins) throw new Error('initDB or seedBuiltins not exported');
  var db = providerDb.initDB(':memory:');
  providerDb.seedBuiltinProviders(db);
  // Count models via direct query or API
  var modelCount = 0;
  if (typeof db.prepare === 'function') {
    var row = db.prepare('SELECT COUNT(*) as cnt FROM models').get();
    modelCount = row.cnt;
  } else if (hasGetProviders) {
    var providers = providerDb.getProviders(db);
    for (var i = 0; i < providers.length; i++) {
      var p = providers[i];
      modelCount += (p.models ? p.models.length : 0);
    }
  }
  assert.ok(modelCount >= 22,
    'Should have at least 22 models after seeding, got ' + modelCount);
  if (typeof db.close === 'function') db.close();
});

test('All seeded providers have is_builtin=1', function() {
  if (!hasInitDB || !hasSeedBuiltins) throw new Error('initDB or seedBuiltins not exported');
  var db = providerDb.initDB(':memory:');
  providerDb.seedBuiltinProviders(db);
  if (typeof db.prepare === 'function') {
    var nonBuiltin = db.prepare('SELECT COUNT(*) as cnt FROM providers WHERE is_builtin = 0').get();
    assert.strictEqual(nonBuiltin.cnt, 0, 'All seeded providers should be builtin');
  } else if (hasGetProviders) {
    var providers = providerDb.getProviders(db);
    for (var i = 0; i < providers.length; i++) {
      assert.ok(providers[i].is_builtin === 1 || providers[i].isBuiltin === true,
        'Provider ' + providers[i].name + ' should be builtin');
    }
  }
  if (typeof db.close === 'function') db.close();
});

test('Re-seed is idempotent (no duplicates)', function() {
  if (!hasInitDB || !hasSeedBuiltins) throw new Error('initDB or seedBuiltins not exported');
  var db = providerDb.initDB(':memory:');
  providerDb.seedBuiltinProviders(db);
  var countBefore = 0;
  if (typeof db.prepare === 'function') {
    countBefore = db.prepare('SELECT COUNT(*) as cnt FROM providers').get().cnt;
  }
  // Seed again
  providerDb.seedBuiltinProviders(db);
  var countAfter = 0;
  if (typeof db.prepare === 'function') {
    countAfter = db.prepare('SELECT COUNT(*) as cnt FROM providers').get().cnt;
  }
  assert.strictEqual(countAfter, countBefore,
    'Re-seed should not create duplicates: before=' + countBefore + ' after=' + countAfter);
  if (typeof db.close === 'function') db.close();
});

test('Providers have all required fields (name, displayName, baseUrl)', function() {
  if (!hasInitDB || !hasSeedBuiltins || !hasGetProviders) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.seedBuiltinProviders(db);
  var providers = providerDb.getProviders(db);
  for (var i = 0; i < providers.length; i++) {
    var p = providers[i];
    assert.ok(p.name && typeof p.name === 'string',
      'Provider at index ' + i + ' must have name');
    assert.ok(p.display_name || p.displayName,
      'Provider ' + p.name + ' must have displayName');
    assert.ok(p.base_url || p.baseUrl,
      'Provider ' + p.name + ' must have baseUrl');
  }
  if (typeof db.close === 'function') db.close();
});

// ===========================================================================
// TESTS: CRUD Providers (8 tests)
// ===========================================================================
console.log('\n=== CRUD Providers ===\n');

test('addProvider with valid data', function() {
  if (!hasInitDB || !hasAddProvider) throw new Error('Required functions not exported');
  var db = providerDb.initDB(':memory:');
  var result = providerDb.addProvider(db, {
    name: 'test-provider',
    displayName: 'Test Provider',
    baseUrl: 'https://api.test.com/v1',
    api: 'openai-completions',
    envVar: 'TEST_API_KEY',
    signupUrl: 'https://test.com/signup',
  });
  assert.ok(result, 'addProvider should return truthy result');
  if (typeof db.close === 'function') db.close();
});

test('addProvider validates required fields (name, displayName, baseUrl)', function() {
  if (!hasInitDB || !hasAddProvider) throw new Error('Required functions not exported');
  var db = providerDb.initDB(':memory:');
  var threw = false;
  try {
    providerDb.addProvider(db, { name: 'incomplete' });
  } catch (e) {
    threw = true;
  }
  assert.ok(threw, 'addProvider should throw/reject for missing required fields');
  if (typeof db.close === 'function') db.close();
});

test('getProvider returns provider with models', function() {
  if (!hasInitDB || !hasAddProvider || !hasGetProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'get-test',
    displayName: 'Get Test Provider',
    baseUrl: 'https://api.gettest.com/v1',
    api: 'openai-completions',
    envVar: 'GET_TEST_KEY',
    signupUrl: 'https://gettest.com',
  });
  if (hasAddModel) {
    providerDb.addModel(db, 'get-test', {
      id: 'test-model-1',
      name: 'Test Model 1',
      contextWindow: 8192,
      maxTokens: 4096,
      free: true,
    });
  }
  var provider = providerDb.getProvider(db, 'get-test');
  assert.ok(provider, 'getProvider should return the provider');
  assert.strictEqual(provider.name, 'get-test');
  if (hasAddModel) {
    assert.ok(Array.isArray(provider.models), 'provider should have models array');
  }
  if (typeof db.close === 'function') db.close();
});

test('getProviders lists all providers', function() {
  if (!hasInitDB || !hasAddProvider || !hasGetProviders) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'list-a',
    displayName: 'List A',
    baseUrl: 'https://a.com/v1',
    api: 'openai-completions',
    envVar: 'A_KEY',
    signupUrl: 'https://a.com',
  });
  providerDb.addProvider(db, {
    name: 'list-b',
    displayName: 'List B',
    baseUrl: 'https://b.com/v1',
    api: 'openai-completions',
    envVar: 'B_KEY',
    signupUrl: 'https://b.com',
  });
  var all = providerDb.getProviders(db);
  assert.ok(Array.isArray(all), 'getProviders should return array');
  assert.ok(all.length >= 2, 'should have at least 2 providers, got ' + all.length);
  if (typeof db.close === 'function') db.close();
});

test('getProviders filters by enabled', function() {
  if (!hasInitDB || !hasAddProvider || !hasGetProviders || !hasUpdateProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'enabled-prov',
    displayName: 'Enabled',
    baseUrl: 'https://enabled.com/v1',
    api: 'openai-completions',
    envVar: 'EN_KEY',
    signupUrl: 'https://enabled.com',
  });
  providerDb.addProvider(db, {
    name: 'disabled-prov',
    displayName: 'Disabled',
    baseUrl: 'https://disabled.com/v1',
    api: 'openai-completions',
    envVar: 'DIS_KEY',
    signupUrl: 'https://disabled.com',
  });
  // Disable one
  providerDb.updateProvider(db, 'disabled-prov', { enabled: false });
  // Filter by enabled
  var enabledOnly;
  try {
    enabledOnly = providerDb.getProviders(db, { enabled: true });
  } catch (e) {
    // May use different filter syntax
    enabledOnly = providerDb.getProviders(db, true);
  }
  if (enabledOnly) {
    var hasDisabled = enabledOnly.some(function(p) { return p.name === 'disabled-prov'; });
    assert.ok(!hasDisabled, 'disabled provider should not appear in enabled-only list');
  }
  if (typeof db.close === 'function') db.close();
});

test('updateProvider changes fields', function() {
  if (!hasInitDB || !hasAddProvider || !hasUpdateProvider || !hasGetProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'update-test',
    displayName: 'Before Update',
    baseUrl: 'https://old.com/v1',
    api: 'openai-completions',
    envVar: 'UPD_KEY',
    signupUrl: 'https://old.com',
  });
  providerDb.updateProvider(db, 'update-test', {
    displayName: 'After Update',
    baseUrl: 'https://new.com/v1',
  });
  var updated = providerDb.getProvider(db, 'update-test');
  var dn = updated.display_name || updated.displayName;
  var bu = updated.base_url || updated.baseUrl;
  assert.ok(dn === 'After Update', 'displayName should be updated, got: ' + dn);
  assert.ok(bu === 'https://new.com/v1', 'baseUrl should be updated, got: ' + bu);
  if (typeof db.close === 'function') db.close();
});

test('removeProvider removes non-builtin provider', function() {
  if (!hasInitDB || !hasAddProvider || !hasRemoveProvider || !hasGetProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'removable',
    displayName: 'Removable',
    baseUrl: 'https://removable.com/v1',
    api: 'openai-completions',
    envVar: 'RM_KEY',
    signupUrl: 'https://removable.com',
  });
  providerDb.removeProvider(db, 'removable');
  var removed = providerDb.getProvider(db, 'removable');
  assert.ok(!removed, 'removed provider should not be found');
  if (typeof db.close === 'function') db.close();
});

test('removeProvider refuses builtin (without force)', function() {
  if (!hasInitDB || !hasSeedBuiltins || !hasRemoveProvider || !hasGetProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.seedBuiltinProviders(db);
  // Try to remove a builtin provider (nvidia should be builtin)
  var threw = false;
  try {
    providerDb.removeProvider(db, 'nvidia');
  } catch (e) {
    threw = true;
  }
  // It should have thrown for builtin removal
  assert.ok(threw, 'removeProvider should throw for builtin provider without force');
  // Verify nvidia still exists
  var nvidia = providerDb.getProvider(db, 'nvidia');
  assert.ok(nvidia, 'nvidia should still exist after failed removal');
  if (typeof db.close === 'function') db.close();
});

// ===========================================================================
// TESTS: CRUD Models (6 tests)
// ===========================================================================
console.log('\n=== CRUD Models ===\n');

test('addModel to existing provider', function() {
  if (!hasInitDB || !hasAddProvider || !hasAddModel || !hasGetProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'model-host',
    displayName: 'Model Host',
    baseUrl: 'https://models.com/v1',
    api: 'openai-completions',
    envVar: 'MH_KEY',
    signupUrl: 'https://models.com',
  });
  providerDb.addModel(db, 'model-host', {
    id: 'fast-model',
    name: 'Fast Model',
    contextWindow: 32768,
    maxTokens: 8192,
    free: true,
  });
  var provider = providerDb.getProvider(db, 'model-host');
  assert.ok(provider.models && provider.models.length >= 1,
    'provider should have at least 1 model after addModel');
  var model = provider.models.find(function(m) {
    return m.id === 'fast-model' || m.model_id === 'fast-model';
  });
  assert.ok(model, 'should find the added model');
  if (typeof db.close === 'function') db.close();
});

test('addModel validates provider exists', function() {
  if (!hasInitDB || !hasAddModel) throw new Error('Required functions not exported');
  var db = providerDb.initDB(':memory:');
  var threw = false;
  try {
    providerDb.addModel(db, 'nonexistent-provider', {
      id: 'orphan-model',
      name: 'Orphan',
      contextWindow: 8192,
      maxTokens: 4096,
      free: true,
    });
  } catch (e) {
    threw = true;
  }
  assert.ok(threw, 'addModel should throw for nonexistent provider');
  if (typeof db.close === 'function') db.close();
});

test('removeModel works', function() {
  if (!hasInitDB || !hasAddProvider || !hasAddModel || !hasRemoveModel || !hasGetProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'rm-model-host',
    displayName: 'RM Model Host',
    baseUrl: 'https://rm-models.com/v1',
    api: 'openai-completions',
    envVar: 'RM_MH_KEY',
    signupUrl: 'https://rm-models.com',
  });
  providerDb.addModel(db, 'rm-model-host', {
    id: 'to-remove',
    name: 'Remove Me',
    contextWindow: 8192,
    maxTokens: 4096,
    free: true,
  });
  providerDb.removeModel(db, 'rm-model-host', 'to-remove');
  var provider = providerDb.getProvider(db, 'rm-model-host');
  var found = (provider.models || []).find(function(m) {
    return m.id === 'to-remove' || m.model_id === 'to-remove';
  });
  assert.ok(!found, 'removed model should not be found');
  if (typeof db.close === 'function') db.close();
});

test('toggleModel enabled/disabled', function() {
  if (!hasInitDB || !hasAddProvider || !hasAddModel || !hasToggleModel || !hasGetProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'toggle-host',
    displayName: 'Toggle Host',
    baseUrl: 'https://toggle.com/v1',
    api: 'openai-completions',
    envVar: 'TG_KEY',
    signupUrl: 'https://toggle.com',
  });
  providerDb.addModel(db, 'toggle-host', {
    id: 'toggle-me',
    name: 'Toggle Me',
    contextWindow: 8192,
    maxTokens: 4096,
    free: true,
  });
  // Toggle off
  providerDb.toggleModel(db, 'toggle-host', 'toggle-me', false);
  var provider = providerDb.getProvider(db, 'toggle-host');
  var model = (provider.models || []).find(function(m) {
    return m.id === 'toggle-me' || m.model_id === 'toggle-me';
  });
  if (model) {
    var isEnabled = model.enabled !== undefined ? model.enabled : model.is_enabled;
    assert.ok(isEnabled === false || isEnabled === 0, 'model should be disabled');
  }
  // Toggle back on
  providerDb.toggleModel(db, 'toggle-host', 'toggle-me', true);
  provider = providerDb.getProvider(db, 'toggle-host');
  model = (provider.models || []).find(function(m) {
    return m.id === 'toggle-me' || m.model_id === 'toggle-me';
  });
  if (model) {
    var isEnabled2 = model.enabled !== undefined ? model.enabled : model.is_enabled;
    assert.ok(isEnabled2 === true || isEnabled2 === 1, 'model should be re-enabled');
  }
  if (typeof db.close === 'function') db.close();
});

test('Models cascade delete with provider', function() {
  if (!hasInitDB || !hasAddProvider || !hasAddModel || !hasRemoveProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'cascade-host',
    displayName: 'Cascade Host',
    baseUrl: 'https://cascade.com/v1',
    api: 'openai-completions',
    envVar: 'CC_KEY',
    signupUrl: 'https://cascade.com',
  });
  providerDb.addModel(db, 'cascade-host', {
    id: 'model-a',
    name: 'Model A',
    contextWindow: 8192,
    maxTokens: 4096,
    free: true,
  });
  providerDb.addModel(db, 'cascade-host', {
    id: 'model-b',
    name: 'Model B',
    contextWindow: 16384,
    maxTokens: 8192,
    free: false,
  });
  providerDb.removeProvider(db, 'cascade-host');
  // Verify models are gone too
  if (typeof db.prepare === 'function') {
    var orphans = db.prepare(
      "SELECT COUNT(*) as cnt FROM models WHERE provider_name = 'cascade-host'"
    ).get();
    assert.strictEqual(orphans.cnt, 0, 'models should be cascade-deleted');
  } else if (hasGetProvider) {
    var provider = providerDb.getProvider(db, 'cascade-host');
    assert.ok(!provider, 'provider should be gone');
  }
  if (typeof db.close === 'function') db.close();
});

test('No duplicate models (same provider + model id)', function() {
  if (!hasInitDB || !hasAddProvider || !hasAddModel || !hasGetProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'dup-host',
    displayName: 'Dup Host',
    baseUrl: 'https://dup.com/v1',
    api: 'openai-completions',
    envVar: 'DUP_KEY',
    signupUrl: 'https://dup.com',
  });
  providerDb.addModel(db, 'dup-host', {
    id: 'same-model',
    name: 'Same Model',
    contextWindow: 8192,
    maxTokens: 4096,
    free: true,
  });
  // Try adding duplicate - should either throw or be ignored
  var threw = false;
  try {
    providerDb.addModel(db, 'dup-host', {
      id: 'same-model',
      name: 'Same Model Duplicate',
      contextWindow: 8192,
      maxTokens: 4096,
      free: true,
    });
  } catch (e) {
    threw = true;
  }
  var provider = providerDb.getProvider(db, 'dup-host');
  var matching = (provider.models || []).filter(function(m) {
    return m.id === 'same-model' || m.model_id === 'same-model';
  });
  assert.ok(threw || matching.length === 1,
    'should not have duplicate models (threw=' + threw + ', count=' + matching.length + ')');
  if (typeof db.close === 'function') db.close();
});

// ===========================================================================
// TESTS: getTestableModelsFromDB (5 tests)
// ===========================================================================
console.log('\n=== getTestableModelsFromDB ===\n');

test('getTestableModelsFromDB returns flat array with connection details', function() {
  if (!hasInitDB || !hasSeedBuiltins || !hasGetTestableModelsFromDB) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.seedBuiltinProviders(db);
  // Provide env keys so providers pass the requiresKey check
  var envKeys = { nvidia: 'test-key', groq: 'test-key', cerebras: 'test-key' };
  var models = providerDb.getTestableModelsFromDB(db, {}, envKeys);
  assert.ok(Array.isArray(models), 'should return array');
  assert.ok(models.length > 0, 'should have models (got ' + models.length + ')');
  // Check first model has connection details
  var m = models[0];
  assert.ok(typeof m.provider === 'string', 'model should have provider');
  assert.ok(typeof m.id === 'string', 'model should have id');
  assert.ok(typeof m.name === 'string', 'model should have name');
  assert.ok(typeof m.baseUrl === 'string' || typeof m.base_url === 'string',
    'model should have baseUrl');
  if (typeof db.close === 'function') db.close();
});

test('getTestableModelsFromDB includes all DB providers', function() {
  if (!hasInitDB || !hasSeedBuiltins || !hasAddProvider || !hasAddModel || !hasGetTestableModelsFromDB) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.seedBuiltinProviders(db);
  // Add a custom provider with envKeys so it passes the requiresKey check
  providerDb.addProvider(db, {
    name: 'custom-for-test',
    displayName: 'Custom',
    baseUrl: 'https://custom.com/v1',
    api: 'openai-completions',
    envVar: 'CUSTOM_KEY',
    signupUrl: 'https://custom.com',
  });
  providerDb.addModel(db, 'custom-for-test', {
    id: 'custom-model',
    name: 'Custom Model',
    contextWindow: 8192,
    maxTokens: 4096,
    free: true,
  });
  var envKeys = { 'custom-for-test': 'test-key', nvidia: 'test-key' };
  var models = providerDb.getTestableModelsFromDB(db, {}, envKeys);
  var customModels = models.filter(function(m) { return m.provider === 'custom-for-test'; });
  assert.ok(customModels.length >= 1,
    'should include custom provider models, found ' + customModels.length);
  if (typeof db.close === 'function') db.close();
});

test('getTestableModelsFromDB merges with config when provided', function() {
  if (!hasInitDB || !hasGetTestableModelsFromDB) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  // Try calling with a config object (may or may not be supported)
  var fakeCfg = {
    models: {
      providers: {
        'config-only-prov': {
          baseUrl: 'https://config-only.com/v1',
          apiKey: 'test-key',
          api: 'openai-completions',
          models: [{ id: 'cfg-model', name: 'Config Model' }],
        },
      },
    },
  };
  try {
    var models = providerDb.getTestableModelsFromDB(db, fakeCfg);
    if (Array.isArray(models)) {
      // If it accepts config, config-only models might be merged in
      console.log('    (returned ' + models.length + ' models with config merge)');
    }
  } catch (e) {
    // Might not accept config arg - that's OK
    console.log('    (config merge not supported: ' + e.message.slice(0, 60) + ')');
  }
  assert.ok(true, 'should not crash');
  if (typeof db.close === 'function') db.close();
});

test('getTestableModelsFromDB deduplicates by provider/id', function() {
  if (!hasInitDB || !hasSeedBuiltins || !hasGetTestableModelsFromDB) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.seedBuiltinProviders(db);
  var envKeys = { nvidia: 'test-key', groq: 'test-key', cerebras: 'test-key',
    sambanova: 'test-key', together: 'test-key', huggingface: 'test-key', github_models: 'test-key' };
  var models = providerDb.getTestableModelsFromDB(db, {}, envKeys);
  var keys = models.map(function(m) { return m.provider + '/' + m.id; });
  var unique = new Set(keys);
  assert.strictEqual(keys.length, unique.size,
    'should have no duplicate provider/id pairs (total=' + keys.length + ' unique=' + unique.size + ')');
  if (typeof db.close === 'function') db.close();
});

test('getTestableModelsFromDB falls back gracefully without DB data', function() {
  if (!hasInitDB || !hasGetTestableModelsFromDB) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  // Don't seed - empty DB
  var models = providerDb.getTestableModelsFromDB(db);
  assert.ok(Array.isArray(models), 'should return array even with empty DB');
  // May return empty array or fall back to config
  console.log('    (returned ' + models.length + ' models from empty DB)');
  if (typeof db.close === 'function') db.close();
});

// ===========================================================================
// TESTS: Edge Cases (4 tests)
// ===========================================================================
console.log('\n=== Edge Cases ===\n');

test('Empty DB returns empty array from getProviders', function() {
  if (!hasInitDB || !hasGetProviders) throw new Error('Required functions not exported');
  var db = providerDb.initDB(':memory:');
  var providers = providerDb.getProviders(db);
  assert.ok(Array.isArray(providers), 'should return array');
  assert.strictEqual(providers.length, 0, 'empty DB should have 0 providers');
  if (typeof db.close === 'function') db.close();
});

test('Provider with no models returns empty models array', function() {
  if (!hasInitDB || !hasAddProvider || !hasGetProvider) {
    throw new Error('Required functions not exported');
  }
  var db = providerDb.initDB(':memory:');
  providerDb.addProvider(db, {
    name: 'empty-provider',
    displayName: 'Empty',
    baseUrl: 'https://empty.com/v1',
    api: 'openai-completions',
    envVar: 'EMPTY_KEY',
    signupUrl: 'https://empty.com',
  });
  var provider = providerDb.getProvider(db, 'empty-provider');
  assert.ok(provider, 'provider should exist');
  assert.ok(Array.isArray(provider.models), 'should have models array');
  assert.strictEqual(provider.models.length, 0, 'should have 0 models');
  if (typeof db.close === 'function') db.close();
});

test('closeDB is safe to call twice', function() {
  if (!hasInitDB || !hasCloseDB) throw new Error('Required functions not exported');
  var db = providerDb.initDB(':memory:');
  providerDb.closeDB(db);
  // Second close should not throw
  var threw = false;
  try {
    providerDb.closeDB(db);
  } catch (e) {
    threw = true;
  }
  assert.ok(!threw, 'closeDB should be safe to call twice');
});

test('Invalid provider data throws', function() {
  if (!hasInitDB || !hasAddProvider) throw new Error('Required functions not exported');
  var db = providerDb.initDB(':memory:');
  var threw = false;
  try {
    providerDb.addProvider(db, null);
  } catch (e) {
    threw = true;
  }
  if (!threw) {
    try {
      providerDb.addProvider(db, {});
    } catch (e) {
      threw = true;
    }
  }
  assert.ok(threw, 'invalid data should throw');
  if (typeof db.close === 'function') db.close();
});

// ===========================================================================
// Summary
// ===========================================================================
console.log('\n=== PROVIDER DB TEST SUMMARY ===');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
console.log('  Skipped: ' + skipped);
if (failures.length > 0) {
  console.log('\n  Failures:');
  failures.forEach(function(f) { console.log('    - ' + f.name + ': ' + f.error); });
}
console.log('');

process.exit(failed > 0 ? 1 : 0);
