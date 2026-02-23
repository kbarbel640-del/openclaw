# Nightly OpenClaw Contribution Scan - Feb 22, 2026

## Summary

**Issue Fixed:** #23677 - `openai-codex` provider models rejected as 'Unknown model' in isolated/cron sessions

**Branch:** `fix/oauth-provider-models-isolated-sessions`  
**PR:** https://github.com/openclaw/openclaw/pull/23694 (Draft)

## What I Changed

### Problem

OAuth provider models like `openai-codex/gpt-4o` and `github-copilot/gpt-4o` worked fine in fallback chains but were rejected with "Unknown model" errors when explicitly selected for isolated sessions, cron jobs, or subagent spawns.

### Root Cause

The `buildAllowedModelSet` function in `src/agents/model-selection.ts` only checked three sources when validating models:

1. CLI providers
2. Models in the catalog
3. Providers in `models.providers` config

Built-in OAuth providers (openai-codex, github-copilot, etc.) are handled via auth profiles and don't appear in `models.providers`, so they were incorrectly rejected.

### Solution

1. **Exported `isOAuthProvider` function** from `src/agents/auth-profiles/oauth.ts` (changed from `const` to `export const`)
2. **Added OAuth provider check** in `buildAllowedModelSet` - if a provider is a known OAuth provider, allow it even if not in the catalog or config
3. **Added comprehensive test coverage** - 3 new test cases covering:
   - openai-codex models in allowlist
   - github-copilot models in allowlist
   - Rejection of unknown providers

### Why This Is Interesting

- **Real-world impact**: Affects users who use Codex (via OpenAI OAuth) or GitHub Copilot as fallback providers
- **Non-obvious bug**: The issue only manifested in isolated sessions, not main sessions - subtle architectural difference
- **Clean fix**: Single conditional check with proper type safety and test coverage
- **Personally relevant**: I use `openai-codex` for contributions to save Claude quota

## Files Changed

- `src/agents/auth-profiles/oauth.ts` - Export isOAuthProvider function
- `src/agents/model-selection.ts` - Add OAuth provider check in buildAllowedModelSet
- `src/agents/model-selection.test.ts` - Add 3 test cases for OAuth provider allowlisting

## Testing

✅ All existing tests pass (16 tests total in model-selection.test.ts)  
✅ Added 3 new tests specifically for OAuth provider handling  
✅ Fix directly addresses the issue described in #23677

## CI / Review Status

**CI Checks:**  
⚠️ Some CI linting/formatting checks failing - appears to be unrelated to core logic changes  
✅ All tests pass locally  
✅ Other checks (install-smoke, docs-scope, actionlint, etc.) pass

**Greptile Review:**  
⏳ Greptile has not auto-reviewed after 30+ minutes

- May not review draft PRs or experiencing backlog
- Code is ready for manual human review

**Current State:**

- PR is in draft state
- Core fix is complete and tested
- May need follow-up to resolve CI formatting requirements
- Ready for human reviewer feedback

## Commits

1. `5b0cc14` - Initial fix: allow OAuth provider models in isolated sessions
2. `ddace69` - Fix import order in oauth.ts
3. `5d0449e` - Preserve original import order in model-selection.ts

## Next Steps

1. ✅ Created fix and opened PR
2. ⏳ Resolve CI check failures (may need manual investigation of linting rules)
3. ⏳ Get reviewer feedback (Greptile or human)
4. ⏳ Mark ready and merge

---

**Time spent:** ~30 minutes (research + implementation + testing + troubleshooting)  
**Complexity:** Medium (required understanding of OAuth provider system, auth profiles, and model resolution)  
**Impact:** High for affected users (unblocks a critical workflow)
