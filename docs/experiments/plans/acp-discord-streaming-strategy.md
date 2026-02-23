---
summary: "Fix ACP Discord output fragmentation now, and define the long-term unified streaming architecture"
owner: "onutc"
status: "draft"
last_updated: "2026-02-23"
title: "ACP Discord Streaming Strategy"
---

# ACP Discord Streaming Strategy

## Problem statement

ACP thread sessions on Discord can produce fragmented output (small chunks, odd line breaks, spacing artifacts). This is most visible with Codex via acpx when output is streamed token by token.

Current root cause:

- ACP dispatch uses a dedicated projector path in core.
- Main and subagent streaming use the block reply coalescer pipeline.
- acpx emits token-sized `text` deltas, so ACP projector flush cadence can produce many tiny outbound chunks.

This document compares:

- Fix now: ACP-only production hardening with minimal blast radius
- Holy grail: one shared streaming pipeline across runtimes

## Fix now (recommended immediate path)

Goal:

- Keep ACP runtime and threading behavior as-is
- Make ACP output delivery behave like normal OpenClaw streamed replies on Discord

Scope:

- Touch ACP path only
- Reuse main/subagent streaming components directly
- Do not change main/subagent behavior

Plan:

1. Replace ACP projector buffering internals with the same block streaming components used in main/subagent flow:
   - `createBlockReplyCoalescer` via `createBlockReplyPipeline`
   - `resolveBlockStreamingChunking`
   - `resolveBlockStreamingCoalescing`
2. Keep ACP text ingestion separate only at runtime-event mapping level (`text_delta` intake), then hand off block shaping to the shared pipeline.
3. Preserve raw delta text from ACP (no trim/whitespace normalization in streaming path).
4. Reuse existing reply dispatcher and Discord delivery path exactly as today.
5. Keep ACP-specific config compatible, but make shared block-streaming config the primary behavior source for ACP block buffering.

Expected result:

- Fewer, larger, readable Discord messages
- No glued words
- No per-token message spam
- No behavior change for non-ACP sessions

Pros:

- Low risk
- Fast to ship
- Directly fixes current user-visible issue

Cons:

- Still leaves separate ACP ingress/dispatch branch in core
- Some future divergence risk remains

## Holy grail (long-term architecture)

Goal:

- One streaming pipeline for all runtimes (`main`, `subagent`, `acp`)
- Runtime-specific logic only in event adapters, not in delivery behavior

Architecture:

1. Define one canonical runtime event model in core (`text_delta`, `tool`, `status`, `done`, `error`).
2. Make each runtime adapter emit only canonical events.
3. Feed canonical events into one shared pipeline:
   - delta assembly
   - coalescing
   - channel chunking/formatting
   - serialized outbound delivery
4. Persist delivery checkpoints for crash-safe replay and idempotent resend.

Expected result:

- Same streaming semantics across runtimes
- One place to fix formatting/coalescing bugs
- Stronger crash recovery and duplicate suppression

Pros:

- Most elegant and maintainable
- Lowest long-term operational risk
- Consistent behavior across all channels and runtimes

Cons:

- Larger refactor
- Requires touching shared pipeline boundaries
- Higher short-term integration and test cost

## Side-by-side comparison

| Dimension                                       | Fix now (ACP-only) | Holy grail (unified pipeline) |
| ----------------------------------------------- | ------------------ | ----------------------------- |
| Blast radius                                    | Low                | Medium to high                |
| Time to ship                                    | Short              | Long                          |
| User-facing ACP fix                             | Immediate          | Included                      |
| Risk of regressions                             | Low                | Medium                        |
| Long-term maintenance                           | Medium             | Low                           |
| Architecture elegance                           | Medium             | High                          |
| Reuses main/subagent block streaming components | Yes                | Yes                           |
| Changes main/subagent behavior                  | No                 | Potentially during migration  |

## Recommended sequence

1. Ship fix now for ACP output quality and stability.
2. Add regression tests that lock expected Discord output behavior for ACP.
3. Start holy-grail refactor behind internal boundaries, not big-bang.
4. Migrate incrementally, keeping existing behavior stable.

## Implementation checklist

Fix now checklist:

- ACP uses shared block streaming components (`BlockReplyPipeline`/`BlockReplyCoalescer`) for block text delivery
- ACP spacing preserved end to end
- Discord thread replies are readable and not token-fragmented
- No duplicate outputs in parent plus thread
- ACP dispatch tests and Discord delivery tests pass

Holy grail checklist:

- Canonical runtime event contract finalized
- ACP adapter migrated to canonical events
- Main/subagent ingress migrated to same pipeline
- Shared coalescer/chunker used for all runtimes
- Crash recovery + idempotent replay validated in e2e
