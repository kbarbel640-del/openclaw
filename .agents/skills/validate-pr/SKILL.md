---
name: validate-pr
description: Post-prepare validation — CI check gating and independent smoke test pass. Use after /prepare-pr to verify the PR is ready for merge.
---

# Validate PR

## Overview

Validate a prepared PR by verifying CI checks pass and running an independent local smoke test pass. This is the gate between `/prepare-pr` and `/merge-pr`.

## Inputs

- Ask for PR number or URL.
- If missing, use `.local/prep.env` if present in the PR worktree.

## Safety

- Read-only: no code changes, no pushes, no merges.
- Work only in `.worktrees/pr-<PR>`.
- Wrapper commands are cwd-agnostic; run from repo root or inside the PR worktree.

## Execution Contract

1. Run full validation (CI + smoke):

```sh
scripts/pr-validate <PR>
```

2. Or run stages independently:

```sh
scripts/pr-validate ci <PR>       # CI checks only
scripts/pr-validate smoke <PR>    # local smoke re-test only
```

## Steps

1. Verify artifacts from prepare

```sh
ls -la .local/prep.env .local/prep.md .local/review.json
```

2. Wait for CI checks

```sh
scripts/pr-validate ci <PR>
```

This step:

- Waits for all required GitHub CI checks to complete
- Verifies no required checks are failing or pending
- Confirms PR head SHA hasn't drifted since prepare
- Writes `.local/validate-ci.env`

3. Run independent smoke tests

```sh
scripts/pr-validate smoke <PR>
```

This step:

- Runs `pnpm build`, `pnpm check`, `pnpm test` as a fresh independent pass
- If review identified specific test files in `.local/review.json`, runs them via `pnpm vitest run`
- Writes `.local/validate-smoke.env`

4. Verify handoff artifacts

```sh
ls -la .local/validate.env .local/validate-ci.env .local/validate-smoke.env
```

5. Output

- Print: `Validation passed, ready for /merge-pr`.
- Hand off to `/merge-pr` or re-run `scripts/pr-run <PR>`.

## Required Artifacts (input)

- `.local/prep.env` — from prepare stage (contains `PREP_HEAD_SHA`)
- `.local/prep-context.env` — from prepare stage (contains `PREP_BRANCH`)
- `.local/review.json` — from review stage (used for smoke test target extraction)

## Produced Artifacts (output)

- `.local/validate-ci.env` — CI check results and timestamp
- `.local/validate-smoke.env` — smoke test results and timestamp
- `.local/validate.env` — combined validation result

## Next Step

Hand off to `/merge-pr`:

```sh
scripts/pr-merge run <PR>
```

Or, if running inside the full pipeline, `scripts/pr-run <PR>` handles this automatically.

## Guardrails

- Do not modify code.
- Do not push or merge.
- Do not delete worktree.
