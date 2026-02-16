# Helios Upstream Merge Plan

## Merge Strategy

**Method**: `git merge origin/main` (not rebase)
**Reason**: 63 commits ahead - rebase would be too complex and error-prone

## Upstream Analysis (2,889 commits behind)

### Categories of Upstream Changes:

- **Bug fixes**: ~40 critical fixes including cron skipping, security permissions, rate limiting
- **Features**: ~12 new features including QR flow restoration, proxy improvements
- **Test cleanup**: ~2,800+ test deduplication and optimization commits
- **Refactoring**: Core improvements to config handling, telegram, infra
- **Security**: Session transcript permissions, fetch wrapper hardening

### Notable Upstream Fixes We Want:

1. **Cron daily job skipping fix** (#17852) - Critical for automation
2. **Rate-limit auto-recovery** (#17478, #18045) - Improves reliability
3. **Config.patch array destruction prevention** (#18030) - Prevents data loss
4. **TTS duplicate delivery prevention** (#18046) - Reduces noise
5. **Security permissions on session transcripts** (#18066) - Important security fix

## Expected Merge Conflicts

### High-Probability Conflicts:

#### 1. **package.json**

- **Our changes**: Version "2026.2.15", dependency additions for cortex
- **Upstream changes**: Version updates, new dependencies
- **Resolution**: Take upstream version number, merge our cortex dependencies
- **Manual action required**: Yes

#### 2. **src/agents/model-fallback.ts**

- **Our changes**: Anthropic OAuth profile support
- **Upstream changes**: Rate-limit auto-recovery improvements
- **Resolution**: Keep our OAuth additions, integrate their rate-limit fixes
- **Manual action required**: Yes

#### 3. **src/agents/tools/sessions-spawn-tool.ts**

- **Our changes**: SYNAPSE v2 integration, subagent spawning
- **Upstream changes**: Core spawning improvements
- **Resolution**: Carefully merge both sets of changes
- **Manual action required**: Yes

#### 4. **pnpm-lock.yaml**

- **Our changes**: Cortex Python bridge dependencies
- **Upstream changes**: Upstream dependency updates
- **Resolution**: Delete file, run `pnpm install` to regenerate
- **Manual action required**: Automated via pnpm

### Medium-Probability Conflicts:

#### 5. **src/agents/cli-backends.ts**

- **Our changes**: LBF enterprise backend additions
- **Upstream changes**: Core backend improvements
- **Resolution**: Merge both changes carefully

#### 6. **src/agents/tools/message-tool.ts**

- **Our changes**: SYNAPSE integration
- **Upstream changes**: Core messaging improvements
- **Resolution**: Preserve SYNAPSE, integrate upstream fixes

#### 7. **src/infra/outbound/message-action-runner.ts**

- **Our changes**: Enhanced delivery for cortex
- **Upstream changes**: Core delivery improvements
- **Resolution**: Merge delivery enhancements

### Low-Risk Areas (Our Extensions):

- `extensions/cortex/` - Entirely new, no conflicts expected
- `extensions/conversation-summarizer/` - New extension
- `extensions/self-reflection/` - New extension
- `.ai.docs/` - Our documentation system
- `apps/macos/*/AnthropicOAuth.swift` - New OAuth system

## Conflict Resolution Strategy

### For Core Modified Files:

1. **Keep OUR version** for files we heavily modified:
   - Cortex-related changes
   - SYNAPSE v2 integration
   - LBF enterprise tools
   - Anthropic OAuth profiles

2. **Take UPSTREAM version then re-apply our changes** for files they heavily modified:
   - Core infrastructure (if conflicts are minimal)
   - Security-related changes (always take upstream security fixes)
   - Critical bug fixes (cron, rate-limiting, config handling)

3. **Manual merge** for complex conflicts:
   - package.json (merge dependencies)
   - model-fallback.ts (merge OAuth + rate-limiting)
   - sessions-spawn-tool.ts (merge SYNAPSE + spawning)

## Pre-Merge Preparation

### Fetch Latest Upstream:

```bash
git fetch origin
git log --oneline HEAD..origin/main | wc -l  # Verify count
```

### Backup Current State:

✅ Done - `pre-upstream-sync-2026.2.16` tag created and pushed

## Merge Execution Plan

### Step 1: Start Merge

```bash
git merge origin/main
```

### Step 2: Handle Conflicts Systematically

#### package.json Resolution:

```bash
# Manual edit to:
# 1. Take upstream version number
# 2. Keep our cortex dependencies
# 3. Merge any new upstream dependencies
git add package.json
```

#### pnpm-lock.yaml Resolution:

```bash
# Delete and regenerate
rm pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
```

#### Code Conflicts (model-fallback.ts, sessions-spawn-tool.ts, etc.):

```bash
# For each conflict:
# 1. Open in editor
# 2. Keep our core additions (OAuth, SYNAPSE, LBF)
# 3. Integrate their bug fixes and improvements
# 4. Test functionality still works
git add <resolved-file>
```

### Step 3: Complete Merge

```bash
git commit  # Complete merge commit
```

### Step 4: Post-Merge Validation

Run our custom feature tests:

```bash
cd extensions/cortex/python
python3 test_brain.py
python3 test_brain_api.py
python3 test_mcp_integration.py
```

## Version Strategy

### During Merge:

- **package.json version**: Take upstream version (likely 2026.2.16 or similar)
- **Note**: We'll change to semver AFTER successful merge

### Post-Merge Versioning:

1. **Apply upstream fixes**: Bump to v1.0.40 (40 fixes)
2. **Apply upstream features**: Bump to v1.12.40 (12 features + 40 fixes)
3. **Tag final result**: `v1.12.40`

## Fallback Plans

### If Conflicts Too Complex:

1. **Abort merge**: `git merge --abort`
2. **Selective upstream integration**:
   ```bash
   # Cherry-pick critical fixes individually
   git cherry-pick <upstream-commit>  # For each critical fix
   ```
3. **Document skipped changes** in `SKIPPED_UPSTREAM.md`

### If Custom Features Break:

1. **Isolate the issue**:
   ```bash
   # Test each system individually
   cd extensions/cortex/python && python3 verify_cortex.py
   ```
2. **Recover from backup**:
   ```bash
   git checkout pre-upstream-sync-2026.2.16 -- extensions/cortex/
   ```

## Success Criteria

- [ ] Merge completes without data loss
- [ ] All 63 custom commits preserved in history
- [ ] Cortex memory system functional
- [ ] SYNAPSE v2 communication works
- [ ] LBF enterprise tools accessible
- [ ] Anthropic OAuth profiles load
- [ ] Brain.db operations succeed
- [ ] Extensions load without errors
- [ ] Core OpenClaw functionality intact
- [ ] Critical upstream fixes integrated (cron, rate-limit, security)

## Quality Gates

### Before Declaring Success:

1. **Automated tests pass**: `npm test` (if available)
2. **Custom system validation**: All cortex tests pass
3. **Integration testing**: SYNAPSE responds, LBF tools work
4. **No regressions**: Core functionality works as before
5. **Security validation**: Upstream security fixes active

### Files to Review Carefully:

- Any file with merge conflicts
- package.json (dependencies)
- extensions/cortex/cortex-bridge.ts (bridge integrity)
- src/agents/tools/ (tool functionality)
- apps/macos/ (OAuth integration)

This merge plan balances preserving our 63 commits of custom work while gaining ~40 critical upstream fixes and ~12 new features, setting us up for the final v1.12.40 release.
