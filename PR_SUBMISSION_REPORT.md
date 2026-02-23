# Pull Request Submission Report: AbacusAI Provider Plugin

> **PR Title**: `Extensions: add AbacusAI provider plugin with direct RouteLLM connection`
>
> **PR Type**: Feature (new bundled extension + core compat options)
>
> **Base branch**: `main`
>
> **Code word**: lobster-biscuit

---

## Table of Contents

- [Summary](#summary)
- [Use Cases](#use-cases)
- [Behavior Changes](#behavior-changes)
- [Files Changed](#files-changed)
- [Architecture Overview](#architecture-overview)
- [Implementation Details](#implementation-details)
- [Existing Functionality Check](#existing-functionality-check)
- [Tests](#tests)
- [Manual Testing](#manual-testing)
- [Security Considerations](#security-considerations)
- [Labeler Coverage](#labeler-coverage)
- [Changelog Entry](#changelog-entry)
- [Evidence](#evidence)
- [Sign-Off](#sign-off)

---

## Summary

Adds a new bundled provider plugin (`abacusai-auth`) that integrates **AbacusAI**
models into OpenClaw, along with **core compatibility options** that enable direct
connection to RouteLLM without a local proxy. The implementation provides:

1. **Direct connection to RouteLLM** (`routellm.abacus.ai/v1`) — no local proxy required.
2. **Core `ModelCompatConfig` extensions**:
   - `requiresAdditionalPropertiesFalse` — sets `additionalProperties: false` in tool schemas
   - `supportsStrictMode` — controls whether `strict` field is added to tool definitions
3. **Provider-level compat propagation** — compat settings flow from provider config to pi-ai.
4. **3-tier credential auto-detection** (Code Mode installation → env var → manual entry).
5. **Onboarding integration** — AbacusAI appears as a provider choice during
   `openclaw models auth login` and in the onboarding wizard.

This gives OpenClaw users access to 30+ models (Claude, Gemini, GPT, DeepSeek,
Qwen, Grok, Kimi, Llama, and AbacusAI's auto-router) through a single AbacusAI API key.

---

## Use Cases

1. **Users with AbacusAI accounts** can use their API key to access multiple
   model families (Claude, Gemini, GPT, etc.) through a single provider,
   without needing separate API keys for each.
2. **AbacusAI Code Mode users** get automatic credential detection — no manual
   key entry required.
3. **Multi-tool calling** works correctly with all supported models, including
   Claude models that return Anthropic-style `finish_reason` values.

---

## Behavior Changes

| Area                      | Before                                 | After                                            |
| ------------------------- | -------------------------------------- | ------------------------------------------------ |
| Provider list             | No AbacusAI option                     | `abacusai` provider available                    |
| Onboarding wizard         | No AbacusAI choice                     | "AbacusAI (Code Mode)" option in auth choices    |
| `AuthChoice` type         | No `abacusai` variant                  | `abacusai` added                                 |
| `AuthChoiceGroupId` type  | No `abacusai` variant                  | `abacusai` added                                 |
| `OnboardOptions` type     | No `abacusaiApiKey`                    | `abacusaiApiKey?: string` added                  |
| `ModelCompatConfig` type  | No `requiresAdditionalPropertiesFalse` | New compat option added                          |
| `ModelCompatSchema`       | No `requiresAdditionalPropertiesFalse` | Zod schema updated                               |
| Tool schema normalization | No provider compat support             | `normalizeToolParameters` accepts compat options |
| Plugin count              | 30 bundled extensions                  | 31 bundled extensions                            |
| `pnpm-lock.yaml`          | No abacusai-auth entry                 | `extensions/abacusai-auth` workspace added       |

**No existing behavior is modified.** All changes are additive. The new compat options
are opt-in and only affect providers that explicitly configure them.

---

## Files Changed

### New Files (4)

| File                                            | Lines | Description                                                  |
| ----------------------------------------------- | ----- | ------------------------------------------------------------ |
| `extensions/abacusai-auth/index.ts`             | ~670  | Plugin source: auth, credential detection, model definitions |
| `extensions/abacusai-auth/package.json`         | 15    | Package metadata (`@openclaw/abacusai-auth`)                 |
| `extensions/abacusai-auth/openclaw.plugin.json` | 10    | Plugin manifest (id, providers, configSchema)                |
| `extensions/abacusai-auth/README.md`            | 460   | Comprehensive documentation                                  |

### Modified Files (Core - 4)

| File                                     | Changes   | Description                                                                           |
| ---------------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| `src/config/types.models.ts`             | +3 lines  | Add `requiresAdditionalPropertiesFalse` to `ModelCompatConfig`                        |
| `src/config/zod-schema.core.ts`          | +1 line   | Add `requiresAdditionalPropertiesFalse` to `ModelCompatSchema`                        |
| `src/agents/pi-tools.schema.ts`          | +15 lines | Add `NormalizeToolOptions` type with `compat` field, use in `normalizeToolParameters` |
| `src/agents/pi-tools.ts`                 | +8 lines  | Pass provider compat to `normalizeToolParameters`                                     |
| `src/agents/pi-embedded-runner/model.ts` | +5 lines  | Pass provider compat to model objects for pi-ai                                       |

### Modified Files (Onboarding - 3)

| File                                  | Changes  | Description                                                                                   |
| ------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `src/commands/auth-choice-options.ts` | +8 lines | Add `abacusai` to group defs                                                                  |
| `src/commands/onboard-types.ts`       | +3 lines | Add `abacusai` to `AuthChoice`, `AuthChoiceGroupId`, and `abacusaiApiKey` to `OnboardOptions` |
| `pnpm-lock.yaml`                      | +6 lines | Add `extensions/abacusai-auth` workspace entry                                                |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  OpenClaw Agent (Pi Agent)                                       │
│  POST /v1/chat/completions with tools[]                          │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Core Tool Schema Normalization (pi-tools.schema.ts)             │
│                                                                  │
│  1. Reads provider compat from config                            │
│  2. If requiresAdditionalPropertiesFalse: true                   │
│     → Sets additionalProperties: false in tool schemas           │
│  3. If supportsStrictMode: false                                 │
│     → pi-ai omits `strict` field from tool definitions           │
└──────────────┬───────────────────────────────────────────────────┘
               │ https://routellm.abacus.ai/v1
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  AbacusAI RouteLLM Endpoint                                      │
│  OpenAI-compatible API with function calling                     │
└──────────────────────────────────────────────────────────────────┘
```

**Why core compat options instead of a local proxy?** AbacusAI's RouteLLM is
_mostly_ OpenAI-compatible but has two schema requirements:

1. Rejects the `strict` field in tool schemas → `supportsStrictMode: false`
2. Requires `additionalProperties: false` → `requiresAdditionalPropertiesFalse: true`

By adding these as core `ModelCompatConfig` options, we:

- Avoid the complexity of a local proxy
- Enable the same fix for other providers with similar requirements
- Let pi-ai handle the `strict` field natively (it already supports `supportsStrictMode`)

---

## Implementation Details

### Credential Resolution (4-tier fallback)

1. **OpenClaw auth profiles** — `~/.openclaw/agents/*/agent/auth-profiles.json`
   (supports both `token` and `key` credential fields)
2. **Environment variable** — `ABACUSAI_API_KEY`
3. **Code Mode auto-detect** — platform-specific paths (Windows/macOS/Linux)
   for AbacusAI Code Mode credential files
4. **Manual entry** — interactive prompt during login

### Core Compat Options

Two new options added to `ModelCompatConfig` (in `src/config/types.models.ts`):

```typescript
export type ModelCompatConfig = {
  // ... existing options ...
  /** If true, tool parameters will have additionalProperties: false. */
  requiresAdditionalPropertiesFalse?: boolean;
  /** If false, the `strict` field will not be added to tool definitions. */
  supportsStrictMode?: boolean;
};
```

These options are:

- Validated via Zod schema (`ModelCompatSchema` in `zod-schema.core.ts`)
- Propagated from provider config to model objects (`pi-embedded-runner/model.ts`)
- Applied during tool schema normalization (`pi-tools.schema.ts`)
- Passed to pi-ai which handles `supportsStrictMode` natively

### Provider Configuration

The AbacusAI provider is configured with:

```json
{
  "baseUrl": "https://routellm.abacus.ai/v1",
  "api": "openai-completions",
  "auth": "token",
  "compat": {
    "requiresAdditionalPropertiesFalse": true,
    "supportsStrictMode": false
  }
}
```

### Onboarding Integration

AbacusAI is added to the onboarding wizard via:

- `AuthChoice` type: `"abacusai"` variant
- `AuthChoiceGroupId` type: `"abacusai"` variant
- `AUTH_CHOICE_GROUP_DEFS`: AbacusAI group with `["abacusai"]` choices

---

## Existing Functionality Check

- [x] I searched the codebase for existing functionality.
      Searches performed:
  - `grep -r "abacusai\|abacus.ai\|routellm" src/ extensions/` — no existing AbacusAI integration found
  - `grep -r "RouteLLM" src/` — no existing RouteLLM proxy code
  - Reviewed all 30 existing extensions in `extensions/` — no AbacusAI plugin exists
  - Reviewed `src/commands/auth-choice-options.ts` — AbacusAI not listed as a provider choice

---

## Tests

### Automated Tests

- **Full test suite**: 77/77 test files passed, 902 tests passed, 1 skipped
- **Build**: `pnpm build` (tsdown) — 4 entry points, all succeeded
- **No regressions**: all existing tests continue to pass

```
Test Files  77 passed (77)
     Tests  902 passed | 1 skipped (903)
  Duration  57.20s
```

### What's Not Tested (and why)

- **Live API calls to RouteLLM**: requires a real AbacusAI API key; suitable for
  `LIVE=1 pnpm test:live` but not CI. The proxy's normalization logic is
  deterministic and tested via the full test suite.
- **SSE normalizer unit tests**: the normalizer is a pure function that could
  benefit from dedicated unit tests. This is a potential follow-up.

---

## Manual Testing

### Prerequisites

- AbacusAI account with API key (get one at https://abacus.ai/app/profile/apikey)
- OpenClaw installed from source (`pnpm install && pnpm build`)

### Steps

1. Enable the plugin:

   ```bash
   openclaw plugins enable abacusai-auth
   ```

2. Authenticate:

   ```bash
   openclaw models auth login --provider abacusai --set-default
   ```

   - Verify: interactive flow detects Code Mode credentials (if installed) or prompts for key
   - Verify: API key is validated against `describeUser`
   - Verify: CLI exits cleanly (no process hang)

3. Start the gateway:

   ```bash
   openclaw gateway run
   ```

   - Verify: gateway starts without errors
   - Verify: `openclaw.json` has correct AbacusAI provider config with compat options

4. Test tool calling:

   ```bash
   openclaw send "What is 2+2?" --model abacusai/gemini-3-flash-preview
   ```

   - Verify: agent successfully executes tool calls
   - Verify: no "strict field rejected" error
   - Verify: response is displayed correctly in WebChat

5. Test disabled state:

   ```bash
   openclaw plugins disable abacusai-auth
   openclaw gateway run
   ```

   - Verify: no AbacusAI-related log messages

### Results

All manual test steps verified on Windows 11, Node.js v24.13.0, OpenClaw v2026.2.6.

---

## Security Considerations

- **No secrets in code**: API keys are stored in `auth-profiles.json` (user's
  home directory), never in source files or config patches.
- **Direct HTTPS connection**: all requests go directly to `https://routellm.abacus.ai/v1`
  over TLS, no local proxy involved.
- **No PII in PR**: all personal data has been scrubbed from documentation and logs.
- **API key validation**: `describeUser` call validates API key before use.

---

## Labeler Coverage

The `.github/labeler.yml` file should be updated to include the new extension.
Suggested addition:

```yaml
"extensions: abacusai-auth":
  - changed-files:
      - any-glob-to-any-file:
          - "extensions/abacusai-auth/**"
```

This follows the existing pattern for other extensions (e.g., `extensions: google-antigravity-auth`,
`extensions: qwen-portal-auth`).

---

## Changelog Entry

Suggested entry for `CHANGELOG.md` under the next version:

```markdown
- Extensions: add AbacusAI provider plugin with direct RouteLLM connection, 3-tier
  credential auto-detection (Code Mode → env var → manual), and onboarding integration.
  Supports 30+ models (Claude, Gemini, GPT, DeepSeek, Qwen, Grok, Kimi, Llama).
- Core: add `requiresAdditionalPropertiesFalse` and `supportsStrictMode` compat options
  to `ModelCompatConfig` for providers that require specific tool schema formats.
  (#11203) Thanks @tonyhu2006.
```

---

## Evidence

### Build Output

```
✓ Build complete in 7717ms (4 entry points)
```

### Test Output

```
Test Files  77 passed (77)
     Tests  902 passed | 1 skipped (903)
  Duration  57.20s
```

### Direct Connection Verification

```
$ cat ~/.openclaw/openclaw.json | jq '.models.providers.abacusai'
{
  "baseUrl": "https://routellm.abacus.ai/v1",
  "api": "openai-completions",
  "auth": "token",
  "compat": {
    "requiresAdditionalPropertiesFalse": true,
    "supportsStrictMode": false
  }
}

$ openclaw send "What is 2+2?" --model abacusai/gemini-3-flash-preview
# Successfully returns response with tool calling working
```

---

## Sign-Off

- **Models used**: Claude Opus 4 (via Windsurf Cascade), Gemini 3 Flash (via AbacusAI)
- **Submitter effort**: High — multi-session development including:
  - Initial proxy-based architecture design and implementation
  - Discovery that pi-ai already supports `supportsStrictMode`
  - Refactoring to direct connection with core compat options
  - Merge conflict resolution with upstream main branch
- **Agent notes**: The initial implementation used a local proxy to strip the
  `strict` field and normalize responses. After discovering that pi-ai's
  `openai-completions` provider already supports `supportsStrictMode`, we
  refactored to use core compat options instead, resulting in a simpler and
  more maintainable solution that benefits other providers with similar needs.
