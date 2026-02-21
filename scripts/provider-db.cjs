#!/usr/bin/env node
/**
 * provider-db.cjs - SQLite database layer for dynamic provider management.
 *
 * Provides CRUD operations for providers and models backed by SQLite (WAL mode).
 * Uses Node.js built-in node:sqlite (DatabaseSync) - no native addons needed.
 * Seeds builtin providers from provider-registry.cjs on first use.
 * Merges DB providers with config to produce testable model lists.
 *
 * Key functions:
 *  - initDB(dbPath)                    - Open/create database with schema
 *  - seedBuiltinProviders(db)          - Seed KNOWN_PROVIDERS (idempotent)
 *  - getProviders(db, opts)            - List providers with optional filters
 *  - getProvider(db, name)             - Single provider with models
 *  - addProvider(db, data)             - Add new provider + models
 *  - updateProvider(db, name, updates) - Update provider fields
 *  - removeProvider(db, name, force)   - Remove (builtin requires force)
 *  - addModel(db, providerName, data)  - Add model to provider
 *  - removeModel(db, providerName, id) - Remove model
 *  - toggleProvider(db, name, enabled) - Enable/disable provider
 *  - toggleModel(db, prov, id, on)     - Enable/disable model
 *  - getTestableModelsFromDB(db, cfg, envKeys) - Flat deduped list for benchmarks
 *  - closeDB(db)                       - Safe close
 */
"use strict";

var path = require("path");
var fs = require("fs");

var DEFAULT_DB_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || "/home/node",
  ".openclaw",
  "providers.db"
);

// Lazy-loaded to avoid circular dependency with provider-registry.cjs
var _registry = null;
function getRegistry() {
  if (!_registry) _registry = require("./provider-registry.cjs");
  return _registry;
}

// ---------------------------------------------------------------------------
// Database Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the provider database.
 * Creates tables if they don't exist. Uses node:sqlite DatabaseSync.
 * @param {string} [dbPath] - path to SQLite file (default: ~/.openclaw/providers.db)
 * @returns {Object} DatabaseSync instance
 */
