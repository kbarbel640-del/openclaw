# Merge Review: Bot Fleet OS User Stories

## Council Decision

- Do not import the proposed backlog as a parallel story set.
- Merge only high-value deltas not already represented in current TED-US stories.
- Preserve locked SDD constraints: draft-only outbound, approval-first risky writes, single-operator Day-1, no personal mailbox/calendar in Day-1.

## Mapping Summary

| Proposed story                                | Merge outcome               | Mapped / added TED-US                   |
| --------------------------------------------- | --------------------------- | --------------------------------------- |
| SDD-A01 Entity tagging mandatory              | Added (delta)               | TED-US-053                              |
| SDD-A02 Cross-entity rendering blocked        | Added (delta)               | TED-US-054                              |
| SDD-A03 Authority tiers govern actions        | Covered                     | TED-US-002, TED-US-049, TED-US-050      |
| SDD-A04 Pause all bots emergency override     | Added (delta)               | TED-US-055                              |
| SDD-A05 Source-cited outputs                  | Covered                     | TED-US-008                              |
| SDD-B01 Health monitoring                     | Covered                     | TED-US-011, TED-US-012                  |
| SDD-B02 Rate limit and retry discipline       | Added (delta)               | TED-US-057                              |
| SDD-B03 Audit trail for access/actions        | Covered                     | TED-US-005                              |
| SDD-C01 Email drafting manual send            | Covered                     | TED-US-014, TED-US-015, TED-US-016      |
| SDD-C02 Contradiction detection               | Added (delta)               | TED-US-056                              |
| SDD-C03 Calendar safe scheduling              | Covered/partial             | TED-US-020, TED-US-021, TED-US-023      |
| SDD-C04 Task extraction confidence            | Covered/partial             | TED-US-022, TED-US-028                  |
| SDD-C05 Filing with entity-aware routing      | Covered/partial             | TED-US-017, TED-US-019, TED-US-053      |
| SDD-C06 Personal/work separated briefs        | Deferred/re-scoped          | Conflicts with Day-1 no-personal scope  |
| SDD-C07 Meeting transcription with exclusions | Added (delta)               | TED-US-058                              |
| SDD-D01 Deal intake structured record         | Covered/partial             | TED-US-024, TED-US-025                  |
| SDD-D02 Drafting from approved templates      | Covered                     | TED-US-030, TED-US-031                  |
| SDD-D03 Contract review material changes      | Covered/partial             | TED-US-032, TED-US-033                  |
| SDD-D04 Signature tracking escalation         | Deferred (candidate)        | Future story after Phase-1              |
| SDD-D05 Reproducible intelligence research    | Covered/partial             | TED-US-035, TED-US-036, TED-US-037      |
| SDD-E01..E05 Everest infrastructure set       | Deferred (domain expansion) | Future epic after Phase-2 stabilization |
| SDD-F01 No-trade enforcement                  | Covered                     | TED-US-044                              |
| SDD-F02 Thesis checks + freshness             | Covered/partial             | TED-US-045                              |
| SDD-G01 Template versioning/changelog         | Covered/partial             | TED-US-030, TED-US-031                  |
| SDD-G02 Learn from edits with promotion       | Covered                     | TED-US-051                              |

## Notes

- This merge intentionally avoids duplicate stories for behavior that is already represented.
- Deferred items remain candidates for future epics when Day-1/Phase-1 gates are consistently green.
