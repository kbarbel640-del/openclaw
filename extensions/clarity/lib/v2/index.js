/**
 * Clarity Plugin v2 — Main Export
 *
 * Imports and exports all v2 modules for entity/relationship tracking.
 *
 * Usage:
 *   const v2 = require('./lib/v2');
 *   const tracker = new v2.V2ContextTracker({ kv, namespace: 'clarity' });
 *
 *   // v2 API
 *   const result = tracker.extractItemsV2(text);
 *   const entities = tracker.getEntities();
 *   const context = tracker.formatClarityContext();
 *
 *   // Backward compatible API (same as v1 ContextTracker)
 *   const items = tracker.extractItems(text);
 *   tracker.trackMentions(text);
 *   const scored = tracker.getScoredItems();
 */

"use strict";

// Core integration layer
const {
  V2ContextTracker,
  EntityExtractor,
  EntityScorer,
  Entity,
  Relationship,
  ExtractionResult,
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  THRESHOLDS,
  ANCHOR_BONUS,
  DEFAULT_WEIGHTS,
  CLARITY_STOP_WORDS,
} = require("./integration");

// Context Quality module
const ContextQuality = require("./context-quality");

// Version info
const VERSION = {
  major: 2,
  minor: 0,
  patch: 0,
  toString() {
    return `${this.major}.${this.minor}.${this.patch}`;
  },
};

// Convenience factory function
function createTracker(options = {}) {
  return new V2ContextTracker(options);
}

// Module exports
module.exports = {
  // Version
  VERSION,

  // Main classes
  V2ContextTracker,
  EntityExtractor,
  EntityScorer,
  Entity,
  Relationship,
  ExtractionResult,

  // Context Quality
  ContextQuality,

  // Factory
  createTracker,

  // Constants
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  THRESHOLDS,
  ANCHOR_BONUS,
  DEFAULT_WEIGHTS,
  CLARITY_STOP_WORDS,

  // Default export
  default: V2ContextTracker,
};
