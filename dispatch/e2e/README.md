# Dispatch E2E Scaffold

Implemented canonical harness:

- `dispatch/tests/story_08_e2e_canonical.node.test.mjs`

Scenario chain covered by current harness:

1. intake creates ticket
2. triage marks emergency type/priority
3. emergency dispatch assignment (`EMERGENCY_BYPASS`)
4. harness shim to `IN_PROGRESS` (until `tech.check_in` command path exists)
5. fail-closed `tech.complete` rejection with missing evidence
6. evidence upload + idempotent replay check
7. successful `tech.complete` to `COMPLETED_PENDING_VERIFICATION`
8. timeline/audit/transition integrity assertions
