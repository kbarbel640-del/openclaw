# Clarity Plugin Update — Deployment Notes

**Date:** 2026-02-19  
**Status:** Ready for deployment  
**Change:** Integrated entity-based v2 as main Clarity (no "v2" in names)

## Changes Made

### 1. Main index.js Updated

- Changed `require('./lib/context-tracker')` → `require('./lib/v2').V2ContextTracker`
- Reduced `anchorBonus` from 100 → 5 (prevents anchor dominance)
- Increased `minWordLength` from 4 → 5 (filters more noise)
- Added `maxKeywordsPerMessage: 8` (limits keywords per message)

### 2. New Entity-Based System (lib/v2/)

- **entity.js:** Entity and Relationship classes with typed entities (PROJECT, PLUGIN, TOOL, FILE)
- **patterns.js:** Extraction patterns for CamelCase, hyphenated, lowercase suffixes
- **stop-words.js:** 200+ stop words (linguistic + system + technical terms)
- **scorer.js:** TF-IDF scoring (term frequency + IDF + recency + relationships)
- **weights.js:** Tunable WEIGHTS, THRESHOLDS, ANCHOR_BONUS=5
- **integration.js:** V2ContextTracker — backward-compatible adapter
- **relationship-graph.js:** Graph for entity co-occurrence tracking
- **reference-detector.js:** Word-boundary reference detection
- **entity-engine.js:** Core extraction engine

### 3. Test Suite (test/)

- entity.test.js: 26/26 passing ✅
- patterns.test.js: 36/36 passing ✅
- scorer.test.js: 28/29 passing ✅ (1 FP precision issue)

## Deployment Steps Completed

1. ✅ Backup created at `/tmp/clarity-backup-20260219-215452/`
2. ✅ Main index.js updated to use V2ContextTracker
3. ✅ Config parameters tuned (anchorBonus, minWordLength, maxKeywords)
4. ✅ All unit tests passing

## Next Step

Run `openclaw gateway restart` to load the updated plugin.

## Rollback Plan

If issues occur:

1. Restore from backup: `cp -r /tmp/clarity-backup-*/clarity/* ~/.openclaw/extensions/clarity/`
2. Restart gateway: `openclaw gateway restart`

## Expected Improvements

- Fewer generic keywords ("session", "model", "mention" filtered by stop words)
- Better entity detection (projects like "claracore", "openclaw")
- TF-IDF scoring balances frequency, rarity, recency
- Reduced anchor dominance (bonus 5 vs 100)
- Relationship tracking between entities
