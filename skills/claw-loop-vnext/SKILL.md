---
name: claw-loop-vnext
description: "Iterative goal completion with phase review and SDK-first delivery ACK + tmux fallback."
---

# Claw-Loop vNext

Preserves the original contract:

1. Propose phases
2. User reviews/edits phases
3. After approval, execute goal
4. Track until complete/blocked

## Commands

```bash
skills/claw-loop-vnext/claw-loop.sh start --goal ~/clawd/goals/goal-feature.json
skills/claw-loop-vnext/claw-loop.sh check
skills/claw-loop-vnext/claw-loop.sh status --goal ~/clawd/goals/goal-feature.json
skills/claw-loop-vnext/claw-loop.sh prompt --goal ~/clawd/goals/goal-feature.json
skills/claw-loop-vnext/claw-loop.sh direct --goal ~/clawd/goals/goal-feature.json --msg "Focus on tests"
skills/claw-loop-vnext/claw-loop.sh approve --goal ~/clawd/goals/goal-feature.json
```

## Goal Schema Compatibility

Canonical per-phase state is `status`.
Compatibility field `passes` is still accepted and auto-derived.

- Read: accepts either `status` or `passes`
- Write: emits both (`status` source of truth)

## Runtime Files

For goal `goal-xyz.json` in `~/clawd/goals`:

- Event log: `~/clawd/goals/.runtime/goal-xyz.events.jsonl`
- Runtime state: `~/clawd/goals/.runtime/goal-xyz.state.json`
