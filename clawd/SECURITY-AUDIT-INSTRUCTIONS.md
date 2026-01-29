# APEX 6.2 Full Systems Audit Instructions

**Purpose:** Repeatable process for conducting comprehensive system audits.
**Created:** 2026-01-29
**Last Updated:** 2026-01-29

---

## Prerequisites

1. Read APEX 6.2 rules: `/home/liam/.cursor/rules/apex-v6.mdc`
2. Load bug-comorbidity skill: `/home/liam/clawd/apex-vault/apex/skills/bug-comorbidity/COMPACT.md`
3. Load security-guard skill: `/home/liam/clawd/apex-vault/apex/skills/security-guard/COMPACT.md`

---

## Audit Methodology

### Phase 1: Parallel Exploration

Launch 4 parallel explore subagents to cover different domains simultaneously:

```
1. SECURITY AUDIT
   - Hardcoded secrets, tokens, API keys
   - Injection vulnerabilities (SQL, XSS, command, path traversal)
   - Authentication/authorization gaps
   - CSRF protection
   - SSRF vulnerabilities
   - eval() usage

2. CODE QUALITY AUDIT  
   - Files exceeding 700 LOC (APEX guideline)
   - TypeScript 'any' usage
   - Duplicate code patterns
   - Missing error handling
   - Dead code

3. TEST COVERAGE AUDIT
   - Core files missing .test.ts
   - Critical functions without tests
   - E2E test gaps
   - Coverage below 70% threshold

4. DEPENDENCY AUDIT
   - Version mismatches
   - Outdated/vulnerable deps
   - Manual package.json edits
   - Carbon dependency (never update)
```

### Phase 2: Bug Comorbidity Analysis

For each critical finding, search for related bugs:

| If You Find | Also Check For |
|-------------|----------------|
| Hardcoded secrets | Debug endpoints, verbose errors |
| SQL/XSS injection | Path traversal, command injection, SSRF |
| Race condition | Deadlocks, data corruption, missing locks |
| Memory leak | Unclosed resources, event listeners |
| Null access | Missing validation, async timing |
| Off-by-one | Empty array handling, loop bounds |

### Phase 3: Additional Domain Audits

Launch additional parallel searches as needed:

```
5. EVOLUTION QUEUE CHECK
   - Read ~/clawd/EVOLUTION-QUEUE.md
   - Identify production outages
   - Check for unresolved critical items

6. OPERATIONS AUDIT
   - Logging inconsistencies
   - Missing health checks
   - Shutdown handling
   - Resource cleanup

7. PERFORMANCE AUDIT
   - Synchronous file operations
   - N+1 query patterns
   - Missing caching
   - Blocking operations

8. CI/CD AUDIT (optional)
   - Missing test suites in CI
   - Disabled jobs
   - Labeler coverage gaps

9. DOCUMENTATION AUDIT
   - Missing READMEs
   - JSDoc gaps
   - Stale references
```

---

## Severity Classification

| Severity | Criteria | Action |
|----------|----------|--------|
| **CRITICAL** | Production outage, security breach risk, data loss | Fix immediately |
| **HIGH** | Auth issues, major functionality broken, race conditions | Fix same session |
| **MEDIUM** | Logic bugs, missing tests, tech debt | Schedule fix |
| **LOW** | Style, minor issues, optimizations | Backlog |

---

## Execution Checklist

### Before Starting

```bash
# 1. Verify baseline tests pass
cd /home/liam && pnpm test 2>&1 | tail -10

# 2. Check git status
git status

# 3. Note any pre-existing failures
```

### During Audit

- [ ] Read each file before analyzing
- [ ] Trace every symbol (Context-First protocol)
- [ ] Search for comorbid bugs
- [ ] Document with specific file:line references
- [ ] Classify severity

### Before Each Fix

```bash
# Run baseline test for affected area
pnpm test src/<affected-module>/

# Note the test count
```

### After Each Fix

```bash
# 1. Build
pnpm build

# 2. Lint
pnpm lint

# 3. Test affected area
pnpm test src/<affected-module>/

# 4. Compare test counts (no regressions)
```

### After All Fixes

```bash
# Full gate
pnpm lint && pnpm build && pnpm test

# Verify no new failures introduced
```

---

## Output Format

Create a plan file with:

```markdown
# APEX 6.2 Full Systems Audit Report

**Date:** YYYY-MM-DD
**Methodology:** Bug-comorbidity + parallel exploration
**Coverage:** [list domains audited]

## Domain Summary Table
| Domain | Critical | High | Medium | Low | Total |

## Critical Issues (fix immediately)
### 1. [Issue Title]
- **File:** path/to/file.ts:line
- **Issue:** description
- **Risk:** impact
- **Action:** fix

## High Priority Issues
...

## Medium Priority Issues
...

## Remediation Todos
- id: unique-id
  content: description
  status: pending|in_progress|completed

## Regression Guards
[document test-before/test-after for each fix]
```

---

## Common Patterns to Search

### Security

```bash
# Hardcoded secrets
grep -rn "password\s*=" --include="*.ts" src/
grep -rn "secret\s*=" --include="*.ts" src/
grep -rn "token\s*=" --include="*.ts" src/

# eval() usage
grep -rn "eval(" --include="*.ts" src/

# Path traversal
grep -rn "path.join.*subdir" --include="*.ts" src/

# SSRF
grep -rn "fetch\(\`\${" --include="*.ts" src/
```

### Code Quality

```bash
# Files over 700 LOC
wc -l src/**/*.ts | awk '$1 > 700 {print}'

# 'any' type usage
grep -rn ": any" --include="*.ts" src/
grep -rn "as any" --include="*.ts" src/

# TODO/FIXME
grep -rn "TODO\|FIXME" --include="*.ts" src/
```

### Concurrency

```bash
# Fire-and-forget promises (missing await)
grep -rn "void.*\.catch" --include="*.ts" src/

# Sync file operations
grep -rn "Sync(" --include="*.ts" src/
```

---

## Evolution Queue Integration

After fixing issues, update EVOLUTION-QUEUE.md:

1. Mark resolved items with `[RESOLVED]` in title
2. Add resolution note with date
3. Move to archive if applicable

Example:
```markdown
### [2026-01-28-049] [RESOLVED] Issue Title
- **Status:** RESOLVED
- **Resolution (2026-01-29):** Description of fix
```

---

## APEX 6.2 Compliance Checklist

- [ ] Read-First: All files read before editing
- [ ] Architecture-First: Structure discovered before changes
- [ ] Regression Guard: Tests run before AND after changes
- [ ] Quality Gates: Build/lint/test pass before complete
- [ ] Bug Prevention: No working code broken
- [ ] Non-Destructive: Rollback paths documented
- [ ] Security-First: No hardcoded secrets, inputs validated
- [ ] Bug-Comorbidity: Related bugs searched and addressed

---

## Files Modified in This Audit Session

Track all modified files for review:

```
~/.clawdbot/moltbot.json - Agent tool permissions
~/.clawdbot/cron/jobs.json - Cron job session targets
~/clawd/EVOLUTION-QUEUE.md - Resolved items
src/media/store.ts - Path traversal protection
src/gateway/server-close.ts - Shutdown timeout
src/gateway/server-channels.ts - Race condition guard
```

---

*Reference: APEX v6.2.0 | Skills: bug-comorbidity, security-guard*
