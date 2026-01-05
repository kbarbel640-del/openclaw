# Web Search TTS Integration - Trello Board

> Scrum Master: AI Agent | Sprint: Linear Execution
> Story Point Cap: 4 SP per card | Principle: KISS

## Execution Order

```
┌────────────────────────────────────────────────────────┐
│                     EXECUTION PIPELINE                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│  SPRINT 1: Foundation                                  │
│  ┌─────┐   ┌─────┐                                   │
│  │ 01  │ → │ 02  │                                   │
│  │ 2SP │   │ 3SP │                                   │
│  └─────┘   └─────┘                                   │
│  Config    TTS Client                                 │
│                                                        │
│  SPRINT 2: Integration                                 │
│  ┌─────┐   ┌─────┐   ┌─────┐                         │
│  │ 03  │ → │ 04  │ → │ 05  │                         │
│  │ 2SP │   │ 2SP │   │ 2SP │                         │
│  └─────┘   └─────┘   └─────┘                         │
│  Provider  Button    Callback                          │
│                                                        │
│  SPRINT 3: Web Search Hook                             │
│  ┌─────┐   ┌─────┐                                   │
│  │ 06  │ → │ 07  │                                   │
│  │ 2SP │   │ 2SP │                                   │
│  └─────┘   └─────┘                                   │
│  WebHook   Tests                                      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Card Index

| Card | Title | SP | Depends On | Status |
|------|-------|----|-----------:|--------|
| [01](./01-tts-config.md) | Add TTS Configuration | 2 | - | TODO |
| [02](./02-tts-client.md) | MiniMax TTS Client | 3 | 01 | TODO |
| [03](./03-tts-provider.md) | TTS Provider with Cache | 2 | 02 | TODO |
| [04](./04-tts-button.md) | TTS Button Factory | 2 | 03 | TODO |
| [05](./05-tts-callback.md) | TTS Callback Handler | 2 | 04 | TODO |
| [06](./06-websearch-integration.md) | Web Search Integration | 2 | 05 | TODO |
| [07](./07-e2e-tests.md) | E2E Tests & Polish | 2 | 06 | TODO |

## Sprint Summary

**Sprint 1: Foundation** (5 SP)
- Card 01: Add TTS config schema to `src/config/config.ts`
- Card 02: Create MiniMax TTS client in `src/tts/client.ts`

**Sprint 2: Integration** (6 SP)
- Card 03: Create TTS provider with caching in `src/tts/provider.ts`
- Card 04: Create button factory in `src/tts/button.ts`
- Card 05: Add callback handler to `src/telegram/bot.ts`

**Sprint 3: Web Search Hook** (4 SP)
- Card 06: Integrate button into web search results
- Card 07: Manual E2E testing and polish

**Total Story Points: 15**
