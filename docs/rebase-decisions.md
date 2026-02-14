# Rebase Decisions Log

## 2026-02-13: `main` rebased onto `origin/main`

### Conflict: `.gitignore`

- Keep both sides:
- Preserve local `.idea` ignore.
- Preserve upstream/local Docker brew cache ignore `data/brew/`.

### Conflict: `package.json`

- Prefer upstream toolchain version bumps:
- Keep `@typescript/native-preview` at `7.0.0-dev.20260212.1`.
- Keep newer lint/build tool versions already in upstream line.
- Preserve local/runtime additions:
- Keep `pm2` and `@vitest/browser-playwright` in `devDependencies`.

### Conflict: `pnpm-lock.yaml`

- Apply union strategy where safe:
- Keep upstream lock updates tied to newer tool versions.
- Keep entries required by local additions (`pm2`, browser-playwright, and related packages).
- Remove all conflict markers and retain deterministic lock structure.

### Conflict: `src/agents/pi-tool-definition-adapter.ts`

- Keep upstream error-flow structure that continues to run `after_tool_call` hook on error.
- Keep local exec diagnostics:
- Preserve `formatExecFailureContext(params)` and append context to `[tools] exec failed` logs.

### Conflict: `src/gateway/server-methods/agent.ts`

- Keep both fields in payload setup:
- Preserve `inputProvenance` (upstream/current runtime behavior).
- Preserve `logUndeliveredOutput: false` (local behavior).

### Conflict: `src/telegram/send.ts`

- Merge both behaviors:
- Keep reaction success logging (`telegram/reactions` subsystem).
- Keep graceful handling for `REACTION_INVALID` with warning result.
- Keep no-op success behavior for missing target message (`message to react not found`).

### Conflict: `git-hooks/pre-commit` (modify/delete)

- Accept upstream delete.
- Reason: hook logic has moved to `.pre-commit-config.yaml` + `scripts/pre-commit/*`.

## Reuse Strategy For Future Rebase

- Prefer upstream for version/toolchain bumps unless local change is required for active runtime behavior.
- Prefer union merge for independent options/flags in config payloads.
- For delivery/reaction paths, preserve both observability (logging) and graceful degradation (non-fatal missing targets).
- For moved/deleted legacy hooks/scripts, follow upstream structure unless local replacement is missing.
