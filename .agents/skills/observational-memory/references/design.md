# Observational Memory — Design Reference

## Why MEMORY.md?

OpenClaw auto-injects specific bootstrap files into context on every turn. The files
that get injected are:

- `MEMORY.md` (or `memory.md`)
- `SOUL.md`
- `AGENTS.md`

Daily log files (`memory/YYYY-MM-DD.md`) are **not** auto-injected — they require
explicit retrieval via `memory_search` or `memory_get` tools. This means any memory
system that writes to daily logs requires the agent to actively query memory.

By writing observations to the `## Observations` section of `MEMORY.md`, we get
the key property of Mastra's OM: **the agent never queries memory — it just sees
the observations in its context automatically**.

## Token Budget

```
MEMORY.md bootstrap cap:     20,000 chars (agents.defaults.bootstrapMaxChars)
Total bootstrap cap:         24,000 chars (agents.defaults.bootstrapTotalMaxChars)
Observation budget:         ~14,000 chars (leaves room for other MEMORY.md content)
Reflection threshold:        10,000 chars (when Reflector kicks in)
```

At ~4 chars per token, 14,000 chars ≈ 3,500 tokens of observation context. This is
comparable to what Mastra's OM injects at steady state.

## Differences from Mastra's OM

| Aspect            | Mastra OM                          | This Skill                                                       |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------- |
| Context injection | First block of context window      | Via MEMORY.md bootstrap injection                                |
| Observer trigger  | Token threshold on message history | memoryFlush soft threshold (pre-compaction)                      |
| Reflector trigger | Token threshold on observations    | Cron job (every 4 hours) + char threshold                        |
| Storage           | In-memory observation log          | MEMORY.md file on disk                                           |
| Prompt caching    | Observations are stable prefix     | MEMORY.md is part of system prompt (cache-stable)                |
| Agent interaction | Agent never touches memory         | Agent never touches observations                                 |
| Compaction        | Replaced by OM entirely            | OM runs before compaction; compaction still runs on raw messages |
| Scope             | Thread or resource                 | Thread (via session state)                                       |

## Key Tradeoffs

1. **Smaller observation budget**: Mastra OM can use 30-40k tokens for observations.
   We're limited to ~3.5k tokens by the bootstrap char cap. The Reflector must be
   more aggressive about condensing.

2. **Compaction still runs**: In Mastra, OM replaces compaction entirely. Here,
   compaction still runs on raw message history — but the important context has
   already been captured as observations in MEMORY.md, so compaction's lossiness
   matters less.

3. **File-based persistence**: Observations survive session restarts, gateway
   crashes, and daily resets because they live in MEMORY.md on disk. Mastra's OM
   keeps observations in-memory within the agent session.

4. **No async mode yet**: Mastra ships an async buffering mode where observation
   runs outside the conversation loop. This skill runs synchronously during the
   memoryFlush step (which is already silent).

## Tuning Tips

- **Increase `bootstrapMaxChars`** if you need more observation space and have a
  large context window model. Set in `agents.defaults.bootstrapMaxChars`.
- **Lower `softThresholdTokens`** to trigger observations more frequently (default
  6000 in our config, vs OpenClaw's default 4000).
- **Use a fast/cheap model** for Observer/Reflector. Gemini 2.5 Flash is the default
  because it's fast, cheap, and good at compression. GPT-4o-mini also works well.
- **Don't put too much in MEMORY.md** outside the observations section. Every char
  you use for manual memory is a char less for observations.
