# Customizations

Local modifications to the OpenClaw codebase that diverge from upstream.

## Two-Layer Global Rules (Agent System Prompt)

Every agent receives shared rules that cannot be overridden by workspace files or agent configuration. Two layers exist, injected into the system prompt right after the Safety section and before all workspace/context files.

### Layer 1: Strict Rules (code-shipped, immutable)

- **Template**: `docs/reference/templates/STRICT_RULES.md`
- **Loaded by**: `loadStrictRules()` in `src/agents/global-rules.ts`
- **Behavior**: Read from the package's template directory at startup, cached in memory after first load. Content ships with the code — agents cannot modify the installation directory. Front matter is stripped before injection.
- **Prompt section**: `## Strict Rules`

Edit `docs/reference/templates/STRICT_RULES.md` to change these rules. Requires a rebuild/redeploy to take effect.

### Layer 2: Operator Rules (runtime, editable)

- **File**: `~/.openclaw/RULES.md` (state directory)
- **Loaded by**: `loadGlobalRules()` in `src/agents/global-rules.ts`
- **Behavior**: Read from the global state directory at each session startup. Not cached — changes take effect on the next session. Sandboxed agents cannot modify this file (it lives outside container mounts).
- **Auto-created**: On first workspace setup via `ensureGlobalRulesFile()`, called from `ensureAgentWorkspace()` in `src/agents/workspace.ts`. Uses `docs/reference/templates/RULES.md` as the template.
- **Prompt section**: `## Operator Rules`

Edit `~/.openclaw/RULES.md` to change these rules. No rebuild needed.

### Prompt injection order

```
...
4. ## Safety (hardcoded, upstream)
5. ## Strict Rules (from STRICT_RULES.md template)    <-- layer 1
6. ## Operator Rules (from ~/.openclaw/RULES.md)       <-- layer 2
7. ## OpenClaw CLI Quick Reference
...
24. # Project Context (SOUL.md, AGENTS.md, workspace files)
...
```

Both layers appear before workspace files, giving them higher authority. Neither is gated by `promptMode` — main agents and subagents both receive them.

### Files added/modified

| File | Change |
|------|--------|
| `docs/reference/templates/STRICT_RULES.md` | Added: strict rules template (ships with package) |
| `docs/reference/templates/RULES.md` | Added: operator rules template (seeds `~/.openclaw/RULES.md`) |
| `src/agents/global-rules.ts` | Added: `loadStrictRules()`, `loadGlobalRules()`, `ensureGlobalRulesFile()`, `resetStrictRulesCache()` |
| `src/agents/global-rules.test.ts` | Added: 9 tests for loading functions |
| `src/agents/system-prompt.ts` | Modified: added `strictRulesContent` + `globalRulesContent` params, injected after Safety section |
| `src/agents/system-prompt.test.ts` | Modified: added 6 tests for new sections |
| `src/agents/workspace.ts` | Modified: calls `ensureGlobalRulesFile()` during workspace setup |
| `src/agents/pi-embedded-runner/system-prompt.ts` | Modified: threads both params to `buildAgentSystemPrompt()` |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Modified: loads both rules in parallel with bootstrap files |
| `src/agents/pi-embedded-runner/compact.ts` | Modified: same |
| `src/agents/cli-runner.ts` | Modified: same |
| `src/agents/cli-runner/helpers.ts` | Modified: threads both params |
| `src/auto-reply/reply/commands-context-report.ts` | Modified: loads both rules for `/context` report |
