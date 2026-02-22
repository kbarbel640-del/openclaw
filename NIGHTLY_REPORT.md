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
- **Clean fix**: Single-line logic addition with proper type safety and test coverage
- **Personally relevant**: I use `openai-codex` for contributions to save Claude quota

## Files Changed

- `src/agents/auth-profiles/oauth.ts` - Export isOAuthProvider function
- `src/agents/model-selection.ts` - Add OAuth provider check in buildAllowedModelSet
- `src/agents/model-selection.test.ts` - Add 3 test cases for OAuth provider allowlisting

## Testing

✅ All existing tests pass (16 tests in model-selection.test.ts)  
✅ Added 3 new tests specifically for OAuth provider handling  
✅ Manually verified the fix addresses the issue described in #23677

## Greptile Review Status

⏳ **Waiting for Greptile review** (~4-5 min post-PR creation)

- PR created at 16:04 UTC
- Greptile typically auto-reviews within 3-4 minutes
- Will address any feedback and mark ready for human review

## Next Steps

1. ✅ Create fix and push branch
2. ✅ Open draft PR
3. ⏳ Wait for Greptile (@greptileai) review
4. ⏳ Address Greptile feedback if any
5. ⏳ Mark PR ready for human review
