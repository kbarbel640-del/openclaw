# Copilot Instructions — OpenClaw Fork (Jherrild/openclaw)

## What This Is

This is a fork of [openclaw/openclaw](https://github.com/openclaw/openclaw) — an open-source multi-channel AI gateway. We're adding a **native Obsidian vault memory provider** that replaces the built-in memory system with one that indexes an entire Obsidian vault.

## The Project

**PRD:** `prd/PRD-obsidian-memory-provider.md` — read this first. It's comprehensive.

**Goal:** Users set `memorySearch.provider: "obsidian"` with a `vaultPath`, and the agent automatically semantic-searches their entire knowledge base every turn.

## What Already Exists (We Built These)

All in `src/memory/`:

| File                      | Status  | Purpose                                                                           |
| ------------------------- | ------- | --------------------------------------------------------------------------------- |
| `obsidian-schema.ts`      | ✅ Done | SQLite schema: rich FTS5 with per-field weighting, embedding cache, PARA metadata |
| `obsidian-search.ts`      | ✅ Done | RRF fusion, entity shortcut, per-field BM25, hybrid search pipeline               |
| `obsidian-sync.ts`        | ✅ Done | Incremental vault indexing, PARA detection, paragraph-aware chunking with overlap |
| `obsidian-provider.ts`    | ✅ Done | `MemorySearchManager` implementation with background indexing + FTS5 fallback     |
| `obsidian-search.test.ts` | ✅ Done | 7 tests for RRF fusion                                                            |
| `obsidian-sync.test.ts`   | ✅ Done | 7 tests for chunking                                                              |

**Config changes already made:**

- `src/config/types.tools.ts` — added `"obsidian"` to provider type + `ObsidianMemoryConfig`
- `src/agents/memory-search.ts` — added `"obsidian"` to `ResolvedMemorySearchConfig`, passes through obsidian config

## What Remains

### 1. Wire Provider into Factory (Blocked Item)

`src/memory/search-manager.ts` → `getMemorySearchManager()` is the factory that creates memory managers. Currently it only knows about `builtin` and `qmd` backends. Need to add:

```typescript
// In getMemorySearchManager():
if (settings.provider === "obsidian" && settings.obsidian?.vaultPath) {
  // Create ObsidianMemoryProvider instead of MemoryIndexManager
  // Call initialize() (triggers background indexing)
  // Return it wrapped in the same interface
}
```

**Key files to understand:**

- `src/memory/search-manager.ts` — factory, fallback wrapper, cache
- `src/memory/manager.ts` — `MemoryIndexManager` (the builtin provider we're supplementing)
- `src/memory/types.ts` — `MemorySearchManager` interface (our provider implements this)
- `src/agents/memory-search.ts` — config resolution

### 2. Indexing Lifecycle Events

When indexing completes, fire a hook:

```typescript
triggerInternalHook(createInternalHookEvent("memory", "index-complete", sessionKey, { ... }))
```

See `src/hooks/internal-hooks.ts` for the hook system. Events are used by `src/agents/bootstrap-hooks.ts` and `src/auto-reply/reply/commands-core.ts`.

### 3. Dynamic Context Injection (Future)

Replace static MEMORY.md injection with per-turn vault search. This touches `src/agents/system-prompt.ts` and the bootstrap pipeline. See PRD §8 for full design.

## Architecture Quick Reference

```
openclaw.json config
  → src/agents/memory-search.ts (resolveMemorySearchConfig)
  → src/memory/search-manager.ts (getMemorySearchManager — THE FACTORY)
  → src/memory/manager.ts (MemoryIndexManager — builtin provider)
  → src/memory/obsidian-provider.ts (ObsidianMemoryProvider — our new provider)
```

**Embedding:** Uses `node-llama-cpp` via `src/memory/embeddings.ts`. Default model: `embeddinggemma-300m`. Our provider passes `"auto"` to the embedding resolver — no Ollama dependency.

**Search:** Our provider uses RRF (Reciprocal Rank Fusion) instead of the builtin's linear combination (0.7*vec + 0.3*text). Per-field FTS5 weighting. Entity shortcut for navigational queries.

**Tests:** `pnpm vitest run src/memory/obsidian-*.test.ts` — 14 tests, all pass.

**Build:** `pnpm build` — runs rolldown + tsc. ~800ms.

**Full test suite:** `pnpm test -- --run` — 844 files, ~75s. 1 pre-existing failure in iMessage tests (not ours).

## Related: Magnus Workspace

The agent workspace at `~/.openclaw/workspace/` has its own `.github/copilot-instructions.md` with:

- Magnus's skill system (how skills are discovered, SKILL.md frontmatter requirements)
- The copilot-daemon pipeline (automated issue → PRD → review → implement)
- Obsidian vault conventions (PARA structure, obsidian-scribe for writes, local-rag for search)
- Notification protocol (Telegram via Bot API, Magnus relay)

Read it when your work needs to interact with skills or the agent's runtime environment.

## Conventions

- TypeScript strict mode
- Conventional commits: `feat(memory):`, `fix(memory):`, `test(memory):`
- Linter: `oxlint` (runs on commit via git hooks)
- Formatter: `oxfmt` (runs on commit)
- Add `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` to commits

## Related Resources (in the workspace repo, not this fork)

- Obsidian scribe skill: `~/.openclaw/workspace/skills/obsidian-scribe/`
- local-rag skill: `~/.openclaw/workspace/skills/local-rag/`
- Obsidian project note: `/mnt/c/Users/Jherr/Documents/remote-personal/1-Projects/openclaw/Obsidian Memory Provider.md`
