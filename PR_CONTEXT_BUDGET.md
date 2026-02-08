# PR: Opt-in agent contextBudget caps (chars)

## Summary

Add an **opt-in**, agent-level `agents.defaults.contextBudget` config block to cap the biggest context/token cost drivers:

- bootstrap file injection (`bootstrapMaxChars`)
- memory search snippet injection (`memoryMaxInjectedChars`)
- `web_fetch` output size (`webFetchMaxChars`)

Default behavior is unchanged unless `contextBudget.enabled=true`.

## Motivation

OpenClaw already has per-feature caps (`bootstrapMaxChars`, `memory.qmd.limits.maxInjectedChars`, `tools.web.fetch.maxChars`), but deployments often want a single, upstream-friendly switch to keep costs predictable without rewriting workflow/policy.

This adds a small, backwards-compatible "budget override" layer.

## Config

```jsonc
{
  "agents": {
    "defaults": {
      "contextBudget": {
        "enabled": true,
        "bootstrapMaxChars": 8000,
        "memoryMaxInjectedChars": 2500,
        "webFetchMaxChars": 8000,
      },
    },
  },
}
```

## Behavior

When enabled, the effective caps become:

- bootstrap: `min(agents.defaults.bootstrapMaxChars, contextBudget.bootstrapMaxChars)`
- memory_search (qmd backend): `min(memory.qmd.limits.maxInjectedChars, contextBudget.memoryMaxInjectedChars)`
- web_fetch: `min(tools.web.fetch.maxChars, contextBudget.webFetchMaxChars)`

If any `contextBudget.*` value is missing/invalid, it is ignored.

## Tests

- `src/agents/pi-embedded-helpers/bootstrap.context-budget.test.ts`
- `src/agents/tools/web-fetch.context-budget.test.ts`

Run (example):

```bash
pnpm vitest run --config vitest.unit.config.ts \
  src/agents/pi-embedded-helpers/bootstrap.context-budget.test.ts \
  src/agents/tools/web-fetch.context-budget.test.ts
```

## Notes / Future work

- Phase 2 can add optional summarization/trimming hooks when a cap is hit, plus `/context` reporting of effective budgets.
