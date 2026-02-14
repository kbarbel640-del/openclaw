# Runbook: Completion Rejection Spike

Alert code: `COMPLETION_REJECTION_SPIKE`

## Signal
- `GET /ops/alerts` includes `COMPLETION_REJECTION_SPIKE`.
- `signals.completion_rejection_count >= thresholds.completion_rejection_count`.
- Backing API error code: `CLOSEOUT_REQUIREMENTS_INCOMPLETE`.

## Triage
1. Confirm alert payload:
   - `curl -s http://127.0.0.1:8080/ops/alerts`
2. Inspect closeout errors in durable logs:
   - filter for `error_code=CLOSEOUT_REQUIREMENTS_INCOMPLETE`.
3. Identify dominant `requirement_code` in response payloads:
   - `MISSING_SIGNATURE_CONFIRMATION`
   - `INVALID_EVIDENCE_REFERENCE`
   - template/checklist gaps.

## Remediation
1. Technician liaison updates missing evidence/checklist requirements.
2. Re-run `tech.complete` only after required evidence keys are present.
3. Re-run `qa.verify` and confirm transition to `VERIFIED`.

## Exit Criteria
- Alert clears in `/ops/alerts`.
- Ticket flow continues to `VERIFIED` without repeated closeout rejection loops.
