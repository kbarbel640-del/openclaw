# Task: Add Gemini 3.1 Pro support to OpenClaw

## Context

Google released Gemini 3.1 Pro (model ID: `gemini-3.1-pro-preview`) on 2026-02-20.
OpenClaw's changelog for v2026.2.21 says "add Gemini 3.1 support" but the actual model catalog code was NOT updated.
The Gemini CLI (`google-gemini-cli` provider) can already call this model directly, but OpenClaw's model catalog doesn't include it, so `openclaw models list` doesn't show it.

## Goal

Add `gemini-3.1-pro-preview` to OpenClaw's model catalog so it appears in `openclaw models list` with proper metadata and auth, just like `gemini-3-pro-preview` does today.

## Files to modify (based on analysis)

### 1. `src/config/defaults.ts` — Add alias

Current:

```ts
gemini: "google/gemini-3-pro-preview",
"gemini-flash": "google/gemini-3-flash-preview",
```

Add: `"gemini-3.1": "google/gemini-3.1-pro-preview"` (keep existing aliases)

### 2. `src/agents/models-config.providers.ts` — Add normalize rule

Current `normalizeGoogleModelId()`:

```ts
if (id === "gemini-3-pro") return "gemini-3-pro-preview";
if (id === "gemini-3-flash") return "gemini-3-flash-preview";
```

Add: `if (id === "gemini-3.1-pro") return "gemini-3.1-pro-preview";`

### 3. `src/commands/google-gemini-model-default.ts` — Keep as-is (don't change default)

The default model should stay as `gemini-3-pro-preview` for now. No change needed.

### 4. Any model catalog/registry where google models are listed

Search for where `gemini-3-pro-preview` model entry is defined with metadata (contextWindow, input types, etc.) and add a parallel entry for `gemini-3.1-pro-preview`.

Gemini 3.1 Pro specs:

- id: "gemini-3.1-pro-preview"
- name: "Gemini 3.1 Pro"
- reasoning: true
- input: ["text", "image"]
- contextWindow: 1048576 (1M tokens)
- maxTokens: 65536

### 5. Tests — Add/update test coverage

- Update `src/config/model-alias-defaults.test.ts` to include the new alias
- Update `src/agents/models-config.providers.ts` normalize tests if they exist
- Add test for `gemini-3.1-pro` -> `gemini-3.1-pro-preview` normalization
- Run existing tests to make sure nothing breaks

## Important

- Do NOT change any default model selections (keep gemini-3-pro-preview as default)
- Do NOT modify Venice models unless Venice also supports 3.1
- Follow the exact same pattern as existing gemini-3 entries
- Run `pnpm test` (or the appropriate vitest command) to verify tests pass
- TypeCheck with `pnpm typecheck` if available

## Test commands

```bash
# Unit tests
pnpm vitest run --config vitest.unit.config.ts

# Or specific test files
pnpm vitest run src/config/model-alias-defaults.test.ts
pnpm vitest run src/agents/models-config.providers.test.ts  # if exists
```
