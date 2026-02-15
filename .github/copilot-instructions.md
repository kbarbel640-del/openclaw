# Copilot Instructions — OpenClaw Fork (Jherrild/openclaw)

## What This Is

This is a personal fork of [openclaw/openclaw](https://github.com/openclaw/openclaw) — an open-source multi-channel AI gateway. We use it for developing features and improvements to contribute upstream or run locally.

## Active Work

Check `prd/` for active PRDs. Read the relevant PRD before starting any implementation work.

## Repo Architecture

```
src/
  agents/         Agent lifecycle, config resolution, tools, system prompt
    memory-search.ts   Memory provider config resolution
    tools/memory-tool.ts   memory_search + memory_get tool definitions
    system-prompt.ts       System prompt construction
  memory/         Memory indexing, search, embedding providers
    manager.ts           MemoryIndexManager (builtin provider)
    search-manager.ts    Factory: getMemorySearchManager() — creates providers
    types.ts             MemorySearchManager interface
    embeddings.ts        Embedding provider resolution (node-llama-cpp, OpenAI, Gemini, Voyage)
    hybrid.ts            Hybrid search merge algorithm
    obsidian-*.ts        Obsidian vault memory provider modules (custom addition)
  hooks/           Internal hook/event system
    internal-hooks.ts    triggerInternalHook, createInternalHookEvent
  config/          Config types and resolution
    types.tools.ts       MemorySearchConfig type definition
  auto-reply/      Message handling, commands, agent runner
```

**Key flow:**

```
openclaw.json → resolveMemorySearchConfig() → getMemorySearchManager() → provider instance
```

**Embedding:** `node-llama-cpp` ships with OpenClaw. Default model: `embeddinggemma-300m` GGUF (auto-downloaded). No Ollama dependency.

## Custom Modules We've Added

Files in `src/memory/obsidian-*.ts` are custom additions ported from the workspace's `local-rag` and `obsidian-scribe` skills. They are tested and working. Build on them — don't rebuild.

## Build & Test

```bash
pnpm install          # Install deps
pnpm build            # Rolldown + tsc (~800ms)
pnpm test -- --run    # Full suite (844 files, ~75s)
pnpm vitest run src/memory/obsidian-*.test.ts  # Our tests only (14 tests)
```

## Related: Magnus Workspace

The agent workspace at `~/.openclaw/workspace/` has its own `.github/copilot-instructions.md` with:

- Magnus's skill system (SKILL.md frontmatter, skill discovery)
- The copilot-daemon pipeline (automated issue → PRD → review → implement)
- Obsidian vault conventions (PARA structure, obsidian-scribe for writes, local-rag for search)
- Notification protocol (Telegram via Bot API)

Read it when your work needs to interact with skills or the agent's runtime environment.

## Conventions

- TypeScript strict mode
- Conventional commits: `feat(memory):`, `fix(memory):`, `test(memory):`
- Linter: `oxlint` (runs on commit via git hooks)
- Formatter: `oxfmt` (runs on commit)
- Add `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` to commits
- 1 pre-existing test failure in iMessage tests — ignore it

## Related Resources

- PRDs: `prd/` in this repo
- Obsidian project note: `/mnt/c/Users/Jherr/Documents/remote-personal/1-Projects/openclaw/Obsidian Memory Provider.md`
- Workspace skills: `~/.openclaw/workspace/skills/`
