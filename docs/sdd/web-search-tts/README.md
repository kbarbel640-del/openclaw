# Web Search TTS Integration - SDD Requirements

> Status: READY | All gaps filled

## Overview

This folder contains Spec-Driven Development (SDD) documentation for the **Web Search TTS Integration** feature.

Add a "Озвучить" (Voice) button under `/web` command results that generates audio narration of web search results using MiniMax TTS 2.6.

## Documents

| File | Description | Status |
|------|-------------|--------|
| [requirements.md](./requirements.md) | Functional requirements | READY |
| [ui-flow.md](./ui-flow.md) | User interaction flow | READY |
| [gaps.md](./gaps.md) | Open questions & decisions | FILLED |
| [manual-e2e-test.md](./manual-e2e-test.md) | End-to-end test checklist | READY |

## Pipeline Summary

```
User: /web <query>
  → Web Search Result Message
  → [🔊 Озвучить] button (NEW)
  → Click button → Progress updates on button
  → Audio file generated via MiniMax TTS 2.6
  → Audio sent to chat
  → Button removed
```

## Quick Reference

| Aspect | Decision |
|--------|----------|
| **Channel** | Telegram (`/web` command only) |
| **TTS Provider** | MiniMax TTS 2.6 (API) |
| **Voice** | `English_CalmWoman` |
| **Caching** | Yes, by result hash (7 day TTL) |
| **Progress** | Button text updates (0% → 100%) |
| **Config** | `~/.clawdis/clawdis.json` → `tts` section |

## Development Notes

- [ ] Follow existing patterns from `src/deep-research/button.ts` for inline buttons
- [ ] Reference implementation: `/home/almaz/sandboxes/005_epub` (Python - port to TypeScript)
- [ ] Location: New `src/tts/` module + changes to `src/telegram/bot.ts`
- [ ] Callback prefix: `tts:` (parallel to `dr:` for deep-research)

## Implementation

See [trello-cards/BOARD.md](./trello-cards/BOARD.md) for:
- 6 executable cards (13 SP total)
- Linear execution order
- Machine-friendly instructions
- Max 4 SP per card

## Complexity Assessment

| Factor | Points |
|--------|--------|
| External integration (MiniMax TTS) | +4 |
| New UI component (progress button) | +2 |
| Uses existing patterns | -1 |
| **Total** | **5** |

**Score → Cards**: 5 points → 6 cards (target: 10-20 SP range)
