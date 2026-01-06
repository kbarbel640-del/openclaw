# Phase 1: Bug Report Collection

Goal: Collect structured, actionable bug information with all mandatory fields.

## Step 1: Get Bug Report

Ask for the bug report if not already provided. Encourage detailed, specific input.

**Prompt:**
```
Please provide a bug report with the following information:
1. Summary (one line)
2. Expected behavior (what SHOULD happen)
3. Actual behavior (what DOES happen)
4. Steps to reproduce (numbered)
5. Error output (exact logs/messages)
6. Environment (OS, version, config)
7. Severity (P0-Critical, P1-High, P2-Medium, P3-Low)
```

## Step 2: Validate Mandatory Fields

All fields below MUST be present:

| Field | Description | Example |
|-------|-------------|---------|
| Summary | One-line description | "Login fails with null pointer" |
| Expected | What should happen | "User should see dashboard" |
| Actual | What happens | "Error: Cannot read property 'id' of null" |
| Steps | Numbered reproduction | "1. Open app, 2. Click login..." |
| Error Output | Exact logs/traces | Stack trace, console output |
| Environment | System details | "Node 18, Ubuntu 22.04" |
| Severity | Priority level | P1-High |

## Step 3: Assess Severity

| Severity | Description | Response Time |
|----------|-------------|---------------|
| P0-Critical | System down, data loss | Immediate |
| P1-High | Major feature broken | Same day |
| P2-Medium | Feature degraded | This sprint |
| P3-Low | Minor issue | Backlog |

## Step 4: Generate Bug ID

Format: `BUG-YYYY-MM-DD-NNN`

Example: `BUG-2026-01-06-001`

## Validation Checklist

- [ ] Summary is specific (not "it doesn't work")
- [ ] Expected vs Actual clearly different
- [ ] Steps are numbered and specific
- [ ] Error output is exact (copy-paste, not paraphrase)
- [ ] Environment is complete
- [ ] Severity is justified

## Common Problems

### Problem: Vague Summary
❌ "App crashes"
✅ "App crashes when clicking save button on edit profile page"

### Problem: Missing Steps
❌ "Just use the app and it breaks"
✅ "1. Login as admin, 2. Go to Settings, 3. Click 'Export', 4. Error appears"

### Problem: Paraphrased Error
❌ "Some kind of null error"
✅ "TypeError: Cannot read property 'name' of undefined at UserService.ts:42"

## Output

Create `bug-report.md` with all validated information using template:
- `TEMPLATES/bug-report.template.md`

## Completion Gate

Only proceed to Phase 2 when:
- [ ] All mandatory fields are filled
- [ ] Steps are specific and numbered
- [ ] Error output is exact
- [ ] Bug ID is generated
