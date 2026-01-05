# Web Search TTS Integration - AI Agent Kickoff

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🤖 AI AGENT INSTRUCTION                                                    ║
║                                                                              ║
║   Execute ALL 7 cards below in LINEAR order.                                ║
║   Update state.json after EACH card.                                         ║
║   Do NOT stop until all cards are "completed".                               ║
║                                                                              ║
║   START NOW. First action: Read state.json, find first pending card.         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

> **ENTRY POINT**: This is the ONLY file you need. Everything is linked from here.
> This file is SELF-CONTAINED. Do not ask for clarification - all info is here.

## Mission

Implement the Web Search TTS Integration feature by executing 7 Trello cards in linear order.
Track progress in `state.json`. Update after each step. Never skip cards.

**Feature:** Add "Озвучить" (Voice) button under `/web` command results that generates audio narration using MiniMax TTS 2.6.

## Protocol

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT EXECUTION LOOP                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. READ state.json → Find current card (status = "pending")            │
│  2. UPDATE state.json → Set card to "in_progress"                       │
│  3. READ card file → Execute all instructions                           │
│  4. VERIFY → Check all acceptance criteria                              │
│  5. UPDATE state.json → Set card to "completed" or "failed"             │
│  6. UPDATE progress.md → Render progress bar                            │
│  7. LOOP → Go to step 1 until all cards completed                       │
│                                                                         │
│  ON ERROR: Set card to "failed", add error message, STOP for help        │
│  ON COMPLETE: Set overall status to "COMPLETE", celebrate 🎉            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose | Agent Action |
|------|---------|--------------|
| [BOARD.md](./BOARD.md) | Card overview and pipeline | Read once at start |
| [state.json](./state.json) | Progress tracking | Read+write each card |
| [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) | State update patterns | Reference when needed |
| [01-tts-config.md](./01-tts-config.md) | First card | **Execute** |
| [02-tts-client.md](./02-tts-client.md) | Second card | **Execute** |
| [03-tts-provider.md](./03-tts-provider.md) | Third card | **Execute** |
| [04-tts-button.md](./04-tts-button.md) | Fourth card | **Execute** |
| [05-tts-callback.md](./05-tts-callback.md) | Fifth card | **Execute** |
| [06-websearch-integration.md](./06-websearch-integration.md) | Sixth card | **Execute** |
| [07-e2e-tests.md](./07-e2e-tests.md) | Last card | **Execute** |

## Getting Started

```bash
cd docs/sdd/web-search-tts/trello-cards
ls -la
```

**First action:** Read [BOARD.md](./BOARD.md) to understand card sequence.

**Second action:** Read [state.json](./state.json) to find current card.

**Then:** Execute cards in order: 01 → 02 → 03 → 04 → 05 → 06 → 07

## Completion Criteria

- [ ] All cards in state.json show "completed"
- [ ] No errors in execution log
- [ ] Manual E2E test passes (see card 07)
- [ ] TTS button appears under `/web` results
- [ ] Audio generation works via MiniMax API
- [ ] Cache hit detection works

## Success Definition

This implementation is **SUCCESSFUL** when:

1. ✅ All 7 cards completed
2. ✅ `/web` command shows "🔊 Озвучить" button
3. ✅ Clicking button generates progress (0% → 100%)
4. ✅ Audio file sent to chat on completion
5. ✅ Button removed after audio sent
6. ✅ Error handling works with user-friendly messages
7. ✅ Manual E2E test passes
8. ✅ Code compiles and lint checks pass

---

**NOW BEGIN.** First card: [01-tts-config.md](./01-tts-config.md)
