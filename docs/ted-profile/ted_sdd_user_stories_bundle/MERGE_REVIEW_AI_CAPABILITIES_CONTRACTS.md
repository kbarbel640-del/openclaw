# Merge Review: AI Capabilities, Data Contracts, and JTBD Package

## Council Decision

- Keep this package in the SDD framework.
- Merge only non-duplicative, high-value additions.
- Preserve existing governance ceilings (draft-only outbound, approval-first risky writes, single-operator Day-1, no autonomous trading/external send).

## Coverage Decision

| Submitted section                                                             | Outcome                   | Notes                                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| AI strengths map (classification/extraction/drafting/briefing/anomaly assist) | Covered/clarified         | Existing stories already encode these capabilities; map is useful as architecture guidance.                         |
| What must NOT rely on AI alone                                                | Covered/clarified         | Governance enforcement and external side effects are already constrained; retained as explicit principle.           |
| Control points (pre-output, pre-side-effect, post-delivery)                   | Partial -> merged         | Added explicit story coverage for output schema and confidence escalation.                                          |
| Reusable bot template                                                         | Partial -> merged         | Incorporated via role-card and output-contract stories.                                                             |
| Data contracts (`EntityTag`, `Provenance`, `AuditEvent`)                      | Partial -> merged         | Entity/provenance already added; output/audience/redaction contracts strengthened via new stories.                  |
| Confidence and escalation thresholds                                          | Partial -> merged         | Added global confidence policy story (not limited to one extractor flow).                                           |
| Redaction contract (PHI + audience)                                           | Partial -> merged         | Added audience-clearance and redaction-report story.                                                                |
| JTBD statement                                                                | Covered                   | Current spine/JTBD docs already represent this direction.                                                           |
| Risks/open questions                                                          | Covered/partial           | Existing risk register/open questions already cover most; integration specifics remain roadmap/open-question items. |
| Full multi-phase “Bot Fleet OS” spec                                          | Deferred as parallel spec | Do not create parallel canon; merge deltas into existing bundle/specs only.                                         |

## Net-New Stories Added from This Package

- TED-US-059 — Standard bot output contract with citations, entity scope, and audience
- TED-US-060 — Confidence policy and escalation thresholds for extracted actions
- TED-US-061 — Audience-clearance redaction and privileged-routing enforcement