function initDB(dbPath) {
  var sqlite = require("node:sqlite");
  var resolvedPath = dbPath || process.env.OPENCLAW_PROVIDERS_DB || DEFAULT_DB_PATH;

  // Ensure directory exists (skip for :memory:)
  if (resolvedPath !== ":memory:") {
    var dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  var db = new sqlite.DatabaseSync(resolvedPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(
    "CREATE TABLE IF NOT EXISTS providers (" +
    "  name TEXT PRIMARY KEY," +
    "  display_name TEXT NOT NULL," +
    "  base_url TEXT NOT NULL," +
    "  api TEXT NOT NULL DEFAULT 'openai-completions'," +
    "  auth_type TEXT NOT NULL DEFAULT 'bearer'," +
    "  requires_key INTEGER NOT NULL DEFAULT 1," +
    "  env_var TEXT," +
    "  rate_limit_rpm INTEGER DEFAULT 30," +
    "  rate_limit_tpm INTEGER DEFAULT 100000," +
    "  signup_url TEXT," +
    "  enabled INTEGER NOT NULL DEFAULT 1," +
    "  is_builtin INTEGER NOT NULL DEFAULT 0," +
    "  created_at TEXT DEFAULT (datetime('now'))," +
    "  updated_at TEXT DEFAULT (datetime('now'))" +
    ")"
  );

  db.exec(
    "CREATE TABLE IF NOT EXISTS models (" +
    "  id TEXT NOT NULL," +
    "  provider_name TEXT NOT NULL," +
    "  name TEXT NOT NULL," +
    "  free INTEGER NOT NULL DEFAULT 1," +
    "  context_window INTEGER DEFAULT 131072," +
    "  max_tokens INTEGER DEFAULT 8192," +
    "  reasoning INTEGER DEFAULT 0," +
    "  input TEXT DEFAULT '[\"text\"]'," +
    "  cost_input REAL DEFAULT 0," +
    "  cost_output REAL DEFAULT 0," +
    "  enabled INTEGER NOT NULL DEFAULT 1," +
    "  is_builtin INTEGER NOT NULL DEFAULT 0," +
    "  created_at TEXT DEFAULT (datetime('now'))," +
    "  updated_at TEXT DEFAULT (datetime('now'))," +
    "  PRIMARY KEY (id, provider_name)," +
    "  FOREIGN KEY (provider_name) REFERENCES providers(name) ON DELETE CASCADE" +
    ")"
  );

  return db;
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/**
 * Seed builtin providers from KNOWN_PROVIDERS. Idempotent (INSERT OR IGNORE).
 * Wraps all inserts in a single transaction for performance.
 * @param {Object} db - DatabaseSync instance
 */
function seedBuiltinProviders(db) {
  var known = getRegistry().KNOWN_PROVIDERS;

  var insertProvider = db.prepare(
    "INSERT OR IGNORE INTO providers " +
    "(name, display_name, base_url, api, auth_type, requires_key, env_var, " +
    "rate_limit_rpm, rate_limit_tpm, signup_url, is_builtin) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)"
  );

  var insertModel = db.prepare(
    "INSERT OR IGNORE INTO models " +
    "(id, provider_name, name, free, context_window, max_tokens, reasoning, " +
    "input, cost_input, cost_output, is_builtin) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)"
  );

  db.exec("BEGIN");
  try {
    for (var i = 0; i < known.length; i++) {
      var p = known[i];
      insertProvider.run(
        p.name,
        p.displayName,
        p.baseUrl,
        p.api,
        p.authType,
        p.requiresKey ? 1 : 0,
        p.envVar || null,
        (p.rateLimit && p.rateLimit.requestsPerMinute) || 30,
        (p.rateLimit && p.rateLimit.tokensPerMinute) || 100000,
        p.signupUrl || null
      );
      for (var j = 0; j < p.models.length; j++) {
        var m = p.models[j];
        insertModel.run(
          m.id,
          p.name,
          m.name,
          m.free ? 1 : 0,
          m.contextWindow || 131072,
          m.maxTokens || 8192,
          m.reasoning ? 1 : 0,
          JSON.stringify(m.input || ["text"])
        );
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map a raw provider row to the JS object shape.
 * @param {Object} r - raw row from providers table
 * @returns {Object}
 */
function mapProviderRow(r) {
  return {
    name: r.name,
    displayName: r.display_name,
    baseUrl: r.base_url,
    api: r.api,
    authType: r.auth_type,
    requiresKey: r.requires_key === 1,
    envVar: r.env_var,
    rateLimit: {
      requestsPerMinute: r.rate_limit_rpm,
      tokensPerMinute: r.rate_limit_tpm,
    },
    signupUrl: r.signup_url,
    enabled: r.enabled === 1,
    isBuiltin: r.is_builtin === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Map a raw model row to the JS object shape.
 * @param {Object} m - raw row from models table
 * @returns {Object}
 */
function mapModelRow(m) {
  var inputArr;
  try { inputArr = JSON.parse(m.input); } catch (_) { inputArr = ["text"]; }
  return {
    id: m.id,
    name: m.name,
    free: m.free === 1,
    contextWindow: m.context_window,
    maxTokens: m.max_tokens,
    reasoning: m.reasoning === 1,
    input: inputArr,
    cost: { input: m.cost_input, output: m.cost_output },
    enabled: m.enabled === 1,
    isBuiltin: m.is_builtin === 1,
  };
}

// ---------------------------------------------------------------------------
// Provider CRUD
// ---------------------------------------------------------------------------

/**
 * List providers, optionally filtered.
 * @param {Object} db
 * @param {Object} [opts] - { enabled: true|false, builtin: true|false }
 * @returns {Array<Object>}
 */
function getProviders(db, opts) {
  var where = [];

  if (opts) {
    if (opts.enabled === true) {
      where.push("enabled = 1");
    } else if (opts.enabled === false) {
      where.push("enabled = 0");
    }
    if (opts.builtin === true) {
      where.push("is_builtin = 1");
    } else if (opts.builtin === false) {
      where.push("is_builtin = 0");
    }
  }

  var sql = "SELECT * FROM providers";
  if (where.length > 0) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY name";

  var rows = db.prepare(sql).all();
  return rows.map(mapProviderRow);
}

/**
 * Get a single provider with its models.
 * @param {Object} db
 * @param {string} name - provider name
 * @returns {Object|null}
 */
function getProvider(db, name) {
  var row = db.prepare("SELECT * FROM providers WHERE name = ?").get(name);
  if (!row) return null;

  var modelRows = db.prepare(
    "SELECT * FROM models WHERE provider_name = ? ORDER BY id"
  ).all(name);

  var result = mapProviderRow(row);
  result.models = modelRows.map(mapModelRow);
  return result;
}

/**
 * Add a new provider with optional models. Uses a transaction.
 * @param {Object} db
 * @param {Object} data - { name, displayName, baseUrl, api?, authType?, requiresKey?,
 *                          envVar?, rateLimit?, signupUrl?, models?[] }
 * @returns {Object} the created provider (with models)
 */
function addProvider(db, data) {
  if (!data || !data.name || !data.displayName || !data.baseUrl) {
    throw new Error("addProvider requires name, displayName, and baseUrl");
  }

  var existing = db.prepare("SELECT name FROM providers WHERE name = ?").get(data.name);
  if (existing) {
    throw new Error("Provider '" + data.name + "' already exists");
  }

  var insertProv = db.prepare(
    "INSERT INTO providers " +
    "(name, display_name, base_url, api, auth_type, requires_key, env_var, " +
    "rate_limit_rpm, rate_limit_tpm, signup_url, enabled, is_builtin) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)"
  );

  var insertModel = db.prepare(
    "INSERT INTO models " +
    "(id, provider_name, name, free, context_window, max_tokens, reasoning, " +
    "input, cost_input, cost_output, enabled, is_builtin) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)"
  );

  var rl = data.rateLimit || {};

  db.exec("BEGIN");
  try {
    insertProv.run(
      data.name,
      data.displayName,
      data.baseUrl,
      data.api || "openai-completions",
      data.authType || "bearer",
      data.requiresKey !== false ? 1 : 0,
      data.envVar || null,
      rl.requestsPerMinute || 30,
      rl.tokensPerMinute || 100000,
      data.signupUrl || null
    );

    var models = data.models || [];
    for (var i = 0; i < models.length; i++) {
      var m = models[i];
      if (!m.id || !m.name) continue;
      var cost = m.cost || {};
      insertModel.run(
        m.id,
        data.name,
        m.name,
        m.free !== false ? 1 : 0,
        m.contextWindow || 131072,
        m.maxTokens || 8192,
        m.reasoning ? 1 : 0,
        JSON.stringify(m.input || ["text"]),
        cost.input || 0,
        cost.output || 0
      );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return getProvider(db, data.name);
}

/**
 * Update provider fields. Only provided fields are updated.
 * @param {Object} db
 * @param {string} name - provider name
 * @param {Object} updates - { displayName?, baseUrl?, api?, authType?, requiresKey?,
 *                             envVar?, rateLimit?, signupUrl?, enabled? }
 * @returns {Object|null} updated provider or null if not found
 */
function updateProvider(db, name, updates) {
  var existing = db.prepare("SELECT name FROM providers WHERE name = ?").get(name);
  if (!existing) return null;

  var sets = [];
  var params = [];

  if (updates.displayName !== undefined) {
    sets.push("display_name = ?");
    params.push(updates.displayName);
  }
  if (updates.baseUrl !== undefined) {
    sets.push("base_url = ?");
    params.push(updates.baseUrl);
  }
  if (updates.api !== undefined) {
    sets.push("api = ?");
    params.push(updates.api);
  }
  if (updates.authType !== undefined) {
    sets.push("auth_type = ?");
    params.push(updates.authType);
  }
  if (updates.requiresKey !== undefined) {
    sets.push("requires_key = ?");
    params.push(updates.requiresKey ? 1 : 0);
  }
  if (updates.envVar !== undefined) {
    sets.push("env_var = ?");
    params.push(updates.envVar);
  }
  if (updates.rateLimit) {
    if (updates.rateLimit.requestsPerMinute !== undefined) {
      sets.push("rate_limit_rpm = ?");
      params.push(updates.rateLimit.requestsPerMinute);
    }
    if (updates.rateLimit.tokensPerMinute !== undefined) {
      sets.push("rate_limit_tpm = ?");
      params.push(updates.rateLimit.tokensPerMinute);
    }
  }
  if (updates.signupUrl !== undefined) {
    sets.push("signup_url = ?");
    params.push(updates.signupUrl);
  }
  if (updates.enabled !== undefined) {
    sets.push("enabled = ?");
    params.push(updates.enabled ? 1 : 0);
  }

  if (sets.length === 0) return getProvider(db, name);

  sets.push("updated_at = datetime('now')");
  params.push(name);

  var sql = "UPDATE providers SET " + sets.join(", ") + " WHERE name = ?";
  var stmt = db.prepare(sql);
  stmt.run.apply(stmt, params);

  return getProvider(db, name);
}

/**
 * Remove a provider and its models (CASCADE).
 * Builtin providers cannot be removed unless force=true.
 * @param {Object} db
 * @param {string} name
 * @param {boolean} [force=false] - allow removing builtins
 * @returns {boolean} true if removed
 */
function removeProvider(db, name, force) {
  var row = db.prepare("SELECT name, is_builtin FROM providers WHERE name = ?").get(name);
  if (!row) return false;

  if (row.is_builtin === 1 && !force) {
    throw new Error(
      "Cannot remove builtin provider '" + name + "'. Use force=true to override."
    );
  }

  // Manually delete models first since ON DELETE CASCADE requires foreign_keys pragma
  db.prepare("DELETE FROM models WHERE provider_name = ?").run(name);
  db.prepare("DELETE FROM providers WHERE name = ?").run(name);
  return true;
}

// ---------------------------------------------------------------------------
// Model CRUD
// ---------------------------------------------------------------------------

/**
 * Add a model to an existing provider.
 * @param {Object} db
 * @param {string} providerName
 * @param {Object} data - { id, name, free?, contextWindow?, maxTokens?, reasoning?,
 *                          input?, cost? }
 * @returns {Object} the provider with updated models
 */
function addModel(db, providerName, data) {
  if (!data || !data.id || !data.name) {
    throw new Error("addModel requires id and name");
  }

  var prov = db.prepare("SELECT name FROM providers WHERE name = ?").get(providerName);
  if (!prov) {
    throw new Error("Provider '" + providerName + "' not found");
  }

  var existingModel = db.prepare(
    "SELECT id FROM models WHERE id = ? AND provider_name = ?"
  ).get(data.id, providerName);
  if (existingModel) {
    throw new Error("Model '" + data.id + "' already exists for provider '" + providerName + "'");
  }

  var cost = data.cost || {};
  db.prepare(
    "INSERT INTO models " +
    "(id, provider_name, name, free, context_window, max_tokens, reasoning, " +
    "input, cost_input, cost_output, enabled, is_builtin) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)"
  ).run(
    data.id,
    providerName,
    data.name,
    data.free !== false ? 1 : 0,
    data.contextWindow || 131072,
    data.maxTokens || 8192,
    data.reasoning ? 1 : 0,
    JSON.stringify(data.input || ["text"]),
    cost.input || 0,
    cost.output || 0
  );

  return getProvider(db, providerName);
}

/**
 * Remove a model from a provider.
 * @param {Object} db
 * @param {string} providerName
 * @param {string} modelId
 * @returns {boolean} true if removed
 */
function removeModel(db, providerName, modelId) {
  var result = db.prepare(
    "DELETE FROM models WHERE id = ? AND provider_name = ?"
  ).run(modelId, providerName);
  return result.changes > 0;
}

/**
 * Enable or disable a provider.
 * @param {Object} db
 * @param {string} name
 * @param {boolean} enabled
 * @returns {Object|null} updated provider or null
 */
function toggleProvider(db, name, enabled) {
  var result = db.prepare(
    "UPDATE providers SET enabled = ?, updated_at = datetime('now') WHERE name = ?"
  ).run(enabled ? 1 : 0, name);
  if (result.changes === 0) return null;
  return getProvider(db, name);
}

/**
 * Enable or disable a model.
 * @param {Object} db
 * @param {string} providerName
 * @param {string} modelId
 * @param {boolean} enabled
 * @returns {boolean} true if updated
 */
function toggleModel(db, providerName, modelId, enabled) {
  var result = db.prepare(
    "UPDATE models SET enabled = ?, updated_at = datetime('now') " +
    "WHERE id = ? AND provider_name = ?"
  ).run(enabled ? 1 : 0, modelId, providerName);
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Testable Model List (DB-aware)
// ---------------------------------------------------------------------------

/**
 * Build flat testable model list from DB, merging with config (same dedup
 * logic as registry.getTestableModels but loads from DB first).
 *
 * Priority: config providers > DB providers (DB fills gaps, config wins on dupes).
 *
 * @param {Object} db
 * @param {Object} cfg - full openclaw.json config
 * @param {Object} [envKeys] - { providerName: apiKey } overrides
 * @returns {Array<Object>} flat model list with connection details
 */
function getTestableModelsFromDB(db, cfg, envKeys) {
  var dbProviders = getProviders(db, { enabled: true });
  var models = [];
  var seen = new Set();

  // Config providers take priority over DB
  var configProviders = (cfg && cfg.models && cfg.models.providers) || {};
  var configNames = Object.keys(configProviders);
  for (var i = 0; i < configNames.length; i++) {
    var provName = configNames[i];
    var prov = configProviders[provName];
    if (!prov.baseUrl) continue;

    var provModels = prov.models || [];
    for (var j = 0; j < provModels.length; j++) {
      var m = provModels[j];
      var key = provName + "/" + m.id;
      if (seen.has(key)) continue;
      seen.add(key);

      models.push({
        provider: provName,
        id: m.id,
        name: m.name || m.id,
        baseUrl: prov.baseUrl,
        apiKey: prov.apiKey || "",
        api: prov.api || "openai-completions",
        free: getRegistry().isModelFree(m),
        cost: m.cost || { input: 0, output: 0 },
        contextWindow: m.contextWindow || 0,
        maxTokens: m.maxTokens || 0,
        reasoning: m.reasoning || false,
      });
    }
  }

  // Add DB providers that are not already covered by config
  for (var k = 0; k < dbProviders.length; k++) {
    var dbProv = dbProviders[k];
    var apiKey = (envKeys && envKeys[dbProv.name]) || "";
    if (!apiKey && dbProv.envVar) {
      apiKey = process.env[dbProv.envVar] || "";
    }

    // Skip if no key available and key is required
    if (!apiKey && dbProv.requiresKey && dbProv.authType !== "none") continue;

    // Get enabled models for this provider
    var dbModels = db.prepare(
      "SELECT * FROM models WHERE provider_name = ? AND enabled = 1 ORDER BY id"
    ).all(dbProv.name);

    for (var l = 0; l < dbModels.length; l++) {
      var dm = dbModels[l];
      var dkey = dbProv.name + "/" + dm.id;
      if (seen.has(dkey)) continue;
      seen.add(dkey);

      models.push({
        provider: dbProv.name,
        id: dm.id,
        name: dm.name || dm.id,
        baseUrl: dbProv.baseUrl,
        apiKey: apiKey,
        api: dbProv.api || "openai-completions",
        free: dm.free === 1,
        cost: { input: dm.cost_input || 0, output: dm.cost_output || 0 },
        contextWindow: dm.context_window || 0,
        maxTokens: dm.max_tokens || 0,
        reasoning: dm.reasoning === 1,
      });
    }
  }

  return models;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Safely close the database connection.
 * @param {Object} db
 */
function closeDB(db) {
  if (!db) return;
  try {
    db.close();
  } catch (_) {
    // Already closed or invalid - ignore
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  DEFAULT_DB_PATH: DEFAULT_DB_PATH,
  initDB: initDB,
  seedBuiltinProviders: seedBuiltinProviders,
  getProviders: getProviders,
  getProvider: getProvider,
  addProvider: addProvider,
  updateProvider: updateProvider,
  removeProvider: removeProvider,
  addModel: addModel,
  removeModel: removeModel,
  toggleProvider: toggleProvider,
  toggleModel: toggleModel,
  getTestableModelsFromDB: getTestableModelsFromDB,
  closeDB: closeDB,
};
