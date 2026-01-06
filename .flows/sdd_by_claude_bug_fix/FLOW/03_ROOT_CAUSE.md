# Phase 3: Root Cause Analysis

Goal: Identify exact cause of bug through systematic investigation.

## The Investigation Protocol

```
┌─────────────────────────────────────────────────────────┐
│  ROOT CAUSE ANALYSIS                                    │
│                                                         │
│  Do NOT guess. Do NOT assume.                           │
│  Every conclusion MUST have evidence.                   │
│                                                         │
│  Confidence ≥90% required to proceed.                   │
└─────────────────────────────────────────────────────────┘
```

## Step 1: Initial Diagnostic Checklist

Before deep investigation, rule out common causes:

```bash
# Check recent changes
git log -n 5 --oneline

# Check environment
cat .env | grep -v "KEY\|SECRET\|PASSWORD"

# Check disk space
df -h

# Check memory
free -m

# Check running processes
ps aux | head -10

# Check dependencies
pnpm outdated 2>/dev/null || npm outdated
```

### Common Quick Fixes

| Symptom | Check | Fix |
|---------|-------|-----|
| "Module not found" | `pnpm install` | Reinstall deps |
| "Permission denied" | `ls -la` | Fix permissions |
| "Connection refused" | `netstat -tlnp` | Start service |
| "Out of memory" | `free -m` | Increase limit |

## Step 2: Layer-by-Layer Investigation

Investigate systematically from outside to inside:

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: ENTRY POINT (API/UI)                           │
├─────────────────────────────────────────────────────────┤
│ Questions:                                              │
│ - Is input valid?                                       │
│ - Is correct handler triggered?                         │
│ - Are parameters passed correctly?                      │
│                                                         │
│ Tools: Network tab, request logs, input validation     │
├─────────────────────────────────────────────────────────┤
│ LAYER 2: SERVICE/BUSINESS LOGIC                         │
├─────────────────────────────────────────────────────────┤
│ Questions:                                              │
│ - Is the logic correct?                                 │
│ - Are edge cases handled?                               │
│ - Are dependencies available?                           │
│                                                         │
│ Tools: Debug logs, unit tests, code review             │
├─────────────────────────────────────────────────────────┤
│ LAYER 3: DATA/INFRASTRUCTURE                            │
├─────────────────────────────────────────────────────────┤
│ Questions:                                              │
│ - Is data in expected format?                           │
│ - Are queries correct?                                  │
│ - Are external services responding?                     │
│                                                         │
│ Tools: DB queries, API tests, connection checks        │
└─────────────────────────────────────────────────────────┘
```

### For Each Layer

1. **Hypothesize**: What could be wrong?
2. **Test**: How to verify?
3. **Evidence**: What did you find?
4. **Conclusion**: Ruled out / Confirmed

## Step 3: Log Trail Triangulation

Find the exact failure point in logs:

```bash
# Find relevant logs
grep -r "{error_pattern}" logs/

# Get context around error
grep -B 10 -A 5 "{error_pattern}" logs/app.log

# Build timeline
grep "{timestamp_prefix}" logs/app.log | head -20
```

### Timeline Template

| Time | Component | Event | Status |
|------|-----------|-------|--------|
| 10:00:01 | API | Request received | OK |
| 10:00:01 | Auth | Token validated | OK |
| 10:00:02 | Service | Processing started | OK |
| 10:00:02 | DB | Query executed | **FAIL** ← |
| 10:00:02 | Service | Error caught | - |
| 10:00:02 | API | Error response | - |

**Breakpoint identified:** Between DB and Service layers.

## Step 4: Code Analysis

Once layer is identified, analyze the specific code:

```bash
# Find the file
grep -r "functionName" src/ --include="*.ts"

# Read around the suspected line
cat -n src/path/to/file.ts | sed -n '40,60p'

# Check git blame
git blame src/path/to/file.ts -L 45,55
```

### Code Smell Detection

While analyzing, look for:

| Smell | Indicator | Bug Connection |
|-------|-----------|----------------|
| Null check missing | No `if (x)` before `x.prop` | NullPointerException |
| Off-by-one | `< length` vs `<= length` | Array out of bounds |
| Race condition | Async without await | Inconsistent state |
| Uncaught exception | No try/catch | Crash |
| Type coercion | `==` instead of `===` | Wrong comparison |

## Step 5: Document Root Cause

Create detailed root cause documentation:

```markdown
## Root Cause

### Summary
The bug occurs because {specific reason}.

### Location
- File: `src/services/user.ts`
- Line: 42
- Function: `getUserById()`

### Technical Details
The function assumes `user` is always defined, but when
the user ID doesn't exist in the database, `user` is `null`.
Accessing `user.name` then throws a TypeError.

### Evidence
1. Stack trace points to line 42
2. Database query returns null for non-existent ID
3. No null check before property access
4. Confirmed by adding console.log before the line
```

## Step 6: Confidence Assessment

| Factor | Weight | Score |
|--------|--------|-------|
| Stack trace matches | 30% | {score} |
| Code confirms theory | 30% | {score} |
| Can explain all symptoms | 20% | {score} |
| Reproduction aligns | 20% | {score} |
| **Total Confidence** | | **{total}%** |

### Confidence Thresholds

| Confidence | Action |
|------------|--------|
| ≥90% | Proceed to fix |
| 80-89% | Gather more evidence |
| 70-79% | Review with team |
| <70% | Need deeper investigation |

## Output

Create `root-cause-analysis.md` with:
- Investigation timeline
- Layer analysis results
- Root cause summary
- Location (file:line)
- Evidence collected
- Confidence assessment

Template: `TEMPLATES/root-cause-analysis.template.md`

## Completion Gate

Only proceed to Phase 4 when:
- [ ] Root cause identified
- [ ] Location documented (file:line:function)
- [ ] Evidence collected
- [ ] Confidence ≥90%

## Critical Rule

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  DO NOT PROCEED TO FIX WITHOUT ROOT CAUSE!             │
│                                                         │
│  Blind fixes:                                           │
│  - Often don't work                                     │
│  - May introduce new bugs                               │
│  - Waste time                                           │
│  - Cannot be verified                                   │
│                                                         │
│  Know the cause → Know the fix                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
