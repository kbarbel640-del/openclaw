---
summary: "Verification checklist for safe operations and skill usage tracking."
read_when:
  - You want to confirm both shared features work after install
  - You need release acceptance criteria before publishing
title: "Safe Ops and Skill Usage Verification"
---

# Safe Ops and Skill Usage Verification

Run this checklist on a clean target machine before publishing.

## 1) Safe wrapper dry-run

```bash
./scripts/openclaw-safe.sh --dry-run gateway restart
```

Expected:

- Command exits successfully.
- Output indicates dry-run execution without changing runtime state.

## 2) Usage commands available

```bash
openclaw skills usage
openclaw skills usage --format json
openclaw skills usage --format markdown
```

Expected:

- All three commands return successfully.
- JSON output includes summary and tracker sections.

## 3) JSON diagnostics fields

Validate these fields exist in `--format json` output:

- `summary.mappedToolCallsTotal`
- `summary.mappedByRunContext`
- `summary.mappedByStaticDispatch`
- `summary.unmappedToolCalls`
- `summary.mappingCoverage`
- `summary.attributionStrategy`
- `summary.attributionStrategyVersion`
- `tracker.runCacheEntries`

## 4) Explicit skill command increments `commandCalls`

Trigger one explicit skill command from a local run:

```bash
openclaw agent --local --message "/weather Beijing" --to +15550001111 --timeout 5
openclaw skills usage --format json
```

Expected:

- The related skill row shows `commandCalls` increased by at least 1.

## 5) Registration sanity

Ensure these skills are present in usage rows:

- `openclaw-safe-ops`
- `skill-usage-tracker`

If any check fails, block publishing and fix before release.
