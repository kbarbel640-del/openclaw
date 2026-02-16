# Orchestration Rules

## Review Gates (Required)
Before **any push or merge**, all of the following must be complete and recorded:

1. **Security Review**
   - Performed by `security-agent`.
   - Review-only; no code changes.
   - Must explicitly state `Security Review: PASS`.

2. **QA Review**
   - Performed by the QA reviewer/agent.
   - Must include test/verification summary.
   - Must explicitly state `QA Review: PASS`.

## Blocking Conditions
- If either review is missing or fails, **do not push or merge**.
- Address findings, then re-run the required reviews.
