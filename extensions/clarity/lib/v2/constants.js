/**
 * Constants for Clarity v2
 * Centralized to avoid circular dependencies
 */

"use strict";

// Entity types
const ENTITY_TYPES = {
  PROJECT: "project",
  PLUGIN: "plugin",
  TOOL: "tool",
  FILE: "file",
  PERSON: "person",
  TOPIC: "topic",
  DECISION: "decision",
};

// Relationship types
const RELATIONSHIP_TYPES = {
  CONTAINS: "contains",
  USES: "uses",
  RELATED: "related",
  DEPENDS_ON: "depends_on",
  IMPLEMENTS: "implements",
};

// Score thresholds
const THRESHOLDS = {
  display: 20,
  highRelevance: 40,
  mediumRelevance: 25,
  track: 10,
};

// Tunable weights
const DEFAULT_WEIGHTS = {
  tf: 15,
  idf: 25,
  recency: 30,
  relationship: 10,
};

const ANCHOR_BONUS = 5;

module.exports = {
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  THRESHOLDS,
  DEFAULT_WEIGHTS,
  ANCHOR_BONUS,
};
